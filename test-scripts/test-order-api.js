// اختبار إنشاء طلب مباشرة عبر API ومراقبة قاعدة البيانات
const { createClient } = require('@supabase/supabase-js');

// إعدادات Supabase للاختبار
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

// بيانات المستخدم للاختبار
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Password123!';

// إنشاء عميل Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * وظيفة تسجيل مع وقت
 */
function logWithTimestamp(message) {
  const now = new Date();
  const timestamp = now.toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * تسجيل الدخول بالبريد الإلكتروني
 */
async function login(email, password) {
  try {
    logWithTimestamp(`محاولة تسجيل الدخول كـ ${email}...`);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      throw new Error(`فشل تسجيل الدخول: ${error.message}`);
    }
    
    logWithTimestamp('تم تسجيل الدخول بنجاح');
    return data.user;
  } catch (error) {
    logWithTimestamp(`خطأ في تسجيل الدخول: ${error.message}`);
    throw error;
  }
}

/**
 * الحصول على منتجات للاختبار
 */
async function getTestProducts(limit = 2) {
  try {
    logWithTimestamp(`البحث عن ${limit} منتجات للاختبار...`);
    
    const { data, error } = await supabase
      .from('products')
      .select('id, name, product_code, piece_price, box_price')
      .limit(limit);
      
    if (error) {
      throw new Error(`فشل الحصول على المنتجات: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      throw new Error('لا توجد منتجات متاحة للاختبار');
    }
    
    logWithTimestamp(`تم العثور على ${data.length} منتج للاختبار`);
    return data;
  } catch (error) {
    logWithTimestamp(`خطأ في الحصول على المنتجات: ${error.message}`);
    throw error;
  }
}

/**
 * إنشاء طلب جديد بالـ API
 */
async function createOrderWithAPI(userId, products) {
  try {
    logWithTimestamp('=== بدء عملية إنشاء الطلب ===');
    
    // تحويل المنتجات إلى عناصر الطلب
    const orderItems = products.map(product => {
      const quantity = Math.floor(Math.random() * 3) + 1; // كمية عشوائية بين 1 و 3
      const price = product.piece_price || 10.0;
      return {
        product_id: product.id,
        product_name: product.name,
        product_code: product.product_code || 'TEST',
        quantity: quantity,
        unit_price: price,
        total_price: price * quantity,
        notes: 'ملاحظة اختبار API'
      };
    });
    
    // حساب إجمالي الطلب
    const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0);
    
    // إنشاء بيانات الطلب
    const orderData = {
      user_id: userId,
      created_at: new Date().toISOString()
    };
    
    logWithTimestamp('بيانات الطلب المجهزة:');
    console.log(JSON.stringify(orderData, null, 2));
    
    // STEP 1: إنشاء الطلب في جدول orders
    logWithTimestamp('1. إنشاء الطلب في جدول orders...');
    
    // أرسل بيانات الطلب الرئيسية فقط (بدون items)
    const { data: orderResult, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select('id')
      .single();
    
    // التحقق من نجاح إنشاء الطلب
    if (orderError) {
      throw new Error(`فشل إنشاء الطلب: ${orderError.message}`);
    }
    
    if (!orderResult || !orderResult.id) {
      throw new Error('تم إنشاء الطلب ولكن لم يتم استلام معرف الطلب');
    }
    
    const orderId = orderResult.id;
    logWithTimestamp(`تم إنشاء الطلب بنجاح مع المعرف: ${orderId}`);
    
    // STEP 2: إنشاء عناصر الطلب في جدول order_items
    logWithTimestamp('2. إنشاء عناصر الطلب في جدول order_items...');
    
    // تحضير عناصر الطلب مع معرف الطلب
    const orderItemsWithOrderId = orderItems.map(item => ({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      note: item.notes,
      is_prepared: false,
      created_at: new Date().toISOString()
    }));
    
    // إدراج عناصر الطلب
    const { data: itemsResult, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId)
      .select();
    
    // التحقق من نجاح إنشاء عناصر الطلب
    if (itemsError) {
      // في حالة الفشل، نحاول حذف الطلب لتنظيف قاعدة البيانات
      logWithTimestamp(`خطأ في إنشاء عناصر الطلب: ${itemsError.message}`);
      logWithTimestamp('محاولة حذف الطلب الذي فشل...');
      
      await supabase.from('orders').delete().eq('id', orderId);
      throw new Error(`فشل إنشاء عناصر الطلب: ${itemsError.message}`);
    }
    
    logWithTimestamp(`تم إنشاء ${itemsResult.length} عنصر للطلب بنجاح`);
    
    // STEP 3: التحقق من الطلب المنشأ من قاعدة البيانات
    logWithTimestamp('3. التحقق من الطلب المنشأ من قاعدة البيانات...');
    
    // استرجاع الطلب مع العناصر
    const { data: fullOrder, error: fullOrderError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        created_at,
        order_items (
          id,
          product_id,
          quantity,
          note,
          is_prepared
        )
      `)
      .eq('id', orderId)
      .single();
    
    if (fullOrderError) {
      throw new Error(`فشل استرجاع الطلب من قاعدة البيانات: ${fullOrderError.message}`);
    }
    
    logWithTimestamp('تفاصيل الطلب المسترجع من قاعدة البيانات:');
    console.log(JSON.stringify(fullOrder, null, 2));
    
    logWithTimestamp('=== تم إنشاء الطلب بنجاح ===');
    
    return {
      success: true,
      message: 'تم إنشاء الطلب واختباره بنجاح',
      order_id: orderId,
      order: fullOrder
    };
  } catch (error) {
    logWithTimestamp(`!!! فشل إنشاء الطلب: ${error.message} !!!`);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * تنفيذ الاختبار الكامل
 */
async function runTest() {
  try {
    logWithTimestamp('=== بدء اختبار إنشاء الطلب عبر API ===');
    
    // 1. تسجيل الدخول
    const user = await login(TEST_EMAIL, TEST_PASSWORD);
    
    // 2. الحصول على منتجات للاختبار
    const products = await getTestProducts(3);
    
    // 3. إنشاء طلب جديد
    const result = await createOrderWithAPI(user.id, products);
    
    // 4. طباعة النتيجة
    logWithTimestamp('نتيجة الاختبار:');
    console.log(JSON.stringify(result, null, 2));
    
    logWithTimestamp('=== انتهى اختبار إنشاء الطلب ===');
    
    return result;
  } catch (error) {
    logWithTimestamp(`!!! فشل اختبار إنشاء الطلب: ${error.message} !!!`);
    return {
      success: false,
      message: error.message
    };
  }
}

// تنفيذ الاختبار
runTest().then(result => {
  if (!result.success) {
    process.exit(1);
  }
}); 
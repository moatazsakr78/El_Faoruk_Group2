// اختبار إنشاء طلب جديد
const { supabase } = require('./supabase-order-helper');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// إعدادات Supabase للاختبار
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

// بيانات المستخدم للاختبار
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Password123!';

/**
 * تسجيل الدخول بالبريد الإلكتروني
 */
async function login(email, password) {
  try {
    console.log(`محاولة تسجيل الدخول كـ ${email}...`);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      throw new Error(`فشل تسجيل الدخول: ${error.message}`);
    }
    
    console.log('تم تسجيل الدخول بنجاح');
    return data.user;
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    throw error;
  }
}

/**
 * اختبار إنشاء طلب
 */
async function testCreateOrder() {
  try {
    console.log('=== بدء اختبار إنشاء طلب ===');
    
    // 1. تسجيل الدخول
    const user = await login(TEST_EMAIL, TEST_PASSWORD);
    console.log('معرف المستخدم:', user.id);
    
    // 2. الحصول على بعض المنتجات للطلب
    console.log('\nالبحث عن منتجات للطلب...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, product_code')
      .limit(2);
      
    if (productsError) {
      throw new Error(`فشل الحصول على المنتجات: ${productsError.message}`);
    }
    
    if (!products || products.length === 0) {
      throw new Error('لا توجد منتجات متاحة للاختبار');
    }
    
    console.log(`تم العثور على ${products.length} منتج:`, 
                products.map(p => `${p.name} (${p.id})`).join(', '));
    
    // 3. إنشاء عناصر الطلب
    const orderItems = products.map(product => ({
      product_id: product.id,
      product_name: product.name,
      product_code: product.product_code || 'TEST',
      quantity: Math.floor(Math.random() * 5) + 1, // كمية عشوائية بين 1 و 5
      unit_price: 10.0,
      total_price: 10.0 * (Math.floor(Math.random() * 5) + 1),
      notes: 'ملاحظة اختبار'
    }));
    
    // 4. إنشاء الطلب (مباشرة في جداول قاعدة البيانات)
    console.log('\nإنشاء طلب جديد...');
    
    // أولاً: إنشاء الطلب في جدول orders
    console.log('1. إدراج بيانات الطلب في جدول orders...');
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        total_amount: orderItems.reduce((sum, item) => sum + item.total_price, 0),
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (orderError) {
      throw new Error(`خطأ في إنشاء الطلب: ${orderError.message}`);
    }
    
    if (!order || !order.id) {
      throw new Error('تم إنشاء الطلب ولكن لم يتم الحصول على معرف');
    }
    
    console.log(`تم إنشاء الطلب بنجاح مع المعرف: ${order.id}`);
    
    // ثانياً: إضافة عناصر الطلب في جدول order_items
    console.log('2. إدراج عناصر الطلب في جدول order_items...');
    
    // إضافة order_id لكل عنصر
    const orderItemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: order.id
    }));
    
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId)
      .select();
    
    if (itemsError) {
      console.error('خطأ في إضافة عناصر الطلب:', itemsError);
      
      // محاولة حذف الطلب إذا فشلت إضافة العناصر
      console.log('محاولة حذف الطلب الفاشل...');
      await supabase.from('orders').delete().eq('id', order.id);
      
      throw new Error(`خطأ في إضافة عناصر الطلب: ${itemsError.message}`);
    }
    
    console.log(`تم إضافة ${items.length} عنصر للطلب بنجاح`);
    
    // 5. استرجاع الطلب كاملاً للتأكد من وجوده
    console.log('\nالتحقق من الطلب المنشأ...');
    
    const { data: fullOrder, error: fullOrderError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        total_amount,
        status,
        created_at,
        order_items (
          id,
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price
        )
      `)
      .eq('id', order.id)
      .single();
    
    if (fullOrderError) {
      throw new Error(`خطأ في استرجاع الطلب: ${fullOrderError.message}`);
    }
    
    console.log('تفاصيل الطلب الكامل:');
    console.log(`- معرف الطلب: ${fullOrder.id}`);
    console.log(`- معرف المستخدم: ${fullOrder.user_id}`);
    console.log(`- المبلغ الإجمالي: ${fullOrder.total_amount}`);
    console.log(`- الحالة: ${fullOrder.status}`);
    console.log(`- تاريخ الإنشاء: ${fullOrder.created_at}`);
    console.log(`- عدد العناصر: ${fullOrder.order_items.length}`);
    
    // 6. طباعة تفاصيل العناصر
    console.log('\nتفاصيل عناصر الطلب:');
    fullOrder.order_items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.product_name} - الكمية: ${item.quantity}, السعر: ${item.unit_price}`);
    });
    
    console.log('\n=== تم اختبار إنشاء الطلب بنجاح ===');
    return {
      success: true,
      message: 'تم إنشاء واختبار الطلب بنجاح',
      order_id: order.id
    };
  } catch (error) {
    console.error('\n!!! فشل اختبار إنشاء الطلب !!!');
    console.error('رسالة الخطأ:', error.message);
    
    return {
      success: false,
      message: error.message
    };
  }
}

// تنفيذ الاختبار
testCreateOrder().then(result => {
  console.log('\nنتيجة الاختبار:', result.success ? 'نجاح 🎉' : 'فشل ❌');
  
  if (!result.success) {
    console.error('سبب الفشل:', result.message);
    process.exit(1);
  } else {
    console.log('معرف الطلب المنشأ:', result.order_id);
  }
}); 
// اختبار الوحدة المحسنة للوصول إلى قاعدة البيانات
const { testDatabaseConnection, createOrderDirect, getOrdersWithDetails } = require('./lib/fixed-db-access');
const { createClient } = require('@supabase/supabase-js');

// إعدادات Supabase للحصول على بيانات الاختبار
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

async function runTests() {
  try {
    // 1. اختبار الاتصال
    console.log('اختبار الاتصال بقاعدة البيانات...');
    const connectionResult = await testDatabaseConnection();
    console.log('نتيجة اختبار الاتصال:', connectionResult.success);
    
    if (!connectionResult.success) {
      console.error('فشل اختبار الاتصال، توقف الاختبار');
      return;
    }
    
    // 2. الحصول على بيانات الاختبار من Supabase
    console.log('الحصول على بيانات الاختبار من Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // الحصول على مستخدم للاختبار
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.error('لا يمكن الحصول على مستخدم للاختبار:', usersError);
      return;
    }
    
    const userId = users[0].id;
    console.log('معرف المستخدم للاختبار:', userId);
    
    // الحصول على منتج للاختبار
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name')
      .limit(2);
    
    if (productsError || !products || products.length === 0) {
      console.error('لا يمكن الحصول على منتجات للاختبار:', productsError);
      return;
    }
    
    console.log('المنتجات للاختبار:', products);
    
    // 3. إنشاء طلب تجريبي
    console.log('إنشاء طلب تجريبي...');
    const orderData = {
      user_id: userId
    };
    
    const orderItems = [
      {
        product_id: products[0].id,
        quantity: 2,
        note: 'اختبار المنتج الأول'
      }
    ];
    
    // إضافة المنتج الثاني إذا كان متوفراً
    if (products.length > 1) {
      orderItems.push({
        product_id: products[1].id,
        quantity: 1,
        note: 'اختبار المنتج الثاني'
      });
    }
    
    const createResult = await createOrderDirect(orderData, orderItems);
    console.log('نتيجة إنشاء الطلب:', createResult.success);
    
    if (createResult.success) {
      console.log('معرف الطلب الجديد:', createResult.order_id);
      console.log('تفاصيل الطلب الجديد:', createResult.order_details);
    } else {
      console.error('فشل إنشاء الطلب:', createResult.message);
    }
    
    // 4. استعلام عن جميع الطلبات
    console.log('استعلام عن جميع الطلبات...');
    const ordersResult = await getOrdersWithDetails();
    
    if (ordersResult.success) {
      console.log(`تم العثور على ${ordersResult.orders.length} طلب:`);
      console.log(JSON.stringify(ordersResult.orders, null, 2));
    } else {
      console.error('فشل استعلام الطلبات:', ordersResult.message);
    }
    
  } catch (error) {
    console.error('خطأ غير متوقع أثناء الاختبار:', error);
  }
}

runTests(); 
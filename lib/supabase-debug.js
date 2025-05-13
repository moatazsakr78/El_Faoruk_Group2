// ملف لفحص اتصال وعمليات Supabase
const { createClient } = require('@supabase/supabase-js');

// إعداد اتصال Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

async function testOrderInsert() {
  try {
    console.log('بدء الاختبار...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. التحقق من بنية جدول orders
    console.log('التحقق من بنية جدول orders...');
    try {
      const { data: columnsInfo, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'orders')
        .eq('table_schema', 'public');
      
      if (columnsError) {
        console.error('خطأ في استعلام الأعمدة:', columnsError);
      } else {
        console.log('أعمدة جدول orders:', columnsInfo);
      }
    } catch (e) {
      console.error('خطأ غير متوقع عند التحقق من بنية الجدول:', e);
    }
    
    // 2. إدخال سجل تجريبي في جدول orders
    console.log('محاولة إدخال سجل تجريبي في جدول orders...');
    const testOrder = {
      user_id: '00000000-0000-0000-0000-000000000000', // استخدم معرف مستخدم حقيقي إذا كان متاحاً
      total_amount: 100,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: orderResult, error: orderError } = await supabase
      .from('orders')
      .insert(testOrder)
      .select();
    
    if (orderError) {
      console.error('خطأ في إدخال الطلب:', orderError);
      
      // محاولة بدون حقل status
      console.log('محاولة إدخال الطلب بدون حقل status...');
      const { status, ...orderWithoutStatus } = testOrder;
      const { data: orderResult2, error: orderError2 } = await supabase
        .from('orders')
        .insert(orderWithoutStatus)
        .select();
      
      if (orderError2) {
        console.error('خطأ في المحاولة الثانية:', orderError2);
      } else {
        console.log('تم إدخال الطلب بنجاح في المحاولة الثانية:', orderResult2);
      }
    } else {
      console.log('تم إدخال الطلب بنجاح:', orderResult);
      
      // 3. إذا نجح إدخال الطلب، نحاول إدخال سجل في order_items
      if (orderResult && orderResult.length > 0) {
        console.log('محاولة إدخال سجل تجريبي في جدول order_items...');
        const testOrderItem = {
          order_id: orderResult[0].id,
          product_id: '00000000-0000-0000-0000-000000000000', // استخدم معرف منتج حقيقي إذا كان متاحاً
          product_name: 'منتج تجريبي',
          product_code: 'TEST001',
          quantity: 1,
          unit_price: 100,
          total_price: 100,
          notes: 'اختبار'
        };
        
        const { data: itemResult, error: itemError } = await supabase
          .from('order_items')
          .insert(testOrderItem)
          .select();
        
        if (itemError) {
          console.error('خطأ في إدخال عنصر الطلب:', itemError);
        } else {
          console.log('تم إدخال عنصر الطلب بنجاح:', itemResult);
        }
      }
    }
  } catch (error) {
    console.error('خطأ غير متوقع:', error);
  }
}

testOrderInsert(); 
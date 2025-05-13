// تجربة إنشاء طلبات باستخدام الهيكل الصحيح لقاعدة البيانات
const { createClient } = require('@supabase/supabase-js');

// إعداد اتصال Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

async function testOrderCreation() {
  try {
    console.log('بدء اختبار إنشاء الطلب...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. الحصول على مستخدم حقيقي من قاعدة البيانات لاستخدامه في الطلب
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError) {
      console.error('خطأ في استعلام المستخدمين:', usersError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.error('لم يتم العثور على مستخدمين في قاعدة البيانات');
      return;
    }
    
    const userId = users[0].id;
    console.log('تم العثور على معرف مستخدم للاختبار:', userId);
    
    // 2. الحصول على منتج حقيقي من قاعدة البيانات لاستخدامه في عناصر الطلب
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, product_code, piece_price')
      .limit(1);
    
    if (productsError) {
      console.error('خطأ في استعلام المنتجات:', productsError);
      return;
    }
    
    if (!products || products.length === 0) {
      console.error('لم يتم العثور على منتجات في قاعدة البيانات');
      return;
    }
    
    const product = products[0];
    console.log('تم العثور على منتج للاختبار:', product);
    
    // 3. إنشاء طلب جديد
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        created_at: new Date().toISOString()
      })
      .select();
    
    if (orderError) {
      console.error('خطأ في إنشاء الطلب:', orderError);
      return;
    }
    
    console.log('تم إنشاء الطلب بنجاح:', newOrder);
    
    // 4. إضافة عنصر إلى الطلب
    const { data: newOrderItem, error: orderItemError } = await supabase
      .from('order_items')
      .insert({
        order_id: newOrder[0].id,
        product_id: product.id,
        quantity: 2,
        created_at: new Date().toISOString(),
        note: 'ملاحظة تجريبية للاختبار',
        is_prepared: false
      })
      .select();
    
    if (orderItemError) {
      console.error('خطأ في إضافة عنصر الطلب:', orderItemError);
      return;
    }
    
    console.log('تم إضافة عنصر الطلب بنجاح:', newOrderItem);
    
    // 5. استعلام عن الطلب مع عناصره للتأكد من الإنشاء الصحيح
    const { data: orderWithItems, error: queryError } = await supabase
      .from('orders')
      .select(`
        id, 
        created_at,
        users (email, username),
        order_items (
          id,
          quantity,
          note,
          is_prepared,
          products (id, name, product_code)
        )
      `)
      .eq('id', newOrder[0].id)
      .single();
    
    if (queryError) {
      console.error('خطأ في استعلام الطلب مع عناصره:', queryError);
      return;
    }
    
    console.log('تم استرجاع الطلب مع عناصره بنجاح:');
    console.log(JSON.stringify(orderWithItems, null, 2));
    
  } catch (error) {
    console.error('خطأ غير متوقع:', error);
  }
}

testOrderCreation(); 
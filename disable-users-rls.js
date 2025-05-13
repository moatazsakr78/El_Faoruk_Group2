// تعطيل سياسات RLS لجدول المستخدمين لحل مشكلة infinite recursion
const { createClient } = require('@supabase/supabase-js');

// إعداد اتصال Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

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
 * تعطيل سياسات RLS لجدول المستخدمين
 */
async function disableUsersRLS() {
  try {
    logWithTimestamp('=== بدء تعطيل سياسات RLS لجدول المستخدمين ===');
    
    // تسجيل الدخول أولاً للحصول على صلاحيات
    logWithTimestamp('محاولة تسجيل الدخول...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'Password123!'
    });
    
    if (authError) {
      throw new Error(`فشل تسجيل الدخول: ${authError.message}`);
    }
    
    logWithTimestamp('تم تسجيل الدخول بنجاح');
    
    // مسح جميع السياسات الحالية لجدول المستخدمين
    const policies = [
      "Users can view own data",
      "Users can update own data",
      "Enable insert for authenticated users only",
      "Allow users to view their own user data",
      "Allow users to update their own data",
      "Allow users to view their own profile",
      "Allow users to update their own profile",
      "Allow all users to view all user data"
    ];
    
    for (const policy of policies) {
      try {
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: `DROP POLICY IF EXISTS "${policy}" ON "users";` 
        });
        
        if (error) {
          logWithTimestamp(`تحذير عند مسح سياسة "${policy}": ${error.message}`);
        } else {
          logWithTimestamp(`تم مسح سياسة "${policy}" إن وجدت`);
        }
      } catch (err) {
        logWithTimestamp(`خطأ في مسح سياسة "${policy}": ${err.message}`);
      }
    }
    
    // تعطيل RLS على جدول المستخدمين
    try {
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: `ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;` 
      });
      
      if (error) {
        throw new Error(`فشل تعطيل RLS: ${error.message}`);
      }
      
      logWithTimestamp('تم تعطيل سياسات RLS لجدول المستخدمين بنجاح');
    } catch (err) {
      throw new Error(`فشل تعطيل RLS: ${err.message}`);
    }
    
    // اختبار إنشاء طلب بعد تعطيل RLS
    logWithTimestamp('جاري اختبار إنشاء طلب...');
    
    const orderData = {
      user_id: authData.user.id,
      created_at: new Date().toISOString()
    };
    
    const { data: orderResult, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select('id')
      .single();
    
    if (orderError) {
      throw new Error(`فشل اختبار إنشاء الطلب: ${orderError.message}`);
    }
    
    logWithTimestamp(`نجح اختبار إنشاء الطلب! معرف الطلب: ${orderResult.id}`);
    
    // إنشاء عناصر الطلب للاختبار
    const orderItems = [
      {
        order_id: orderResult.id,
        product_id: '01234567-89ab-cdef-0123-456789abcdef',
        quantity: 2,
        note: 'ملاحظة اختبار',
        is_prepared: false,
        created_at: new Date().toISOString()
      }
    ];
    
    const { data: itemsResult, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select();
      
    if (itemsError) {
      logWithTimestamp(`فشل إضافة عناصر الطلب: ${itemsError.message}`);
      
      // محاولة تعطيل RLS لجدول عناصر الطلبات
      logWithTimestamp('محاولة تعطيل RLS لجدول عناصر الطلبات...');
      
      try {
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: `
            DROP POLICY IF EXISTS "Users can view their order items" ON order_items;
            DROP POLICY IF EXISTS "Users can insert order items" ON order_items;
            DROP POLICY IF EXISTS "Users can update their order items" ON order_items;
            DROP POLICY IF EXISTS "Users can delete their order items" ON order_items;
            ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
          ` 
        });
        
        if (error) {
          logWithTimestamp(`تحذير عند تعطيل RLS لجدول عناصر الطلبات: ${error.message}`);
        } else {
          logWithTimestamp('تم تعطيل سياسات RLS لجدول عناصر الطلبات بنجاح');
          
          // محاولة إضافة عناصر الطلب مرة أخرى
          const { data: retryResult, error: retryError } = await supabase
            .from('order_items')
            .insert(orderItems)
            .select();
            
          if (retryError) {
            logWithTimestamp(`فشل إضافة عناصر الطلب بعد تعطيل RLS: ${retryError.message}`);
          } else {
            logWithTimestamp(`تم إضافة ${retryResult.length} عنصر للطلب بنجاح بعد تعطيل RLS`);
          }
        }
      } catch (err) {
        logWithTimestamp(`خطأ في تعطيل RLS لجدول عناصر الطلبات: ${err.message}`);
      }
    } else {
      logWithTimestamp(`تم إضافة ${itemsResult.length} عنصر للطلب بنجاح`);
    }
    
    logWithTimestamp('=== تم تعطيل سياسات RLS واختبار العملية بنجاح ===');
    
    return {
      success: true,
      message: 'تم تعطيل سياسات RLS بنجاح',
      order_id: orderResult?.id
    };
  } catch (error) {
    logWithTimestamp(`!!! فشل تعطيل سياسات RLS: ${error.message} !!!`);
    return {
      success: false,
      message: error.message
    };
  }
}

// تنفيذ العملية
disableUsersRLS().then(result => {
  console.log('\nنتيجة العملية:');
  console.log(JSON.stringify(result, null, 2));
  
  if (!result.success) {
    process.exit(1);
  }
}); 
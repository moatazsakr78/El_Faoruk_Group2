// إصلاح مشكلة سياسات RLS لجدول المنتجات
const { createClient } = require('@supabase/supabase-js');

// إعداد اتصال Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

// إنشاء عميل Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// بيانات اختبار للمستخدم
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Password123!';

/**
 * تسجيل الدخول بالبريد الإلكتروني وإنشاء مستخدم جديد إذا لم يكن موجوداً
 */
async function loginOrCreateUser(email, password) {
  try {
    // محاولة تسجيل الدخول
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (signInError) {
      // إذا كان هناك خطأ في تسجيل الدخول، قم بإنشاء مستخدم جديد
      console.log('فشل تسجيل الدخول، محاولة إنشاء مستخدم جديد...');
      
      const { data: { user: newUser }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: email.split('@')[0]
          }
        }
      });
      
      if (signUpError) {
        throw new Error(`فشل إنشاء مستخدم جديد: ${signUpError.message}`);
      }
      
      return {
        success: true,
        user: newUser,
        message: 'تم إنشاء مستخدم جديد وتسجيل الدخول بنجاح'
      };
    }
    
    return {
      success: true,
      user,
      message: 'تم تسجيل الدخول بنجاح'
    };
  } catch (error) {
    console.error('خطأ في تسجيل الدخول أو إنشاء مستخدم:', error);
    
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

/**
 * تصحيح سياسات RLS لجدول المنتجات
 */
async function fixProductsRLSPolicies() {
  try {
    console.log('=================================================');
    console.log('إصلاح سياسات RLS لجدول المنتجات');
    console.log('=================================================');
    
    // 1. تسجيل الدخول كمستخدم له صلاحيات
    console.log('\n1. تسجيل الدخول...');
    const loginResult = await loginOrCreateUser(TEST_EMAIL, TEST_PASSWORD);
    
    if (!loginResult.success) {
      console.error('فشل تسجيل الدخول:', loginResult.message);
      return { success: false, message: `فشل تسجيل الدخول: ${loginResult.message}` };
    }
    
    console.log('تم تسجيل الدخول بنجاح:', loginResult.message);
    
    // 2. إلغاء تفعيل RLS على جدول المنتجات (سنُعيد تفعيلها لاحقاً مع السياسات الصحيحة)
    console.log('\n2. التأكد من إلغاء تفعيل RLS على جدول المنتجات...');
    
    const sqlDisableRLS = `
      -- إلغاء تفعيل RLS على جدول المنتجات
      ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
    `;
    
    const { error: disableRLSError } = await supabase.rpc('exec_sql', { sql_query: sqlDisableRLS });
    
    if (disableRLSError) {
      console.warn('تحذير عند محاولة إلغاء RLS:', disableRLSError);
      // لا نريد إيقاف العملية إذا فشلت هذه الخطوة
    } else {
      console.log('تم إلغاء تفعيل RLS على جدول المنتجات بنجاح');
    }
    
    // 3. حذف السياسات الموجودة
    console.log('\n3. حذف سياسات جدول المنتجات الموجودة...');
    
    const dropPolicies = `
      -- حذف سياسات جدول المنتجات الموجودة
      DROP POLICY IF EXISTS "السماح للمستخدمين المجهولين بقراءة المنتجات" ON public.products;
      DROP POLICY IF EXISTS "السماح للمشرفين بقراءة المنتجات" ON public.products;
      DROP POLICY IF EXISTS "السماح للمشرفين بإدراج المنتجات" ON public.products;
      DROP POLICY IF EXISTS "السماح للمشرفين بتحديث المنتجات" ON public.products;
      DROP POLICY IF EXISTS "السماح للمشرفين بحذف المنتجات" ON public.products;
    `;
    
    await supabase.rpc('exec_sql', { sql_query: dropPolicies }).catch(e => {
      console.warn('تحذير عند حذف سياسات جدول المنتجات:', e.message);
    });
    
    // 4. اختبار إدراج منتج بدون RLS
    console.log('\n4. اختبار إدراج منتج بدون RLS...');
    
    const testProduct = {
      id: `test-product-${Date.now()}`,
      name: 'منتج اختبار RLS',
      product_code: `TEST-${Date.now().toString().slice(-6)}`,
      box_quantity: 10,
      piece_price: 15,
      is_new: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: insertedProduct, error: insertError } = await supabase
      .from('products')
      .insert(testProduct)
      .select();
    
    if (insertError) {
      console.error('خطأ في إدراج منتج الاختبار بدون RLS:', insertError);
    } else {
      console.log('تم إدراج منتج الاختبار بنجاح بدون RLS');
    }
    
    // 5. إعادة تفعيل RLS مع إضافة السياسات المناسبة
    console.log('\n5. إعادة تفعيل RLS مع إضافة السياسات المناسبة...');
    
    const setupRLSWithPolicies = `
      -- تفعيل RLS على جدول المنتجات
      ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
      
      -- إضافة سياسات القراءة للجميع
      CREATE POLICY "السماح للجميع بقراءة المنتجات"
      ON public.products
      FOR SELECT
      TO public
      USING (true);
      
      -- إضافة سياسات للمستخدمين المسجلين للتحكم الكامل
      CREATE POLICY "السماح للمستخدمين المسجلين بإدراج المنتجات"
      ON public.products
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
      
      CREATE POLICY "السماح للمستخدمين المسجلين بتحديث المنتجات"
      ON public.products
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
      
      CREATE POLICY "السماح للمستخدمين المسجلين بحذف المنتجات"
      ON public.products
      FOR DELETE
      TO authenticated
      USING (true);
      
      -- منح صلاحيات للمستخدمين المسجلين وغير المسجلين
      GRANT SELECT ON public.products TO anon, authenticated;
      GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
    `;
    
    const { error: setupRLSError } = await supabase.rpc('exec_sql', { sql_query: setupRLSWithPolicies });
    
    if (setupRLSError) {
      console.error('خطأ في إعداد سياسات RLS:', setupRLSError);
      return { success: false, message: `خطأ في إعداد سياسات RLS: ${setupRLSError.message}` };
    }
    
    console.log('تم إعداد سياسات RLS بنجاح');
    
    // 6. اختبار إدراج منتج مع RLS
    console.log('\n6. اختبار إدراج منتج مع RLS...');
    
    const testProductWithRLS = {
      id: `test-product-rls-${Date.now()}`,
      name: 'منتج اختبار مع RLS',
      product_code: `TEST-RLS-${Date.now().toString().slice(-6)}`,
      box_quantity: 5,
      piece_price: 25,
      is_new: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: insertedWithRLS, error: insertWithRLSError } = await supabase
      .from('products')
      .insert(testProductWithRLS)
      .select();
    
    if (insertWithRLSError) {
      console.error('خطأ في إدراج منتج الاختبار مع RLS:', insertWithRLSError);
      return { success: false, message: `فشل اختبار الإدراج مع RLS: ${insertWithRLSError.message}` };
    }
    
    console.log('تم إدراج منتج الاختبار بنجاح مع RLS');
    
    // 7. حفظ السياسات في ملف SQL
    console.log('\n7. استخراج قائمة السياسات الحالية...');
    
    const listPoliciesQuery = `
      SELECT
        policyname AS policy_name,
        permissive,
        roles,
        cmd,
        format('ON %I.%I', schemaname, tablename) AS on_table,
        format('USING (%s)', qual) AS using_expression,
        format('WITH CHECK (%s)', with_check) AS with_check_expression
      FROM
        pg_policies
      WHERE
        schemaname = 'public'
        AND tablename = 'products';
    `;
    
    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', { 
      sql_query: listPoliciesQuery
    });
    
    if (policiesError) {
      console.warn('تحذير: لم نتمكن من استرجاع قائمة السياسات:', policiesError);
    } else {
      console.log('تم استرجاع قائمة السياسات بنجاح:', policies);
    }
    
    console.log('\n=================================================');
    console.log('تم إصلاح سياسات RLS لجدول المنتجات بنجاح');
    console.log('=================================================');
    
    return {
      success: true,
      message: 'تم إصلاح سياسات RLS لجدول المنتجات بنجاح'
    };
  } catch (error) {
    console.error('خطأ غير متوقع:', error);
    
    return {
      success: false,
      message: `خطأ غير متوقع: ${error.message}`,
      error
    };
  }
}

// تنفيذ عملية الإصلاح
fixProductsRLSPolicies().then(result => {
  console.log('\nنتيجة إصلاح سياسات RLS:', result.success ? 'نجاح' : 'فشل');
  if (!result.success) {
    console.error('رسالة الخطأ:', result.message);
  }
}); 
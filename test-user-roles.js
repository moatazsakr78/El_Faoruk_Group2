// أداة اختبار الصلاحيات
const { createClient } = require('@supabase/supabase-js');

// استخدام متغيرات البيئة أو القيم الافتراضية
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

// إنشاء عميل Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// اختبار وظيفة get_current_user
async function testGetCurrentUser() {
  console.log('اختبار وظيفة get_current_user...');
  
  try {
    // تسجيل الدخول أولاً (يجب تغيير البريد الإلكتروني وكلمة المرور)
    const email = 'your-email@example.com'; // قم بتغيير هذا
    const password = 'your-password'; // قم بتغيير هذا
    
    console.log(`محاولة تسجيل الدخول باستخدام: ${email}`);
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (authError) {
      console.error('خطأ في تسجيل الدخول:', authError);
      return;
    }
    
    console.log('تم تسجيل الدخول بنجاح');
    
    // اختبار وظيفة get_current_user
    const { data: userData, error: userError } = await supabase.rpc('get_current_user');
    
    if (userError) {
      console.error('خطأ في الحصول على معلومات المستخدم:', userError);
      return;
    }
    
    console.log('معلومات المستخدم:', userData);
    console.log('الدور:', userData.role);
    console.log('هل هو مشرف؟', userData.is_admin);
    
    // الحصول على معلومات المستخدم مباشرة من جدول users
    const { data: directUserData, error: directUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();
    
    if (directUserError) {
      console.error('خطأ في الحصول على معلومات المستخدم مباشرة من جدول users:', directUserError);
      return;
    }
    
    console.log('معلومات المستخدم من جدول users:', directUserData);
    console.log('الدور من جدول users:', directUserData.role);
    console.log('هل هو مشرف من جدول users؟', directUserData.is_admin);
    
    // تسجيل الخروج
    await supabase.auth.signOut();
    console.log('تم تسجيل الخروج');
  } catch (error) {
    console.error('خطأ غير متوقع:', error);
  }
}

// تنفيذ الاختبار
testGetCurrentUser()
  .then(() => {
    console.log('تم الانتهاء من الاختبار');
    process.exit(0);
  })
  .catch(error => {
    console.error('خطأ غير متوقع أثناء تنفيذ الاختبار:', error);
    process.exit(1);
  }); 
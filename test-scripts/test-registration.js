// اختبار وظيفة التسجيل
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// إعدادات Supabase
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
 * التحقق من وجود جدول المستخدمين وإنشاؤه إذا لم يكن موجودًا
 */
async function ensureUsersTableExists() {
  try {
    logWithTimestamp('التحقق من وجود جدول المستخدمين...');
    
    // محاولة استعلام بسيط للتحقق من وجود الجدول
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    // إذا لم يكن هناك خطأ، فالجدول موجود
    if (!error) {
      logWithTimestamp('جدول المستخدمين موجود بالفعل');
      return true;
    }
    
    // إذا كان الخطأ بسبب عدم وجود الجدول، نحاول إنشاءه
    if (error.message.includes('does not exist')) {
      logWithTimestamp('جدول المستخدمين غير موجود، جاري محاولة إنشاءه...');
      
      // محاولة إنشاء الجدول
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS public.users (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            username TEXT UNIQUE,
            phone TEXT,
            address TEXT,
            governorate TEXT,
            avatar_url TEXT,
            is_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      
      if (createError) {
        logWithTimestamp(`خطأ في إنشاء جدول المستخدمين: ${createError.message}`);
        return false;
      }
      
      logWithTimestamp('تم إنشاء جدول المستخدمين بنجاح');
      return true;
    }
    
    logWithTimestamp(`خطأ في التحقق من جدول المستخدمين: ${error.message}`);
    return false;
  } catch (error) {
    logWithTimestamp(`استثناء أثناء التحقق من جدول المستخدمين: ${error.message}`);
    return false;
  }
}

/**
 * تسجيل مستخدم جديد
 */
async function testSignUp(email, password, username) {
  try {
    logWithTimestamp(`محاولة تسجيل مستخدم جديد: ${email}, ${username}`);
    
    // التحقق من وجود اسم المستخدم أولاً
    const { data: existingUsers, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .limit(1);
    
    if (userError && !userError.message.includes('does not exist')) {
      logWithTimestamp(`خطأ في التحقق من وجود اسم المستخدم: ${userError.message}`);
      return {
        success: false,
        message: `خطأ في التحقق من وجود اسم المستخدم: ${userError.message}`
      };
    }
    
    if (existingUsers && existingUsers.length > 0) {
      logWithTimestamp('اسم المستخدم موجود بالفعل');
      return {
        success: false,
        message: 'اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر'
      };
    }
    
    // تسجيل المستخدم باستخدام Supabase Auth API
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        }
      }
    });
    
    if (error) {
      logWithTimestamp(`خطأ في تسجيل المستخدم: ${error.message}`);
      return {
        success: false,
        message: error.message
      };
    }
    
    // التحقق من أن المستخدم تم إنشاؤه بنجاح
    if (!data?.user?.id) {
      logWithTimestamp('لم يتم إرجاع معرف المستخدم');
      return {
        success: false,
        message: 'فشل إنشاء المستخدم: لم يتم إرجاع معرف المستخدم'
      };
    }
    
    logWithTimestamp(`تم إنشاء المستخدم بنجاح مع المعرف: ${data.user.id}`);
    
    // إعطاء وقت للـ trigger ليعمل
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // التحقق من إنشاء سجل المستخدم في جدول users
    const { data: userRecord, error: userRecordError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    if (userRecordError && !userRecordError.message.includes('does not exist')) {
      logWithTimestamp(`خطأ في التحقق من سجل المستخدم: ${userRecordError.message}`);
    }
    
    if (!userRecord) {
      logWithTimestamp('سجل المستخدم لم يتم إنشاؤه تلقائيًا، جاري إنشاؤه يدويًا...');
      
      // إنشاء سجل المستخدم يدويًا
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: email,
          username: username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_admin: false
        });
      
      if (insertError && !insertError.message.includes('does not exist')) {
        logWithTimestamp(`خطأ في إنشاء سجل المستخدم يدويًا: ${insertError.message}`);
      } else {
        logWithTimestamp('تم إنشاء سجل المستخدم يدويًا بنجاح');
      }
    } else {
      logWithTimestamp('تم إنشاء سجل المستخدم تلقائيًا بنجاح');
    }
    
    return {
      success: true,
      message: 'تم تسجيل المستخدم بنجاح',
      user: data.user
    };
  } catch (err) {
    logWithTimestamp(`استثناء غير متوقع: ${err.message}`);
    return {
      success: false,
      message: `حدث خطأ غير متوقع: ${err.message}`
    };
  }
}

/**
 * تنفيذ الاختبار
 */
async function runTest() {
  try {
    logWithTimestamp('=== بدء اختبار التسجيل ===');
    
    // التأكد من وجود جدول المستخدمين
    await ensureUsersTableExists();
    
    // إنشاء بيانات مستخدم عشوائية للاختبار
    const testEmail = `test${Date.now()}@example.com`;
    const testUsername = `user${Date.now()}`;
    const testPassword = 'Password123!';
    
    // تنفيذ اختبار التسجيل
    const result = await testSignUp(testEmail, testPassword, testUsername);
    
    logWithTimestamp(`نتيجة الاختبار: ${result.success ? 'نجاح' : 'فشل'}`);
    logWithTimestamp(`الرسالة: ${result.message}`);
    
    if (result.success && result.user) {
      logWithTimestamp(`معرف المستخدم: ${result.user.id}`);
      logWithTimestamp(`البريد الإلكتروني: ${result.user.email}`);
    }
    
    logWithTimestamp('=== انتهى اختبار التسجيل ===');
    
    return result;
  } catch (error) {
    logWithTimestamp(`خطأ غير متوقع أثناء الاختبار: ${error.message}`);
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
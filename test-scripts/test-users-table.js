// اختبار جدول المستخدمين
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
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    // إذا لم يكن هناك خطأ، فالجدول موجود
    if (!error) {
      logWithTimestamp('جدول المستخدمين موجود بالفعل');
      logWithTimestamp(`عدد السجلات المسترجعة: ${data?.length || 0}`);
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
 * اختبار الاتصال بقاعدة البيانات
 */
async function testDatabaseConnection() {
  try {
    logWithTimestamp('اختبار الاتصال بقاعدة البيانات...');
    
    // محاولة استعلام بسيط
    const { error } = await supabase
      .from('products')
      .select('id')
      .limit(1);
    
    if (error) {
      logWithTimestamp(`فشل الاتصال بقاعدة البيانات: ${error.message}`);
      return false;
    }
    
    logWithTimestamp('تم الاتصال بقاعدة البيانات بنجاح');
    return true;
  } catch (error) {
    logWithTimestamp(`استثناء أثناء اختبار الاتصال: ${error.message}`);
    return false;
  }
}

/**
 * تنفيذ الاختبار
 */
async function runTest() {
  try {
    logWithTimestamp('=== بدء اختبار جدول المستخدمين ===');
    
    // اختبار الاتصال بقاعدة البيانات
    const connectionSuccess = await testDatabaseConnection();
    
    if (!connectionSuccess) {
      logWithTimestamp('فشل الاتصال بقاعدة البيانات. توقف الاختبار.');
      return {
        success: false,
        message: 'فشل الاتصال بقاعدة البيانات'
      };
    }
    
    // التأكد من وجود جدول المستخدمين
    const tableExists = await ensureUsersTableExists();
    
    logWithTimestamp(`نتيجة اختبار جدول المستخدمين: ${tableExists ? 'نجاح' : 'فشل'}`);
    
    logWithTimestamp('=== انتهى اختبار جدول المستخدمين ===');
    
    return {
      success: tableExists,
      message: tableExists ? 'جدول المستخدمين موجود أو تم إنشاؤه بنجاح' : 'فشل في التحقق من أو إنشاء جدول المستخدمين'
    };
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
  logWithTimestamp(`النتيجة النهائية: ${result.success ? 'نجاح' : 'فشل'}`);
  logWithTimestamp(`الرسالة: ${result.message}`);
  
  if (!result.success) {
    process.exit(1);
  }
}); 
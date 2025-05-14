// أداة مساعدة لتطبيق هجرة إصلاح أدوار المستخدمين
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// استخدام متغيرات البيئة أو القيم الافتراضية
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

// إنشاء عميل Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// تطبيق هجرة إصلاح أدوار المستخدمين
async function applyRoleMigration() {
  try {
    console.log('تطبيق هجرة إصلاح أدوار المستخدمين...');
    
    // قراءة ملف الهجرة
    const migrationPath = path.join(__dirname, '..', 'migrations', '20240517_fix_user_roles.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // تطبيق الهجرة باستخدام وظيفة exec_sql
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });
    
    if (error) {
      console.error('خطأ في تطبيق هجرة إصلاح أدوار المستخدمين:', error);
      return false;
    }
    
    console.log('تم تطبيق هجرة إصلاح أدوار المستخدمين بنجاح!');
    return true;
  } catch (error) {
    console.error('خطأ غير متوقع أثناء تطبيق هجرة إصلاح أدوار المستخدمين:', error);
    return false;
  }
}

// تنفيذ الهجرة
applyRoleMigration()
  .then(success => {
    if (success) {
      console.log('تم الانتهاء من تطبيق الهجرة بنجاح.');
      process.exit(0);
    } else {
      console.error('فشل في تطبيق الهجرة.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('خطأ غير متوقع:', error);
    process.exit(1);
  }); 
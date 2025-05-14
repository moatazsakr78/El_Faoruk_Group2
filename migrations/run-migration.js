// نص لتنفيذ هجرة إضافة عمود role إلى جدول المستخدمين
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
 * تنفيذ هجرة إضافة حقل role إلى جدول المستخدمين
 */
async function runAddRoleMigration() {
  try {
    // قراءة ملف الهجرة
    logWithTimestamp('قراءة ملف الهجرة...');
    const migrationPath = path.join(__dirname, '20240514_add_role_to_users.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // تنفيذ استعلام SQL
    logWithTimestamp('تنفيذ الهجرة على قاعدة البيانات...');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      logWithTimestamp(`خطأ في تنفيذ الهجرة: ${error.message}`);
      // محاولة طريقة بديلة باستخدام REST API
      logWithTimestamp('محاولة تنفيذ الهجرة باستخدام الطريقة البديلة...');
      
      // تقسيم SQL إلى عبارات فردية
      const statements = sql
        .replace(/(\r\n|\n|\r)/gm, ' ') // Normalize line endings
        .replace(/--.*$/gm, '') // Remove SQL comments
        .split(';')
        .filter(statement => statement.trim() !== '');
      
      // تنفيذ كل عبارة
      for (const statement of statements) {
        logWithTimestamp(`تنفيذ: ${statement.substring(0, 50)}...`);
        
        try {
          const { error: stmtError } = await supabase
            .from('_migrations_helper')
            .insert({ sql: statement })
            .select();
            
          if (stmtError) {
            logWithTimestamp(`خطأ في تنفيذ العبارة: ${stmtError.message}`);
          }
        } catch (stmtEx) {
          logWithTimestamp(`استثناء في تنفيذ العبارة: ${stmtEx.message}`);
        }
      }
    } else {
      logWithTimestamp('تم تنفيذ الهجرة بنجاح!');
    }
    
    // التحقق من وجود حقل role في جدول المستخدمين
    logWithTimestamp('التحقق من وجود حقل role في جدول المستخدمين...');
    const { data, error: checkError } = await supabase
      .from('users')
      .select('role')
      .limit(1);
    
    if (checkError) {
      logWithTimestamp(`خطأ في التحقق من حقل role: ${checkError.message}`);
    } else {
      logWithTimestamp('تم التحقق بنجاح! حقل role موجود في جدول المستخدمين.');
    }
  } catch (error) {
    logWithTimestamp(`خطأ غير متوقع: ${error.message}`);
  }
}

// تنفيذ الهجرة
logWithTimestamp('=== بدء تنفيذ هجرة إضافة حقل role ===');
runAddRoleMigration().then(() => {
  logWithTimestamp('=== انتهى تنفيذ الهجرة ===');
}); 
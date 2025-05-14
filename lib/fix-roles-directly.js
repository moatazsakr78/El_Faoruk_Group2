// أداة للتحقق من الصلاحيات وتحديثها مباشرة في قاعدة البيانات
const { createClient } = require('@supabase/supabase-js');

// استخدام متغيرات البيئة أو القيم الافتراضية
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

// إنشاء عميل Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// التحقق من وجود عمود role وإضافته إذا لم يكن موجوداً
async function ensureRoleColumn() {
  console.log('التحقق من وجود عمود role في جدول المستخدمين...');
  
  try {
    // التحقق من وجود عمود role
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: `
        DO $$
        BEGIN
          -- التحقق من وجود عمود role
          IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'role'
          ) THEN
            -- إضافة عمود role
            ALTER TABLE public.users 
            ADD COLUMN role VARCHAR(50) DEFAULT 'customer' NOT NULL;
            
            RAISE NOTICE 'تم إضافة عمود role بنجاح';
          ELSE
            RAISE NOTICE 'عمود role موجود بالفعل';
          END IF;
        END $$;
      `
    });
    
    if (error) {
      console.error('خطأ في التحقق من عمود role:', error);
      return false;
    }
    
    console.log('تم التحقق من عمود role بنجاح');
    return true;
  } catch (error) {
    console.error('خطأ غير متوقع في التحقق من عمود role:', error);
    return false;
  }
}

// تحديث وظيفة get_current_user
async function updateGetCurrentUserFunction() {
  console.log('تحديث وظيفة get_current_user...');
  
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: `
        -- إعادة إنشاء وظيفة get_current_user
        CREATE OR REPLACE FUNCTION get_current_user()
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
          current_user_id UUID;
          user_data JSONB;
        BEGIN
          -- الحصول على معرف المستخدم الحالي
          current_user_id := auth.uid();
          
          IF current_user_id IS NULL THEN
            RETURN NULL;
          END IF;
          
          -- الحصول على بيانات المستخدم
          SELECT json_build_object(
            'id', u.id,
            'email', u.email,
            'username', u.username,
            'phone', u.phone,
            'address', u.address,
            'governorate', u.governorate,
            'avatar_url', u.avatar_url,
            'is_admin', u.is_admin,
            'role', COALESCE(u.role, 'customer'),
            'created_at', u.created_at,
            'updated_at', u.updated_at
          ) INTO user_data
          FROM users u
          WHERE u.id = current_user_id;
          
          RETURN user_data;
        END;
        $$;
      `
    });
    
    if (error) {
      console.error('خطأ في تحديث وظيفة get_current_user:', error);
      return false;
    }
    
    console.log('تم تحديث وظيفة get_current_user بنجاح');
    return true;
  } catch (error) {
    console.error('خطأ غير متوقع في تحديث وظيفة get_current_user:', error);
    return false;
  }
}

// تحديث أدوار المستخدمين
async function updateUserRoles() {
  console.log('تحديث أدوار المستخدمين...');
  
  try {
    // تحديث أدوار المستخدمين
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: `
        -- تحديث الأدوار للتأكد من أن المشرفين لديهم دور admin
        UPDATE public.users 
        SET role = 'admin' 
        WHERE is_admin = true AND (role IS NULL OR role = 'customer');
        
        -- التأكد من أن جميع المستخدمين لديهم قيمة role
        UPDATE public.users 
        SET role = 'customer' 
        WHERE role IS NULL;
      `
    });
    
    if (error) {
      console.error('خطأ في تحديث أدوار المستخدمين:', error);
      return false;
    }
    
    console.log('تم تحديث أدوار المستخدمين بنجاح');
    return true;
  } catch (error) {
    console.error('خطأ غير متوقع في تحديث أدوار المستخدمين:', error);
    return false;
  }
}

// عرض جميع المستخدمين وأدوارهم
async function listUsers() {
  console.log('جلب قائمة المستخدمين وأدوارهم...');
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, username, is_admin, role')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('خطأ في جلب قائمة المستخدمين:', error);
      return;
    }
    
    console.log('قائمة المستخدمين:');
    console.table(data);
    
    // إحصاء الأدوار
    const roleCounts = data.reduce((counts, user) => {
      const role = user.role || 'undefined';
      counts[role] = (counts[role] || 0) + 1;
      return counts;
    }, {});
    
    console.log('إحصاء الأدوار:');
    console.table(roleCounts);
  } catch (error) {
    console.error('خطأ غير متوقع في جلب قائمة المستخدمين:', error);
  }
}

// تنفيذ الإصلاحات
async function applyFixes() {
  try {
    console.log('بدء تنفيذ الإصلاحات...');
    
    // التحقق من عمود role
    const roleColumnResult = await ensureRoleColumn();
    if (!roleColumnResult) {
      console.error('فشل في التحقق من عمود role');
    }
    
    // تحديث وظيفة get_current_user
    const functionResult = await updateGetCurrentUserFunction();
    if (!functionResult) {
      console.error('فشل في تحديث وظيفة get_current_user');
    }
    
    // تحديث أدوار المستخدمين
    const rolesResult = await updateUserRoles();
    if (!rolesResult) {
      console.error('فشل في تحديث أدوار المستخدمين');
    }
    
    // عرض قائمة المستخدمين وأدوارهم
    await listUsers();
    
    console.log('انتهى تنفيذ الإصلاحات');
    return roleColumnResult && functionResult && rolesResult;
  } catch (error) {
    console.error('خطأ غير متوقع أثناء تنفيذ الإصلاحات:', error);
    return false;
  }
}

// تنفيذ الإصلاحات
applyFixes()
  .then(success => {
    if (success) {
      console.log('تم تنفيذ الإصلاحات بنجاح');
      process.exit(0);
    } else {
      console.error('فشل في تنفيذ بعض الإصلاحات');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('خطأ غير متوقع:', error);
    process.exit(1);
  }); 
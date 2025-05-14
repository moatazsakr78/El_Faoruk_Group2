import { supabase } from './supabase';

/**
 * التحقق من وجود عمود role في جدول المستخدمين وإضافته إذا لم يكن موجوداً
 */
export async function ensureRoleColumnExists(): Promise<boolean> {
  try {
    console.log('التحقق من وجود عمود role في جدول المستخدمين...');
    
    // التحقق من وجود الجدول أولاً
    const { error: tableError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.error('خطأ في التحقق من جدول المستخدمين:', tableError);
      return false;
    }
    
    // محاولة الوصول إلى عمود role للتحقق من وجوده
    const { error: columnError } = await supabase
      .from('users')
      .select('role')
      .limit(1);
    
    // إذا لم يكن هناك خطأ، فالعمود موجود
    if (!columnError) {
      console.log('عمود role موجود بالفعل في جدول المستخدمين');
      return true;
    }
    
    // إذا كان هناك خطأ يشير إلى أن العمود غير موجود، نقوم بإضافته
    if (columnError.message.includes('column "role" does not exist') || 
        columnError.message.includes('role') && columnError.message.includes('does not exist')) {
      console.log('عمود role غير موجود، جاري إضافته...');
      
      // إضافة العمود باستخدام SQL مباشر
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql_query: `
          ALTER TABLE public.users 
          ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer' NOT NULL;
          
          -- تحديث الأدوار الافتراضية
          UPDATE public.users 
          SET role = 'admin' 
          WHERE is_admin = true AND role = 'customer';
        `
      });
      
      if (alterError) {
        console.error('خطأ في إضافة عمود role:', alterError);
        return false;
      }
      
      console.log('تم إضافة عمود role بنجاح!');
      return true;
    }
    
    console.error('خطأ غير متوقع في التحقق من عمود role:', columnError);
    return false;
  } catch (error) {
    console.error('استثناء أثناء التحقق من عمود role:', error);
    return false;
  }
}

/**
 * التحقق من أن وظيفة get_current_user ترجع حقل role وتحديثها إذا لم تكن كذلك
 */
export async function ensureUserRoleInGetCurrentUser(): Promise<boolean> {
  try {
    console.log('التحقق من وظيفة get_current_user...');
    
    // تطبيق التحديث على وظيفة get_current_user
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: `
        -- تحديث وظيفة get_current_user لإضافة حقل role
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
    
    console.log('تم تحديث وظيفة get_current_user بنجاح!');
    return true;
  } catch (error) {
    console.error('استثناء أثناء تحديث وظيفة get_current_user:', error);
    return false;
  }
}

/**
 * تهيئة قاعدة البيانات وضمان وجود البنية المطلوبة
 */
export async function setupDatabase(): Promise<boolean> {
  try {
    // التحقق من عمود role وإضافته إذا لم يكن موجوداً
    const roleColumnExists = await ensureRoleColumnExists();
    
    // التحقق من وظيفة get_current_user وتحديثها لتشمل حقل role
    const userRoleInGetCurrentUser = await ensureUserRoleInGetCurrentUser();
    
    return roleColumnExists && userRoleInGetCurrentUser;
  } catch (error) {
    console.error('خطأ في تهيئة قاعدة البيانات:', error);
    return false;
  }
} 
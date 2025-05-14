-- إصلاح أدوار المستخدمين وضمان عرض الأسعار بشكل صحيح
-- هذه الهجرة تقوم بتحديث وظيفة get_current_user وضمان أن جميع المستخدمين لديهم قيمة role صحيحة

-- التحقق من وجود حقل role وإضافته إذا لم يكن موجوداً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'role'
  ) THEN
    -- إضافة حقل role إذا لم يكن موجوداً
    ALTER TABLE public.users 
    ADD COLUMN role VARCHAR(50) DEFAULT 'customer' NOT NULL;
  END IF;
END $$;

-- تحديث الأدوار للتأكد من أن المشرفين لديهم دور admin
UPDATE public.users 
SET role = 'admin' 
WHERE is_admin = true AND (role IS NULL OR role = 'customer');

-- التأكد من أن جميع المستخدمين لديهم قيمة role
UPDATE public.users 
SET role = 'customer' 
WHERE role IS NULL;

-- إصلاح وظيفة get_current_user للتأكد من أنها تعيد حقل role بشكل صحيح
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

-- إنشاء وظيفة لتحديث دور المستخدم
CREATE OR REPLACE FUNCTION update_user_role(
  p_user_id UUID,
  p_role VARCHAR(50)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  is_current_admin BOOLEAN;
BEGIN
  -- الحصول على معرف المستخدم الحالي
  current_user_id := auth.uid();
  
  -- التحقق من أن المستخدم الحالي هو مشرف
  SELECT is_admin INTO is_current_admin
  FROM users
  WHERE id = current_user_id;
  
  -- فقط المشرفون يمكنهم تحديث الأدوار
  IF NOT is_current_admin THEN
    RETURN FALSE;
  END IF;
  
  -- تحديث دور المستخدم
  UPDATE users
  SET 
    role = p_role,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- منح صلاحيات للوصول إلى الوظيفة
GRANT EXECUTE ON FUNCTION update_user_role(UUID, VARCHAR) TO authenticated; 
-- نظام المصادقة ووظائف المستخدم
-- إنشاء دوال SQL لدعم نظام المصادقة

-- التحقق من وجود اسم المستخدم
CREATE OR REPLACE FUNCTION check_username_exists(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE username = p_username
  );
END;
$$;

-- الحصول على معلومات المستخدم الحالي
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

-- تحديث معلومات المستخدم
CREATE OR REPLACE FUNCTION update_user_profile(
  p_username TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL, 
  p_governorate TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- الحصول على معرف المستخدم الحالي
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- تحديث البيانات
  UPDATE users
  SET 
    username = COALESCE(p_username, username),
    phone = COALESCE(p_phone, phone),
    address = COALESCE(p_address, address),
    governorate = COALESCE(p_governorate, governorate),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = NOW()
  WHERE id = current_user_id;
  
  RETURN TRUE;
END;
$$;

-- التحقق مما إذا كان المستخدم مسؤولاً
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  admin_status BOOLEAN;
BEGIN
  -- الحصول على معرف المستخدم الحالي
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- التحقق من حالة المشرف
  SELECT is_admin INTO admin_status
  FROM users
  WHERE id = current_user_id;
  
  RETURN COALESCE(admin_status, FALSE);
END;
$$; 
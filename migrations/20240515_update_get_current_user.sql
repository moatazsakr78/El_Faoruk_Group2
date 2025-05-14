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
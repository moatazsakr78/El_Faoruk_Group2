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
  
  -- التحقق من وجود حقل role في جدول users
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'role'
  ) THEN
    -- إضافة حقل role إذا لم يكن موجوداً
    ALTER TABLE public.users 
    ADD COLUMN role VARCHAR(50) DEFAULT 'customer' NOT NULL;
    
    -- تحديث الأدوار الافتراضية
    UPDATE public.users 
    SET role = 'admin' 
    WHERE is_admin = true AND role = 'customer';
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
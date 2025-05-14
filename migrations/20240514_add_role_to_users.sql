-- إضافة عمود الصلاحيات إلى جدول المستخدمين
DO $$
BEGIN
    -- التحقق مما إذا كان عمود 'role' موجوداً بالفعل
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        -- إضافة العمود إذا لم يكن موجوداً
        ALTER TABLE public.users 
        ADD COLUMN role VARCHAR(50) DEFAULT 'customer' NOT NULL;
        
        -- إضافة تعليق توضيحي للعمود
        COMMENT ON COLUMN public.users.role IS 'دور المستخدم في النظام (customer, wholesale, preparation, full_details, admin)';
        
        RAISE NOTICE 'تم إضافة عمود role إلى جدول المستخدمين بنجاح';
    ELSE
        RAISE NOTICE 'عمود role موجود بالفعل في جدول المستخدمين';
    END IF;
    
    -- تحديث الأدوار الافتراضية
    -- المستخدمين المسؤولين (is_admin = true) سيتم تعيينهم كمشرفين (admin)
    UPDATE public.users 
    SET role = 'admin' 
    WHERE is_admin = true AND role = 'customer';
    
    RAISE NOTICE 'تم تحديث الأدوار للمستخدمين المسؤولين';
END
$$; 
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// مكون مؤقت لتطبيق هجرة إصلاح وظيفة get_current_user
export default function FixRolesMigration() {
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const applyMigration = async () => {
      try {
        console.log('تطبيق هجرة إصلاح وظيفة get_current_user...');

        // SQL لإصلاح وظيفة get_current_user
        const sql = `
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

          -- إضافة تحديث للتأكد من أن جميع المستخدمين لديهم قيمة role صحيحة
          DO $$
          BEGIN
            -- التحقق من وجود حقل role
            IF EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'users' 
              AND column_name = 'role'
            ) THEN
              -- تحديث الأدوار للتأكد من أن المشرفين لديهم دور admin
              UPDATE public.users 
              SET role = 'admin' 
              WHERE is_admin = true AND (role IS NULL OR role = 'customer');
              
              -- التأكد من أن جميع المستخدمين لديهم قيمة role
              UPDATE public.users 
              SET role = 'customer' 
              WHERE role IS NULL;
            END IF;
          END $$;
        `;

        // تطبيق الهجرة باستخدام وظيفة exec_sql
        const { error: migrationError } = await supabase.rpc('exec_sql', {
          sql_query: sql
        });

        if (migrationError) {
          console.error('خطأ في تطبيق هجرة إصلاح وظيفة get_current_user:', migrationError);
          setError(migrationError.message);
          return;
        }

        console.log('تم تطبيق هجرة إصلاح وظيفة get_current_user بنجاح!');
        setApplied(true);

        // إعادة تحميل الصفحة بعد تطبيق الهجرة
        window.location.reload();
      } catch (err) {
        console.error('خطأ غير متوقع أثناء تطبيق الهجرة:', err);
        setError(err instanceof Error ? err.message : 'خطأ غير معروف');
      }
    };

    // التحقق من أننا على جانب العميل (المتصفح)
    if (typeof window !== 'undefined') {
      // تطبيق الهجرة بعد تأخير قصير للتأكد من تحميل الصفحة
      const timer = setTimeout(() => {
        applyMigration();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // هذا المكون لا يعرض أي شيء، فهو فقط يقوم بتنفيذ الشيفرة
  return null;
} 
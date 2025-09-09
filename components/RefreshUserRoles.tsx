'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from './AuthProvider';

// مكون لتحديث صلاحيات المستخدم عند تحميل الصفحة
export default function RefreshUserRoles() {
  const { user, refreshProfile } = useAuth();
  const hasRefreshedRef = useRef<boolean>(false);

  useEffect(() => {
    // تحديث صلاحيات المستخدم مرة واحدة فقط عند تحميل الصفحة
    if (user && !hasRefreshedRef.current) {
      // تعيين العلامة لمنع التحديثات المتكررة
      hasRefreshedRef.current = true;
      
      // استخدام مؤقت للتأكد من عدم التداخل مع عمليات أخرى
      const timer = setTimeout(() => {
        refreshProfile();
      }, 1000);
      
      // تنظيف المؤقت عند إزالة المكون
      return () => clearTimeout(timer);
    }
  }, [user, refreshProfile]);

  // هذا المكون لا يعرض أي شيء، فهو فقط يقوم بتنفيذ الشيفرة
  return null;
} 
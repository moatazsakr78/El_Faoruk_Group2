'use client';

import { useEffect } from 'react';
import { useAuth } from './AuthProvider';

// مكون لتحديث صلاحيات المستخدم عند تحميل الصفحة
export default function RefreshUserRoles() {
  const { user, refreshProfile } = useAuth();

  useEffect(() => {
    // تحديث صلاحيات المستخدم عند تحميل الصفحة
    if (user) {
      console.log('تحديث صلاحيات المستخدم عند تحميل الصفحة...');
      refreshProfile();
    }
  }, [user, refreshProfile]);

  // هذا المكون لا يعرض أي شيء، فهو فقط يقوم بتنفيذ الشيفرة
  return null;
} 
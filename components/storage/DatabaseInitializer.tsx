'use client';

import { useEffect, useState } from 'react';
import { setupDatabase } from '@/lib/db-setup';

// هذا المكون مسؤول عن تهيئة قاعدة البيانات وتحديثها عند بدء تشغيل التطبيق
export default function DatabaseInitializer() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        // محاولة تهيئة قاعدة البيانات
        const success = await setupDatabase();
        setInitialized(success);
        
        if (success) {
          console.log('تم تهيئة قاعدة البيانات بنجاح');
        } else {
          console.error('فشل في تهيئة قاعدة البيانات');
        }
      } catch (error) {
        console.error('خطأ أثناء تهيئة قاعدة البيانات:', error);
        setInitialized(false);
      }
    };

    // التحقق من أننا على جانب العميل (المتصفح)
    if (typeof window !== 'undefined') {
      initializeDatabase();
    }
  }, []);

  // هذا المكون لا يعرض أي شيء، فهو فقط يقوم بتنفيذ الشيفرة
  return null;
} 
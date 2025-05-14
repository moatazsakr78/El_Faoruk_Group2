'use client';

import { useEffect, useState } from 'react';
import { loadData, saveData } from '@/lib/localStorage';
import { ensureRoleColumnExists } from '@/lib/db-setup';

/**
 * مكون لتهيئة وضمان استمرارية بيانات التخزين المحلي
 * يقوم هذا المكون بتحميل البيانات من التخزين الدائم واستعادتها عند بدء التطبيق
 */
export default function InitLocalStorage() {
  // استخدام حالة للتحقق من أن الكود يعمل في جانب العميل فقط
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // تعيين isClient إلى true بمجرد تحميل المكون في المتصفح
    setIsClient(true);
  }, []);

  useEffect(() => {
    // تشغيل الكود فقط بعد تأكيد أننا في جانب العميل
    if (!isClient) return;

    const initializeStorage = async () => {
      // ضمان تحميل البيانات من التخزين الدائم واستعادتها في localStorage العادي للتوافق
      await syncLocalStorage('products');
      await syncLocalStorage('categories');
      await syncLocalStorage('productSettings');
      
      // التحقق من وجود عمود role في جدول المستخدمين وإضافته إذا لزم الأمر
      try {
        await ensureRoleColumnExists();
      } catch (error) {
        console.error('خطأ أثناء التحقق من عمود role:', error);
      }
      
      console.log('Local storage initialization complete');
    };

    initializeStorage();
  }, [isClient]);

  /**
   * مزامنة بيانات التخزين المحلي من/إلى التخزين الدائم
   */
  async function syncLocalStorage(key: string) {
    try {
      // استرجاع البيانات من التخزين الدائم
      const data = await loadData(key);
      
      if (data) {
        // تخزين البيانات المسترجعة في localStorage
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (error) {
      console.error(`Error syncing localStorage for key ${key}:`, error);
    }
  }

  // هذا المكون لا يقوم بعرض أي شيء في واجهة المستخدم
  return null;
} 
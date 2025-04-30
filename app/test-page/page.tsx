'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TestPage() {
  const [isClient, setIsClient] = useState(false);
  const [storageStatus, setStorageStatus] = useState('جار التحقق...');
  
  useEffect(() => {
    setIsClient(true);
    
    // التحقق من localStorage
    try {
      localStorage.setItem('test', 'test-value');
      const value = localStorage.getItem('test');
      localStorage.removeItem('test');
      
      if (value === 'test-value') {
        setStorageStatus('localStorage يعمل بشكل صحيح');
      } else {
        setStorageStatus('localStorage لا يعمل بشكل صحيح');
      }
    } catch (error) {
      setStorageStatus(`خطأ في localStorage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">صفحة اختبار</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">حالة التطبيق</h2>
        <div className="space-y-2">
          <p><strong>حالة التنفيذ:</strong> {isClient ? 'جانب العميل (المتصفح)' : 'جانب الخادم (SSR)'}</p>
          <p><strong>حالة التخزين المحلي:</strong> <span className={storageStatus.includes('يعمل') ? 'text-green-600' : 'text-[#5D1F1F]'}>{storageStatus}</span></p>
        </div>
      </div>
      
      <div className="flex space-x-4 rtl:space-x-reverse">
        <Link href="/" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark">
          الرجوع للصفحة الرئيسية
        </Link>
        <Link href="/admin/products" className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800">
          الذهاب لإدارة المنتجات
        </Link>
      </div>
    </div>
  );
} 
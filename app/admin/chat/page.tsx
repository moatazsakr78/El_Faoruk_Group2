'use client';

import React, { useEffect } from 'react';
import AdminChatList from '@/components/chat/AdminChatList';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { FiArrowRight, FiSettings } from 'react-icons/fi';

export default function AdminChatPage() {
  const { user, isAdmin } = useAuth();

  // إخفاء الشريط الجانبي عند تحميل الصفحة
  useEffect(() => {
    // إخفاء الشريط الجانبي والعناصر الأخرى من layout الافتراضي مباشرة عند تحميل الصفحة
    const sidebarElements = document.querySelectorAll('.md\\:block.bg-white.shadow-md.w-full.md\\:w-64, .md\\:hidden.bg-white.shadow-md');
    sidebarElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = 'none';
      }
    });
    
    // تغيير نمط المحتوى الرئيسي
    const mainContent = document.querySelector('.flex-1.overflow-auto');
    if (mainContent instanceof HTMLElement) {
      mainContent.style.padding = '0';
      mainContent.style.overflow = 'hidden'; // إعادة تعيين overflow إلى hidden
    }
    
    // تعديل نمط الصفحة بالكامل
    document.body.style.overflow = 'hidden'; // إخفاء scrollbar الرئيسي
    
    // إخفاء شريط التنقل الرئيسي (Navbar)
    const navbar = document.querySelector('nav.bg-\\[\\#5D1F1F\\].shadow-md.sticky.top-0.z-50');
    if (navbar instanceof HTMLElement) {
      navbar.style.display = 'none';
    }
    
    return () => {
      // إعادة إظهار العناصر عند مغادرة الصفحة
      sidebarElements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.display = '';
        }
      });
      
      // إعادة نمط المحتوى الرئيسي
      if (mainContent instanceof HTMLElement) {
        mainContent.style.padding = '';
        mainContent.style.overflow = '';
      }
      
      // إعادة الـ scrollbar
      document.body.style.overflow = '';
      
      // إعادة إظهار شريط التنقل الرئيسي
      if (navbar instanceof HTMLElement) {
        navbar.style.display = '';
      }
    };
  }, []);

  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-800 mb-4">غير مصرح بالوصول</h1>
          <p className="mb-4">يجب أن تكون مشرفًا للوصول إلى هذه الصفحة</p>
          <Link 
            href="/" 
            className="bg-[#5D1F1F] text-white px-4 py-2 rounded-md inline-flex items-center"
          >
            <FiArrowRight className="ml-2" />
            العودة إلى الصفحة الرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full">
      {/* زر لوحة التحكم - تم نقله إلى الجانب الأيسر */}
      <div className="fixed top-4 left-4 z-[10000]">
        <a 
          href="/admin/products"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = '/admin/products';
          }}
          className="bg-[#5D1F1F] text-white px-4 py-2 rounded-full shadow-lg hover:bg-[#4a1919] transition-colors inline-flex items-center"
        >
          <FiSettings className="ml-2 text-white" size={20} />
          <span className="font-medium hidden sm:inline">لوحة التحكم</span>
        </a>
      </div>
      
      {/* مكون المحادثات */}
      <div className="h-full w-full">
        <AdminChatList isStandalonePage={true} />
      </div>
    </div>
  );
} 
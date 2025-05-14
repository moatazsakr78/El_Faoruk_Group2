'use client';

import React from 'react';
import AdminHeader from '@/components/admin/AdminHeader';

export default function PermissionsPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <AdminHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">إدارة صلاحيات المستخدمين</h1>
          
          <p className="text-center py-8">
            جاري العمل على هذه الصفحة...
          </p>
        </div>
      </main>
    </div>
  );
} 
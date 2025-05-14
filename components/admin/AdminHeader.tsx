'use client';

import React from 'react';
import Link from 'next/link';

const AdminHeader: React.FC = () => {
  return (
    <header className="bg-white shadow-md py-4 px-6">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold text-primary">لوحة التحكم</h1>
        <nav className="hidden md:block">
          <Link href="/admin/products" className="mx-3 text-gray-600 hover:text-primary">
            الرئيسية
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default AdminHeader; 
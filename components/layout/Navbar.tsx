'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FiMenu, FiX, FiHome, FiKey } from 'react-icons/fi';
import AdminLoginModal from '@/components/admin/AdminLoginModal';

const navigation = [
  { name: 'الرئيسية', href: '/', icon: FiHome },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="bg-[#55000F] shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-3">
              <Link href="/" className="relative w-56 h-16">
                <Image
                  src="/images/El Farouk10.png"
                  alt="El Farouk Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </Link>
              <div className="block">
                <span className="text-white text-lg md:text-xl font-semibold">El Farouk Group</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between flex-1 mr-10">
            <div className="flex space-x-8 rtl:space-x-reverse">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                      isActive
                        ? 'text-white border-b-2 border-white'
                        : 'text-gray-200 hover:text-white hover:border-b-2 hover:border-gray-200'
                    }`}
                  >
                    <item.icon className="ml-2" />
                    {item.name}
                  </Link>
                );
              })}
              <button 
                onClick={() => setIsAdminModalOpen(true)}
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-200 hover:text-white hover:border-b-2 hover:border-gray-200"
              >
                <FiKey className="ml-2" />
                El Farouk Group
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-200 hover:text-white hover:bg-[#44000C] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <FiX className="block h-6 w-6" /> : <FiMenu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden ${isOpen ? 'block' : 'hidden'}`}>
        <div className="px-2 pt-2 pb-3 space-y-1 bg-[#55000F] shadow-lg rounded-b-lg">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center ${
                  isActive
                    ? 'bg-[#44000C] text-white'
                    : 'text-gray-200 hover:text-white hover:bg-[#44000C]'
                }`}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className="ml-2" />
                {item.name}
              </Link>
            );
          })}
          <button
            onClick={() => {
              setIsAdminModalOpen(true);
              setIsOpen(false);
            }}
            className="block w-full text-right px-3 py-2 rounded-md text-base font-medium flex items-center text-gray-200 hover:text-white hover:bg-[#44000C]"
          >
            <FiKey className="ml-2" />
            El Farouk Group
          </button>
        </div>
      </div>

      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
    </nav>
  );
} 
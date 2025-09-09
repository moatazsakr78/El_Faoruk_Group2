import './globals.css';
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ClientInitProvider from '@/components/storage/ClientInitProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { CartProvider } from '@/components/CartProvider';
import UserChat from '@/components/chat/UserChat';
import { Toaster } from 'react-hot-toast';
import ScrollToTopButton from '@/components/layout/ScrollToTopButton';

export const metadata: Metadata = {
  title: 'El Farouk Group | كتالوج المنتجات',
  description: 'كتالوج شامل لجميع منتجاتنا المميزة بتصنيفات متعددة وتحديثات دورية',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#c5c5c5]">
        <div className="min-h-screen flex flex-col">
          <AuthProvider>
            <CartProvider>
              <ClientInitProvider />
              <Navbar />
              <main className="flex-grow">{children}</main>
              <UserChat />
              <Footer />
              <ScrollToTopButton />
              <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
            </CartProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
} 
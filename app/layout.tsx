import './globals.css';
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ClientInitProvider from '@/components/storage/ClientInitProvider';

export const metadata: Metadata = {
  title: 'El Farouk Cataloge',
  description: 'Browse through our wide range of products in this online catalog',
  icons: {
    icon: [
      {
        url: '/images/El Farouk10.png',
        sizes: '32x32',
      },
      {
        url: '/images/El Farouk10.png',
        sizes: '64x64',
      },
      {
        url: '/images/El Farouk10.png',
        sizes: '128x128',
      }
    ],
    apple: {
      url: '/images/El Farouk10.png',
      sizes: '180x180',
    },
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="min-h-screen flex flex-col">
          <ClientInitProvider />
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
} 
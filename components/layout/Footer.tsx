import Link from 'next/link';
import Image from 'next/image';

const footerNavigation = {
  main: [
    { name: 'الرئيسية', href: '/' },
    { name: 'المنتجات', href: '/products' },
    { name: 'عن الشركة', href: '/about' },
    { name: 'اتصل بنا', href: '/contact' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-[#5F5F5F] text-white w-full">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="mb-4">
              <Image
                src="/images/El Farouk10.png"
                alt="El Farouk Group"
                width={200}
                height={70}
                className="h-16 w-auto"
              />
            </div>
            <p className="text-gray-200 mb-4">
              كتالوج شامل لجميع منتجاتنا المميزة بتصنيفات متعددة وتحديثات دورية.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">روابط سريعة</h3>
            <ul className="space-y-2">
              {footerNavigation.main.map((item) => (
                <li key={item.name}>
                  <Link href={item.href} className="text-gray-300 hover:text-white">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-500 mt-8 pt-6">
          <p className="text-center text-gray-300">
            &copy; {new Date().getFullYear()} El Farouk Group. جميع الحقوق محفوظة.
          </p>
          <p className="text-center text-gray-300 mt-2">
            Developed by Moataz Sakr
          </p>
        </div>
      </div>
    </footer>
  );
}
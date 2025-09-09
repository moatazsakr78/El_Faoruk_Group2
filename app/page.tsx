import Link from 'next/link';
import Image from 'next/image';
import ProductsAndCategories from '@/components/home/ProductsAndCategories';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Products and Categories */}
      <section className="mb-16">
        <ProductsAndCategories />
      </section>
    </div>
  );
} 
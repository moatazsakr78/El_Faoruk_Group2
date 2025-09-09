'use client';

import { useState, useRef } from 'react';
import ProductGrid from '../products/ProductGrid';
import { FiSearch } from 'react-icons/fi';

export default function ProductsAndCategories() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchFormRef = useRef<HTMLFormElement>(null);
  
  // معالجة البحث
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  // تنظيف حقل البحث
  const clearSearch = () => {
    setSearchQuery('');
    if (searchFormRef.current) {
      searchFormRef.current.reset();
    }
  };
  
  return (
    <div>
      {/* شريط البحث في الأعلى */}
      <div className="mb-8">
        <form ref={searchFormRef} onSubmit={handleSubmit} className="flex items-center max-w-md mx-auto">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 right-0 flex items-center justify-center w-12 bg-[#5D1F1F] rounded-r-lg">
              <FiSearch className="h-5 w-5 text-white" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="w-full h-12 pr-12 pl-10 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-[#5D1F1F] focus:border-[#5D1F1F] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-500"
              >
                ×
              </button>
            )}
          </div>
        </form>
      </div>
      
      {/* عرض المنتجات مباشرة */}
      <ProductGrid 
        searchEnabled={false}
        searchQuery={searchQuery}
      />
    </div>
  );
}
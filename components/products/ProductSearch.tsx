'use client';

import { useState } from 'react';
import { FiSearch } from 'react-icons/fi';

interface ProductSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function ProductSearch({ 
  onSearch, 
  placeholder = "ابحث عن منتج..." 
}: ProductSearchProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto mb-6">
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D1F1F] focus:border-transparent"
        />
        <button 
          type="submit"
          className="absolute left-2 text-gray-500 hover:text-[#5D1F1F]"
          aria-label="بحث"
        >
          <FiSearch className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
} 
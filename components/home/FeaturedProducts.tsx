'use client';

import ProductGrid from '../products/ProductGrid';

export default function FeaturedProducts() {
  return (
    <ProductGrid 
      showViewAll={false}
      searchEnabled={true}
    />
  );
} 
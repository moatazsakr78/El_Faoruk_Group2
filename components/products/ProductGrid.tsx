'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ProductCard from './ProductCard';
import { Product } from '@/types';
import { 
  loadProductsFromSupabase, 
  isOnline,
  supabase
} from '@/lib/supabase';
import { FiSearch } from 'react-icons/fi';

interface ProductGridProps {
  title?: string;
  showViewAll?: boolean;
  viewAllLink?: string;
  limit?: number;
  filterByCategory?: string;
  searchEnabled?: boolean;
}

// يتم عرض 8 منتجات في البداية، ثم تحميل المزيد عند التمرير
const INITIAL_PRODUCTS_COUNT = 8;
const PRODUCTS_PER_PAGE = 8;

export default function ProductGrid({
  title,
  showViewAll = false,
  viewAllLink = '/products',
  limit,
  filterByCategory,
  searchEnabled = false,
}: ProductGridProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [productPage, setProductPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const searchFormRef = useRef<HTMLFormElement>(null);
  
  const loadProductsDataRef = useRef<() => Promise<void>>();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // تحميل المنتجات من السيرفر
  useEffect(() => {
    const loadProductsData = async () => {
      // Reset state at the beginning
      setLoading(true);
      
      // Check if we're offline first
      if (!isOnline()) {
        setIsOffline(true);
        setLoading(false);
        return;
      }
      
      // We're online, reset offline state
      setIsOffline(false);
      
      try {
        console.log('Loading products from Supabase...');
        const serverProducts = await loadProductsFromSupabase();
        
        if (serverProducts && serverProducts.length > 0) {
          console.log('Successfully loaded products from server:', serverProducts.length);
          
          // Process the products - add packPrice and boxPrice
          let processedProducts = serverProducts
            .filter(product => product !== null)
            .map(product => ({
              ...product,
              packPrice: product.piecePrice * 6, // مثال: علبة تحتوي على 6 قطع
              boxPrice: product.piecePrice * product.boxQuantity
            })) as Product[];
          
          // Apply category filter if needed
          if (filterByCategory) {
            processedProducts = processedProducts.filter((product: Product) => 
              product.categoryId && String(product.categoryId) === String(filterByCategory)
            );
            console.log('Filtered by category. Remaining count:', processedProducts.length);
          }
          
          // Filter new products if we're on the new products page
          if (window.location.pathname.includes('/products/new')) {
            const currentDate = new Date();
            const newProductDays = 14; // Hard-coded instead of from settings
            
            processedProducts = processedProducts.filter((product: Product) => {
              if (!product.createdAt || !product.isNew) return false;
              
              const createdDate = new Date(product.createdAt);
              const diffTime = Math.abs(currentDate.getTime() - createdDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              return diffDays <= newProductDays;
            });
            console.log('Filtered new products by date. Remaining count:', processedProducts.length);
          }
          
          // Sort products by date (newest first)
          processedProducts.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA; 
          });
          
          // Apply limit if specified
          if (limit && limit > 0) {
            processedProducts = processedProducts.slice(0, limit);
            console.log('Applied limit. Final count:', processedProducts.length);
          }
          
          // تعيين كل المنتجات
          setAllProducts(processedProducts);
          setFilteredProducts(processedProducts);
          
          // تعيين المنتجات المرئية في الصفحة الأولى
          const initialProducts = processedProducts.slice(0, INITIAL_PRODUCTS_COUNT);
          setVisibleProducts(initialProducts);
          
          // تحديد ما إذا كان هناك المزيد من المنتجات للتحميل
          setHasMore(processedProducts.length > INITIAL_PRODUCTS_COUNT);
          
          // إعادة تعيين رقم الصفحة
          setProductPage(1);
        } else {
          console.log('No products found on server');
          setAllProducts([]);
          setFilteredProducts([]);
          setVisibleProducts([]);
          setHasMore(false);
        }
      } catch (error) {
        console.error('Error loading products from server:', error);
        setAllProducts([]);
        setFilteredProducts([]);
        setVisibleProducts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };
    
    // Store the function in a ref so it can be called from the Supabase subscription handlers
    loadProductsDataRef.current = loadProductsData;
    
    loadProductsData();
    
    // Handle online/offline status changes
    const handleOnlineStatusChange = () => {
      const online = isOnline();
      setIsOffline(!online);
      
      if (online) {
        console.log('Connection restored. Loading fresh data...');
        loadProductsData();
      } else {
        console.log('Connection lost. Showing offline message.');
      }
    };
    
    // Listen for online/offline events
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, [limit, filterByCategory]);

  // تطبيق البحث على المنتجات
  useEffect(() => {
    if (!allProducts || allProducts.length === 0) return;
    
    // طباعة بيانات المنتجات للتصحيح
    console.log('All products for search:', allProducts.map(p => ({ id: p.id, name: p.name })));
    
    // تصفية المنتجات بناءً على استعلام البحث
    let newFilteredProducts;
    if (!searchQuery || searchQuery.trim() === '') {
      // إذا كان البحث فارغًا، عرض جميع المنتجات
      newFilteredProducts = [...allProducts];
    } else {
      // بحث عن المنتجات التي تطابق الاستعلام
      const query = searchQuery.trim().toLowerCase();
      console.log('Search query:', query);
      
      newFilteredProducts = allProducts.filter(product => {
        // التحقق من وجود المنتج وحقل الاسم
        if (!product || !product.name) {
          console.log('Product or product name is undefined', product);
          return false;
        }
        
        const productName = product.name.toLowerCase();
        const found = productName.includes(query);
        
        // طباعة نتائج البحث للتصحيح
        console.log(`Product: ${product.name}, Match: ${found}`);
        
        return found;
      });
    }
    
    console.log('Filtered products:', newFilteredProducts.length);
    
    // تحديث قائمة المنتجات المصفاة
    setFilteredProducts(newFilteredProducts);
    
    // تحديث المنتجات المرئية بالمنتجات المصفاة الجديدة
    const initialVisible = newFilteredProducts.slice(0, INITIAL_PRODUCTS_COUNT);
    setVisibleProducts(initialVisible);
    
    // تحديث المؤشرات الأخرى
    setHasMore(newFilteredProducts.length > INITIAL_PRODUCTS_COUNT);
    setProductPage(1);
  }, [searchQuery, allProducts]);

  // إرسال نموذج البحث
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // طباعة استعلام البحث للتحقق من حدوث البحث بالفعل
    console.log('Searching for:', searchQuery);
    // نقوم بالبحث مباشرة حيث أن useEffect المسؤول عن البحث سيعمل تلقائيًا
  };

  // تنظيف حقل البحث
  const clearSearch = () => {
    setSearchQuery('');
    if (searchFormRef.current) {
      searchFormRef.current.reset();
    }
  };

  // دالة لتحميل المزيد من المنتجات
  const loadMoreProducts = useCallback(() => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    
    // حساب نطاق المنتجات الجديدة للتحميل
    const startIndex = productPage * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    
    // الحصول على المنتجات الجديدة من القائمة المصفاة
    const newProducts = filteredProducts.slice(startIndex, endIndex);
    
    // إضافة المنتجات الجديدة إلى القائمة المرئية
    setVisibleProducts(prev => [...prev, ...newProducts]);
    
    // زيادة رقم الصفحة
    setProductPage(prev => prev + 1);
    
    // التحقق مما إذا كان هناك المزيد من المنتجات
    setHasMore(endIndex < filteredProducts.length);
    
    setLoadingMore(false);
  }, [productPage, filteredProducts, loadingMore, hasMore]);

  // إعداد مراقب التقاطع للتمرير اللانهائي
  useEffect(() => {
    // إزالة المراقب السابق إذا كان موجودًا
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    // إنشاء مراقب جديد
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore) {
          loadMoreProducts();
        }
      },
      { threshold: 0.1 }
    );
    
    // بدء المراقبة إذا كان عنصر التحميل موجودًا
    const loadMoreElement = loadMoreRef.current;
    if (loadMoreElement) {
      observerRef.current.observe(loadMoreElement);
    }
    
    // تنظيف عند الإلغاء
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreProducts, hasMore, loadingMore]);

  // Set up Supabase Realtime subscription
  useEffect(() => {
    // Don't set up subscription if offline
    if (isOffline) return;

    console.log('Setting up Supabase Realtime subscription for products table');
    
    // Create a channel for postgres_changes on the products table
    const channel = supabase
      .channel('product-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          console.log('Received Realtime update:', payload.eventType, payload);
          
          // Call loadProductsData to refresh the data
          if (loadProductsDataRef.current) {
            console.log(`Product ${payload.eventType} detected. Reloading data...`);
            loadProductsDataRef.current();
          }
        }
      )
      .subscribe();
    
    // Clean up subscription when component unmounts
    return () => {
      console.log('Unsubscribing from Supabase Realtime');
      supabase.removeChannel(channel);
    };
  }, [isOffline]);
  
  // عرض رسالة التحميل
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }
  
  // عرض رسالة إذا كان المستخدم غير متصل بالإنترنت
  if (isOffline) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-700 mb-4">أنت غير متصل بالإنترنت حاليًا.</p>
        <p className="text-gray-600">عد للاتصال وحاول مرة أخرى.</p>
      </div>
    );
  }
  
  // عرض رسالة إذا لم يتم العثور على منتجات
  if (allProducts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-700">لا توجد منتجات متاحة حاليًا.</p>
      </div>
    );
  }

  // عرض رسالة إذا لم يتم العثور على منتجات تطابق البحث
  if (searchQuery && filteredProducts.length === 0) {
    return (
      <>
        {/* عرض حقل البحث دائمًا */}
        {searchEnabled && (
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
        )}
        
        <div className="text-center py-8">
          <p className="text-gray-700">لم يتم العثور على منتجات تطابق "{searchQuery}"</p>
          <button 
            onClick={clearSearch}
            className="mt-4 bg-[#5D1F1F] hover:bg-[#4a1919] text-white px-4 py-2 rounded-lg transition-colors"
          >
            عرض جميع المنتجات
          </button>
        </div>
      </>
    );
  }

  // عرض المنتجات مع منطقة البحث
  return (
    <>
      {/* حقل البحث مع تصميم محسن مطابق للصورة */}
      {searchEnabled && (
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
      )}
      
      {/* عرض المنتجات المصفاة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      
      {/* عنصر محدد التحميل - يظهر فقط إذا كان هناك المزيد من المنتجات */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center pt-8">
          {loadingMore ? (
            <div className="spinner"></div>
          ) : (
            <span className="text-gray-500">جارٍ تحميل المزيد من المنتجات...</span>
          )}
        </div>
      )}
    </>
  );
} 
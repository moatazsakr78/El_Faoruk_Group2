'use client';

import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import ProductCard from './ProductCard';
import { Product } from '@/types';
import { 
  loadProductsFromSupabase, 
  isOnline
} from '@/lib/supabase';
import { supabase } from '@/lib/supabase-client';
import RealtimeManager from '@/lib/realtime-manager';
import { FiSearch } from 'react-icons/fi';

interface ProductGridProps {
  title?: string;
  showViewAll?: boolean;
  viewAllLink?: string;
  limit?: number;
  searchEnabled?: boolean;
  searchQuery?: string;
}

// يتم عرض 8 منتجات في البداية، ثم تحميل المزيد عند التمرير
const INITIAL_PRODUCTS_COUNT = 8;
const PRODUCTS_PER_PAGE = 8;

// Optimized debounce helper with stable reference
const debounceCache = new Map<string, NodeJS.Timeout>();
const debounce = (key: string, func: Function, wait: number) => {
  return (...args: any[]) => {
    const existingTimeout = debounceCache.get(key);
    if (existingTimeout) clearTimeout(existingTimeout);
    
    const timeout = setTimeout(() => {
      debounceCache.delete(key);
      func(...args);
    }, wait);
    
    debounceCache.set(key, timeout);
  };
};

// Use centralized realtime manager
const realtimeManager = RealtimeManager.getInstance();

// مكون محسن مع React.memo
function ProductGrid({
  title,
  showViewAll = false,
  viewAllLink = '/products',
  limit,
  searchEnabled = false,
  searchQuery = '',
}: ProductGridProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [productPage, setProductPage] = useState(1);
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>(searchQuery);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const searchFormRef = useRef<HTMLFormElement>(null);
  
  const loadProductsDataRef = useRef<() => Promise<void>>();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const updateInProgressRef = useRef<boolean>(false);
  const componentIdRef = useRef<string>(`product-grid-${Math.random().toString(36).substring(2, 9)}`);
  const isMountedRef = useRef<boolean>(true);

  // تحديث internalSearchQuery عندما يتغير searchQuery من الخارج
  useEffect(() => {
    setInternalSearchQuery(searchQuery);
  }, [searchQuery]);

  // تنظيف عند إلغاء تركيب المكون
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  // تحميل المنتجات من السيرفر
  useEffect(() => {
    const loadProductsData = async () => {
      try {
        setLoading(true);
        updateInProgressRef.current = true;
        
        let processedProducts: Product[] = [];
        
        // جلب كل المنتجات
        const serverProducts = await loadProductsFromSupabase();
        
        if (serverProducts && serverProducts.length > 0) {
          // Process the products - add packPrice and boxPrice
          processedProducts = serverProducts
            .filter(product => product !== null)
            .map(product => ({
              ...product,
              packPrice: product.piecePrice * 6, // مثال: علبة تحتوي على 6 قطع
              boxPrice: product.piecePrice * product.boxQuantity
            })) as Product[];
        } else {
          processedProducts = [];
        }

        // تصفية المنتجات الجديدة محسنة
        if (typeof window !== 'undefined' && window.location.pathname.includes('/products/new')) {
          const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
          processedProducts = processedProducts.filter((product: Product) => {
            if (!product.createdAt || !product.isNew) return false;
            const createdTime = new Date(product.createdAt).getTime();
            return createdTime >= fourteenDaysAgo;
          });
        }
        
        // ترتيب محسن - باستخدام الرقم الزمني مباشرة
        processedProducts.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        
        // Apply limit if specified
        if (limit && limit > 0) {
          processedProducts = processedProducts.slice(0, limit);
        }
        
        
        // تعيين كل المنتجات
        setAllProducts(processedProducts);
        setFilteredProducts(processedProducts);
        
        // تعيين المنتجات المرئية في الصفحة الأولى
        const initialProducts = processedProducts.slice(0, INITIAL_PRODUCTS_COUNT);
        setVisibleProducts(initialProducts);
        
        // تحديد ما إذا كان هناك المزيد من المنتجات للتحميل
        const shouldHaveMore = processedProducts.length > INITIAL_PRODUCTS_COUNT;
        setHasMore(shouldHaveMore);
        
        // إعادة تعيين رقم الصفحة
        setProductPage(1);
      } catch (error) {
        console.error('Error loading products from server:', error);
        setAllProducts([]);
        setFilteredProducts([]);
        setVisibleProducts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        updateInProgressRef.current = false;
        isInitialLoadRef.current = false;
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
        loadProductsData();
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
  }, [limit]);

  // تطبيق البحث المحسن مع debouncing
  const debouncedSearch = useMemo(() => {
    return debounce('search', (query: string, products: Product[]) => {
      if (!products || products.length === 0) return;
      
      let filtered;
      if (!query || query.trim() === '') {
        filtered = [...products];
      } else {
        const searchTerm = query.trim().toLowerCase();
        filtered = products.filter(product => 
          product?.name?.toLowerCase().includes(searchTerm)
        );
      }
      
      setFilteredProducts(filtered);
      setVisibleProducts(filtered.slice(0, INITIAL_PRODUCTS_COUNT));
      setHasMore(filtered.length > INITIAL_PRODUCTS_COUNT);
      setProductPage(1);
    }, 300);
  }, []);
  
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    debouncedSearch(internalSearchQuery, allProducts);
  }, [internalSearchQuery, allProducts, debouncedSearch]);

  // إرسال نموذج البحث
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // نقوم بالبحث مباشرة حيث أن useEffect المسؤول عن البحث سيعمل تلقائيًا
  };

  // تنظيف حقل البحث
  const clearSearch = () => {
    setInternalSearchQuery('');
    if (searchFormRef.current) {
      searchFormRef.current.reset();
    }
  };

  // دالة بسيطة لتحميل المزيد من المنتجات
  const loadMoreProducts = useCallback(() => {
    if (loadingMore || !hasMore || updateInProgressRef.current || !isMountedRef.current) {
      return;
    }
    
    setLoadingMore(true);
    
    // استخدام requestAnimationFrame بدلاً من setTimeout لتحسين الأداء
    requestAnimationFrame(() => {
      if (!isMountedRef.current) {
        return;
      }

      const currentVisibleCount = visibleProducts.length;
      const startIndex = currentVisibleCount;
      const endIndex = startIndex + PRODUCTS_PER_PAGE;
      const newProducts = filteredProducts.slice(startIndex, endIndex);
      
      
      if (newProducts.length > 0) {
        setVisibleProducts(prev => [...prev, ...newProducts]);
        setHasMore(endIndex < filteredProducts.length);
        setProductPage(prev => prev + 1);
      } else {
        setHasMore(false);
      }
      
      setLoadingMore(false);
    });
  }, [filteredProducts, loadingMore, hasMore, visibleProducts.length]);

  // إعداد مراقب التقاطع للتمرير اللانهائي
  useEffect(() => {
    // التحقق من الشروط المطلوبة للمراقبة
    if (!hasMore || loading || updateInProgressRef.current) {
      return;
    }

    // إزالة المراقب السابق إذا كان موجودًا
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    
    // إنشاء مراقب جديد فقط إذا كان هناك منتجات أكثر للتحميل
    const loadMoreElement = loadMoreRef.current;
    if (!loadMoreElement) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        
        // التحقق من جميع الشروط قبل التحميل
        if (entry.isIntersecting && hasMore && !loadingMore && !updateInProgressRef.current) {
          loadMoreProducts();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px' // بدء التحميل قبل وصول المستخدم للعنصر ب 100px
      }
    );
    
    observerRef.current.observe(loadMoreElement);
    
    // تنظيف عند الإلغاء
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [hasMore, loading, loadMoreProducts, visibleProducts.length, filteredProducts.length]);

  // معالجات في الوقت الفعلي محسنة
  const handleRealtimeChange = useCallback((payload: any) => {
    if (isInitialLoadRef.current || updateInProgressRef.current) return;
    
    const { event } = payload;
    
    switch (event) {
      case 'INSERT':
        // إعادة تحميل للمنتجات الجديدة
        if (loadProductsDataRef.current) {
          loadProductsDataRef.current();
        }
        break;
        
      case 'UPDATE':
        // تحديث محسن للمنتج المعدل
        const updatedProduct = {
          ...payload.new,
          imageUrl: payload.new.image_url || payload.new.imageUrl || '',
          packPrice: payload.new.piece_price ? payload.new.piece_price * 6 : 0,
          boxPrice: payload.new.piece_price && payload.new.box_quantity ? 
                    payload.new.piece_price * payload.new.box_quantity : 0
        };
        
        setAllProducts(prev => 
          prev.map(product => 
            product.id === updatedProduct.id ? updatedProduct : product
          )
        );
        
        setVisibleProducts(prev => 
          prev.map(product => 
            product.id === updatedProduct.id ? updatedProduct : product
          )
        );
        break;
        
      case 'DELETE':
        const deletedId = payload.old?.id;
        if (deletedId) {
          setAllProducts(prev => prev.filter(product => product.id !== deletedId));
          setVisibleProducts(prev => prev.filter(product => product.id !== deletedId));
        }
        break;
    }
  }, []);

  // إعداد اشتراكات الوقت الفعلي المحسنة
  useEffect(() => {
    if (isOffline) return;
    
    const componentId = componentIdRef.current;
    realtimeManager.subscribe(componentId, handleRealtimeChange);
    
    return () => {
      realtimeManager.unsubscribe(componentId);
    };
  }, [isOffline, handleRealtimeChange]);
  
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
  if (internalSearchQuery && filteredProducts.length === 0) {
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
                  value={internalSearchQuery}
                  onChange={(e) => setInternalSearchQuery(e.target.value)}
                  placeholder="ابحث عن منتج..."
                  className="w-full h-12 pr-12 pl-10 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-[#5D1F1F] focus:border-[#5D1F1F] outline-none"
                />
                {internalSearchQuery && (
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
          <p className="text-gray-700">لم يتم العثور على منتجات تطابق "{internalSearchQuery}"</p>
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
      {/* حقل البحث محسن */}
      {searchEnabled && (
        <div className="mb-8">
          <form ref={searchFormRef} onSubmit={handleSubmit} className="flex items-center max-w-md mx-auto">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 right-0 flex items-center justify-center w-12 bg-[#5D1F1F] rounded-r-lg">
                <FiSearch className="h-5 w-5 text-white" />
              </div>
              <input
                type="text"
                value={internalSearchQuery}
                onChange={(e) => setInternalSearchQuery(e.target.value)}
                placeholder="ابحث عن منتج..."
                className="w-full h-12 pr-12 pl-10 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-[#5D1F1F] focus:border-[#5D1F1F] outline-none"
              />
              {internalSearchQuery && (
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
      
      {/* عرض المنتجات بشكل محسن */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {visibleProducts.map((product) => (
          <ProductCard 
            key={`${product.id}-${product.name}`} 
            product={product}
            priority={visibleProducts.indexOf(product) < 4}
          />
        ))}
      </div>
      
      {/* عنصر محدد التحميل - يظهر فقط إذا كان هناك المزيد من المنتجات */}
      {hasMore && visibleProducts.length < filteredProducts.length && (
        <div ref={loadMoreRef} className="flex justify-center pt-8">
          {loadingMore ? (
            <div className="spinner"></div>
          ) : (
            <span className="text-gray-500">جارٍ تحميل المزيد من المنتجات...</span>
          )}
        </div>
      )}
      
      {/* رسالة عند انتهاء جميع المنتجات */}
      {!hasMore && visibleProducts.length > 0 && filteredProducts.length > INITIAL_PRODUCTS_COUNT && (
        <div className="flex justify-center pt-8">
          <span className="text-gray-500 text-sm">تم عرض جميع المنتجات ({visibleProducts.length} منتج)</span>
        </div>
      )}
    </>
  );
}

// تصدير محسن مع React.memo
export default memo(ProductGrid, (prevProps, nextProps) => {
  return (
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.limit === nextProps.limit &&
    prevProps.title === nextProps.title
  );
}); 
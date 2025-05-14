'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { useParams } from 'next/navigation';
import ProductGrid from '@/components/products/ProductGrid';
import { loadData } from '@/lib/localStorage';
import { loadProductsFromSupabase, isOnline } from '@/lib/supabase';

type Props = {
  params: { id: string };
};

export default function ProductPage() {
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [showSyncMessage, setShowSyncMessage] = useState(false);

  useEffect(() => {
    const loadProductData = async () => {
      try {
        setLoading(true);
        
        // محاولة تحميل البيانات مباشرة من السيرفر إذا كان متصلاً بالإنترنت
        if (isOnline()) {
          try {
            console.log('Loading product data from server...');
            const serverProducts = await loadProductsFromSupabase();
            
            if (serverProducts && serverProducts.length > 0) {
              // البحث عن المنتج في بيانات السيرفر
              const foundProduct = serverProducts
                .filter((p) => p !== null)
                .find(p => p.id === params.id);
              
              if (foundProduct) {
                console.log('Found product on server:', foundProduct.name);
                // إضافة الخصائص المفقودة أو تعديل نوع البيانات
                const fullProduct: Product = {
                  ...foundProduct,
                  packPrice: foundProduct.piecePrice * 6, // مثال: علبة تحتوي على 6 قطع
                  boxPrice: foundProduct.piecePrice * foundProduct.boxQuantity // سعر الكرتون
                };
                setProduct(fullProduct);
                
                // تحديث التخزين المحلي
                localStorage.setItem('products', JSON.stringify(serverProducts));
                setShowSyncMessage(true);
                setTimeout(() => setShowSyncMessage(false), 3000);
                
                setLoading(false);
                return;
              } else {
                console.log('Product not found on server. ID:', params.id);
              }
            } else {
              console.log('No products found on server');
            }
          } catch (error) {
            console.error('Error loading from server:', error);
          }
        }
        
        // إذا لم نتمكن من العثور على المنتج على السيرفر، نحاول البيانات المحلية
        console.log('Trying local data...');
        
        // محاولة استرجاع البيانات من التخزين الدائم
        const savedProducts = await loadData('products');
        
        // تحضير متغير للمنتجات
        let localProducts = [];
        
        // إذا وجدنا منتجات من التخزين الدائم، نستخدمها
        if (savedProducts !== null) {
          localProducts = savedProducts;
          console.log('Using products from persistent storage');
        } else {
          // احتياطياً، نحاول من localStorage العادي
          try {
            const productsFromLS = localStorage.getItem('products');
            if (productsFromLS) {
              localProducts = JSON.parse(productsFromLS);
              console.log('Using products from localStorage');
            }
          } catch (error) {
            console.error('Error parsing products from localStorage:', error);
          }
        }
        
        if (localProducts && Array.isArray(localProducts)) {
          // البحث عن المنتج بالمعرف
          const foundProduct = localProducts.find((p: Product) => p.id === params.id);
          
          if (foundProduct) {
            console.log('Found product in local storage:', foundProduct.name);
            // إضافة الخصائص المفقودة إذا لم تكن موجودة
            const fullProduct: Product = {
              ...foundProduct,
              packPrice: foundProduct.packPrice || foundProduct.piecePrice * 6,
              boxPrice: foundProduct.boxPrice || foundProduct.piecePrice * foundProduct.boxQuantity
            };
            setProduct(fullProduct);
          } else {
            console.log('Product not found locally. ID:', params.id);
            setProduct(null);
          }
        } else {
          console.log('No products found locally');
          setProduct(null);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading product:', error);
        setProduct(null);
        setLoading(false);
      }
    };
    
    loadProductData();
    
    // الاستماع للتغييرات في التخزين وحالة الاتصال
    const handleStorageChange = () => {
      console.log('Storage changed, reloading product details');
      setLastUpdate(Date.now());
    };
    
    const handleOnlineStatusChange = () => {
      if (isOnline()) {
        console.log('Connection restored. Reloading product...');
        loadProductData();
      } else {
        console.log('Connection lost. Using local data.');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('customStorageChange', handleStorageChange as EventListener);
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('customStorageChange', handleStorageChange as EventListener);
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, [params.id, lastUpdate]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl font-bold mb-4">المنتج غير موجود</h1>
        <p className="text-lg text-gray-600">
          عذراً، المنتج الذي تبحث عنه غير موجود.
        </p>
        <Link href="/products" className="mt-6 inline-block bg-primary text-white px-6 py-2 rounded-md">
          العودة إلى المنتجات
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {showSyncMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">
          تم تحديث البيانات من الخادم المركزي
        </div>
      )}
      
      <div className="mb-4">
        <Link 
          href="/products"
          className="text-primary hover:underline"
        >
          المنتجات
        </Link>
        <span className="mx-2">&gt;</span>
        <span className="text-gray-600">{product.name}</span>
      </div>

      <div className="bg-[#D7D7D7] rounded-lg shadow-lg overflow-hidden mb-8">
        <div className="grid md:grid-cols-2 gap-6 p-6">
          {/* صورة المنتج */}
          <div className="flex justify-center items-center bg-gray-50 rounded-lg p-6">
            <div className="relative w-full h-96">
              {product.imageUrl ? (
                <div className="relative w-full h-full">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="object-contain w-full h-full"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <span className="text-gray-400 text-lg">لا توجد صورة</span>
                </div>
              )}
            </div>
          </div>

          {/* معلومات المنتج */}
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
            
            <div className="mb-6 bg-gray-100 p-4 rounded-lg text-center">
              <p className="text-lg font-bold text-gray-700 mb-2">كود المنتج</p>
              <p className="text-3xl font-bold text-primary">{product.productCode}</p>
            </div>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="mb-3"><span className="font-bold">الكمية في الكرتونة:</span> {product.boxQuantity} قطعة</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="bg-primary bg-opacity-10 p-4 rounded-lg">
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-primary mb-2">سعر القطعة</h3>
                    <p className="text-3xl font-bold">{product.piecePrice} جنيه</p>
                  </div>
                </div>
              </div>
              
              {product.wholesalePrice && (
                <div className="bg-secondary bg-opacity-10 p-4 rounded-lg">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-secondary mb-2">سعر الجملة</h3>
                      <p className="text-3xl font-bold">{product.wholesalePrice} جنيه</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-auto">
              <p className="text-sm text-gray-500">* الأسعار قابلة للتغيير، يرجى الاتصال للتأكد من الأسعار الحالية.</p>
            </div>
          </div>
        </div>
      </div>

      {/* منتجات أخرى */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">منتجات أخرى قد تعجبك</h2>
        <ProductGrid 
          limit={4}
        />
      </div>
    </div>
  );
} 
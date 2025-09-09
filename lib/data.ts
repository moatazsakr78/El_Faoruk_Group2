'use client';

import { Product } from '@/types';
import { supabase } from '@/lib/supabase-client';

export function getProducts({ newOnly = false, limit = 0 }: { newOnly?: boolean, limit?: number } = {}) {
  try {
    // محاولة تحميل البيانات من localStorage إذا كنا في المتصفح
    if (typeof window !== 'undefined') {
      const productsData = localStorage.getItem('products');
      if (productsData) {
        try {
          let products: Product[] = JSON.parse(productsData);
          
          // تطبيق فلتر المنتجات الجديدة إذا تم تحديده
          if (newOnly) {
            products = products.filter(product => product.isNew);
          }
          
          // تطبيق الحد إذا تم تحديده وكان أكبر من 0
          if (limit > 0 && products.length > limit) {
            products = products.slice(0, limit);
          }
          
          return products;
        } catch (error) {
          console.error('خطأ في تحليل بيانات المنتجات:', error);
        }
      }
    }
    
    // في حالة عدم وجود بيانات في localStorage أو خطأ، نستخدم المنتجات الافتراضية
    const defaultProducts: Product[] = [
      {
        id: '1',
        name: 'لابتوب Asus',
        productCode: 'LP001',
        boxQuantity: 5,
        piecePrice: 1200,
        packPrice: 5500,
        boxPrice: 27000,
        imageUrl: 'https://via.placeholder.com/300',
        isNew: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'غسالة LG',
        productCode: 'WM002',
        boxQuantity: 2,
        piecePrice: 500,
        packPrice: 950,
        boxPrice: 1800,
        imageUrl: 'https://via.placeholder.com/300',
        isNew: true,
        createdAt: new Date().toISOString(),
      },
      // يمكن إضافة المزيد من المنتجات هنا...
    ];
    
    // تطبيق نفس الفلاتر على المنتجات الافتراضية
    let filteredProducts = [...defaultProducts];
    
    if (newOnly) {
      filteredProducts = filteredProducts.filter(product => product.isNew);
    }
    
    // تطبيق الحد إذا تم تحديده وكان أكبر من 0
    if (limit > 0 && filteredProducts.length > limit) {
      filteredProducts = filteredProducts.slice(0, limit);
    }
    
    return filteredProducts;
  } catch (error) {
    console.error('خطأ في الحصول على المنتجات:', error);
    return [];
  }
}

export function getProductById(id: string) {
  try {
    if (typeof window !== 'undefined') {
      const productsData = localStorage.getItem('products');
      if (productsData) {
        try {
          const products: Product[] = JSON.parse(productsData);
          return products.find(product => product.id === id) || null;
        } catch (error) {
          console.error('خطأ في تحليل بيانات المنتجات:', error);
        }
      }
    }
    
    // بيانات افتراضية إذا لم يتم العثور على المنتج
    const defaultProducts = getProducts();
    return defaultProducts.find(product => product.id === id) || null;
  } catch (error) {
    console.error('خطأ في الحصول على المنتج:', error);
    return null;
  }
}


export function getFeaturedProducts(limit = 0) {
  try {
    // يمكن تنفيذ منطق مخصص هنا لتحديد المنتجات المميزة
    // هنا نستخدم المنتجات الافتراضية كمثال
    const products = getProducts();
    
    // تطبيق الحد إذا تم تحديده وكان أكبر من 0
    if (limit > 0 && products.length > limit) {
      return products.slice(0, limit);
    }
    
    return products;
  } catch (error) {
    console.error('خطأ في الحصول على المنتجات المميزة:', error);
    return [];
  }
}

export function getNewProducts(limit = 8) {
  try {
    const products = [
      {
        id: '1',
        name: 'منتج تجريبي 1',
        productCode: 'TS001',
        boxQuantity: 5,
        piecePrice: 1200,
        imageUrl: 'https://via.placeholder.com/300',
        isNew: true,
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'منتج تجريبي 2',
        productCode: 'TS002',
        boxQuantity: 2,
        piecePrice: 500,
        imageUrl: 'https://via.placeholder.com/300',
        isNew: true,
        createdAt: new Date().toISOString()
      }
    ];
    
    return limit ? products.slice(0, limit) : products;
  } catch (error) {
    console.error('خطأ في جلب المنتجات الجديدة:', error);
    return [];
  }
}

// إضافة وظيفة مساعدة لتحويل النص العربي إلى slug صالح للاستخدام في العناوين
export function createSlug(text: string): string {
  // نحتفظ بالنص العربي كما هو، ولكن نستبدل المسافات بشرطات ونزيل أي أحرف خاصة
  return text
    .trim()
    .replace(/\s+/g, '-')        // استبدال المسافات بشرطات
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\-]/g, '') // إزالة الأحرف غير العربية أو الإنجليزية أو الرقمية باستثناء الشرطة
    .toLowerCase();             // تحويل إلى أحرف صغيرة (للأحرف اللاتينية)
}


export function getAllProductIds() {
  try {
    const products = getProducts();
    return products.map(product => ({
      params: {
        id: product.id,
      },
    }));
  } catch (error) {
    console.error('خطأ في الحصول على معرفات المنتجات:', error);
    return [];
  }
}

 
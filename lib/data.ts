'use client';

import productsData from './data/products.json';
import categoriesData from './data/categories.json';
import { Product, Category } from '@/types';
import { supabase } from '@/lib/supabase-client';

// وظيفة مساعدة لتنسيق المنتجات وفقًا للواجهة الحالية
function formatProduct(product: any): any {
  // إذا كان المنتج يحتوي على images استخدمها، وإلا استخدم imageUrl
  const imageUrl = product.imageUrl || (product.images && product.images.length > 0 ? product.images[0] : '');
  
  return {
    ...product,
    imageUrl,
    // إذا كان هناك category كائن، قم بالاحتفاظ بمعرف الفئة في categoryId
    categoryId: product.categoryId || (product.category ? product.category.id : undefined)
  };
}

export function getProducts({ categoryId = '', newOnly = false, limit = 0 }: { categoryId?: string, newOnly?: boolean, limit?: number } = {}) {
  try {
    // محاولة تحميل البيانات من localStorage إذا كنا في المتصفح
    if (typeof window !== 'undefined') {
      const productsData = localStorage.getItem('products');
      if (productsData) {
        try {
          let products: Product[] = JSON.parse(productsData);
          
          // تطبيق فلاتر التصنيف والمنتجات الجديدة إذا تم تحديدها
          if (categoryId) {
            products = products.filter(product => product.categoryId === categoryId);
          }
          
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
        categoryId: '1',
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
        categoryId: '2',
      },
      // يمكن إضافة المزيد من المنتجات هنا...
    ];
    
    // تطبيق نفس الفلاتر على المنتجات الافتراضية
    let filteredProducts = [...defaultProducts];
    
    if (categoryId) {
      filteredProducts = filteredProducts.filter(product => product.categoryId === categoryId);
    }
    
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

export function getRelatedProducts(categoryId: string, currentProductId: string, limit = 3) {
  try {
    const products = getProducts({ categoryId });
    const relatedProducts = products.filter(product => product.id !== currentProductId);
    
    // تطبيق الحد إذا تم تحديده وكان أكبر من 0
    if (limit > 0 && relatedProducts.length > limit) {
      return relatedProducts.slice(0, limit);
    }
    
    return relatedProducts;
  } catch (error) {
    console.error('خطأ في الحصول على المنتجات ذات الصلة:', error);
    return [];
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

export function getCategories() {
  try {
    // محاولة تحميل البيانات من localStorage إذا كنا في المتصفح
    if (typeof window !== 'undefined') {
      const categoriesData = localStorage.getItem('categories');
      if (categoriesData) {
        try {
          return JSON.parse(categoriesData) as Category[];
        } catch (error) {
          console.error('خطأ في تحليل بيانات الفئات:', error);
        }
      }
    }
    
    // بيانات افتراضية في حالة عدم وجود بيانات في localStorage
    return [
      {
        id: '1',
        name: 'إلكترونيات',
        slug: 'electronics',
        image: 'https://via.placeholder.com/300',
        description: 'أجهزة إلكترونية متنوعة',
      },
      {
        id: '2',
        name: 'أجهزة منزلية',
        slug: 'appliances',
        image: 'https://via.placeholder.com/300',
        description: 'أجهزة المنزل الأساسية',
      },
      // يمكن إضافة المزيد من الفئات هنا...
    ] as Category[];
  } catch (error) {
    console.error('خطأ في الحصول على الفئات:', error);
    return [];
  }
}

export function getCategoryBySlug(slug: string) {
  try {
    const categories = getCategories();
    return categories.find(category => category.slug === slug) || null;
  } catch (error) {
    console.error('خطأ في الحصول على الفئة بالاسم المستعار:', error);
    return null;
  }
}

export function getAllCategoryIds() {
  try {
    const categories = getCategories();
    return categories.map(category => ({
      params: {
        slug: category.slug,
      },
    }));
  } catch (error) {
    console.error('خطأ في الحصول على معرفات الفئات:', error);
    return [];
  }
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

/**
 * دالة محسنة للحصول على المنتجات حسب الفئة
 * @param categoryId معرف الفئة
 * @returns مصفوفة من المنتجات التي تنتمي للفئة
 */
export async function getProductsByCategoryFromSupabase(categoryId: string) {
  if (!categoryId) return [];
  
  try {
    // استعلام واحد محسن باستخدام join بدلاً من عدة استعلامات
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        *,
        product_categories!inner(category_id)
      `)
      .eq('product_categories.category_id', categoryId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching products by category:', error);
      return [];
    }
    
    if (!products || products.length === 0) {
      return [];
    }
    
    // معالجة البيانات وإضافة الحقول المحسوبة
    const processedProducts = products.map(product => ({
      ...product,
      imageUrl: product.image_url || product.imageUrl || '',
      packPrice: product.piece_price ? product.piece_price * 6 : 0,
      boxPrice: product.piece_price && product.box_quantity ? 
                product.piece_price * product.box_quantity : 0,
      selectedCategories: [categoryId] // نعرف بالفعل أنها تنتمي لهذه الفئة
    }));
    
    return processedProducts;
  } catch (error) {
    console.error('Error in getProductsByCategoryFromSupabase:', error);
    return [];
  }
}

/**
 * دالة محسنة لجلب جميع المنتجات مع علاقاتها بالفئات
 */
export async function getAllProductsWithCategories() {
  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        *,
        product_categories(category_id)
      `)
      .order('created_at', { ascending: false });
      
    if (productsError) {
      console.error('Error fetching products:', productsError);
      return [];
    }
    
    if (!products) return [];
    
    // معالجة البيانات
    const processedProducts = products.map(product => ({
      ...product,
      imageUrl: product.image_url || product.imageUrl || '',
      packPrice: product.piece_price ? product.piece_price * 6 : 0,
      boxPrice: product.piece_price && product.box_quantity ? 
                product.piece_price * product.box_quantity : 0,
      selectedCategories: (product as any).product_categories?.map((pc: any) => pc.category_id) || []
    }));
    
    return processedProducts;
  } catch (error) {
    console.error('Error in getAllProductsWithCategories:', error);
    return [];
  }
} 
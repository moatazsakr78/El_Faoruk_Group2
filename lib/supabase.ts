import { createClient } from '@supabase/supabase-js';
import { Product } from '@/types';
import { saveData } from './localStorage';
import { logSupabaseError, logSuccessfulSync } from './supabase-error-handler';

// تعريف interface للخطأ المخصص
interface EnhancedError extends Error {
  userFriendlyMessage?: string;
}

// إعدادات Supabase من متغيرات البيئة أو القيم الثابتة
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzdhtfmtaznscbxfykxy.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6ZGh0Zm10YXpuc2NieGZ5a3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTcxNTMzNzgsImV4cCI6MjAzMjcyOTM3OH0.Wbn1KGfCSYjNtvYSyDpjMDhHUw9E5iA-6YK2Qe16ZyY';

// إعداد خيارات العميل
const supabaseOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'X-Client-Info': 'HeaWaBas Web App',
    },
  },
  // تعيين مهلة للطلبات
  fetch: (url: RequestInfo, options?: RequestInit) => {
    return fetch(url, {
      ...options,
      signal: options?.signal || AbortSignal.timeout(30000), // مهلة 30 ثانية
    });
  },
};

// إنشاء عميل Supabase
export const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);

// متغير عام للإشارة إلى آخر تحديث
let lastSyncTimestamp = 0;
// عند تهيئة التطبيق، نحاول استرجاع آخر وقت مزامنة من التخزين
if (typeof window !== 'undefined') {
  try {
    const savedTimestamp = localStorage.getItem('lastSyncTimestamp');
    if (savedTimestamp) {
      lastSyncTimestamp = parseInt(savedTimestamp, 10);
    }
  } catch (e) {
    console.error('خطأ في تحميل طابع المزامنة الزمني:', e);
  }
}

// دالة مساعدة لتحويل أسماء الحقول من صيغة الشرطة السفلية إلى الحالة الجملية
function mapDatabaseToAppModel(product: any) {
  if (!product) return null;
  
  // تعامل مع كلا الاسمين لحقل التاريخ (created_at و createdAt)
  const createdDate = product.created_at || product.createdAt || new Date().toISOString();
  
  return {
    id: product.id,
    name: product.name,
    productCode: product.product_code,
    boxQuantity: product.box_quantity,
    piecePrice: product.piece_price,
    packPrice: product.pack_price,
    boxPrice: product.box_price,
    imageUrl: product.image_url,
    isNew: product.is_new,
    createdAt: createdDate,
    updated_at: product.updated_at, // إضافة حقل تاريخ التحديث
    categoryId: product.category_id
  };
}

// دالة مساعدة لتحويل أسماء الحقول من الحالة الجملية إلى صيغة الشرطة السفلية
function mapAppModelToDatabase(product: any) {
  if (!product) return null;
  
  console.log('تحويل المنتج:', product.id, 'createdAt:', product.createdAt);
  
  // إنشاء نسخة من التاريخ بالصيغة المناسبة
  let formattedDate = product.createdAt;
  
  // التأكد من وجود تاريخ صالح وتحويله إلى سلسلة نصية ISO
  if (!formattedDate) {
    formattedDate = new Date().toISOString();
  } else if (formattedDate instanceof Date) {
    formattedDate = formattedDate.toISOString();
  } else if (typeof formattedDate !== 'string') {
    try {
      formattedDate = new Date(formattedDate).toISOString();
    } catch (e) {
      console.warn('تاريخ غير صالح، استخدام التاريخ الحالي بدلاً منه');
      formattedDate = new Date().toISOString();
    }
  }
  
  // الوقت الحالي للحقل updated_at
  const now = new Date().toISOString();
  
  // إنشاء كائن النتيجة
  const result = {
    id: product.id,
    name: product.name,
    product_code: product.productCode,
    box_quantity: product.boxQuantity,
    piece_price: product.piecePrice,
    pack_price: product.packPrice,
    box_price: product.boxPrice,
    image_url: product.imageUrl,
    is_new: product.isNew,
    created_at: formattedDate,
    updated_at: now, // إضافة حقل تاريخ التحديث
    category_id: product.categoryId
  };
  
  // طباعة الناتج للتحقق
  console.log('بعد التحويل:', result.id, 'created_at:', result.created_at, 'updated_at:', result.updated_at);
  
  return result;
}

// دالة مساعدة لإنشاء جدول المنتجات يدوياً من خلال استعلام SQL مباشر
async function createProductsTable() {
  try {
    console.log('محاولة إنشاء جدول المنتجات مباشرة...');
    
    // استعلام SQL لإنشاء الجدول
    const { data, error } = await supabase.rpc('create_products_table_query');
    
    if (error) {
      // إذا فشلت الـ RPC، نحاول استخدام الطريقة البديلة باستخدام REST API
      console.error('فشل إنشاء الجدول باستخدام RPC:', error);
      
      // محاولة استخدام REST API
      const { error: restError } = await supabase
        .from('_products_creation_helper')
        .insert({ create_table: true })
        .select();
        
      if (restError) {
        console.error('فشل إنشاء الجدول باستخدام REST API:', restError);
        return false;
      }
      
      console.log('تم إنشاء جدول المنتجات باستخدام REST API');
      return true;
    }
    
    console.log('تم إنشاء جدول المنتجات بنجاح باستخدام RPC');
    return true;
  } catch (error) {
    console.error('خطأ غير متوقع أثناء محاولة إنشاء جدول المنتجات:', error);
    return false;
  }
}

/**
 * حفظ المنتجات في Supabase
 * @param products المنتجات المراد حفظها
 * @returns {Promise<boolean|{success: boolean, message: string}>} نتيجة العملية
 */
export async function saveProductsToSupabase(products: any[]): Promise<boolean | { success: boolean; message: string }> {
  if (!isOnline()) {
    console.error('Not online, cannot save to Supabase');
    const errorDetails = logSupabaseError(new Error('غير متصل بالإنترنت، تم الحفظ محلياً فقط'));
    return {
      success: false,
      message: errorDetails.userFriendlyMessage
    };
  }

  try {
    console.log(`Saving ${products.length} products to Supabase`);

    // حذف المنتجات الموجودة حاليًا
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', 'placeholder');

    if (deleteError) {
      console.error('Failed to delete existing products:', deleteError);
      const errorDetails = logSupabaseError(deleteError);
      return {
        success: false,
        message: errorDetails.userFriendlyMessage
      };
    }

    // تصفية المنتجات للحصول على منتجات فريدة
    const uniqueProductsMap = new Map();
    for (const product of products) {
      uniqueProductsMap.set(product.id, product);
    }
    const uniqueProducts = Array.from(uniqueProductsMap.values());

    // تحويل المنتجات إلى النموذج المناسب للقاعدة
    const dbProducts = uniqueProducts.map(product => mapAppModelToDatabase(product));

    // حفظ المنتجات
    const { error: insertError } = await supabase.from('products').insert(dbProducts);

    if (insertError) {
      console.error('Failed to save products to Supabase:', insertError);
      const errorDetails = logSupabaseError(insertError);
      return {
        success: false,
        message: errorDetails.userFriendlyMessage
      };
    }

    console.log(`Successfully saved ${uniqueProducts.length} products to Supabase`);
    
    // تحديث وقت المزامنة الأخير
    localStorage.setItem('lastSyncTime', Date.now().toString());
    // تسجيل نجاح المزامنة
    logSuccessfulSync();
    
    // إرسال حدث عند نجاح المزامنة
    window.dispatchEvent(new CustomEvent('supabase-sync-success', {
      detail: { count: uniqueProducts.length }
    }));

    return true;
  } catch (error) {
    console.error('Error in saveProductsToSupabase:', error);
    const errorDetails = logSupabaseError(error);
    return {
      success: false,
      message: errorDetails.userFriendlyMessage
    };
  }
}

export async function loadProductsFromSupabase() {
  try {
    if (!isOnline()) {
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    console.log('جاري تحميل المنتجات من Supabase...');
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('خطأ في تحميل المنتجات من Supabase:', error);
      throw error;
    }
    
    // التحقق من وجود بيانات
    if (!data || data.length === 0) {
      console.log('لا توجد منتجات في Supabase');
      return null;
    }
    
    console.log('تم تحميل المنتجات بنجاح من Supabase:', data.length);
    
    // تحديث الطابع الزمني للمزامنة
    lastSyncTimestamp = Date.now();
    try {
      localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
    } catch (error) {
      console.error('خطأ في حفظ وقت المزامنة:', error);
    }
    
    // تحويل البيانات إلى نموذج التطبيق
    const appModels = data.map(mapDatabaseToAppModel);
    return appModels;
  } catch (error) {
    console.error('خطأ في loadProductsFromSupabase:', error);
    throw error;
  }
}

// دالة فعالة للمزامنة مع قاعدة البيانات
export async function syncProductsFromSupabase(force = false) {
  if (!isOnline()) {
    console.log('الجهاز غير متصل بالإنترنت. لا يمكن المزامنة.');
    return null;
  }
  
  try {
    console.log('بدء مزامنة المنتجات...');
    
    // تحقق مما إذا كانت المزامنة الأخيرة جديدة جدًا (أقل من 10 ثوانٍ) ولم يتم طلب التحديث القسري
    const storedTimestamp = localStorage.getItem('lastSyncTimestamp');
    if (!force && storedTimestamp) {
      const lastSync = parseInt(storedTimestamp);
      const now = Date.now();
      // إذا كانت آخر مزامنة في آخر 10 ثوانٍ، تخطي المزامنة
      if (now - lastSync < 10000) {
        console.log('تم المزامنة مؤخرًا، سيتم تخطي هذا الطلب');
        return null;
      }
    }
    
    // تحميل البيانات من السيرفر أولاً
    console.log('محاولة تحميل البيانات من السيرفر...');
    let serverData = null;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        // التحقق مما إذا كان الخطأ بسبب عدم وجود جدول المنتجات
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.log('جدول المنتجات غير موجود في قاعدة البيانات.');
          
          // محاولة إنشاء جدول المنتجات هنا غير ممكنة مباشرة
          // سيتم التركيز على رفع البيانات المحلية لاحقاً
        } else {
          throw error;
        }
      } else if (data && data.length > 0) {
        console.log('تم العثور على البيانات في السيرفر:', data.length);
        // تحويل البيانات إلى نموذج التطبيق
        serverData = data.map(mapDatabaseToAppModel);
      } else {
        console.log('لم يتم العثور على بيانات في السيرفر');
      }
    } catch (fetchError: any) {
      console.error('خطأ في جلب البيانات من السيرفر:', fetchError);
      if (fetchError.message && (fetchError.message.includes('createdAt') || fetchError.message.includes('created_at'))) {
        console.warn('خطأ في هيكل الجدول: مشكلة في حقل تاريخ الإنشاء. تعديل البيانات للتوافق...');
      }
    }
    
    // تحميل البيانات المحلية
    let localData = [];
    try {
      const storedData = localStorage.getItem('products');
      if (storedData) {
        localData = JSON.parse(storedData);
        console.log('تم تحميل البيانات المحلية:', localData.length);
      }
    } catch (error) {
      console.error('خطأ في تحميل البيانات المحلية:', error);
    }
    
    // إذا وجدنا بيانات على السيرفر، استخدمها وحدّث البيانات المحلية
    if (serverData) {
      console.log('استخدام بيانات السيرفر وتحديث التخزين المحلي');
      
      // تحديث البيانات المحلية
      localStorage.setItem('products', JSON.stringify(serverData));
      try {
        const request = indexedDB.open('HeaWaBas_Storage', 1);
        request.onsuccess = function(event) {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['data_store'], 'readwrite');
          const store = transaction.objectStore('data_store');
          store.put({ key: 'products', value: serverData });
        };
      } catch (error) {
        console.error('خطأ في تحديث IndexedDB:', error);
      }
      
      // تحديث الطابع الزمني للمزامنة
      lastSyncTimestamp = Date.now();
      localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
      
      // إعلام التطبيق بالتغييرات
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('customStorageChange', { 
          detail: { type: 'products', timestamp: Date.now(), source: 'server' }
        }));
      }
      
      return serverData;
    } 
    // إذا لم نجد بيانات على السيرفر ولكن لدينا بيانات محلية، ارفعها إلى السيرفر
    else if (localData.length > 0) {
      console.log('لم يتم العثور على بيانات في السيرفر. رفع البيانات المحلية...');
      
      try {
        // تحضير البيانات للرفع - تأكد من وجود حقل created_at و createdAt
        const preparedData = localData.map((product: any) => {
          if (!product.created_at && product.createdAt) {
            product.created_at = product.createdAt;
          } else if (!product.createdAt && product.created_at) {
            product.createdAt = product.created_at;
          } else if (!product.created_at && !product.createdAt) {
            const date = new Date().toISOString();
            product.created_at = date;
            product.createdAt = date;
          }
          return product;
        });

        // حذف أي بيانات موجودة في السيرفر
        await supabase.from('products').delete().not('id', 'is', null);
        
        // تنظيف البيانات
        const uniqueProducts = preparedData.filter((p: any, index: number, self: any[]) => 
          index === self.findIndex((t: any) => t.id === p.id)
        );
        
        // تحويل البيانات إلى تنسيق قاعدة البيانات
        const dbProducts = uniqueProducts.map((product: any) => {
          const dbProduct = mapAppModelToDatabase(product);
          
          if (dbProduct && dbProduct.created_at instanceof Date) {
            dbProduct.created_at = dbProduct.created_at.toISOString();
          }
          
          return dbProduct || {};
        });
        
        // رفع البيانات المحلية
        const { data, error } = await supabase
          .from('products')
          .insert(dbProducts)
          .select();
        
        if (error) {
          // إذا كان الخطأ بسبب عدم وجود الجدول أو مشكلة في هيكله
          if (error.code === 'PGRST116' || error.message.includes('does not exist') || error.message.includes('column')) {
            console.error('خطأ في هيكل الجدول، يرجى التحقق من إعدادات قاعدة البيانات:', error);
            console.log('سيتم استخدام البيانات المحلية فقط حتى يتم إصلاح مشكلة قاعدة البيانات');
            return uniqueProducts; // استخدام البيانات المحلية
          }
          throw error;
        }
        
        console.log('تم رفع البيانات المحلية بنجاح:', data.length);
        
        // تحويل البيانات المسترجعة إلى نموذج التطبيق
        const appModels = data.map(mapDatabaseToAppModel);
        
        // تحديث الطابع الزمني للمزامنة
        lastSyncTimestamp = Date.now();
        localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
        
        return appModels;
      } catch (error) {
        console.error('خطأ في رفع البيانات المحلية إلى السيرفر:', error);
        // في حالة الفشل، استخدم البيانات المحلية على الأقل
        return localData;
      }
    }
    
    // لا توجد بيانات في أي مكان
    console.log('لا توجد بيانات محلية أو على السيرفر');
    return null;
  } catch (error) {
    console.error('خطأ في syncProductsFromSupabase:', error);
    throw error;
  }
}

// إجبار تحديث البيانات من السيرفر
export async function forceRefreshFromServer() {
  if (!isOnline()) {
    console.log('الجهاز غير متصل بالإنترنت. لا يمكن التحديث.');
    return null;
  }
  
  try {
    console.log('إجبار تحديث البيانات من السيرفر...');
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('لا توجد بيانات في السيرفر');
      return null;
    }
    
    console.log('تم تحميل البيانات بنجاح من السيرفر:', data.length);
    
    // تحويل البيانات إلى نموذج التطبيق
    const appModels = data.map(mapDatabaseToAppModel);
    
    // تحديث البيانات المحلية
    localStorage.setItem('products', JSON.stringify(appModels));
    try {
      await saveData('products', appModels);
    } catch (e) {
      console.error('خطأ في حفظ البيانات في التخزين الدائم:', e);
    }
    
    // تحديث الطابع الزمني للمزامنة
    lastSyncTimestamp = Date.now();
    localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
    
    // إعلام التطبيق بالتغييرات بضمان التنفيذ بعد التخزين
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('customStorageChange', { 
            detail: { type: 'products', timestamp: Date.now(), source: 'server' }
          }));
          console.log('تم إرسال إشعارات تحديث البيانات بنجاح');
        } catch (e) {
          console.error('خطأ أثناء إرسال إشعارات تحديث البيانات:', e);
        }
      }
    }, 100);
    
    return appModels;
  } catch (error) {
    console.error('خطأ في forceRefreshFromServer:', error);
    throw error;
  }
}

// وظيفة للتحقق من الاتصال بالإنترنت
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// دالة لإنشاء أو تحديث جدول المنتجات
export async function createOrUpdateProductsTable() {
  try {
    if (!isOnline()) {
      console.error('لا يوجد اتصال بالإنترنت');
      throw new Error('لا يوجد اتصال بالإنترنت');
    }

    console.log('جاري التحقق من وجود جدول المنتجات وهيكله...');
    
    // محاولة الوصول إلى الجدول للتحقق من وجوده
    const { data: tableExists, error: tableError } = await supabase
      .from('products')
      .select('id')
      .limit(1);
    
    if (tableError && tableError.code === 'PGRST116') {
      // الجدول غير موجود، إنشاءه
      console.log('جدول المنتجات غير موجود. جاري إنشاء الجدول...');
      
      // استعلام SQL لإنشاء الجدول
      const { error: createError } = await supabase.rpc('create_products_table');
      
      if (createError) {
        console.error('فشل في استدعاء دالة إنشاء الجدول:', createError);
        
        // محاولة إنشاء الجدول مباشرة
        const { error: sqlError } = await supabase.rpc('run_sql', { 
          sql: `
            CREATE TABLE IF NOT EXISTS products (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              product_code TEXT,
              box_quantity INTEGER,
              piece_price NUMERIC,
              pack_price NUMERIC,
              box_price NUMERIC,
              image_url TEXT,
              is_new BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              category_id TEXT
            );
          `
        });
        
        if (sqlError) {
          console.error('فشل في إنشاء جدول المنتجات مباشرة:', sqlError);
          throw new Error('فشل في إنشاء جدول المنتجات');
        }
        
        console.log('تم إنشاء جدول المنتجات بنجاح');
      } else {
        console.log('تم إنشاء جدول المنتجات بنجاح');
      }
    } else {
      // الجدول موجود، تحقق من وجود العمود created_at
      console.log('جدول المنتجات موجود، جاري التحقق من هيكله...');
      
      // استعلام للتحقق من وجود العمود created_at
      const { error: columnError } = await supabase.rpc('run_sql', { 
        sql: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'products' 
          AND column_name = 'created_at';
        `
      });
      
      if (columnError) {
        console.error('فشل في التحقق من وجود العمود created_at:', columnError);
        
        // محاولة إضافة العمود
        const { error: alterError } = await supabase.rpc('run_sql', { 
          sql: `
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          `
        });
        
        if (alterError) {
          console.error('فشل في إضافة العمود created_at:', alterError);
          throw new Error('فشل في تحديث هيكل جدول المنتجات');
        }
        
        console.log('تم إضافة العمود created_at بنجاح');
      } else {
        console.log('هيكل جدول المنتجات صحيح');
      }
    }
    
    return true;
  } catch (error) {
    console.error('خطأ في createOrUpdateProductsTable:', error);
    throw error;
  }
}

// دالة لإعادة ضبط جدول المنتجات وحذف جميع المنتجات ثم إعادة رفعها
export async function resetAndSyncProducts(products: any[]) {
  if (!isOnline()) {
    console.error('لا يوجد اتصال بالإنترنت. لا يمكن إعادة ضبط المنتجات.');
    throw new Error('لا يوجد اتصال بالإنترنت');
  }

  console.log('بدء إعادة ضبط ومزامنة المنتجات...');
  
  try {
    // 1. حذف جميع المنتجات الموجودة
    console.log('حذف جميع المنتجات من قاعدة البيانات...');
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', '0'); // لحذف جميع الصفوف (حيث المعرف لا يساوي 0)
    
    if (deleteError) {
      console.error('فشل في حذف المنتجات:', deleteError);
      // استمر بالعملية حتى لو فشل الحذف
    } else {
      console.log('تم حذف جميع المنتجات بنجاح');
    }
    
    // إضافة تأخير بسيط للتأكد من اكتمال عملية الحذف
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 2. إضافة منتج اختبار بسيط للتحقق من هيكل الجدول
    console.log('إضافة منتج اختبار للتحقق من هيكل الجدول...');
    const testProduct = {
      id: 'test-' + Date.now(),
      name: 'منتج اختبار',
      product_code: 'TEST001',
      box_quantity: 10,
      piece_price: 1.0,
      pack_price: 5.0,
      box_price: 10.0,
      image_url: '',
      is_new: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category_id: null
    };
    
    const { data: testData, error: testError } = await supabase
      .from('products')
      .insert(testProduct)
      .select();
    
    if (testError) {
      console.error('فشل في إضافة منتج الاختبار:', testError);
      
      // التحقق مما إذا كان الخطأ متعلق بسياسة RLS
      if (testError.message.includes('row-level security policy')) {
        console.log('خطأ في سياسة أمان مستوى الصف (RLS)، محاولة استخدام إعدادات أكثر تساهلاً...');
        
        // حفظ البيانات محلياً بدلاً من إرسالها إلى الخادم
        if (products && products.length > 0) {
          console.log('حفظ البيانات محلياً فقط...');
          localStorage.setItem('products', JSON.stringify(products));
          
          // تحديث الطابع الزمني للمزامنة
          lastSyncTimestamp = Date.now();
          localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
          
          // التخزين في IndexedDB
          try {
            await saveData('products', products);
            console.log('تم حفظ البيانات بنجاح في التخزين المحلي الدائم');
          } catch (dbError) {
            console.error('فشل في حفظ البيانات في التخزين المحلي الدائم:', dbError);
          }
          
          // إطلاق حدث لإبلاغ التطبيق بتغيير البيانات
          const event = new Event('customStorageChange');
          window.dispatchEvent(event);
          
          return products;
        }
        return [];
      }
      
      throw new Error('فشل التحقق من هيكل الجدول: ' + testError.message);
    }
    
    console.log('تم إضافة منتج الاختبار بنجاح. هيكل الجدول سليم.');
    
    // 3. حذف منتج الاختبار
    const { error: removeTestError } = await supabase
      .from('products')
      .delete()
      .eq('id', testProduct.id);
    
    if (removeTestError) {
      console.warn('تحذير: فشل في حذف منتج الاختبار:', removeTestError);
      // لا نريد إيقاف العملية بسبب هذا الخطأ
    }
    
    // 4. تحويل البيانات وإضافتها
    console.log('إضافة المنتجات الفعلية...');
    
    if (!products || products.length === 0) {
      console.log('لا توجد منتجات لإضافتها');
      return [];
    }
    
    // تحضير البيانات للإدراج
    const dbProducts = products.map(product => {
      // تأكد من وجود كل الحقول المطلوبة
      const now = new Date().toISOString();
      
      return {
        id: product.id || ('new-' + Date.now() + Math.random().toString(36).substring(2, 9)),
        name: product.name || 'منتج بدون اسم',
        product_code: product.productCode || '',
        box_quantity: product.boxQuantity || 0,
        piece_price: product.piecePrice || 0,
        pack_price: product.packPrice || 0,
        box_price: product.boxPrice || 0,
        image_url: product.imageUrl || '',
        is_new: product.isNew || false,
        created_at: product.createdAt || product.created_at || now,
        updated_at: now,
        category_id: product.categoryId || null
      };
    });
    
    // رفع المنتجات إلى Supabase
    const { data, error } = await supabase
      .from('products')
      .upsert(dbProducts, { onConflict: 'id' })
      .select();
      
    // التعامل مع الخطأ إن وجد
    if (error) {
      console.error('خطأ في حفظ المنتجات:', error);
      
      // التحقق مما إذا كان الخطأ متعلق بسياسة RLS
      if (error.message.includes('row-level security policy')) {
        console.log('خطأ في سياسة أمان مستوى الصف (RLS)، تفعيل الوضع المحلي فقط...');
        
        const userFriendlyError = {
          message: 'تم حفظ البيانات محلياً بنجاح. لكن هناك مشكلة في إعدادات سياسة أمان قاعدة البيانات (RLS) تمنع المزامنة مع السيرفر.',
          userFriendlyMessage: 'تم حفظ البيانات محلياً فقط. لتفعيل المزامنة مع السيرفر، يرجى تعديل إعدادات الـ RLS في Supabase من خلال لوحة التحكم.',
          originalError: error,
        };
        
        // حفظ البيانات محلياً على أي حال
        if (products && products.length > 0) {
          localStorage.setItem('products', JSON.stringify(products));
          
          // تحديث الطابع الزمني للمزامنة
          lastSyncTimestamp = Date.now();
          localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
          
          // التخزين في IndexedDB
          try {
            await saveData('products', products);
            console.log('تم حفظ البيانات بنجاح في التخزين المحلي الدائم، رغم فشل المزامنة مع السيرفر');
          } catch (dbError) {
            console.error('فشل في حفظ البيانات في التخزين المحلي الدائم:', dbError);
          }
          
          // إطلاق حدث لإبلاغ التطبيق بتغيير البيانات
          const event = new Event('customStorageChange');
          window.dispatchEvent(event);
          
          return { 
            success: true, 
            message: 'تم حفظ البيانات محلياً فقط، بدون مزامنة مع السيرفر بسبب سياسة أمان RLS',
            userFriendlyMessage: userFriendlyError.userFriendlyMessage
          };
        }
      }
      
      // إعادة طرح الخطأ لمعالجته في المستدعي مع رسالة أكثر وضوحًا
      const enhancedError = new Error('فشلت مزامنة المنتجات: تحقق من الاتصال بالإنترنت وهيكل البيانات وإعدادات Supabase.') as EnhancedError;
      enhancedError.userFriendlyMessage = 'تم حفظ البيانات محلياً فقط، ويمكن استخدام زر "إصلاح فوري لمشكلة المزامنة" لحل المشكلة.';
      throw enhancedError;
    }

    console.log('تم حفظ المنتجات بنجاح في Supabase:', data.length);
    
    // تحديث الطابع الزمني للمزامنة
    lastSyncTimestamp = Date.now();
    localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
    
    // تحويل البيانات المسترجعة إلى نموذج التطبيق
    const appModels = data.map(mapDatabaseToAppModel);
    return appModels;
  } catch (error) {
    console.error('خطأ في resetAndSyncProducts:', error);
    throw error;
  }
} 
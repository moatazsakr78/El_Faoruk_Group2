import { createClient } from '@supabase/supabase-js';
import { Product } from '@/types';
import { saveData } from './localStorage';
import { logSupabaseError, logSuccessfulSync } from './supabase-error-handler';

// تعريف interface للخطأ المخصص
interface EnhancedError extends Error {
  userFriendlyMessage?: string;
}

// إعدادات Supabase من متغيرات البيئة أو القيم الثابتة
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

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
  
  // طباعة البيانات المستلمة من قاعدة البيانات للتشخيص
  console.log('بيانات المنتج المستلمة من قاعدة البيانات:', {
    id: product.id,
    name: product.name,
    product_code: product.product_code,
    box_quantity: product.box_quantity,
    piece_price: product.piece_price
  });
  
  // تعامل مع كلا الاسمين لحقل التاريخ (created_at و createdAt)
  const createdDate = product.created_at || product.createdAt || new Date().toISOString();
  
  // التأكد من تحويل القيم الرقمية بشكل صحيح
  // استخدام parseFloat لتحويل النصوص إلى أرقام حقيقية
  // واستخدام isNaN للتحقق من أن القيمة رقم صالح
  const boxQuantity = typeof product.box_quantity === 'number' ? product.box_quantity : 
                     (product.box_quantity !== undefined && product.box_quantity !== null) ? 
                     parseFloat(product.box_quantity) : 0;
                     
  const piecePrice = typeof product.piece_price === 'number' ? product.piece_price : 
                    (product.piece_price !== undefined && product.piece_price !== null) ? 
                    parseFloat(product.piece_price) : 0;
  
  // تعيين القيم غير القابلة للتحويل إلى 0
  const validBoxQuantity = isNaN(boxQuantity) ? 0 : boxQuantity;
  const validPiecePrice = isNaN(piecePrice) ? 0 : piecePrice;
  
  const result = {
    id: product.id,
    name: product.name || '',
    productCode: product.product_code || '',
    boxQuantity: validBoxQuantity,
    piecePrice: validPiecePrice,
    imageUrl: product.image_url || '',
    isNew: !!product.is_new,
    createdAt: createdDate,
    updated_at: product.updated_at || new Date().toISOString(), // إضافة حقل تاريخ التحديث
    categoryId: product.category_id
  };
  
  // طباعة النتيجة بعد التحويل للتشخيص
  console.log('بعد تحويل المنتج إلى نموذج التطبيق:', result);
  
  return result;
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

    // تصفية المنتجات للحصول على منتجات فريدة
    const uniqueProductsMap = new Map();
    for (const product of products) {
      uniqueProductsMap.set(product.id, product);
    }
    const uniqueProducts = Array.from(uniqueProductsMap.values());

    // تحويل المنتجات إلى النموذج المناسب للقاعدة
    const dbProducts = uniqueProducts.map(product => mapAppModelToDatabase(product));

    // استخدام upsert بدلاً من delete ثم insert
    // هذا سيقوم بتحديث المنتجات الموجودة وإضافة المنتجات الجديدة
    const { error: upsertError } = await supabase
      .from('products')
      .upsert(dbProducts, { 
        onConflict: 'id',  // تحديد العمود الذي يتم استخدامه للتعرف على المنتج
        ignoreDuplicates: false  // نريد تحديث السجلات الموجودة، وليس تجاهلها
      });

    if (upsertError) {
      console.error('Failed to save products to Supabase:', upsertError);
      const errorDetails = logSupabaseError(upsertError);
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
        const { data: upsertedProducts, error: upsertError } = await supabase
          .from('products')
          .upsert(dbProducts, {
            onConflict: 'id',
            ignoreDuplicates: false // نريد تحديث السجلات الموجودة
          })
          .select(); // استخدام select() بدلاً من returning في الخيارات
        
        if (upsertError) {
          console.error('فشل في تحديث/إضافة المنتجات:', upsertError);
          
          // حفظ البيانات محلياً على أي حال
          localStorage.setItem('products', JSON.stringify(uniqueProducts));
          await saveData('products', uniqueProducts);
          
          return {
            success: false,
            message: `تم الحفظ محلياً فقط. فشل المزامنة: ${upsertError.message}`
          };
        }
        
        console.log(`تم تحديث/إضافة ${dbProducts.length} منتج بنجاح`);
        
        // ⚠️ بعد upsert، نجلب كل البيانات من السيرفر بما في ذلك السجلات التي كانت موجودة من قبل
        // هذا يضمن أن نحصل على جميع السجلات، وليس فقط تلك التي تم upsert لها
        const { data: allCurrentProducts, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .eq('is_deleted', false) // نجلب فقط السجلات غير المحذوفة
          .order('created_at', { ascending: false });
        
        if (fetchError) {
          console.error('فشل في جلب جميع المنتجات بعد التحديث:', fetchError);
          // نستمر بالبيانات التي قمنا بإرسالها على الأقل
        }
        
        // تحويل البيانات المسترجعة من السيرفر إلى صيغة التطبيق
        const finalProducts = allCurrentProducts ? 
          allCurrentProducts.map(mapDatabaseToAppModel) : 
          uniqueProducts; // استخدام البيانات المحلية إذا فشل جلب البيانات من السيرفر
        
        console.log(`تم استرجاع ${finalProducts.length} منتج من السيرفر بعد التحديث`);
        
        // تحديث الطابع الزمني للمزامنة
        lastSyncTimestamp = Date.now();
        localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
        
        // حفظ في التخزين المحلي أيضاً للتأكد من التزامن
        localStorage.setItem('products', JSON.stringify(finalProducts));
        await saveData('products', finalProducts);
        
        // إطلاق حدث لإبلاغ التطبيق بتغيير البيانات
        const event = new CustomEvent('customStorageChange', {
          detail: { type: 'products', source: 'server' }
        });
        window.dispatchEvent(event);
        
        return finalProducts;
      } catch (error) {
        console.error('خطأ في رفع البيانات المحلية إلى السيرفر:', error);
        // محاولة الحفظ محلياً على الأقل
        try {
          localStorage.setItem('products', JSON.stringify(localData));
          await saveData('products', localData);
          console.log('تم حفظ البيانات محلياً على الرغم من فشل المزامنة');
        } catch (localError) {
          console.error('فشل حتى في الحفظ المحلي:', localError);
        }
        
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
    
    // التحقق أولاً من وجود الجدول والصلاحيات
    const tableExists = await createOrUpdateProductsTable();
    if (!tableExists) {
      console.log('لا يمكن الوصول إلى جدول المنتجات. سيتم العودة إلى البيانات المحلية.');
      return null;
    }
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('خطأ في تحميل البيانات من السيرفر:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('لا توجد بيانات في السيرفر');
      return null;
    }
    
    console.log('تم تحميل البيانات بنجاح من السيرفر:', data.length);
    
    // طباعة البيانات المستلمة من السيرفر للتشخيص
    console.log('عينة من بيانات السيرفر:', data.slice(0, 2));
    
    // تحويل البيانات إلى نموذج التطبيق مع التأكد من صحة القيم
    const appModels = data.map(item => {
      // تحويل البيانات من تنسيق قاعدة البيانات إلى تنسيق التطبيق
      const model = mapDatabaseToAppModel(item);
      
      // طباعة نتيجة التحويل للتشخيص
      console.log('نتيجة التحويل من قاعدة البيانات:', model);
      
      // التأكد من وجود جميع الحقول المطلوبة وبالأنواع الصحيحة
      const validatedModel = {
        id: model?.id?.toString() || '',
        name: model?.name || '',
        productCode: model?.productCode || '',
        // استخدام تحقق دقيق من القيم الرقمية
        boxQuantity: typeof model?.boxQuantity === 'number' ? model.boxQuantity : 
                     model?.boxQuantity ? Number(model.boxQuantity) : 0,
        piecePrice: typeof model?.piecePrice === 'number' ? model.piecePrice : 
                    model?.piecePrice ? Number(model.piecePrice) : 0,
        imageUrl: model?.imageUrl || '',
        isNew: !!model?.isNew,
        createdAt: model?.createdAt || new Date().toISOString(),
        created_at: model?.createdAt || new Date().toISOString(),
        updated_at: model?.updated_at || new Date().toISOString()
      };
      
      // طباعة النموذج النهائي المتحقق منه للتشخيص
      console.log('النموذج النهائي بعد التحقق:', validatedModel);
      
      return validatedModel;
    });
    
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

// دالة للتحقق من وجود جدول المنتجات وإنشائه أو تحديثه إذا لزم الأمر
export async function createOrUpdateProductsTable() {
  try {
    console.log('التحقق من وجود جدول المنتجات...');
    
    // بدلاً من التحقق من وجود الجدول باستخدام استعلام SQL،
    // سنحاول قراءة البيانات من الجدول لنرى ما إذا كان موجوداً
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('خطأ في الوصول إلى جدول المنتجات، قد يكون الجدول غير موجود أو هناك مشكلة في الصلاحيات');
      console.log('محاولة إنشاء الجدول سيتم تجاهلها، سنستمر بالعمل مع التخزين المحلي فقط');
      
      // هنا نفترض أن مشكلة الوصول للجدول هي مشكلة صلاحيات أو أن الجدول غير موجود
      // في بيئة Supabase، إنشاء الجداول يجب أن يتم من لوحة التحكم، وليس برمجياً في معظم الحالات
      // لذلك سنكتفي بتسجيل الخطأ والاستمرار بالعمل بالتخزين المحلي
      
      return false;
    }
    
    // إذا وصلنا إلى هنا، فالجدول موجود بالفعل
    console.log('جدول المنتجات موجود ويمكن الوصول إليه');
    return true;
  } catch (error) {
    console.error('خطأ في createOrUpdateProductsTable:', error);
    // نعيد false لنشير إلى أننا سنعتمد على التخزين المحلي فقط
    return false;
  }
}

// دالة لإعادة ضبط جدول المنتجات وحذف جميع المنتجات ثم إعادة رفعها
export async function resetAndSyncProducts(products: any[]) {
  if (!isOnline()) {
    console.error('لا يوجد اتصال بالإنترنت. لا يمكن إعادة ضبط المنتجات.');
    return {
      success: false,
      message: 'لا يوجد اتصال بالإنترنت. تم الحفظ محلياً فقط.'
    };
  }

  console.log('بدء إعادة ضبط ومزامنة المنتجات...');
  console.log(`عدد المنتجات المطلوب مزامنتها: ${products.length}`);
  
  try {
    // التحقق من وجود الجدول والصلاحيات أولاً
    const tableExists = await createOrUpdateProductsTable();
    
    if (!tableExists) {
      console.log('جدول المنتجات غير موجود أو هناك مشكلة في الوصول إليه. سيتم الحفظ محلياً فقط.');
      return {
        success: false,
        message: 'جدول المنتجات غير موجود أو هناك مشكلة في الوصول إليه. تم الحفظ محلياً فقط.'
      };
    }
    
    // لا حاجة لتحميل البيانات الموجودة من السيرفر عند حذف منتج
    // سنستخدم المنتجات المحلية المُحدثة (بعد الحذف) فقط
    
    // بدلاً من الدمج، نستخدم البيانات المحلية الحالية فقط
    const productsToSave = [...products];
    console.log(`عدد المنتجات التي سيتم حفظها: ${productsToSave.length}`);
    
    // تحضير البيانات للإرسال
    const dbProducts = productsToSave.map(product => {
      // طباعة القيم للتشخيص
      console.log('تحضير المنتج للإرسال إلى السيرفر:', {
        id: product.id,
        name: product.name,
        productCode: product.productCode,
        boxQuantity: product.boxQuantity,
        piecePrice: product.piecePrice
      });
      
      const now = new Date().toISOString();
      return {
        id: product.id || ('new-' + Date.now() + Math.random().toString(36).substring(2, 9)),
        name: product.name || 'منتج بدون اسم',
        product_code: product.productCode || '',
        // استخدام التحقق الصريح للقيم الرقمية
        box_quantity: typeof product.boxQuantity === 'number' ? product.boxQuantity : 0,
        piece_price: typeof product.piecePrice === 'number' ? product.piecePrice : 0,
        image_url: product.imageUrl || '',
        is_new: product.isNew === true,
        created_at: product.createdAt || now,
        updated_at: new Date().toISOString(),
        category_id: product.categoryId || null
      };
    });
    
    // حذف جميع البيانات الموجودة أولاً
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', 'dummy-id'); // هذا سيحذف كل شيء
    
    if (deleteError) {
      console.error('فشل في حذف البيانات الموجودة:', deleteError);
      // نستمر في العملية
    }
    
    // إذا لم يكن هناك منتجات للإدراج، نعيد مصفوفة فارغة
    if (dbProducts.length === 0) {
      console.log('لا توجد منتجات للإدراج، تم حذف جميع المنتجات من السيرفر.');
      return [];
    }
    
    // إدراج جميع البيانات المدمجة
    const { data: insertedProducts, error: insertError } = await supabase
      .from('products')
      .insert(dbProducts)
      .select();
    
    if (insertError) {
      console.error('فشل في إدراج البيانات في السيرفر:', insertError);
      
      // إعادة نتيجة الخطأ
      return {
        success: false,
        message: insertError.message || 'فشل في إدراج البيانات في السيرفر'
      };
    }
    
    console.log('تم إدراج البيانات في السيرفر بنجاح:', insertedProducts?.length || 0);
    
    // تحويل البيانات المُدرجة إلى نموذج التطبيق
    const updatedProducts = (insertedProducts || []).map(mapDatabaseToAppModel).filter(Boolean);
    
    // حفظ البيانات في التخزين المحلي
    try {
      if (typeof window !== 'undefined') {
        const productsToStore = JSON.stringify(updatedProducts);
        localStorage.setItem('products', productsToStore);
        saveData('products', updatedProducts);
        
        // تحديث آخر وقت مزامنة
        localStorage.setItem('lastSyncTimestamp', Date.now().toString());
        lastSyncTimestamp = Date.now();
        
        // إطلاق حدث لإعلام بقية التطبيق بتغير البيانات
        window.dispatchEvent(new CustomEvent('customStorageChange', {
          detail: { type: 'products', source: 'server' }
        }));
      }
    } catch (storageError) {
      console.error('خطأ في حفظ البيانات المحدثة في التخزين المحلي:', storageError);
    }
    
    return updatedProducts;
  } catch (error) {
    console.error('خطأ غير متوقع أثناء مزامنة المنتجات:', error);
    
    // تسجيل وإعادة إرسال الخطأ بتنسيق موحد
    return logSupabaseError(error);
  }
}

// ضمان وجود bucket التخزين عند بدء التطبيق
export async function ensureStorageBucketExists() {
  if (typeof window === 'undefined') {
    // لا نريد تنفيذ هذا على جانب العميل
    return;
  }

  try {
    console.log('Checking storage bucket existence...');
    
    // التحقق من وجود الـ bucket
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === 'product-images');
    let bucketCreated = false;
    
    // إنشاء bucket إذا لم يكن موجودًا
    if (!bucketExists) {
      console.log('Creating product-images bucket...');
      const { error: createError } = await supabase.storage
        .createBucket('product-images', {
          public: true,
          fileSizeLimit: 10485760, // 10 MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        });

      if (createError) {
        console.error('Error creating bucket:', createError);
        throw new Error(`فشل في إنشاء bucket: ${createError.message}`);
      }

      console.log('تم إنشاء bucket product-images بنجاح');
      
      // ملاحظة: الـ bucket يجب أن يكون عاماً بناءً على الخيارات المحددة عند الإنشاء
      // API setPublic لم تعد مدعومة، يمكن التحقق من الإعدادات في لوحة التحكم في Supabase
    }
  } catch (error) {
    console.error('Unexpected error ensuring storage bucket:', error);
  }
} 
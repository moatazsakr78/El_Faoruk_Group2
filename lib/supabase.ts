import { Product } from '@/types';
import { saveData } from './localStorage';
import { logSupabaseError, logSuccessfulSync } from './supabase-error-handler';
import { supabase, isOnline } from './supabase-client';

// Export the centralized client
export { supabase, isOnline };

// Enhanced error interface
interface EnhancedError extends Error {
  userFriendlyMessage?: string;
}

// Simplified sync timestamp management
let lastSyncTimestamp = 0;
if (typeof window !== 'undefined') {
  const savedTimestamp = localStorage.getItem('lastSyncTimestamp');
  if (savedTimestamp) {
    lastSyncTimestamp = parseInt(savedTimestamp, 10) || 0;
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
    wholesalePrice: product.wholesale_price || 0,
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
    wholesale_price: product.wholesalePrice,
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

// دالة للتحقق من وجود جدول المنتجات وإنشائه إذا لم يكن موجوداً
async function createOrUpdateProductsTable() {
  try {
    // التحقق من وجود الجدول
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .limit(1);
      
    if (error) {
      console.log('خطأ في الوصول لجدول المنتجات، محاولة إنشائه...');
      return await createProductsTable();
    }
    
    console.log('تم التحقق من وجود جدول المنتجات');
    return true;
  } catch (error) {
    console.error('خطأ غير متوقع أثناء التحقق من وجود جدول المنتجات:', error);
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

    // استعلام محسن مع علاقات الفئات
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_categories(category_id)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('خطأ في تحميل المنتجات من Supabase:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('لا توجد منتجات في Supabase');
      return null;
    }
    
    console.log('تم تحميل المنتجات بنجاح من Supabase:', data.length);
    
    // تحديث الطابع الزمني
    lastSyncTimestamp = Date.now();
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
    }
    
    // معالجة محسنة للبيانات مع الحقول المحسوبة
    const processedProducts = data.map(product => ({
      ...mapDatabaseToAppModel(product),
      selectedCategories: (product as any).product_categories?.map((pc: any) => pc.category_id) || []
    }));
    
    return processedProducts;
  } catch (error) {
    console.error('خطأ في loadProductsFromSupabase:', error);
    throw error;
  }
}

// isOnline function moved to supabase-client.ts

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
    
    // جلب المنتجات من الخادم
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (productsError) {
      console.error('خطأ في تحميل البيانات من السيرفر:', productsError);
      throw productsError;
    }
    
    if (!productsData || productsData.length === 0) {
      console.log('لا توجد بيانات في السيرفر');
      return null;
    }
    
    console.log('تم تحميل البيانات بنجاح من السيرفر:', productsData.length);
    
    // جلب علاقات المنتجات بالفئات
    const { data: productCategoriesData, error: categoriesError } = await supabase
      .from('product_categories')
      .select('*');
    
    if (categoriesError) {
      console.error('خطأ في تحميل علاقات المنتجات بالفئات:', categoriesError);
      // استمر حتى لو فشل جلب الفئات
    }
    
    // طباعة البيانات المستلمة من السيرفر للتشخيص
    console.log('عينة من بيانات المنتجات من السيرفر:', productsData.slice(0, 2));
    console.log('عينة من علاقات المنتجات بالفئات:', productCategoriesData?.slice(0, 5) || []);
    
    // تحويل البيانات إلى نموذج التطبيق مع التأكد من صحة القيم
    const transformedModels = productsData.map(item => {
      // تحويل البيانات من تنسيق قاعدة البيانات إلى تنسيق التطبيق
      const model = mapDatabaseToAppModel(item);
      
      // إضافة علاقات الفئات للمنتج
      const productCategories = productCategoriesData?.filter(pc => pc.product_id === item.id) || [];
      const categoryIds = productCategories.map(pc => pc.category_id);
      
      // طباعة نتيجة التحويل للتشخيص
      console.log('نتيجة التحويل من قاعدة البيانات:', model);
      console.log('فئات المنتج:', item.id, categoryIds);
      
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
        wholesalePrice: typeof model?.wholesalePrice === 'number' ? model.wholesalePrice : 
                    model?.wholesalePrice ? Number(model.wholesalePrice) : 0,
        imageUrl: model?.imageUrl || '',
        isNew: !!model?.isNew,
        createdAt: model?.createdAt || new Date().toISOString(),
        created_at: model?.createdAt || new Date().toISOString(),
        updated_at: model?.updated_at || new Date().toISOString(),
        // إضافة الفئات إلى المنتج
        categoryId: model?.categoryId || '',
        selectedCategories: categoryIds
      };
      
      // طباعة النموذج النهائي المتحقق منه للتشخيص
      console.log('النموذج النهائي بعد التحقق:', validatedModel);
      
      return validatedModel;
    });
    
    // تحديث الطابع الزمني للمزامنة
    lastSyncTimestamp = Date.now();
    try {
      localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp.toString());
    } catch (error) {
      console.error('خطأ في حفظ وقت المزامنة:', error);
    }
    
    // حفظ البيانات في التخزين المحلي
    try {
      localStorage.setItem('products', JSON.stringify(transformedModels));
      saveData('products', transformedModels);
      console.log('تم حفظ البيانات في التخزين المحلي');
    } catch (error) {
      console.error('خطأ في حفظ البيانات في التخزين المحلي:', error);
    }
    
    // إرسال حدث لإبلاغ التطبيق بتغيير البيانات
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('customStorageChange', { 
        detail: { type: 'products', timestamp: Date.now(), source: 'server' } 
      }));
    }
    
    return transformedModels;
  } catch (error) {
    console.error('خطأ في forceRefreshFromServer:', error);
    throw error;
  }
}
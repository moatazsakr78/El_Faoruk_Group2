/**
 * دوال مساعدة لإدارة وتحسين روابط الصور في التطبيق
 */

/**
 * إضافة معلمة إصدار إلى عنوان URL للصورة
 * @param url رابط الصورة الأصلي
 * @param version قيمة الإصدار (افتراضيًا الطابع الزمني الحالي)
 * @returns عنوان URL محسّن للصورة مع معلمة إصدار
 */
export function addVersionToImageUrl(url: string, version?: string | number): string {
  if (!url) return '';
  
  try {
    // تجنب إضافة معلمة الإصدار إذا كانت موجودة بالفعل
    if (url.includes('v=')) return url;
    
    // استخدام الطابع الزمني الحالي كقيمة افتراضية للإصدار
    const versionValue = version || Date.now();
    
    // إضافة معلمة الإصدار إلى عنوان URL
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${versionValue}`;
  } catch (error) {
    console.error('خطأ في إضافة معلمة الإصدار للرابط:', error);
    
    // محاولة إضافة معلمة للمسار النسبي
    if (url.includes('?')) {
      return `${url}&v=${Date.now()}`;
    }
    return `${url}?v=${Date.now()}`;
  }
}

/**
 * الحصول على عنوان URL للصورة المحسنة من Supabase (مع معلمة إصدار)
 * @param bucketName اسم المجلد (bucket) في Supabase Storage
 * @param filePath مسار الملف داخل المجلد
 * @param supabaseUrl عنوان URL الأساسي لـ Supabase (اختياري، يستخدم القيمة من متغيرات البيئة افتراضيًا)
 * @returns عنوان URL محسّن للصورة
 */
export function getOptimizedImageUrl(
  bucketName: string,
  filePath: string,
  supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co'
): string {
  if (!bucketName || !filePath) {
    console.warn('getOptimizedImageUrl: bucketName and filePath are required');
    return '';
  }
  
  // تنظيف المسار (إزالة السلاش في البداية إذا وجدت)
  const cleanedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
  
  // بناء عنوان URL الأساسي
  const baseUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${cleanedPath}`;
  
  // إضافة معلمة الإصدار
  return addVersionToImageUrl(baseUrl);
}

/**
 * استخراج مجموعة الصور المحسنة (مع معلمات الإصدار) من مصفوفة من الروابط
 * @param urls مصفوفة من روابط الصور
 * @returns مصفوفة من روابط الصور المحسنة
 */
export function getOptimizedImageUrls(urls: string[]): string[] {
  if (!urls || !Array.isArray(urls)) return [];
  
  // إنشاء طابع زمني واحد لجميع الصور في المجموعة (للتناسق)
  const timestamp = Date.now();
  
  return urls.map(url => addVersionToImageUrl(url, timestamp));
}

/**
 * الحصول على هيدرز لتحسين التخزين المؤقت للصور
 * (يستخدم في API Routes أو في الرد من الخادم)
 */
export function getImageCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'public, max-age=31536000, immutable', // تخزين مؤقت لمدة سنة
    'CDN-Cache-Control': 'public, max-age=31536000, immutable',
    'Surrogate-Control': 'public, max-age=31536000, immutable',
  };
}

/**
 * تحويل رابط الصورة العادي إلى عنوان URL يستخدم مسار api/optimized-image
 * (مفيد لإضافة هيدرز التخزين المؤقت من جانب الخادم)
 * @param url رابط الصورة الأصلي من Supabase
 * @returns رابط يمر عبر API Route للحصول على هيدرز التخزين المؤقت
 */
export function getProxiedImageUrl(url: string): string {
  if (!url || !url.includes('supabase.co/storage')) return url;
  
  // تشفير عنوان URL الأصلي
  const encodedUrl = encodeURIComponent(url);
  
  // إنشاء عنوان URL للصورة المحسنة عبر API Route
  return `/api/optimized-image?url=${encodedUrl}`;
}

/**
 * وظائف مساعدة لمعالجة الصور
 */

/**
 * تحديد نوع الصورة من ملف أو بيانات
 * @param {File | string} fileOrBase64 ملف أو بيانات Base64
 * @returns {string} نوع الصورة (jpeg, png, gif, webp, etc.)
 */
export function getImageType(fileOrBase64: File | string): string {
  if (typeof fileOrBase64 === 'string') {
    // التحقق من البيانات المشفرة بترميز Base64
    if (fileOrBase64.startsWith('data:image/')) {
      const matches = fileOrBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
      if (matches && matches.length > 1) {
        return matches[1];
      }
    }
    // افتراض جيف كنوع افتراضي
    return 'jpeg';
  } else {
    // ملف عادي
    const type = fileOrBase64.type;
    const matches = type.match(/image\/([a-zA-Z0-9]+)/);
    if (matches && matches.length > 1) {
      return matches[1];
    }
    // افتراض jpeg كنوع افتراضي
    return 'jpeg';
  }
} 
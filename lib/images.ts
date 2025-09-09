import { supabase } from './supabase-client';
import { addVersionToImageUrl, getImageCacheHeaders } from './image-utils';

// الحصول على إعدادات الصور من Supabase
export async function getImageSettings() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'image_settings')
      .single();

    if (error) {
      console.error('Error fetching image settings:', error);
      // قيم افتراضية محسنة
      return {
        compression_quality: 65, // تقليل الجودة لتوفير البيانات
        max_width: 800, // تقليل العرض الأقصى
        cache_duration_seconds: 31536000
      };
    }

    // ضمان ضغط محسن
    const settings = data.value;
    settings.compression_quality = Math.min(settings.compression_quality || 65, 65);
    settings.max_width = Math.min(settings.max_width || 800, 800);
    
    return settings;
  } catch (error) {
    console.error('Error in getImageSettings:', error);
    // قيم افتراضية محسنة
    return {
      compression_quality: 65,
      max_width: 800,
      cache_duration_seconds: 31536000
    };
  }
}

// ضغط الصورة قبل الرفع لتقليل الحجم
export async function compressImage(file: File): Promise<File> {
  try {
    // الحصول على إعدادات الصور
    const settings = await getImageSettings();
    // تحويل محسن للجودة والعرض
    const quality = Math.min(settings.compression_quality || 65, 65) / 100;
    const maxWidth = Math.min(settings.max_width || 800, 800);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          // حساب الأبعاد الجديدة مع الحفاظ على نسبة العرض إلى الارتفاع
          let width = img.width;
          let height = img.height;
          
          // تحقق إذا كانت الصورة أعرض من الحد الأقصى
          if (width > maxWidth) {
            const ratio = maxWidth / width;
            width = maxWidth;
            height = height * ratio;
          }

          // إنشاء كانفاس للصورة المضغوطة
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          // رسم الصورة على الكانفاس بالأبعاد الجديدة
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // تحويل الكانفاس إلى blob بجودة مضغوطة
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }
              
              // إنشاء ملف جديد من البلوب
              const compressedFile = new File(
                [blob],
                file.name,
                { type: 'image/jpeg', lastModified: Date.now() }
              );
              
              // تسجيل محسن للضغط
              const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
              console.log(`Image compressed: ${file.size} -> ${compressedFile.size} bytes (${reduction}% reduction)`);
              
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => {
          reject(new Error('Error loading image'));
        };
      };
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
    });
  } catch (error) {
    console.error('Error compressing image, using original:', error);
    return file;
  }
}

// رفع الصورة إلى Supabase Storage مع تعيين Cache-Control header
export async function uploadProductImage(fileOrBase64: File | string | null, productId: string): Promise<string> {
  try {
    // إذا لم يتم توفير ملف أو بيانات الصورة، إرجاع سلسلة فارغة
    if (!fileOrBase64) {
      console.log('No image file or data provided');
      return '';
    }
    
    let compressedFile: File;
    
    // التعامل مع ملف الصورة أو بيانات base64
    if (typeof fileOrBase64 === 'string') {
      // التحقق مما إذا كانت الصورة بالفعل URL لصورة موجودة في Supabase
      if (fileOrBase64.includes('supabase.co/storage')) {
        console.log('Image is already in Supabase:', fileOrBase64);
        // إضافة معلمة الإصدار للتأكد من تحديث الكاش
        return addVersionToImageUrl(fileOrBase64);
      }
      
      // التحقق مما إذا كانت القيمة هي "لا توجد صورة"
      if (fileOrBase64 === 'لا توجد صورة') {
        console.log('No image indicator provided');
        return '';
      }
      
      // تحويل بيانات base64 إلى ملف
      if (fileOrBase64.startsWith('data:image')) {
        // استخراج نوع الصورة وبياناتها
        const matches = fileOrBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid base64 image format');
        }
        
        const type = matches[1];
        const data = atob(matches[2]);
        const buffer = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          buffer[i] = data.charCodeAt(i);
        }
        
        // إنشاء Blob من البيانات
        const blob = new Blob([buffer], { type });
        compressedFile = new File([blob], `${productId}_image.${type.split('/')[1]}`, { type });
        
        // ضغط الصورة بعد تحويلها
        compressedFile = await compressImage(compressedFile);
      } else {
        console.log('Not a valid base64 or Supabase URL:', fileOrBase64.substring(0, 30) + '...');
        return '';
      }
    } else {
      // ضغط ملف الصورة المرفق
      compressedFile = await compressImage(fileOrBase64);
    }
    
    // إنشاء اسم فريد للملف باستخدام معرف المنتج وطابع الوقت
    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `${productId}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;
    
    // الحصول على مدة الـ cache من الإعدادات
    const settings = await getImageSettings();
    
    // الحصول على هيدرز التخزين المؤقت المحسنة
    const cacheControlHeaders = getImageCacheHeaders();
    
    try {
      // التحقق من وجود الـ bucket قبل الرفع
      const { data: buckets, error: listBucketsError } = await supabase.storage
        .listBuckets();
        
      if (listBucketsError) {
        console.error('Error listing buckets:', listBucketsError);
        throw new Error(`تعذر الوصول إلى Storage: ${listBucketsError.message}`);
      }
      
      // التحقق إذا كان bucket "product-images" موجود
      const bucketExists = buckets.some(bucket => bucket.name === 'product-images');
      
      // إنشاء bucket إذا لم يكن موجودًا
      if (!bucketExists) {
        console.warn('"product-images" bucket does not exist, attempting to create it');
        const { error: createBucketError } = await supabase.storage
          .createBucket('product-images', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
          });
          
        if (createBucketError) {
          console.error('Error creating bucket:', createBucketError);
          throw new Error(`تعذر إنشاء bucket: ${createBucketError.message}`);
        }
      }
      
      // رفع الملف إلى Supabase Storage مع هيدرز كاش محسنة
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, compressedFile, {
          cacheControl: cacheControlHeaders['Cache-Control'],
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: true
        });
      
      if (error) {
        console.error('Error uploading image:', error);
        throw new Error(`فشل رفع الصورة: ${error.message}`);
      }
      
      // إنشاء رابط عام للصورة
      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);
      
      // إضافة معلمة الإصدار للرابط
      const versionedUrl = addVersionToImageUrl(publicUrl.publicUrl);
      
      console.log('Image uploaded successfully, public URL:', versionedUrl);
      return versionedUrl;
    } catch (uploadError) {
      console.error('Storage operation failed:', uploadError);
      
      // محاولة استخدام service role إذا كان الخطأ متعلقاً بالصلاحيات
      const error = uploadError as Error;
      if (error.message && (
          error.message.includes('permission') || 
          error.message.includes('access') || 
          error.message.includes('not authorized')
        )) {
        console.log('Attempting to use service role for upload');
        
        // هنا يمكن تنفيذ منطق للرفع باستخدام service role، مثل استدعاء Edge Function
        throw new Error('تعذر الوصول إلى التخزين: قد تحتاج إلى تكوين صلاحيات إضافية');
      } else {
        // إعادة رفع الخطأ للتعامل معه في واجهة المستخدم
        throw uploadError;
      }
    }
  } catch (error) {
    console.error('Error in uploadProductImage:', error);
    throw error;
  }
}

// حذف صورة منتج من Storage عند الحاجة
export async function deleteProductImage(imageUrl: string): Promise<void> {
  try {
    // استخراج اسم الملف من الرابط الكامل
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // حذف الملف من Storage
    const { error } = await supabase.storage
      .from('product-images')
      .remove([fileName]);
    
    if (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
    
    console.log('Image deleted successfully:', fileName);
  } catch (error) {
    console.error('Error in deleteProductImage:', error);
    throw error;
  }
}

// رفع صورة المنتج باستخدام API الخادم (أكثر أمانًا)
export async function uploadProductImageViaAPI(fileOrBase64: File | string | null, productId: string): Promise<string> {
  try {
    // إذا لم يتم توفير ملف أو بيانات الصورة، إرجاع سلسلة فارغة
    if (!fileOrBase64) {
      console.log('No image file or data provided');
      return '';
    }

    // تجهيز FormData لإرسال الملف
    const formData = new FormData();
    let file: File;

    // التعامل مع ملف الصورة أو بيانات base64
    if (typeof fileOrBase64 === 'string') {
      // التحقق مما إذا كانت الصورة بالفعل URL لصورة موجودة في Supabase
      if (fileOrBase64.includes('supabase.co/storage')) {
        console.log('Image is already in Supabase:', fileOrBase64);
        // إضافة معلمة الإصدار للتأكد من تحديث الكاش
        return addVersionToImageUrl(fileOrBase64);
      }

      // التحقق مما إذا كانت القيمة هي "لا توجد صورة"
      if (fileOrBase64 === 'لا توجد صورة') {
        console.log('No image indicator provided');
        return '';
      }

      // تحويل بيانات base64 إلى ملف
      if (fileOrBase64.startsWith('data:image')) {
        // استخراج نوع الصورة وبياناتها
        const matches = fileOrBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid base64 image format');
        }

        const type = matches[1];
        const base64Data = matches[2];
        const byteCharacters = atob(base64Data);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }

        const blob = new Blob(byteArrays, { type });
        file = new File([blob], `${productId}_image.${type.split('/')[1]}`, { type });
      } else {
        console.log('Not a valid base64 or Supabase URL');
        return '';
      }
    } else {
      // استخدام ملف الصورة المرفق مباشرة
      file = fileOrBase64;
    }

    // إضافة الملف إلى FormData
    formData.append('file', file);
    
    // إضافة مسار داخل البكت (باستخدام معرف المنتج)
    const fileExt = file.name.split('.').pop();
    const path = `${productId}_${Date.now()}.${fileExt}`;
    formData.append('path', path);

    console.log('Uploading image via API...');
    
    // إرسال الطلب إلى API الخادم
    const response = await fetch('/api/upload-product-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload image');
    }

    const result = await response.json();
    
    // إضافة معلمة الإصدار للرابط
    const versionedUrl = addVersionToImageUrl(result.url);
    console.log('Image uploaded successfully via API:', versionedUrl);
    
    return versionedUrl;
  } catch (error) {
    console.error('Error in uploadProductImageViaAPI:', error);
    throw error;
  }
}

// رفع صورة الفئة إلى Supabase Storage مع تعيين Cache-Control header
export async function uploadCategoryImage(fileOrBase64: File | string | null, categoryId: string = 'category'): Promise<string> {
  try {
    console.log('بدء رفع صورة الفئة، معرف الفئة:', categoryId);
    
    // إذا لم يتم توفير ملف أو بيانات الصورة، إرجاع سلسلة فارغة
    if (!fileOrBase64) {
      console.log('لم يتم توفير صورة');
      return '';
    }
    
    let file: File;
    
    // التعامل مع ملف الصورة أو بيانات base64
    if (typeof fileOrBase64 === 'string') {
      // التحقق مما إذا كانت الصورة بالفعل URL لصورة موجودة في Supabase
      if (fileOrBase64.includes('supabase.co/storage')) {
        console.log('الصورة موجودة بالفعل في Supabase:', fileOrBase64);
        // إضافة معلمة الإصدار للتأكد من تحديث الكاش
        return addVersionToImageUrl(fileOrBase64);
      }
      
      // تحويل بيانات base64 إلى ملف
      if (fileOrBase64.startsWith('data:image')) {
        console.log('تحويل بيانات base64 إلى ملف...');
        // استخراج نوع الصورة وبياناتها
        const matches = fileOrBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('تنسيق صورة base64 غير صالح');
        }
        
        const type = matches[1];
        const data = atob(matches[2]);
        const buffer = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          buffer[i] = data.charCodeAt(i);
        }
        
        // إنشاء Blob من البيانات
        const blob = new Blob([buffer], { type });
        file = new File([blob], `${categoryId}_image.${type.split('/')[1]}`, { type });
        
        // ضغط الصورة بعد تحويلها
        file = await compressImage(file);
      } else {
        console.log('ليست base64 صالحة أو URL من Supabase:', fileOrBase64.substring(0, 30) + '...');
        return '';
      }
    } else {
      console.log('ضغط ملف الصورة المرفق...');
      // ضغط ملف الصورة المرفق
      file = await compressImage(fileOrBase64);
    }
    
    // استخدام API endpoint الخادم لرفع الصورة باستخدام service role key
    console.log('استخدام API endpoint لرفع الصورة باستخدام service role key...');
    
    // تجهيز FormData لإرسال الملف
    const formData = new FormData();
    formData.append('file', file);
    formData.append('categoryId', categoryId);
    
    // إرسال الطلب إلى API endpoint
    const response = await fetch('/api/upload-category-image', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('خطأ في رفع الصورة عبر API:', errorData);
      
      // محاولة الرفع مباشرة كخطة بديلة
      console.log('محاولة الرفع مباشرة كخطة بديلة...');
      
      // استخدام bucket المنتجات كخيار بديل
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `category_${categoryId}_${Date.now()}.${fileExt}`;
      
      const { data: productData, error: productError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: true
        });
      
      if (productError) {
        console.error('فشلت المحاولة البديلة أيضًا:', productError);
        throw new Error(`فشل رفع الصورة: ${productError.message}`);
      }
      
      // الحصول على الرابط العام للصورة
      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      
      const versionedUrl = addVersionToImageUrl(publicUrl.publicUrl);
      console.log('تم رفع الصورة بنجاح إلى bucket بديل، رابط عام:', versionedUrl);
      return versionedUrl;
    }
    
    // استخراج بيانات الاستجابة
    const result = await response.json();
    console.log('تم رفع الصورة بنجاح باستخدام service role، رابط عام:', result.url);
    
    return result.url;
  } catch (error) {
    console.error('خطأ في uploadCategoryImage:', error);
    throw error;
  }
}

// دالة للتأكد من وجود bucket الفئات مع صلاحيات صحيحة
async function ensureCategoryImagesBucketWithPermissions(): Promise<void> {
  try {
    console.log('التأكد من وجود bucket الفئات مع صلاحيات صحيحة...');
    
    // الحصول على قائمة buckets
    const { data: buckets, error: listBucketsError } = await supabase.storage
      .listBuckets();
      
    if (listBucketsError) {
      console.error('خطأ في قائمة buckets:', listBucketsError);
      throw new Error(`تعذر الوصول إلى التخزين: ${listBucketsError.message}`);
    }
    
    // التحقق إذا كان bucket "category-images" موجود
    const categoryBucketExists = buckets.some(bucket => bucket.name === 'category-images');
    
    // إنشاء bucket إذا لم يكن موجودًا
    if (!categoryBucketExists) {
      console.log('إنشاء bucket جديد: category-images');
      const { error: createBucketError } = await supabase.storage
        .createBucket('category-images', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          corsConfigurations: [
            {
              allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
              allowedOrigins: ['*'],
              maxAgeSeconds: 31536000
            }
          ]
        });
        
      if (createBucketError) {
        console.error('خطأ في إنشاء bucket:', createBucketError);
        throw new Error(`تعذر إنشاء bucket: ${createBucketError.message}`);
      }
      
      console.log('تم إنشاء bucket category-images بنجاح');
    } else {
      // تحديث إعدادات البكت
      console.log('تحديث إعدادات bucket الفئات...');
      const { error: updateError } = await supabase.storage
        .from('category-images')
        .updateBucket({
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          corsConfigurations: [
            {
              allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
              allowedOrigins: ['*'],
              maxAgeSeconds: 31536000
            }
          ]
        });
        
      if (updateError) {
        console.error('خطأ في تحديث إعدادات البكت:', updateError);
      }
    }
    
    // إعادة ضبط سياسات RLS للبكت باستخدام SQL مباشرة
    console.log('إعادة ضبط سياسات RLS للبكت...');
    
    // حذف السياسات الموجودة أولاً
    const { error: deleteError } = await supabase.rpc('exec_sql', {
      query: `
        DELETE FROM storage.policies 
        WHERE bucket_id = 'category-images';
      `
    });
    
    if (deleteError) {
      console.error('خطأ في حذف السياسات الموجودة:', deleteError);
    }
    
    // إضافة سياسات جديدة
    const { error: insertError } = await supabase.rpc('exec_sql', {
      query: `
        INSERT INTO storage.policies (name, bucket_id, operation, definition)
        VALUES 
        ('Public SELECT for category-images', 'category-images', 'SELECT', '{}'),
        ('Public INSERT for category-images', 'category-images', 'INSERT', '{}'),
        ('Public UPDATE for category-images', 'category-images', 'UPDATE', '{}'),
        ('Public DELETE for category-images', 'category-images', 'DELETE', '{}');
      `
    });
    
    if (insertError) {
      console.error('خطأ في إضافة سياسات جديدة:', insertError);
    }
    
    console.log('تم التأكد من وجود bucket الفئات مع صلاحيات صحيحة');
  } catch (error) {
    console.error('خطأ في ensureCategoryImagesBucketWithPermissions:', error);
    throw error;
  }
}

// إضافة وظائف مساعدة لمعالجة الملفات إذا لم تكن موجودة بالفعل

// تحويل سلسلة base64 إلى ملف
export async function base64StringToFile(base64String: string, fileName: string): Promise<File> {
  console.log('تحويل نص base64 إلى ملف...');
  
  // التحقق مما إذا كانت البيانات بتنسيق base64 صالح
  if (base64String.startsWith('data:image')) {
    console.log('تنسيق صورة base64 صالح');
    // استخراج نوع الصورة وبياناتها
    const matches = base64String.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.error('صيغة صورة base64 غير صالحة');
      throw new Error('صيغة صورة base64 غير صالحة');
    }
    
    const type = matches[1];
    const base64Data = matches[2];
    const byteString = atob(base64Data);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    
    // إنشاء Blob وFile من البيانات
    const blob = new Blob([uint8Array], { type });
    const file = new File([blob], fileName, { type });
    
    // ضغط الملف الناتج
    return await compressImage(file);
  } else {
    console.error('تنسيق البيانات غير صالح، يجب أن يبدأ بـ data:image');
    throw new Error('تنسيق البيانات غير صالح');
  }
}

// الحصول على امتداد الملف
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop() || 'png' : 'png';
}

// إضافة معلمة الإصدار لعنوان URL
export function addVersionQueryToUrl(url: string): string {
  const versionParam = `v=${Date.now()}`;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${versionParam}`;
}

// التحقق من وجود وإنشاء bucket للفئات إذا لم يكن موجودًا
// تم دمج هذه الوظيفة مباشرة في uploadCategoryImage
// وأبقينا عليها هنا للتوافق مع الكود القديم إذا كان لا يزال يستخدمها

export async function ensureCategoryImagesBucket(): Promise<{success: boolean, message?: string}> {
  try {
    console.log('التحقق من وجود bucket للفئات... (ملاحظة: يفضل استخدام uploadCategoryImage مباشرة)');
    
    // الحصول على قائمة buckets
    const { data: buckets, error: listBucketsError } = await supabase.storage
      .listBuckets();
      
    if (listBucketsError) {
      console.error('خطأ في قائمة buckets:', listBucketsError);
      return { success: false, message: `تعذر الوصول إلى التخزين: ${listBucketsError.message}` };
    }
    
    // التحقق إذا كان bucket "category-images" موجود
    const categoryBucketExists = buckets.some(bucket => bucket.name === 'category-images');
    
    // إنشاء bucket إذا لم يكن موجودًا
    if (!categoryBucketExists) {
      console.log('إنشاء bucket جديد: category-images');
      const { error: createBucketError } = await supabase.storage
        .createBucket('category-images', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          corsConfigurations: [
            {
              allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
              allowedOrigins: ['*'],
              maxAgeSeconds: 31536000
            }
          ]
        });
        
      if (createBucketError) {
        console.error('خطأ في إنشاء bucket:', createBucketError);
        return { success: false, message: `تعذر إنشاء bucket: ${createBucketError.message}` };
      }
      
      console.log('تم إنشاء bucket category-images بنجاح');
      
      // تعيين سياسات الوصول للـ bucket
      try {
        console.log('تعيين سياسات الوصول للـ bucket...');
        const { error: policyError } = await supabase.storage
          .from('category-images')
          .updateBucketPolicy({
            name: 'allow-public-read-authenticated-write',
            definition: {
              statements: [
                {
                  effect: 'allow',
                  principal: { id: '*' },
                  actions: ['select'],
                  resources: ['category-images/*']
                },
                {
                  effect: 'allow',
                  principal: { type: 'authenticated' },
                  actions: ['select', 'insert', 'update', 'delete'],
                  resources: ['category-images/*']
                }
              ]
            }
          });
          
        if (policyError) {
          console.error('خطأ في تعيين سياسات الوصول:', policyError);
          return { success: true, message: 'تم إنشاء bucket ولكن فشل تعيين سياسات الوصول' };
        }
      } catch (policyError) {
        console.error('خطأ في تعيين سياسات الوصول:', policyError);
        return { success: true, message: 'تم إنشاء bucket ولكن فشل تعيين سياسات الوصول' };
      }
    } else {
      console.log('bucket category-images موجود بالفعل');
      
      // تحديث إعدادات الـ bucket
      try {
        console.log('تحديث إعدادات الـ bucket...');
        const { error: updateError } = await supabase.storage
          .from('category-images')
          .updateBucket({
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            corsConfigurations: [
              {
                allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
                allowedOrigins: ['*'],
                maxAgeSeconds: 31536000
              }
            ]
          });
          
        if (updateError) {
          console.error('خطأ في تحديث إعدادات الـ bucket:', updateError);
        }
        
        // تحديث سياسات الوصول
        const { error: policyError } = await supabase.storage
          .from('category-images')
          .updateBucketPolicy({
            name: 'allow-public-read-authenticated-write',
            definition: {
              statements: [
                {
                  effect: 'allow',
                  principal: { id: '*' },
                  actions: ['select'],
                  resources: ['category-images/*']
                },
                {
                  effect: 'allow',
                  principal: { type: 'authenticated' },
                  actions: ['select', 'insert', 'update', 'delete'],
                  resources: ['category-images/*']
                }
              ]
            }
          });
          
        if (policyError) {
          console.error('خطأ في تحديث سياسات الوصول:', policyError);
        }
      } catch (configError) {
        console.error('خطأ في تحديث إعدادات الـ bucket:', configError);
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('خطأ في التحقق من/إنشاء bucket:', error);
    return { success: false, message: error.message || 'خطأ غير معروف أثناء التحقق من bucket' };
  }
} 
import { supabase } from '@/lib/supabase';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const results: any = {};
    
    // 1. التحقق من وجود bucket الفئات
    console.log('التحقق من وجود bucket الفئات...');
    const { data: buckets, error: listBucketsError } = await supabase.storage
      .listBuckets();
      
    if (listBucketsError) {
      return res.status(500).json({ 
        success: false, 
        error: `خطأ في قائمة buckets: ${listBucketsError.message}` 
      });
    }
    
    const categoryBucketExists = buckets.some(bucket => bucket.name === 'category-images');
    results.bucketExists = categoryBucketExists;
    
    // 2. إنشاء أو تحديث bucket الفئات إذا لم يكن موجوداً
    if (!categoryBucketExists) {
      console.log('إنشاء bucket جديد للفئات...');
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
        return res.status(500).json({ 
          success: false, 
          error: `خطأ في إنشاء bucket: ${createBucketError.message}` 
        });
      }
      
      results.bucketCreated = true;
    }
    
    // 3. إعادة ضبط سياسات RLS للبكت باستخدام SQL مباشرة
    console.log('إعادة ضبط سياسات RLS للبكت...');
    
    // حذف السياسات الموجودة أولاً
    const { error: deleteError } = await supabase.rpc('exec_sql', {
      query: `
        DELETE FROM storage.policies 
        WHERE bucket_id = 'category-images';
      `
    });
    
    if (deleteError) {
      results.deleteError = `خطأ في حذف السياسات الموجودة: ${deleteError.message}`;
    } else {
      results.policiesDeleted = true;
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
      results.insertError = `خطأ في إضافة سياسات جديدة: ${insertError.message}`;
    } else {
      results.policiesInserted = true;
    }
    
    // 4. تعديل إعدادات البكت للتأكد من أنه عام
    console.log('تحديث إعدادات البكت للتأكد من أنه عام...');
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
      results.updateError = `خطأ في تحديث إعدادات البكت: ${updateError.message}`;
    } else {
      results.bucketUpdated = true;
    }
    
    // 5. محاولة رفع ملف اختباري
    console.log('محاولة رفع ملف اختباري...');
    
    // إنشاء ملف اختباري (1x1 بكسل أبيض)
    const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const byteString = atob(base64Data.split(',')[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    
    const blob = new Blob([uint8Array], { type: 'image/png' });
    const testFile = new File([blob], 'test-pixel.png', { type: 'image/png' });
    
    // رفع الملف الاختباري
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('category-images')
      .upload('test-pixel.png', testFile, {
        cacheControl: '3600',
        contentType: 'image/png',
        upsert: true
      });
      
    if (uploadError) {
      results.uploadError = `خطأ في رفع الملف الاختباري: ${uploadError.message}`;
    } else {
      // الحصول على الرابط العام
      const { data: urlData } = supabase.storage
        .from('category-images')
        .getPublicUrl('test-pixel.png');
        
      results.testUploadSuccess = true;
      results.testFileUrl = urlData.publicUrl;
    }
    
    // 6. التحقق من صلاحيات البكت
    console.log('التحقق من صلاحيات البكت...');
    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT * FROM storage.policies 
        WHERE bucket_id = 'category-images';
      `
    });
    
    if (policiesError) {
      results.policiesError = `خطأ في التحقق من صلاحيات البكت: ${policiesError.message}`;
    } else {
      results.policies = policies;
    }
    
    // إرجاع النتائج
    return res.status(200).json({
      success: true,
      message: 'تم إصلاح صلاحيات البكت بنجاح',
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error: any) {
    console.error('خطأ في إصلاح صلاحيات البكت:', error);
    return res.status(500).json({
      success: false,
      error: `خطأ غير متوقع: ${error.message}`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 
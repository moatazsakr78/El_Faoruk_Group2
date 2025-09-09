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
    
    // 2. إنشاء أو تحديث bucket الفئات
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
    } else {
      // تحديث إعدادات bucket موجود
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
        results.updateError = `خطأ في تحديث إعدادات bucket: ${updateError.message}`;
        // نستمر بالتنفيذ حتى لو فشل التحديث
      } else {
        results.bucketUpdated = true;
      }
    }
    
    // 3. تعيين سياسات الوصول للـ bucket
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
      results.policyError = `خطأ في تعيين سياسات الوصول: ${policyError.message}`;
      // نستمر بالتنفيذ حتى لو فشل تعيين السياسات
    } else {
      results.policyUpdated = true;
    }
    
    // 4. محاولة رفع ملف اختباري
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
    
    // 5. الحصول على قائمة الملفات في bucket الفئات
    console.log('الحصول على قائمة الملفات في bucket الفئات...');
    const { data: files, error: listFilesError } = await supabase.storage
      .from('category-images')
      .list();
      
    if (listFilesError) {
      results.listFilesError = `خطأ في قائمة الملفات: ${listFilesError.message}`;
    } else {
      results.files = files;
    }
    
    // إرجاع النتائج
    return res.status(200).json({
      success: true,
      message: 'تم إصلاح bucket الفئات بنجاح',
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error: any) {
    console.error('خطأ في إصلاح bucket الفئات:', error);
    return res.status(500).json({
      success: false,
      error: `خطأ غير متوقع: ${error.message}`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 
import { supabase } from '@/lib/supabase';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const results: any = {};
    
    // 1. التحقق من قائمة buckets
    console.log('التحقق من قائمة buckets...');
    const { data: buckets, error: listBucketsError } = await supabase.storage
      .listBuckets();
      
    if (listBucketsError) {
      results.bucketsError = `خطأ في قائمة buckets: ${listBucketsError.message}`;
    } else {
      results.buckets = buckets;
      
      // التحقق من وجود bucket الفئات
      const categoryBucketExists = buckets.some(bucket => bucket.name === 'category-images');
      results.categoryBucketExists = categoryBucketExists;
      
      // إنشاء bucket إذا لم يكن موجوداً
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
          results.createBucketError = `خطأ في إنشاء bucket: ${createBucketError.message}`;
        } else {
          results.bucketCreated = true;
          
          // تعيين سياسات الوصول للـ bucket الجديد
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
              results.policyError = `خطأ في تعيين سياسات الوصول: ${policyError.message}`;
            } else {
              results.policyCreated = true;
            }
          } catch (policyError: any) {
            results.policyError = `خطأ في تعيين سياسات الوصول: ${policyError.message}`;
          }
        }
      } else {
        // تحديث إعدادات الـ bucket الموجود
        console.log('تحديث إعدادات bucket الفئات...');
        try {
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
            results.updateBucketError = `خطأ في تحديث إعدادات الـ bucket: ${updateError.message}`;
          } else {
            results.bucketUpdated = true;
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
            results.updatePolicyError = `خطأ في تحديث سياسات الوصول: ${policyError.message}`;
          } else {
            results.policyUpdated = true;
          }
        } catch (configError: any) {
          results.configError = `خطأ في تحديث التكوين: ${configError.message}`;
        }
      }
    }
    
    // 2. إذا كان bucket موجود، التحقق من قائمة الملفات
    if (results.categoryBucketExists || results.bucketCreated) {
      console.log('الحصول على قائمة الملفات في bucket الفئات...');
      const { data: files, error: listFilesError } = await supabase.storage
        .from('category-images')
        .list();
        
      if (listFilesError) {
        results.listFilesError = `خطأ في قائمة الملفات: ${listFilesError.message}`;
      } else {
        results.files = files;
      }
      
      // الحصول على تفاصيل الـ bucket
      try {
        console.log('الحصول على تفاصيل bucket الفئات...');
        const { data: bucketDetails, error: detailsError } = await supabase.storage
          .getBucket('category-images');
          
        if (detailsError) {
          results.bucketDetailsError = `خطأ في الحصول على تفاصيل الـ bucket: ${detailsError.message}`;
        } else {
          results.bucketDetails = bucketDetails;
        }
      } catch (detailsError: any) {
        results.bucketDetailsError = `خطأ في الحصول على تفاصيل الـ bucket: ${detailsError.message}`;
      }
    }
    
    // 3. التحقق من صلاحيات التخزين
    console.log('التحقق من صلاحيات التخزين...');
    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT * FROM storage.policies 
        WHERE bucket_id IN ('category-images', 'product-images')
      `
    });
    
    if (policiesError) {
      results.policiesError = `خطأ في الحصول على صلاحيات التخزين: ${policiesError.message}`;
    } else {
      results.policies = policies;
    }
    
    // 4. محاولة رفع ملف اختباري صغير
    if (results.categoryBucketExists || results.bucketCreated) {
      try {
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
          
          // التحقق من إمكانية الوصول إلى الملف
          try {
            const checkResponse = await fetch(urlData.publicUrl, { method: 'HEAD' });
            results.testFileAccessible = checkResponse.ok;
            results.testFileStatus = checkResponse.status;
            results.testFileHeaders = Object.fromEntries(checkResponse.headers.entries());
          } catch (fetchError: any) {
            results.testFileAccessError = `خطأ في التحقق من إمكانية الوصول: ${fetchError.message}`;
          }
        }
      } catch (testError: any) {
        results.testError = `خطأ أثناء اختبار الرفع: ${testError.message}`;
      }
    }
    
    // إرجاع النتائج
    res.status(200).json({
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error: any) {
    res.status(500).json({
      error: `خطأ غير متوقع: ${error.message}`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 
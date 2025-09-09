import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { getImageCacheHeaders, addVersionToImageUrl } from '@/lib/image-utils';

// إنشاء عميل Supabase باستخدام service_role
// هذا الكود يعمل على الخادم فقط، لذا فهو آمن لاستخدام مفتاح service_role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzAwMDY4NiwiZXhwIjoyMDYyNTc2Njg2fQ.SJOutA0CisTdffLTDK5HcYY7vsCoDOZPsvdxGEQmUmg',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// تكوين لإستقبال ملفات كبيرة باستخدام الصيغة الجديدة
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // وقت أقصى للتنفيذ 60 ثانية

export async function POST(request: NextRequest) {
  try {
    // قراءة FormData من الطلب
    const formData = await request.formData();
    const file = formData.get('file') as File;
    let categoryId = formData.get('categoryId') as string;

    // التحقق من وجود الملف
    if (!file) {
      return NextResponse.json(
        { error: 'لم يتم توفير ملف' },
        { status: 400 }
      );
    }

    // تحقق من نوع الملف (يجب أن يكون صورة)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'يجب أن يكون الملف صورة' },
        { status: 400 }
      );
    }

    // استخدام معرف فئة افتراضي إذا لم يتم توفيره
    if (!categoryId) {
      categoryId = 'category';
    }

    // إنشاء اسم فريد للملف
    const fileExt = file.name.split('.').pop();
    const fileName = `${categoryId}_${Date.now()}.${fileExt}`;

    try {
      // تحويل الملف إلى ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);

      // الحصول على هيدرز التخزين المؤقت المحسنة
      const cacheControlHeaders = getImageCacheHeaders();

      // التحقق من وجود bucket للفئات وإنشاؤه إذا لم يكن موجودًا
      const { data: buckets, error: listBucketsError } = await supabaseAdmin.storage
        .listBuckets();

      if (listBucketsError) {
        console.error('خطأ في قائمة buckets:', listBucketsError);
        return NextResponse.json(
          { error: `تعذر الوصول إلى التخزين: ${listBucketsError.message}` },
          { status: 500 }
        );
      }

      // التحقق إذا كان bucket "category-images" موجود
      const categoryBucketExists = buckets.some(bucket => bucket.name === 'category-images');

      // إنشاء bucket إذا لم يكن موجودًا
      if (!categoryBucketExists) {
        console.log('إنشاء bucket جديد: category-images');
        const { error: createBucketError } = await supabaseAdmin.storage
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
          return NextResponse.json(
            { error: `تعذر إنشاء bucket: ${createBucketError.message}` },
            { status: 500 }
          );
        }

        // إضافة سياسات RLS للبكت الجديد
        console.log('إضافة سياسات RLS للبكت الجديد...');
        try {
          await supabaseAdmin.rpc('exec_sql', {
            query: `
              INSERT INTO storage.policies (name, bucket_id, operation, definition)
              VALUES 
              ('Public SELECT for category-images', 'category-images', 'SELECT', '{}'),
              ('Public INSERT for category-images', 'category-images', 'INSERT', '{}'),
              ('Public UPDATE for category-images', 'category-images', 'UPDATE', '{}'),
              ('Public DELETE for category-images', 'category-images', 'DELETE', '{}');
            `
          });
        } catch (policyError) {
          console.error('خطأ في إضافة سياسات RLS:', policyError);
          // نستمر بالتنفيذ حتى لو فشلت إضافة السياسات
        }
      }

      // رفع الملف إلى Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from('category-images')
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: true,
          cacheControl: cacheControlHeaders['Cache-Control'] // استخدام هيدر كاش محسن
        });

      if (error) {
        console.error('خطأ في رفع الصورة إلى Supabase Storage:', error);
        return NextResponse.json(
          { error: `خطأ في رفع الصورة: ${error.message}` },
          { status: 500 }
        );
      }

      // الحصول على الرابط العام للصورة
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('category-images')
        .getPublicUrl(fileName);

      // إضافة معلمة الإصدار إلى الرابط
      const versionedUrl = addVersionToImageUrl(publicUrlData.publicUrl);

      // إرجاع الرابط العام
      return NextResponse.json({
        url: versionedUrl,
        originalUrl: publicUrlData.publicUrl,
        path: fileName,
        success: true
      });
    } catch (error: any) {
      console.error('خطأ في معالجة الصورة:', error);
      return NextResponse.json(
        { error: `خطأ في معالجة الصورة: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('خطأ غير متوقع:', error);
    return NextResponse.json(
      { error: `خطأ غير متوقع: ${error.message}` },
      { status: 500 }
    );
  }
} 
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
    const type = formData.get('type') as string; // products أو categories

    // التحقق من وجود الملف
    if (!file || !type) {
      return NextResponse.json(
        { error: 'لم يتم توفير ملف أو نوع الصورة' },
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

    // إنشاء اسم فريد للملف
    const fileExt = file.name.split('.').pop();
    const fileName = `navigation_${type}_${uuidv4()}.${fileExt}`;

    try {
      // التحقق من وجود البكت settings-images أو إنشاؤه إذا لم يكن موجوداً
      const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
      if (bucketsError) {
        console.error('خطأ في قراءة قائمة البكتات:', bucketsError);
        return NextResponse.json(
          { error: `خطأ في قراءة قائمة البكتات: ${bucketsError.message}` },
          { status: 500 }
        );
      }

      // التحقق مما إذا كان البكت settings-images موجوداً
      const bucketExists = buckets.some(bucket => bucket.name === 'settings-images');
      
      // إنشاء البكت إذا لم يكن موجوداً
      if (!bucketExists) {
        console.log('إنشاء بكت settings-images...');
        const { error: createBucketError } = await supabaseAdmin.storage.createBucket('settings-images', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        });
        
        if (createBucketError) {
          console.error('خطأ في إنشاء البكت:', createBucketError);
          return NextResponse.json(
            { error: `خطأ في إنشاء البكت: ${createBucketError.message}` },
            { status: 500 }
          );
        }
        
        // إضافة سياسات على البكت
        try {
          await supabaseAdmin.rpc('exec_sql', {
            query: `
              -- إنشاء سياسة للسماح للجميع بقراءة الصور
              CREATE POLICY "إمكانية مشاهدة صور الإعدادات للجميع"
                ON storage.objects FOR SELECT
                USING (bucket_id = 'settings-images');
              
              -- إنشاء سياسة للسماح للمشرفين برفع وتعديل وحذف الصور
              CREATE POLICY "إدارة صور الإعدادات للمشرفين"
                ON storage.objects FOR ALL
                USING (
                  bucket_id = 'settings-images' AND
                  auth.role() = 'authenticated' AND
                  (auth.jwt() ->> 'is_admin')::boolean = true
                );
            `
          });
        } catch (policyError) {
          console.error('خطأ في إنشاء سياسات البكت (سنستمر على الرغم من ذلك):', policyError);
        }
      }
      
      // تحويل الملف إلى ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);

      // الحصول على هيدرز التخزين المؤقت المحسنة
      const cacheControlHeaders = getImageCacheHeaders();

      // رفع الملف إلى Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from('settings-images')
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: true,
          cacheControl: cacheControlHeaders['Cache-Control'] // استخدام هيدر كاش محسن
        });

      if (error) {
        console.error('خطأ في رفع الصورة:', error);
        return NextResponse.json(
          { error: `خطأ في رفع الصورة: ${error.message}` },
          { status: 500 }
        );
      }

      // الحصول على الرابط العام للصورة
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('settings-images')
        .getPublicUrl(fileName);

      // إضافة معلمة الإصدار إلى الرابط
      const versionedUrl = addVersionToImageUrl(publicUrlData.publicUrl);
      
      // تحديث قيمة الإعدادات في جدول settings
      const { data: currentSettings, error: getSettingsError } = await supabaseAdmin
        .from('settings')
        .select('*')
        .eq('key', 'navigation_images')
        .single();
        
      let updatedSettings = {};
      
      if (getSettingsError && getSettingsError.code !== 'PGSQL_ERROR') {
        console.error('خطأ في قراءة إعدادات الصور:', getSettingsError);
      }
      
      // تحديث الإعدادات
      if (currentSettings) {
        updatedSettings = { ...currentSettings.value };
      }
      
      // تحديث الصورة المناسبة
      updatedSettings[type] = versionedUrl;
      
      // حفظ الإعدادات
      const { error: updateSettingsError } = await supabaseAdmin
        .from('settings')
        .upsert({
          key: 'navigation_images',
          value: updatedSettings,
          updated_at: new Date().toISOString()
        });
        
      if (updateSettingsError) {
        console.error('خطأ في تحديث إعدادات الصور:', updateSettingsError);
      }

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
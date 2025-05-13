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
    let path = formData.get('path') as string;

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

    // إنشاء اسم فريد إذا لم يتم توفير مسار
    if (!path) {
      const fileExt = file.name.split('.').pop();
      path = `${Date.now()}_${uuidv4()}.${fileExt}`;
    }

    // ضغط وتحجيم الصورة قبل الرفع
    let fileToUpload = file;
    try {
      // تحويل الملف إلى ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);

      // الحصول على هيدرز التخزين المؤقت المحسنة
      const cacheControlHeaders = getImageCacheHeaders();

      // رفع الملف إلى Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from('product-images')
        .upload(path, fileBuffer, {
          contentType: file.type,
          upsert: true,
          cacheControl: cacheControlHeaders['Cache-Control'] // استخدام هيدر كاش محسن
        });

      if (error) {
        console.error('Error uploading to Supabase Storage:', error);
        return NextResponse.json(
          { error: `خطأ في رفع الصورة: ${error.message}` },
          { status: 500 }
        );
      }

      // الحصول على الرابط العام للصورة
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('product-images')
        .getPublicUrl(path);

      // ملاحظة: الـ bucket يجب أن يكون عاماً من خلال إعدادات Supabase
      // API setPublic لم تعد مدعومة، يجب تكوين الخصوصية من لوحة التحكم في Supabase

      // إضافة معلمة الإصدار إلى الرابط
      const versionedUrl = addVersionToImageUrl(publicUrlData.publicUrl);

      // إرجاع الرابط العام
      return NextResponse.json({
        url: versionedUrl,
        originalUrl: publicUrlData.publicUrl,
        path: path,
        success: true
      });
    } catch (error: any) {
      console.error('Error processing image:', error);
      return NextResponse.json(
        { error: `خطأ في معالجة الصورة: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: `خطأ غير متوقع: ${error.message}` },
      { status: 500 }
    );
  }
} 
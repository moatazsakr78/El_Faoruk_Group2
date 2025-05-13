// أداة لترحيل الصور من تنسيق Base64 إلى Supabase Storage
// استخدام: node migrate-images.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

// تكوين Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';
const supabase = createClient(supabaseUrl, supabaseKey);

// مجلد مؤقت للصور
const tempDir = path.join(__dirname, 'temp_images');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// دالة لتحويل قاعدة 64 إلى ملف
async function base64ToFile(base64String, productId) {
  // التحقق من أن النص هو قاعدة 64
  if (!base64String || !base64String.startsWith('data:image/')) {
    console.log(`ليس تنسيق قاعدة 64 صالح للمنتج ${productId}`);
    return null;
  }

  // استخراج نوع الملف والبيانات
  const matches = base64String.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    console.log(`تنسيق قاعدة 64 غير صالح للمنتج ${productId}`);
    return null;
  }

  const fileType = matches[1];
  const base64Data = matches[2];
  const fileName = `${productId}_${Date.now()}.${fileType}`;
  const filePath = path.join(tempDir, fileName);

  // كتابة الملف
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  
  return {
    path: filePath,
    name: fileName,
    type: fileType
  };
}

// دالة لرفع الصورة إلى Supabase Storage
async function uploadToStorage(filePath, fileName, fileType) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, fileBuffer, {
        contentType: `image/${fileType}`,
        cacheControl: 'public, max-age=31536000',
        upsert: true
      });
    
    if (error) {
      console.error('خطأ في رفع الصورة:', error);
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('خطأ غير متوقع في رفع الصورة:', error);
    return null;
  }
}

// تحديث منتج في قاعدة البيانات
async function updateProductImageUrl(productId, imageUrl) {
  try {
    const { error } = await supabase
      .from('products')
      .update({ image_url: imageUrl })
      .eq('id', productId);
    
    if (error) {
      console.error(`خطأ في تحديث المنتج ${productId}:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`خطأ غير متوقع في تحديث المنتج ${productId}:`, error);
    return false;
  }
}

// وظيفة رئيسية لترحيل الصور
async function migrateImages() {
  console.log('بدء ترحيل الصور من قاعدة 64 إلى Supabase Storage');
  
  try {
    // جلب جميع المنتجات التي لها صور بتنسيق قاعدة 64
    const { data: products, error } = await supabase
      .from('products')
      .select('id, image_url')
      .like('image_url', 'data:image/%');
    
    if (error) {
      console.error('خطأ في جلب المنتجات:', error);
      return;
    }
    
    console.log(`تم العثور على ${products.length} منتج لترحيله`);
    
    let successCount = 0;
    let failCount = 0;
    
    // معالجة كل منتج
    for (const product of products) {
      console.log(`معالجة المنتج ${product.id}...`);
      
      // تحويل قاعدة 64 إلى ملف
      const fileInfo = await base64ToFile(product.image_url, product.id);
      if (!fileInfo) {
        failCount++;
        continue;
      }
      
      // رفع الصورة إلى Supabase Storage
      const imageUrl = await uploadToStorage(fileInfo.path, fileInfo.name, fileInfo.type);
      if (!imageUrl) {
        failCount++;
        continue;
      }
      
      // تحديث المنتج بعنوان URL الجديد
      const updated = await updateProductImageUrl(product.id, imageUrl);
      
      if (updated) {
        successCount++;
        console.log(`تم ترحيل منتج ${product.id} بنجاح!`);
      } else {
        failCount++;
      }
      
      // حذف الملف المؤقت
      fs.unlinkSync(fileInfo.path);
    }
    
    console.log(`\nاكتمل الترحيل!`);
    console.log(`نجاح: ${successCount}`);
    console.log(`فشل: ${failCount}`);
    
  } catch (error) {
    console.error('خطأ غير متوقع:', error);
  } finally {
    // تنظيف المجلد المؤقت
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    }
  }
}

// تشغيل الترحيل
migrateImages()
  .then(() => {
    console.log('تمت عملية الترحيل');
    process.exit(0);
  })
  .catch(error => {
    console.error('فشلت عملية الترحيل:', error);
    process.exit(1);
  }); 
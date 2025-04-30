'use client';

import { useState, useRef } from 'react';
import { FiUpload, FiTrash, FiImage } from 'react-icons/fi';
import { OptimizedImg } from '@/components/ui/OptimizedImage';
import { addVersionToImageUrl } from '@/lib/image-utils';

interface ProductImageUploaderProps {
  productId: string;
  existingImageUrl?: string;
  onImageUpload: (imageUrl: string | null) => void;
}

export default function ProductImageUploader({
  productId,
  existingImageUrl,
  onImageUpload
}: ProductImageUploaderProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(existingImageUrl ? addVersionToImageUrl(existingImageUrl) : null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingImageUrl || null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // تحميل صورة جديدة
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      setError('يرجى تحميل ملف صورة صالح');
      return;
    }
    
    // التحقق من حجم الملف (الحد الأقصى 10 ميجابايت)
    if (file.size > 10 * 1024 * 1024) {
      setError('حجم الصورة كبير جدًا (الحد الأقصى: 10 ميجابايت)');
      return;
    }
    
    setError('');
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      // إنشاء معاينة محلية
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPreviewUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
      
      // إعداد FormData للرفع
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', `${productId}_${Date.now()}.${file.name.split('.').pop()}`);
      
      setUploadProgress(30);
      
      // رفع الصورة باستخدام API الخادم
      const response = await fetch('/api/upload-product-image', {
        method: 'POST',
        body: formData
      });
      
      setUploadProgress(70);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'فشل في رفع الصورة');
      }
      
      const result = await response.json();
      
      // تحديث الحالة ورابط الصورة
      setImageUrl(result.url);
      onImageUpload(result.url);
      
      setUploadProgress(100);
      
      // إعادة تعيين حالة التحميل بعد تأخير قصير
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setError(`حدث خطأ أثناء رفع الصورة: ${error.message || 'خطأ غير معروف'}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  
  // حذف الصورة
  const handleDeleteImage = async () => {
    if (!imageUrl) return;
    
    const confirmed = window.confirm('هل أنت متأكد من حذف هذه الصورة؟');
    if (!confirmed) return;
    
    setIsUploading(true);
    
    try {
      // لا نحذف الصورة من التخزين حاليًا، فقط نقوم بإزالتها من واجهة المستخدم
      // (يمكن إضافة حذف الصورة من Supabase Storage لاحقًا)
      
      // إعادة تعيين الحالة
      setImageUrl(null);
      setPreviewUrl(null);
      onImageUpload(null);
      
      // إعادة تعيين ملف الإدخال
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error deleting image:', error);
      setError(`حدث خطأ أثناء حذف الصورة: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        صورة المنتج
      </label>
      
      {/* عرض الصورة الحالية أو المعاينة إذا كانت موجودة */}
      {(imageUrl || previewUrl) && (
        <div className="relative mt-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 h-56 flex items-center justify-center">
          {/* استخدام OptimizedImg بدلاً من img العادي */}
          {imageUrl ? (
            <OptimizedImg 
              src={imageUrl} 
              alt="صورة المنتج" 
              className="max-h-full max-w-full object-contain"
              loading="lazy"
              onError={() => {
                setError('لا يمكن تحميل الصورة');
                setImageUrl(null);
                setPreviewUrl(null);
              }}
            />
          ) : previewUrl ? (
            <img 
              src={previewUrl} 
              alt="معاينة الصورة" 
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          ) : null}
          
          {!isUploading && (
            <button
              type="button"
              onClick={handleDeleteImage}
              className="absolute top-2 right-2 bg-white text-[#5D1F1F] p-1 rounded-full shadow hover:bg-gray-100 transition"
            >
              <FiTrash className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
      
      {/* شريط التقدم أثناء التحميل */}
      {isUploading && (
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary bg-primary-100">
                جاري التحميل
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold inline-block text-primary">
                {uploadProgress}%
              </span>
            </div>
          </div>
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary-200">
            <div
              style={{ width: `${uploadProgress}%` }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-300"
            ></div>
          </div>
        </div>
      )}
      
      {/* نموذج تحميل الصورة */}
      {!isUploading && (
        <div>
          <input
            type="file"
            id="product-image"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            disabled={isUploading}
            className="sr-only"
          />
          <label
            htmlFor="product-image"
            className={`cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium ${
              isUploading ? 'bg-gray-200 text-gray-500' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {isUploading ? (
              <div className="animate-spin -ml-1 mr-2 h-5 w-5 text-gray-400">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <FiUpload className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
            )}
            {imageUrl || previewUrl ? 'تغيير الصورة' : 'تحميل صورة'}
          </label>
        </div>
      )}
        
      {/* رسالة خطأ */}
      {error && (
        <p className="mt-2 text-sm text-[#5D1F1F]">
          {error}
        </p>
      )}
      
      {/* نصائح */}
      <p className="mt-2 text-xs text-gray-500">
        PNG، JPG أو WEBP. الحد الأقصى للحجم: 10 ميجابايت. سيتم ضغط الصورة تلقائيًا لتحسين الأداء.
      </p>
    </div>
  );
} 
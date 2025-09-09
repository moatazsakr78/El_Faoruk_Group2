'use client';

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductGrid from '../products/ProductGrid';
import { supabase } from '@/lib/supabase-client';
import { Category } from '@/types';
import { OptimizedImg } from '@/components/ui/OptimizedImage';
import LazyImage from '@/components/ui/LazyImage';
import { FiImage, FiShoppingBag, FiGrid, FiEdit, FiList, FiTag, FiCamera, FiSearch } from 'react-icons/fi';
import { useAuth } from '@/components/AuthProvider';
import { v4 as uuidv4 } from 'uuid';

export default function ProductsAndCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState('products');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentEditImage, setCurrentEditImage] = useState<'products' | 'categories' | null>(null);
  const [navImages, setNavImages] = useState({
    products: '',
    categories: ''
  });
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const { isAdmin } = useAuth();
  
  // تحميل الفئات من Supabase
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name');
          
        if (error) {
          console.error('خطأ في تحميل الفئات:', error);
          return;
        }
        
        if (data) {
          setCategories(data);
        }
      } catch (error) {
        console.error('خطأ في تحميل الفئات:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadCategories();
    loadNavigationImages();
  }, []);

  // تحميل صور التنقل
  const loadNavigationImages = async () => {
    try {
      const { data: settings, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'navigation_images')
        .single();
        
      if (error && error.code !== 'PGSQL_ERROR') {
        console.error('خطأ في تحميل صور التنقل:', error);
        return;
      }
      
      if (settings && settings.value) {
        setNavImages(settings.value);
      }
    } catch (error) {
      console.error('خطأ في تحميل صور التنقل:', error);
    }
  };
  
  // تغيير التبويب النشط
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'products') {
      setSelectedCategory(null);
    }
  };
  
  // اختيار فئة
  const handleCategorySelect = (categoryId: string) => {
    console.log('Selected category ID:', categoryId);
    setSelectedCategory(categoryId);
    setActiveTab('products');
  };
  
  // تحديد الصورة المراد تغييرها وفتح مستعرض الملفات
  const handleEditImage = (type: 'products' | 'categories') => {
    setCurrentEditImage(type);
    fileInputRef.current?.click();
  };
  
  // معالجة تغيير الصورة
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentEditImage || !e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    setUploading(true);
    
    try {
      // استخدام API route لرفع الصورة باستخدام service role key
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', currentEditImage);
      
      const response = await fetch('/api/upload-settings-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'خطأ في رفع الصورة');
      }
      
      const imageData = await response.json();
      
      // تحديث الصور المحلية
      const updatedImages = { ...navImages };
      updatedImages[currentEditImage] = imageData.url;
      setNavImages(updatedImages);
      
      console.log('تم تحديث صورة التنقل بنجاح');
      
      // إعادة تعيين الحالة
      setCurrentEditImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('خطأ في تغيير الصورة:', error);
    } finally {
      setUploading(false);
    }
  };
  
  // معالجة البحث
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // نقوم بتغيير التبويب إلى المنتجات عند البحث
    setActiveTab('products');
  };

  // تنظيف حقل البحث
  const clearSearch = () => {
    setSearchQuery('');
    if (searchFormRef.current) {
      searchFormRef.current.reset();
    }
  };
  
  return (
    <div>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* زري التبويب المختفيان (للاستخدام البرمجي فقط) */}
        <div className="hidden">
          <TabsList>
            <TabsTrigger value="products">المنتجات</TabsTrigger>
            <TabsTrigger value="categories">الفئات</TabsTrigger>
          </TabsList>
        </div>
        
        {/* شريط البحث في الأعلى */}
        <div className="mb-8">
          <form ref={searchFormRef} onSubmit={handleSubmit} className="flex items-center max-w-md mx-auto">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 right-0 flex items-center justify-center w-12 bg-[#5D1F1F] rounded-r-lg">
                <FiSearch className="h-5 w-5 text-white" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن منتج..."
                className="w-full h-12 pr-12 pl-10 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-[#5D1F1F] focus:border-[#5D1F1F] outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-500"
                >
                  ×
                </button>
              )}
            </div>
          </form>
        </div>
        
        {/* مربعات التنقل المصورة - تعديل لعرضها بجانب بعض */}
        <div className="flex justify-center mb-8">
          <div className="flex flex-row gap-4 justify-center">
            {/* المنتجات */}
            <div 
              className={`relative cursor-pointer transition-all duration-300 rounded-lg overflow-hidden shadow-md ${activeTab === 'products' ? 'ring-2 ring-[#5D1F1F]' : 'hover:shadow-lg'}`}
              onClick={() => handleTabChange('products')}
              style={{ width: '180px', height: '200px' }}
            >
              {/* Image content */}
              <div 
                className="w-full h-full bg-amber-400 flex items-center justify-center"
                style={{
                  backgroundImage: navImages.products ? `url(${navImages.products})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {!navImages.products && <FiShoppingBag size={50} className="text-white" />}
              </div>
              
              {/* Header at the bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-[#5D1F1F] text-white p-2 text-center font-bold z-10">
                المنتجات
              </div>
              
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditImage('products');
                  }}
                  className="absolute top-2 right-2 bg-white bg-opacity-70 rounded-full p-1.5 hover:bg-opacity-100 shadow-md"
                  title="تغيير صورة المنتجات"
                  disabled={uploading}
                >
                  {uploading && currentEditImage === 'products' ? (
                    <span className="flex h-4 w-4 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
                    </span>
                  ) : (
                    <FiEdit size={18} className="text-gray-700" />
                  )}
                </button>
              )}
            </div>
            
            {/* الفئات */}
            <div 
              className={`relative cursor-pointer transition-all duration-300 rounded-lg overflow-hidden shadow-md ${activeTab === 'categories' ? 'ring-2 ring-[#5D1F1F]' : 'hover:shadow-lg'}`}
              onClick={() => handleTabChange('categories')}
              style={{ width: '180px', height: '200px' }}
            >
              {/* Image content */}
              <div 
                className="w-full h-full bg-amber-400 flex items-center justify-center"
                style={{
                  backgroundImage: navImages.categories ? `url(${navImages.categories})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {!navImages.categories && <FiTag size={50} className="text-white" />}
              </div>
              
              {/* Header at the bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-[#5D1F1F] text-white p-2 text-center font-bold z-10">
                الفئات
              </div>
              
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditImage('categories');
                  }}
                  className="absolute top-2 right-2 bg-white bg-opacity-70 rounded-full p-1.5 hover:bg-opacity-100 shadow-md"
                  title="تغيير صورة الفئات"
                  disabled={uploading}
                >
                  {uploading && currentEditImage === 'categories' ? (
                    <span className="flex h-4 w-4 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
                    </span>
                  ) : (
                    <FiEdit size={18} className="text-gray-700" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* مرجع إدخال الملف (مخفي) */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleImageChange}
        />
        
        <TabsContent value="products" className="mt-0">
          {selectedCategory ? (
            <div className="mb-4">
              <button
                onClick={() => setSelectedCategory(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm mb-4"
              >
                العودة إلى جميع المنتجات
              </button>
              <h3 className="text-xl font-bold mb-4">
                {categories.find(c => c.id === selectedCategory)?.name || 'الفئة المحددة'}
              </h3>
            </div>
          ) : null}
          
          <ProductGrid 
            filterByCategory={selectedCategory || undefined}
            searchEnabled={false}
            searchQuery={searchQuery}
          />
        </TabsContent>
        
        <TabsContent value="categories" className="mt-0">
          {loading ? (
            <div className="text-center py-8">جاري تحميل الفئات...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8">لا توجد فئات متاحة</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {categories.map((category) => (
                <div
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  style={{ borderTop: `4px solid ${category.color || '#cccccc'}` }}
                  data-id={category.id}
                >
                  <div className="h-48 relative">
                    {category.image ? (
                      <OptimizedImg
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <FiImage className="text-gray-400" size={40} />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg">{category.name}</h3>
                    {category.description && (
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">{category.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 
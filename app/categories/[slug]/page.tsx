'use client';

import ProductGrid from '@/components/products/ProductGrid';
import { getCategoryBySlug, createSlug, getProductsByCategoryFromSupabase } from '@/lib/data';
import { useEffect, useState } from 'react';
import { Category } from '@/types';
import { loadData } from '@/lib/localStorage';

type Props = {
  params: { slug: string };
};

export default function CategoryPage({ params }: Props) {
  const [category, setCategory] = useState<Category | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  useEffect(() => {
    const loadCategoryData = async () => {
      try {
        setLoading(true);
        
        // محاولة تحميل البيانات من IndexedDB أو localStorage
        let localCategories = [];
        const savedCategories = await loadData('categories');
        
        if (savedCategories !== null) {
          localCategories = savedCategories;
        } else {
          try {
            const categoriesFromLS = localStorage.getItem('categories');
            if (categoriesFromLS) {
              localCategories = JSON.parse(categoriesFromLS);
            }
          } catch (error) {
            console.error('Error parsing categories from localStorage:', error);
          }
        }
        
        // جلب بيانات الفئة
        const loadCategory = async () => {
          setLoading(true);
          try {
            // تخصيص لمعالجة "حجات خشب" - إذا كانت الصفحة الحالية
            if (params.slug === 'حجات-خشب' || params.slug.includes('خشب')) {
              console.log('حالة خاصة: قسم حجات خشب');
              
              // البحث عن القسم بطريقة مخصصة
              const savedCategories = await loadData('categories');
              let woodCategories = [];
              
              if (savedCategories !== null) {
                woodCategories = savedCategories;
              } else {
                try {
                  const categoriesFromLS = localStorage.getItem('categories');
                  if (categoriesFromLS) {
                    woodCategories = JSON.parse(categoriesFromLS);
                  }
                } catch (error) {
                  console.error('Error parsing categories from localStorage:', error);
                }
              }
              
              if (woodCategories && Array.isArray(woodCategories)) {
                // البحث عن أي قسم يحتوي على كلمة "خشب"
                const woodCategory = woodCategories.find(
                  (cat: any) => cat.name && cat.name.includes('خشب')
                );
                
                if (woodCategory) {
                  console.log('تم العثور على قسم الخشب:', woodCategory);
                  
                  // تنسيق الفئة للعرض
                  setCategory({
                    id: String(woodCategory.id),
                    name: woodCategory.name || 'حجات خشب',
                    slug: 'حجات-خشب',
                    image: woodCategory.imageUrl || woodCategory.image || '',
                    description: woodCategory.description || 'منتجات خشبية متنوعة'
                  });
                  
                  setLoading(false);
                  return;
                }
              }
            }
            
            // متابعة المنطق الطبيعي إذا لم تكن حالة خاصة بالخشب
            // محاولة استرجاع البيانات من التخزين الدائم
            const savedCategories = await loadData('categories');
            let localCategories = [];
            
            if (savedCategories !== null) {
              localCategories = savedCategories;
            } else {
              try {
                const categoriesFromLS = localStorage.getItem('categories');
                if (categoriesFromLS) {
                  localCategories = JSON.parse(categoriesFromLS);
                }
              } catch (error) {
                console.error('Error parsing categories from localStorage:', error);
              }
            }
            
            console.log(`Trying to find category with slug: "${params.slug}"`);
            console.log('Available categories:', localCategories.map((c: any) => ({ id: c.id, name: c.name })));
            
            if (localCategories && Array.isArray(localCategories)) {
              // تحويل هيكل البيانات من localStorage إلى الهيكل المتوقع في واجهة المستخدم
              const formattedCategories = localCategories.map((cat: any) => ({
                id: String(cat.id), // تحويل المعرف إلى سلسلة نصية
                name: cat.name,
                slug: createSlug(cat.name), // استخدام وظيفة createSlug المحسنة
                image: cat.imageUrl || cat.image || '',
                description: cat.description || 'وصف القسم'
              }));
              
              // طباعة قائمة الفئات المنسقة للتشخيص
              console.log('Formatted categories:', formattedCategories.map(c => ({ id: c.id, name: c.name, slug: c.slug })));
              
              // البحث عن الفئة بالـ slug
              const foundCategory = formattedCategories.find(
                (c: Category) => c.slug === params.slug
              );
              
              if (foundCategory) {
                console.log('Found category:', foundCategory);
                setCategory(foundCategory);
              } else {
                console.log('Category not found with exact slug match. Trying alternative methods...');
                
                // محاولة تصحيح الـ slug باستخدام createSlug
                const correctedSlug = createSlug(params.slug);
                console.log('Trying with corrected slug:', correctedSlug);
                
                const exactMatch = formattedCategories.find(
                  (c: Category) => c.slug === correctedSlug
                );
                
                if (exactMatch) {
                  console.log('Found match with corrected slug:', exactMatch);
                  setCategory(exactMatch);
                  return;
                }
                
                // محاولة العثور على تطابق تقريبي
                const approxMatch = formattedCategories.find(
                  (c: Category) => c.slug.includes(params.slug) || params.slug.includes(c.slug)
                );
                
                if (approxMatch) {
                  console.log('Found approximate match:', approxMatch);
                  setCategory(approxMatch);
                } else {
                  // محاولة مطابقة الاسم مباشرة
                  const nameMatch = formattedCategories.find(
                    (c: Category) => createSlug(c.name) === createSlug(params.slug)
                  );
                  
                  if (nameMatch) {
                    console.log('Found match by name:', nameMatch);
                    setCategory(nameMatch);
                  } else {
                    // محاولة أخيرة باستخدام الطريقة التقليدية
                    console.log('Trying traditional method as last resort');
                    const traditionalMatch = getCategoryBySlug(params.slug);
                    console.log('Traditional method result:', traditionalMatch);
                    if (traditionalMatch !== null) {
                      setCategory(traditionalMatch);
                    }
                  }
                }
              }
            } else {
              // استخدام الطريقة التقليدية كطريقة احتياطية
              console.log('No local categories found, using traditional method');
              const foundCategory = getCategoryBySlug(params.slug);
              if (foundCategory !== null) {
                setCategory(foundCategory);
              }
            }
          } catch (error) {
            console.error('Error loading category:', error);
            // استخدام الطريقة التقليدية كطريقة احتياطية
            const foundCategory = getCategoryBySlug(params.slug);
            if (foundCategory !== null) {
              setCategory(foundCategory);
            }
          } finally {
            setLoading(false);
          }
        };
        
        loadCategory();
        
        // الاستماع لتغييرات localStorage
        const handleStorageChange = () => {
          console.log('Storage changed, reloading category details');
          setLastUpdate(Date.now());
        };
        
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('customStorageChange', handleStorageChange as EventListener);
        
        return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('customStorageChange', handleStorageChange as EventListener);
        };
      } catch (error) {
        console.error('Error loading category:', error);
        // استخدام الطريقة التقليدية كطريقة احتياطية
        const foundCategory = getCategoryBySlug(params.slug);
        if (foundCategory !== null) {
          setCategory(foundCategory);
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadCategoryData();
  }, [params.slug, lastUpdate]);
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl font-bold mb-4">القسم غير موجود</h1>
        <p className="text-lg text-gray-600">
          عذراً، القسم الذي تبحث عنه غير موجود.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-4">{category.name}</h1>
      <p className="text-lg text-gray-600 mb-8">{category.description}</p>
      
      <div className="mb-4 text-sm bg-gray-100 p-2 rounded">
        <p>Debug - Category ID: {category.id}</p>
        <p>Debug - Category Name: {category.name}</p>
        <p>Debug - Category Slug: {category.slug}</p>
      </div>
      
      <ProductGrid 
        filterByCategory={category.id} 
        title={`منتجات ${category.name}`}
      />
    </div>
  );
} 
'use client';

import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiX, FiImage, FiRefreshCw } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { Category } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { OptimizedImg } from '@/components/ui/OptimizedImage';
import { uploadCategoryImage, compressImage } from '@/lib/images';
import { addVersionToImageUrl } from '@/lib/image-utils';
import Image from 'next/image';

// توليد لون عشوائي بتنسيق HEX
const generateRandomColor = () => {
  // توليد ألوان فاتحة للتباين مع النص الداكن
  const hue = Math.floor(Math.random() * 360); // درجة اللون من 0 إلى 360
  const saturation = 60 + Math.floor(Math.random() * 20); // نسبة التشبع من 60% إلى 80%
  const lightness = 50 + Math.floor(Math.random() * 20); // نسبة الإضاءة من 50% إلى 70%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// ضمان وجود جدول فئات في قاعدة البيانات
const ensureCategoriesTable = async () => {
  try {
    console.log('التحقق من وجود جدول الفئات...');
    
    const { error: checkError } = await supabase
      .from('categories')
      .select('id')
      .limit(1);
      
    if (checkError && checkError.code === '42P01') {
      console.log('جدول الفئات غير موجود، جاري إنشاؤه...');
      
      // SQL لإنشاء جدول الفئات
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS categories (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT,
          image TEXT,
          color TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      // محاولة إنشاء الجدول
      const { error: createError } = await supabase.rpc('exec_sql', { query: createTableSQL });
      
      if (createError) {
        console.error('خطأ في إنشاء جدول الفئات:', createError);
        return false;
      }
      
      console.log('تم إنشاء جدول الفئات بنجاح');
      return true;
    } else {
      // التحقق من وجود عمود color في الجدول
      console.log('التحقق من وجود عمود اللون في جدول الفئات...');
      const { data: columnExists, error: checkColumnError } = await supabase.rpc('exec_sql', {
        query: `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'categories'
            AND column_name = 'color'
          ) AS column_exists;
        `
      });
      
      if (checkColumnError) {
        console.error('خطأ في التحقق من وجود عمود اللون:', checkColumnError);
        return false;
      }
      
      if (!columnExists[0]?.column_exists) {
        console.log('عمود اللون غير موجود، جاري إضافته...');
        const { error: alterError } = await supabase.rpc('exec_sql', {
          query: `ALTER TABLE categories ADD COLUMN color TEXT;`
        });
        
        if (alterError) {
          console.error('خطأ في إضافة عمود اللون:', alterError);
          return false;
        }
        
        console.log('تم إضافة عمود اللون بنجاح');
      } else {
        console.log('عمود اللون موجود بالفعل');
      }
    }
    
    return true;
  } catch (error) {
    console.error('خطأ في التحقق من جدول الفئات:', error);
    return false;
  }
};

export default function AdminCategories() {
  console.log('تحميل صفحة الفئات...');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const realtimeSubscription = useRef<{ subscription: any } | null>(null);
  
  // بيانات الفئة الجديدة
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySlug, setNewCategorySlug] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryImage, setNewCategoryImage] = useState<File | null>(null);
  const [newCategoryImagePreview, setNewCategoryImagePreview] = useState('');
  
  // مراجع للحقول
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // عند تحميل الصفحة
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('تهيئة صفحة الفئات...');
        
        // 1. التأكد من وجود جدول الفئات
        const tableExists = await ensureCategoriesTable();
        if (!tableExists) {
          throw new Error('فشل في إنشاء جدول الفئات');
        }
        
        // 2. تحميل البيانات
        await refreshCategories();
        
        console.log('تم تهيئة النظام بنجاح');
      } catch (error: any) {
        console.error('خطأ في تهيئة النظام:', error);
        setError(error.message || 'حدث خطأ في تهيئة صفحة الفئات');
      } finally {
        setLoading(false);
      }
    };
    
    initializeSystem();
  }, [refreshKey]);
  
  // عند تحميل الصفحة
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('تهيئة صفحة الفئات...');
        
        // 1. التأكد من وجود جدول الفئات
        const tableExists = await ensureCategoriesTable();
        if (!tableExists) {
          throw new Error('فشل في إنشاء جدول الفئات');
        }
        
        // 2. تحميل البيانات
        await refreshCategories();
        
        console.log('تم تهيئة النظام بنجاح');
      } catch (error: any) {
        console.error('خطأ في تهيئة النظام:', error);
        setError(error.message || 'حدث خطأ في تهيئة صفحة الفئات');
      } finally {
        setLoading(false);
      }
    };
    
    initializeSystem();
  }, [refreshKey]);
  
  // عرض سجل الفئات عند تغيرها
  useEffect(() => {
    console.log('تحديث حالة الفئات:', categories.length);
  }, [categories]);
  
  // جلب الفئات
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        console.log('بدء استرجاع الفئات من قاعدة البيانات...');
        
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('خطأ في استرجاع الفئات من قاعدة البيانات:', error);
          // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
          console.log('خطأ في قاعدة البيانات:', error.message);
          return;
        }
        
        console.log('تم استرجاع الفئات بنجاح، عدد الفئات:', data?.length);
        setCategories(data || []);
      } catch (error: any) {
        console.error('خطأ في استرجاع الفئات:', error);
        // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
        console.log('خطأ في قاعدة البيانات:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [refreshKey, supabase]);
  
  useEffect(() => {
    console.log('حالة الفئات الحالية:', categories);
  }, [categories]);
  
  // التحقق من وجود جدول الفئات وبنيته
  useEffect(() => {
    const checkCategoriesTable = async () => {
      try {
        console.log('التحقق من وجود جدول الفئات وبنيته...');
        
        // التحقق من وجود الجدول من خلال استعلام استرجاع سجل واحد
        const { error } = await supabase
          .from('categories')
          .select('id')
          .limit(1);
        
        if (error) {
          console.error('خطأ في التحقق من جدول الفئات:', error);
          if (error.code === '42P01') { // SQLSTATE 42P01: undefined_table
            // الجدول غير موجود، إنشاؤه
            await createCategoriesTable();
          } else {
            // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
            console.log('خطأ في قاعدة البيانات:', error.message);
          }
        } else {
          console.log('تم التحقق من وجود جدول الفئات بنجاح');
        }
      } catch (error: any) {
        console.error('خطأ في التحقق من جدول الفئات:', error);
      }
    };
    
    checkCategoriesTable();
  }, [supabase]);
  
  // إنشاء جدول الفئات إذا لم يكن موجودًا
  const createCategoriesTable = async () => {
    try {
      console.log('إنشاء جدول الفئات...');
      
      // إنشاء الجدول بشكل مباشر
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS categories (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          image TEXT,
          color TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      // محاولة إنشاء الجدول
      try {
        const { error } = await supabase.rpc('exec_sql', { query: createTableSQL });
        
        if (error) {
          console.error('خطأ في إنشاء جدول الفئات:', error);
          
          // محاولة بطريقة أخرى - فقط للتوضيح
          console.log('محاولة إنشاء الجدول بطريقة أخرى - راجع وحدة التحكم للمزيد من المعلومات');
          
          return false;
        }
        
        console.log('تم إنشاء جدول الفئات بنجاح');
        
        // التحقق من إنشاء الجدول
        const { error: checkError } = await supabase
          .from('categories')
          .select('id')
          .limit(1);
        
        if (checkError) {
          console.error('لا يزال هناك خطأ بعد إنشاء الجدول:', checkError);
          return false;
        }
        
        return true;
      } catch (error) {
        console.error('خطأ أثناء إنشاء جدول الفئات:', error);
        return false;
      }
    } catch (error) {
      console.error('خطأ غير متوقع أثناء إنشاء جدول الفئات:', error);
      return false;
    }
  };
  
  // توليد الاسم المختصر (slug) تلقائياً مع إضافة جزء عشوائي
  const generateSlug = (name: string): string => {
    // إنشاء الـ slug الأساسي من الاسم
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // إضافة رقم عشوائي إلى نهاية الـ slug
    const randomPart = Math.floor(Math.random() * 10000);
    
    return `${baseSlug}-${randomPart}`;
  };
  
  // معالجة تغيير اسم الفئة
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewCategoryName(name);
    // توليد الاسم المختصر تلقائياً
    const slug = generateSlug(name);
    setNewCategorySlug(slug);
  };
  
  // معالجة تغيير صورة الفئة
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewCategoryImage(file);
      
      // عرض معاينة للصورة
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setNewCategoryImagePreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  // فتح مربع حوار إضافة فئة جديدة
  const openAddDialog = () => {
    setNewCategoryName('');
    setNewCategoryImage(null);
    setNewCategoryImagePreview('');
    setIsAddDialogOpen(true);
  };
  
  // فتح مربع حوار تعديل فئة
  const openEditDialog = (category: Category) => {
    setSelectedCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryImagePreview(category.image || '');
    setIsEditDialogOpen(true);
  };
  
  // فتح مربع حوار حذف فئة
  const openDeleteDialog = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };
  
  // إغلاق مربع حوار الإضافة وإعادة تعيين الحقول
  const closeAddDialog = () => {
    setIsAddDialogOpen(false);
    setNewCategoryName('');
    setNewCategorySlug('');
    setNewCategoryDescription('');
    setNewCategoryImage(null);
    setNewCategoryImagePreview('');
  };
  
  // إغلاق مربع حوار التعديل وإعادة تعيين الحقول
  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setNewCategoryName('');
    setNewCategorySlug('');
    setNewCategoryDescription('');
    setNewCategoryImage(null);
    setNewCategoryImagePreview('');
  };

  // إغلاق مربع حوار الحذف
  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setSelectedCategory(null);
  };
  
  // إضافة فئة جديدة
  const addCategory = async () => {
    if (!newCategoryName.trim()) {
      // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
      console.log('خطأ: يرجى إدخال اسم الفئة');
      return;
    }
    
    try {
      // اعرض حالة التحميل
      setLoading(true);
      
      // إعادة تعيين رسالة الخطأ
      setError(null);
      
      console.log('بدء إضافة فئة جديدة:', newCategoryName);
      
      // توليد معرف فريد للفئة
      const categoryId = uuidv4();
      console.log('معرف الفئة الجديدة:', categoryId);
      
      // رفع الصورة إذا تم اختيارها
      let imageUrl = '';
      if (newCategoryImage) {
        console.log('رفع صورة الفئة...');
        
        try {
          // استخدام الدالة المحسنة لرفع الصور
          imageUrl = await uploadCategoryImage(newCategoryImage, categoryId);
          console.log('تم رفع الصورة بنجاح:', imageUrl);
        } catch (uploadError) {
          console.error('خطأ في رفع الصورة:', uploadError);
          // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
          console.log('تحذير: حدث خطأ في رفع الصورة، ستتم إضافة الفئة بدون صورة');
        }
      }
      
      // محاولة إضافة عمود اللون إذا لم يكن موجوداً
      try {
        // التحقق من وجود عمود اللون
        console.log('التحقق من وجود عمود اللون قبل إضافة الفئة...');
        await supabase.rpc('exec_sql', {
          query: `ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS color TEXT;`
        });
      } catch (columnError) {
        console.error('خطأ عند محاولة إضافة عمود اللون:', columnError);
      }
      
      // التأكد من عدم وجود slug مكرر
      const generatedSlug = generateSlug(newCategoryName);
      console.log('توليد slug فريد:', generatedSlug);
      
      // بيانات الفئة الجديدة - تحديد اللون بشكل صريح
      const categoryData = {
        id: categoryId,
        name: newCategoryName.trim(),
        slug: generatedSlug,
        image: imageUrl,
        color: generateRandomColor(),
        created_at: new Date().toISOString()
      };
      
      console.log('بيانات الفئة للإضافة:', categoryData);
      
      // التأكد من وجود الجدول
      await ensureCategoriesTable();
      
      // إضافة الفئة إلى قاعدة البيانات
      const { error: insertError } = await supabase
        .from('categories')
        .insert([categoryData]);
      
      if (insertError) {
        console.error('خطأ عند إضافة الفئة:', insertError);
        
        // محاولة إضافة الفئة بدون عمود اللون إذا فشلت الإضافة بسبب عمود اللون
        if (insertError.message && insertError.message.includes('color')) {
          console.log('محاولة إضافة الفئة بدون عمود اللون...');
          const { error: fallbackError } = await supabase
            .from('categories')
            .insert([{
              id: categoryId,
              name: newCategoryName.trim(),
              slug: `${generatedSlug}-${Date.now()}`, // إضافة طابع زمني إضافي في حالة الفشل
              image: imageUrl,
              created_at: new Date().toISOString()
            }]);
            
          if (fallbackError) {
            throw fallbackError;
          } else {
            console.log('تمت إضافة الفئة بنجاح (بدون لون)!');
          }
        } else if (insertError.message && insertError.message.includes('slug_key')) {
          // إعادة المحاولة بإضافة طابع زمني في حالة وجود slug مكرر
          console.log('slug مكرر، محاولة إنشاء slug جديد...');
          const newSlug = `${generatedSlug}-${Date.now()}`;
          
          const { error: retryError } = await supabase
            .from('categories')
            .insert([{
              ...categoryData,
              slug: newSlug
            }]);
            
          if (retryError) {
            throw retryError;
          } else {
            console.log('تمت إضافة الفئة بنجاح بعد إنشاء slug فريد!');
          }
        } else {
          throw insertError;
        }
      } else {
        // نجاح الإضافة
        console.log('تمت إضافة الفئة بنجاح!');
      }
      
      // إغلاق النافذة وإعادة تعيين البيانات
      closeAddDialog();
      
      // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
      console.log('تم بنجاح: تمت إضافة الفئة بنجاح');
    } catch (error: any) {
      console.error('خطأ في إضافة الفئة:', error);
      
      // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
      console.log('خطأ في إضافة الفئة:', error.message || 'حدث خطأ غير معروف');
      
      // تعيين رسالة الخطأ العامة
      setError(`خطأ في إضافة الفئة: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      // إعادة تعيين حالة التحميل
      setLoading(false);
    }
  };
  
  // تعديل فئة
  const editCategory = async () => {
    try {
      if (!selectedCategory) return;
      
      if (!newCategoryName.trim()) {
        // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
        console.log('خطأ: يرجى إدخال اسم الفئة');
        return;
      }
      
      setLoading(true);
      console.log('بدء تعديل الفئة:', selectedCategory.id);
      
      // رفع الصورة إذا تم اختيارها
      let imageUrl = selectedCategory.image || '';
      if (newCategoryImage) {
        console.log('محاولة تحديث صورة الفئة...');
        try {
          // استخدام الدالة المحسنة لرفع الصور
          const uploadedImageUrl = await uploadCategoryImage(newCategoryImage, selectedCategory.id);
          
          if (uploadedImageUrl) {
            imageUrl = uploadedImageUrl;
            console.log('تم رفع الصورة بنجاح:', imageUrl);
          } else {
            console.warn('لم يتم الحصول على رابط للصورة المرفوعة');
            // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
            console.log('تحذير: لم يتم رفع الصورة، سيتم تعديل الفئة بالصورة القديمة');
          }
        } catch (uploadError) {
          console.error('خطأ أثناء رفع الصورة:', uploadError);
          // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
          console.log('تحذير: فشل في رفع الصورة، سيتم تعديل الفئة بالصورة القديمة');
        }
      }
      
      // التحقق مما إذا كان الاسم قد تغير، وإذا كذلك، إنشاء slug جديد
      let updatedSlug = selectedCategory.slug;
      
      if (newCategoryName.trim() !== selectedCategory.name) {
        // إنشاء slug جديد فقط إذا تغير الاسم
        updatedSlug = generateSlug(newCategoryName);
        console.log('تغيير الاسم، توليد slug جديد:', updatedSlug);
      }
      
      // تحضير بيانات الفئة المحدثة
      const updatedCategory = {
        name: newCategoryName.trim(),
        slug: updatedSlug,
        image: imageUrl,
        updated_at: new Date().toISOString()
      };
      
      console.log('تحديث الفئة في قاعدة البيانات:', {
        id: selectedCategory.id,
        ...updatedCategory
      });
      
      // تحديث الفئة في قاعدة البيانات
      const { error: updateError } = await supabase
        .from('categories')
        .update(updatedCategory)
        .eq('id', selectedCategory.id);
      
      if (updateError) {
        console.error('خطأ في تحديث الفئة في قاعدة البيانات:', updateError);
        
        // إذا كان الخطأ متعلقاً بوجود slug مكرر
        if (updateError.message && updateError.message.includes('slug_key')) {
          console.log('slug مكرر، محاولة إنشاء slug جديد...');
          const newSlug = `${updatedSlug}-${Date.now()}`;
          
          const { error: retryError } = await supabase
            .from('categories')
            .update({
              ...updatedCategory,
              slug: newSlug
            })
            .eq('id', selectedCategory.id);
            
          if (retryError) {
            throw retryError;
          } else {
            console.log('تم تحديث الفئة بنجاح بعد إنشاء slug فريد!');
            // تحديث الفئة في واجهة المستخدم
            setCategories(prev => 
              prev.map(category => 
                category.id === selectedCategory.id 
                  ? {...category, ...updatedCategory, slug: newSlug} 
                  : category
              )
            );
          }
        } else {
          throw updateError;
        }
      } else {
        console.log('تم تحديث الفئة بنجاح!');
        // تحديث الفئة في واجهة المستخدم
        setCategories(prev => 
          prev.map(category => 
            category.id === selectedCategory.id 
              ? {...category, ...updatedCategory} 
              : category
          )
        );
      }
      
      // إغلاق نافذة التعديل
      closeEditDialog();
      
      // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
      console.log('تم بنجاح: تم تعديل الفئة بنجاح');
    } catch (error: any) {
      console.error('خطأ في تعديل الفئة:', error);
      // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
      console.log('خطأ في تعديل الفئة:', error.message || 'حدث خطأ غير معروف أثناء تعديل الفئة');
    } finally {
      setLoading(false);
    }
  };
  
  // حذف فئة
  const deleteCategory = async () => {
    try {
      if (!selectedCategory) return;
      
      setLoading(true);
      console.log('بدء حذف الفئة:', selectedCategory.id);
      
      // حذف الصورة من التخزين إذا كانت موجودة
      if (selectedCategory.image) {
        try {
          // استخراج اسم الملف من رابط الصورة
          const imageUrl = selectedCategory.image;
          const fileName = imageUrl.split('/').pop()?.split('?')[0];
          
          if (fileName) {
            console.log('محاولة حذف الصورة من التخزين:', fileName);
            
            const { error: deleteImageError } = await supabase.storage
              .from('category-images')
              .remove([fileName]);
              
            if (deleteImageError) {
              console.error('خطأ في حذف الصورة:', deleteImageError);
            } else {
              console.log('تم حذف الصورة بنجاح');
            }
          }
        } catch (imageError) {
          console.error('خطأ أثناء حذف الصورة:', imageError);
        }
      }
      
      // حذف الفئة من قاعدة البيانات
      console.log('حذف الفئة من قاعدة البيانات:', selectedCategory.id);
      
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', selectedCategory.id);
      
      if (deleteError) {
        console.error('خطأ في حذف الفئة من قاعدة البيانات:', deleteError);
        throw deleteError;
      }
      
      console.log('تم حذف الفئة بنجاح!');
      
      // تحديث حالة الفئات في الواجهة
      setCategories(prev => prev.filter(category => category.id !== selectedCategory.id));
      
      // إغلاق نافذة الحذف
      closeDeleteDialog();
      
      // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
      console.log('تم بنجاح: تم حذف الفئة بنجاح');
    } catch (error: any) {
      console.error('خطأ في حذف الفئة:', error);
      // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
      console.log('خطأ في حذف الفئة:', error.message || 'حدث خطأ غير معروف أثناء حذف الفئة');
    } finally {
      setLoading(false);
    }
  };
  
  // استرجاع الفئات من قاعدة البيانات
  const refreshCategories = async () => {
    try {
      setLoading(true);
      console.log('بدء استرجاع الفئات من قاعدة البيانات...');
      
      // محاولة استرجاع الفئات مع معالجة حالة عدم وجود الجدول
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('خطأ في استرجاع الفئات:', error);
          
          if (error.code === '42P01') { // خطأ عدم وجود الجدول
            console.log('جدول الفئات غير موجود');
            setCategories([]);
            return;
          }
          
          throw error;
        }
        
        console.log('تم استرجاع الفئات بنجاح، عدد الفئات:', data?.length);
        
        // تعيين القائمة فقط إذا كان الرد يحتوي على مصفوفة صالحة
        setCategories(data || []);
        
        // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
        console.log('تم بنجاح: تم تحديث الفئات');
      } catch (error: any) {
        console.error('خطأ في استعلام الفئات:', error);
        // تعيين مصفوفة فارغة في حالة الخطأ
        setCategories([]);
        
        // تم تعطيل رسائل toast لمنع ظهور التنبيهات غير المرغوب فيها
        console.log('خطأ: تعذر تحميل الفئات. يرجى التحقق من وحدة التحكم للتفاصيل.');
      }
    } catch (error: any) {
      console.error('خطأ في تحديث الفئات:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };
  
  // إعداد اشتراك Realtime لمراقبة التغييرات في جدول الفئات
  useEffect(() => {
    // إعداد اشتراك Realtime لمراقبة التغييرات في جدول الفئات
    const setupRealtimeSubscription = async () => {
      // إلغاء أي اشتراك سابق أولاً
      if (realtimeSubscription.current?.subscription) {
        supabase.removeChannel(realtimeSubscription.current.subscription);
      }

      // إنشاء اشتراك جديد
      const channel = supabase
        .channel('categories_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'categories' 
          }, 
          async (payload) => {
            console.log('تم استلام تغيير في الفئات من Realtime:', payload);
            
            // تحديث الفئات مباشرة بناءً على نوع الحدث
            if (payload.eventType === 'INSERT') {
              // إضافة الفئة الجديدة للقائمة
              const newCategory = payload.new as Category;
              setCategories(prevCategories => [newCategory, ...prevCategories]);
            } else if (payload.eventType === 'UPDATE') {
              // تحديث الفئة في القائمة
              const updatedCategory = payload.new as Category;
              setCategories(prevCategories => 
                prevCategories.map(category => 
                  category.id === updatedCategory.id ? updatedCategory : category
                )
              );
            } else if (payload.eventType === 'DELETE') {
              // حذف الفئة من القائمة
              const deletedCategory = payload.old as Category;
              setCategories(prevCategories => 
                prevCategories.filter(category => category.id !== deletedCategory.id)
              );
            }
          }
        )
        .subscribe((status) => {
          console.log('حالة اشتراك Realtime للفئات:', status);
          if (status === 'SUBSCRIBED') {
            console.log('تم إنشاء اشتراك Realtime للفئات بنجاح');
          }
        });

      // تخزين الاشتراك للاستخدام لاحقاً
      realtimeSubscription.current = { subscription: channel };
    };

    // إعداد اشتراك Realtime
    setupRealtimeSubscription();

    // تنظيف الاشتراك عند إلغاء تحميل المكون
    return () => {
      if (realtimeSubscription.current?.subscription) {
        supabase.removeChannel(realtimeSubscription.current.subscription);
      }
    };
  }, []);
  
  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold text-primary">إدارة الفئات</h1>
        <div className="flex gap-2">
          <Button onClick={() => refreshCategories()} variant="outline" size="sm" className="flex items-center">
            <FiRefreshCw className={`ml-2 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button onClick={openAddDialog} size="sm" className="flex items-center bg-primary hover:bg-primary/90">
            <FiPlus className="ml-2" />
            إضافة فئة جديدة
          </Button>
        </div>
      </div>
      
      <Card className="shadow-md border-0">
        <CardHeader className="bg-gray-50 rounded-t-lg">
          <CardTitle className="text-lg font-bold text-primary">قائمة الفئات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <Table className="border-collapse">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="w-24 text-center font-bold text-gray-700">الصورة</TableHead>
                  <TableHead className="text-right font-bold text-gray-700">الاسم</TableHead>
                  <TableHead className="w-28 text-center font-bold text-gray-700">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6">
                      <div className="flex flex-col items-center justify-center">
                        <FiRefreshCw className="animate-spin text-primary mb-2" size={24} />
                        <span>جاري التحميل...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <FiImage className="mb-2" size={32} />
                        <span>لا توجد فئات</span>
                        <Button 
                          onClick={openAddDialog} 
                          variant="link" 
                          className="mt-2 text-primary"
                        >
                          إضافة فئة جديدة
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category) => (
                    <TableRow key={category.id} className="border-b hover:bg-gray-50/50">
                      <TableCell className="text-center">
                        {category.image ? (
                          <div className="w-14 h-14 rounded-md overflow-hidden mx-auto border shadow-sm">
                            <img 
                              src={addVersionToImageUrl(category.image)}
                              alt={category.name} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error('خطأ في تحميل الصورة:', category.image);
                                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0yNCAxaDAtMjN2MTloMjN2LTE5em0tMSAxOGgtMjF2LTE3aDIxdjE3em0tMy0zLjc1di44MzVjMCAuMjI5LS4xODguNDE1LS40MTUuNDE1aC0xMi4xN2MtLjIyOCAwLS40MTUtLjE4Ni0uNDE1LS40MTV2LS44MzVjMC0uMjI5LjE4Ny0uNDE1LjQxNS0uNDE1aDEyLjE3Yy4yMjcgMCAuNDE1LjE4Ni40MTUuNDE1em0tNi41ODUtMTAuNjY1Yy0xLjEwMyAwLTIgLjg5Ny0yIDJzLjg5NyAyIDIgMiAyLS44OTcgMi0yLS44OTctMi0yLTJ6bS0uNTc5IDUuNzVjLTEuMTI1IDAtMi4wNDItLjkxNi0yLjA0Mi0yLjA0MnMuOTE3LTIuMDQxIDIuMDQyLTIuMDQxIDIuMDQxLjkxNSAyLjA0MSAyLjA0MS0uOTE2IDIuMDQyLTIuMDQxIDIuMDQyem0tNC42NzEtNS43NWMtMS4xMDMgMC0yIC44OTctMiAycy44OTcgMiAyIDIgMi0uODk3IDItMi0uODk3LTItMi0yem0tLjU3OSA1Ljc1Yy0xLjEyNSAwLTIuMDQxLS45MTYtMi4wNDEtMi4wNDJzLjkxNi0yLjA0MSAyLjA0MS0yLjA0MSAyLjA0MS45MTUgMi4wNDEgMi4wNDEtLjkxNiAyLjA0Mi0yLjA0MSAyLjA0MnoiLz48L3N2Zz4=';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 bg-gray-100 rounded-md flex items-center justify-center mx-auto border border-gray-200">
                            <FiImage className="text-gray-400" size={24} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{category.name}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-2 justify-center">
                          <Button 
                            onClick={() => openEditDialog(category)} 
                            variant="outline" 
                            size="sm"
                            className="h-9 w-9 p-0 border-gray-300 hover:bg-gray-100 hover:text-primary"
                            title="تعديل"
                          >
                            <FiEdit size={16} />
                          </Button>
                          <Button 
                            onClick={() => openDeleteDialog(category)} 
                            variant="outline" 
                            size="sm"
                            className="h-9 w-9 p-0 border-red-200 hover:bg-red-50 text-red-500 hover:text-red-600"
                            title="حذف"
                          >
                            <FiTrash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* مربع حوار إضافة فئة جديدة */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => !open && closeAddDialog()}>
        <DialogContent className="bg-white border-none sm:max-w-md p-6 rounded-lg shadow-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-xl font-bold text-primary">إضافة فئة جديدة</DialogTitle>
            <DialogDescription className="text-gray-500">
              أدخل المعلومات المطلوبة لإضافة فئة جديدة
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="categoryName" className="text-gray-700 font-medium">اسم الفئة</Label>
              <Input
                id="categoryName"
                placeholder="اسم الفئة"
                value={newCategoryName}
                onChange={handleNameChange}
                className="border-gray-300 focus:border-primary focus:ring-primary"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="categoryImage" className="text-gray-700 font-medium">صورة الفئة</Label>
              <div className="flex flex-col items-center gap-4">
                {newCategoryImagePreview ? (
                  <div className="relative w-40 h-40 mb-2">
                    <img
                      src={newCategoryImagePreview}
                      alt="معاينة"
                      className="w-full h-full object-cover rounded-md border shadow-sm"
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                      onClick={() => {
                        setNewCategoryImage(null);
                        setNewCategoryImagePreview('');
                      }}
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ) : (
                  <div 
                    className="w-40 h-40 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center mb-2 cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="text-center p-4">
                      <FiImage className="mx-auto text-gray-400 mb-2" size={32} />
                      <span className="text-sm text-gray-500">اضغط لإضافة صورة</span>
                      <p className="text-xs text-gray-400 mt-2">الحد الأقصى 5 ميجابايت</p>
                    </div>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  id="image"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-1 border-gray-300 hover:bg-gray-50 hover:text-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FiImage className="ml-2" />
                  اختر صورة
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end mt-4 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={closeAddDialog}
              className="w-28 border-gray-300"
            >
              إلغاء
            </Button>
            <Button 
              type="submit" 
              onClick={addCategory}
              disabled={loading}
              className="w-28 bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <span className="flex items-center">
                  <FiRefreshCw className="animate-spin ml-2" size={16} />
                  جاري الإضافة
                </span>
              ) : (
                <span className="flex items-center">
                  <FiPlus className="ml-2" size={16} />
                  إضافة
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* مربع حوار تعديل فئة */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="bg-white border-none sm:max-w-md p-6 rounded-lg shadow-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-xl font-bold text-primary">تعديل الفئة</DialogTitle>
            <DialogDescription className="text-gray-500">
              قم بتعديل معلومات الفئة
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editCategoryName" className="text-gray-700 font-medium">اسم الفئة</Label>
              <Input
                id="editCategoryName"
                placeholder="اسم الفئة"
                value={newCategoryName}
                onChange={handleNameChange}
                className="border-gray-300 focus:border-primary focus:ring-primary"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="editCategoryImage" className="text-gray-700 font-medium">صورة الفئة</Label>
              <div className="flex flex-col items-center gap-4">
                {newCategoryImagePreview ? (
                  <div className="relative w-40 h-40 mb-2">
                    <img
                      src={newCategoryImagePreview}
                      alt="معاينة"
                      className="w-full h-full object-cover rounded-md border shadow-sm"
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                      onClick={() => {
                        setNewCategoryImage(null);
                        setNewCategoryImagePreview(selectedCategory?.image || '');
                      }}
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ) : (
                  <div 
                    className="w-40 h-40 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center mb-2 cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="text-center p-4">
                      <FiImage className="mx-auto text-gray-400 mb-2" size={32} />
                      <span className="text-sm text-gray-500">اضغط لإضافة صورة</span>
                      <p className="text-xs text-gray-400 mt-2">الحد الأقصى 5 ميجابايت</p>
                    </div>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  id="editImage"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-1 border-gray-300 hover:bg-gray-50 hover:text-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FiImage className="ml-2" />
                  اختر صورة
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end mt-4 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={closeEditDialog}
              className="w-28 border-gray-300"
            >
              إلغاء
            </Button>
            <Button 
              type="submit" 
              onClick={editCategory}
              disabled={loading}
              className="w-28 bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <span className="flex items-center">
                  <FiRefreshCw className="animate-spin ml-2" size={16} />
                  جاري التحديث
                </span>
              ) : (
                <span className="flex items-center">
                  <FiEdit className="ml-2" size={16} />
                  حفظ
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* مربع حوار حذف فئة */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <DialogContent className="bg-white border-none sm:max-w-md p-6 rounded-lg shadow-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-xl font-bold text-red-600">حذف الفئة</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <div className="mb-5 flex flex-col items-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <FiTrash2 className="text-red-600" size={28} />
              </div>
              <h3 className="text-lg font-medium mb-2">هل أنت متأكد من رغبتك في الحذف؟</h3>
              <p className="mb-2 text-gray-600">
                أنت على وشك حذف فئة "{selectedCategory?.name}"
              </p>
              <p className="text-red-500 text-sm font-medium">هذا الإجراء لا يمكن التراجع عنه.</p>
            </div>
            
            {selectedCategory?.image && (
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-md overflow-hidden border">
                  <img 
                    src={addVersionToImageUrl(selectedCategory.image)}
                    alt={selectedCategory.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 justify-end mt-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteDialog}
              className="w-28 border-gray-300"
            >
              إلغاء
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              onClick={deleteCategory}
              disabled={loading}
              className="w-28"
            >
              {loading ? (
                <span className="flex items-center">
                  <FiRefreshCw className="animate-spin ml-2" size={16} />
                  جاري الحذف
                </span>
              ) : (
                <span className="flex items-center">
                  <FiTrash2 className="ml-2" size={16} />
                  حذف
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
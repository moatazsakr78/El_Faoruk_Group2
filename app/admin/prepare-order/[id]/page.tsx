'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FiArrowRight, FiPackage, FiCheck, FiCheckCircle, FiHome, FiEdit, FiX, FiTrash, FiMinus, FiPlus } from 'react-icons/fi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

// تعريف واجهات البيانات
interface Product {
  id: string;
  name: string;
  productCode: string;
  piecePrice: number;
  imageUrl: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  note?: string;
  is_prepared: boolean;
  product?: Product;
}

interface Order {
  id: string;
  user_id: string;
  created_at: string;
  total_amount?: number;
  status?: string;
  notes?: string;
  items: OrderItem[];
  user?: {
    id: string;
    email: string;
    username?: string;
  };
  in_preparation?: boolean;
}

// مكون Footer المضمن
const InlineFooter = () => {
  return (
    <div className="bg-[#5F5F5F] text-white py-6 px-4 text-center w-full mt-8 mb-16 md:mb-0 rounded-t-lg">
      <div className="container mx-auto">
        <p className="mb-2 text-lg">&copy; {new Date().getFullYear()} El Farouk Group. جميع الحقوق محفوظة.</p>
        <p className="text-sm text-gray-300">Developed by Moataz Sakr</p>
      </div>
    </div>
  );
};

export default function PrepareOrderPage({ params }: { params: { id: string } }) {
  const orderId = params.id;
  const router = useRouter();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingOrder, setCompletingOrder] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState<{ [key: string]: OrderItem[] }>({});
  const [editedNotes, setEditedNotes] = useState<{ [key: string]: string }>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // تحميل بيانات الطلب
  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
      
      // تحديث حالة الطلب إلى "قيد التحضير" عند تحميل الصفحة
      updateOrderPreparationStatus();
    }
  }, [orderId]);

  // تحديث حالة الطلب إلى "قيد التحضير"
  const updateOrderPreparationStatus = async () => {
    try {
      console.log(`Setting order ${orderId} to in_preparation=true`);
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          in_preparation: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (error) {
        console.error('Error updating order preparation status:', error);
      } else {
        console.log(`Successfully updated order ${orderId} preparation status`);
      }
    } catch (error) {
      console.error('Error updating order preparation status:', error);
    }
  };

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // الحصول على بيانات الطلب
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (orderError) {
        throw orderError;
      }

      // الحصول على عناصر الطلب
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      
      if (itemsError) {
        throw itemsError;
      }

      // الحصول على بيانات المستخدم
      let userData: any = null;
      try {
        const { data: userResult, error: userError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', orderData.user_id)
          .single();
        
        if (!userError && userResult) {
          userData = userResult;
        } else {
          // محاولة الحصول على البيانات من جدول المستخدمين
          console.log('Trying to get username via RPC');
          const { data: username, error } = await supabase.rpc('get_username_by_id', {
            user_id: orderData.user_id
          });
          
          if (!error && username) {
            userData = {
              id: orderData.user_id,
              username: username
            };
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }

      // تجميع البيانات للعرض
      const orderItems = orderItemsData.map(item => ({
        ...item,
        is_prepared: item.is_prepared === true
      }));

      // تحميل صور المنتجات وبياناتها
      const productIds = orderItems.map(item => item.product_id);
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);
      
      // ربط بيانات المنتجات مع عناصر الطلب
      const itemsWithProducts = orderItems.map(item => {
        const product = productsData?.find(p => p.id === item.product_id);
        return {
          ...item,
          product: product ? {
            id: product.id,
            name: product.name,
            productCode: product.product_code,
            piecePrice: product.price || product.piece_price || 0,
            imageUrl: product.image_url || product.imageUrl || ''
          } : undefined
        };
      });

      // تكوين كائن الطلب الكامل
      const completeOrder: Order = {
        ...orderData,
        items: itemsWithProducts,
        user: userData ? {
          id: userData.id,
          email: userData.email || '',
          username: userData.username || ''
        } : undefined
      };

      setOrder(completeOrder);
    } catch (error) {
      console.error('Error loading order details:', error);
      setError('حدث خطأ أثناء تحميل بيانات الطلب');
    } finally {
      setLoading(false);
    }
  };

  // تغيير حالة تحضير عنصر
  const handleToggleItemPrepared = async (itemId: string, isPrepared: boolean) => {
    if (!order) return;
    
    try {
      // تحديث حالة العنصر في قاعدة البيانات
      const { error } = await supabase
        .from('order_items')
        .update({ is_prepared: isPrepared })
        .eq('id', itemId);
      
      if (error) {
        console.error('Error updating item prepared status:', error);
        alert('حدث خطأ أثناء تحديث حالة التحضير');
        return;
      }
      
      // تحديث الحالة المحلية
      setOrder(prevOrder => {
        if (!prevOrder) return null;
        
        const updatedItems = prevOrder.items.map(item => {
          if (item.id === itemId) {
            return { ...item, is_prepared: isPrepared };
          }
          return item;
        });
        
        return { ...prevOrder, items: updatedItems };
      });
    } catch (error) {
      console.error('Error updating item prepared status:', error);
      alert('حدث خطأ غير متوقع أثناء تحديث حالة التحضير');
    }
  };

  // إكمال الطلب
  const handleCompleteOrder = async () => {
    if (!order || navigating) return;
    
    // التحقق من أن جميع العناصر تم تحضيرها
    const allItemsPrepared = order.items.every(item => item.is_prepared);
    
    if (!allItemsPrepared) {
      if (!confirm('لم يتم تحضير جميع العناصر بعد. هل أنت متأكد من إكمال الطلب؟')) {
        return;
      }
    }
    
    try {
      setCompletingOrder(true);
      
      // تحديث حالة الطلب إلى "مكتمل"
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'completed',
          in_preparation: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      if (error) {
        console.error('Error completing order:', error);
        alert('حدث خطأ أثناء إكمال الطلب');
        return;
      }
      
      alert('تم إكمال الطلب بنجاح!');
      
      // تعيين حالة الانتقال
      setNavigating(true);
      
      try {
        // إضافة علامة في localStorage للإشارة إلى أن الانتقال جاري
        localStorage.setItem('prepare_order_redirecting', 'true');
      } catch (error) {
        console.error('Error setting localStorage item:', error);
      }
      
      // استخدام setTimeout لضمان ظهور رسالة النجاح قبل الانتقال
      setTimeout(() => {
        window.location.replace('/admin/customer-orders');
      }, 100);
      
    } catch (error) {
      console.error('Error completing order:', error);
      alert('حدث خطأ غير متوقع أثناء إكمال الطلب');
      setNavigating(false);
    } finally {
      setCompletingOrder(false);
    }
  };

  // تعديل الطلب - وضع التعديل
  const handleEnterEditMode = () => {
    if (!order) return;
    
    // حفظ نسخة من عناصر الطلب للتعديل
    setEditedItems({
      [order.id]: [...order.items]
    });
    
    // حفظ ملاحظات الطلب
    setEditedNotes({
      [order.id]: order.notes || ''
    });
    
    setIsEditMode(true);
  };

  // إلغاء التعديل
  const handleCancelEdit = () => {
    if (confirm('هل أنت متأكد من إلغاء التعديل؟')) {
      setIsEditMode(false);
    }
  };

  // تغيير كمية عنصر
  const handleChangeQuantity = (itemId: string, change: number) => {
    if (!order) return;
    
    setEditedItems(prev => {
      const updatedItems = [...prev[order.id]];
      const itemIndex = updatedItems.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        const item = updatedItems[itemIndex];
        const newQuantity = Math.max(1, item.quantity + change); // الحد الأدنى 1
        
        // تحديث الكمية وإعادة حساب السعر الإجمالي
        updatedItems[itemIndex] = {
          ...item,
          quantity: newQuantity,
          total_price: item.unit_price * newQuantity
        };
      }
      
      return {
        ...prev,
        [order.id]: updatedItems
      };
    });
  };

  // إزالة منتج من الطلب
  const handleRemoveItem = (itemId: string) => {
    if (!order) return;
    
    if (confirm('هل أنت متأكد من حذف هذا المنتج من الطلب؟')) {
      setEditedItems(prev => {
        const updatedItems = prev[order.id].filter(item => item.id !== itemId);
        return {
          ...prev,
          [order.id]: updatedItems
        };
      });
    }
  };

  // حفظ التغييرات
  const handleSaveChanges = async () => {
    if (!order) return;
    
    try {
      setSavingOrder(true);
      
      const orderId = order.id;
      const editedOrderItems = editedItems[orderId];
      const orderNotes = editedNotes[orderId] || '';
      
      if (!editedOrderItems || editedOrderItems.length === 0) {
        alert('لا يمكن حفظ طلب بدون منتجات');
        return;
      }
      
      // حساب المبلغ الإجمالي الجديد
      const newTotal = editedOrderItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
      
      // تحديث عناصر الطلب
      for (const item of editedOrderItems) {
        // تحديث البيانات الحالية أو إضافة عناصر جديدة
        const { error: itemError } = await supabase
          .from('order_items')
          .upsert({
            id: item.id,
            order_id: orderId,
            product_id: item.product_id,
            product_name: item.product_name,
            product_code: item.product_code,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.unit_price * item.quantity,
            notes: item.notes || item.note || '',
            is_prepared: item.is_prepared || false
          });
        
        if (itemError) {
          throw new Error(`خطأ في تحديث عنصر: ${itemError.message}`);
        }
      }
      
      // حذف العناصر المحذوفة
      const currentItemIds = editedOrderItems.map(item => item.id);
      const originalItemIds = order.items.map(item => item.id);
      const deletedItemIds = originalItemIds.filter(id => !currentItemIds.includes(id));
      
      if (deletedItemIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .in('id', deletedItemIds);
        
        if (deleteError) {
          throw new Error(`خطأ في حذف العناصر: ${deleteError.message}`);
        }
      }
      
      // تحديث الطلب الرئيسي
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          total_amount: newTotal,
          notes: orderNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (orderUpdateError) {
        throw new Error(`خطأ في تحديث الطلب: ${orderUpdateError.message}`);
      }
      
      // تحديث البيانات المحلية
      setOrder({
        ...order,
        items: editedOrderItems,
        notes: orderNotes,
        total_amount: newTotal
      });
      
      // إغلاق وضع التعديل
      setIsEditMode(false);
      alert('تم حفظ التغييرات بنجاح');
      
    } catch (error) {
      console.error('Error saving changes:', error);
      alert(`حدث خطأ أثناء حفظ التغييرات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setSavingOrder(false);
    }
  };

  // تحسين عملية الانتقال وتجنب الشاشة البيضاء
  useEffect(() => {
    const preventUnload = (e: BeforeUnloadEvent) => {
      if (navigating) {
        delete e.returnValue;
        return;
      }
    };

    // إضافة مستمع لمنع إعادة التحميل غير المقصودة
    window.addEventListener('beforeunload', preventUnload);

    // إزالة المستمع عند تفكيك المكون
    return () => {
      window.removeEventListener('beforeunload', preventUnload);
    };
  }, [navigating]);

  // العودة إلى صفحة طلبات العملاء
  const handleGoBack = () => {
    if (navigating) return;
    
    // تعيين حالة الانتقال لمنع النقرات المتعددة
    setNavigating(true);
    
    try {
      // إضافة علامة في localStorage للإشارة إلى أن الانتقال جاري
      localStorage.setItem('prepare_order_redirecting', 'true');
    } catch (error) {
      console.error('Error setting localStorage item:', error);
    }
    
    // عرض التحميل لفترة قصيرة للتأكد من تحديث حالة واجهة المستخدم
    setTimeout(() => {
      try {
        // استخدام window.location.replace بدلاً من href للانتقال مع استبدال التاريخ
        window.location.replace('/admin/customer-orders');
      } catch (error) {
        console.error('Navigation error:', error);
        // محاولة احتياطية
        window.location.href = '/admin/customer-orders';
      }
    }, 100);
  };

  // تعديل الطلب
  const handleEditOrder = async () => {
    handleEnterEditMode();
  };

  // تنسيق التاريخ
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow p-4 pb-24">
          <div className="animate-pulse flex flex-col gap-4">
            <div className="h-10 bg-gray-200 rounded w-1/3"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-60 bg-gray-200 rounded"></div>
          </div>
          
          <InlineFooter />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow p-4 pb-24">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error || 'لم يتم العثور على الطلب'}</p>
            <Button onClick={handleGoBack} className="mt-4">
              <FiHome className="ml-2" />
              العودة إلى قائمة الطلبات
            </Button>
          </div>
          
          <InlineFooter />
        </div>
      </div>
    );
  }

  // حساب إجمالي العناصر المحضرة
  const preparedItemsCount = order.items.filter(item => item.is_prepared).length;
  const totalItemsCount = order.items.length;
  const preparationProgress = Math.round((preparedItemsCount / totalItemsCount) * 100);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-grow p-4 pb-24">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <Button 
            variant="outline" 
            onClick={handleGoBack}
            className="flex items-center gap-2"
            disabled={navigating}
          >
            {navigating ? (
              <>
                <span className="animate-spin h-4 w-4 mr-2 border-2 border-gray-500 rounded-full border-t-transparent"></span>
                جاري الانتقال...
              </>
            ) : (
              <>
                <FiArrowRight />
                العودة إلى قائمة الطلبات
              </>
            )}
          </Button>
          <h1 className="text-2xl font-bold text-center">تحضير الطلب</h1>
          
          {/* إضافة زر إكمال الطلب في الهيدر للوصول السريع */}
          {order.items.length > 0 && (
            <Button 
              className={`${order.items.every(item => item.is_prepared) ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`} 
              onClick={() => handleCompleteOrder()}
              disabled={completingOrder || navigating}
            >
              {completingOrder ? (
                <>
                  <span className="animate-spin h-4 w-4 mr-2 border-2 border-white rounded-full border-t-transparent"></span>
                  جاري الإكمال...
                </>
              ) : (
                <>
                  <FiCheckCircle className="ml-1" />
                  اتمام الطلب
                </>
              )}
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* معلومات الطلب والعميل */}
          <Card className="md:col-span-3">
            <CardHeader className="pb-2 bg-gray-50">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <CardTitle className="text-lg mb-1">
                    العميل: {order.user?.username || 'عميل'}
                  </CardTitle>
                  <CardDescription>
                    رقم الطلب: {order.id.substring(0, 8)}
                  </CardDescription>
                </div>
                <div className="text-sm text-gray-500 mt-2 md:mt-0">
                  {formatDate(order.created_at)}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6">
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">تقدم التحضير:</span>
                  <span className="font-medium">{preparedItemsCount} من {totalItemsCount} ({preparationProgress}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${preparationProgress}%` }}></div>
                </div>
              </div>
              
              {isEditMode ? (
                <div className="mt-4">
                  <label className="block mb-2 text-sm font-medium">ملاحظات على الطلب كامل:</label>
                  <textarea 
                    className="w-full p-2 border rounded-md"
                    rows={3}
                    placeholder="أضف ملاحظات على الطلب بالكامل..."
                    value={editedNotes[order.id] || ''}
                    onChange={(e) => setEditedNotes({
                      ...editedNotes,
                      [order.id]: e.target.value
                    })}
                  />
                </div>
              ) : order.notes ? (
                <div className="mt-4 p-3 bg-[rgb(227,223,223)] rounded-md border border-[rgb(207,203,203)]">
                  <span className="font-semibold block mb-1">ملاحظات الطلب:</span>
                  <p>{order.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
          
          {/* قائمة المنتجات للتحضير */}
          <div className="md:col-span-3">
            <h2 className="text-xl font-semibold mb-4">قائمة المنتجات للتحضير</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {order.items.map(item => (
                <Card key={item.id} className={`transition-all ${item.is_prepared ? 'border-green-500 bg-green-50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* صورة المنتج */}
                      <div className="relative w-full md:w-32 h-32 bg-gray-100 rounded-md overflow-hidden">
                        {item.product?.imageUrl ? (
                          <Image
                            src={item.product.imageUrl}
                            alt={item.product_name}
                            fill
                            className="object-contain"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400">
                            <FiPackage size={32} />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">{item.product_name}</h3>
                            <p className="text-sm text-gray-500">كود: {item.product_code}</p>
                          </div>
                          <div className="bg-gray-100 px-3 py-1 rounded-full">
                            {item.quantity} قطعة
                          </div>
                        </div>
                        
                        {/* معلومات السعر */}
                        <div className="flex justify-between text-sm mb-3">
                          <span>سعر القطعة: {item.unit_price?.toFixed(2) || '0.00'} جنيه</span>
                          <span className="font-semibold">الإجمالي: {item.total_price?.toFixed(2) || '0.00'} جنيه</span>
                        </div>
                        
                        {/* ملاحظات المنتج */}
                        {(item.notes || item.note) && (
                          <div className="bg-amber-50 p-2 rounded-md border border-amber-100 text-sm mb-3">
                            <span className="font-medium">ملاحظات: </span>
                            {item.notes || item.note}
                          </div>
                        )}
                        
                        {/* حالة التحضير */}
                        <div className="flex justify-end">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">تم التحضير</span>
                            <Checkbox 
                              id={`item-prepared-${item.id}`}
                              checked={item.is_prepared}
                              onCheckedChange={(checked) => handleToggleItemPrepared(item.id, checked === true)}
                              className="data-[state=checked]:bg-green-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* أزرار أسفل الصفحة */}
            <div className="mt-8 mb-8 flex justify-between items-center sticky bottom-0 bg-white p-4 border-t left-0 right-0 z-10">
              <Button 
                variant="outline" 
                onClick={handleGoBack}
                className="flex items-center gap-2"
                disabled={navigating}
              >
                {navigating ? (
                  <>
                    <span className="animate-spin h-4 w-4 mr-2 border-2 border-gray-500 rounded-full border-t-transparent"></span>
                    جاري الانتقال...
                  </>
                ) : (
                  <>
                    <FiArrowRight />
                    العودة
                  </>
                )}
              </Button>
              
              <Button 
                className={`${order.items.every(item => item.is_prepared) ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`} 
                onClick={handleCompleteOrder}
                disabled={completingOrder || navigating}
                size="lg"
              >
                {completingOrder ? (
                  <>
                    <span className="animate-spin h-4 w-4 mr-2 border-2 border-white rounded-full border-t-transparent"></span>
                    جاري الإكمال...
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="ml-2" />
                    اتمام الطلب
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
        
        <InlineFooter />
      </div>
    </div>
  );
} 
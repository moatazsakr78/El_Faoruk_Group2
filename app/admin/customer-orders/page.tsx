'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FiCheckCircle, FiEdit, FiTrash, FiCheck, FiMinus, FiPlus, FiX, FiPackage } from 'react-icons/fi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// Interface for product
interface Product {
  id: string;
  name: string;
  productCode: string;
  piecePrice: number;
  imageUrl: string;
}

// Interface for order item
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

// Interface for order with user info
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
    user_metadata?: {
      username?: string;
      full_name?: string;
      raw_user_meta_data?: {
        username?: string;
        full_name?: string;
      }
    };
    raw_user_meta_data?: {
      username?: string;
      full_name?: string;
      email?: string;
    };
  };
  allItemsPrepared?: boolean;
}

// Interface for user profile
interface UserProfile {
  id: string;
  username?: string;
  full_name?: string;
  email?: string;
}

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<{ [key: string]: boolean }>({});
  const [orderInEditMode, setOrderInEditMode] = useState<string | null>(null);
  const [editedItems, setEditedItems] = useState<{ [orderId: string]: OrderItem[] }>({});
  const [savingOrder, setSavingOrder] = useState<string | null>(null);
  const [countInterval, setCountInterval] = useState<NodeJS.Timeout | null>(null);
  const [countSpeed, setCountSpeed] = useState<number>(150);
  const [editedNotes, setEditedNotes] = useState<{ [orderId: string]: string }>({});
  const [loadingOrder, setLoadingOrder] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadOrders();
  }, []);

  // Cargar todos los pedidos con información del usuario
  const loadOrders = async () => {
    try {
      setLoading(true);
      
      // Obtener todos los pedidos
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (ordersError) {
        throw ordersError;
      }
      
      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Obtener todos los ítems de pedidos
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*');
      
      if (itemsError) {
        throw itemsError;
      }

      // Obtener todos los perfiles de usuarios
      const userIds = [...new Set(ordersData.map(order => order.user_id))];
      
      // Consultar directamente la tabla auth.users para obtener usernames
      let authUsers = [];
      try {
        // Intentar usar SQL directo para obtener información de auth.users
        const { data: sqlUsers, error: sqlError } = await supabase.rpc('get_auth_usernames', {
          user_ids: userIds
        });
        
        if (!sqlError && sqlUsers && sqlUsers.length > 0) {
          console.log('Got auth usernames via RPC:', sqlUsers);
          authUsers = sqlUsers;
        } else {
          console.log('Error or no results from get_auth_usernames:', sqlError);
          
          // Intentar obtener los usuarios directamente a través de la API de supabase-js
          const { data: directUsers, error: directError } = await supabase
            .from('auth.users')
            .select('id, email, raw_user_meta_data')
            .in('id', userIds);
            
          if (!directError && directUsers) {
            console.log('Got users directly:', directUsers);
            authUsers = directUsers;
          } else {
            console.log('Error getting direct users:', directError);
            
            // Último intento: consulta SQL sin filtros
            const { data: allAuthUsers, error: allAuthError } = await supabase.rpc('execute_sql', {
              sql_query: `SELECT id, email, raw_user_meta_data FROM auth.users WHERE id IN ('${userIds.join("','")}');`
            });
            
            if (!allAuthError && allAuthUsers) {
              console.log('Got all auth users via SQL:', allAuthUsers);
              authUsers = allAuthUsers;
            } else {
              console.log('Failed to get auth users via SQL:', allAuthError);
            }
          }
        }
      } catch (authError) {
        console.log('Exception getting auth users:', authError);
      }
      
      // Segunda opción: obtener los perfiles de la tabla profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
      
      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
      }

      // Mapear usuarios por ID combinando información de ambas fuentes
      const usersById: Record<string, any> = {};
      
      // Obtener los nombres de usuario directamente utilizando la función
      for (const userId of userIds) {
        try {
          const { data: username, error } = await supabase.rpc('get_username_by_id', {
            user_id: userId
          });
          
          if (!error && username) {
            console.log(`Direct username for ${userId}: ${username}`);
            // Crear usuario base con el username encontrado
            usersById[userId] = {
              id: userId,
              username: username,
              raw_user_meta_data: { username }
            };
          }
        } catch (error) {
          console.log(`Error getting direct username for ${userId}:`, error);
        }
      }
      
      // Primero agregamos la información de auth.users
      authUsers.forEach(user => {
        // Extraer username de raw_user_meta_data si está disponible
        const username = typeof user.raw_user_meta_data === 'object' 
          ? (user.raw_user_meta_data?.username || '') 
          : '';
        
        usersById[user.id] = {
          ...user,
          username: user.username || username
        };

        // Para debug: mostrar información extraída
        console.log(`User ${user.id}: extracted username = ${user.username || username}`);
      });
      
      // Luego agregamos o complementamos con información de profiles
      if (profilesData) {
        profilesData.forEach(profile => {
          if (usersById[profile.id]) {
            // Si ya existe el usuario, complementar su información
            usersById[profile.id] = {
              ...usersById[profile.id],
              ...profile,
              // Mantener username de auth.users si ya existe
              username: usersById[profile.id].username || profile.username || ''
            };
          } else {
            usersById[profile.id] = profile;
          }
        });
      }

      // Mostrar información completa para depuración
      console.log('Users mapped by ID:', Object.keys(usersById).map(id => ({
        id,
        username: usersById[id].username,
        email: usersById[id].email
      })));

      // Combinar datos para cada pedido
      const completedOrders = ordersData.map(order => {
        // Obtener ítems para este pedido
        const items = orderItemsData
          ? orderItemsData.filter(item => item.order_id === order.id).map(item => ({
              ...item,
              // Si is_prepared no existe, inicializarlo como false
              is_prepared: item.is_prepared !== undefined ? item.is_prepared : false
            }))
          : [];
        
        // Buscar el usuario
        const user = usersById[order.user_id];
        
        // Verificar si todos los ítems están preparados
        const allItemsPrepared = items.length > 0 && items.every(item => item.is_prepared);

        // Extraer username de raw_user_meta_data si es un objeto
        let rawUsername = '';
        let rawFullName = '';
        
        if (user?.raw_user_meta_data && typeof user.raw_user_meta_data === 'object') {
          rawUsername = user.raw_user_meta_data?.username || '';
          rawFullName = user.raw_user_meta_data?.full_name || '';
        } else if (typeof user?.raw_user_meta_data === 'string') {
          try {
            // Intentar analizar si es una cadena JSON
            const parsedData = JSON.parse(user.raw_user_meta_data);
            rawUsername = parsedData?.username || '';
            rawFullName = parsedData?.full_name || '';
          } catch (e) {
            console.log('Error parsing raw_user_meta_data string:', e);
          }
        }

        console.log(`Order ${order.id} for user ${order.user_id}: username=${user?.username || rawUsername}`);

        return {
          ...order,
          items,
          user: {
            id: order.user_id,
            email: user?.email || '',
            username: user?.username || rawUsername || '',
            user_metadata: {
              username: user?.username || rawUsername || '',
              full_name: user?.full_name || rawFullName || ''
            },
            raw_user_meta_data: user?.raw_user_meta_data || null
          },
          allItemsPrepared,
          notes: order.notes
        };
      });

      // Cargar información de los productos
      const productIds = new Set<string>();
      completedOrders.forEach(order => {
        order.items.forEach((item: OrderItem) => {
          if (item.product_id) {
            productIds.add(item.product_id);
          }
        });
      });

      if (productIds.size > 0) {
        // Obtener los datos de los productos
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .in('id', Array.from(productIds));
        
        if (productsError) {
          console.error('Error loading products:', productsError);
        }
        
        if (productsData && productsData.length > 0) {
          // Mapear productos por ID
          const productsById: Record<string, Product> = {};
          productsData.forEach(product => {
            productsById[product.id] = {
              id: product.id,
              name: product.name,
              productCode: product.product_code,
              piecePrice: product.price || product.piece_price || 0,
              imageUrl: product.image_url || product.imageUrl || ''
            };
          });
          
          // Añadir datos de productos a los ítems
          completedOrders.forEach(order => {
            order.items.forEach((item: OrderItem) => {
              if (item.product_id && productsById[item.product_id]) {
                item.product = productsById[item.product_id];
              }
            });
          });
        }
      }

      // Actualizar estado con los pedidos completos
      setOrders(completedOrders);

      // Inicializar el estado para los pedidos expandidos
      const initialExpandedState: { [key: string]: boolean } = {};
      completedOrders.forEach(order => {
        initialExpandedState[order.id] = true; // Todos los pedidos expandidos por defecto
      });
      setExpandedOrders(initialExpandedState);

    } catch (error) {
      console.error('Error loading orders:', error);
      setError('حدث خطأ أثناء تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  };

  // Manejar el cambio en el estado de preparación de un ítem
  const handleItemPreparedChange = async (orderId: string, itemId: string, isPrepared: boolean) => {
    try {
      // Primero verificamos si la columna is_prepared existe en la tabla
      const { data: columnInfo, error: columnError } = await supabase
        .from('order_items')
        .select('is_prepared')
        .limit(1);
      
      // Si hay un error porque la columna no existe, la añadimos
      if (columnError && columnError.message.includes("column \"is_prepared\" does not exist")) {
        // Intentamos añadir la columna is_prepared a la tabla order_items
        const { error: alterError } = await supabase.rpc('exec_sql', {
          sql_query: `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_prepared BOOLEAN DEFAULT false;`
        });
        
        if (alterError) {
          console.error('Error adding is_prepared column:', alterError);
          // Si no podemos añadir la columna, actualizamos solo el estado local
          setOrders(prevOrders => {
            return prevOrders.map(order => {
              if (order.id === orderId) {
                const updatedItems = order.items.map(item => {
                  if (item.id === itemId) {
                    return { ...item, is_prepared: isPrepared };
                  }
                  return item;
                });
                
                const allItemsPrepared = updatedItems.every(item => item.is_prepared);
                return { ...order, items: updatedItems, allItemsPrepared };
              }
              return order;
            });
          });
          return;
        }
      }
      
      // Actualizar en la base de datos
      const { error } = await supabase
        .from('order_items')
        .update({ is_prepared: isPrepared })
        .eq('id', itemId);
      
      if (error) throw error;
      
      // Actualizar estado local
      setOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.id === orderId) {
            const updatedItems = order.items.map(item => {
              if (item.id === itemId) {
                return { ...item, is_prepared: isPrepared };
              }
              return item;
            });
            
            // Verificar si todos los ítems están preparados
            const allItemsPrepared = updatedItems.every(item => item.is_prepared);
            
            return { ...order, items: updatedItems, allItemsPrepared };
          }
          return order;
        });
      });
    } catch (error) {
      console.error('Error updating item prepared status:', error);
      setError('حدث خطأ أثناء تحديث حالة التحضير');
    }
  };

  // Completar un pedido
  const handleCompleteOrder = async (orderId: string) => {
    try {
      if (!confirm('هل أنت متأكد من إكمال هذا الطلب؟ سيتم نقله إلى سجل العملاء.')) {
        return;
      }
      
      // Actualizar el estado del pedido a "completed"
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'completed',
          in_preparation: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (error) {
        console.error('Error completing order:', error);
        alert('حدث خطأ أثناء إكمال الطلب');
        return;
      }
      
      // Actualizar la lista de pedidos localmente
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
      
      alert('تم إكمال الطلب بنجاح! تم نقله إلى سجل العملاء.');
    } catch (error) {
      console.error('Error completing order:', error);
      alert('حدث خطأ غير متوقع أثناء إكمال الطلب');
    }
  };

  // Activar el modo de edición para un pedido
  const handleEnterEditMode = (orderId: string) => {
    console.log('Entering edit mode for order:', orderId);
    
    // Guardar el estado actual de los items del pedido para poder editarlos
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setEditedItems({
        ...editedItems,
        [orderId]: [...order.items] // Crear una copia de los items para editarlos
      });
      
      // Guardar las notas del pedido actual
      setEditedNotes({
        ...editedNotes,
        [orderId]: order.notes || ''
      });
      
      setOrderInEditMode(orderId);
    }
  };

  // Salir del modo de edición sin guardar cambios
  const handleCancelEdit = () => {
    setOrderInEditMode(null);
  };

  // Cambiar la cantidad de un item
  const handleChangeQuantity = (orderId: string, itemId: string, change: number) => {
    setEditedItems(prev => {
      const updatedItems = [...prev[orderId]];
      const itemIndex = updatedItems.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        const item = updatedItems[itemIndex];
        const newQuantity = Math.max(1, item.quantity + change); // Mínimo 1
        
        // Actualizar la cantidad y recalcular el precio total
        updatedItems[itemIndex] = {
          ...item,
          quantity: newQuantity,
          total_price: item.unit_price * newQuantity
        };
      }
      
      return {
        ...prev,
        [orderId]: updatedItems
      };
    });
  };

  // Eliminar un producto del pedido
  const handleRemoveItem = (orderId: string, itemId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج من الطلب؟')) {
      setEditedItems(prev => {
        const updatedItems = prev[orderId].filter(item => item.id !== itemId);
        return {
          ...prev,
          [orderId]: updatedItems
        };
      });
    }
  };

  // Guardar los cambios en la base de datos
  const handleSaveChanges = async (orderId: string) => {
    try {
      console.log('Saving changes for order:', orderId);
      setSavingOrder(orderId);
      
      const editedOrderItems = editedItems[orderId];
      const orderNotes = editedNotes[orderId] || '';
      
      if (!editedOrderItems || editedOrderItems.length === 0) {
        // Si se eliminaron todos los items, eliminar el pedido completo
        await handleDeleteOrder(orderId);
        return;
      }
      
      // Primer intento: Utilizar el endpoint de API para actualizar el pedido
      try {
        console.log('Attempting to save via API...');
        const response = await fetch('/api/admin/update-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId,
            items: editedOrderItems,
            notes: orderNotes
          }),
        });
        
        // Verificar si la respuesta tiene formato JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          
          if (!response.ok) {
            console.error('API error response:', result);
            throw new Error(result.error || 'Error al actualizar el pedido');
          }
          
          console.log('Update order API response:', result);
          
          // Actualizar el estado local
          updateLocalOrderState(orderId, editedOrderItems, orderNotes, result.total);
          return;
        } else {
          console.error('API returned non-JSON response:', await response.text());
          throw new Error('La API devolvió una respuesta no JSON');
        }
      } catch (apiError) {
        // Si la API falla, intentar actualizar directamente con Supabase
        console.error('API update failed, trying direct Supabase update:', apiError);
        
        // Mostrar mensaje de advertencia pero continuar
        console.warn('Usando método de actualización alternativo...');
        
        await updateOrderDirectly(orderId, editedOrderItems, orderNotes);
      }
      
    } catch (error) {
      console.error('Error saving changes:', error);
      alert(`حدث خطأ أثناء حفظ التغييرات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setSavingOrder(null);
    }
  };
  
  // Función auxiliar para actualizar el estado local después de guardar
  const updateLocalOrderState = (orderId: string, items: OrderItem[], notes: string, totalAmount?: number) => {
    // Actualizar el estado local
    setOrders(prevOrders => {
      return prevOrders.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            items: items,
            notes: notes,
            total_amount: totalAmount || items.reduce((sum, item) => sum + (item.total_price || 0), 0)
          };
        }
        return order;
      });
    });
    
    // Salir del modo de edición
    setOrderInEditMode(null);
    
    // Mostrar mensaje de éxito
    alert('تم حفظ التغييرات بنجاح');
    
    // Recargar los pedidos para asegurar consistencia
    loadOrders();
  };
  
  // Método alternativo para actualizar directamente con Supabase
  const updateOrderDirectly = async (orderId: string, orderItems: OrderItem[], notes: string) => {
    console.log('Updating order directly with Supabase...');
    
    try {
      // 1. Obtener los items actuales
      const { data: currentItems, error: fetchError } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', orderId);
        
      if (fetchError) throw new Error(`Error al obtener los items actuales: ${fetchError.message}`);
      
      // 2. Identificar items a eliminar
      const currentItemIds = currentItems?.map(item => item.id) || [];
      const updatedItemIds = orderItems.map(item => item.id).filter(Boolean);
      const itemsToDelete = currentItemIds.filter(id => !updatedItemIds.includes(id));
      
      // 3. Eliminar items que ya no están
      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .in('id', itemsToDelete);
          
        if (deleteError) throw new Error(`Error al eliminar items: ${deleteError.message}`);
      }
      
      // 4. Actualizar items existentes
      for (const item of orderItems) {
        if (!item.id) continue;
        
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            quantity: item.quantity,
            total_price: item.unit_price * item.quantity
          })
          .eq('id', item.id);
          
        if (updateError) throw new Error(`Error al actualizar item ${item.id}: ${updateError.message}`);
      }
      
      // 5. Calcular nuevo total
      const newTotal = orderItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      
      // 6. Actualizar orden principal
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          total_amount: newTotal,
          notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
        
      if (orderUpdateError) throw new Error(`Error al actualizar orden: ${orderUpdateError.message}`);
      
      // 7. Actualizar estado local
      updateLocalOrderState(orderId, orderItems, notes, newTotal);
      
    } catch (error) {
      console.error('Error in direct update:', error);
      throw error; // Re-lanzar para manejo en el método principal
    }
  };

  // Editar un pedido - Modificado para entrar en modo edición
  const handleEditOrder = async (orderId: string) => {
    handleEnterEditMode(orderId);
  };

  // Eliminar un pedido
  const handleDeleteOrder = async (orderId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الطلب؟')) {
      try {
        // Primero eliminar los ítems de pedido
        const { error: itemsError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);
        
        if (itemsError) throw itemsError;
        
        // Luego eliminar el pedido
        const { error: orderError } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId);
        
        if (orderError) throw orderError;
        
        // Actualizar estado local
        setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
        
      } catch (error) {
        console.error('Error deleting order:', error);
        setError('حدث خطأ أثناء حذف الطلب');
      }
    }
  };

  // Alternar la visualización expandida/colapsada de un pedido
  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Formato de fecha
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

  // Obtener nombre de usuario para mostrar
  const getUserDisplayName = (order: Order) => {
    // Primero registrar para depuración todos los posibles campos de nombre
    const debugInfo = {
      username: order.user?.username,
      metadataUsername: order.user?.user_metadata?.username,
      rawMetaUsername: order.user?.raw_user_meta_data?.username,
      email: order.user?.email
    };
    console.log(`User display options for ${order.user_id}:`, debugInfo);
    
    // 1. Priorizar el username directo desde auth.users
    if (order.user?.username && order.user.username.trim() !== '') {
      return order.user.username;
    }
    
    // 2. Intentar obtener el username desde raw_user_meta_data
    if (order.user?.raw_user_meta_data?.username && 
        order.user.raw_user_meta_data.username.trim() !== '') {
      return order.user.raw_user_meta_data.username;
    }
    
    // 3. Intentar obtener desde user_metadata.username
    if (order.user?.user_metadata?.username && 
        order.user.user_metadata.username.trim() !== '') {
      return order.user.user_metadata.username;
    }
    
    // 4. Usar el email como respaldo
    if (order.user?.email && order.user.email.trim() !== '') {
      return order.user.email.split('@')[0];
    }
    
    // 5. Como último recurso, mostrar el ID
    return `مستخدم #${order.user_id.substring(0, 6)}`;
  };

  // إضافة وظائف للعد المستمر
  const startContinuousCount = (orderId: string, itemId: string, change: number) => {
    // إيقاف أي عداد سابق
    if (countInterval) {
      clearInterval(countInterval);
    }
    
    // إنشاء عداد جديد
    const interval = setInterval(() => {
      handleChangeQuantity(orderId, itemId, change);
    }, countSpeed);
    
    setCountInterval(interval);
  };

  const stopContinuousCount = () => {
    if (countInterval) {
      clearInterval(countInterval);
      setCountInterval(null);
    }
  };

  // Function to navigate directly to preparation page
  const navigateToPreparation = (orderId: string) => {
    if (confirm('هل أنت متأكد أنك تريد الانتقال لوضع التحضير؟')) {
      try {
        // Set loading state
        setLoadingOrder(orderId);
        
        // Navigate directly to the preparation page using window.location for immediate navigation
        console.log(`Navigating directly to prepare-order/${orderId}`);
        
        // Use absolute URL to ensure clean navigation
        const baseUrl = window.location.origin;
        window.location.href = `${baseUrl}/admin/prepare-order/${orderId}`;
      } catch (error) {
        console.error('Navigation error:', error);
        setLoadingOrder(null);
      }
    }
  };

  const handleStartPreparation = async (orderId: string, username: string) => {
    if (confirm('هل أنت متأكد أنك تريد الانتقال لوضع التحضير؟')) {
      try {
        // Set loading state to prevent multiple clicks
        setLoadingOrder(orderId);
        console.log(`Starting preparation for order ${orderId}`);
        
        // Update order status in database
        const { error } = await supabase
          .from('orders')
          .update({ 
            in_preparation: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
        
        if (error) {
          console.error('Error updating order preparation status:', error);
          alert('حدث خطأ أثناء تحديث حالة الطلب');
          setLoadingOrder(null);
          return;
        }
        
        console.log(`Successfully updated order ${orderId} preparation status`);
        
        // Update local state
        setOrders(prevOrders => {
          return prevOrders.map(order => {
            if (order.id === orderId) {
              return { ...order, in_preparation: true };
            }
            return order;
          });
        });
        
        // Add a longer delay to ensure database update completes
        setTimeout(() => {
          console.log(`Navigating to prepare-order/${orderId}`);
          router.push(`/admin/prepare-order/${orderId}`);
        }, 500);
        
      } catch (error) {
        console.error('Error starting preparation:', error);
        alert('حدث خطأ أثناء بدء التحضير. يرجى المحاولة مرة أخرى.');
        setLoadingOrder(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow">
          <div className="flex justify-center items-center h-64">
            <div className="text-xl">جاري تحميل الطلبات...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
            <Button onClick={loadOrders} className="mt-2">إعادة المحاولة</Button>
          </div>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-grow">
          <div className="text-center p-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-xl mb-2">لا توجد طلبات</div>
                <p className="text-gray-500 mb-4">لم يقم العملاء بإجراء أي طلبات بعد</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">طلبات العملاء</h1>
      
      <div className="space-y-6 mb-8">
        {orders.map(order => (
          <Card key={order.id} className={`overflow-hidden transition-all ${order.allItemsPrepared ? 'border-green-500' : ''} ${orderInEditMode === order.id ? 'ring-2 ring-blue-400' : ''}`}>
            <CardHeader 
              className="cursor-pointer bg-gray-50 hover:bg-gray-100" 
              onClick={() => toggleOrderExpanded(order.id)}
            >
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">
                  {getUserDisplayName(order)}
                </CardTitle>
                <div className="text-sm text-gray-500 rtl:text-left ltr:text-right">
                  {formatDate(order.created_at)}
                </div>
              </div>
              <CardDescription>
                <div className="flex justify-between">
                  <span>رقم الطلب: {order.id.substring(0, 8)}</span>
                  <span className="font-medium">
                    {order.items.length} عدد الأصناف - 
                    {order.items.reduce((sum, item) => sum + (item.total_price || 0), 0).toFixed(2)} جنيه
                  </span>
                </div>
                {order.notes && (
                  <div className="mt-2 p-2 bg-[rgb(227,223,223)] rounded-md border border-[rgb(207,203,203)]">
                    <span className="font-semibold ml-1">ملاحظات الطلب:</span> {order.notes}
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            
            {expandedOrders[order.id] && (
              <CardContent className="pt-4">
                {/* Versión para escritorio */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-right">المنتج</th>
                        <th className="p-2 text-center">السعر</th>
                        <th className="p-2 text-center">الكمية</th>
                        <th className="p-2 text-center">الإجمالي</th>
                        <th className="p-2 text-center">ملاحظات</th>
                        <th className="p-2 text-center">تم التحضير</th>
                        {orderInEditMode === order.id && (
                          <th className="p-2 text-center">إجراءات</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(orderInEditMode === order.id ? editedItems[order.id] : order.items).map(item => (
                        <tr key={item.id} className={`border-b ${orderInEditMode === order.id ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}>
                          <td className="p-2">
                            <div className="flex items-center">
                              {item.product?.imageUrl && (
                                <div className="h-16 w-16 relative flex-shrink-0 ml-4">
                                  <Image
                                    src={item.product.imageUrl}
                                    alt={item.product_name}
                                    fill
                                    className="object-contain"
                                  />
                                </div>
                              )}
                              <div>
                                <div className="font-medium">{item.product_name}</div>
                                <div className="text-gray-500">كود: {item.product_code}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 text-center">{item.unit_price} جنيه</td>
                          <td className="p-2 text-center">
                            {orderInEditMode === order.id ? (
                              <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse">
                                <button 
                                  onClick={() => handleChangeQuantity(order.id, item.id, -1)}
                                  onMouseDown={() => startContinuousCount(order.id, item.id, -1)}
                                  onMouseUp={stopContinuousCount}
                                  onMouseLeave={stopContinuousCount}
                                  onTouchStart={() => startContinuousCount(order.id, item.id, -1)}
                                  onTouchEnd={stopContinuousCount}
                                  className="bg-gray-200 hover:bg-gray-300 rounded-full h-6 w-6 flex items-center justify-center transition-colors"
                                >
                                  <FiMinus size={14} />
                                </button>
                                <span className="mx-2 min-w-[20px] text-center font-medium">{item.quantity}</span>
                                <button 
                                  onClick={() => handleChangeQuantity(order.id, item.id, 1)}
                                  onMouseDown={() => startContinuousCount(order.id, item.id, 1)}
                                  onMouseUp={stopContinuousCount}
                                  onMouseLeave={stopContinuousCount}
                                  onTouchStart={() => startContinuousCount(order.id, item.id, 1)}
                                  onTouchEnd={stopContinuousCount}
                                  className="bg-gray-200 hover:bg-gray-300 rounded-full h-6 w-6 flex items-center justify-center transition-colors"
                                >
                                  <FiPlus size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="font-medium">{item.quantity}</div>
                            )}
                          </td>
                          <td className="p-2 text-center">{item.total_price} جنيه</td>
                          <td className="p-2 text-center">
                            {item.notes || item.note || '-'}
                          </td>
                          <td className="p-2 text-center">
                            <Checkbox 
                              id={`item-prepared-${item.id}`}
                              checked={item.is_prepared}
                              onCheckedChange={(checked) => 
                                handleItemPreparedChange(order.id, item.id, checked === true)
                              }
                              disabled={orderInEditMode === order.id}
                            />
                          </td>
                          {orderInEditMode === order.id && (
                            <td className="p-2 text-center">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-500"
                                onClick={() => handleRemoveItem(order.id, item.id)}
                              >
                                <FiTrash size={14} className="hover:text-red-700 transition-colors" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Versión para móvil */}
                <div className="md:hidden space-y-4">
                  {(orderInEditMode === order.id ? editedItems[order.id] : order.items).map(item => (
                    <div key={item.id} className={`${orderInEditMode === order.id ? 'bg-blue-50' : 'bg-gray-50'} rounded-lg p-4 mb-4 relative transition-colors`}>
                      <div className="flex items-center mb-3">
                        {item.product?.imageUrl && (
                          <div className="h-16 w-16 relative flex-shrink-0 ml-3">
                            <Image
                              src={item.product.imageUrl}
                              alt={item.product_name}
                              fill
                              className="object-contain"
                            />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-gray-500">كود: {item.product_code}</div>
                        </div>
                        
                        {orderInEditMode === order.id && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-500 absolute top-2 left-2 transition-colors hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveItem(order.id, item.id)}
                          >
                            <FiTrash size={14} className="hover:text-red-700 transition-colors" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-gray-500">السعر:</div>
                        <div className="font-medium">{item.unit_price} جنيه</div>
                        
                        <div className="text-gray-500">الكمية:</div>
                        {orderInEditMode === order.id ? (
                          <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse">
                            <button 
                              onClick={() => handleChangeQuantity(order.id, item.id, -1)}
                              onMouseDown={() => startContinuousCount(order.id, item.id, -1)}
                              onMouseUp={stopContinuousCount}
                              onMouseLeave={stopContinuousCount}
                              onTouchStart={() => startContinuousCount(order.id, item.id, -1)}
                              onTouchEnd={stopContinuousCount}
                              className="bg-gray-200 hover:bg-gray-300 rounded-full h-6 w-6 flex items-center justify-center transition-colors"
                            >
                              <FiMinus size={14} />
                            </button>
                            <span className="mx-2 min-w-[20px] text-center font-medium">{item.quantity}</span>
                            <button 
                              onClick={() => handleChangeQuantity(order.id, item.id, 1)}
                              onMouseDown={() => startContinuousCount(order.id, item.id, 1)}
                              onMouseUp={stopContinuousCount}
                              onMouseLeave={stopContinuousCount}
                              onTouchStart={() => startContinuousCount(order.id, item.id, 1)}
                              onTouchEnd={stopContinuousCount}
                              className="bg-gray-200 hover:bg-gray-300 rounded-full h-6 w-6 flex items-center justify-center transition-colors"
                            >
                              <FiPlus size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="font-medium">{item.quantity}</div>
                        )}
                        
                        <div className="text-gray-500">الإجمالي:</div>
                        <div className="font-medium">{item.total_price} جنيه</div>
                      </div>
                      
                      {(item.notes || item.note) && (
                        <div className="mb-3">
                          <div className="text-gray-500">ملاحظات:</div>
                          <div className="bg-white p-2 rounded border mt-1">
                            {item.notes || item.note}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center">
                        <div className="text-gray-500 ml-2">تم التحضير:</div>
                        <Checkbox 
                          id={`item-prepared-mobile-${item.id}`}
                          checked={item.is_prepared}
                          onCheckedChange={(checked) => 
                            handleItemPreparedChange(order.id, item.id, checked === true)
                          }
                          disabled={orderInEditMode === order.id}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between mt-4 pt-4 border-t">
                  {orderInEditMode === order.id ? (
                    /* عرض أزرار حفظ أو إلغاء عند التواجد في وضع التعديل */
                    <>
                      {/* إضافة حقل ملاحظات الطلب */}
                      <div className="w-full mb-4">
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
                      <div className="flex justify-end w-full space-x-2 rtl:space-x-reverse">
                        <Button 
                          variant="outline" 
                          onClick={handleCancelEdit}
                          className="border-gray-300 transition-colors hover:bg-gray-100"
                        >
                          <FiX className="ml-1" />
                          إلغاء
                        </Button>
                        
                        <Button 
                          onClick={() => handleSaveChanges(order.id)}
                          className="bg-green-600 hover:bg-green-700 transition-colors"
                          disabled={savingOrder === order.id}
                        >
                          {savingOrder === order.id ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              جاري الحفظ...
                            </span>
                          ) : (
                            <>
                              <FiCheck className="ml-1" />
                              تم
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    /* عرض أزرار عادية عندما لا نكون في وضع التعديل */
                    <>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditOrder(order.id)} className="transition-colors hover:bg-gray-100">
                          <FiEdit className="ml-1" />
                          تعديل
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-[#5D1F1F] text-white hover:bg-[#4a1919] transition-colors"
                          onClick={(e) => {
                            e.preventDefault();
                            navigateToPreparation(order.id);
                          }}
                          disabled={loadingOrder === order.id}
                          type="button"
                        >
                          {loadingOrder === order.id ? (
                            <>
                              <span className="animate-spin h-4 w-4 mr-2 border-2 border-white rounded-full border-t-transparent"></span>
                              جاري التحضير...
                            </>
                          ) : (
                            <>
                              <FiPackage className="ml-1" />
                              بدء التحضير
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {order.items.length > 0 && order.items.every(item => item.is_prepared) && (
                        <Button className="bg-green-600 hover:bg-green-700 transition-colors" onClick={() => handleCompleteOrder(order.id)}>
                          <FiCheckCircle className="ml-1" />
                          اتمام الطلب
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
} 
import { supabase } from './supabase-client';
import { Product } from '@/types';
import crypto from 'crypto';

// Interfaz para los items de la orden
export interface OrderItem {
  product_id: string;
  quantity: number;
  notes?: string;
  note?: string;  // Alternativa para note/notes
  id?: string;
  order_id?: string;
  is_prepared?: boolean;
  created_at?: string;
  product_name?: string;
  product_code?: string;
  unit_price?: number;
  total_price?: number;
}

// Interfaz para la orden
export interface Order {
  id?: string;
  user_id: string;
  created_at?: string;
  total_amount?: number;
  status?: string;
  notes?: string;
  items: OrderItem[];
}

// Interfaz para respuesta de orden completa
export interface CompleteOrder {
  id: string;
  user_id: string;
  created_at: string;
  order_items: OrderItem[];
}

/**
 * Verificar y crear las tablas necesarias si no existen
 * @returns Promise<boolean> indicando si las tablas están listas
 */
async function ensureTablesExist(): Promise<boolean> {
  try {
    console.log('Verificando si las tablas orders y order_items existen...');
    
    // Primero intentamos insertar en orders para ver si la tabla existe
    const { error: ordersTestError } = await supabase
      .from('orders')
      .select('id')
      .limit(1);
    
    // Si hay un error, la tabla probablemente no existe, así que la creamos
    if (ordersTestError && ordersTestError.code === '42P01') {
      console.log('Creando tabla orders...');
      
      try {
        // Crear la tabla orders directamente usando SQL 
        const { error: createOrdersError } = await supabase.rpc('exec_sql', {
          sql_query: `
            CREATE TABLE IF NOT EXISTS orders (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL,
              total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
              status TEXT DEFAULT 'pending',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Habilitar Row Level Security
            ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
            
            -- Crear políticas
            CREATE POLICY "Users can view their own orders" 
              ON orders FOR SELECT 
              USING (auth.uid() = user_id);
            
            CREATE POLICY "Users can insert their own orders" 
              ON orders FOR INSERT 
              WITH CHECK (auth.uid() = user_id);
          `
        });
        
        if (createOrdersError) {
          // Si falla la creación por RPC, intentamos crear una entrada directa
          console.warn('Error al crear tabla orders por SQL, intentando inserción directa');
          
          // Insertar un registro para crear la tabla automáticamente
          const { error: insertError } = await supabase.from('orders').insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            total_amount: 0
          });
          
          if (insertError && insertError.code !== '23505') { // Ignorar error de clave duplicada
            console.error('Error al crear tabla orders por inserción:', insertError);
            return false;
          }
        }
      } catch (error) {
        console.error('Error al intentar crear la tabla orders:', error);
        return false;
      }
    }
    
    // Ahora intentamos con order_items
    const { error: itemsTestError } = await supabase
      .from('order_items')
      .select('id')
      .limit(1);
    
    // Si hay un error, la tabla probablemente no existe, así que la creamos
    if (itemsTestError && itemsTestError.code === '42P01') {
      console.log('Creando tabla order_items...');
      
      try {
        // Obtener un ID de orden existente para la relación
        const { data: orderData } = await supabase.from('orders').select('id').limit(1);
        const orderId = orderData && orderData.length > 0 ? 
                        orderData[0].id : 
                        '00000000-0000-0000-0000-000000000000';
        
        // Crear la tabla order_items por SQL
        const { error: createItemsError } = await supabase.rpc('exec_sql', {
          sql_query: `
            CREATE TABLE IF NOT EXISTS order_items (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              order_id UUID NOT NULL,
              product_id UUID NOT NULL,
              product_name TEXT NOT NULL,
              product_code TEXT NOT NULL,
              quantity INTEGER NOT NULL DEFAULT 1,
              unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
              total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
              notes TEXT
            );
            
            -- Habilitar Row Level Security
            ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
            
            -- Crear políticas
            CREATE POLICY "Users can view their order items" 
              ON order_items FOR SELECT 
              USING (true);
            
            CREATE POLICY "Users can insert order items" 
              ON order_items FOR INSERT 
              WITH CHECK (true);
          `
        });
        
        if (createItemsError) {
          // Si falla la creación por RPC, intentamos crear una entrada directa
          console.warn('Error al crear tabla order_items por SQL, intentando inserción directa');
          
          // Insertar un registro para crear la tabla automáticamente
          const { error: insertError } = await supabase.from('order_items').insert({
            order_id: orderId,
            product_id: '00000000-0000-0000-0000-000000000000',
            product_name: 'Test Product',
            product_code: 'TEST001',
            quantity: 1,
            unit_price: 0,
            total_price: 0
          });
          
          if (insertError && insertError.code !== '23505') { // Ignorar error de clave duplicada
            console.error('Error al crear tabla order_items por inserción:', insertError);
            return false;
          }
        }
      } catch (error) {
        console.error('Error al intentar crear la tabla order_items:', error);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error al verificar o crear tablas:', error);
    return false;
  }
}

/**
 * Método alternativo para crear órdenes si no se pueden usar tablas
 * @param order La orden a guardar
 * @returns Resultado de la operación
 */
async function createOrderAlt(order: Order): Promise<{
  success: boolean;
  message: string;
  order_id?: string;
}> {
  try {
    console.log('Usando método alternativo para guardar la orden...');
    
    // Generar un ID único para la orden
    let orderId;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      orderId = crypto.randomUUID();
    } else {
      // Alternativa simple para generar un ID único
      orderId = 'order-' + Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15) + 
                '-' + Date.now().toString();
    }
    
    // Convertir toda la orden a formato JSON
    const orderData = {
      id: orderId,
      ...order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Guardar en localStorage (fallback)
    if (typeof window !== 'undefined') {
      const orders = JSON.parse(localStorage.getItem('orders') || '[]');
      orders.push(orderData);
      localStorage.setItem('orders', JSON.stringify(orders));
      console.log('Orden guardada en localStorage:', orderId);
    }
    
    return {
      success: true,
      message: 'تم إنشاء الطلب بنجاح (طريقة بديلة)',
      order_id: orderId
    };
  } catch (error) {
    console.error('Error en método alternativo:', error);
    return {
      success: false,
      message: 'حدث خطأ في الطريقة البديلة: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Crear una nueva orden y sus items asociados
 * @param order La orden a crear
 * @returns Un objeto con el resultado de la operación
 */
export async function createOrder(order: Order): Promise<{
  success: boolean;
  message: string;
  order_id?: string;
}> {
  try {
    console.log('=== INICIANDO CREACIÓN DE ORDEN ===');
    console.log('Datos de orden recibidos:', JSON.stringify(order, null, 2));
    
    // Verificar si las tablas necesarias están disponibles
    try {
      // Check if we have 'orders' and 'order_items' tables
      const tablesExist = await ensureTablesExist();
      if (!tablesExist) {
        console.warn('Tables do not exist, falling back to alternative method');
        return createOrderAlt(order);
      }
    } catch (tablesError) {
      console.error('Error checking tables:', tablesError);
      return createOrderAlt(order);
    }
    
    // Verificar que el usuario está autenticado
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      console.error('No active session found');
      return {
        success: false,
        message: 'يجب تسجيل الدخول لإنشاء طلب'
      };
    }
    
    // Veficar que el user_id coincide con el usuario autenticado
    const userId = session.session.user.id;
    if (order.user_id !== userId) {
      console.warn('Order user_id does not match authenticated user, correcting');
      order.user_id = userId;
    }
    
    console.log('Creating order for user:', userId);
    
    // Insertar la orden en la tabla orders
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: order.user_id,
        total_amount: order.total_amount || 0,
        status: order.status || 'pending',
        notes: order.notes || '' // Incluir las notas del pedido
      })
      .select()
      .single();
    
    if (orderError) {
      console.error('Error inserting order:', orderError);
      return {
        success: false,
        message: 'فشل إنشاء الطلب: ' + orderError.message
      };
    }
    
    if (!orderData) {
      console.error('No order data returned after insert');
      return {
        success: false,
        message: 'فشل إنشاء الطلب: لم يتم استرجاع بيانات الطلب'
      };
    }
    
    console.log('Order created successfully:', orderData);
    
    // Insertar los items de la orden
    const orderId = orderData.id;
    const { success: itemsSuccess, message: itemsMessage } = await insertOrderItems(order, orderId);
    
    if (!itemsSuccess) {
      console.error('Error inserting order items:', itemsMessage);
      
      // Intentar eliminar la orden creada para no dejar basura
      try {
        await supabase.from('orders').delete().eq('id', orderId);
      } catch (cleanupError) {
        console.error('Failed to cleanup order after items insertion failure:', cleanupError);
      }
      
      return {
        success: false,
        message: 'فشل إنشاء عناصر الطلب: ' + itemsMessage
      };
    }
    
    console.log('Order items created successfully');
    
    return {
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      order_id: orderId
    };
    
  } catch (error) {
    console.error('Unexpected error creating order:', error);
    return {
      success: false,
      message: 'حدث خطأ غير متوقع أثناء إنشاء الطلب: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Función auxiliar para insertar los items de la orden
 */
async function insertOrderItems(order: Order, orderId: string): Promise<{
  success: boolean;
  message: string;
  order_id?: string;
}> {
  try {
    console.log('PASO 2: Insertando items para orden con ID:', orderId);
    
    // Preparar los items de la orden con el ID obtenido - adaptado a la estructura actual
    const orderItems = order.items.map(item => {
      // Calculate the total price for each item
      const unitPrice = item.unit_price || 0;
      const totalPrice = item.total_price || (unitPrice * item.quantity);
      
      return {
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name || '', // Ensure product_name is always defined
        product_code: item.product_code || '', // Ensure product_code is always defined
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        note: item.notes || item.note || '',
        is_prepared: false,
        created_at: new Date().toISOString()
      };
    });

    console.log(`Preparados ${orderItems.length} items para inserción:`, 
                JSON.stringify(orderItems.map(i => ({ 
                  product_id: i.product_id,
                  product_name: i.product_name,
                  product_code: i.product_code,
                  quantity: i.quantity,
                  unit_price: i.unit_price,
                  total_price: i.total_price,
                  note: i.note
                })), null, 2));

    // Insertar los items en la tabla order_items
    const { data: itemsResult, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select();

    if (itemsError) {
      console.error('ERROR al crear los items de la orden:', itemsError);
      
      // Eliminar la orden ya que los items fallaron
      console.log('Eliminando orden fallida con ID:', orderId);
      const { error: deleteError } = await supabase.from('orders').delete().eq('id', orderId);
      
      if (deleteError) {
        console.error('ERROR adicional al eliminar la orden fallida:', deleteError);
      }
      
      return {
        success: false,
        message: 'فشل إضافة عناصر الطلب: ' + itemsError.message
      };
    }

    console.log(`Insertados ${itemsResult?.length || 0} items correctamente`);
    
    // Verificar que los items se hayan insertado correctamente
    const { data: orderWithItems, error: verifyError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        created_at,
        order_items (
          id,
          product_id,
          product_name,
          product_code,
          quantity,
          unit_price,
          total_price,
          note,
          is_prepared
        )
      `)
      .eq('id', orderId)
      .single();
      
    if (verifyError) {
      console.error('ERROR al verificar la orden completa:', verifyError);
    } else {
      console.log('Orden completa verificada:', JSON.stringify(orderWithItems, null, 2));
    }
    
    // Update the order total amount
    const totalAmount = orderItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
    
    const { error: updateError } = await supabase
      .from('orders')
      .update({ total_amount: totalAmount })
      .eq('id', orderId);
      
    if (updateError) {
      console.error('ERROR al actualizar el total de la orden:', updateError);
    } else {
      console.log('Total de la orden actualizado a:', totalAmount);
    }
    
    console.log('=== ORDEN CREADA EXITOSAMENTE ===');
    
    return {
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      order_id: orderId
    };
  } catch (error) {
    console.error('ERROR al insertar los items de la orden:', error);
    
    // Eliminar la orden ya que los items fallaron
    console.log('Eliminando orden fallida con ID:', orderId);
    await supabase.from('orders').delete().eq('id', orderId).catch(e => {
      console.error('ERROR adicional al eliminar la orden fallida:', e);
    });
    
    return {
      success: false,
      message: 'حدث خطأ أثناء إضافة عناصر الطلب'
    };
  }
}

/**
 * تحديث بيانات المنتجات في الطلب - دالة مساعدة لحل مشكلة عدم ظهور أسماء المنتجات وأسعارها
 * @param items عناصر الطلب
 * @returns عناصر الطلب المحدثة مع بيانات المنتجات
 */
async function enrichOrderItemsWithProductData(items: OrderItem[]): Promise<OrderItem[]> {
  const enrichedItems: OrderItem[] = [];
  
  for (const item of items) {
    // If product has name and price, just use it
    if (item.product_name && item.product_name !== 'منتج غير معروف' && (item.unit_price || item.unit_price === 0)) {
      enrichedItems.push(item);
      continue;
    }
    
    // Try to get product details directly from products table
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('name, product_code, piece_price')
        .eq('id', item.product_id)
        .single();
      
      if (error || !product) {
        console.log(`No product found with id ${item.product_id}, using default values`);
        enrichedItems.push({
          ...item,
          product_name: item.product_name || 'منتج غير معروف',
          product_code: item.product_code || '',
          unit_price: item.unit_price || 0,
          total_price: item.total_price || (item.unit_price ? item.unit_price * item.quantity : 0)
        });
        continue;
      }
      
      console.log(`Found product details for ${item.product_id}:`, product);
      
      // Update item with product data
      const updatedItem = {
        ...item,
        product_name: product.name,
        product_code: product.product_code,
        unit_price: product.piece_price || 0,
        total_price: (product.piece_price || 0) * item.quantity
      };
      
      enrichedItems.push(updatedItem);
      
    } catch (err) {
      console.error(`Error fetching product ${item.product_id}:`, err);
      // Use default values if error
      enrichedItems.push({
        ...item,
        product_name: item.product_name || 'منتج غير معروف',
        product_code: item.product_code || '',
        unit_price: item.unit_price || 0,
        total_price: item.total_price || (item.unit_price ? item.unit_price * item.quantity : 0)
      });
    }
  }
  
  return enrichedItems;
}

/**
 * Obtener todas las órdenes del usuario actual
 * @returns Lista de órdenes del usuario
 */
export async function getUserOrders(): Promise<{
  success: boolean;
  message: string;
  orders?: Order[];
}> {
  try {
    // Verificar si el usuario está autenticado
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return {
        success: false,
        message: 'يجب تسجيل الدخول لعرض الطلبات'
      };
    }

    const userId = session.session.user.id;

    console.log('Fetching orders for user:', userId);

    // Obtener todas las órdenes del usuario
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error al obtener las órdenes:', ordersError);
      return {
        success: false,
        message: 'حدث خطأ أثناء جلب الطلبات'
      };
    }

    console.log('Found orders:', orders);

    // Para cada orden, obtener sus items
    const ordersWithItems: Order[] = [];
    
    for (const order of orders) {
      console.log(`Fetching items for order ${order.id}`);
      
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      if (itemsError) {
        console.error(`Error al obtener los items de la orden ${order.id}:`, itemsError);
        continue;
      }

      console.log(`Found ${items?.length || 0} items for order ${order.id}:`, items);

      // Enrich items with product details
      const enrichedItems = await enrichOrderItemsWithProductData(items || []);
      console.log('Enriched items with product details:', enrichedItems);

      ordersWithItems.push({
        ...order,
        items: enrichedItems
      });
    }

    console.log('Processed orders with items:', ordersWithItems);

    return {
      success: true,
      message: 'تم جلب الطلبات بنجاح',
      orders: ordersWithItems
    };
  } catch (error) {
    console.error('Error inesperado al obtener las órdenes:', error);
    return {
      success: false,
      message: 'حدث خطأ غير متوقع أثناء جلب الطلبات'
    };
  }
}

/**
 * حذف طلب معين
 * @param orderId معرف الطلب المراد حذفه
 * @returns نتيجة العملية
 */
export async function deleteOrder(orderId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log('=== بدء حذف الطلب ===', orderId);
    
    // التحقق من وجود المستخدم المصادق عليه
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      console.error('No active user session found');
      return {
        success: false,
        message: 'يجب تسجيل الدخول لحذف الطلب'
      };
    }

    const userId = session.session.user.id;
    console.log('Current user ID:', userId);

    // التحقق من أن الطلب ينتمي للمستخدم الحالي
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('user_id')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return {
        success: false,
        message: 'حدث خطأ أثناء التحقق من الطلب'
      };
    }

    if (!order) {
      console.error('Order not found:', orderId);
      return {
        success: false,
        message: 'الطلب غير موجود'
      };
    }

    if (order.user_id !== userId) {
      console.error('Order belongs to different user', { orderId, orderUserId: order.user_id, currentUserId: userId });
      return {
        success: false,
        message: 'لا يمكنك حذف طلب لا ينتمي إليك'
      };
    }

    // حذف عناصر الطلب أولاً
    console.log('Deleting order items for order:', orderId);
    const { data: deletedItems, error: itemsDeleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId)
      .select();

    if (itemsDeleteError) {
      console.error('Error deleting order items:', itemsDeleteError);
      return {
        success: false,
        message: 'حدث خطأ أثناء حذف عناصر الطلب'
      };
    }
    
    console.log('Successfully deleted order items:', deletedItems?.length || 0, 'items');

    // حذف الطلب نفسه
    console.log('Deleting order record:', orderId);
    const { data: deletedOrder, error: orderDeleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)
      .select()
      .single();

    if (orderDeleteError) {
      console.error('Error deleting order:', orderDeleteError);
      return {
        success: false,
        message: 'حدث خطأ أثناء حذف الطلب'
      };
    }
    
    console.log('Successfully deleted order:', deletedOrder);

    return {
      success: true,
      message: 'تم حذف الطلب بنجاح'
    };
  } catch (error) {
    console.error('Unexpected error deleting order:', error);
    return {
      success: false,
      message: 'حدث خطأ غير متوقع أثناء حذف الطلب'
    };
  }
}

/**
 * تحديث طلب موجود
 * @param orderId معرف الطلب
 * @param orderItems عناصر الطلب المحدثة
 * @param notes ملاحظات الطلب الجديدة
 * @returns نتيجة العملية
 */
export async function updateOrder(orderId: string, orderItems: OrderItem[], notes?: string): Promise<{
  success: boolean;
  message: string;
  order_id?: string;
}> {
  try {
    console.log('=== بدء تحديث الطلب ===', orderId);
    console.log('Order items to update:', JSON.stringify(orderItems, null, 2));
    console.log('Order notes:', notes);
    
    // التحقق من وجود جلسة مستخدم
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      console.error('No active session found');
      return {
        success: false,
        message: 'يجب تسجيل الدخول لتحديث الطلب'
      };
    }

    const userId = session.session.user.id;
    console.log('Current user ID:', userId);
    
    // التحقق من أن الطلب ينتمي للمستخدم الحالي
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('user_id')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('خطأ في التحقق من الطلب:', orderError);
      return {
        success: false,
        message: 'لم يتم العثور على الطلب'
      };
    }

    if (order.user_id !== userId) {
      console.error('Order belongs to different user', { orderId, orderUserId: order.user_id, currentUserId: userId });
      return {
        success: false,
        message: 'لا يمكنك تعديل طلب لا ينتمي إليك'
      };
    }

    // حذف عناصر الطلب الحالية
    console.log('Deleting current order items for order:', orderId);
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (deleteError) {
      console.error('خطأ في حذف عناصر الطلب القديمة:', deleteError);
      return {
        success: false,
        message: 'فشل في تحديث الطلب: لا يمكن حذف العناصر القديمة'
      };
    }
    console.log('Successfully deleted old order items');

    // إعداد العناصر الجديدة مع التأكد من وجود جميع الحقول
    const formattedItems = orderItems.map(item => {
      // Calculate unit price and total price properly
      const unitPrice = typeof item.unit_price === 'number' ? item.unit_price : 0;
      const totalPrice = typeof item.total_price === 'number' ? item.total_price : 
                       (unitPrice * item.quantity);
      
      return {
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name || 'منتج غير معروف',
        product_code: item.product_code || '',
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        note: item.notes || item.note || '',
        is_prepared: false,
        created_at: new Date().toISOString()
      };
    });

    // حساب المجموع الإجمالي
    const totalAmount = formattedItems.reduce((sum, item) => sum + item.total_price, 0);
    console.log('Calculated total amount:', totalAmount);

    // تحديث الطلب الرئيسي مع إضافة ملاحظات الطلب
    console.log('Updating main order record with notes');
    const { data: updatedOrder, error: updateOrderError } = await supabase
      .from('orders')
      .update({
        updated_at: new Date().toISOString(),
        total_amount: totalAmount,
        notes: notes || '' // تحديث ملاحظات الطلب
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateOrderError) {
      console.error('خطأ في تحديث الطلب:', updateOrderError);
      return {
        success: false,
        message: 'فشل في تحديث معلومات الطلب'
      };
    }
    console.log('Successfully updated order:', updatedOrder);

    console.log('Formatted items to insert:', JSON.stringify(formattedItems, null, 2));

    // إضافة عناصر الطلب الجديدة
    const { data: insertedItems, error: insertError } = await supabase
      .from('order_items')
      .insert(formattedItems)
      .select();

    if (insertError) {
      console.error('خطأ في إضافة عناصر الطلب الجديدة:', insertError);
      return {
        success: false,
        message: 'فشل في إضافة عناصر الطلب الجديدة'
      };
    }

    console.log('Successfully inserted new order items:', insertedItems?.length || 0, 'items');
    
    return {
      success: true,
      message: 'تم تحديث الطلب بنجاح',
      order_id: orderId
    };
  } catch (error) {
    console.error('خطأ غير متوقع في تحديث الطلب:', error);
    return {
      success: false,
      message: 'حدث خطأ غير متوقع أثناء تحديث الطلب'
    };
  }
} 
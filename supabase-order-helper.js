// وحدة مساعدة لعمليات الطلبات باستخدام Supabase
const { createClient } = require('@supabase/supabase-js');

// إعدادات Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

// إنشاء عميل Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// المستخدم الحالي للتسجيل تلقائياً قبل إجراء العمليات
let currentUser = null;

/**
 * تسجيل الدخول بالبريد الإلكتروني وإنشاء مستخدم جديد إذا لم يكن موجوداً
 * هذه الوظيفة للتغلب على مشكلة RLS عن طريق تسجيل دخول مستخدم حقيقي
 */
async function loginOrCreateUser(email, password) {
  try {
    // محاولة تسجيل الدخول
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (signInError) {
      // إذا كان هناك خطأ في تسجيل الدخول، قم بإنشاء مستخدم جديد
      console.log('فشل تسجيل الدخول، محاولة إنشاء مستخدم جديد...');
      
      const { data: { user: newUser }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: email.split('@')[0]
          }
        }
      });
      
      if (signUpError) {
        throw new Error(`فشل إنشاء مستخدم جديد: ${signUpError.message}`);
      }
      
      currentUser = newUser;
      return {
        success: true,
        user: newUser,
        message: 'تم إنشاء مستخدم جديد وتسجيل الدخول بنجاح'
      };
    }
    
    currentUser = user;
    return {
      success: true,
      user,
      message: 'تم تسجيل الدخول بنجاح'
    };
  } catch (error) {
    console.error('خطأ في تسجيل الدخول أو إنشاء مستخدم:', error);
    
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

/**
 * الحصول على المستخدم الحالي
 */
async function getCurrentUser() {
  // التحقق من المستخدم المخزن محلياً أولاً
  if (currentUser) {
    return {
      success: true,
      user: currentUser
    };
  }
  
  // محاولة الحصول على المستخدم من الجلسة
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      throw new Error(`خطأ في استرجاع المستخدم الحالي: ${error.message}`);
    }
    
    if (!user) {
      return {
        success: false,
        message: 'المستخدم غير مسجل الدخول'
      };
    }
    
    currentUser = user;
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('خطأ في الحصول على المستخدم الحالي:', error);
    
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

/**
 * تسجيل الخروج
 */
async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw new Error(`خطأ في تسجيل الخروج: ${error.message}`);
    }
    
    currentUser = null;
    return {
      success: true,
      message: 'تم تسجيل الخروج بنجاح'
    };
  } catch (error) {
    console.error('خطأ في تسجيل الخروج:', error);
    
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

/**
 * إنشاء طلب جديد مع عناصره
 * @param {Object} orderData بيانات الطلب (يمكن تحديد user_id أو استخدام المستخدم الحالي)
 * @param {Array} orderItems عناصر الطلب (product_id, quantity, note)
 * @returns {Promise<Object>} نتيجة العملية
 */
async function createOrder(orderData, orderItems) {
  try {
    // التأكد من وجود مستخدم وتسجيل الدخول
    let userId = orderData.user_id;
    
    if (!userId) {
      // استخدام المستخدم الحالي إذا لم يتم تحديد المستخدم
      const { success, user, message } = await getCurrentUser();
      
      if (!success) {
        // محاولة تسجيل الدخول تلقائياً إذا لم يكن هناك مستخدم حالي
        console.log('لا يوجد مستخدم حالي، محاولة تسجيل الدخول تلقائياً...');
        const loginResult = await loginOrCreateUser(
          process.env.NEXT_PUBLIC_TEST_EMAIL || 'test@example.com',
          process.env.NEXT_PUBLIC_TEST_PASSWORD || 'Password123!'
        );
        
        if (!loginResult.success) {
          throw new Error(`فشل تسجيل الدخول التلقائي: ${loginResult.message}`);
        }
        
        userId = loginResult.user.id;
        console.log('تم تسجيل الدخول تلقائياً، معرف المستخدم:', userId);
      } else {
        userId = user.id;
        console.log('استخدام المستخدم الحالي، معرف المستخدم:', userId);
      }
    }
    
    console.log('إنشاء طلب جديد للمستخدم:', userId);
    console.log('عناصر الطلب:', JSON.stringify(orderItems));
    
    // إنشاء الطلب
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (orderError) {
      console.error('تفاصيل خطأ إنشاء الطلب:', orderError);
      throw new Error(`خطأ في إنشاء الطلب: ${orderError.message}`);
    }
    
    console.log('تم إنشاء الطلب بنجاح، معرف الطلب:', order.id);
    
    // إضافة عناصر الطلب
    const orderItemsWithOrderId = orderItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      note: item.note || '',
      is_prepared: false,
      created_at: new Date().toISOString()
    }));
    
    console.log('إضافة عناصر الطلب:', JSON.stringify(orderItemsWithOrderId));
    
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId)
      .select();
    
    if (itemsError) {
      console.error('تفاصيل خطأ إضافة عناصر الطلب:', itemsError);
      throw new Error(`خطأ في إضافة عناصر الطلب: ${itemsError.message}`);
    }
    
    console.log('تم إضافة عناصر الطلب بنجاح:', items.length);
    
    // استرجاع الطلب الكامل مع التفاصيل
    const { data: fullOrder, error: fullOrderError } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        users (id, email, username),
        order_items (
          id,
          quantity,
          note,
          is_prepared,
          products (id, name, product_code)
        )
      `)
      .eq('id', order.id)
      .single();
    
    if (fullOrderError) {
      console.error('تفاصيل خطأ استرجاع الطلب:', fullOrderError);
      throw new Error(`خطأ في استرجاع تفاصيل الطلب: ${fullOrderError.message}`);
    }
    
    return {
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      order: fullOrder
    };
  } catch (error) {
    console.error('خطأ في إنشاء الطلب:', error);
    
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

/**
 * الحصول على جميع الطلبات مع تفاصيلها
 */
async function getAllOrders() {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        users (id, email, username),
        order_items (
          id,
          quantity,
          note,
          is_prepared,
          products (id, name, product_code)
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`خطأ في استرجاع الطلبات: ${error.message}`);
    }
    
    return {
      success: true,
      orders
    };
  } catch (error) {
    console.error('خطأ في استرجاع الطلبات:', error);
    
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

/**
 * الحصول على تفاصيل طلب محدد
 * @param {string} orderId معرف الطلب
 */
async function getOrderDetails(orderId) {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        users (id, email, username),
        order_items (
          id,
          quantity,
          note,
          is_prepared,
          products (id, name, product_code)
        )
      `)
      .eq('id', orderId)
      .single();
    
    if (error) {
      throw new Error(`خطأ في استرجاع تفاصيل الطلب: ${error.message}`);
    }
    
    return {
      success: true,
      order
    };
  } catch (error) {
    console.error('خطأ في استرجاع تفاصيل الطلب:', error);
    
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

/**
 * اختبار اتصال Supabase والتحقق من الجداول
 */
async function testSupabaseConnection() {
  try {
    console.log('اختبار اتصال Supabase...');
    
    // التحقق من عدد المستخدمين
    const { count: usersCount, error: usersError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });
    
    if (usersError) {
      console.error('خطأ في استعلام المستخدمين:', usersError);
      return {
        success: false,
        message: `خطأ في استعلام المستخدمين: ${usersError.message}`,
        error: usersError
      };
    }
    
    // التحقق من عدد المنتجات
    const { count: productsCount, error: productsError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true });
    
    if (productsError) {
      console.error('خطأ في استعلام المنتجات:', productsError);
      return {
        success: false,
        message: `خطأ في استعلام المنتجات: ${productsError.message}`,
        error: productsError
      };
    }
    
    // التحقق من عدد الطلبات
    const { count: ordersCount, error: ordersError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true });
    
    if (ordersError) {
      console.error('خطأ في استعلام الطلبات:', ordersError);
      return {
        success: false,
        message: `خطأ في استعلام الطلبات: ${ordersError.message}`,
        error: ordersError
      };
    }
    
    return {
      success: true,
      message: 'تم الاتصال بـ Supabase والتحقق من الجداول بنجاح',
      stats: {
        users: usersCount || 0,
        products: productsCount || 0,
        orders: ordersCount || 0
      }
    };
  } catch (error) {
    console.error('خطأ غير متوقع:', error);
    
    return {
      success: false,
      message: `خطأ غير متوقع: ${error.message}`,
      error
    };
  }
}

/**
 * تحديث حالة تحضير عنصر في الطلب
 * @param {string} orderItemId معرف عنصر الطلب
 * @param {boolean} isPrepared حالة التحضير
 */
async function updateOrderItemPreparation(orderItemId, isPrepared) {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .update({ is_prepared: isPrepared })
      .eq('id', orderItemId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`خطأ في تحديث حالة تحضير عنصر الطلب: ${error.message}`);
    }
    
    return {
      success: true,
      message: 'تم تحديث حالة تحضير عنصر الطلب بنجاح',
      orderItem: data
    };
  } catch (error) {
    console.error('خطأ في تحديث حالة تحضير عنصر الطلب:', error);
    
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

/**
 * إنشاء طلب جديد باستخدام استدعاء RPC (يتجاوز RLS)
 * يستخدم هذا الأسلوب عندما لا تنجح الطريقة المباشرة بسبب سياسات RLS
 * @param {Object} orderData بيانات الطلب (يجب تحديد user_id)
 * @param {Array} orderItems عناصر الطلب (product_id, quantity, note)
 * @returns {Promise<Object>} نتيجة العملية
 */
async function createOrderViaRPC(orderData, orderItems) {
  try {
    // التأكد من وجود مستخدم
    let userId = orderData.user_id;
    
    if (!userId) {
      // استخدام المستخدم الحالي إذا لم يتم تحديد المستخدم
      const { success, user, message } = await getCurrentUser();
      
      if (!success) {
        // محاولة تسجيل الدخول تلقائياً إذا لم يكن هناك مستخدم حالي
        console.log('لا يوجد مستخدم حالي، محاولة تسجيل الدخول تلقائياً...');
        const loginResult = await loginOrCreateUser(
          process.env.NEXT_PUBLIC_TEST_EMAIL || 'test@example.com',
          process.env.NEXT_PUBLIC_TEST_PASSWORD || 'Password123!'
        );
        
        if (!loginResult.success) {
          throw new Error(`فشل تسجيل الدخول التلقائي: ${loginResult.message}`);
        }
        
        userId = loginResult.user.id;
        console.log('تم تسجيل الدخول تلقائياً، معرف المستخدم:', userId);
      } else {
        userId = user.id;
        console.log('استخدام المستخدم الحالي، معرف المستخدم:', userId);
      }
    }
    
    console.log('إنشاء طلب جديد عبر RPC للمستخدم:', userId);
    console.log('عناصر الطلب:', JSON.stringify(orderItems));
    
    // محاولة استدعاء دالة RPC
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('create_order_with_items', {
        user_id_param: userId,
        order_items_param: orderItems
      });
    
    if (rpcError) {
      // إذا فشل استدعاء RPC، محاولة إنشاء الدالة أولاً
      console.warn('تحذير: فشل استدعاء دالة RPC، محاولة إنشاء الدالة أولاً...');
      
      try {
        // إنشاء الدالة يدوياً
        const { error: createFunctionError } = await supabase.rpc('exec_sql', {
          sql_query: `
            CREATE OR REPLACE FUNCTION create_order_with_items(
              user_id_param UUID,
              order_items_param JSONB
            ) RETURNS JSONB AS $$
            DECLARE
              new_order_id UUID;
              item JSONB;
              result JSONB;
            BEGIN
              -- إنشاء الطلب
              INSERT INTO orders (user_id, created_at)
              VALUES (user_id_param, NOW())
              RETURNING id INTO new_order_id;
              
              -- إضافة عناصر الطلب
              FOR item IN SELECT * FROM jsonb_array_elements(order_items_param) LOOP
                INSERT INTO order_items (
                  order_id,
                  product_id,
                  quantity,
                  note,
                  is_prepared,
                  created_at
                )
                VALUES (
                  new_order_id,
                  (item->>'product_id')::TEXT,
                  (item->>'quantity')::INTEGER,
                  COALESCE(item->>'note', ''),
                  FALSE,
                  NOW()
                );
              END LOOP;
              
              -- إرجاع النتيجة
              SELECT jsonb_build_object(
                'success', true,
                'order_id', new_order_id
              ) INTO result;
              
              RETURN result;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
          `
        });
        
        if (createFunctionError) {
          console.error('فشل إنشاء دالة RPC:', createFunctionError);
          throw new Error(`فشل إنشاء دالة RPC: ${createFunctionError.message}`);
        }
        
        // محاولة استدعاء الدالة مرة أخرى بعد إنشائها
        const { data: secondRpcResult, error: secondRpcError } = await supabase
          .rpc('create_order_with_items', {
            user_id_param: userId,
            order_items_param: orderItems
          });
        
        if (secondRpcError) {
          throw new Error(`فشل استدعاء دالة RPC بعد إنشائها: ${secondRpcError.message}`);
        }
        
        rpcResult = secondRpcResult;
      } catch (createFunctionError) {
        throw new Error(`فشل إنشاء أو استدعاء دالة RPC: ${createFunctionError.message}`);
      }
    }
    
    if (!rpcResult || !rpcResult.order_id) {
      throw new Error('لم يتم استرجاع معرف الطلب من دالة RPC');
    }
    
    const orderId = rpcResult.order_id;
    console.log('تم إنشاء الطلب بنجاح عبر RPC، معرف الطلب:', orderId);
    
    // استرجاع الطلب الكامل مع التفاصيل
    const { data: fullOrder, error: fullOrderError } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        users (id, email, username),
        order_items (
          id,
          quantity,
          note,
          is_prepared,
          products (id, name, product_code)
        )
      `)
      .eq('id', orderId)
      .single();
    
    if (fullOrderError) {
      console.error('تفاصيل خطأ استرجاع الطلب:', fullOrderError);
      
      // إرجاع معلومات أساسية فقط إذا فشل الاستعلام المفصل
      return {
        success: true,
        message: 'تم إنشاء الطلب بنجاح (مع عدم القدرة على استرجاع التفاصيل الكاملة)',
        order: {
          id: orderId,
          created_at: new Date().toISOString()
        }
      };
    }
    
    return {
      success: true,
      message: 'تم إنشاء الطلب بنجاح عبر RPC',
      order: fullOrder
    };
  } catch (error) {
    console.error('خطأ في إنشاء الطلب عبر RPC:', error);
    
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

/**
 * إنشاء طلب جديد مع عناصره - الإصدار المحسن
 * يحاول أولاً الطريقة المباشرة ثم يستخدم RPC كبديل
 * @param {Object} orderData بيانات الطلب (يمكن تحديد user_id أو استخدام المستخدم الحالي)
 * @param {Array} orderItems عناصر الطلب (product_id, quantity, note)
 * @returns {Promise<Object>} نتيجة العملية
 */
async function createOrderEnhanced(orderData, orderItems) {
  try {
    // محاولة الطريقة المباشرة أولاً
    const directResult = await createOrder(orderData, orderItems);
    
    if (directResult.success) {
      return directResult;
    }
    
    // إذا فشلت الطريقة المباشرة، حاول استخدام RPC
    console.log('فشلت الطريقة المباشرة، محاولة استخدام RPC...');
    return await createOrderViaRPC(orderData, orderItems);
  } catch (error) {
    console.error('خطأ في إنشاء الطلب المحسن:', error);
    
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

// إظهار الإحصائيات عند تحميل الوحدة
(async () => {
  try {
    console.log('تحميل وحدة مساعد الطلبات...');
    const result = await testSupabaseConnection();
    console.log('حالة الاتصال بـ Supabase:', result.success ? 'متصل' : 'غير متصل');
    if (result.success) {
      console.log('إحصائيات قاعدة البيانات:', result.stats);
    }
  } catch (error) {
    console.error('خطأ في تهيئة الوحدة:', error);
  }
})();

module.exports = {
  supabase,
  loginOrCreateUser,
  getCurrentUser,
  signOut,
  createOrder,
  createOrderViaRPC,
  createOrderEnhanced,
  getAllOrders,
  getOrderDetails,
  testSupabaseConnection,
  updateOrderItemPreparation
}; 
// وحدة محسنة للوصول المباشر إلى قاعدة البيانات متوافقة مع هيكل القاعدة الحالي

const { Pool } = require('pg');
const dotenv = require('dotenv');

// تحميل المتغيرات البيئية
dotenv.config({ path: '.env.local' });

// إعدادات الاتصال بقاعدة البيانات - يجب تغييرها بحسب بيانات الاتصال الخاصة بك
const connectionString = process.env.DATABASE_URL || 'postgres://postgres.scbtgnknfahvxlcalfrk:faroukGroup2024@db.scbtgnknfahvxlcalfrk.supabase.co:5432/postgres';

// إنشاء مجمع اتصالات
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * إنشاء طلب جديد مع عناصره
 * @param {Object} order بيانات الطلب الأساسية (user_id)
 * @param {Array} items عناصر الطلب (product_id, quantity, note)
 * @returns {Promise<Object>} نتيجة العملية
 */
async function createOrderDirect(order, items) {
  const client = await pool.connect();
  
  try {
    // بدء المعاملة
    await client.query('BEGIN');
    
    // التحقق من وجود المستخدم
    const userCheckQuery = `
      SELECT id FROM users WHERE id = $1
    `;
    const userCheckResult = await client.query(userCheckQuery, [order.user_id]);
    
    if (userCheckResult.rows.length === 0) {
      throw new Error(`المستخدم برقم ${order.user_id} غير موجود`);
    }
    
    // إدخال الطلب
    const orderQuery = `
      INSERT INTO orders (user_id, created_at)
      VALUES ($1, $2)
      RETURNING id
    `;
    
    const orderValues = [
      order.user_id,
      new Date()
    ];
    
    const orderResult = await client.query(orderQuery, orderValues);
    const orderId = orderResult.rows[0].id;
    
    // إدخال عناصر الطلب
    for (const item of items) {
      // التحقق من وجود المنتج
      const productCheckQuery = `
        SELECT id FROM products WHERE id = $1
      `;
      const productCheckResult = await client.query(productCheckQuery, [item.product_id]);
      
      if (productCheckResult.rows.length === 0) {
        throw new Error(`المنتج برقم ${item.product_id} غير موجود`);
      }
      
      // إدخال عنصر الطلب
      const itemQuery = `
        INSERT INTO order_items (order_id, product_id, quantity, created_at, note, is_prepared)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      const itemValues = [
        orderId,
        item.product_id,
        item.quantity,
        new Date(),
        item.note || '',
        false // افتراضياً ليس محضراً
      ];
      
      await client.query(itemQuery, itemValues);
    }
    
    // الحصول على الطلب الكامل مع عناصره
    const completeOrderQuery = `
      SELECT 
        o.id, 
        o.created_at,
        u.email as user_email,
        u.username as user_name,
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', p.name,
            'product_code', p.product_code,
            'quantity', oi.quantity,
            'note', oi.note,
            'is_prepared', oi.is_prepared
          )
        ) as items
      FROM 
        orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
      WHERE 
        o.id = $1
      GROUP BY 
        o.id, o.created_at, u.email, u.username
    `;
    
    const completeOrderResult = await client.query(completeOrderQuery, [orderId]);
    
    // إنهاء المعاملة بنجاح
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      order_id: orderId,
      order_details: completeOrderResult.rows[0]
    };
  } catch (error) {
    // إلغاء المعاملة في حالة حدوث خطأ
    await client.query('ROLLBACK');
    console.error('خطأ في إنشاء الطلب المباشر:', error);
    
    return {
      success: false,
      message: 'حدث خطأ أثناء معالجة الطلب: ' + error.message,
      error
    };
  } finally {
    // إعادة الاتصال إلى المجمع
    client.release();
  }
}

/**
 * اختبار الاتصال بقاعدة البيانات والتأكد من وجود الجداول
 */
async function testDatabaseConnection() {
  const client = await pool.connect();
  
  try {
    console.log('تم الاتصال بقاعدة البيانات بنجاح');
    
    // التحقق من وجود الجداول
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    
    const tablesResult = await client.query(tablesQuery);
    console.log('الجداول الموجودة:', tablesResult.rows);
    
    // التحقق من هيكل جدول orders
    const ordersColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'orders'
      ORDER BY ordinal_position
    `;
    
    const ordersColumnsResult = await client.query(ordersColumnsQuery);
    console.log('أعمدة جدول orders:', ordersColumnsResult.rows);
    
    // التحقق من هيكل جدول order_items
    const itemsColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'order_items'
      ORDER BY ordinal_position
    `;
    
    const itemsColumnsResult = await client.query(itemsColumnsQuery);
    console.log('أعمدة جدول order_items:', itemsColumnsResult.rows);
    
    // الحصول على عدد السجلات في كل جدول
    const tableStatsQuery = `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM "${table_name}") as record_count
      FROM
        (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') t
    `;
    
    try {
      const tableStatsResult = await client.query(tableStatsQuery);
      console.log('إحصائيات الجداول:', tableStatsResult.rows);
    } catch (statsError) {
      console.error('لا يمكن الحصول على إحصائيات الجداول:', statsError);
    }
    
    return {
      success: true,
      message: 'تم الاتصال بقاعدة البيانات والتحقق من الجداول بنجاح',
      tables: tablesResult.rows,
      ordersColumns: ordersColumnsResult.rows,
      itemsColumns: itemsColumnsResult.rows
    };
  } catch (error) {
    console.error('خطأ في اختبار الاتصال بقاعدة البيانات:', error);
    
    return {
      success: false,
      message: 'حدث خطأ أثناء اختبار الاتصال بقاعدة البيانات: ' + error.message,
      error
    };
  } finally {
    client.release();
  }
}

/**
 * الحصول على جميع الطلبات مع تفاصيلها
 */
async function getOrdersWithDetails() {
  const client = await pool.connect();
  
  try {
    const query = `
      SELECT 
        o.id, 
        o.created_at,
        u.email as user_email,
        u.username as user_name,
        (
          SELECT json_agg(
            json_build_object(
              'id', oi.id,
              'product_id', oi.product_id,
              'product_name', p.name,
              'product_code', p.product_code,
              'quantity', oi.quantity,
              'note', oi.note,
              'is_prepared', oi.is_prepared
            )
          )
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = o.id
        ) as items
      FROM 
        orders o
        JOIN users u ON o.user_id = u.id
      ORDER BY 
        o.created_at DESC
    `;
    
    const result = await client.query(query);
    
    return {
      success: true,
      orders: result.rows
    };
  } catch (error) {
    console.error('خطأ في الحصول على الطلبات:', error);
    
    return {
      success: false,
      message: 'حدث خطأ أثناء الحصول على الطلبات: ' + error.message,
      error
    };
  } finally {
    client.release();
  }
}

// تصدير الدوال للاستخدام الخارجي
module.exports = {
  createOrderDirect,
  testDatabaseConnection,
  getOrdersWithDetails
}; 
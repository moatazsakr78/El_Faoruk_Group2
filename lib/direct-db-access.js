// هذا الملف يتيح تخزين الطلبات باستخدام SQL مباشر

const { Pool } = require('pg');
const dotenv = require('dotenv');

// تحميل المتغيرات البيئية
dotenv.config({ path: '.env.local' });

// إعداد اتصال مباشر بقاعدة البيانات
const connectionString = process.env.DATABASE_URL || 'postgres://postgres.scbtgnknfahvxlcalfrk:faroukGroup2024@aws-0-eu-central-1.pooler.supabase.co:5432/postgres';

// إنشاء مجمع اتصالات
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * إنشاء طلب جديد مع عناصره
 * @param {Object} order البيانات الأساسية للطلب
 * @param {Array} items عناصر الطلب
 * @returns {Promise<Object>} نتيجة العملية
 */
async function createOrderDirect(order, items) {
  const client = await pool.connect();
  
  try {
    // بدء المعاملة
    await client.query('BEGIN');
    
    // إدخال الطلب
    const orderQuery = `
      INSERT INTO orders (user_id, total_amount, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const orderValues = [
      order.user_id,
      order.total_amount,
      'pending',
      new Date(),
      new Date()
    ];
    
    const orderResult = await client.query(orderQuery, orderValues);
    const orderId = orderResult.rows[0].id;
    
    // إدخال عناصر الطلب
    for (const item of items) {
      const itemQuery = `
        INSERT INTO order_items (order_id, product_id, product_name, product_code, quantity, unit_price, total_price, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      const itemValues = [
        orderId,
        item.product_id,
        item.product_name,
        item.product_code,
        item.quantity,
        item.unit_price,
        item.total_price,
        item.notes || ''
      ];
      
      await client.query(itemQuery, itemValues);
    }
    
    // إنهاء المعاملة بنجاح
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      order_id: orderId
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
      AND table_name IN ('orders', 'order_items')
    `;
    
    const tablesResult = await client.query(tablesQuery);
    console.log('الجداول الموجودة:', tablesResult.rows);
    
    // التحقق من هيكل جدول orders
    const ordersColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'orders'
    `;
    
    const ordersColumnsResult = await client.query(ordersColumnsQuery);
    console.log('أعمدة جدول orders:', ordersColumnsResult.rows);
    
    // التحقق من هيكل جدول order_items
    const itemsColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'order_items'
    `;
    
    const itemsColumnsResult = await client.query(itemsColumnsQuery);
    console.log('أعمدة جدول order_items:', itemsColumnsResult.rows);
    
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

// تصدير الدوال للاستخدام الخارجي
module.exports = {
  createOrderDirect,
  testDatabaseConnection
}; 
// Script para crear las tablas directamente a través de la API de Supabase
const { createClient } = require('@supabase/supabase-js');

// إعداد اتصال Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

async function createOrderTables() {
  try {
    console.log('Iniciando creación de tablas de órdenes...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verificar si las tablas ya existen
    console.log('Verificando si las tablas ya existen...');
    const { data: existingTables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', ['orders', 'order_items'])
      .eq('table_schema', 'public');
    
    console.log('Tablas existentes:', existingTables);
    
    if (tablesError) {
      console.error('Error al verificar tablas existentes:', tablesError);
      return;
    }
    
    // Crear tabla orders si no existe
    if (!existingTables || !existingTables.some(t => t.table_name === 'orders')) {
      console.log('Creando tabla orders...');
      
      // Crear la tabla orders directamente
      const { error: createOrdersError } = await supabase.from('orders').insert({
        id: '00000000-0000-0000-0000-000000000000',
        user_id: '00000000-0000-0000-0000-000000000000',
        total_amount: 0,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select();
      
      if (createOrdersError) {
        console.error('Error al crear tabla orders:', createOrdersError);
      } else {
        console.log('Tabla orders creada correctamente.');
      }
    } else {
      console.log('La tabla orders ya existe.');
    }
    
    // Crear tabla order_items si no existe
    if (!existingTables || !existingTables.some(t => t.table_name === 'order_items')) {
      console.log('Creando tabla order_items...');
      
      // Obtener un ID de orden existente
      const { data: orderData } = await supabase.from('orders').select('id').limit(1);
      const orderId = orderData && orderData.length > 0 ? orderData[0].id : '00000000-0000-0000-0000-000000000000';
      
      // Crear la tabla order_items directamente
      const { error: createItemsError } = await supabase.from('order_items').insert({
        id: '00000000-0000-0000-0000-000000000000',
        order_id: orderId,
        product_id: '00000000-0000-0000-0000-000000000000',
        product_name: 'Test Product',
        product_code: 'TEST001',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
        notes: 'Test note'
      }).select();
      
      if (createItemsError) {
        console.error('Error al crear tabla order_items:', createItemsError);
      } else {
        console.log('Tabla order_items creada correctamente.');
      }
    } else {
      console.log('La tabla order_items ya existe.');
    }
    
    // Verificar nuevamente las tablas
    const { data: finalTables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', ['orders', 'order_items'])
      .eq('table_schema', 'public');
    
    console.log('Tablas finales:', finalTables);
    
    console.log('Proceso completado.');
  } catch (error) {
    console.error('Error inesperado:', error);
  }
}

// Ejecutar la función
createOrderTables(); 
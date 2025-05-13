// Script para crear las tablas manualmente
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// إعداد اتصال Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

// También probamos la clave de servicio si está disponible
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

// Crear tablas orders y order_items
async function createTables() {
  try {
    console.log('Conectando a Supabase...');
    
    // Intentar con la clave anónima
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Cliente Supabase creado.');

    // Crear la tabla orders
    console.log('Creando tabla orders...');
    const { error: ordersError } = await supabase.rpc('exec_sql', { 
      sql_query: `
        CREATE TABLE IF NOT EXISTS orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          total_amount DECIMAL(10, 2) NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
        );
      `
    });
    
    if (ordersError) {
      console.error('Error al crear tabla orders:', ordersError);
    } else {
      console.log('Tabla orders creada correctamente.');
    }

    // Crear la tabla order_items
    console.log('Creando tabla order_items...');
    const { error: itemsError } = await supabase.rpc('exec_sql', { 
      sql_query: `
        CREATE TABLE IF NOT EXISTS order_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID NOT NULL,
          product_id UUID NOT NULL,
          product_name TEXT NOT NULL,
          product_code TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          unit_price DECIMAL(10, 2) NOT NULL,
          total_price DECIMAL(10, 2) NOT NULL,
          notes TEXT,
          CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        );
      `
    });
    
    if (itemsError) {
      console.error('Error al crear tabla order_items:', itemsError);
    } else {
      console.log('Tabla order_items creada correctamente.');
    }

    // Alternativa: crear las tablas mediante SQL directo
    if (ordersError || itemsError) {
      console.log('Intentando crear tablas mediante SQL Query...');
      
      // Leer el archivo SQL
      const sqlPath = path.join(__dirname, '..', 'migrations', '01_create_orders_tables.sql');
      console.log('Ruta del archivo SQL:', sqlPath);
      
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log('SQL leído correctamente.');

      // Ejecutar el SQL directamente a través de la API REST
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          query: sql
        })
      });

      const result = await response.json();
      console.log('Resultado de la ejecución SQL directa:', result);
    }

    console.log('Proceso completado.');
  } catch (error) {
    console.error('Error inesperado:', error);
  }
}

// Ejecutar la función
createTables(); 
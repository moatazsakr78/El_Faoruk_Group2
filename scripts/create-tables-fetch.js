// Script para crear las tablas mediante fetch
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// إعداد اتصال Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

async function createTables() {
  try {
    console.log('Leyendo archivo SQL...');
    const sqlPath = path.join(__dirname, '..', 'migrations', 'supabase-sql-editor.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Enviando SQL a Supabase...');
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        'sql_query': sql
      })
    });
    
    const result = await response.text();
    console.log('Resultado:', result);

    console.log('Proceso completado.');
  } catch (error) {
    console.error('Error:', error);
  }
}

createTables(); 
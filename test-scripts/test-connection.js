// اختبار الاتصال بقاعدة بيانات Supabase
// هذا الملف يقوم بالاتصال بقاعدة البيانات وعرض أول 3 منتجات
require('dotenv').config({ path: '.env.local' }); // تحميل متغيرات البيئة من .env.local
const { createClient } = require('@supabase/supabase-js');

// استخدام متغيرات البيئة أو القيم الافتراضية
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYnRnbmtuZmFodnhsY2FsZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDA2ODYsImV4cCI6MjA2MjU3NjY4Nn0.47A0DCKjvPmkKECE0NFttvPFceyug98zIiufOVRjfPQ';

console.log('Supabase URL:', supabaseUrl);
console.log('Connecting to database...');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function getProducts() {
  try {
    console.log('Fetching products...');
    
    const { data, error } = await supabase
      .from('products')
      .select('id, name, product_code, box_quantity, piece_price, is_new, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (error) {
      console.error('Error fetching products:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No products found in the database.');
      return;
    }
    
    console.log('========== PRODUCTS ==========');
    console.log(`Found ${data.length} products:`);
    
    data.forEach((product, index) => {
      console.log(`\nProduct ${index + 1}:`);
      console.log(`- ID: ${product.id}`);
      console.log(`- Name: ${product.name}`);
      console.log(`- Product Code: ${product.product_code}`);
      console.log(`- Box Quantity: ${product.box_quantity}`);
      console.log(`- Piece Price: ${product.piece_price}`);
      console.log(`- Is New: ${product.is_new ? 'Yes' : 'No'}`);
      console.log(`- Created At: ${product.created_at}`);
    });
    
    console.log('\n========== END PRODUCTS ==========');
    
    return data;
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// تشغيل الاستعلام
getProducts()
  .then(() => {
    console.log('Connection test completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Connection test failed:', error);
    process.exit(1);
  }); 
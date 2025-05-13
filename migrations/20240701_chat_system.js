const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// تحميل المتغيرات البيئية
dotenv.config({ path: '.env.local' });

// إعدادات الاتصال
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://scbtgnknfahvxlcalfrk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Initialize the Supabase client with service role key to apply migrations
const supabase = createClient(supabaseUrl, supabaseKey);

// Read SQL file
const sqlFile = path.join(__dirname, '../supabase/chat-system-setup.sql');
let sql;

try {
  sql = fs.readFileSync(sqlFile, 'utf8');
} catch (error) {
  console.error('Error reading SQL file:', error);
  process.exit(1);
}

// Execute SQL
async function runMigration() {
  console.log('Running chat system migration...');
  
  try {
    // Execute the SQL statements
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      throw error;
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error applying migration:', error);
    
    // Attempt to run SQL statements directly if RPC method is not available
    try {
      console.log('Attempting direct SQL execution...');
      
      // Split SQL into individual statements
      const statements = sql
        .replace(/(\r\n|\n|\r)/gm, ' ') // Normalize line endings
        .replace(/--.*$/gm, '') // Remove SQL comments
        .split(';')
        .filter(statement => statement.trim() !== '');
      
      // Execute each statement
      for (const statement of statements) {
        console.log(`Executing SQL: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.from('_exec_sql').insert({ sql: statement });
        
        if (error) {
          console.error('Error executing statement:', error);
        }
      }
      
      console.log('Direct SQL execution completed.');
    } catch (directError) {
      console.error('Error with direct SQL execution:', directError);
      console.log('Please apply the migration manually using the SQL file:', sqlFile);
    }
  }
}

// Run the migration
runMigration(); 
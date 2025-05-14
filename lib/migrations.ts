import { supabase } from './supabase';
import fs from 'fs';
import path from 'path';

/**
 * Aplica una migración SQL a la base de datos
 * @param sql El SQL a ejecutar
 * @returns Resultado de la migración
 */
export async function applyMigration(sql: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error al aplicar la migración:', error);
      return {
        success: false,
        message: `Error al aplicar la migración: ${error.message}`
      };
    }
    
    return {
      success: true,
      message: 'Migración aplicada correctamente'
    };
  } catch (error) {
    console.error('Error inesperado al aplicar la migración:', error);
    return {
      success: false,
      message: `Error inesperado: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Aplica todas las migraciones en el directorio /migrations
 * @returns Resultado de la aplicación de migraciones
 */
export async function applyAllMigrations(): Promise<{
  success: boolean;
  message: string;
  appliedMigrations: string[];
}> {
  try {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ordena por nombre de archivo
    
    const appliedMigrations: string[] = [];
    
    for (const file of migrationFiles) {
      console.log(`Aplicando migración: ${file}`);
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      const result = await applyMigration(sqlContent);
      
      if (!result.success) {
        return {
          success: false,
          message: `Error al aplicar la migración ${file}: ${result.message}`,
          appliedMigrations
        };
      }
      
      appliedMigrations.push(file);
    }
    
    return {
      success: true,
      message: `Se aplicaron ${appliedMigrations.length} migraciones correctamente`,
      appliedMigrations
    };
  } catch (error) {
    console.error('Error al aplicar migraciones:', error);
    return {
      success: false,
      message: `Error al aplicar migraciones: ${error instanceof Error ? error.message : String(error)}`,
      appliedMigrations: []
    };
  }
}

/**
 * يتحقق من وجود حقل role في جدول المستخدمين ويضيفه إذا لم يكن موجوداً
 * @returns نتيجة التحقق والإضافة
 */
export async function ensureUserRoleColumn(): Promise<{
  success: boolean;
  message: string;
  columnExists: boolean;
}> {
  try {
    console.log('جاري التحقق من وجود حقل role في جدول المستخدمين...');
    
    // التحقق من وجود الحقل
    const { data: columns, error: columnCheckError } = await supabase
      .rpc('exec_sql', { 
        sql_query: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = 'role'
        `
      });
    
    if (columnCheckError) {
      console.error('خطأ في التحقق من وجود حقل role:', columnCheckError);
      return {
        success: false,
        message: `خطأ في التحقق من وجود حقل: ${columnCheckError.message}`,
        columnExists: false
      };
    }
    
    const columnExists = columns && columns.length > 0;
    
    if (columnExists) {
      console.log('حقل role موجود بالفعل في جدول المستخدمين');
      return {
        success: true,
        message: 'حقل role موجود بالفعل',
        columnExists: true
      };
    }
    
    console.log('حقل role غير موجود، جاري إضافته...');
    
    // إضافة حقل role إذا لم يكن موجوداً
    const { error: addColumnError } = await supabase
      .rpc('exec_sql', { 
        sql_query: `
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer'
        `
      });
    
    if (addColumnError) {
      console.error('خطأ في إضافة حقل role:', addColumnError);
      return {
        success: false,
        message: `خطأ في إضافة حقل role: ${addColumnError.message}`,
        columnExists: false
      };
    }
    
    console.log('تم إضافة حقل role بنجاح');
    
    // ضبط القيم الافتراضية للحقل بناءً على is_admin
    const { error: updateRoleError } = await supabase
      .rpc('exec_sql', { 
        sql_query: `
          UPDATE users 
          SET role = 
            CASE 
              WHEN is_admin = true THEN 'admin' 
              ELSE 'customer' 
            END 
          WHERE role IS NULL
        `
      });
    
    if (updateRoleError) {
      console.error('خطأ في تحديث قيم حقل role:', updateRoleError);
      return {
        success: false,
        message: `تم إضافة الحقل ولكن حدث خطأ في ضبط القيم: ${updateRoleError.message}`,
        columnExists: true
      };
    }
    
    return {
      success: true,
      message: 'تم إضافة حقل role بنجاح وضبط القيم الافتراضية',
      columnExists: true
    };
  } catch (error) {
    console.error('خطأ غير متوقع:', error);
    return {
      success: false,
      message: `خطأ غير متوقع: ${error instanceof Error ? error.message : String(error)}`,
      columnExists: false
    };
  }
} 
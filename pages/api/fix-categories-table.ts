import { supabase } from '@/lib/supabase';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // التحقق مما إذا كان العمود موجوداً
    const { data: columnExists, error: checkError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'categories'
          AND column_name = 'color'
        ) AS column_exists;
      `
    });

    if (checkError) {
      throw new Error(`فشل في التحقق من وجود العمود: ${checkError.message}`);
    }

    // إضافة العمود إذا لم يكن موجوداً
    if (!columnExists[0]?.column_exists) {
      const { error: alterError } = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT;`
      });

      if (alterError) {
        throw new Error(`فشل في إضافة العمود: ${alterError.message}`);
      }

      res.status(200).json({ success: true, message: 'تمت إضافة عمود اللون بنجاح' });
    } else {
      res.status(200).json({ success: true, message: 'عمود اللون موجود بالفعل' });
    }
  } catch (error: any) {
    console.error('خطأ في تنفيذ الاستعلام:', error);
    res.status(500).json({ error: error.message });
  }
} 
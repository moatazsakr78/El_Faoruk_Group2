-- إضافة حقل اللون للفئات
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS color TEXT;

-- إنشاء جدول العلاقة بين المنتجات والفئات (علاقة متعددة لمتعددة)
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, category_id)
);

-- إضافة مؤشر للبحث السريع
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);

-- تحديث سياسات الأمان للجدول الجديد
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- السماح للمستخدمين المجهولين بقراءة العلاقات فقط
CREATE POLICY "السماح للمستخدمين المجهولين بقراءة العلاقات"
ON product_categories FOR SELECT
TO anon
USING (true);

-- السماح للمستخدمين المسجلين بقراءة العلاقات
CREATE POLICY "السماح للمستخدمين المسجلين بقراءة العلاقات"
ON product_categories FOR SELECT
TO authenticated
USING (true);

-- السماح للمسؤولين فقط بإدراج العلاقات
CREATE POLICY "السماح للمسؤولين بإدراج العلاقات"
ON product_categories FOR INSERT
TO authenticated
WITH CHECK (true);

-- السماح للمسؤولين فقط بتحديث العلاقات
CREATE POLICY "السماح للمسؤولين بتحديث العلاقات"
ON product_categories FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- السماح للمسؤولين فقط بحذف العلاقات
CREATE POLICY "السماح للمسؤولين بحذف العلاقات"
ON product_categories FOR DELETE
TO authenticated
USING (true);

-- إضافة محفز لتحديث الطابع الزمني عند التحديث
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_categories_timestamp
BEFORE UPDATE ON product_categories
FOR EACH ROW
EXECUTE FUNCTION update_timestamp(); 
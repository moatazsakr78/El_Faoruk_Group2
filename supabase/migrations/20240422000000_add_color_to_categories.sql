-- Add color column to categories table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'categories'
        AND column_name = 'color'
    ) THEN
        ALTER TABLE categories ADD COLUMN color TEXT;
    END IF;
END
$$; 
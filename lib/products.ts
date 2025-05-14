import { supabase } from './supabase';
import { Product } from '@/types';

/**
 * الحصول على منتج بواسطة المعرف
 * @param id معرف المنتج
 * @returns نتيجة العملية والمنتج
 */
export async function getProductById(id: string): Promise<{
  success: boolean;
  message: string;
  product?: Product;
}> {
  try {
    // التحقق من وجود معرف المنتج
    if (!id) {
      return {
        success: false,
        message: 'معرف المنتج مطلوب'
      };
    }

    // جلب المنتج من قاعدة البيانات
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching product:', error);
      return {
        success: false,
        message: 'حدث خطأ أثناء جلب المنتج'
      };
    }

    if (!product) {
      return {
        success: false,
        message: 'المنتج غير موجود'
      };
    }

    // تنسيق البيانات لتتوافق مع واجهة Product
    const formattedProduct: Product = {
      id: product.id,
      name: product.name,
      productCode: product.product_code || '',
      boxQuantity: product.box_quantity || 1,
      piecePrice: product.piece_price || 0,
      wholesalePrice: product.wholesale_price || 0,
      packPrice: product.pack_price || 0,
      boxPrice: product.box_price || 0,
      imageUrl: product.image_url || '',
      isNew: product.is_new || false,
      createdAt: product.created_at,
      categoryId: product.category_id
    };

    return {
      success: true,
      message: 'تم جلب المنتج بنجاح',
      product: formattedProduct
    };
  } catch (error) {
    console.error('Unexpected error fetching product:', error);
    return {
      success: false,
      message: 'حدث خطأ غير متوقع أثناء جلب المنتج'
    };
  }
} 
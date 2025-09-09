export interface Product {
  id: string;
  name: string;
  productCode: string;
  boxQuantity: number;
  piecePrice: number;
  wholesalePrice?: number;
  packPrice?: number;
  boxPrice?: number;
  imageUrl: string;
  isNew?: boolean;
  createdAt?: string;
  categoryId?: string;
  categories?: Category[];
  selectedCategories?: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  description?: string;
  color?: string;
}

export interface ProductCategory {
  id: string;
  productId: string;
  categoryId: string;
}
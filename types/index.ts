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
}
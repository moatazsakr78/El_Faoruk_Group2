import Image from 'next/image';
import { Product } from '@/types';
import { useState, useEffect, useRef, memo } from 'react';
import { FiPlus, FiMinus, FiEdit } from 'react-icons/fi';
import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

// مكون محسن مع React.memo لمنع إعادة العرض الغير ضرورية
function ProductCard({ product, priority = false }: ProductCardProps) {
  // تحسين الحالة - تجميع متعلق بالصورة
  const [imageState, setImageState] = useState({
    loaded: false,
    src: ''
  });
  
  // حالة الكمية والملاحظات
  const [quantity, setQuantity] = useState(1);
  const [showQuantitySelector, setShowQuantitySelector] = useState(false);
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [notes, setNotes] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const quantitySelectorRef = useRef<HTMLDivElement>(null);
  const notesEditorRef = useRef<HTMLDivElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  
  // Refs for increment/decrement intervals
  const incrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const decrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { orderMode, addItem, isInCart, getItem } = useCart();
  const { profile, isAdmin } = useAuth(); // استخدام سياق المصادقة للحصول على معلومات المستخدم
  
  // الحصول على صلاحية المستخدم (مع قيمة افتراضية 'customer')
  const userRole = profile?.role || 'customer';
  
  
  // Reset UI states when order mode changes
  useEffect(() => {
    if (!orderMode) {
      setShowQuantitySelector(false);
      setShowNotesEditor(false);
    }
  }, [orderMode]);
  
  // Close quantity selector when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (quantitySelectorRef.current && !quantitySelectorRef.current.contains(event.target as Node)) {
        setShowQuantitySelector(false);
      }
      if (notesEditorRef.current && !notesEditorRef.current.contains(event.target as Node)) {
        setShowNotesEditor(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Set initial quantity and notes if the product is already in the cart
  useEffect(() => {
    const cartItem = getItem(product.id);
    if (cartItem) {
      setQuantity(cartItem.quantity);
      if (cartItem.notes) {
        setNotes(cartItem.notes);
      }
    }
  }, [product.id, getItem]);

  // استخدام useEffect لتحقق من وجود الصورة في cache المتصفح
  useEffect(() => {
    if (!product.imageUrl) return;
    
    // محاولة استرجاع الصورة من cache المتصفح
    const checkImageCache = async () => {
      try {
        // فحص ما إذا كانت الصورة مخزنة في cache
        const cache = await caches.open('product-images-cache');
        const cachedResponse = await cache.match(product.imageUrl);
        
        if (cachedResponse) {
          // Image found in cache
        } else {
          // إذا لم تكن الصورة في cache، قم بتخزينها
          await cache.add(product.imageUrl);
        }
        
        // تعيين مصدر الصورة بعد التحقق من cache
        setImageState(prev => ({ ...prev, src: product.imageUrl }));
      } catch (error) {
        // في حالة الخطأ، استخدم الرابط المباشر
        setImageState(prev => ({ ...prev, src: product.imageUrl }));
      }
    };
    
    checkImageCache();
  }, [product.imageUrl]);

  // Focus on input when quantity selector opens
  useEffect(() => {
    if (showQuantitySelector && quantityInputRef.current) {
      setTimeout(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }, 100);
    }
  }, [showQuantitySelector]);

  // Clear any active intervals when component unmounts
  useEffect(() => {
    return () => {
      if (incrementIntervalRef.current) {
        clearInterval(incrementIntervalRef.current);
      }
      if (decrementIntervalRef.current) {
        clearInterval(decrementIntervalRef.current);
      }
    };
  }, []);

  const handleAddToCart = () => {
    addItem(product, quantity, notes);
    setShowQuantitySelector(false);
    setShowNotesEditor(false);
  };

  const incrementQuantity = () => {
    setQuantity(prev => prev + 1);
  };

  const decrementQuantity = () => {
    setQuantity(prev => (prev > 1 ? prev - 1 : 1));
  };

  // Start continuous increment when holding the plus button
  const startIncrement = () => {
    // First increment immediately
    incrementQuantity();
    
    // Then set an interval for continuous increment
    const initialDelay = setTimeout(() => {
      incrementIntervalRef.current = setInterval(() => {
        incrementQuantity();
      }, 100); // Adjust speed as needed
    }, 500); // Initial delay before continuous increment starts
    
    // Store the timeout so we can clear it
    incrementIntervalRef.current = initialDelay as unknown as NodeJS.Timeout;
  };

  // Start continuous decrement when holding the minus button
  const startDecrement = () => {
    // First decrement immediately
    decrementQuantity();
    
    // Then set an interval for continuous decrement
    const initialDelay = setTimeout(() => {
      decrementIntervalRef.current = setInterval(() => {
        decrementQuantity();
      }, 100); // Adjust speed as needed
    }, 500); // Initial delay before continuous decrement starts
    
    // Store the timeout so we can clear it
    decrementIntervalRef.current = initialDelay as unknown as NodeJS.Timeout;
  };

  // Stop increment/decrement when releasing button
  const stopIncrement = () => {
    if (incrementIntervalRef.current) {
      clearInterval(incrementIntervalRef.current);
      incrementIntervalRef.current = null;
    }
  };

  const stopDecrement = () => {
    if (decrementIntervalRef.current) {
      clearInterval(decrementIntervalRef.current);
      decrementIntervalRef.current = null;
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setQuantity(value);
    } else if (e.target.value === '') {
      setQuantity(1);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddToCart();
    }
  };

  const isProductInCart = isInCart(product.id);

  // منطق عرض الأسعار بناءً على الصلاحيات
  let showPiecePrice = false;
  let showWholesalePrice = false;


  // تحسين منطق عرض الأسعار - استخدام تنفيذ أكثر مباشرة لمنع أي مشاكل
  if (isAdmin === true) {
    // المشرفون يرون جميع الأسعار
    showPiecePrice = true;
    showWholesalePrice = true;
  } else {
    // التعامل مع الصلاحيات المختلفة
    const role = userRole ? userRole.toLowerCase() : 'customer';
    
    // استخدام منطق مباشر بدلاً من switch-case لتجنب أي مشاكل
    if (role === 'wholesale') {
      showPiecePrice = false;
      showWholesalePrice = true;
    } else if (role === 'preparation') {
      showPiecePrice = false;
      showWholesalePrice = false;
    } else if (role === 'full_details' || role === 'admin') {
      showPiecePrice = true;
      showWholesalePrice = true;
    } else {
      // الحالة الافتراضية (customer أو أي قيمة أخرى) - سعر القطعة فقط
      showPiecePrice = true;
      showWholesalePrice = false;
    }
  }

  return (
    <div className="bg-[#D7D7D7] rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative h-64 md:h-72">
        {imageState.src ? (
          <>
            {/* استخدام صورة مؤقتة للتحميل (placeholder) */}
            {!imageState.loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            <Image
              src={imageState.src}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-contain p-2 transition-opacity duration-300 ${imageState.loaded ? 'opacity-100' : 'opacity-0'}`}
              priority={priority}
              quality={85}
              loading={priority ? 'eager' : 'lazy'}
              onLoad={() => setImageState(prev => ({ ...prev, loaded: true }))}
            />
          </>
        ) : (
          <div className="h-full w-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">لا توجد صورة</span>
          </div>
        )}
        {product.isNew && (
          <span className="absolute top-2 right-2 bg-secondary text-white text-xs px-2 py-1 rounded-full">
            جديد
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{product.name}</h3>
        
        <div className="bg-gray-100 p-3 rounded-md mb-3 text-center">
          <p className="font-bold text-gray-700 mb-1">كود المنتج</p>
          <p className="text-xl md:text-2xl font-bold text-primary">{product.productCode}</p>
        </div>
        
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 text-sm">
            {/* عرض سعر القطعة */}
            {showPiecePrice && (
              <div className="bg-gray-50 p-2 rounded text-center">
                <p className="font-bold text-primary">سعر القطعة</p>
                <p className="text-lg">{product.piecePrice} جنيه</p>
              </div>
            )}
            
            {/* عرض سعر الجملة */}
            {showWholesalePrice && product.wholesalePrice && (
              <div className="bg-gray-50 p-2 rounded text-center">
                <p className="font-bold text-secondary">سعر الجملة</p>
                <p className="text-lg">{product.wholesalePrice} جنيه</p>
              </div>
            )}
            
            <div className="bg-gray-50 p-2 rounded text-center">
              <p className="font-semibold">الكمية في الكرتونة</p>
              <p className="text-lg">{product.boxQuantity} قطعة</p>
            </div>
          </div>
        </div>
        
        {/* Order Buttons - Only show when orderMode is active */}
        {orderMode && (
          <div className="mt-4 flex justify-between items-center">
            <button 
              onClick={() => setShowQuantitySelector(true)}
              className="text-white border border-[#5D1F1F] bg-[#5D1F1F] rounded-md px-3 py-1 flex-1 mx-1 flex items-center justify-center hover:bg-[#4a1919] transition-colors"
            >
              <span>إضافة</span>
            </button>
            
            <button 
              onClick={() => setShowNotesEditor(true)}
              className="text-gray-700 border border-gray-400 rounded-md px-3 py-1 flex-1 mx-1 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <FiEdit className="ml-1" />
              <span>ملاحظة</span>
            </button>
          </div>
        )}
        
        {/* Quantity Selector */}
        {showQuantitySelector && (
          <div 
            ref={quantitySelectorRef}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowQuantitySelector(false)}></div>
            <div className="bg-white p-6 rounded-md shadow-lg z-10 w-80 max-w-[90%] relative">
              <h3 className="text-xl font-bold mb-6 text-center">تحديد الكمية</h3>
              <div className="flex justify-between items-center mb-6">
                <button 
                  onMouseDown={startDecrement}
                  onMouseUp={stopDecrement}
                  onMouseLeave={stopDecrement}
                  onTouchStart={startDecrement}
                  onTouchEnd={stopDecrement}
                  className="bg-gray-200 p-2 rounded-md hover:bg-gray-300 w-10 h-10 flex items-center justify-center"
                >
                  <FiMinus />
                </button>
                
                <input
                  type="number"
                  ref={quantityInputRef}
                  value={quantity}
                  onChange={handleQuantityChange}
                  onKeyDown={handleInputKeyDown}
                  min="1"
                  className="text-2xl font-bold text-center w-20 border-b-2 border-gray-300 focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                
                <button 
                  onMouseDown={startIncrement}
                  onMouseUp={stopIncrement}
                  onMouseLeave={stopIncrement}
                  onTouchStart={startIncrement}
                  onTouchEnd={stopIncrement}
                  className="bg-gray-200 p-2 rounded-md hover:bg-gray-300 w-10 h-10 flex items-center justify-center"
                >
                  <FiPlus />
                </button>
              </div>
              <div className="flex justify-between">
                <button 
                  onClick={() => setShowQuantitySelector(false)}
                  className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 w-[48%]"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleAddToCart}
                  className="bg-[#5D1F1F] text-white py-2 px-4 rounded-md hover:bg-[#4a1919] w-[48%]"
                >
                  إضافة للطلب
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Notes Editor */}
        {showNotesEditor && (
          <div 
            ref={notesEditorRef}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowNotesEditor(false)}></div>
            <div className="bg-white p-6 rounded-md shadow-lg z-10 w-80 max-w-[90%] relative">
              <h3 className="text-xl font-bold mb-6 text-center">إضافة ملاحظة</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-32 border border-gray-300 rounded-md p-2 mb-6 resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="أدخل ملاحظتك هنا..."
              />
              <div className="flex justify-between">
                <button 
                  onClick={() => setShowNotesEditor(false)}
                  className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 w-[48%]"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleAddToCart}
                  className="bg-[#5D1F1F] text-white py-2 px-4 rounded-md hover:bg-[#4a1919] w-[48%]"
                >
                  حفظ وإضافة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// تصدير محسن مع React.memo لمنع إعادة العرض الغير ضرورية
export default memo(ProductCard, (prevProps, nextProps) => {
  // مقارنة مخصصة لتحسين الأداء
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.product.piecePrice === nextProps.product.piecePrice &&
    prevProps.product.imageUrl === nextProps.product.imageUrl &&
    prevProps.product.boxQuantity === nextProps.product.boxQuantity &&
    prevProps.priority === nextProps.priority
  );
}); 
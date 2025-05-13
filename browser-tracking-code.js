// تتبع طلبات Supabase وتسجيل النتائج
(function() {
  console.log('بدء تتبع طلبات إنشاء الطلبات في Supabase...');
  
  // تخزين طلبات الشبكة المتعلقة بـ Supabase
  window.supabaseRequests = [];
  window.orderResults = [];
  
  // تتبع الأخطاء
  window.onerror = function(message, source, lineno, colno, error) {
    console.error('❌ خطأ JavaScript:', message, 'في السطر:', lineno);
    if (error && error.stack) {
      console.error('Stack:', error.stack);
    }
  };
  
  // التقاط طلبات الشبكة المتعلقة بـ Supabase
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    // تتبع طلبات Supabase فقط
    if (typeof url === 'string' && url.includes('supabase')) {
      console.log('🔄 طلب Supabase:', url.split('/').pop());
      console.log('📤 البيانات المرسلة:', options.body ? JSON.parse(options.body) : 'لا توجد بيانات');
      
      // تنفيذ الطلب وتتبع الاستجابة
      const request = originalFetch.apply(this, args);
      request
        .then(response => {
          // نسخة من الاستجابة للتحليل
          response.clone().text()
            .then(body => {
              try {
                // محاولة تحليل البيانات كـ JSON
                const data = JSON.parse(body);
                console.log('📥 استجابة Supabase:', data);
                
                // تخزين الطلب والاستجابة
                window.supabaseRequests.push({ 
                  url, 
                  method: options.method || 'GET',
                  data: options.body ? JSON.parse(options.body) : null,
                  response: data,
                  timestamp: new Date().toISOString()
                });
                
                // التعرف على طلبات إنشاء الطلبات وعناصرها
                if (url.includes('/orders') && options.method === 'POST') {
                  console.log('🛒 محاولة إنشاء طلب!');
                  
                  if (data.error) {
                    console.error('❌ فشل إنشاء الطلب:', data.error);
                  } else if (data.data && data.data.length > 0) {
                    console.log('✅ تم إنشاء الطلب بنجاح:', data.data[0].id);
                    
                    window.orderResults.push({
                      success: true,
                      order_id: data.data[0].id,
                      timestamp: new Date().toISOString(),
                      data: data.data[0]
                    });
                  }
                }
                
                // التعرف على طلبات إنشاء عناصر الطلبات
                if (url.includes('/order_items') && options.method === 'POST') {
                  console.log('📦 محاولة إضافة عناصر للطلب!');
                  
                  if (data.error) {
                    console.error('❌ فشل إضافة عناصر الطلب:', data.error);
                  } else if (data.data && data.data.length > 0) {
                    const items = data.data;
                    console.log(`✅ تم إضافة ${items.length} عنصر للطلب بنجاح`);
                    
                    // تحديث نتائج الطلب إذا كانت موجودة
                    if (window.orderResults.length > 0) {
                      const lastOrder = window.orderResults[window.orderResults.length - 1];
                      lastOrder.items = items;
                      lastOrder.itemsSuccess = true;
                    }
                  }
                }
              } catch (e) {
                console.log('📥 استجابة Supabase (نص):', body);
              }
            });
        })
        .catch(error => {
          console.error('❌ خطأ في طلب الشبكة:', error);
        });
      
      return request;
    }
    return originalFetch.apply(this, args);
  };
  
  // محاكاة إنشاء طلب لاختبار الوظيفة
  window.simulateOrder = function() {
    const randomItems = [
      { product_id: "1746448671400", quantity: 2 },
      { product_id: "1746448778616", quantity: 1 }
    ];
    
    console.log('🚀 بدء محاكاة إنشاء طلب...');
    
    // محاولة إنشاء طلب جديد
    fetch('https://scbtgnknfahvxlcalfrk.supabase.co/rest/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.supabase?.supabaseKey || '',
        'Authorization': 'Bearer ' + (window.supabase?.supabaseKey || '')
      },
      body: JSON.stringify([{
        created_at: new Date().toISOString()
      }])
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      if (data.data && data.data.length > 0) {
        const orderId = data.data[0].id;
        console.log('✅ تم إنشاء الطلب بنجاح:', orderId);
        
        // إضافة عناصر الطلب
        return fetch('https://scbtgnknfahvxlcalfrk.supabase.co/rest/v1/order_items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': window.supabase?.supabaseKey || '',
            'Authorization': 'Bearer ' + (window.supabase?.supabaseKey || '')
          },
          body: JSON.stringify(
            randomItems.map(item => ({
              order_id: orderId,
              product_id: item.product_id,
              quantity: item.quantity,
              note: 'اختبار محاكاة الطلب',
              is_prepared: false,
              created_at: new Date().toISOString()
            }))
          )
        });
      } else {
        throw new Error('لم يتم الحصول على معرف الطلب');
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      if (data.data && data.data.length > 0) {
        console.log(`✅ تم إضافة ${data.data.length} عنصر للطلب بنجاح`);
      }
    })
    .catch(error => {
      console.error('❌ خطأ في محاكاة الطلب:', error);
    });
  };
  
  // دالة لاستخراج النتائج
  window.getOrderResults = function() {
    return {
      requests: window.supabaseRequests,
      orders: window.orderResults,
      timestamp: new Date().toISOString()
    };
  };
  
  console.log('تم بدء التتبع. استخدم دالة "simulateOrder()" لمحاكاة إنشاء طلب و "getOrderResults()" للحصول على النتائج.');
})();

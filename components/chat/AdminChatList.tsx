'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { 
  getAllConversations, 
  subscribeToAllConversations,
  Conversation
} from '@/lib/chat';
import AdminChatWindow from './AdminChatWindow';
import { FiMessageCircle, FiUser, FiSearch } from 'react-icons/fi';
import { usePathname } from 'next/navigation';

interface AdminChatListProps {
  isStandalonePage?: boolean;
}

export default function AdminChatList({ isStandalonePage = false }: AdminChatListProps) {
  const { user, isAdmin } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const pathname = usePathname();
  
  const containerRef = useRef<HTMLDivElement>(null);
  let hideTimeout: NodeJS.Timeout | null = null;
  
  // Check if we're on the standalone page
  const isStandalone = isStandalonePage || pathname === '/chat-page';
  
  // تحميل بيانات المحادثات
  useEffect(() => {
    if (!user || !isAdmin) return;
    
    async function loadConversations() {
      try {
        setLoading(true);
        
        const { data, error } = await getAllConversations();
        
        if (error) throw error;
        
        setConversations(data || []);
      } catch (error: any) {
        console.error('Error loading conversations:', error);
        setError(error.message || 'حدث خطأ أثناء تحميل قائمة المحادثات');
      } finally {
        setLoading(false);
      }
    }
    
    loadConversations();
  }, [user, isAdmin]);
  
  // الاستماع للمحادثات الجديدة
  useEffect(() => {
    if (!user || !isAdmin) return;
    
    const subscription = subscribeToAllConversations((updatedConversation) => {
      setConversations(prev => {
        // التحقق مما إذا كانت المحادثة موجودة بالفعل
        const existingIndex = prev.findIndex(c => c.id === updatedConversation.id);
        
        if (existingIndex !== -1) {
          // تحديث المحادثة الموجودة
          const updated = [...prev];
          updated[existingIndex] = {
            ...updatedConversation,
            username: prev[existingIndex].username, // الحفاظ على اسم المستخدم
            unread_count: prev[existingIndex].unread_count // الحفاظ على عدد الرسائل غير المقروءة
          };
          
          // إعادة ترتيب المحادثات حسب آخر تحديث
          return updated.sort((a, b) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        } else {
          // إضافة محادثة جديدة
          return [updatedConversation, ...prev];
        }
      });
      
      // تحديث المحادثة المحددة إذا كانت هي التي تم تحديثها
      if (
        selectedConversation &&
        selectedConversation.id === updatedConversation.id &&
        (
          selectedConversation.updated_at !== updatedConversation.updated_at ||
          selectedConversation.last_message !== updatedConversation.last_message
        )
      ) {
        setSelectedConversation(prev => ({
          ...updatedConversation,
          username: prev?.username, // الحفاظ على اسم المستخدم
          unread_count: prev?.unread_count // الحفاظ على عدد الرسائل غير المقروءة
        }));
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [user, isAdmin, selectedConversation]);
  
  // تصفية المحادثات حسب البحث
  const filteredConversations = conversations.filter(conversation => 
    conversation.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // تنسيق التاريخ
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleDateString('ar-EG', {
        month: 'short',
        day: 'numeric',
      });
    }
  };
  
  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };
  
  // عند انتهاء المحادثة (حدث يتم إطلاقه من نافذة المحادثة)
  const handleChatClosed = () => {
    setSelectedConversation(null);
    
    // إعادة تحميل المحادثات لتحديث الحالة
    async function reloadConversations() {
      try {
        const { data } = await getAllConversations();
        if (data) {
          setConversations(data);
        }
      } catch (error) {
        console.error('Error reloading conversations:', error);
      }
    }
    
    reloadConversations();
  };
  
  // منطق إظهار/إخفاء الـ scrollbar - تم إزالته لإظهار الـ scrollbar بشكل دائم
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // لا نحتاج إلى إخفاء الـ scrollbar بعد الآن
    return () => {
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, []);
  
  useEffect(() => {
    if (isStandalone) {
      // إذا كنا في وضع الصفحة المستقلة، نخفي العناصر الأخرى
      const sidebarElements = document.querySelectorAll('.md\\:block.bg-white.shadow-md.w-full.md\\:w-64, .md\\:hidden.bg-white.shadow-md');
      sidebarElements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.display = 'none';
        }
      });
      
      // تغيير نمط المحتوى الرئيسي
      const mainContent = document.querySelector('.flex-1.overflow-auto');
      if (mainContent instanceof HTMLElement) {
        mainContent.style.padding = '0';
        mainContent.style.overflow = 'hidden';
      }
    }
    
    return () => {
      // إعادة إظهار العناصر عند إزالة المكون
      if (isStandalone) {
        const sidebarElements = document.querySelectorAll('.md\\:block.bg-white.shadow-md.w-full.md\\:w-64, .md\\:hidden.bg-white.shadow-md');
        sidebarElements.forEach(el => {
          if (el instanceof HTMLElement) {
            el.style.display = '';
          }
        });
        
        // إعادة نمط المحتوى الرئيسي
        const mainContent = document.querySelector('.flex-1.overflow-auto');
        if (mainContent instanceof HTMLElement) {
          mainContent.style.padding = '';
          mainContent.style.overflow = '';
        }
      }
    };
  }, [isStandalone]);
  
  if (!user) {
    return (
      <div className="text-center py-8">
        <p>يرجى تسجيل الدخول للوصول إلى المحادثات</p>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <p>يتطلب الوصول إلى هذه الصفحة صلاحيات المشرف</p>
      </div>
    );
  }
  
  // تخصيص النمط للوضع المستقل
  const containerStyle = isStandalone 
    ? { 
        height: 'calc(100vh - 80px)', // زيادة الارتفاع لملء المساحة المتاحة
        width: '100%', 
        margin: '0', 
        borderRadius: '0', 
        boxShadow: 'none',
        position: 'relative',
        zIndex: 999
      } 
    : { 
        height: '700px', 
        width: '1200px', 
        maxWidth: '100%',
        margin: '0 auto',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      };
  
  return (
    <div 
      ref={containerRef} 
      className="flex bg-white h-full w-full overflow-hidden main-admin-chat-container custom-admin-chat-box" 
      style={containerStyle}
    >
      {/* قائمة المحادثات */}
      <div className={`w-full md:w-80 border-l flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="bg-[#5D1F1F] text-white p-4">
          <h1 className="text-xl font-bold">المحادثات</h1>
        </div>
        
        {/* حقل البحث */}
        <div className="p-3 border-b">
          <div className="relative">
            <FiSearch className="absolute top-3 right-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث عن مستخدم..."
              className="w-full p-2 pl-10 pr-10 border rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#5D1F1F] focus:border-transparent"
            />
          </div>
        </div>
        
        {/* قائمة المحادثات */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-4">
              {error}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center text-gray-500 p-4">
              {searchTerm ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد محادثات'}
            </div>
          ) : (
            filteredConversations.map(conversation => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                className={`p-3 border-b cursor-pointer hover:bg-gray-100 transition-colors ${
                  selectedConversation?.id === conversation.id ? 'bg-gray-100' : ''
                } ${!conversation.is_read_by_admin ? 'bg-[#5d1f1f]/5' : ''}`}
              >
                <div className="flex items-center mb-1">
                  <div className="bg-[#5D1F1F] text-white h-10 w-10 rounded-full flex items-center justify-center mr-3">
                    <FiUser />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold truncate">
                        {conversation.username || 'مستخدم'}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatDate(conversation.updated_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {conversation.last_message || 'بدء محادثة جديدة'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div></div>
                  {!conversation.is_read_by_admin && (conversation.unread_count || 0) > 0 && (
                    <span className="bg-[#5D1F1F] text-white text-xs px-2 py-1 rounded-full">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* نافذة المحادثة */}
      <div className={`flex-1 ${selectedConversation ? 'block' : 'hidden md:block'}`}>
        {selectedConversation ? (
          <AdminChatWindow
            conversation={selectedConversation}
            onBack={() => setSelectedConversation(null)}
          />
        ) : (
          <div className="flex flex-col justify-center items-center h-full bg-gray-50 text-gray-500">
            <FiMessageCircle size={64} className="mb-4 opacity-30" />
            <p>اختر محادثة لعرضها هنا</p>
          </div>
        )}
      </div>
    </div>
  );
} 
'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange, UserProfile, getCurrentUserProfile, isUserAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase-client';

// تعريف نوع سياق المصادقة
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>; // إضافة وظيفة لتحديث الملف الشخصي
}

// إنشاء سياق المصادقة مع قيم افتراضية
const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  refreshProfile: async () => {}, // وظيفة فارغة افتراضية
});

// Helper function to debounce function calls
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// مكون مزود المصادقة
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);
  const profileCacheRef = useRef<{[key: string]: {profile: UserProfile, timestamp: number}}>({});

  // وظيفة لتحديث الملف الشخصي مع debounce وتخزين مؤقت
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    
    // منع التحديثات المتكررة خلال فترة أطول (5 دقائق)
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 300000) { // 5 minutes
      return;
    }
    
    // منع التحديثات المتزامنة
    if (isRefreshingRef.current) {
      return;
    }
    
    // التحقق من التخزين المؤقت مع فترة أطول
    const cachedData = profileCacheRef.current[user.id];
    if (cachedData && (now - cachedData.timestamp < 300000)) { // 5 minutes cache
      setProfile(cachedData.profile);
      setIsAdmin(cachedData.profile.is_admin || false);
      return;
    }
    
    isRefreshingRef.current = true;
    lastRefreshTimeRef.current = now;
    
    try {
      // محاولة الحصول على معلومات المستخدم مباشرة من قاعدة البيانات
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (userError) {
        console.error('خطأ في الحصول على معلومات المستخدم من قاعدة البيانات:', userError);
        return;
      }
      
      if (userData) {
        // تحويل البيانات إلى نموذج UserProfile
        const userProfile: UserProfile = {
          id: userData.id,
          email: userData.email,
          username: userData.username,
          phone: userData.phone,
          address: userData.address,
          governorate: userData.governorate,
          avatar_url: userData.avatar_url,
          is_admin: userData.is_admin,
          role: userData.role || 'customer',
          created_at: userData.created_at,
          updated_at: userData.updated_at
        };
        
        // تخزين البيانات في الذاكرة المؤقتة
        profileCacheRef.current[user.id] = {
          profile: userProfile,
          timestamp: now
        };
        
        setProfile(userProfile);
        setIsAdmin(userProfile.is_admin || false);
      }
    } catch (error) {
      console.error('خطأ غير متوقع أثناء تحديث معلومات المستخدم:', error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [user]);

  // وظيفة لتحميل معلومات المستخدم
  const loadUserProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    
    // التحقق من التخزين المؤقت مع فترة أطول
    const now = Date.now();
    const cachedData = profileCacheRef.current[currentUser.id];
    if (cachedData && (now - cachedData.timestamp < 300000)) { // 5 minutes cache
      setProfile(cachedData.profile);
      setIsAdmin(cachedData.profile.is_admin || false);
      return;
    }
    
    try {
      // محاولة الحصول على معلومات المستخدم بطرق متعددة
      let userProfile: UserProfile | null = null;
      
      // استعلام مباشر
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (!userError && userData) {
          // تحويل البيانات إلى نموذج UserProfile
          userProfile = {
            id: userData.id,
            email: userData.email,
            username: userData.username,
            phone: userData.phone,
            address: userData.address,
            governorate: userData.governorate,
            avatar_url: userData.avatar_url,
            is_admin: userData.is_admin,
            role: userData.role || 'customer',
            created_at: userData.created_at,
            updated_at: userData.updated_at
          };
        }
      } catch (error) {
        console.error('خطأ غير متوقع في الحصول على معلومات المستخدم من قاعدة البيانات:', error);
      }
      
      // إذا تم الحصول على معلومات المستخدم، قم بتحديث الحالة
      if (userProfile) {
        // تخزين البيانات في الذاكرة المؤقتة
        profileCacheRef.current[currentUser.id] = {
          profile: userProfile,
          timestamp: now
        };
        
        setProfile(userProfile);
        setIsAdmin(userProfile.is_admin || false);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('خطأ غير متوقع أثناء تحميل معلومات المستخدم:', error);
      setProfile(null);
      setIsAdmin(false);
    }
  }, []);

  // تطبيق debounce مع فترة أطول لتقليل الطلبات
  const debouncedRefreshProfile = useCallback(
    debounce(() => {
      refreshProfile();
    }, 1000), // 1 second debounce
    [refreshProfile]
  );

  useEffect(() => {
    // التحقق من حالة تسجيل الدخول عند تحميل الصفحة
    const checkUser = async () => {
      try {
        setIsLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        
        // تحميل معلومات المستخدم
        await loadUserProfile(currentUser);
      } catch (error) {
        console.error('Error checking auth state:', error);
        setIsAdmin(false);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkUser();
    
    // الاشتراك بتغييرات حالة المصادقة
    const { data } = onAuthStateChange(async (authUser) => {
      setUser(authUser);
      
      // تحميل معلومات المستخدم عند تغيير حالة المصادقة
      await loadUserProfile(authUser);
      setIsLoading(false);
    });
    
    // إلغاء الاشتراك عند إزالة المكون
    return () => {
      if (data && data.subscription && typeof data.subscription.unsubscribe === 'function') {
        data.subscription.unsubscribe();
      }
    };
  }, [loadUserProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isAdmin, refreshProfile: debouncedRefreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// دالة مساعدة لاستخدام سياق المصادقة
export function useAuth() {
  return useContext(AuthContext);
} 
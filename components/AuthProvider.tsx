'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange, UserProfile, getCurrentUserProfile, isUserAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

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

// مكون مزود المصادقة
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // وظيفة لتحديث الملف الشخصي
  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      console.log('تحديث معلومات المستخدم...');
      
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
        
        setProfile(userProfile);
        setIsAdmin(userProfile.is_admin || false);
        
        console.log('تم تحديث معلومات المستخدم بنجاح:', userProfile);
        console.log('الدور الحالي:', userProfile.role);
        console.log('حالة المشرف:', userProfile.is_admin);
      }
    } catch (error) {
      console.error('خطأ غير متوقع أثناء تحديث معلومات المستخدم:', error);
    }
  };

  // وظيفة لتحميل معلومات المستخدم
  const loadUserProfile = async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    
    try {
      // محاولة الحصول على معلومات المستخدم بطرق متعددة
      let userProfile: UserProfile | null = null;
      
      // الطريقة 1: استخدام وظيفة get_current_user
      try {
        userProfile = await getCurrentUserProfile();
        if (userProfile) {
          console.log('تم الحصول على معلومات المستخدم باستخدام get_current_user:', userProfile);
        }
      } catch (error) {
        console.error('خطأ في الحصول على معلومات المستخدم باستخدام get_current_user:', error);
      }
      
      // الطريقة 2: إذا فشلت الطريقة الأولى، استخدم استعلام مباشر
      if (!userProfile) {
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();
          
          if (userError) {
            console.error('خطأ في الحصول على معلومات المستخدم من قاعدة البيانات:', userError);
          } else if (userData) {
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
            
            console.log('تم الحصول على معلومات المستخدم باستخدام استعلام مباشر:', userProfile);
          }
        } catch (error) {
          console.error('خطأ غير متوقع في الحصول على معلومات المستخدم من قاعدة البيانات:', error);
        }
      }
      
      // إذا تم الحصول على معلومات المستخدم، قم بتحديث الحالة
      if (userProfile) {
        setProfile(userProfile);
        setIsAdmin(userProfile.is_admin || false);
        
        console.log('AuthProvider - User Profile:', userProfile);
        console.log('AuthProvider - User Role:', userProfile.role);
        console.log('AuthProvider - Is Admin:', userProfile.is_admin);
      } else {
        console.error('فشل في الحصول على معلومات المستخدم بجميع الطرق');
        setProfile(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('خطأ غير متوقع أثناء تحميل معلومات المستخدم:', error);
      setProfile(null);
      setIsAdmin(false);
    }
  };

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
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// دالة مساعدة لاستخدام سياق المصادقة
export function useAuth() {
  return useContext(AuthContext);
} 
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, signUp } from '@/lib/auth'; // استيراد عميل supabase وفنكشن التسجيل

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // تنظيف البريد الإلكتروني من المسافات
    const cleanEmail = email.trim();
    
    // التحقق من تطابق كلمات المرور
    if (password !== confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      return;
    }
    
    // التحقق من صحة البريد الإلكتروني - استخدام نمط أكثر تساهلاً
    // const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // تحقق مبسط للبريد الإلكتروني - فقط التأكد من وجود @ ونقطة
    const emailPattern = /^.+@.+\..+$/;
    if (!emailPattern.test(cleanEmail)) {
      setError('يرجى إدخال بريد إلكتروني صحيح يحتوي على @ ونطاق مثل example@domain.com');
      return;
    }
    
    // التحقق من قوة كلمة المرور
    if (password.length < 6) {
      setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل');
      return;
    }
    
    // التحقق من إدخال اسم المستخدم
    if (!username.trim()) {
      setError('الرجاء إدخال اسم المستخدم');
      return;
    }
    
    if (username.length < 3) {
      setError('يجب أن يكون اسم المستخدم 3 أحرف على الأقل');
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      console.log('Attempting to sign up with:', {
        email: cleanEmail,
        username,
        passwordLength: password.length
      });

      // استخدام دالة signUp مباشرة من lib/auth
      const { data, error: signUpError } = await signUp(cleanEmail, password, username);
      
      console.log('Registration result:', { success: !!data, error: signUpError });
      
      if (signUpError) {
        // فشل التسجيل
        console.error('Signup error details:', signUpError);
        
        // معالجة أنواع الأخطاء الشائعة
        if (signUpError.message?.includes('already exists')) {
          setError('البريد الإلكتروني مستخدم بالفعل. يرجى استخدام بريد إلكتروني آخر أو تسجيل الدخول.');
        } else if (signUpError.message?.includes('email')) {
          setError('البريد الإلكتروني غير صالح. يرجى التحقق من صحة البريد الإلكتروني.');
        } else if (signUpError.message?.includes('username')) {
          setError('اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر');
        } else {
          setError(signUpError.message || 'حدث خطأ أثناء التسجيل');
        }
        setLoading(false);
        return;
      }
      
      // تسجيل الدخول تلقائياً بعد إنشاء الحساب بنجاح
      setMessage('تم إنشاء الحساب بنجاح! جاري تسجيل الدخول...');
      
      // استخدام signInWithPassword لتسجيل الدخول مباشرة
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (signInError) {
        console.error('Error signing in automatically:', signInError);
        setMessage('تم إنشاء الحساب بنجاح، ولكن فشل تسجيل الدخول التلقائي. يرجى تسجيل الدخول يدوياً.');
        
        // توجيه المستخدم إلى صفحة تسجيل الدخول بعد 3 ثوان
        setTimeout(() => {
          router.push('/login');
        }, 3000);
        return;
      }
      
      // نجح تسجيل الدخول
      console.log('Automatic sign in successful:', signInData);
      setMessage('تم إنشاء الحساب وتسجيل الدخول بنجاح! جاري تحويلك...');
      
      // إعادة التوجيه إلى الصفحة الرئيسية بعد ثانية واحدة
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err) {
      console.error('Registration error details:', err);
      setError('حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center mb-6">إنشاء حساب جديد</h1>
        
        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
            <div className="flex justify-between items-start">
              <div>{error}</div>
              <button 
                onClick={() => setError(null)}
                className="text-red-700 font-bold"
              >
                ×
              </button>
            </div>
            <div className="mt-2 text-center">
              <button 
                onClick={() => setError(null)}
                className="text-sm text-blue-600 underline"
              >
                محاولة مرة أخرى
              </button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
              اسم المستخدم <span className="text-red-500">*</span>
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              البريد الإلكتروني <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              كلمة المرور <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
              تأكيد كلمة المرور <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
              disabled={loading}
            >
              {loading ? 'جاري التسجيل...' : 'تسجيل'}
            </button>
          </div>
        </form>
        
        <div className="text-center mt-4">
          <p className="text-gray-600 text-sm">
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="text-blue-500 hover:text-blue-700">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 
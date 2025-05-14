'use client';

import { useState, useEffect } from 'react';
import AdminHeader from '@/components/admin/AdminHeader';
import Spinner from '@/components/ui/Spinner';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase'; // استيراد عميل Supabase من الملف المشترك

interface User {
  id: string;
  email: string;
  username?: string;
  role?: string;
  is_admin?: boolean;
  created_at: string;
}

const roleLabels = {
  customer: 'عميل عادي (سعر القطعة فقط)',
  wholesale: 'تاجر جملة (سعر الجملة فقط)',
  preparation: 'تحضير طلبات (بدون أسعار)',
  full_details: 'تفاصيل شاملة (كلا السعرين)'
};

export default function PermissionsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  // جلب المستخدمين عند تحميل الصفحة
  useEffect(() => {
    fetchUsers();
  }, []);

  // جلب بيانات المستخدمين
  async function fetchUsers() {
    setLoading(true);
    setError(null);

    try {
      // استخدام public.users بدلاً من auth.users واستبعاد المستخدمين الإداريين
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_admin', false); // استبعاد الأدمن (فقط المستخدمين الذين is_admin = false)

      if (error) {
        throw error;
      }

      // تجهيز بيانات المستخدمين
      const processedUsers = (data || []).map(user => {
        return {
          ...user,
          role: user.role || 'customer'
        };
      });

      console.log('Fetched users:', processedUsers);
      setUsers(processedUsers);
    } catch (error: any) {
      console.error('خطأ في جلب بيانات المستخدمين:', error);
      setError(error.message || 'حدث خطأ أثناء جلب بيانات المستخدمين');
      toast.error('حدث خطأ أثناء جلب بيانات المستخدمين');
    } finally {
      setLoading(false);
    }
  }

  // تحديث صلاحية المستخدم
  async function handleRoleChange(userId: string, newRole: string) {
    if (updatingUser) return; // منع التحديثات المتزامنة
    
    setUpdatingUser(userId);
    console.log(`Updating user ${userId} role to ${newRole}`);
    
    try {
      // تحديث دور المستخدم (مع التأكد من أن is_admin يظل false)
      const { error } = await supabase
        .from('users')
        .update({ 
          role: newRole,
          is_admin: false // دائمًا نضمن أن المستخدم ليس مشرفًا
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      // تحديث البيانات محلياً
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, role: newRole, is_admin: false } 
            : user
        )
      );
      toast.success('تم تحديث صلاحيات المستخدم بنجاح');
      console.log(`Successfully updated user ${userId} role to ${newRole}`);
      
      // إعادة تحميل بيانات المستخدمين للتأكد من التحديث
      fetchUsers();
    } catch (error: any) {
      console.error('خطأ في تحديث صلاحيات المستخدم:', error);
      toast.error('حدث خطأ أثناء تحديث الصلاحيات');
    } finally {
      setUpdatingUser(null);
    }
  }

  // تصفية المستخدمين حسب البحث
  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">إدارة صلاحيات المستخدمين</h1>
          
          <div className="mb-6">
            <input
              type="text"
              placeholder="البحث عن مستخدم..."
              className="w-full p-3 border border-gray-300 rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
              <button 
                className="mr-3 px-2 py-1 bg-red-200 rounded-md hover:bg-red-300"
                onClick={fetchUsers}
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Spinner />
            </div>
          ) : (
            <div className="overflow-x-auto">
              {users.length === 0 ? (
                <p className="text-center py-8 text-gray-600">
                  لا يوجد مستخدمين للعرض
                </p>
              ) : (
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        البريد الإلكتروني
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        اسم المستخدم
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الصلاحية
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => {
                        const userRole = user.role || 'customer';
                        const isUpdating = updatingUser === user.id;
                        
                        return (
                          <tr key={user.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.username || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${userRole === 'wholesale' ? 'bg-green-100 text-green-800' : 
                                  userRole === 'preparation' ? 'bg-yellow-100 text-yellow-800' : 
                                  userRole === 'full_details' ? 'bg-blue-100 text-blue-800' : 
                                  'bg-gray-100 text-gray-800'}`}>
                                {roleLabels[userRole as keyof typeof roleLabels] || 'عميل عادي'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {isUpdating ? (
                                <div className="flex justify-center">
                                  <Spinner size="sm" />
                                </div>
                              ) : (
                                <select
                                  className="block w-full p-2 border border-gray-300 rounded-md"
                                  value={userRole}
                                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                  disabled={isUpdating}
                                >
                                  <option value="customer">عميل عادي</option>
                                  <option value="wholesale">تاجر جملة</option>
                                  <option value="preparation">تحضير طلبات</option>
                                  <option value="full_details">تفاصيل شاملة</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                          لا توجد نتائج مطابقة للبحث
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 
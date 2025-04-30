"use client";

import React, { useEffect, useState } from 'react';
import { getErrorHistory, getSyncStatus, SupabaseErrorDetails, SupabaseErrorType } from '@/lib/supabase-error-handler';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import SyncStatusIndicator from '@/components/admin/SyncStatusIndicator';
import { AlertCircle, Clock, CloudOff, RefreshCw, Trash2 } from 'lucide-react';

export default function SyncLogsPage() {
  const [errorHistory, setErrorHistory] = useState<SupabaseErrorDetails[]>([]);
  const [syncStatus, setSyncStatus] = useState(getSyncStatus());
  
  useEffect(() => {
    const updateData = () => {
      setErrorHistory(getErrorHistory());
      setSyncStatus(getSyncStatus());
    };
    
    updateData();
    
    // تحديث كل 15 ثانية
    const intervalId = setInterval(updateData, 15000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // تحديد لون البطاقة بناءً على نوع الخطأ
  const getErrorTypeColor = (type: SupabaseErrorType) => {
    switch (type) {
      case SupabaseErrorType.CONNECTION:
        return 'bg-amber-100 border-amber-300';
      case SupabaseErrorType.RLS_POLICY:
        return 'bg-purple-100 border-purple-300';
      case SupabaseErrorType.AUTHENTICATION:
        return 'bg-blue-100 border-blue-300';
      case SupabaseErrorType.DATA_STRUCTURE:
        return 'bg-orange-100 border-orange-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };
  
  // تحديد لون البطاقة بناءً على نوع الخطأ
  const getErrorTypeBadge = (type: SupabaseErrorType) => {
    switch (type) {
      case SupabaseErrorType.CONNECTION:
        return <Badge variant="outline" className="bg-amber-500 text-white">اتصال</Badge>;
      case SupabaseErrorType.RLS_POLICY:
        return <Badge variant="outline" className="bg-purple-500 text-white">سياسة أمان</Badge>;
      case SupabaseErrorType.AUTHENTICATION:
        return <Badge variant="outline" className="bg-blue-500 text-white">مصادقة</Badge>;
      case SupabaseErrorType.DATA_STRUCTURE:
        return <Badge variant="outline" className="bg-orange-500 text-white">بنية البيانات</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-500 text-white">غير معروف</Badge>;
    }
  };
  
  // تنسيق التاريخ
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ar-SA');
  };
  
  // مسح سجل الأخطاء
  const handleClearHistory = () => {
    if (typeof window !== 'undefined') {
      // للتبسيط، إعادة تحميل الصفحة بعد مسح السجل
      window.location.reload();
    }
  };
  
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">سجل المزامنة</h1>
          <p className="text-gray-500">تتبع عمليات المزامنة والأخطاء مع Supabase</p>
        </div>
        <SyncStatusIndicator />
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 ml-2" />
            ملخص حالة المزامنة
          </CardTitle>
          <CardDescription>
            معلومات عن آخر عمليات المزامنة والاتصال بالخادم
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-md p-4">
              <h3 className="text-sm font-medium mb-2">حالة الاتصال</h3>
              <div className="flex items-center">
                {syncStatus.isOnline ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                    <span>متصل بالإنترنت</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full bg-[#5D1F1F] mr-2"></div>
                    <span>غير متصل بالإنترنت</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="border rounded-md p-4">
              <h3 className="text-sm font-medium mb-2">آخر مزامنة ناجحة</h3>
              <div className="text-sm">
                {syncStatus.lastSuccessfulSync ? (
                  formatDate(syncStatus.lastSuccessfulSync)
                ) : (
                  <span className="text-gray-500">لم تتم مزامنة ناجحة بعد</span>
                )}
              </div>
            </div>
            
            <div className="border rounded-md p-4">
              <h3 className="text-sm font-medium mb-2">آخر محاولة مزامنة</h3>
              <div className="text-sm">
                {syncStatus.lastAttemptedSync > 0 ? (
                  formatDate(syncStatus.lastAttemptedSync)
                ) : (
                  <span className="text-gray-500">لم تتم محاولة مزامنة بعد</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">سجل الأخطاء ({errorHistory.length})</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClearHistory}>
            <Trash2 className="w-4 h-4 ml-1" />
            مسح السجل
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 ml-1" />
            تحديث
          </Button>
        </div>
      </div>
      
      {errorHistory.length === 0 ? (
        <Card className="bg-gray-50 border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-blue-100 text-blue-800 p-3 rounded-full mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-center mb-1">لا توجد أخطاء مسجلة</h3>
            <p className="text-gray-500 text-center">لم يتم تسجيل أي أخطاء مزامنة حتى الآن</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {errorHistory.map((error, index) => (
            <Card key={index} className={`border-2 ${getErrorTypeColor(error.type)}`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg flex items-center">
                    <span className="ml-2">{error.message}</span>
                    {getErrorTypeBadge(error.type)}
                  </CardTitle>
                  <span className="text-sm text-gray-500">{formatDate(error.timestamp)}</span>
                </div>
                <CardDescription>{error.userFriendlyMessage}</CardDescription>
              </CardHeader>
              
              <CardContent className="pt-0">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="details">
                    <AccordionTrigger>تفاصيل إضافية</AccordionTrigger>
                    <AccordionContent>
                      {error.technicalDetails && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold mb-1">تفاصيل تقنية:</h4>
                          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto rtl:text-right">
                            {error.technicalDetails}
                          </pre>
                        </div>
                      )}
                      
                      {error.suggestions && error.suggestions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">اقتراحات الحل:</h4>
                          <ul className="list-disc list-inside text-sm">
                            {error.suggestions.map((suggestion, idx) => (
                              <li key={idx}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 
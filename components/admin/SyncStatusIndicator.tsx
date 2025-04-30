"use client";

import React, { useEffect, useState } from 'react';
import { getSyncStatus, SyncStatus } from '@/lib/supabase-error-handler';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CloudOff, Check, RefreshCw, AlertCircle } from 'lucide-react';

/**
 * مكون لعرض حالة المزامنة مع خادم Supabase
 */
export default function SyncStatusIndicator() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSuccessfulSync: null,
    lastAttemptedSync: 0,
    lastError: null,
    isOnline: true
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // تحديث حالة المزامنة كل 30 ثانية
  useEffect(() => {
    const updateStatus = () => {
      setSyncStatus(getSyncStatus());
    };
    
    // تحديث عند التحميل
    updateStatus();
    
    // إعداد التحديث الدوري
    const intervalId = setInterval(updateStatus, 30000);
    
    // تحديث عند تغيير حالة الاتصال بالإنترنت
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  // تنسيق التاريخ بالعربية
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'لم تتم المزامنة بعد';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) return 'منذ أقل من دقيقة';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    
    // تنسيق التاريخ للأيام السابقة
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('ar-SA', options);
  };

  // تحديد حالة المزامنة ولونها
  const getSyncStatusInfo = () => {
    if (!syncStatus.isOnline) {
      return {
        color: 'bg-yellow-500',
        text: 'غير متصل بالإنترنت',
        icon: <CloudOff className="w-4 h-4 ml-1" />
      };
    }
    
    if (syncStatus.lastError) {
      return {
        color: 'bg-[#5D1F1F]',
        text: 'فشل المزامنة',
        icon: <AlertCircle className="w-4 h-4 ml-1" />
      };
    }
    
    if (syncStatus.lastSuccessfulSync) {
      return {
        color: 'bg-green-500',
        text: 'متزامن',
        icon: <Check className="w-4 h-4 ml-1" />
      };
    }
    
    return {
      color: 'bg-gray-500',
      text: 'لم تتم المزامنة بعد',
      icon: <CloudOff className="w-4 h-4 ml-1" />
    };
  };

  const statusInfo = getSyncStatusInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 p-2 rounded-md border border-gray-200 bg-white shadow-sm cursor-default">
            <Badge variant="outline" className={`${statusInfo.color} text-white flex items-center`}>
              {statusInfo.icon}
              <span className="mx-1">{statusInfo.text}</span>
            </Badge>
            
            {syncStatus.lastSuccessfulSync && (
              <div className="text-xs text-gray-500">
                آخر مزامنة: {formatDate(syncStatus.lastSuccessfulSync)}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-xs">
            {syncStatus.lastError ? (
              <div>
                <p className="font-bold">معلومات الخطأ:</p>
                <p>{syncStatus.lastError.userFriendlyMessage}</p>
                {syncStatus.lastError.suggestions && (
                  <div className="mt-1">
                    <p className="font-semibold">اقتراحات:</p>
                    <ul className="list-disc list-inside">
                      {syncStatus.lastError.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="text-sm">{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p>حالة المزامنة: {statusInfo.text}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 
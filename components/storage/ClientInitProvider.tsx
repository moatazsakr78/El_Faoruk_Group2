'use client';

import InitLocalStorage from './InitLocalStorage';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';
import RefreshUserRoles from '../RefreshUserRoles';

// هذا المكون مخصص فقط للاستخدام على جانب العميل 
// ويتم تنفيذه فقط في المتصفح
export default function ClientInitProvider() {
  return (
    <>
      <InitLocalStorage />
      <ServiceWorkerRegistration />
      <RefreshUserRoles />
    </>
  );
} 
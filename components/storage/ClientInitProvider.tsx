'use client';

import InitLocalStorage from './InitLocalStorage';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';
import DatabaseInitializer from './DatabaseInitializer';
import FixRolesMigration from '../FixRolesMigration';
import RefreshUserRoles from '../RefreshUserRoles';

// هذا المكون مخصص فقط للاستخدام على جانب العميل 
// ويتم تنفيذه فقط في المتصفح
export default function ClientInitProvider() {
  return (
    <>
      <InitLocalStorage />
      <ServiceWorkerRegistration />
      <DatabaseInitializer />
      <FixRolesMigration />
      <RefreshUserRoles />
    </>
  );
} 
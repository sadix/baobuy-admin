// app/(dashboard)/layout.tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/admin-auth';
import { AdminNav } from '@/components/AdminNav';
import { LogoutButton } from '@/components/LogoutButton';

export const metadata: Metadata = {
  title: 'BaoBuy · Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Second layer after middleware — never rely on middleware alone.
  const admin = await getAdmin();
  if (!admin) redirect('/login');

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 shrink-0 border-r bg-white flex flex-col">
        <div className="px-4 py-4 border-b">
          <p className="font-bold text-lg">BaoBuy</p>
          <p className="text-xs text-gray-500">Admin</p>
        </div>
        <AdminNav />
        <div className="mt-auto px-4 py-3 border-t">
          <p className="text-xs text-gray-500 truncate" title={admin.email}>{admin.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6 space-y-6">{children}</main>
    </div>
  );
}

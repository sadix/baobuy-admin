// components/LogoutButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/login');
        router.refresh();
      }}
      className="flex items-center gap-2 text-xs text-gray-600 hover:text-red-700 mt-2"
    >
      <LogOut className="w-3 h-3" /> Sign out
    </button>
  );
}

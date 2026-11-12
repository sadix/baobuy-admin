// components/AdminNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, CreditCard, Store, Palette,
  FolderOpen, Package, ShoppingCart, LogIn, ScrollText,
} from 'lucide-react';
import { RESOURCES, RESOURCE_ORDER } from '@/lib/resources';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users, subscriptions: CreditCard, shops: Store, themes: Palette,
  collections: FolderOpen, products: Package, orders: ShoppingCart,
  logins: LogIn, audit: ScrollText,
};

export function AdminNav() {
  const pathname = usePathname();

  const items = [
    { href: '/', label: 'Overview', Icon: LayoutDashboard, exact: true },
    ...RESOURCE_ORDER.map((key) => ({
      href: `/${key}`,
      label: RESOURCES[key].label,
      Icon: ICONS[key] ?? ScrollText,
      exact: false,
    })),
  ];

  return (
    <nav className="p-2 space-y-1 overflow-y-auto">
      {items.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
              active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

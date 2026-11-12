// lib/resources.ts
// Single source of truth for the dashboard: drives the API (whitelisted fields, search, select)
// AND the UI (columns, edit forms). Safe to import on client + server.
//
// SECURITY: every resource uses an explicit `select`, so sensitive columns (password hashes,
// encrypted Wave/Orange credentials, tokens) are NEVER returned. Only fields listed in `fields`
// can be written through the API.
//
// NOTE: model / field / enum names are assumptions based on the BaoBuy domain — adjust each
// to match the schema.prisma you copied from the main app.

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'datetime' | 'json';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  nullable?: boolean;
}

export type ColumnType = 'text' | 'date' | 'bool' | 'badge' | 'money' | 'json';

export interface ColumnDef {
  key: string; // dot-path supported, e.g. "owner.email" or "_count.products"
  label: string;
  type?: ColumnType;
}

export interface ResourceConfig {
  key: string;
  label: string;
  description: string;
  model: string; // prisma delegate name (camelCase)
  search: string[]; // dot-paths searched with case-insensitive "contains"
  orderBy: Record<string, 'asc' | 'desc'>;
  select: Record<string, unknown>;
  columns: ColumnDef[];
  fields: FieldDef[]; // editable whitelist (empty => read-only)
  filter?: { key: string; label: string; options: string[] };
  canDelete?: boolean;
  readOnly?: boolean;
}

// NOTE: must match your Prisma enums / string values exactly.
const PLANS = ['FREE', 'STARTER', 'PRO', 'BUSINESS'];
const SUB_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'];
const SECTORS = ['general', 'fashion', 'electronics', 'food', 'beauty', 'lingerie', 'toys', 'cars'];
const ORDER_STATUSES = ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED'];

export const RESOURCES: Record<string, ResourceConfig> = {
  users: {
    key: 'users',
    label: 'Users',
    description: 'Registrations, logins and account status (shop owners)',
    model: 'user',
    search: ['name', 'email'],
    orderBy: { created_at: 'desc' },
    select: {
      id: true, name: true, email: true, emailVerified: true, created_at: true,
      lastLoginAt: true, isSuspended: true,
      _count: { select: { shops: true } },
    },
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: '_count.shops', label: 'Shops' },
      { key: 'created_at', label: 'Registered', type: 'date' },
      { key: 'lastLoginAt', label: 'Last login', type: 'date' },
      { key: 'isSuspended', label: 'Suspended', type: 'bool' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', nullable: true },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'emailVerified', label: 'Email verified at', type: 'datetime', nullable: true },
      { key: 'isSuspended', label: 'Suspended (blocks login)', type: 'boolean' },
    ],
    canDelete: true,
  },

  subscriptions: {
    key: 'subscriptions',
    label: 'Subscriptions',
    description: 'Plans, trials and billing periods',
    model: 'subscription', // NOTE: if plan/status live on User, switch to model 'user' + adapt select/columns
    search: ['user.email', 'user.name'],
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, plan: true, status: true, trialEndsAt: true, currentPeriodEnd: true, createdAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
    columns: [
      { key: 'user.email', label: 'User' },
      { key: 'plan', label: 'Plan', type: 'badge' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'trialEndsAt', label: 'Trial ends', type: 'date' },
      { key: 'currentPeriodEnd', label: 'Period ends', type: 'date' },
      { key: 'created_at', label: 'Created', type: 'date' },
    ],
    fields: [
      { key: 'plan', label: 'Plan', type: 'select', options: PLANS },
      { key: 'status', label: 'Status', type: 'select', options: SUB_STATUSES },
      { key: 'trialEndsAt', label: 'Trial ends at', type: 'datetime', nullable: true },
      { key: 'currentPeriodEnd', label: 'Current period ends at', type: 'datetime', nullable: true },
    ],
    filter: { key: 'status', label: 'All statuses', options: SUB_STATUSES },
  },

  shops: {
    key: 'shops',
    label: 'Shops',
    description: 'Every merchant store on the platform',
    model: 'shop',
    search: ['name', 'subdomain', 'owner.email'],
    orderBy: { created_at: 'desc' },
    select: {
      id: true, name: true, subdomain: true,  created_at: true,
      user: { select: { id: true, email: true, name: true } },
      _count: { select: { products: true, orders: true } },
    },
    columns: [
      { key: 'name', label: 'Shop' },
      { key: 'subdomain', label: 'Subdomain' },
      { key: 'user.email', label: 'Owner' },
      { key: '_count.products', label: 'Products' },
      { key: '_count.orders', label: 'Orders' },
      //{ key: 'isActive', label: 'Active', type: 'bool' },
      { key: 'created_at', label: 'Created', type: 'date' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'subdomain', label: 'Subdomain', type: 'text' },
      { key: 'isActive', label: 'Active (storefront online)', type: 'boolean' },
    ],
    canDelete: true,
  },

  themes: {
    key: 'themes',
    label: 'Themes',
    description: 'Per-shop sector preset and design-token overrides',
    model: 'shop',
    search: ['name', 'subdomain', 'user.email'],
    orderBy: { created_at: 'desc' },
    select: {
      id: true, name: true, subdomain: true, description: true, themeOverrides: true,
      user: { select: { email: true } },
    },
    columns: [
      { key: 'name', label: 'Shop' },
      { key: 'subdomain', label: 'Subdomain' },
      { key: 'user.email', label: 'Owner' },
      { key: 'sector', label: 'Sector', type: 'badge' },
      { key: 'themeOverrides', label: 'Overrides', type: 'json' },
    ],
    fields: [
      { key: 'sector', label: 'Sector preset', type: 'select', options: SECTORS },
      // NOTE: rename `themeOverrides` to your actual per-shop JSON override column.
      { key: 'themeOverrides', label: 'Theme overrides (JSON, empty = defaults)', type: 'json', nullable: true },
    ],
    filter: { key: 'sector', label: 'All sectors', options: SECTORS },
  },

  collections: {
    key: 'collections',
    label: 'Collections',
    description: 'Product collections across all shops',
    model: 'category', // NOTE: adjust to your actual collection model name
    search: ['name', 'slug', 'shop.name'],
    orderBy: { created_at: 'desc' },
    select: {
      id: true, name: true, slug: true, description: true, created_at: true,
      shop: { select: { id: true, name: true, subdomain: true } },
      _count: { select: { products: true } },
    },
    columns: [
      { key: 'name', label: 'Collection' },
      { key: 'slug', label: 'Slug' },
      { key: 'shop.name', label: 'Shop' },
      { key: '_count.products', label: 'Products' },
      { key: 'created_at', label: 'Created', type: 'date' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'slug', label: 'Slug', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', nullable: true },
    ],
    canDelete: true,
  },

  products: {
    key: 'products',
    label: 'Products',
    description: 'Catalogue moderation across all shops',
    model: 'product',
    search: ['name', 'shop.name'],
    orderBy: { created_at: 'desc' },
    select: {
      id: true, name: true, images: true, description: true, price: true, stock: true, published: true, created_at: true,
      shop: { select: { id: true, name: true, subdomain: true } },
    },
    columns: [
      { key: 'name', label: 'Product' },
      { key: 'shop.name', label: 'Shop' },
      { key: 'price', label: 'Price', type: 'money' },
      { key: 'stock', label: 'Stock' },
      { key: 'published', label: 'Active', type: 'bool' },
      { key: 'created_at', label: 'Created', type: 'date' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', nullable: true },
      { key: 'price', label: 'Price', type: 'number' },
      { key: 'stock', label: 'Stock', type: 'number' },
      { key: 'published', label: 'Active (visible on storefront)', type: 'boolean' },
    ],
    canDelete: true,
  },

  orders: {
    key: 'orders',
    label: 'Orders',
    description: 'All orders — status can be corrected, never deleted',
    model: 'order',
    search: ['id', 'shop.name'],
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, total: true, status: true, createdAt: true,
      shop: { select: { id: true, name: true, subdomain: true } },
    },
    columns: [
      { key: 'id', label: 'Order' },
      { key: 'shop.name', label: 'Shop' },
      { key: 'total', label: 'Total', type: 'money' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'created_at', label: 'Placed', type: 'date' },
    ],
    fields: [{ key: 'status', label: 'Status', type: 'select', options: ORDER_STATUSES }],
    filter: { key: 'status', label: 'All statuses', options: ORDER_STATUSES },
  },

  logins: {
    key: 'logins',
    label: 'Login activity',
    description: 'Every successful shop-owner sign-in (written by the main app)',
    model: 'loginEvent',
    search: ['user.email', 'user.name'],
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, createdAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
    columns: [
      { key: 'created_at', label: 'When', type: 'date' },
      { key: 'user.email', label: 'Email' },
      { key: 'user.name', label: 'Name' },
    ],
    fields: [],
    readOnly: true,
  },

  audit: {
    key: 'audit',
    label: 'Audit log',
    description: 'Every change made from this admin dashboard',
    model: 'auditLog',
    search: ['adminEmail', 'resource', 'targetId', 'action'],
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, adminEmail: true, action: true, resource: true, targetId: true, changes: true, createdAt: true,
    },
    columns: [
      { key: 'created_at', label: 'When', type: 'date' },
      { key: 'adminEmail', label: 'Admin' },
      { key: 'action', label: 'Action', type: 'badge' },
      { key: 'resource', label: 'Resource' },
      { key: 'targetId', label: 'Target' },
      { key: 'changes', label: 'Changes', type: 'json' },
    ],
    fields: [],
    readOnly: true,
  },
};

export const RESOURCE_ORDER = [
  'users', 'subscriptions', 'shops', 'themes', 'collections', 'products', 'orders', 'logins', 'audit',
];

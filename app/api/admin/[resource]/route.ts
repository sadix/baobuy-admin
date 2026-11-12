// app/api/admin/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdmin } from '@/lib/admin-auth';
import { RESOURCES } from '@/lib/resources';
import { buildSearchWhere } from '@/lib/query';

type Ctx = { params: Promise<{ resource: string }> };

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: Ctx) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { resource } = await params;
  const cfg = RESOURCES[resource];
  if (!cfg) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20));
  const q = sp.get('q') || '';
  const filterValue = sp.get('filter') || '';

  const where: Record<string, unknown> = { ...buildSearchWhere(cfg.search, q) };
  // Only accept filter values declared in the config (no arbitrary where-injection).
  if (cfg.filter && filterValue && cfg.filter.options.includes(filterValue)) {
    where[cfg.filter.key] = filterValue;
  }

  const delegate = (prisma as any)[cfg.model];

  try {
    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: cfg.orderBy,
        select: cfg.select,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      delegate.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    console.error(`[admin] list ${resource} failed:`, error);
    return NextResponse.json(
      { error: 'Query failed — check field names in lib/resources.ts against your synced schema.prisma' },
      { status: 500 }
    );
  }
}

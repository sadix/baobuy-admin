// app/api/admin/[resource]/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { RESOURCES } from '@/lib/resources';
import { coerceBody } from '@/lib/query';

type Ctx = { params: Promise<{ resource: string; id: string }> };

async function guard(ctx: Ctx) {
  const admin = await getAdmin();
  if (!admin) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;

  const { resource, id } = await ctx.params;
  const cfg = RESOURCES[resource];
  if (!cfg) return { error: NextResponse.json({ error: 'Unknown resource' }, { status: 404 }) } as const;

  return { admin, cfg, id, resource } as const;
}

function prismaErrorResponse(error: any) {
  if (error?.code === 'P2002') {
    return NextResponse.json({ error: 'That value is already in use (unique constraint)' }, { status: 409 });
  }
  if (error?.code === 'P2003') {
    return NextResponse.json(
      { error: 'Blocked by related records. Remove or reassign them first (or suspend instead of deleting).' },
      { status: 409 }
    );
  }
  if (error?.code === 'P2025') {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }
  console.error('[admin] unexpected error:', error);
  return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const g = await guard(ctx);
  if ('error' in g) return g.error;

  const record = await (prisma as any)[g.cfg.model].findUnique({
    where: { id: g.id },
    select: g.cfg.select,
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const g = await guard(ctx);
  if ('error' in g) return g.error;
  const { admin, cfg, id, resource } = g;

  if (cfg.readOnly || cfg.fields.length === 0) {
    return NextResponse.json({ error: 'This resource is read-only' }, { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { data, errors } = coerceBody(cfg.fields, body);
  if (errors.length) return NextResponse.json({ error: errors.join('. ') }, { status: 400 });
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const delegate = (prisma as any)[cfg.model];

  try {
    const before = await delegate.findUnique({ where: { id }, select: cfg.select });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await delegate.update({ where: { id }, data, select: cfg.select });

    // Record only submitted fields as { field: { from, to } }.
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(data)) {
      changes[key] = { from: before[key] ?? null, to: updated[key] ?? null };
    }
    await logAudit({ adminEmail: admin.email, action: 'UPDATE', resource, targetId: id, changes });

    return NextResponse.json(updated);
  } catch (error) {
    return prismaErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const g = await guard(ctx);
  if ('error' in g) return g.error;
  const { admin, cfg, id, resource } = g;

  if (!cfg.canDelete) {
    return NextResponse.json({ error: 'Deleting is not allowed for this resource' }, { status: 405 });
  }

  const delegate = (prisma as any)[cfg.model];

  try {
    const snapshot = await delegate.findUnique({ where: { id }, select: cfg.select });
    if (!snapshot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await delegate.delete({ where: { id } });
    await logAudit({ adminEmail: admin.email, action: 'DELETE', resource, targetId: id, changes: { deleted: snapshot } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return prismaErrorResponse(error);
  }
}

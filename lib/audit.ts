// lib/audit.ts
import { prisma } from '@/lib/prisma';

export async function logAudit(params: {
  adminEmail: string;
  action: 'UPDATE' | 'DELETE';
  resource: string;
  targetId: string;
  changes?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        adminEmail: params.adminEmail,
        action: params.action,
        resource: params.resource,
        targetId: params.targetId,
        changes: (params.changes ?? undefined) as any,
      },
    });
  } catch (error) {
    // Don't block the admin action if audit logging fails — but make noise.
    console.error('[admin] audit log failed:', error);
  }
}

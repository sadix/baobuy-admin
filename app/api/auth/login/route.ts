// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials } from '@/lib/admin-auth';
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';

// Best-effort brute-force throttle. In-memory => per serverless instance only.
// For hard guarantees add Vercel Firewall rate limiting / IP allowlisting on this project.
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();

  let rec = attempts.get(ip);
  if (rec && now - rec.first >= WINDOW_MS) { attempts.delete(ip); rec = undefined; }
  if (rec && rec.count >= MAX_FAILURES) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  const ok = await verifyCredentials(email, password);
  if (!ok) {
    attempts.set(ip, { count: (rec?.count ?? 0) + 1, first: rec?.first ?? now });
    await sleep(400);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  attempts.delete(ip);
  const token = await signSession(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

// lib/admin-auth.ts — Node runtime only (scrypt + next/headers).
import { cookies } from 'next/headers';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { SESSION_COOKIE, verifySessionToken } from '../lib/session';

interface Account { email: string; salt: string; hash: string }

function accounts(): Account[] {
  return (process.env.ADMIN_ACCOUNTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [email, salt, hash] = entry.split('|');
      return { email: (email || '').toLowerCase(), salt, hash };
    })
    .filter((a) => a.email && a.salt && a.hash);
}

export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  if (!password || password.length > 200) return false;

  const account = accounts().find((a) => a.email === email.toLowerCase());
  // Always run scrypt (even for unknown emails) so response time doesn't reveal valid accounts.
  const salt = Buffer.from(account?.salt ?? '00'.repeat(16), 'hex');
  const derived = scryptSync(password, salt, 64);
  const expected = account ? Buffer.from(account.hash, 'hex') : Buffer.alloc(64);

  const match = derived.length === expected.length && timingSafeEqual(derived, expected);
  return Boolean(account) && match;
}

export interface Admin { email: string }

/**
 * Verifies the session cookie AND that the account still exists in ADMIN_ACCOUNTS
 * (removing an entry from the env revokes that admin's live sessions immediately).
 * Call this in layouts + every route handler — never rely on middleware alone.
 */
export async function getAdmin(): Promise<Admin | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const email = await verifySessionToken(token);
  if (!email) return null;
  if (!accounts().some((a) => a.email === email.toLowerCase())) return null;

  return { email };
}

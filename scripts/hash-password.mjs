// node scripts/hash-password.mjs "your-long-password"
// Prints  saltHex|hashHex  -> paste after "email|" in ADMIN_ACCOUNTS.
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: node scripts/hash-password.mjs "<password of at least 12 characters>"');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`${salt.toString('hex')}|${hash.toString('hex')}`);

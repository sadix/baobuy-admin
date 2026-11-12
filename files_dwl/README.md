# BaoBuy Admin (separate project, shared database)

A standalone Next.js app (own repo, own Vercel project, own domain e.g. `admin.baobuy.site`)
that reads/writes the **same Postgres database** as the main BaoBuy app.

```
 main app (commerce_saas)  ──owns schema + migrations──►  Postgres (Supabase)  ◄──reads/writes──  baobuy-admin
   NextAuth for owners                                                                              own login (env accounts)
   writes LoginEvent / lastLoginAt                                                                  writes AuditLog
```

## 1. Main app changes (small, additive) — `main-app-changes/`

1. `schema.additions.prisma` → merge, then `prisma migrate dev --name admin_support`, deploy migration to prod.
2. `nextauth-hooks.snippet.ts` → block suspended owners + record logins.
3. Make sure storefront honours `shop.isActive`.

## 2. Create the admin project

```bash
npx create-next-app@latest baobuy-admin --ts --tailwind --app --eslint --import-alias "@/*"
cd baobuy-admin
npm i @prisma/client @prisma/adapter-pg pg jose lucide-react
npm i -D prisma dotenv
```

Copy this folder's files over the new project (`app/`, `components/`, `lib/`, `scripts/`,
`middleware.ts`, `next.config.ts`, `prisma.config.ts`, `.env.example`). Don't overwrite `app/layout.tsx` / `globals.css`.

## 3. Schema sync (admin never owns the schema)

Copy the main app's schema as the source of truth and generate a client:

```bash
mkdir -p prisma
cp ../commerce_saas/prisma/schema.prisma prisma/schema.prisma   # adjust path
```

Make sure the generator block matches `lib/prisma.ts` (Prisma 7):

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
```

Add to `package.json` scripts and `.gitignore` (`/generated`):

```json
"sync-schema": "cp ../commerce_saas/prisma/schema.prisma prisma/schema.prisma && prisma generate",
"postinstall": "prisma generate"
```

> Run `npm run sync-schema` after **every** migration in the main app.
> **Never run `prisma migrate` or `prisma db push` from this project.** (Fallback if you don't have the main repo
> locally: `prisma db pull` then re-add the generator block.)

## 4. Env + first admin

```bash
cp .env.example .env.local
openssl rand -base64 48                       # -> ADMIN_SESSION_SECRET
node scripts/hash-password.mjs "a-long-passphrase"   # -> paste after "you@example.com|" in ADMIN_ACCOUNTS
npm run dev
```

`DATABASE_URL` / `DIRECT_URL` = same values as the main app. Add more admins by appending
`,email|salt|hash`; remove an entry to revoke that admin immediately (live sessions included).

## 5. Fix the `// NOTE:` items

`lib/prisma.ts` import path, and in `lib/resources.ts` every model/field/enum that differs from your schema
(`subscription` model, `themeOverrides`, `order.total`, `product.stock`, enum values). A wrong field shows as a
clear error banner on that page.

## 6. Deploy

- New Vercel project from the admin repo, domain `admin.baobuy.site`, env vars from `.env.example`.
- **Strongly recommended:** Vercel Firewall IP allowlist (or Deployment Protection) on this project — the login
  throttle is in-memory/best-effort only.
- Keep it off your wildcard storefront domain routing.

## Security model

- Fully separate auth: admin accounts are **not** rows in the main `User` table, so a compromised shop-owner
  account (or a bug in the main app's auth) can't become an admin.
- scrypt password hashes in env, constant-time compare, uniform error + timing, 8h `httpOnly`/`secure`/`sameSite=strict` JWT cookie.
- Defence in depth: middleware (edge JWT check) **plus** `getAdmin()` in the layout and every route handler.
- Explicit `select` per resource → password hashes and encrypted Wave/Orange credentials never leave the DB.
- Writes limited to whitelisted fields, validated server-side; select/filter values must match declared options.
- Every UPDATE/DELETE → `AuditLog` with `{from, to}` diffs (`/audit`).
- Orders can't be deleted. Prefer suspending users over deleting them (cascade behaviour = your `onDelete` rules).

## Things to be aware of

- Edits go straight to the DB and **bypass main-app logic**: changing a plan/status here does not touch Stripe,
  Wave or Orange, and won't invalidate any caching in the main app. Treat the subscriptions page as a support
  override, not billing.
- Consider a dedicated Postgres role for the admin app (no access to the credential columns) once you're live.
- Add TOTP/2FA before inviting a second admin.

## Extending

New section = one entry in `RESOURCES` + `RESOURCE_ORDER` (+ icon in `AdminNav`). Read-only: `fields: [], readOnly: true`.

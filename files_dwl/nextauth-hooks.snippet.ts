// APPLY IN THE MAIN APP — merge into your existing NextAuth `authOptions`.
// NOTE: `prisma` import path / session callbacks are yours; shown here only for the new parts.

export const authOptions = {
  // ...
  callbacks: {
    // Enforce admin-side suspension: suspended owners can't sign in.
    async signIn({ user }: { user: { id: string } }) {
      const u = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isSuspended: true },
      });
      return !u?.isSuspended;
    },
    // ...your existing jwt / session callbacks
  },
  events: {
    // Feeds the admin app's "Login activity" + "Last login" + "Logins (24h)".
    async signIn({ user }: { user: { id: string } }) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
        prisma.loginEvent.create({ data: { userId: user.id } }),
      ]);
    },
  },
};

// ALSO (main app): a suspended owner's EXISTING session stays valid until it expires.
// For instant cut-off, check `isSuspended` in your owner dashboard layout / route handlers
// (Prisma can't run in Edge middleware — do it server-side).
//
// ALSO (main app): make sure the storefront honours `shop.isActive === false`
// (and your product/collection `isActive` flags) — the admin app toggles those fields directly.

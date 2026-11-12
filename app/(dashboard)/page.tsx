// app/(dashboard)/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;
const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`; // NOTE: adjust if prices aren't whole XOF
const fmtDate = (d: Date) => d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export default async function Overview() {
  const now = new Date();
  const d1 = new Date(now.getTime() - DAY);
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);
  const in7 = new Date(now.getTime() + 7 * DAY);

  const [
    totalUsers, newUsers7, logins24h,
    totalShops, activeShops, totalProducts, totalOrders,
    revenue, subsByPlan, trialsEnding, pastDue,
    signups, recentUsers, recentOrders,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { created_at: { gte: d7 } } }),
    prisma.loginEvent.count({ where: { createdAt: { gte: d1 } } }),
    prisma.shop.count(),
    prisma.shop.count(),
    //prisma.shop.count({ where: { isActive: true } }),
    prisma.product.count(),
    prisma.order.count(),
    // NOTE: adjust statuses/field to your order model
    prisma.order.aggregate({ _sum: { total: true }, where: { status: { in: ['PAID', 'FULFILLED'] } } }),
    prisma.subscription.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.subscription.count({ where: { status: 'TRIALING', trialEndsAt: { gte: now, lte: in7 } } }),
    prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
    prisma.user.findMany({ where: { created_at: { gte: d30 } }, select: { created_at: true } }),
    prisma.user.findMany({
      orderBy: { created_at: 'desc' }, take: 6,
      select: { id: true, email: true, name: true, created_at: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' }, take: 6,
      select: { id: true, total: true, status: true, createdAt: true, shop: { select: { name: true } } },
    }),
  ]);

  // Bucket signups per day for the last 30 days (schema-agnostic: no raw SQL).
  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    buckets.set(new Date(now.getTime() - i * DAY).toISOString().slice(0, 10), 0);
  }
  for (const u of signups) {
    const key = u.created_at.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const series = Array.from(buckets.entries());
  const maxDay = Math.max(1, ...series.map(([, n]) => n));

  const cards = [
    { label: 'Users', value: totalUsers, sub: `+${newUsers7} this week`, href: '/users' },
    { label: 'Logins (24h)', value: logins24h, sub: 'successful sign-ins', href: '/logins' },
    { label: 'Shops', value: totalShops, sub: `${activeShops} active`, href: '/shops' },
    { label: 'Products', value: totalProducts, sub: 'across all shops', href: '/products' },
    { label: 'Orders', value: totalOrders, sub: 'all time', href: '/orders' },
    { label: 'Merchant GMV', value: fmtMoney(Number(revenue._sum.total ?? 0)), sub: 'paid + fulfilled orders', href: '/orders' },
    { label: 'Trials ending ≤7d', value: trialsEnding, sub: 'conversion opportunities', href: '/subscriptions' },
    { label: 'Past due', value: pastDue, sub: 'need follow-up', href: '/subscriptions' },
  ];

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-gray-500">Platform health at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="border rounded-lg p-4 bg-white hover:border-blue-400">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-2xl font-semibold mt-1">{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 border rounded-lg p-4 bg-white">
          <h2 className="font-semibold mb-3">Registrations — last 30 days</h2>
          <div className="flex items-end gap-1 h-36">
            {series.map(([day, n]) => (
              <div key={day} className="flex-1 flex flex-col justify-end h-full" title={`${day}: ${n}`}>
                <div
                  className="bg-blue-600 rounded-t min-h-[2px]"
                  style={{ height: `${(n / maxDay) * 100}%`, opacity: n ? 1 : 0.2 }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{series[0][0]}</span>
            <span>{series[series.length - 1][0]}</span>
          </div>
        </section>

        <section className="border rounded-lg p-4 bg-white">
          <h2 className="font-semibold mb-3">Subscriptions by plan</h2>
          {subsByPlan.length === 0 ? (
            <p className="text-sm text-gray-500">No subscriptions yet</p>
          ) : (
            <ul className="space-y-2">
              {subsByPlan.map((p: any) => (
                <li key={p.plan} className="flex justify-between text-sm">
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{p.plan}</span>
                  <span className="font-medium">{p._count._all}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="border rounded-lg p-4 bg-white">
          <div className="flex justify-between mb-3">
            <h2 className="font-semibold">Newest users</h2>
            <Link href="/users" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <ul className="divide-y">
            {recentUsers.map((u) => (
              <li key={u.id} className="py-2 flex justify-between text-sm">
                <span className="truncate">{u.name || u.email}</span>
                <span className="text-gray-400 shrink-0 ml-2">{fmtDate(u.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border rounded-lg p-4 bg-white">
          <div className="flex justify-between mb-3">
            <h2 className="font-semibold">Latest orders</h2>
            <Link href="/orders" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <ul className="divide-y">
            {recentOrders.map((o) => (
              <li key={o.id} className="py-2 flex justify-between text-sm">
                <span className="truncate">{o.shop?.name} · {fmtMoney(Number(o.total))}</span>
                <span className="text-gray-400 shrink-0 ml-2">{String(o.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

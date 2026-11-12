// app/(dashboard)/[resource]/page.tsx
import { notFound } from 'next/navigation';
import { RESOURCES } from '@/lib/resources';
import { ResourceManager } from '@/components/ResourceManager';

export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const cfg = RESOURCES[resource];
  if (!cfg) notFound();

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{cfg.label}</h1>
        <p className="text-sm text-gray-500">{cfg.description}</p>
      </div>
      <ResourceManager resourceKey={cfg.key} />
    </>
  );
}

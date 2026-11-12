// components/ResourceManager.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Pencil, Trash2, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { RESOURCES, type ColumnDef, type FieldDef } from '@/lib/resources';

type Row = Record<string, any>;
const PAGE_SIZE = 20;

const getPath = (obj: Row, path: string) => path.split('.').reduce<any>((a, k) => a?.[k], obj);

const GOOD = ['ACTIVE', 'PAID', 'FULFILLED', 'TRIALING', 'BUSINESS', 'PRO'];
const BAD = ['CANCELED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PAST_DUE', 'DELETE'];

function badgeTone(v: string) {
  if (GOOD.includes(v)) return 'bg-green-100 text-green-800';
  if (BAD.includes(v)) return 'bg-red-100 text-red-800';
  return 'bg-gray-200 text-gray-700';
}

function renderCell(col: ColumnDef, row: Row) {
  const v = getPath(row, col.key);
  switch (col.type) {
    case 'date':
      return v ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : <span className="text-gray-400">—</span>;
    case 'bool':
      return v ? <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">Yes</span> : <span className="text-gray-400">No</span>;
    case 'badge':
      return v ? <span className={`text-xs px-2 py-1 rounded ${badgeTone(String(v))}`}>{String(v)}</span> : '—';
    case 'money':
      return v == null ? '—' : `${Math.round(Number(v)).toLocaleString('fr-FR')} FCFA`; // NOTE: adjust currency formatting
    case 'json': {
      if (v == null) return <span className="text-gray-400">Default</span>;
      const s = JSON.stringify(v);
      return <span className="font-mono text-xs" title={s}>{s.length > 40 ? `${s.slice(0, 40)}…` : s}</span>;
    }
    default:
      return v ?? <span className="text-gray-400">—</span>;
  }
}

const toLocalInput = (v: string) => {
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function initialValue(f: FieldDef, row: Row) {
  const v = getPath(row, f.key);
  if (v == null) return f.type === 'boolean' ? false : '';
  if (f.type === 'datetime') return toLocalInput(v);
  if (f.type === 'json') return JSON.stringify(v, null, 2);
  return v;
}

export function ResourceManager({ resourceKey }: { resourceKey: string }) {
  const cfg = RESOURCES[resourceKey];

  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), q: debouncedQ, filter });
      const res = await fetch(`/api/admin/${resourceKey}?${params}`);
      if (res.status === 401) { window.location.href = '/login'; return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setItems(json.items);
      setTotal(json.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [resourceKey, page, debouncedQ, filter]);

  useEffect(() => { load(); }, [load]);

  const canEdit = !cfg.readOnly && cfg.fields.length > 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleDelete = async (row: Row) => {
    const warn =
      resourceKey === 'users'
        ? 'Delete this user? Their shops and data may be removed (or the delete blocked) depending on your DB relations. Prefer suspending. This cannot be undone.'
        : 'Delete this record? This cannot be undone.';
    if (!confirm(warn)) return;

    // Optimistic removal with rollback on failure
    const previous = items;
    setItems(items.filter((r) => r.id !== row.id));
    try {
      const res = await fetch(`/api/admin/${resourceKey}/${row.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      load();
    } catch (e: any) {
      setItems(previous);
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="pl-9 pr-3 py-2 border rounded w-64 bg-white"
          />
        </div>
        {cfg.filter && (
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded bg-white"
          >
            <option value="">{cfg.filter.label}</option>
            {cfg.filter.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <span className="text-sm text-gray-500 ml-auto">{total.toLocaleString('fr-FR')} records</span>
      </div>

      {error && <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded p-3">{error}</div>}

      <div className="border rounded-lg bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              {cfg.columns.map((c) => <th key={c.key} className="px-4 py-3 font-medium whitespace-nowrap">{c.label}</th>)}
              {(canEdit || cfg.canDelete) && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && items.length === 0 ? (
              <tr><td colSpan={cfg.columns.length + 1} className="px-4 py-10 text-center text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={cfg.columns.length + 1} className="px-4 py-10 text-center text-gray-500">No records found</td></tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className={`hover:bg-gray-50 ${loading ? 'opacity-60' : ''}`}>
                  {cfg.columns.map((c) => <td key={c.key} className="px-4 py-3 whitespace-nowrap">{renderCell(c, row)}</td>)}
                  {(canEdit || cfg.canDelete) && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canEdit && (
                        <button onClick={() => setEditing(row)} className="p-2 text-gray-600 hover:text-blue-700" aria-label="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {cfg.canDelete && (
                        <button onClick={() => handleDelete(row)} className="p-2 text-red-600 hover:text-red-800" aria-label="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Page {page} of {pages}</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded bg-white disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded bg-white disabled:opacity-40 flex items-center gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {editing && (
        <EditModal
          resourceKey={resourceKey}
          row={editing}
          fields={cfg.fields}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  resourceKey, row, fields, onClose, onSaved,
}: {
  resourceKey: string;
  row: Row;
  fields: FieldDef[];
  onClose: () => void;
  onSaved: (updated: Row) => void;
}) {
  const [form, setForm] = useState<Record<string, any>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, initialValue(f, row)]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, any> = {};
    for (const f of fields) {
      const v = form[f.key];
      body[f.key] = f.type === 'datetime' && v ? new Date(v).toISOString() : v;
    }

    try {
      const res = await fetch(`/api/admin/${resourceKey}/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      onSaved(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border rounded bg-white';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4"
      >
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Edit record</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 font-mono break-all">{row.id}</p>

        {fields.map((f) => (
          <label key={f.key} className="block space-y-1">
            {f.type === 'boolean' ? (
              <span className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
                {f.label}
              </span>
            ) : (
              <>
                <span className="text-sm font-medium">{f.label}</span>
                {f.type === 'select' ? (
                  <select value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
                    {f.nullable && <option value="">—</option>}
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' || f.type === 'json' ? (
                  <textarea
                    rows={f.type === 'json' ? 8 : 4}
                    value={form[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={`${inputCls} ${f.type === 'json' ? 'font-mono text-xs' : ''}`}
                  />
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                    step={f.type === 'number' ? 'any' : undefined}
                    value={form[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={inputCls}
                  />
                )}
              </>
            )}
          </label>
        ))}

        {error && <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded p-2">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save changes
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

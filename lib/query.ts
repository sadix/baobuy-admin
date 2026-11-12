// lib/query.ts
import type { FieldDef } from './resources';

function nest(parts: string[], leaf: unknown): Record<string, unknown> {
  return parts.reduceRight<any>((acc, key) => ({ [key]: acc }), leaf);
}

/** Case-insensitive "contains" across dot-path fields, OR-ed together. */
export function buildSearchWhere(search: string[], q: string) {
  const term = q.trim();
  if (!term) return {};
  return {
    OR: search.map((path) => nest(path.split('.'), { contains: term, mode: 'insensitive' })),
  };
}

/** Validates + coerces a JSON body against the editable-field whitelist. Unknown keys are ignored. */
export function coerceBody(fields: FieldDef[], body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const f of fields) {
    if (!(f.key in body)) continue;
    const v = body[f.key];
    const empty = v === null || v === undefined || v === '';

    if (empty) {
      if (f.type === 'boolean') { data[f.key] = false; continue; }
      if (f.nullable) { data[f.key] = null; continue; }
      errors.push(`${f.label} is required`);
      continue;
    }

    switch (f.type) {
      case 'number': {
        const n = Number(v);
        if (!Number.isFinite(n)) errors.push(`${f.label} must be a number`);
        else data[f.key] = n;
        break;
      }
      case 'boolean':
        data[f.key] = v === true || v === 'true';
        break;
      case 'select':
        if (!f.options?.includes(String(v))) errors.push(`${f.label} has an invalid value`);
        else data[f.key] = String(v);
        break;
      case 'datetime': {
        const d = new Date(String(v));
        if (isNaN(d.getTime())) errors.push(`${f.label} is not a valid date`);
        else data[f.key] = d;
        break;
      }
      case 'json':
        try {
          data[f.key] = typeof v === 'string' ? JSON.parse(v) : v;
        } catch {
          errors.push(`${f.label} is not valid JSON`);
        }
        break;
      default:
        data[f.key] = String(v).trim();
    }
  }

  return { data, errors };
}

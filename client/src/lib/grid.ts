/** Return a copy of `data` where data[field][pupilId][key] = value (deleted when null). */
export function patchNested<T extends object>(data: T, field: keyof T, pupilId: number, key: string, value: unknown): T {
  const map = { ...(data[field] as Record<string, Record<string, unknown>>) };
  const row = { ...(map[pupilId] ?? {}) };
  if (value === null || value === undefined || value === '') delete row[key];
  else row[key] = value;
  map[pupilId] = row;
  return { ...data, [field]: map };
}

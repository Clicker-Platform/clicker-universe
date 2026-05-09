'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchModulesCatalog,
  clearCatalogCache,
  type ModuleCatalogEntry,
} from '@/lib/platform-config/modules-catalog';

interface Props {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}

export function ModuleSelector({ value, onChange }: Props) {
  const [catalog, setCatalog] = useState<ModuleCatalogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchModulesCatalog();
      setCatalog(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id: string) {
    onChange({ ...value, [id]: !value[id] });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Memuat katalog modul...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <p className="font-bold">⚠ Gagal memuat katalog modul</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={() => {
            clearCatalogCache();
            load();
          }}
          className="mt-2 px-3 py-1 rounded-lg border border-red-300 text-xs font-bold hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!catalog || catalog.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-2">Tidak ada modul tersedia.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {catalog.map((m) => (
        <label
          key={m.id}
          className="flex items-start gap-2 rounded-lg border-2 border-gray-200 p-2 cursor-pointer hover:border-brand-dark transition-colors"
        >
          <input
            type="checkbox"
            checked={!!value[m.id]}
            onChange={() => toggle(m.id)}
            className="mt-1 w-4 h-4 accent-brand-dark"
          />
          <div>
            <div className="text-sm font-bold text-brand-dark">{m.name}</div>
            <div className="text-xs text-gray-500">{m.description}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

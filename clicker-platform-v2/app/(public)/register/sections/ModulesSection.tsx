'use client';

import { BUNDLES } from '@/lib/registration/bundles';
import { MODULES_CATALOG } from '@/lib/registration/modules-catalog';

interface Props {
  bundle: string | null;
  modules: string[];
  errors: Record<string, string[] | undefined>;
  onBundleChange: (bundleId: string | null) => void;
  onModulesChange: (modules: string[]) => void;
}

export function ModulesSection({
  bundle,
  modules,
  errors,
  onBundleChange,
  onModulesChange,
}: Props) {
  function toggleBundle(id: string) {
    if (bundle === id) {
      onBundleChange(null);
      onModulesChange([]);
      return;
    }
    const b = BUNDLES.find((x) => x.id === id);
    if (!b) return;
    onBundleChange(id);
    onModulesChange(b.modules);
  }

  function toggleModule(id: string) {
    onBundleChange(null);
    if (modules.includes(id)) {
      onModulesChange(modules.filter((m) => m !== id));
    } else {
      onModulesChange([...modules, id]);
    }
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold text-neutral-900 mb-2">Modul</legend>

      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2">Pilih bundle</p>
        <div className="space-y-2">
          {BUNDLES.map((b) => (
            <label
              key={b.id}
              className={`block rounded-md border p-3 cursor-pointer transition-colors ${
                bundle === b.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-neutral-300 hover:border-neutral-400'
              }`}
            >
              <input
                type="radio"
                name="bundle"
                value={b.id}
                checked={bundle === b.id}
                onChange={() => toggleBundle(b.id)}
                className="mr-2"
              />
              <span className="font-medium text-neutral-900">{b.name}</span>
              <p className="text-sm text-neutral-600 ml-6">{b.description}</p>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2">
          Atau pilih modul satu per satu
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODULES_CATALOG.map((m) => (
            <label
              key={m.id}
              className="flex items-start gap-2 rounded-md border border-neutral-300 p-2 cursor-pointer hover:border-neutral-400"
            >
              <input
                type="checkbox"
                checked={modules.includes(m.id)}
                onChange={() => toggleModule(m.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-neutral-900">{m.name}</span>
                <span className="block text-xs text-neutral-600">{m.description}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.modules && <p className="mt-1 text-sm text-red-600">{errors.modules[0]}</p>}
      </div>
    </fieldset>
  );
}

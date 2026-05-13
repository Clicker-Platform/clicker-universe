'use client';

import { useEffect, useState } from 'react';
import { saveNotes } from '@/lib/registrations/api';

export function InternalNotes({ id, initial }: { id: string; initial: string }) {
  const [val, setVal] = useState(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (val === initial) return;
    const t = setTimeout(async () => {
      await saveNotes(id, val);
      setSavedAt(Date.now());
    }, 800);
    return () => clearTimeout(t);
  }, [val, id, initial]);

  return (
    <div>
      <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={4} className="w-full rounded border p-2" placeholder="Internal notes…" />
      {savedAt && <p className="text-xs text-gray-500">Saved</p>}
    </div>
  );
}

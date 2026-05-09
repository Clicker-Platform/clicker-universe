'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RejectModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/registrations/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Reject gagal');
      onClose();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="text-lg font-semibold">Reject registration</h3>
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)}
          rows={4} placeholder="Reason (required)"
          className="mt-3 w-full rounded border p-2"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1">Cancel</button>
          <button
            onClick={submit} disabled={!reason.trim() || pending}
            className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
          >
            {pending ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

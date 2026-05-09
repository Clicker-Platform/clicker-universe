'use client';

import { useRouter } from 'next/navigation';

export function ActivateButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/tenants?fromRegistration=${id}`)}
      className="rounded bg-orange-500 px-4 py-2 text-white"
    >
      Activate →
    </button>
  );
}

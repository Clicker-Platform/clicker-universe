import { Suspense } from 'react';
import { LoginClient } from './LoginClient';

export const dynamic = 'force-dynamic';

export default function StoreLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow border border-gray-200 p-8">
        <Suspense fallback={<div className="text-sm text-gray-500">Loading...</div>}>
          <LoginClient />
        </Suspense>
      </div>
    </main>
  );
}

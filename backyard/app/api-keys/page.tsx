'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { KeyRound, RefreshCw } from 'lucide-react';
import { SecretCard } from './_components/SecretCard';
import { EmailConfigPanel } from './_components/EmailConfigPanel';

interface SecretStatus {
  key: string;
  exists: boolean;
}

export default function ApiKeysPage() {
  const [secrets, setSecrets] = useState<SecretStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSecrets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/secrets/list');
      const data = await res.json() as { secrets: SecretStatus[] };
      setSecrets(data.secrets ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSecrets(); }, [fetchSecrets]);

  const missingCount = secrets.filter(s => !s.exists).length;

  return (
    <div className="min-h-screen bg-gray-50/50 flex font-sans">
      <Sidebar />
      <div className="flex-1 ml-64 p-8">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <KeyRound className="w-8 h-8" />
              API KEYS
            </h1>
            <p className="text-gray-500 font-medium">Platform secrets &amp; email configuration</p>
          </div>
          <button
            onClick={fetchSecrets}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border-[3px] border-gray-200 rounded-xl text-sm font-bold hover:border-gray-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {missingCount > 0 && (
          <div className="bg-amber-50 border-[3px] border-amber-200 rounded-2xl p-4 mb-6">
            <p className="text-amber-800 font-bold text-sm">
              ⚠ {missingCount} secret{missingCount > 1 ? 's' : ''} missing — related features will not work until configured.
            </p>
          </div>
        )}

        <section className="mb-8">
          <h2 className="text-lg font-black mb-4">Platform Secrets</h2>
          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {secrets.map(secret => (
                <SecretCard
                  key={secret.key}
                  secretKey={secret.key}
                  exists={secret.exists}
                  onRefresh={fetchSecrets}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-black mb-4">Email Configuration</h2>
          <EmailConfigPanel />
        </section>
      </div>
    </div>
  );
}

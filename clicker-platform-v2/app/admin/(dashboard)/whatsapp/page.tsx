'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { WA_ROOT, WA_MAIN_DOC, WA_CONFIG_DOC, WA_CUSTOMER_THREADS } from '@/lib/whatsapp/constants';
import type { WAConfig, WAThread } from '@/lib/whatsapp/types';
import { WASetupWizard } from '@/components/admin/whatsapp/WASetupWizard';
import { WAInbox } from '@/components/admin/whatsapp/WAInbox';
import { WAConversation } from '@/components/admin/whatsapp/WAConversation';
import { WASettings } from '@/components/admin/whatsapp/WASettings';
import { Loader2, Settings } from 'lucide-react';
import { doc as fsDoc, getDoc } from 'firebase/firestore';

type View = 'inbox' | 'settings';

export default function WhatsAppPage() {
  const { siteId } = useSite();
  const [config, setConfig] = useState<WAConfig | null | undefined>(undefined); // undefined = loading
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<WAThread | null>(null);
  const [view, setView] = useState<View>('inbox');
  const [showConversation, setShowConversation] = useState(false); // mobile

  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;
    const ref = doc(db, 'sites', siteId, WA_ROOT, WA_CONFIG_DOC);
    const unsub = onSnapshot(ref, snap => {
      setConfig(snap.exists() ? (snap.data() as WAConfig) : null);
    });
    return () => unsub();
  }, [siteId]);

  async function handleSelectThread(threadId: string) {
    setSelectedThreadId(threadId);
    setShowConversation(true);
    if (!siteId) return;
    const ref = fsDoc(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS, threadId);
    const snap = await getDoc(ref);
    if (snap.exists()) setSelectedThread({ id: snap.id, ...snap.data() } as WAThread);
  }

  // Loading
  if (config === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Not connected — show setup wizard
  if (!config || config.status === 'disconnected') {
    return <WASetupWizard onComplete={() => {}} />;
  }

  // Settings view
  if (view === 'settings') {
    return (
      <div>
        <div className="flex items-center gap-2 px-4 pt-4">
          <button
            onClick={() => setView('inbox')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Kembali ke Inbox
          </button>
        </div>
        <WASettings onDisconnect={() => setConfig(null)} />
      </div>
    );
  }

  // Main inbox view
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar — thread list */}
      <div className={`w-full lg:w-80 xl:w-96 shrink-0 flex flex-col border-r border-gray-200 dark:border-neutral-800 ${showConversation ? 'hidden lg:flex' : 'flex'}`}>
        {/* Tab bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-neutral-800">
          <div className="flex gap-2">
            <TabButton active={view === 'inbox'} onClick={() => setView('inbox')}>Inbox</TabButton>
          </div>
          <button
            onClick={() => setView('settings')}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-500 dark:text-neutral-400"
            title="Pengaturan WhatsApp"
          >
            <Settings size={15} />
          </button>
        </div>
        <WAInbox selectedThreadId={selectedThreadId} onSelectThread={handleSelectThread} />
      </div>

      {/* Conversation panel */}
      <div className={`flex-1 flex flex-col ${!showConversation && !selectedThreadId ? 'hidden lg:flex' : 'flex'}`}>
        <WAConversation
          threadId={selectedThreadId ?? ''}
          thread={selectedThread}
          onBack={() => setShowConversation(false)}
        />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
        active
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS } from '@/lib/whatsapp/constants';
import type { WAThread } from '@/lib/whatsapp/types';
import { MessageCircle, CheckCircle, Clock, Search } from 'lucide-react';

interface WAInboxProps {
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
}

export function WAInbox({ selectedThreadId, onSelectThread }: WAInboxProps) {
  const { siteId } = useSite();
  const [threads, setThreads] = useState<WAThread[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  useEffect(() => {
    if (!siteId || siteId === 'default' || siteId === 'pending') return;

    const ref = collection(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS);
    const q = query(ref, orderBy('lastMessageAt', 'desc'));

    const unsub = onSnapshot(q, snap => {
      setThreads(snap.docs.map(d => ({ id: d.id, ...d.data() } as WAThread)));
    });

    return () => unsub();
  }, [siteId]);

  const filtered = threads.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search && !t.contactName?.toLowerCase().includes(search.toLowerCase()) &&
        !t.contactPhone?.includes(search)) return false;
    return true;
  });

  async function markResolved(threadId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!siteId) return;
    const ref = doc(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS, threadId);
    await updateDoc(ref, { status: 'resolved', unreadCount: 0 });
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-neutral-100 mb-3">Customer Inbox</h2>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'open', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'open' ? 'Aktif' : 'Selesai'}
            </button>
          ))}
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <MessageCircle size={24} className="text-gray-300 dark:text-neutral-600 mb-2" />
            <p className="text-xs text-gray-400 dark:text-neutral-500">
              {search ? 'Tidak ada hasil pencarian.' : 'Belum ada pesan masuk.'}
            </p>
          </div>
        ) : (
          filtered.map(thread => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isSelected={selectedThreadId === thread.id}
              onClick={() => onSelectThread(thread.id)}
              onMarkResolved={e => markResolved(thread.id, e)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ThreadItem({
  thread, isSelected, onClick, onMarkResolved
}: {
  thread: WAThread;
  isSelected: boolean;
  onClick: () => void;
  onMarkResolved: (e: React.MouseEvent) => void;
}) {
  const initials = thread.contactName?.slice(0, 2).toUpperCase() ?? '??';
  const time = thread.lastMessageAt
    ? formatTime(thread.lastMessageAt instanceof Date ? thread.lastMessageAt : (thread.lastMessageAt as any).toDate?.())
    : '';

  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-100 dark:border-neutral-800/50 group ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'hover:bg-gray-50 dark:hover:bg-neutral-800/50'
      }`}
    >
      <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-semibold text-green-700 dark:text-green-400 shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-semibold text-gray-900 dark:text-neutral-100 truncate">{thread.contactName}</span>
          <span className="text-[10px] text-gray-400 dark:text-neutral-500 shrink-0 ml-2">{time}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">{thread.lastMessage}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {(thread.unreadCount ?? 0) > 0 && thread.status === 'open' && (
          <span className="w-4 h-4 rounded-full bg-green-500 text-white text-[9px] flex items-center justify-center font-bold">
            {thread.unreadCount}
          </span>
        )}
        {thread.status === 'open' ? (
          <button
            onClick={onMarkResolved}
            title="Tandai selesai"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-green-600 dark:hover:text-green-400 text-gray-400"
          >
            <CheckCircle size={13} />
          </button>
        ) : (
          <Clock size={12} className="text-gray-300 dark:text-neutral-600" />
        )}
      </div>
    </div>
  );
}

function formatTime(date: Date | undefined): string {
  if (!date) return '';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return 'baru saja';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}j`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

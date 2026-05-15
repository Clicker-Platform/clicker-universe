'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { usePermission } from '@/components/admin/PermissionGuard';
import { WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS } from '@/lib/whatsapp/constants';
import type { WAMessage, WAThread } from '@/lib/whatsapp/types';
import { Send, Loader2, ArrowLeft, CheckCircle, MessageCircle } from 'lucide-react';

interface WAConversationProps {
  threadId: string;
  thread: WAThread | null;
  onBack?: () => void;
}

export function WAConversation({ threadId, thread, onBack }: WAConversationProps) {
  const { siteId } = useSite();
  const { user } = useUser();
  const { isViewOnly } = usePermission();
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteId || !threadId) return;

    const ref = collection(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS, threadId, 'messages');
    const q = query(ref, orderBy('sentAt', 'asc'));

    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as WAMessage)));
    });

    // Mark thread as read
    const threadRef = doc(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS, threadId);
    updateDoc(threadRef, { unreadCount: 0 }).catch(() => {});

    return () => unsub();
  }, [siteId, threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (isViewOnly || !text.trim() || !siteId || !thread) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          to: thread.contactPhone,
          content: text.trim(),
          threadId,
          staffUserId: user?.uid,
        }),
      });
      if (!res.ok) throw new Error('Gagal mengirim pesan.');
      setText('');
    } catch (err) {
      console.error('[WAConversation] send error:', err);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!thread) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <MessageCircle size={32} className="text-gray-300 dark:text-neutral-600 mb-3" />
        <p className="text-sm text-gray-400 dark:text-neutral-500">Pilih percakapan dari inbox</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
        {onBack && (
          <button onClick={onBack} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors lg:hidden">
            <ArrowLeft size={16} className="text-gray-500 dark:text-neutral-400" />
          </button>
        )}
        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-semibold text-green-700 dark:text-green-400">
          {thread.contactName?.slice(0, 2).toUpperCase() ?? '??'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100 truncate">{thread.contactName}</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500">{thread.contactPhone}</p>
        </div>
        {thread.status === 'open' && (
          <button
            onClick={async () => {
              if (!siteId) return;
              const ref = doc(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS, threadId);
              await updateDoc(ref, { status: 'resolved' });
            }}
            className="flex items-center gap-1 px-3 py-1 text-xs text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-full transition-colors"
          >
            <CheckCircle size={12} /> Selesai
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-xs text-gray-400 dark:text-neutral-500 py-8">
            Belum ada pesan
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
        {thread.status === 'resolved' ? (
          <div className="text-center text-xs text-gray-400 dark:text-neutral-500 py-2">
            Percakapan ini sudah ditandai selesai. Buka kembali untuk membalas.
            <button
              onClick={async () => {
                if (!siteId) return;
                const ref = doc(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS, threadId);
                await updateDoc(ref, { status: 'open' });
              }}
              className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
              Buka kembali
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan... (Enter untuk kirim)"
              rows={1}
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-xl bg-gray-50 dark:bg-neutral-800 text-sm text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="p-2 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white transition-colors shrink-0"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: WAMessage }) {
  const isOutbound = message.direction === 'outbound';
  const time = message.sentAt
    ? formatTime(message.sentAt instanceof Date ? message.sentAt : (message.sentAt as { toDate?: () => Date }).toDate?.())
    : '';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
        isOutbound
          ? 'bg-green-500 text-white rounded-br-sm'
          : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 rounded-bl-sm'
      }`}>
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p className={`text-[10px] mt-0.5 text-right ${isOutbound ? 'text-green-100' : 'text-gray-400 dark:text-neutral-500'}`}>
          {time}
          {isOutbound && message.sentBy?.startsWith('staff:') && (
            <span className="ml-1 opacity-75">· Staff</span>
          )}
        </p>
      </div>
    </div>
  );
}

function formatTime(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

'use client';

import { X, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import type { EmailFailure } from '@/lib/monitoring/types';

interface Props {
    failure: EmailFailure | null;
    onClose: () => void;
}

const RESEND_DASHBOARD = process.env.NEXT_PUBLIC_RESEND_DASHBOARD_URL || 'https://resend.com/emails';

export function EmailFailureDrawer({ failure, onClose }: Props) {
    if (!failure) return null;
    const isFailed = !!failure.error;
    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/30" onClick={onClose} />
            <div className="w-[480px] bg-white h-full overflow-y-auto shadow-xl">
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        {isFailed ? (
                            <XCircle className="w-4 h-4 text-red-600" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                        <h3 className="font-bold">{isFailed ? 'Email failure detail' : 'Email success detail'}</h3>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <dl className="p-4 space-y-3 text-sm">
                    <Row label="Site">
                        {failure.siteName ?? '(deleted)'}{' '}
                        <span className="text-xs text-gray-400">({failure.siteId})</span>
                    </Row>
                    <Row label="To">{failure.to.join(', ')}</Row>
                    {failure.cc && failure.cc.length > 0 && <Row label="Cc">{failure.cc.join(', ')}</Row>}
                    {failure.bcc && failure.bcc.length > 0 && <Row label="Bcc">{failure.bcc.join(', ')}</Row>}
                    <Row label="From">{failure.fromName} &lt;{failure.fromAddress}&gt;</Row>
                    <Row label="Template">{failure.templateAlias}</Row>
                    {isFailed && (
                        <Row label="Error">
                            <div className="text-red-700">{failure.error}</div>
                            {failure.errorCode && <div className="text-xs text-gray-400 mt-1">code: {failure.errorCode}</div>}
                        </Row>
                    )}
                    <Row label="Created">{new Date(failure.createdAt).toLocaleString()}</Row>
                    {failure.sentAt && (
                        <Row label="Sent">{new Date(failure.sentAt).toLocaleString()}</Row>
                    )}
                    {failure.tags.length > 0 && (
                        <Row label="Tags">
                            {failure.tags.map((t, i) => (
                                <span key={i} className="inline-block mr-1 mb-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                                    {t.name}={t.value}
                                </span>
                            ))}
                        </Row>
                    )}
                    {failure.resendId && (
                        <Row label="Resend">
                            <a
                                href={`${RESEND_DASHBOARD}/${failure.resendId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-brand-dark hover:underline"
                            >
                                Open in Resend <ExternalLink className="w-3 h-3" />
                            </a>
                        </Row>
                    )}
                </dl>
            </div>
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-bold text-gray-500 uppercase">{label}</dt>
            <dd className="mt-0.5 break-words">{children}</dd>
        </div>
    );
}

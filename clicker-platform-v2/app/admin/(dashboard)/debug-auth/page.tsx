'use client';

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { useUser } from '@/lib/user-context';
import { useSite } from '@/lib/site-context';

interface AuthDiagnostics {
    claims: Record<string, any> | null;
    sessionCookie: string | null;
    tenantCookie: string | null;
    currentHost: string;
    expectedHost: string | null;
    relayNeeded: boolean;
    tokenExpiry: string | null;
}

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export default function DebugAuthPage() {
    const { user, role, permissions, moduleAccess, hasAccess, getAccessLevel } = useUser();
    const { siteId } = useSite();
    const [diagnostics, setDiagnostics] = useState<AuthDiagnostics | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const loadDiagnostics = async () => {
            const auth = getAuth();
            const currentUser = auth.currentUser;

            let claims: Record<string, any> | null = null;
            let tokenExpiry: string | null = null;

            if (currentUser) {
                try {
                    const result = await currentUser.getIdTokenResult();
                    claims = result.claims as Record<string, any>;
                    tokenExpiry = new Date(result.expirationTime).toLocaleString();
                } catch {
                    claims = null;
                }
            }

            const sessionCookie = getCookie('__session');
            const tenantCookie = getCookie('__tenant');
            const currentHost = window.location.hostname;
            const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
            const claimedSiteId = claims?.siteId as string | undefined;
            const expectedHost = claimedSiteId && baseDomain ? `${claimedSiteId}.${baseDomain}` : null;
            const relayNeeded = !!(expectedHost && currentHost !== expectedHost);

            setDiagnostics({
                claims,
                sessionCookie,
                tenantCookie,
                currentHost,
                expectedHost,
                relayNeeded,
                tokenExpiry,
            });
        };

        loadDiagnostics();
    }, [user]);

    const handleCopy = () => {
        const report = JSON.stringify({ user: { uid: user?.uid, email: user?.email }, siteId, diagnostics }, null, 2);
        navigator.clipboard.writeText(report).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {ok ? '✓' : '✗'} {label}
        </span>
    );

    return (
        <div className="p-6 max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Auth Debugger</h1>
                <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 text-xs font-bold rounded border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                    {copied ? '✓ Copied' : 'Copy Report'}
                </button>
            </div>

            {/* Health Checklist */}
            <div className="p-4 border rounded bg-white">
                <h2 className="font-bold mb-3">Quick Health Check</h2>
                <div className="flex flex-wrap gap-2">
                    <StatusBadge ok={!!user} label="Firebase Auth" />
                    <StatusBadge ok={!!diagnostics?.sessionCookie} label="__session cookie" />
                    <StatusBadge ok={!!diagnostics?.claims?.siteId} label="siteId in claims" />
                    <StatusBadge ok={!diagnostics?.relayNeeded} label="Correct origin" />
                    <StatusBadge ok={!!diagnostics?.claims?.role} label="role in claims" />
                </div>
            </div>

            {/* User Identity */}
            <div className="p-4 border rounded bg-gray-50">
                <h2 className="font-bold mb-2">User Identity</h2>
                <pre className="text-xs overflow-auto">{JSON.stringify({ uid: user?.uid, email: user?.email, siteId }, null, 2)}</pre>
            </div>

            {/* Firebase Custom Claims */}
            <div className={`p-4 border rounded ${diagnostics?.claims?.siteId ? 'bg-gray-50' : 'bg-red-50 border-red-200'}`}>
                <h2 className="font-bold mb-2">Firebase Custom Claims</h2>
                {diagnostics === null ? (
                    <p className="text-xs text-gray-500">Loading...</p>
                ) : diagnostics.claims ? (
                    <>
                        <pre className="text-xs overflow-auto">{JSON.stringify(diagnostics.claims, null, 2)}</pre>
                        {diagnostics.tokenExpiry && (
                            <p className="text-xs text-gray-500 mt-2">Token expires: {diagnostics.tokenExpiry}</p>
                        )}
                    </>
                ) : (
                    <p className="text-xs text-red-600 font-bold">No claims found — user may not have siteId assigned.</p>
                )}
            </div>

            {/* Cookie State */}
            <div className="p-4 border rounded bg-gray-50">
                <h2 className="font-bold mb-2">Cookie State</h2>
                <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-200 px-1 rounded">__session</code>
                        {diagnostics?.sessionCookie
                            ? <span className="text-green-700 font-bold">{diagnostics.sessionCookie}</span>
                            : <span className="text-red-600 font-bold">Not set</span>
                        }
                    </div>
                    <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-200 px-1 rounded">__tenant</code>
                        {diagnostics?.tenantCookie
                            ? <span className="text-blue-700">{diagnostics.tenantCookie}</span>
                            : <span className="text-gray-400">Not set</span>
                        }
                    </div>
                </div>
            </div>

            {/* Relay / Origin Diagnostics */}
            <div className={`p-4 border rounded ${diagnostics?.relayNeeded ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50'}`}>
                <h2 className="font-bold mb-2">Origin & Relay Check</h2>
                <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-32">Current host:</span>
                        <code className="text-xs bg-gray-200 px-1 rounded">{diagnostics?.currentHost}</code>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-32">Expected host:</span>
                        <code className="text-xs bg-gray-200 px-1 rounded">{diagnostics?.expectedHost ?? 'Unknown (no siteId in claims)'}</code>
                    </div>
                    {diagnostics?.relayNeeded && (
                        <p className="text-yellow-800 font-bold text-xs mt-2">
                            ⚠️ Origin mismatch — Firebase Auth state may not be accessible here. Relay should have resolved this during login.
                        </p>
                    )}
                </div>
            </div>

            {/* Role & Permissions */}
            <div className="p-4 border rounded bg-gray-50">
                <h2 className="font-bold mb-2">Role & Permissions</h2>
                <p className="text-sm">Role: <strong>{role || '—'}</strong></p>
                <p className="text-sm">Permissions: <strong>{JSON.stringify(permissions)}</strong></p>
            </div>

            {/* Module Access */}
            <div className="p-4 border rounded bg-gray-50">
                <h2 className="font-bold mb-2">Module Access (Raw)</h2>
                <pre className="text-xs overflow-auto">{JSON.stringify(moduleAccess, null, 2)}</pre>
            </div>

            {/* Permission Tests */}
            <div className="p-4 border rounded bg-blue-50">
                <h2 className="font-bold text-blue-800 mb-2">Permission Tests</h2>
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="pb-1">Check</th>
                            <th className="pb-1">Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="py-1 font-mono text-xs">hasAccess('byod_pos', 'settings')</td>
                            <td>{hasAccess('byod_pos', 'settings') ? '✓ TRUE' : '✗ FALSE'}</td>
                        </tr>
                        <tr>
                            <td className="py-1 font-mono text-xs">getAccessLevel('byod_pos', 'settings')</td>
                            <td>{getAccessLevel('byod_pos', 'settings')}</td>
                        </tr>
                        <tr>
                            <td className="py-1 font-mono text-xs">hasAccess('pos', 'settings')</td>
                            <td>{hasAccess('pos', 'settings') ? '✓ TRUE' : '✗ FALSE'}</td>
                        </tr>
                        <tr>
                            <td className="py-1 font-mono text-xs">getAccessLevel('pos', 'settings')</td>
                            <td>{getAccessLevel('pos', 'settings')}</td>
                        </tr>
                        <tr>
                            <td className="py-1 font-mono text-xs">hasAccess('byod_pos', 'configuration')</td>
                            <td>{hasAccess('byod_pos', 'configuration') ? '✓ TRUE' : '✗ FALSE'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

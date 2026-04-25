import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = [
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
];

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
        return NextResponse.json({ error: 'Disallowed host' }, { status: 403 });
    }

    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: 'Upstream error' }, { status: 502 });

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    let data: unknown;
    try {
        data = await res.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON from upstream' }, { status: 502 });
    }

    return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, max-age=3600' },
    });
}

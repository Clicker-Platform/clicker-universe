'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface Props {
  siteId: string;
  productId: string;
  pdfStoragePath: string | null;
  pdfFilename: string | null;
  youtubeUrl: string | null;
}

export function LibraryEntryClient({ siteId, productId, pdfStoragePath, pdfFilename, youtubeUrl }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!pdfStoragePath) return;
    setDownloading(true); setError(null);
    try {
      const res = await fetch(`/api/digital-goods/files/${encodeURIComponent(productId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-site-id': siteId },
        body: JSON.stringify({ productId, storagePath: pdfStoragePath }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'request_failed');
      }
      // The server streams the file bytes directly (no shareable URL). Turn the
      // response into a blob and trigger a save in the browser.
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = pdfFilename || 'download.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to download file.');
    } finally {
      setDownloading(false);
    }
  }

  if (youtubeUrl) {
    const embedUrl = toYouTubeEmbed(youtubeUrl);
    if (!embedUrl) return <p className="text-gray-500 text-sm">Invalid video URL.</p>;
    return (
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <iframe src={embedUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
      </div>
    );
  }

  if (pdfStoragePath) {
    return (
      <div className="space-y-3">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="bg-studio-blue text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-studio-blue/90 disabled:opacity-50"
        >
          {downloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
          Download PDF {pdfFilename && <span className="font-normal opacity-80">({pdfFilename})</span>}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return <p className="text-gray-500 text-sm">No content available.</p>;
}

const YOUTUBE_HOSTNAMES = new Set(['www.youtube.com', 'youtube.com', 'youtu.be']);
const YOUTUBE_ID_RE = /^[\w-]{5,15}$/;

function toYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    if (!YOUTUBE_HOSTNAMES.has(u.hostname)) return null;
    const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : (u.searchParams.get('v') ?? '');
    if (!YOUTUBE_ID_RE.test(id)) return null;
    return `https://www.youtube.com/embed/${id}`;
  } catch {
    return null;
  }
}

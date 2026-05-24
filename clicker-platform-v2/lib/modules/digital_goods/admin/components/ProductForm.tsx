'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import {
  getProduct, createProduct, updateProduct,
  generateSlug, ensureUniqueSlug, getAllSlugs,
} from '../../api';
import { ROUTES, DEFAULT_CURRENCY } from '../../constants';
import type {
  DigitalProduct, ContentKind, ProductStatus, PdfFile, YouTubeFile,
} from '../../types';
import PdfUploadField from './PdfUploadField';

interface FormState {
  title: string;
  description: string;
  price: string;                  // string for input control
  contentKind: ContentKind;
  pdfFile: PdfFile | null;
  youtubeUrl: string;
  status: ProductStatus;
}

const EMPTY: FormState = {
  title: '',
  description: '',
  price: '',
  contentKind: 'pdf',
  pdfFile: null,
  youtubeUrl: '',
  status: 'draft',
};

export default function ProductForm() {
  const { siteId } = useSite();
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('id');           // null for new product
  const isEdit = Boolean(productId);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<DigitalProduct | null>(null);

  useEffect(() => {
    if (!siteId || !productId) return;
    let cancelled = false;
    setLoading(true);
    getProduct(siteId, productId)
      .then(p => {
        if (cancelled || !p) return;
        setExisting(p);
        const yt = p.files.find(f => f.kind === 'youtube') as YouTubeFile | undefined;
        const pdf = p.files.find(f => f.kind === 'pdf') as PdfFile | undefined;
        setForm({
          title: p.title,
          description: p.description,
          price: String(p.price),
          contentKind: p.contentKind,
          pdfFile: pdf ?? null,
          youtubeUrl: yt?.url ?? '',
          status: p.status,
        });
      })
      .catch(e => {
        logger.error('digital_goods.product.load.failed', { siteId, productId, error: e });
        if (!cancelled) setError('Failed to load product.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId, productId]);

  function validate(): string | null {
    if (!form.title.trim()) return 'Title is required.';
    const priceNum = parseInt(form.price, 10);
    if (!Number.isFinite(priceNum) || priceNum < 0) return 'Price must be a non-negative integer.';
    if (form.contentKind === 'pdf' && !form.pdfFile) return 'Upload a PDF file.';
    if (form.contentKind === 'youtube' && !form.youtubeUrl.match(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//)) {
      return 'Enter a valid YouTube URL.';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const files = form.contentKind === 'pdf'
        ? [form.pdfFile!]
        : [{ id: crypto.randomUUID(), kind: 'youtube' as const, url: form.youtubeUrl }];

      const taken = await getAllSlugs(siteId);
      // If editing, don't conflict with own current slug
      if (isEdit && existing) taken.delete(existing.slug);
      const baseSlug = generateSlug(form.title) || 'product';
      const slug = isEdit && existing && existing.slug === baseSlug
        ? existing.slug
        : ensureUniqueSlug(baseSlug, taken);

      const data = {
        type: 'single' as const,
        title: form.title.trim(),
        description: form.description,
        price: parseInt(form.price, 10),
        currency: DEFAULT_CURRENCY,
        contentKind: form.contentKind,
        files,
        slug,
        status: form.status,
      };

      if (isEdit && productId) {
        await updateProduct(siteId, productId, data);
      } else {
        await createProduct(siteId, data);
      }
      router.push(ROUTES.list);
    } catch (e) {
      logger.error('digital_goods.product.save.failed', { siteId, productId, error: e });
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500 dark:text-neutral-500">Loading...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{isEdit ? 'Edit Product' : 'New Product'}</h1>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 rounded">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">Title <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">Description (markdown supported)</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={6}
          className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 font-mono text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">Price (IDR) <span className="text-red-500">*</span></label>
        <input
          type="number"
          min="0"
          step="1"
          value={form.price}
          onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
          className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-neutral-300">Content type</label>
        <div className="flex gap-2">
          {(['pdf', 'youtube'] as const).map(kind => (
            <button
              key={kind}
              type="button"
              onClick={() => setForm(f => ({ ...f, contentKind: kind }))}
              className={`px-4 py-2 rounded-lg border ${
                form.contentKind === kind
                  ? 'bg-brand-dark text-white border-brand-dark'
                  : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700'
              }`}
            >
              {kind === 'pdf' ? 'PDF' : 'YouTube (unlisted)'}
            </button>
          ))}
        </div>
      </div>

      {form.contentKind === 'pdf' ? (
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">PDF file <span className="text-red-500">*</span></label>
          <PdfUploadField
            siteId={siteId!}
            value={form.pdfFile}
            onChange={pdfFile => setForm(f => ({ ...f, pdfFile }))}
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">YouTube URL <span className="text-red-500">*</span></label>
          <input
            type="url"
            value={form.youtubeUrl}
            onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-600"
          />
          <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">Set the video to <strong>Unlisted</strong> in YouTube. Public/Private will not work as expected.</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-neutral-300">Status</label>
        <div className="flex gap-2">
          {(['draft', 'published'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setForm(f => ({ ...f, status: s }))}
              className={`px-4 py-2 rounded-lg border ${
                form.status === s
                  ? 'bg-brand-dark text-white border-brand-dark'
                  : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-neutral-800">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-dark text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="animate-spin" size={16} />}
          {isEdit ? 'Save changes' : 'Create product'}
        </button>
        <button
          type="button"
          onClick={() => router.push(ROUTES.list)}
          className="px-6 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { X, ShoppingBag, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger-edge';
import {
  createProduct, updateProduct,
  generateSlug, ensureUniqueSlug, getAllSlugs,
} from '../../api';
import { DEFAULT_CURRENCY } from '../../constants';
import type {
  DigitalProduct, ContentKind, ProductStatus, PdfFile, YouTubeFile,
} from '../../types';
import PdfUploadField from './PdfUploadField';

interface ProductFormProps {
  siteId: string;
  product?: DigitalProduct;   // undefined = create mode; truthy = edit mode
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  title: string;
  description: string;
  price: string;
  contentKind: ContentKind;
  pdfFile: PdfFile | null;
  youtubeUrl: string;
  status: ProductStatus;
}

function initState(product?: DigitalProduct): FormState {
  if (product) {
    const yt  = product.files.find(f => f.kind === 'youtube') as YouTubeFile | undefined;
    const pdf = product.files.find(f => f.kind === 'pdf')     as PdfFile    | undefined;
    return {
      title:       product.title,
      description: product.description,
      price:       String(product.price),
      contentKind: product.contentKind,
      pdfFile:     pdf ?? null,
      youtubeUrl:  yt?.url ?? '',
      status:      product.status,
    };
  }
  return {
    title:       '',
    description: '',
    price:       '',
    contentKind: 'pdf',
    pdfFile:     null,
    youtubeUrl:  '',
    status:      'draft',
  };
}

const inputCls  = 'w-full border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-studio-blue/20 focus:border-studio-blue outline-none transition-all text-sm placeholder-gray-400 dark:placeholder-neutral-600';
const labelCls  = 'block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1';
const sectionCls = 'text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-3 mt-1';

export function ProductForm({ siteId, product, onClose, onSaved }: ProductFormProps) {
  const isEdit = !!product;
  const [form, setForm]     = useState<FormState>(() => initState(product));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    setForm(initState(product));
    setError(null);
  }, [product]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  function validate(): string | null {
    if (!form.title.trim()) return 'Title is required.';
    const priceNum = parseInt(form.price, 10);
    if (!Number.isFinite(priceNum) || priceNum < 0) return 'Price must be a non-negative integer.';
    if (form.contentKind === 'pdf' && !form.pdfFile) return 'Upload a PDF file.';
    if (
      form.contentKind === 'youtube' &&
      !form.youtubeUrl.match(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//)
    ) {
      return 'Enter a valid YouTube URL.';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(null);
    setSaving(true);

    try {
      const files = form.contentKind === 'pdf'
        ? [form.pdfFile!]
        : [{ id: crypto.randomUUID(), kind: 'youtube' as const, url: form.youtubeUrl }];

      const taken = await getAllSlugs(siteId);
      if (isEdit && product) taken.delete(product.slug);
      const baseSlug = generateSlug(form.title) || 'product';
      const slug = isEdit && product && product.slug === baseSlug
        ? product.slug
        : ensureUniqueSlug(baseSlug, taken);

      const data = {
        type:        'single' as const,
        title:       form.title.trim(),
        description: form.description,
        price:       parseInt(form.price, 10),
        currency:    DEFAULT_CURRENCY,
        contentKind: form.contentKind,
        files,
        slug,
        status:      form.status,
      };

      if (isEdit && product) {
        await updateProduct(siteId, product.id, data);
      } else {
        await createProduct(siteId, data);
      }

      onSaved();
      onClose();
    } catch (e) {
      logger.error('digital_goods.product.save.failed', { siteId, productId: product?.id, error: e });
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-end backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-neutral-500 dark:text-neutral-400" />
            <h3 className="font-bold text-lg text-gray-800 dark:text-neutral-200">
              {isEdit ? 'Edit Product' : 'New Product'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">

            {/* Basic Info */}
            <div>
              <p className={sectionCls}>Basic Info</p>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Title <span className="text-red-500">*</span></label>
                  <input
                    required
                    className={inputCls}
                    placeholder="e.g. Beginner's Guide to Marketing"
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Description (markdown supported)</label>
                  <textarea
                    rows={4}
                    className={inputCls + ' resize-none font-mono'}
                    placeholder="Optional description..."
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <p className={sectionCls}>Pricing</p>
              <div>
                <label className={labelCls}>Price (IDR) <span className="text-red-500">*</span></label>
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  className={inputCls}
                  placeholder="e.g. 99000"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                />
              </div>
            </div>

            {/* Content */}
            <div>
              <p className={sectionCls}>Content</p>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Content type</label>
                  <div className="flex gap-2">
                    {(['pdf', 'youtube'] as const).map(kind => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => set('contentKind', kind)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          form.contentKind === kind
                            ? 'bg-studio-blue text-white border-studio-blue'
                            : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        {kind === 'pdf' ? 'PDF' : 'YouTube (unlisted)'}
                      </button>
                    ))}
                  </div>
                </div>

                {form.contentKind === 'pdf' ? (
                  <div>
                    <label className={labelCls}>PDF file <span className="text-red-500">*</span></label>
                    <PdfUploadField
                      siteId={siteId}
                      value={form.pdfFile}
                      onChange={pdfFile => set('pdfFile', pdfFile)}
                    />
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>YouTube URL <span className="text-red-500">*</span></label>
                    <input
                      type="url"
                      className={inputCls}
                      placeholder="https://youtube.com/watch?v=..."
                      value={form.youtubeUrl}
                      onChange={e => set('youtubeUrl', e.target.value)}
                    />
                    <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">
                      Set the video to <strong>Unlisted</strong> in YouTube. Public/Private will not work as expected.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <p className={sectionCls}>Status</p>
              <div className="flex gap-2">
                {(['draft', 'published'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('status', s)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      form.status === s
                        ? 'bg-studio-blue text-white border-studio-blue'
                        : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400 font-medium">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg font-bold text-gray-500 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-studio-blue text-white hover:bg-studio-blue/90 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (isEdit ? 'Save Changes' : 'Create Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

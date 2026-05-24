'use client';

import { useState, useRef } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { uploadToStorage } from '@/lib/upload';
import { logger } from '@/lib/logger-edge';
import { STORAGE_FOLDER_PRODUCTS, MAX_PDF_BYTES, MAX_PDF_MB } from '../../constants';
import type { PdfFile } from '../../types';

interface Props {
  siteId: string;
  value: PdfFile | null;
  onChange: (file: PdfFile | null) => void;
}


export default function PdfUploadField({ siteId, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    if (file.type !== 'application/pdf') {
      setError('Only PDF files allowed.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(`File too large. Max ${MAX_PDF_MB} MB.`);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadToStorage({
        file,
        folder: `${STORAGE_FOLDER_PRODUCTS}/files`,
        siteId,
        convertToWebP: false,
      });
      onChange({
        id: crypto.randomUUID(),
        kind: 'pdf',
        name: file.name,
        storagePath: result.path,
        sizeBytes: result.sizeBytes,
        mimeType: result.contentType,
      });
    } catch (e) {
      logger.error('digital_goods.pdf.upload.failed', { siteId, error: e });
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (value) {
    return (
      <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4 flex items-center gap-3 bg-gray-50 dark:bg-neutral-800/50">
        <FileText className="text-gray-500 dark:text-neutral-500" size={20} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 dark:text-neutral-100 truncate">{value.name}</div>
          <div className="text-xs text-gray-500 dark:text-neutral-500">{(value.sizeBytes / 1024 / 1024).toFixed(2)} MB</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="p-1 text-gray-500 dark:text-neutral-500 hover:text-red-600"
          aria-label="Remove file"
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="block border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-lg p-6 text-center cursor-pointer hover:border-brand-dark dark:hover:border-brand-dark transition">
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-neutral-500">
            <Loader2 className="animate-spin" size={18} /> Uploading...
          </div>
        ) : (
          <>
            <FileText className="mx-auto mb-2 text-gray-400 dark:text-neutral-600" size={28} />
            <div className="font-medium text-gray-700 dark:text-neutral-300">Click to upload PDF</div>
            <div className="text-xs text-gray-500 dark:text-neutral-500 mt-1">Max {MAX_PDF_MB} MB</div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>
      {error && <div className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</div>}
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { Loader2, ScanLine } from 'lucide-react';
import Image from 'next/image';

interface Props {
  onImageReady: (file: File, previewUrl: string) => void;
  scanning: boolean;
}

export function ScanUploader({ onImageReady, scanning }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function resizeAndEmit(file: File) {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) return;
        const resized = new File([blob], file.name, { type: 'image/jpeg' });
        const resizedUrl = URL.createObjectURL(resized);
        setPreview(resizedUrl);
        onImageReady(resized, resizedUrl);
      }, 'image/jpeg', 0.85);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) resizeAndEmit(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) resizeAndEmit(file);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => !scanning && inputRef.current?.click()}
      className={`relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition
        ${isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
          : 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 hover:border-blue-400 dark:hover:border-blue-600'
        }`}
    >
      {preview ? (
        <Image src={preview} alt="preview" fill className="rounded-xl object-contain p-2" />
      ) : (
        <div className="flex flex-col items-center gap-3 text-neutral-500 dark:text-neutral-400 px-6 py-8">
          <ScanLine className="w-12 h-12" />
          <div className="text-center">
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Klik atau drag foto produk ke sini</p>
            <p className="text-xs mt-1">JPG · PNG · WEBP — di mobile akan buka kamera</p>
          </div>
        </div>
      )}
      {scanning && (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/85 dark:bg-neutral-950/85 gap-3 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Menganalisa produk...</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

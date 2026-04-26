'use client';

import { useRef, useState } from 'react';
import { Upload, Camera, Loader2, ScanLine } from 'lucide-react';
import Image from 'next/image';

interface Props {
  onImageReady: (file: File, previewUrl: string) => void;
  scanning: boolean;
}

export function ScanUploader({ onImageReady, scanning }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

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
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) resizeAndEmit(file);
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 transition hover:border-primary"
        onClick={() => !scanning && inputRef.current?.click()}
      >
        {preview ? (
          <Image src={preview} alt="preview" fill className="rounded-xl object-contain p-2" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ScanLine className="w-10 h-10" />
            <p className="text-sm font-medium">Upload atau drag foto produk</p>
            <p className="text-xs">JPG, PNG, WEBP</p>
          </div>
        )}
        {scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-background/80 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Menganalisa produk...</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      <div className="flex gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={scanning}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-muted"
        >
          <Upload className="w-4 h-4" /> Upload Foto
        </button>
        <button
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.capture = 'environment';
              inputRef.current.click();
            }
          }}
          disabled={scanning}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-muted"
        >
          <Camera className="w-4 h-4" /> Ambil Foto
        </button>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useRef, useState } from 'react';

export interface ImageUploaderProps {
  nodeId: string;
  currentImageUrl: string | null;
  onUploadSuccess: (newImageUrl: string) => void;
  size?: 'small' | 'medium' | 'large';
}

const SIZE_MAP = {
  small: { w: 140, h: 100 },
  medium: { w: 200, h: 140 },
  large: { w: 300, h: 200 },
};

export function ImageUploader({
  nodeId,
  currentImageUrl,
  onUploadSuccess,
  size = 'medium',
}: ImageUploaderProps) {
  const { h } = SIZE_MAP[size];
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const showError = useCallback((msg: string) => {
    setError(msg);
    window.setTimeout(() => setError(null), 3000);
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('nodeId', nodeId);
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = (await response.json()) as {
          success?: boolean;
          image_url?: string;
          error?: string;
        };
        if (response.ok && data.success && data.image_url) {
          onUploadSuccess(data.image_url);
        } else {
          showError(data.error ?? "Erreur lors de l'upload");
        }
      } catch {
        showError("Erreur lors de l'upload");
      } finally {
        setIsUploading(false);
      }
    },
    [nodeId, onUploadSuccess, showError]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void handleUpload(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.type.startsWith('image/')) void handleUpload(f);
  };

  const hasImage = Boolean(currentImageUrl?.trim());

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        aria-hidden
        onChange={onInputChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="group relative w-full cursor-pointer overflow-hidden rounded-lg border border-dashed transition-colors"
        style={{
          width: '100%',
          height: h,
          minHeight: h,
          borderColor: dragOver ? '#3B82F6' : '#2A3042',
          backgroundColor: dragOver ? '#1A1F2E' : '#111827',
        }}
        onMouseEnter={(e) => {
          if (!dragOver) {
            e.currentTarget.style.borderColor = '#3B82F6';
            e.currentTarget.style.backgroundColor = '#1A1F2E';
          }
        }}
        onMouseLeave={(e) => {
          if (!dragOver) {
            e.currentTarget.style.borderColor = '#2A3042';
            e.currentTarget.style.backgroundColor = '#111827';
          }
        }}
      >
        {hasImage && !isUploading ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImageUrl!}
              alt=""
              className="h-full w-full object-cover"
              style={{ borderRadius: 8 }}
            />
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
              style={{
                borderRadius: 8,
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}
            >
              <svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={2}
                aria-hidden
              >
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span className="text-[13px] font-medium text-white">
                Changer l&apos;image
              </span>
            </div>
          </>
        ) : isUploading ? (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2"
            style={{ borderRadius: 8 }}
          >
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-[#5A6175] border-t-[#3B82F6]"
              aria-hidden
            />
            <span className="text-xs text-muted-foreground">Envoi…</span>
          </div>
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-1 px-2"
            style={{ borderRadius: 8 }}
          >
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5A6175"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span className="text-center text-[12px] text-muted-foreground">
              Cliquer ou glisser une image
            </span>
            <span className="text-center text-[11px] text-[#3D4555]">
              JPG, PNG, WebP — Max 5 Mo
            </span>
          </div>
        )}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

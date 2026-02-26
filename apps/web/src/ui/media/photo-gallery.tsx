'use client';

import * as React from 'react';

type Attachment = { id: string; url: string; type?: string | null; created_at?: string | null };

export function PhotoGallery({
  attachments,
  title = 'Photos',
  className
}: {
  attachments: Attachment[];
  title?: string;
  className?: string;
}) {
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const photoAttachments = attachments.filter((a) => a?.url && (a.type === 'photo' || a.type === 'signature'));

  return (
    <div className={className}>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-mutedForeground">Click to expand</p>
        </div>
      </div>
      {photoAttachments.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {photoAttachments.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className="group relative overflow-hidden rounded-xl border border-border bg-background text-left"
              onClick={() => setLightboxIndex(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.type || 'Photo'}
                className="h-40 w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs text-white">
                {a.type || 'Photo'}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-sm text-mutedForeground">No photos yet.</div>
      )}

      {lightboxIndex !== null && photoAttachments[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-lg bg-white/10 px-3 py-1 text-white hover:bg-white/20"
            onClick={() => setLightboxIndex(null)}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoAttachments[lightboxIndex].url}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

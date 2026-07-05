'use client';

import { useMemo, useRef, useState } from 'react';
import { useProjectStore } from '@/lib/store/useProjectStore';
import {
  Card,
  CardBody,
  SectionTitle,
  Badge,
  Button,
  Select,
  Field,
  Spinner,
  EmptyState,
  cn,
} from '@/components/ui';
import { num } from '@/lib/format';
import type { PhotoCategory, PhotoMeta } from '@/lib/types';
import { Camera, Trash2, UploadCloud, WifiOff } from 'lucide-react';

/**
 * PHOTOS — reference gallery for the build.
 *
 * Upload site / flooring / inspiration / progress shots and pin them to a
 * category. Files POST to `/api/photos`, which stores them in Vercel Blob when
 * configured (permanent + cross-device). When Blob is NOT configured the server
 * responds `configured: false` and we fall back to a transient local object URL
 * so uploads still "work" for the current browser session (flagged localOnly).
 *
 * Mirrors the store + design-system conventions used across the app.
 */

// Friendly labels for each photo bucket (order = display order).
const CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: 'site', label: 'Site & Location' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'owned-materials', label: 'Owned Materials' },
  { value: 'inspiration', label: 'Inspiration' },
  { value: 'progress', label: 'Build Progress' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_LABEL: Record<PhotoCategory, string> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.label }),
  {} as Record<PhotoCategory, string>,
);

/** Human-readable file size (KB/MB) for the caption row. */
function formatSize(bytes?: number): string | null {
  if (!bytes || !Number.isFinite(bytes)) return null;
  if (bytes < 1024 * 1024) return `${num(bytes / 1024)} KB`;
  return `${num(bytes / (1024 * 1024), 1)} MB`;
}

export default function PhotosPage() {
  const { project, computed, addPhoto } = useProjectStore();

  // Upload UI state.
  const [category, setCategory] = useState<PhotoCategory>('site');
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group photos by category so we can render section-by-section (memoized).
  const grouped = useMemo(() => {
    const map = new Map<PhotoCategory, PhotoMeta[]>();
    for (const p of project?.photos ?? []) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [project?.photos]);

  if (!project || !computed) return null;

  const photos = project.photos;

  /**
   * Handle a file selection: upload each file to the server. On success use the
   * returned Blob URL; otherwise create a local object URL flagged localOnly.
   */
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadNote(null);

    let localCount = 0;
    const selectedCategory = category; // capture in case the Select changes mid-flight

    const list = Array.from(files);
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      let url: string;
      let localOnly = false;
      let sizeBytes = file.size;

      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/photos', { method: 'POST', body: form });
        const data = await res.json();

        if (data.configured && data.ok) {
          // Stored permanently in Vercel Blob.
          url = data.url as string;
          if (Number.isFinite(data.sizeBytes)) sizeBytes = data.sizeBytes as number;
        } else {
          // Blob not configured — keep a transient local preview for this session.
          url = URL.createObjectURL(file);
          localOnly = true;
          localCount++;
        }
      } catch {
        // Network/server error — still let the user see the image locally.
        url = URL.createObjectURL(file);
        localOnly = true;
        localCount++;
      }

      addPhoto({
        id: `photo-${Date.now()}-${i}`,
        category: selectedCategory,
        url,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        sizeBytes,
        localOnly,
      });
    }

    if (localCount > 0) {
      setUploadNote(
        `${localCount} ${localCount === 1 ? 'photo is' : 'photos are'} local to this browser only — configure Vercel Blob to make them permanent.`,
      );
    }

    setUploading(false);
    // Reset the input so selecting the same file again re-triggers onChange.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      {/* Intro + upload controls */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Photos"
            subtitle={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} across ${grouped.size} ${grouped.size === 1 ? 'category' : 'categories'}`}
          />
          <p className="text-sm text-timber-600">
            Keep site shots, flooring samples, inspiration, and progress pics attached to your
            build. Pick a category, then add one or more images.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-end">
            <Field label="Category">
              <Select value={category} onChange={(v) => setCategory(v)} options={CATEGORIES} />
            </Field>

            <div>
              <span className="label">Add photos</span>
              {/* Hidden native input driven by a big, friendly button (large tap target). */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploading}
              />
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Spinner className="h-4 w-4 text-white" /> Uploading…
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} /> Choose images
                  </>
                )}
              </Button>
            </div>
          </div>

          {uploadNote && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <WifiOff size={14} className="mt-0.5 flex-shrink-0" />
              <span>{uploadNote}</span>
            </p>
          )}

          <p className="mt-3 text-xs text-timber-500">
            Configuring Vercel Blob (<code className="rounded bg-timber-100 px-1">BLOB_READ_WRITE_TOKEN</code>){' '}
            makes photos permanent and visible across devices; without it they stay local to this
            browser session.
          </p>
        </CardBody>
      </Card>

      {/* Gallery */}
      {photos.length === 0 ? (
        <EmptyState
          icon={<Camera size={40} strokeWidth={1.5} />}
          title="No photos yet"
          children="Add site, flooring, inspiration, or progress photos above to build your visual reference."
        />
      ) : (
        <div className="space-y-4">
          {CATEGORIES.filter((c) => grouped.has(c.value)).map((c) => (
            <Card key={c.value}>
              <CardBody>
                <SectionTitle
                  title={c.label}
                  right={<Badge>{grouped.get(c.value)!.length}</Badge>}
                />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {grouped.get(c.value)!.map((photo) => (
                    <PhotoTile key={photo.id} photo={photo} />
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** A single photo card: image, caption editor, local-only flag, and delete. */
function PhotoTile({ photo }: { photo: PhotoMeta }) {
  const { updatePhoto, removePhoto } = useProjectStore();
  const size = formatSize(photo.sizeBytes);

  async function handleDelete() {
    // Remove from the project immediately for a snappy UI.
    removePhoto(photo.id);
    // Best-effort server cleanup for Blob-backed photos (local ones have no server copy).
    if (!photo.localOnly) {
      try {
        await fetch(`/api/photos?url=${encodeURIComponent(photo.url)}`, { method: 'DELETE' });
      } catch {
        /* orphaned Blob is harmless — ignore */
      }
    }
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-timber-200 bg-white shadow-card">
      <div className="relative">
        {/* Plain <img>: these are user object/Blob URLs, not statically optimizable. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || photo.filename}
          className="h-32 w-full rounded-lg object-cover"
          loading="lazy"
        />
        {photo.localOnly && (
          <Badge className="absolute left-1.5 top-1.5 bg-amber-100 text-amber-700">
            <WifiOff size={11} /> local only
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2">
        <input
          className="input py-1.5 text-sm"
          placeholder="Add a caption…"
          value={photo.caption ?? ''}
          onChange={(e) => updatePhoto(photo.id, { caption: e.target.value })}
        />
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-timber-400" title={photo.filename}>
            {photo.filename}
            {size ? ` · ${size}` : ''}
          </span>
          <Button
            variant="ghost"
            className="flex-shrink-0 px-2 text-red-600 hover:bg-red-50"
            onClick={handleDelete}
            aria-label={`Delete ${photo.filename}`}
            title="Delete photo"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}

import { NextResponse } from 'next/server';
import { uploadPhoto, deletePhoto, StorageNotConfigured } from '@/lib/store/storage';

/**
 * Reference-photo upload/delete. Files go to Vercel Blob. If Blob isn't
 * configured we return `configured: false` and the client keeps the image as a
 * transient local object URL so uploads still "work" for the current session.
 */
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }
    const data = await file.arrayBuffer();
    const { url, sizeBytes } = await uploadPhoto(file.name, data, file.type || 'image/jpeg');
    return NextResponse.json({ ok: true, configured: true, url, sizeBytes, filename: file.name });
  } catch (err) {
    if (err instanceof StorageNotConfigured) {
      return NextResponse.json({ ok: false, configured: false });
    }
    return NextResponse.json({ ok: false, configured: true, error: (err as Error).message });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ ok: false, error: 'Missing url' }, { status: 400 });
  try {
    await deletePhoto(url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StorageNotConfigured) {
      return NextResponse.json({ ok: true, configured: false });
    }
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}

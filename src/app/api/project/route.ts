import { NextResponse } from 'next/server';
import { loadProject, saveProject, StorageNotConfigured, isStorageConfigured } from '@/lib/store/storage';
import type { CoopProject } from '@/lib/types';

/**
 * The project "record" API. GET loads the single document; PUT saves it.
 * When Blob storage isn't configured we respond with `configured: false` and a
 * 200 so the client transparently falls back to localStorage — pricing/storage
 * problems must never break the app.
 */

export async function GET() {
  try {
    const project = await loadProject();
    return NextResponse.json({ configured: true, project });
  } catch (err) {
    if (err instanceof StorageNotConfigured) {
      return NextResponse.json({ configured: false, project: null });
    }
    // Any other failure: report but do not crash the client.
    return NextResponse.json(
      { configured: isStorageConfigured(), project: null, error: (err as Error).message },
      { status: 200 },
    );
  }
}

export async function PUT(req: Request) {
  let project: CoopProject;
  try {
    project = (await req.json()) as CoopProject;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const { url } = await saveProject(project);
    return NextResponse.json({ ok: true, configured: true, url });
  } catch (err) {
    if (err instanceof StorageNotConfigured) {
      // Client should keep the local copy; not an error the user must see.
      return NextResponse.json({ ok: false, configured: false });
    }
    return NextResponse.json(
      { ok: false, configured: true, error: (err as Error).message },
      { status: 200 },
    );
  }
}

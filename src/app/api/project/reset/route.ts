import { NextResponse } from 'next/server';
import { saveProject, StorageNotConfigured } from '@/lib/store/storage';
import { freshDefaultProject } from '@/lib/seed/defaultProject';

/**
 * Reset the project back to the recommended default design. Returns the fresh
 * default so the client can adopt it immediately even if Blob isn't configured.
 */
export async function POST() {
  const project = freshDefaultProject();
  project.updatedAt = new Date().toISOString();
  try {
    await saveProject(project);
    return NextResponse.json({ ok: true, configured: true, project });
  } catch (err) {
    if (err instanceof StorageNotConfigured) {
      return NextResponse.json({ ok: true, configured: false, project });
    }
    return NextResponse.json(
      { ok: false, configured: true, project, error: (err as Error).message },
      { status: 200 },
    );
  }
}

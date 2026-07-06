'use client';

import { create } from 'zustand';
import type {
  ComputedProject,
  CoopDesign,
  CoopProject,
  DesignOptions,
  LockedProduct,
  MaterialOverride,
  OwnedMaterial,
  PhotoMeta,
  PriceOverride,
  ProjectSettings,
  RunDesign,
} from '../types';
import { computeProject } from '../engine';
import { freshDefaultProject } from '../seed/defaultProject';

/**
 * Central client store. Responsibilities:
 *  - Load the project from the server (Vercel Blob) with a localStorage
 *    fallback so the app works with zero backend configuration.
 *  - Recompute the entire derived bundle (materials, budget, warnings, 3D…)
 *    on every edit via the pure engine.
 *  - Autosave (debounced) to the server AND localStorage on every change.
 *
 * Storage is best-effort: a failed server save never blocks editing — the local
 * copy is always kept as a safety net.
 */

const LOCAL_KEY = 'coop-project-v1';
const SAVE_DEBOUNCE_MS = 800;

type StorageMode = 'blob' | 'local' | 'unknown';

interface StoreState {
  project: CoopProject | null;
  computed: ComputedProject | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  storageMode: StorageMode;
  saving: boolean;
  lastSavedAt: string | null;
  error: string | null;

  load: () => Promise<void>;
  reset: () => Promise<void>;
  restore: (p: CoopProject) => void;
  replaceProject: (p: CoopProject) => void;

  updateCoop: (patch: Partial<CoopDesign>) => void;
  updateRun: (patch: Partial<RunDesign>) => void;
  updateOptions: (patch: Partial<DesignOptions>) => void;
  updateSettings: (patch: Partial<ProjectSettings>) => void;

  setMaterialOverride: (id: string, patch: Partial<MaterialOverride>) => void;
  clearMaterialOverride: (id: string) => void;
  setPriceOverride: (id: string, o: PriceOverride | null) => void;
  lockProduct: (id: string, locked: LockedProduct) => void;
  unlockProduct: (id: string) => void;

  addOwned: (o: OwnedMaterial) => void;
  updateOwned: (id: string, patch: Partial<OwnedMaterial>) => void;
  removeOwned: (id: string) => void;

  toggleChecklistStep: (key: string) => void;
  setPhaseComplete: (phaseId: number, stepCount: number, complete: boolean) => void;
  setNotes: (notes: string) => void;

  addPhoto: (p: PhotoMeta) => void;
  updatePhoto: (id: string, patch: Partial<PhotoMeta>) => void;
  removePhoto: (id: string) => void;
}

// --- local persistence helpers --------------------------------------------
function saveLocal(project: CoopProject) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(project));
  } catch {
    /* quota or private mode — ignore */
  }
}
function loadLocal(): CoopProject | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as CoopProject) : null;
  } catch {
    return null;
  }
}

// --- debounced + serialized server save ------------------------------------
let saveTimer: ReturnType<typeof setTimeout> | null = null;
// Saves are chained so a slow PUT can't complete AFTER a newer one and clobber
// it on the server (out-of-order write). `latestDraft`/`unsaved` drive the
// flush-on-unload path so an edit made inside the debounce window isn't lost.
let saveChain: Promise<void> = Promise.resolve();
let latestDraft: CoopProject | null = null;
let unsaved = false;
let flushRegistered = false;

function serverSave(project: CoopProject, set: (p: Partial<StoreState>) => void): Promise<void> {
  latestDraft = project;
  unsaved = true;
  set({ saving: true });
  saveChain = saveChain.then(async () => {
    try {
      const res = await fetch('/api/project', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(project),
      });
      const data = await res.json().catch(() => ({}));
      // Only the write of the newest draft clears the dirty flag.
      if (latestDraft === project) unsaved = false;
      set({
        saving: latestDraft !== project,
        lastSavedAt: new Date().toISOString(),
        storageMode: data?.configured ? 'blob' : 'local',
      });
    } catch {
      // Local copy already written; surface nothing blocking.
      set({ saving: false, storageMode: 'local' });
    }
  });
  return saveChain;
}

/** Best-effort flush of any pending edit when the tab is closing/hidden. */
function registerUnloadFlush() {
  if (flushRegistered || typeof window === 'undefined') return;
  flushRegistered = true;
  const flush = () => {
    if (!unsaved || !latestDraft) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    // keepalive lets the request outlive the page.
    try {
      void fetch('/api/project', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(latestDraft),
        keepalive: true,
      });
      unsaved = false;
    } catch {
      /* nothing more we can do on unload */
    }
  };
  window.addEventListener('pagehide', flush);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

function recompute(project: CoopProject): ComputedProject | null {
  try {
    return computeProject(project);
  } catch (e) {
    // Keep the app alive even if a computation edge case throws.
    console.error('compute error', e);
    return null;
  }
}

export const useProjectStore = create<StoreState>((set, get) => {
  /** Apply a mutation, recompute, and persist (local now, server debounced). */
  function commit(mutator: (draft: CoopProject) => void) {
    const current = get().project;
    if (!current) return;
    const draft: CoopProject = JSON.parse(JSON.stringify(current));
    mutator(draft);
    draft.updatedAt = new Date().toISOString();
    const computed = recompute(draft) ?? get().computed;
    set({ project: draft, computed });
    saveLocal(draft);
    // Mark dirty immediately so an unload inside the debounce window still flushes.
    latestDraft = draft;
    unsaved = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => serverSave(draft, set), SAVE_DEBOUNCE_MS);
  }

  return {
    project: null,
    computed: null,
    status: 'idle',
    storageMode: 'unknown',
    saving: false,
    lastSavedAt: null,
    error: null,

    async load() {
      if (get().status === 'loading') return;
      set({ status: 'loading' });
      registerUnloadFlush();
      const local = loadLocal();
      try {
        const res = await fetch('/api/project', { cache: 'no-store' });
        const data = await res.json();
        if (data.configured) {
          const server = data.project as CoopProject | null;
          // Reconcile: if the local copy is newer than the server's (an edit that
          // never flushed before the last close), adopt local and re-push it.
          const localNewer =
            !!server &&
            !!local &&
            typeof local.updatedAt === 'string' &&
            typeof server.updatedAt === 'string' &&
            local.updatedAt > server.updatedAt;
          const project = localNewer ? local! : server ?? local ?? freshDefaultProject();
          if (!server || localNewer) {
            // Persist the adopted copy (seed, or the newer local edit).
            void serverSave(project, set);
          }
          set({
            project,
            computed: recompute(project),
            status: 'ready',
            storageMode: 'blob',
          });
          saveLocal(project);
        } else {
          // No Blob configured — use localStorage / default.
          const project = local ?? freshDefaultProject();
          set({
            project,
            computed: recompute(project),
            status: 'ready',
            storageMode: 'local',
          });
          saveLocal(project);
        }
      } catch (e) {
        // Total offline fallback.
        const project = local ?? freshDefaultProject();
        set({
          project,
          computed: recompute(project),
          status: 'ready',
          storageMode: 'local',
          error: (e as Error).message,
        });
      }
    },

    async reset() {
      try {
        const res = await fetch('/api/project/reset', { method: 'POST' });
        const data = await res.json();
        const project: CoopProject = data.project ?? freshDefaultProject();
        set({
          project,
          computed: recompute(project),
          storageMode: data?.configured ? 'blob' : 'local',
        });
        saveLocal(project);
      } catch {
        const project = freshDefaultProject();
        project.updatedAt = new Date().toISOString();
        set({ project, computed: recompute(project) });
        saveLocal(project);
      }
    },

    restore(p) {
      get().replaceProject(p);
    },

    replaceProject(p) {
      const project: CoopProject = { ...p, updatedAt: new Date().toISOString() };
      set({ project, computed: recompute(project) });
      saveLocal(project);
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => serverSave(project, set), SAVE_DEBOUNCE_MS);
    },

    updateCoop: (patch) => commit((d) => Object.assign(d.coop, patch)),
    updateRun: (patch) => commit((d) => Object.assign(d.run, patch)),
    updateOptions: (patch) => commit((d) => Object.assign(d.options, patch)),
    updateSettings: (patch) => commit((d) => Object.assign(d.settings, patch)),

    setMaterialOverride: (id, patch) =>
      commit((d) => {
        d.materialOverrides[id] = { ...(d.materialOverrides[id] ?? {}), ...patch };
      }),
    clearMaterialOverride: (id) =>
      commit((d) => {
        delete d.materialOverrides[id];
      }),
    setPriceOverride: (id, o) =>
      commit((d) => {
        if (o) d.priceOverrides[id] = o;
        else delete d.priceOverrides[id];
      }),
    lockProduct: (id, locked) =>
      commit((d) => {
        d.lockedProducts[id] = locked;
      }),
    unlockProduct: (id) =>
      commit((d) => {
        delete d.lockedProducts[id];
      }),

    addOwned: (o) => commit((d) => void d.ownedMaterials.push(o)),
    updateOwned: (id, patch) =>
      commit((d) => {
        const idx = d.ownedMaterials.findIndex((x) => x.id === id);
        if (idx >= 0) d.ownedMaterials[idx] = { ...d.ownedMaterials[idx], ...patch };
      }),
    removeOwned: (id) =>
      commit((d) => {
        d.ownedMaterials = d.ownedMaterials.filter((x) => x.id !== id);
      }),

    toggleChecklistStep: (key) =>
      commit((d) => {
        d.checklist[key] = !d.checklist[key];
      }),
    setPhaseComplete: (phaseId, stepCount, complete) =>
      commit((d) => {
        for (let i = 0; i < stepCount; i++) d.checklist[`${phaseId}:${i}`] = complete;
      }),
    setNotes: (notes) => commit((d) => void (d.notes = notes)),

    addPhoto: (p) => commit((d) => void d.photos.unshift(p)),
    updatePhoto: (id, patch) =>
      commit((d) => {
        const idx = d.photos.findIndex((x) => x.id === id);
        if (idx >= 0) d.photos[idx] = { ...d.photos[idx], ...patch };
      }),
    removePhoto: (id) =>
      commit((d) => {
        d.photos = d.photos.filter((x) => x.id !== id);
      }),
  };
});

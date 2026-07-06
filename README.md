# 🪶 Coop Planner

A polished, mobile-friendly web app to **design, price, visualize, and build one chicken coop**
— a 24-bird walk-in coop + attached predator-proof run, sized for large breeds (Orpingtons),
built from Home Depot materials in Concord, NH.

It ships with a **recommended default design** and lets you adjust any dimension or option and
immediately see updated **materials, pricing, cut list, build checklist, cost warnings, and a 3D
model**.

---

## ✨ What it does

- **Recommended design by default** — 8×12 walk-in coop + 12×24 covered run, editable everywhere.
- **Live calculation engine** — coop/run square footage, roost + nesting checks, lumber/sheet/roofing/
  hardware-cloth/fastener quantities, 10% waste, budget vs $3,000, owner-supplied deductions.
- **Predator-proofing enforcement** — warns on chicken wire, uncovered runs, missing anti-dig aprons,
  weak latches, roof pitch too shallow for NH snow, rafter sag, ventilation, and GFCI safety.
- **Interactive 3D model** (React Three Fiber) — ~120 individual, clickable build components with a
  part inspector (material, dimensions, qty, cost, cut notes, phase, SKU), layer/structure toggles,
  exploded view, and dimension labels.
- **Home Depot pricing** — cached seed prices you can edit, lock to a specific SKU, or check live
  (with a graceful manual fallback — pricing never breaks the app).
- **Shopping mode** grouped by category, **cut list**, **20-phase build checklist** with tools/time/
  steps/mistakes/safety, **siding & nesting-box comparison** screens.
- **Owned inventory** (pre-loaded with your vinyl plank flooring), **photo uploads**, **PDF + CSV
  export**, and **JSON backup/restore**.
- **Simple password gate** (no accounts). Default password: `coop`. The gate cookie is a signed HMAC of `AUTH_SECRET` (set a random value in production so it can't be forged).

---

## 🧱 Tech stack

| Concern        | Choice |
| -------------- | ------ |
| Framework      | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling        | Tailwind CSS 3 (custom timber/blueprint theme) |
| State          | Zustand (client store with autosave) |
| 3D             | three.js + @react-three/fiber + @react-three/drei |
| Persistence    | **Vercel Blob** (single JSON document) with **localStorage fallback** |
| Photos         | Vercel Blob (falls back to local object URLs) |
| PDF / CSV      | jsPDF + jspdf-autotable / papaparse |
| Tests          | Vitest (calculation engine) |

> **Why Blob, not Postgres?** This is a single-project app. Storing the whole project as one JSON
> document in Vercel Blob needs only one token, no schema migrations, and no ORM — while still being
> durable Vercel storage (never the ephemeral function filesystem). CSV/JSON are for backups only.

---

## 📁 Project structure

```
src/
├─ app/
│  ├─ (app)/                 # authenticated screens (share AppShell)
│  │  ├─ page.tsx            # Dashboard
│  │  ├─ design/             # Design settings (edit everything)
│  │  ├─ model/             # 3D viewer
│  │  ├─ materials/         # Materials & pricing (edit/lock SKUs)
│  │  ├─ shopping/          # Shopping mode (grouped, check-off)
│  │  ├─ cutlist/           # Cut list
│  │  ├─ checklist/         # 20-phase build checklist
│  │  ├─ nesting/           # Nesting box comparison
│  │  ├─ siding/            # Siding comparison
│  │  ├─ owned/             # Owned inventory
│  │  ├─ photos/            # Reference photo uploads
│  │  ├─ export/            # PDF / CSV / backup
│  │  └─ settings/          # Settings + data backup
│  ├─ login/                # password gate
│  ├─ print/                # printable full plan (browser "Save as PDF")
│  ├─ api/                  # auth, project (load/save), reset, pricing, photos
│  ├─ layout.tsx            # root layout
│  └─ globals.css
├─ components/
│  ├─ ui.tsx                # design system (Button, Card, Field, Toggle, …)
│  ├─ layout/               # AppShell + nav
│  ├─ three/CoopModel.tsx   # R3F scene
│  ├─ WarningList.tsx
│  └─ BudgetMeter.tsx
├─ lib/
│  ├─ types.ts              # the entire data model
│  ├─ constants.ts          # design rules, standard sizes, seed prices, catalogs
│  ├─ engine/               # PURE calculation engine (unit-tested)
│  │  ├─ geometry.ts        #   derived dimensions
│  │  ├─ materials.ts       #   bill of materials + price resolution
│  │  ├─ cutlist.ts
│  │  ├─ budget.ts
│  │  ├─ warnings.ts        #   validation rules
│  │  ├─ phases.ts          #   20 build phases
│  │  ├─ components3d.ts    #   parametric 3D component metadata
│  │  ├─ engine.test.ts     #   Vitest suite (25 tests)
│  │  └─ index.ts           #   computeProject() orchestrator
│  ├─ store/                # storage (Blob) + Zustand store
│  ├─ pricing/provider.ts   # pricing-provider abstraction
│  ├─ seed/defaultProject.ts# recommended default design
│  ├─ csv.ts / pdf.ts / format.ts
└─ middleware.ts            # password gate
```

---

## 🚀 Getting started (local)

```bash
# 1. Install
npm install

# 2. (optional) configure env — the app works without this, using localStorage
cp .env.example .env.local        # then edit values

# 3. Run
npm run dev                       # http://localhost:3000  (password: coop)

# 4. Verify
npm run test                      # calculation-engine unit tests
npm run typecheck                 # tsc --noEmit
npm run build                     # production build
```

---

## 🔐 Environment variables

All are **optional** — the app runs with zero configuration (persisting to `localStorage`). Set them
for cloud persistence + permanent photos. See `.env.example`.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `APP_PASSWORD` | `coop` | The single shared password for the gate. |
| `BLOB_READ_WRITE_TOKEN` | — | Vercel Blob token. Enables cloud persistence of the project JSON + photo uploads. Without it, the app uses `localStorage` and local object URLs. |
| `AUTH_SECRET` | dev value | Reserved for signing (currently a static cookie value). |
| `HOMEDEPOT_LIVE` | — | Set to `1` to enable the experimental live-pricing lookup (still degrades to manual/cached). |

---

## ☁️ Deploy to Vercel

1. Push this repo to GitHub and **Import** it in Vercel (framework auto-detected as Next.js).
2. **Add a Blob store** (recommended): Vercel dashboard → **Storage → Create → Blob**. This injects
   `BLOB_READ_WRITE_TOKEN` into the project automatically.
3. Set `APP_PASSWORD` in **Project Settings → Environment Variables** (or keep the default `coop`).
4. **Deploy.** That's it — no database provisioning, no migrations.

If you skip the Blob store, the app still deploys and works; it just persists per-browser via
`localStorage` and photos are session-local.

To pull cloud env vars locally: `vercel env pull .env.local`.

---

## 🗃️ "Database" schema

There is exactly **one record** — the `CoopProject` JSON document (see `src/lib/types.ts`),
stored at `coop/project.json` in Blob. It holds project settings, coop/run dimensions, selected
options, material/price/SKU overrides, owned materials, checklist progress, notes, photos, and
export history. Everything else (materials, cut list, budget, warnings, 3D components) is **derived**
by the pure engine and never persisted.

- **Load:** `GET /api/project` → returns the document (or `configured:false` to trigger local fallback).
- **Save:** `PUT /api/project` (debounced autosave from the client).
- **Reset:** `POST /api/project/reset` → restores the recommended default.
- **Backups:** CSV + JSON download/upload from the Export and Settings screens.

The recommended **seed/default project** lives in `src/lib/seed/defaultProject.ts` and is loaded
automatically the first time (and on reset).

---

## 🧮 Calculation engine

The engine (`src/lib/engine`) is a set of **pure functions** — no React, no I/O — so it is fully
unit-tested and reused by every screen and the 3D model. `computeProject(project)` returns geometry,
materials, cut list, budget, warnings, phases, 3D components, and headline metrics. Tune any rule or
price in `src/lib/constants.ts`.

Run the tests with `npm run test`.

---

## 📝 Notes on the recommended design

The default honors the requested sizes (8×12 coop, 12×24 fully-roofed run) with **cost-conscious
material choices** (T1-11 siding, DIY roll-away nesting, economical framing, deck blocks instead of
concrete). Fully roofing a 288 sq ft predator-proof run with corrugated plastic + 1/2" hardware
cloth honestly lands **over the $3,000 target** — so the app says so plainly and offers concrete
levers (shorten the run, switch the run roof to metal, phase the build). **Predator-proofing is
never traded away for budget.**

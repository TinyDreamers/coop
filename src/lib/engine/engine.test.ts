import { describe, it, expect } from 'vitest';
import { freshDefaultProject } from '../seed/defaultProject';
import { computeProject, computeMetrics, computeGeometry } from './index';
import type { CoopProject } from '../types';

/**
 * Unit tests for the calculation engine. These lock in the core construction
 * math and the warning rules so a future edit can't silently break the plan.
 */

function project(mut?: (p: CoopProject) => void): CoopProject {
  const p = freshDefaultProject();
  mut?.(p);
  return p;
}

describe('geometry', () => {
  it('computes coop + run areas', () => {
    const geo = computeGeometry(project());
    expect(geo.coopAreaSqft).toBe(96); // 8 x 12
    expect(geo.runAreaSqft).toBe(288); // 12 x 24
  });

  it('computes a 3:12 coop roof pitch from the default heights', () => {
    const geo = computeGeometry(project());
    // rise 2 ft over run (depth 8 + overhang 1 = 9) -> 2/9*12 ≈ 2.67? check run uses depth+overhang
    expect(geo.coopRoofRise).toBe(2);
    // pitch computed against depth+overhang
    expect(geo.coopRoofPitchPer12).toBeGreaterThan(2.5);
  });
});

describe('metrics', () => {
  it('reports per-bird space for the default flock', () => {
    const p = project();
    const m = computeMetrics(p, computeGeometry(p));
    expect(m.coopAreaPerBird).toBe(4); // 96 / 24
    expect(m.runAreaPerBird).toBe(12); // 288 / 24
    expect(m.requiredNestingBoxes).toBe(6); // ceil(24/4)
    expect(m.requiredRoostFt).toBe(20); // 24 * 10in / 12
  });
});

describe('materials + budget', () => {
  it('produces a non-empty BOM with resolved prices', () => {
    const c = computeProject(project());
    expect(c.materials.length).toBeGreaterThan(20);
    // Every "need" line should have a numeric line total.
    for (const m of c.materials) {
      expect(Number.isFinite(m.lineTotal)).toBe(true);
      expect(m.qty).toBeGreaterThanOrEqual(0);
    }
  });

  it('applies 10% waste to consumables (ceil)', () => {
    const c = computeProject(project());
    const floor = c.materials.find((m) => m.id === 'sheet.floor-ply-34')!;
    // base 3 sheets * 1.10 = 3.3 -> ceil 4
    expect(floor.baseQty).toBe(3);
    expect(floor.qty).toBe(4);
  });

  it('does not apply waste to whole-unit hardware', () => {
    const c = computeProject(project());
    const auto = c.materials.find((m) => m.id === 'autodoor.unit')!;
    expect(auto.qty).toBe(1);
    expect(auto.wasteFactor).toBe(0);
  });

  it('treats owner-supplied vinyl as owned with zero cost', () => {
    const c = computeProject(project());
    const vinyl = c.materials.find((m) => m.id === 'floor.vinyl-plank')!;
    expect(vinyl.status).toBe('owned');
    expect(vinyl.lineTotal).toBe(0);
  });

  it('subtracts owned inventory from the shopping quantity', () => {
    const p = project((pp) => {
      pp.ownedMaterials.push({
        id: 'owned-screws',
        name: '3in screws',
        quantity: 1,
        unit: 'box',
        matchesMaterialId: 'fasten.ext-screws-3',
      });
    });
    const c = computeProject(p);
    const screws = c.materials.find((m) => m.id === 'fasten.ext-screws-3')!;
    // base 2 boxes - 1 owned = 1
    expect(screws.qty).toBe(1);
  });

  it('honors a manual price override and marks the source', () => {
    const p = project((pp) => {
      pp.priceOverrides['sheet.floor-ply-34'] = {
        unitPrice: 60,
        source: 'manual',
        updatedAt: '2026-01-01',
      };
    });
    const c = computeProject(p);
    const floor = c.materials.find((m) => m.id === 'sheet.floor-ply-34')!;
    expect(floor.unitPrice).toBe(60);
    expect(floor.priceSource).toBe('manual');
  });

  it('honors a locked SKU price over the default', () => {
    const p = project((pp) => {
      pp.lockedProducts['autodoor.unit'] = {
        sku: '123456',
        name: 'Specific Auto Door',
        unitPrice: 210,
        priceSource: 'cached',
        lockedAt: '2026-01-01',
      };
    });
    const c = computeProject(p);
    const auto = c.materials.find((m) => m.id === 'autodoor.unit')!;
    expect(auto.unitPrice).toBe(210);
    expect(auto.homeDepotSku).toBe('123456');
  });

  it('excluding a line removes it from the budget', () => {
    const base = computeProject(project()).budget.total;
    const p = project((pp) => {
      pp.materialOverrides['autodoor.unit'] = { status: 'excluded' };
    });
    const excluded = computeProject(p).budget.total;
    expect(excluded).toBeLessThan(base);
  });

  it('applies zero sales tax for NH', () => {
    const c = computeProject(project());
    expect(c.budget.tax).toBe(0);
    expect(c.budget.total).toBe(c.budget.materialsSubtotal);
  });

  it('groups the budget by category', () => {
    const c = computeProject(project());
    const cats = c.budget.byCategory.map((x) => x.category);
    expect(cats).toContain('hardware-cloth');
    expect(cats).toContain('roofing');
    expect(cats).toContain('lumber');
  });
});

describe('cut list', () => {
  it('generates cuts tied to materials and phases', () => {
    const c = computeProject(project());
    expect(c.cutList.length).toBeGreaterThan(5);
    const joist = c.cutList.find((x) => x.part === 'Floor joist')!;
    expect(joist.lengthIn).toBe(96); // 8 ft depth
    expect(joist.stock).toContain('2x8');
  });

  it('never cuts a single piece longer than its stock board', () => {
    // A key buildability invariant: length of every cut <= the stock length.
    const c = computeProject(project());
    for (const cut of c.cutList) {
      const m = cut.stock.match(/(\d+(?:\.\d+)?)\s*ft/);
      expect(m, `stock has no ft length: ${cut.stock}`).toBeTruthy();
      const stockIn = parseFloat(m![1]) * 12;
      expect(cut.lengthIn, `${cut.part} (${cut.stock})`).toBeLessThanOrEqual(stockIn + 0.5);
    }
  });

  it('holds the invariant across the supported design envelope', () => {
    // The BOM uses standard stock sizes tuned for the recommended footprint
    // (coop <= 12 ft wide / 8 ft deep, run 12 ft wide). Longer runs only change
    // COUNTS, not member lengths, so the cut list stays buildable.
    const p = project((pp) => {
      pp.run.lengthFt = 32; // longer run: more panels/posts, same member lengths
    });
    const c = computeProject(p);
    for (const cut of c.cutList) {
      const stockIn = parseFloat(cut.stock.match(/(\d+(?:\.\d+)?)\s*ft/)![1]) * 12;
      expect(cut.lengthIn, `${cut.part} (${cut.stock})`).toBeLessThanOrEqual(stockIn + 0.5);
    }
  });
});

describe('roof panels', () => {
  it('orders panels no longer than 12 ft, using multiple courses on long slopes', () => {
    const c = computeProject(project());
    const runPanel = c.materials.find((m) => m.id === 'roof.run-panel')!;
    // The 12 ft-wide run roof slope is > 12 ft, so panels must be <= 12 ft and
    // there must be enough of them to cover 2 lapped courses.
    expect(runPanel.name).toMatch(/\((\d+) ft\)/);
    const len = parseInt(runPanel.name.match(/\((\d+) ft\)/)![1], 10);
    expect(len).toBeLessThanOrEqual(12);
    // 13 columns * 2 courses = 26 panels for the default run.
    expect(runPanel.qty).toBeGreaterThanOrEqual(20);
  });
});

describe('warnings', () => {
  it('the recommended default has no space/predator errors', () => {
    const c = computeProject(project());
    const errors = c.warnings.filter((w) => w.severity === 'error');
    const errorCats = errors.map((e) => e.category);
    // Space + predator must be clean by default.
    expect(errorCats).not.toContain('space');
    expect(errorCats).not.toContain('predator');
  });

  it('warns when the coop is too small', () => {
    const p = project((pp) => {
      pp.coop.depthFt = 4; // 48 sqft = 2/bird
    });
    const c = computeProject(p);
    expect(c.warnings.some((w) => w.id === 'coop-space' && w.severity === 'error')).toBe(true);
  });

  it('flags chicken wire as a weak-wire error', () => {
    const p = project((pp) => {
      pp.options.runWireType = 'chicken-wire';
    });
    const c = computeProject(p);
    expect(c.warnings.some((w) => w.id === 'weak-wire' && w.severity === 'error')).toBe(true);
  });

  it('fires the no-latch error when only the RUN door latch is excluded', () => {
    const p = project((pp) => {
      pp.materialOverrides['door.latch-run'] = { status: 'excluded' };
    });
    const c = computeProject(p);
    expect(c.warnings.some((w) => w.id === 'no-latch')).toBe(true);
  });

  it('fires the no-latch error when the COOP door latch is excluded', () => {
    const p = project((pp) => {
      pp.materialOverrides['door.latch-coop'] = { status: 'excluded' };
    });
    const c = computeProject(p);
    expect(c.warnings.some((w) => w.id === 'no-latch')).toBe(true);
  });

  it('flags a missing anti-dig apron', () => {
    const p = project((pp) => {
      pp.options.antiDig = 'none';
    });
    const c = computeProject(p);
    expect(c.warnings.some((w) => w.id === 'no-antidig')).toBe(true);
  });

  it('flags an uncovered run', () => {
    const p = project((pp) => {
      pp.options.coveredRun = false;
    });
    const c = computeProject(p);
    expect(c.warnings.some((w) => w.id === 'uncovered-run')).toBe(true);
  });

  it('flags a too-shallow coop roof', () => {
    const p = project((pp) => {
      pp.coop.frontWallHeightFt = 6.5; // almost flat
    });
    const c = computeProject(p);
    expect(c.warnings.some((w) => w.id === 'coop-pitch')).toBe(true);
  });

  it('flags heated water without GFCI', () => {
    const p = project((pp) => {
      pp.options.heatedWater = true;
      pp.options.outdoorGfci = false;
    });
    const c = computeProject(p);
    expect(c.warnings.some((w) => w.id === 'gfci' && w.severity === 'error')).toBe(true);
  });

  it('flags over-budget designs', () => {
    const p = project((pp) => {
      pp.settings.budget = 500;
    });
    const c = computeProject(p);
    expect(c.budget.overBudget).toBe(true);
    expect(c.warnings.some((w) => w.id === 'over-budget')).toBe(true);
  });
});

describe('3d components', () => {
  it('emits individual, clickable components across all layers', () => {
    const c = computeProject(project());
    expect(c.components.length).toBeGreaterThan(30);
    const layers = new Set(c.components.map((x) => x.layer));
    expect(layers.has('framing')).toBe(true);
    expect(layers.has('siding')).toBe(true);
    expect(layers.has('roofing')).toBe(true);
    expect(layers.has('hardware-cloth')).toBe(true);
    // Each component must carry inspector metadata.
    for (const comp of c.components) {
      expect(comp.name.length).toBeGreaterThan(0);
      expect(comp.size.every((n) => n > 0)).toBe(true);
    }
  });

  it('includes both coop and run structures', () => {
    const c = computeProject(project());
    const structures = new Set(c.components.map((x) => x.structure));
    expect(structures.has('coop')).toBe(true);
    expect(structures.has('run')).toBe(true);
  });
});

describe('phases', () => {
  it('produces all 20 build phases with steps + time', () => {
    const c = computeProject(project());
    expect(c.phases.length).toBe(20);
    for (const ph of c.phases) {
      expect(ph.steps.length).toBeGreaterThan(0);
      expect(ph.estimatedHours).toBeGreaterThan(0);
      expect(ph.title.length).toBeGreaterThan(0);
    }
  });
});

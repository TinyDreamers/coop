import type { CoopProject, MaterialItem } from '../types';
import { computeProject } from '../engine';
import { freshDefaultProject } from '../seed/defaultProject';
import { parseSpec, homeDepotSearchUrl, type MaterialSpec } from './homeDepotScrape';

/**
 * SCRAPE MANIFEST
 *
 * The scraper "goes through" the coop's real bill of materials — not a static
 * list — so any design change flows straight into what gets priced. We derive
 * the target list from the engine's computed materials, then DEDUPE by search
 * term: the BOM has ~40 lines but many share a term (every 2x4 line searches
 * "2x4x8 stud"), so a dozen page loads cover the whole build.
 */

/** One thing to look up on Home Depot, plus every material line it prices. */
export interface ScrapeTarget {
  /** Stable key = the (lower-cased) search term. */
  key: string;
  searchTerm: string;
  searchUrl: string;
  spec: MaterialSpec;
  /** Material lines that resolve to this term (id, name, unit, category). */
  materials: { id: string; name: string; unit: string; category: string; unitPrice: number }[];
}

/** Materials we never price via Home Depot (owner-supplied / free lines). */
function isScrapable(m: MaterialItem): boolean {
  if (m.ownerSupplied) return false;
  if (!m.searchTerm) return false;
  // Skip lines whose search term is a placeholder like "... (OWNED)".
  if (/\(owned\)/i.test(m.searchTerm)) return false;
  return true;
}

/**
 * Build the deduped list of Home Depot lookups for a project (defaults to the
 * seed design). Targets come out in a stable order (first appearance in the
 * BOM) so a re-run produces the same manifest.
 */
export function buildScrapeManifest(project: CoopProject = freshDefaultProject()): ScrapeTarget[] {
  const { materials } = computeProject(project);
  const byKey = new Map<string, ScrapeTarget>();

  for (const m of materials) {
    if (!isScrapable(m)) continue;
    const term = m.searchTerm.trim();
    const key = term.toLowerCase();
    let target = byKey.get(key);
    if (!target) {
      target = {
        key,
        searchTerm: term,
        searchUrl: homeDepotSearchUrl(term),
        spec: parseSpec(term, m.unit),
        materials: [],
      };
      byKey.set(key, target);
    }
    target.materials.push({
      id: m.id,
      name: m.name,
      unit: m.unit,
      category: m.category,
      unitPrice: m.unitPrice,
    });
  }

  return [...byKey.values()];
}

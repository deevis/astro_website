import { validatePlan } from './planValidation';
import { mergePlanDefaults, migratePlanToV2, type RetirementPlan } from './types';

export const STORAGE_KEY = 'retirement-planner-plan-v2';
export const LEGACY_STORAGE_KEY = 'retirement-planner-plan-v1';

export function loadPlan(): RetirementPlan | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  return raw ? parseImportedPlan(raw) : null;
}

export function savePlan(plan: RetirementPlan): void {
  if (typeof localStorage === 'undefined') throw new Error('Browser storage is unavailable. Export a backup.');
  validatePlan(plan);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...plan, schemaVersion: 2 }));
  } catch {
    throw new Error('Could not save to browser storage. Export a backup to keep your changes.');
  }
  // A failed legacy cleanup must not turn a successful save into a failure.
  try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* Current backup is saved. */ }
}

export function clearSavedPlan(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function exportPlanJson(plan: RetirementPlan): string {
  return JSON.stringify({ ...plan, schemaVersion: 2 }, null, 2);
}

export function downloadPlanJson(plan: RetirementPlan, filename?: string): void {
  const blob = new Blob([exportPlanJson(plan)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${slugify(plan.name) || 'retirement-plan'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedPlan(json: string): RetirementPlan {
  const parsed = JSON.parse(json) as RetirementPlan;
  if (parsed?.schemaVersion != null && parsed.schemaVersion > 2) {
    throw new Error(`Unsupported plan file version ${parsed.schemaVersion}. Expected 1 or 2.`);
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.primary || !parsed.assumptions) {
    throw new Error('Invalid plan file: missing required fields.');
  }
  for (const key of ['accounts', 'income', 'expenses', 'socialSecurity', 'realEstate', 'otherAssets'] as const) {
    if (parsed[key] != null && (!Array.isArray(parsed[key]) || parsed[key]!.some((item) => !item || typeof item !== 'object'))) throw new Error('Invalid plan file: ' + key + ' must contain valid entries.');
  }
  const migrated =
    parsed.schemaVersion === 1 || parsed.schemaVersion == null
      ? migratePlanToV2({ ...parsed, schemaVersion: 1 })
      : parsed;
  const plan = {
    ...mergePlanDefaults(migrated),
    schemaVersion: 2 as const,
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
  validatePlan(plan);
  return plan;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

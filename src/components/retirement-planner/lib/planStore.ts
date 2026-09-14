import { writable, get } from 'svelte/store';
import { createEmptyPlan, syncRetirementDerivedFields, type RetirementPlan } from './types';
import { clearSavedPlan, downloadPlanJson, loadPlan, parseImportedPlan, savePlan } from './persistence';

export const saveStatus = writable({ savedAt: '', error: '' });
function fingerprint(plan: RetirementPlan) { return JSON.stringify({ ...plan, updatedAt: '' }); }
function createPlanStore() {
  const { subscribe, set, update } = writable<RetirementPlan>(createEmptyPlan());
  let lastSaved = '';
  let loadFailed = false;
  const setSynced = (plan: RetirementPlan) => set(syncRetirementDerivedFields(plan));
  function persist() {
    if (loadFailed) return false;
    const plan = get({ subscribe });
    const signature = fingerprint(plan);
    if (signature === lastSaved) return true;
    const saved = { ...plan, updatedAt: new Date().toISOString() };
    try {
      savePlan(saved);
      lastSaved = signature;
      plan.updatedAt = saved.updatedAt;
      saveStatus.set({ savedAt: saved.updatedAt, error: '' });
      return true;
    } catch (error) {
      saveStatus.update((status) => ({ ...status, error: error instanceof Error ? error.message : 'Save failed. Export a backup.' }));
      return false;
    }
  }
  return {
    subscribe,
    set: setSynced,
    update: (fn: (plan: RetirementPlan) => RetirementPlan) => update((plan) => syncRetirementDerivedFields(fn(plan))),
    hydrate() {
      try {
        const saved = loadPlan();
        if (saved) { setSynced(saved); lastSaved = fingerprint(get({ subscribe })); saveStatus.set({ savedAt: saved.updatedAt, error: '' }); }
      } catch {
        loadFailed = true;
        saveStatus.set({ savedAt: '', error: 'Saved plan could not be loaded. The stored backup has been preserved. Import a valid backup or reset before saving.' });
      }
    },
    persist,
    persistAndTouch: persist,
    reset() {
      try { clearSavedPlan(); } catch { saveStatus.update((s) => ({ ...s, error: 'Could not clear browser storage.' })); return false; }
      loadFailed = false; lastSaved = '';
      setSynced(createEmptyPlan()); saveStatus.set({ savedAt: '', error: '' }); return true;
    },
    exportJson() { downloadPlanJson(get({ subscribe })); },
    importJson(json: string) {
      const plan = parseImportedPlan(json);
      plan.updatedAt = new Date().toISOString();
      savePlan(plan);
      loadFailed = false;
      setSynced(plan);
      lastSaved = fingerprint(get({ subscribe }));
      saveStatus.set({ savedAt: plan.updatedAt, error: '' });
    },
  };
}
export const planStore = createPlanStore();

import type { RetirementPlan } from './types';
import { runMonteCarloAsync, type MonteCarloProgress, type MonteCarloResult, type WorkerInMessage, type WorkerOutMessage } from './monteCarloCore';
export type { MonteCarloResult, MonteCarloProgress, FailureCase, FailureYearBeat } from './monteCarloCore';
export { scenarioExportPayload, summarizeEndingBalances } from './monteCarloCore';

let activeCancel: (() => void) | null = null;
export function cancelMonteCarlo(): void { activeCancel?.(); }

export function runMonteCarlo(plan: RetirementPlan, options: {
  runs?: number; seed?: number; onProgress?: (p: MonteCarloProgress) => void;
} = {}): Promise<MonteCarloResult> {
  cancelMonteCarlo();
  const snapshot = structuredClone(plan);
  const runs = options.runs ?? plan.assumptions.monteCarloRuns;
  const seed = options.seed ?? Date.now();
  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;
    let finished = false;
    const cleanup = () => {
      finished = true;
      worker?.terminate();
      worker = null;
      if (activeCancel === cancel) activeCancel = null;
    };
    const cancel = () => { cleanup(); reject(new DOMException('Simulation cancelled', 'AbortError')); };
    activeCancel = cancel;
    const succeed = (result: MonteCarloResult) => { if (!finished) { cleanup(); resolve(result); } };
    const fail = (error: unknown) => { if (!finished) { cleanup(); reject(error); } };
    const progress = (p: MonteCarloProgress) => { if (!finished) options.onProgress?.(p); };
    const fallback = () => {
      worker?.terminate();
      worker = null;
      if (finished) return;
      void runMonteCarloAsync(snapshot, { runs, seed, shouldCancel: () => finished,
        onProgress: (completed, total) => progress({ type: 'progress', completed, total })
      }).then(succeed, fail);
    };
    try {
      worker = new Worker(new URL('./monteCarlo.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        if (finished) return;
        const data = event.data;
        if (data.type === 'progress') progress(data);
        else if (data.type === 'error') fail(new Error(data.message));
        else succeed(data);
      };
      worker.onerror = fallback;
      worker.postMessage({ type: 'run', plan: snapshot, runs, seed } satisfies WorkerInMessage);
    } catch { fallback(); }
  });
}

/// <reference lib="webworker" />
import {
  runMonteCarloBatch,
  type WorkerInMessage,
  type WorkerOutMessage,
} from './monteCarloCore';

let cancelled = false;

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (msg.type !== 'run') return;

  cancelled = false;
  try {
    const result = runMonteCarloBatch(msg.plan, {
      runs: msg.runs ?? msg.plan.assumptions.monteCarloRuns,
      seed: msg.seed,
      shouldCancel: () => cancelled,
      onProgress: (completed, total) => {
        const progress: WorkerOutMessage = { type: 'progress', completed, total };
        self.postMessage(progress);
      },
    });
    if (!cancelled) {
      self.postMessage(result);
    }
  } catch (e) {
    const error: WorkerOutMessage = {
      type: 'error',
      message: e instanceof Error ? e.message : 'Monte Carlo failed',
    };
    self.postMessage(error);
  }
};

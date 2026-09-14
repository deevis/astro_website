import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
const output = join(process.cwd(), 'scripts', 'retirement-planner-tests-' + process.pid + '.mjs');
try {
  const result = await build({ entryPoints: ['src/components/retirement-planner/lib/planner.test.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
  writeFileSync(output, result.outputFiles[0].text);
  process.exitCode = spawnSync(process.execPath, ['--test', '--test-reporter=spec', output], { stdio: 'inherit' }).status ?? 1;
} finally { try { unlinkSync(output); } catch {} }


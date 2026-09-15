// Two captains meet on the Open Sea, against the local Firebase emulator: node tests/sea.mjs
import { spawn } from 'node:child_process';

await fetch('http://127.0.0.1:9000/.json?ns=demo-hearthborn-default-rtdb', { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: 'null' });

const run = role => new Promise(resolve => {
  const p = spawn(process.execPath, ['tests/sea-player.mjs', role], { stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', d => process.stdout.write(d));
  p.stderr.on('data', d => { const t = String(d); if (!/DeprecationWarning|ExperimentalWarning|trace-deprecation/.test(t)) process.stderr.write(`${role}! ${t}`); });
  p.on('exit', code => resolve(code));
});

const [a, b] = await Promise.all([run('A'), run('B')]);
console.log(a === 0 && b === 0 ? '\nSEA TEST PASSED' : `\nSEA TEST FAILED (A=${a}, B=${b})`);
process.exit(a || b ? 1 : 0);

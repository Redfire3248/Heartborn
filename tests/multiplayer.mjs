// Two-player multiplayer test against the local Firebase emulator.
// 1) npx firebase-tools emulators:start --only auth,firestore,database --project demo-hearthborn
// 2) node tests/multiplayer.mjs
import { spawn } from 'node:child_process';

// start from an empty emulator so leftovers from earlier runs (shields, old attacks) can't interfere
await fetch('http://127.0.0.1:9000/.json?ns=demo-hearthborn-default-rtdb', { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: 'null' });
await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-hearthborn/databases/(default)/documents', { method: 'DELETE' });
await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-hearthborn/accounts', { method: 'DELETE' });

const run = role => new Promise(resolve => {
  const p = spawn(process.execPath, ['tests/mp-player.mjs', role], { stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', d => process.stdout.write(d));
  p.stderr.on('data', d => { const t = String(d); if (!/DeprecationWarning|ExperimentalWarning|trace-deprecation/.test(t)) process.stderr.write(`${role}! ${t}`); });
  p.on('exit', code => resolve(code));
});

const [a, b] = await Promise.all([run('A'), run('B')]);
console.log(a === 0 && b === 0 ? '\nMULTIPLAYER TEST PASSED' : `\nMULTIPLAYER TEST FAILED (A=${a}, B=${b})`);
process.exit(a || b ? 1 : 0);

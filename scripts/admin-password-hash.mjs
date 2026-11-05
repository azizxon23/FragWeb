// Accept a password via hidden stdin; never pass passwords as command arguments.
import { randomBytes, pbkdf2Sync } from 'node:crypto';
let value = '';
const terminal = process.stdin.isTTY;
if (terminal) { process.stdin.setRawMode(true); process.stderr.write('Password (hidden): '); }
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (chunk.includes('\u0003')) { if (terminal) process.stdin.setRawMode(false); process.exit(130); }
  value += chunk;
  if (!value.includes('\n') && !value.includes('\r')) return;
  const password = value.split(/[\r\n]/)[0];
  if (terminal) { process.stdin.setRawMode(false); process.stderr.write('\n'); }
  if (password.length < 12 || password.length > 128) { process.stderr.write('Use 12–128 characters.\n'); process.exit(1); }
  const salt = randomBytes(16).toString('hex');
  process.stdout.write('pbkdf2$' + salt + '$' + pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex') + '\n');
  process.exit(0);
});

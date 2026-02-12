import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local manually
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [k, ...rest] = trimmed.split('=');
    const v = rest.join('=').trim();
    if (k) process.env[k.trim()] = v;
  });
}

console.log('GITHUB_PERSONAL_ACCESS_TOKEN:', process.env.GITHUB_PERSONAL_ACCESS_TOKEN);
console.log('Length:', process.env.GITHUB_PERSONAL_ACCESS_TOKEN ? process.env.GITHUB_PERSONAL_ACCESS_TOKEN.length : 'undefined');
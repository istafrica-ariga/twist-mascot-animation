import { buildMascot } from './mascot';
import fs from 'node:fs';
const r = buildMascot();
fs.writeFileSync(process.argv[2], JSON.stringify(r));

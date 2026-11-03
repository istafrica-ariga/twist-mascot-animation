import { buildMascot3 } from './mascot3';
import fs from 'node:fs';
fs.writeFileSync(process.argv[2], JSON.stringify(buildMascot3()));

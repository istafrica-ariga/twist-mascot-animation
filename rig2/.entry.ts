import { buildMascot2 } from './mascot2';
import fs from 'node:fs';
fs.writeFileSync(process.argv[2], JSON.stringify(buildMascot2()));

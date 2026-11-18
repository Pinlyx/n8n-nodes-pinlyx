// tsc yalnizca .ts derler; node ikonu dist icinde .node.js dosyasinin yaninda durmali.
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/nodes/CrmSolid', { recursive: true });
for (const icon of ['crmsolid.svg', 'crmsolid.dark.svg']) {
	await cp(`nodes/CrmSolid/${icon}`, `dist/nodes/CrmSolid/${icon}`);
}
console.log('icon copied');

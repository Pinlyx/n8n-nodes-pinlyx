// tsc yalnizca .ts derler; node ikonu dist icinde .node.js dosyasinin yaninda durmali.
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/nodes/CrmSolid', { recursive: true });
await cp('nodes/CrmSolid/crmsolid.svg', 'dist/nodes/CrmSolid/crmsolid.svg');
console.log('icon copied');

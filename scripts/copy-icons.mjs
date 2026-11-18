// tsc yalnizca .ts derler; node ikonu dist icinde .node.js dosyasinin yaninda durmali.
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/nodes/Pinlyx', { recursive: true });
for (const icon of ['pinlyx.svg', 'pinlyx.dark.svg']) {
	await cp(`nodes/Pinlyx/${icon}`, `dist/nodes/Pinlyx/${icon}`);
}
console.log('icon copied');

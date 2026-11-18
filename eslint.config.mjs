import tseslint from 'typescript-eslint';
import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';

export default [
	{ ignores: ['dist/**', 'node_modules/**', 'scripts/**'] },
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: { project: './tsconfig.json', sourceType: 'module' },
		},
	},
	n8nCommunityNodesPlugin.configs.recommended,
];

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['**/*.test.ts'],
        exclude: ['node_modules'],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        alias: [
            // Redirect .js imports to .ts files
            { find: /^(.*)\.js$/, replacement: '$1.ts' },
        ],
    },
});

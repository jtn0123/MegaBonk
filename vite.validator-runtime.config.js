import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
    define: {
        __VALIDATOR_RUNTIME_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
        lib: {
            entry: 'src/modules/cv/validator-runtime.ts',
            name: 'MegaBonkValidatorRuntime',
            fileName: () => 'validator-runtime.js',
            formats: ['es'],
        },
        outDir: 'dist/validator-runtime',
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        rollupOptions: {
            output: {
                entryFileNames: 'validator-runtime.js',
            },
        },
    },
    resolve: {
        alias: {
            '@': '/src',
            '@modules': '/src/modules',
        },
    },
});

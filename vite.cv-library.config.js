import { defineConfig } from 'vite';

// Vite config for building the CV library as a standalone ES module
// This allows the CV Validator to import detection functions directly
export default defineConfig({
    build: {
        lib: {
            entry: 'src/modules/cv/cv-library.ts',
            name: 'MegaBonkCV',
            // Use function to control file extension
            fileName: () => 'cv-library.js',
            formats: ['es'],
        },
        outDir: 'dist/cv-library',
        emptyOutDir: true,
        sourcemap: true,
        // Don't minify for easier debugging in CV Validator
        minify: false,
        rollupOptions: {
            // Externalize dependencies that shouldn't be bundled
            external: [],
            output: {
                // Preserve module structure for better debugging
                preserveModules: false,
                // Ensure .js extension for browser compatibility
                entryFileNames: 'cv-library.js',
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

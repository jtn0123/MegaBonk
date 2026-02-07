const js = require('@eslint/js');
const prettier = require('eslint-plugin-prettier/recommended');

module.exports = [
    js.configs.recommended,
    prettier,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                // Node.js globals for config files
                module: 'readonly',
                require: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                Buffer: 'readonly',

                // Browser globals
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                URL: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            'no-console': 'off',
            'prettier/prettier': [
                'warn',
                {
                    singleQuote: true,
                    tabWidth: 4,
                    printWidth: 120,
                    trailingComma: 'es5',
                    arrowParens: 'avoid',
                },
            ],
        },
    },
    {
        // Service Worker specific config
        files: ['sw.js'],
        languageOptions: {
            globals: {
                // Service Worker globals
                self: 'readonly',
                caches: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
                location: 'readonly',
                fetch: 'readonly',
                URL: 'readonly',
                console: 'readonly',
                importScripts: 'readonly',
                define: 'readonly',
            },
        },
    },
    {
        // Ignore patterns - skip TypeScript files (use tsc for type checking)
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'assets/**',
            'ci-artifacts/**',
            'ci-artifacts-*/**',
            'coverage/**',
            'src/libs/**',
            '.capacitor/**',
            'android/**',
            'ios/**',
            'src/**/*.ts', // TypeScript files handled by tsc
            'workbox-*.js', // Workbox generated files
        ],
    },
];

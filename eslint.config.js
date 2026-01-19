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
        // Ignore patterns - skip TypeScript files (use tsc for type checking)
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'coverage/**',
            'src/libs/**',
            '.capacitor/**',
            'android/**',
            'ios/**',
            'src/**/*.ts', // TypeScript files handled by tsc
        ],
    },
];

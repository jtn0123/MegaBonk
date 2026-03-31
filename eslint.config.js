const js = require('@eslint/js');
const prettier = require('eslint-plugin-prettier/recommended');
const tseslint = require('typescript-eslint');
const playwright = require('eslint-plugin-playwright');

module.exports = [
    // Global ignores
    {
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
            'workbox-*.js',
        ],
    },

    // Base configs
    js.configs.recommended,
    prettier,

    // JavaScript files (root + scripts)
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

    // Service Worker specific config
    {
        files: ['sw.js'],
        languageOptions: {
            globals: {
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

    // TypeScript source files
    ...tseslint.configs.recommended.map(config => ({
        ...config,
        files: ['src/**/*.ts'],
    })),
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: __dirname,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            // Catch console.* that should use logger
            'no-console': 'warn',

            // Enforce strict equality (allow == null for null/undefined check)
            eqeqeq: ['warn', 'always', { null: 'ignore' }],

            // TypeScript-specific rules
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/consistent-type-imports': ['warn', { disallowTypeAnnotations: false }],
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],

            // Prettier integration
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

    // TypeScript test files (unit + integration)
    ...tseslint.configs.recommended.map(config => ({
        ...config,
        files: ['tests/**/*.{ts,js,mjs}'],
    })),
    {
        files: ['tests/**/*.{ts,js,mjs}'],
        languageOptions: {
            parser: tseslint.parser,
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            // Console is expected in tests
            'no-console': 'off',

            // Relaxed for test mocking patterns
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'warn',
            '@typescript-eslint/no-unused-expressions': 'warn',
            'no-empty': 'warn',
            'no-case-declarations': 'warn',
            'no-useless-escape': 'warn',
            'no-useless-assignment': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],

            // Prettier integration
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

    // Playwright E2E test files
    {
        files: ['tests/e2e/**/*.spec.{ts,mjs}'],
        ...playwright.configs['flat/recommended'],
        rules: {
            ...playwright.configs['flat/recommended'].rules,
            // Flag waitForTimeout anti-pattern
            'playwright/no-wait-for-timeout': 'warn',
            // Flag skipped tests
            'playwright/no-skipped-test': 'warn',
            // We use conditional skips and expects intentionally
            'playwright/no-conditional-in-test': 'off',
            'playwright/no-conditional-expect': 'off',
            // Style preferences — warn for incremental improvement
            'playwright/no-wait-for-selector': 'off',
            'playwright/prefer-locator': 'off',
            // Disabled: auto-fix incorrectly converts textContent()/getAttribute()/count()
            // to Locators when results are used as primitives in subsequent code
            'playwright/prefer-web-first-assertions': 'off',
            'playwright/no-networkidle': 'warn',
        },
    },
];

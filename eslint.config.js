const js = require('@eslint/js');
const prettier = require('eslint-plugin-prettier/recommended');

module.exports = [
    js.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                localStorage: 'readonly',
                console: 'readonly',
                alert: 'readonly',
                fetch: 'readonly',
                requestAnimationFrame: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                btoa: 'readonly',
                atob: 'readonly',

                // Service Worker
                self: 'readonly',
                caches: 'readonly',

                // Chart.js (external library)
                Chart: 'readonly',

                // App globals (intentionally exposed)
                ToastManager: 'writable',
                safeGetElementById: 'writable',
                currentTab: 'writable',
                allData: 'writable',
                filteredData: 'writable',
                compareItems: 'writable',

                // Function globals (from other modules)
                AbortController: 'readonly',
                showLoading: 'readonly',
                hideLoading: 'readonly',
                switchTab: 'readonly',
                loadBuildFromURL: 'readonly',
                showErrorMessage: 'readonly',
                generateModalImage: 'readonly',
                getEffectiveStackCap: 'readonly',
                createScalingChart: 'readonly',
                calculateTomeProgression: 'readonly',
            }
        },
        rules: {
            // Disable some rules for vanilla JS project
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            'no-console': 'off', // We use console for logging
            'no-undef': 'error',
            'prettier/prettier': ['warn', {
                singleQuote: true,
                tabWidth: 4,
                printWidth: 120,
                trailingComma: 'es5',
                arrowParens: 'avoid'
            }]
        }
    },
    {
        // Ignore patterns
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'coverage/**',
            'src/libs/**', // External libraries like Chart.js
            '.capacitor/**',
            'android/**',
            'ios/**'
        ]
    }
];

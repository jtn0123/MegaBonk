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
                history: 'readonly',
                URL: 'readonly',

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
                getSearchHistory: 'readonly',
                addToSearchHistory: 'readonly',
                clearSearchHistory: 'readonly',
                showSearchHistoryDropdown: 'readonly',
                fuzzyMatchScore: 'readonly',
                parseAdvancedSearch: 'readonly',
                safeQuerySelectorAll: 'readonly',
                safeQuerySelector: 'readonly',
                safeSetValue: 'readonly',
                escapeHtml: 'readonly',
                isValidExternalUrl: 'readonly',
                generateEmptyState: 'readonly',
                createCompareChart: 'readonly',
                closeModal: 'readonly',
                closeCompareModal: 'readonly',
                quickCalc: 'readonly',
                openDetailModal: 'readonly',
                toggleCompareItem: 'readonly',
                updateCompareDisplay: 'readonly',
                clearFilters: 'readonly',
                toggleChangelogExpand: 'readonly',
                toggleFavorite: 'readonly',
                updateBuildAnalysis: 'readonly',
                renderTabContent: 'readonly',
                debounce: 'readonly',
                handleSearch: 'readonly',
                openCompareModal: 'readonly',
                setupBuildPlannerEvents: 'readonly',
                loadAllData: 'readonly',
                destroyAllCharts: 'readonly',
                updateFilters: 'readonly',
                filterData: 'readonly',
                isFavorite: 'readonly',
                sortData: 'readonly',
                renderBuildPlanner: 'readonly',
                populateCalculatorItems: 'readonly',
                calculateBreakpoint: 'readonly',
                getDataForTab: 'readonly',
                updateChangelogStats: 'readonly',
                renderChangelog: 'readonly',
                truncateText: 'readonly',
                generateTierLabel: 'readonly',
                generateEntityImage: 'readonly',
                initializeItemCharts: 'readonly',
                generateMetaTags: 'readonly',
                initializeTomeCharts: 'readonly',
                chartInstances: 'writable',
                TIER_ORDER: 'readonly',
                RARITY_ORDER: 'readonly',
                BUILD_ITEMS_LIMIT: 'readonly',
                DEFAULT_BUILD_STATS: 'readonly',
                ITEM_EFFECTS: 'readonly',
                MAX_COMPARE_ITEMS: 'readonly',
                BUILD_TEMPLATES: 'readonly',
                getBuildHistory: 'readonly',
                saveBuildToHistory: 'readonly',
                loadBuildFromHistory: 'readonly',
                deleteBuildFromHistory: 'readonly',
                clearBuildHistory: 'readonly',
                loadBuildTemplate: 'readonly',
                loadBuildFromData: 'readonly',
                importBuild: 'readonly',
                showBuildHistoryModal: 'readonly',
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

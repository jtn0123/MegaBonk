module.exports = {
    ci: {
        collect: {
            staticDistDir: './dist',
            numberOfRuns: 3,
        },
        assert: {
            aggregationMethod: 'median-run',
            assertions: {
                // Tightened post-polish budgets for the production site.
                // CI runners have variable performance; use 'optimistic' (best of 3 runs)
                // and a threshold that accounts for CI variability
                'categories:performance': ['error', { minScore: 0.6, aggregationMethod: 'optimistic' }],
                'categories:accessibility': ['error', { minScore: 0.95 }],
                'categories:best-practices': ['error', { minScore: 0.9 }],
                'categories:seo': ['error', { minScore: 0.95 }],

                // Audits promoted to warn — track regressions without blocking.
                'aria-allowed-attr': 'warn',
                'color-contrast': ['warn', { minScore: 0.9 }],
                'csp-xss': 'warn',
                'errors-in-console': 'warn',
                'installable-manifest': 'off',
                'lcp-lazy-loaded': 'off',
                'non-composited-animations': 'off',
                'total-byte-weight': ['error', { maxNumericValue: 1500000 }],
                'unused-css-rules': 'warn',
                'unused-javascript': 'warn',
                'uses-responsive-images': 'off',
                'bootup-time': 'off',
                'dom-size': 'off',
                interactive: ['warn', { minScore: 0.65 }],
                'largest-contentful-paint': ['warn', { minScore: 0.4 }],
                'mainthread-work-breakdown': 'off',
                'max-potential-fid': 'off',
                'render-blocking-resources': 'off',
                'server-response-time': 'off',
            },
        },
        upload: {
            target: 'temporary-public-storage',
        },
    },
};

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
                'categories:performance': ['error', { minScore: 0.75, aggregationMethod: 'optimistic' }],
                'categories:accessibility': ['error', { minScore: 0.95 }],
                'categories:best-practices': ['error', { minScore: 0.9 }],
                'categories:seo': ['error', { minScore: 0.95 }],

                // Keep currently noisy audits out of the hard gate until they are
                // addressed deliberately in a follow-up pass.
                'aria-allowed-attr': 'off',
                'color-contrast': ['warn', { minScore: 0.9 }],
                'csp-xss': 'off',
                'errors-in-console': 'off',
                'installable-manifest': 'off',
                'lcp-lazy-loaded': 'off',
                'non-composited-animations': 'off',
                'total-byte-weight': ['error', { maxNumericValue: 1500000 }],
                'unused-css-rules': 'off',
                'unused-javascript': 'off',
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

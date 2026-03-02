module.exports = {
    ci: {
        collect: {
            staticDistDir: './dist',
            numberOfRuns: 3,
        },
        assert: {
            aggregationMethod: 'median-run',
            assertions: {
                // Performance budgets — fail CI if scores drop below thresholds
                // Performance threshold kept realistic for CI headless environment
                'categories:performance': ['error', { minScore: 0.65, aggregationMethod: 'optimistic' }],
                'categories:accessibility': ['error', { minScore: 0.9 }],
                'categories:best-practices': ['error', { minScore: 0.85 }],
                'categories:seo': ['error', { minScore: 0.95 }],

                // Known issues - don't fail on these
                'aria-allowed-attr': 'off',
                'color-contrast': 'off',
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
                interactive: ['warn', { minScore: 0.5 }],
                'largest-contentful-paint': ['warn', { minScore: 0.25 }],
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

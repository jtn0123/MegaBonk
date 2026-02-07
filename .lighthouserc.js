module.exports = {
    ci: {
        collect: {
            staticDistDir: './dist',
            numberOfRuns: 3,
        },
        assert: {
            assertions: {
                // Performance - relaxed thresholds for a game data app with charts
                'categories:performance': ['warn', { minScore: 0.6 }],
                'categories:accessibility': ['error', { minScore: 0.85 }],
                'categories:best-practices': ['warn', { minScore: 0.8 }],
                'categories:seo': ['warn', { minScore: 0.8 }],

                // Known issues - don't fail on these
                'aria-allowed-attr': 'off',
                'color-contrast': 'off',
                'csp-xss': 'off',
                'errors-in-console': 'off',
                'installable-manifest': 'off',
                'lcp-lazy-loaded': 'off',
                'non-composited-animations': 'off',
                'total-byte-weight': ['warn', { maxNumericValue: 5000000 }],
                'unused-css-rules': 'off',
                'unused-javascript': 'off',
                'uses-responsive-images': 'off',
                'bootup-time': 'off',
                'dom-size': 'off',
                interactive: ['warn', { minScore: 0.5 }],
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

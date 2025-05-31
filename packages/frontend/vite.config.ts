import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react({
        // Modern React optimizations without external babel dependencies
        babel: {
          plugins: [
            // No external babel plugins needed - Vite handles optimizations natively
          ]
        }
      })
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // Development server configuration
    server: {
      port: 3000,
      host: true, // Allow access from network
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Build optimizations
    build: {
      // Output directory
      outDir: 'dist',
      assetsDir: 'assets',

      // Enable source maps for production debugging
      sourcemap: mode === 'production' ? 'hidden' : true,

      // Bundle size optimizations
      target: ['es2020', 'chrome80', 'firefox78', 'safari14'],

      // Minification options with advanced optimizations
      minify: 'esbuild',

      // Elite esbuild optimizations
      esbuild: {
        // Remove console.log and debugger in production
        drop: mode === 'production' ? ['console', 'debugger'] : [],
        // Remove PropTypes in production (replaces babel plugin)
        pure: mode === 'production' ? ['console.log', 'console.warn'] : [],
        // Tree shaking optimizations
        treeShaking: true,
      },

      // Bundle splitting strategy
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // React ecosystem
            'react-vendor': ['react', 'react-dom'],

            // Router
            'router': ['react-router-dom'],

            // State management
            'redux': ['@reduxjs/toolkit', 'react-redux'],

            // UI components (if they get large)
            'ui-components': [
              // Add component library imports here when added
            ],

            // Utilities
            'utils': ['tailwind-merge'],
          },

          // Optimize chunk file names for caching
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ?
              chunkInfo.facadeModuleId.split('/').pop().replace('.tsx', '').replace('.ts', '') :
              'chunk';
            return `assets/js/[name]-[hash].js`;
          },
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/css/i.test(ext)) {
              return `assets/css/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          entryFileNames: `assets/js/[name]-[hash].js`,
        },

        // External dependencies (for CDN if needed)
        external: [
          // Add externals here if using CDN
        ],
      },

      // Chunk size warning limit
      chunkSizeWarningLimit: 1000,

      // Enable CSS code splitting
      cssCodeSplit: true,

      // Optimize CSS
      cssMinify: true,
    },

    // Dependency optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@reduxjs/toolkit',
        'react-redux'
      ],
      exclude: [
        // Exclude dependencies that should not be pre-bundled
      ],
    },

    // Preview server configuration
    preview: {
      port: 4173,
      host: true,
    },

    // Environment variables
    envPrefix: 'VITE_',

    // Define global constants
    define: {
      __DEV__: mode !== 'production',
      __PROD__: mode === 'production',
      __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      // Remove PropTypes in production builds
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  };
});

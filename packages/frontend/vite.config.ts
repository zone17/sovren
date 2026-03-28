import react from '@vitejs/plugin-react';
import { createHash } from 'crypto';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';
import { constants } from 'zlib';

// Elite Build Performance Monitoring
const buildStartTime = Date.now();
const buildMetrics = {
  startTime: buildStartTime,
  endTime: 0,
  duration: 0,
  chunkCount: 0,
  totalSize: 0,
  gzipSize: 0,
  cacheHitRate: 0,
  warnings: [],
};

// https://vitejs.dev/config/
export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = command === 'serve';
  const isProd = mode === 'production';
  const isAnalyze = process.env.ANALYZE === 'true';

  // Dynamic import — only loads (and its transitive dep `open`) when analyzing
  const analyzePlugins = isAnalyze
    ? [
        (await import('rollup-plugin-visualizer')).visualizer({
          filename: 'bundle-analysis.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
          template: 'treemap',
        }),
      ]
    : [];

  console.log(`🚀 Elite Build System Starting - Mode: ${mode}`);

  return {
    plugins: [
      react({
        // Modern React optimizations without external babel dependencies
        babel: {
          plugins: [
            // No external babel plugins needed - Vite handles optimizations natively
          ],
        },
      }),

      // Advanced Asset Compression
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 1024,
        compressionOptions: {
          level: 9,
        },
      }),

      // Brotli compression for modern browsers
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 1024,
        compressionOptions: {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: 11,
          },
        },
      }),

      // Progressive Web App Support
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.sovren\.dev\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
              },
            },
          ],
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Sovren Creator Platform',
          short_name: 'Sovren',
          description: 'Elite Creator Monetization Platform',
          theme_color: '#f97316',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),

      // Bundle Analysis Plugin (dynamically imported above)
      ...analyzePlugins,
    ],

    // Enhanced Path Resolution
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@services': path.resolve(__dirname, './src/services'),
        '@types': path.resolve(__dirname, './src/types'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@assets': path.resolve(__dirname, './src/assets'),
        '@store': path.resolve(__dirname, './src/store'),
        '@contexts': path.resolve(__dirname, './src/contexts'),
        '@lib': path.resolve(__dirname, './lib'),
        '@shared': path.resolve(__dirname, '../shared/src'),
        '@sovren/shared': path.resolve(__dirname, '../shared/src'),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },

    // Development server configuration
    server: {
      port: 3000,
      host: true, // Allow access from network
      hmr: {
        overlay: false, // Disable overlay for better UX
      },
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Elite Build Optimizations
    build: {
      // Output directory
      outDir: 'dist',
      assetsDir: 'assets',

      // Source maps for debugging
      sourcemap: isProd ? false : true,

      // Bundle size optimizations
      target: ['es2020', 'chrome80', 'firefox78', 'safari14', 'edge88'],

      // Minification with esbuild
      minify: isProd ? 'esbuild' : false,

      // Elite esbuild optimizations
      esbuildOptions: {
        // Remove console.log and debugger in production
        drop: isProd ? ['console', 'debugger'] : [],
        // Remove PropTypes in production
        pure: isProd ? ['console.log', 'console.warn', 'console.info'] : [],
        // Tree shaking optimizations
        treeShaking: true,
        // Legal comments handling
        legalComments: 'none',
        // Minify identifiers
        minifyIdentifiers: isProd,
        // Minify syntax
        minifySyntax: isProd,
        // Minify whitespace
        minifyWhitespace: isProd,
      },

      // Bundle splitting strategy
      rollupOptions: {
        output: {
          // Function-based manual chunk splitting for correct React isolation
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/react-router')) {
              return 'router';
            }
            if (id.includes('node_modules/@reduxjs/toolkit') || id.includes('node_modules/react-redux')) {
              return 'redux';
            }
            if (id.includes('node_modules/@radix-ui/')) {
              return 'ui-components';
            }
            if (id.includes('node_modules/tailwind-merge') || id.includes('node_modules/clsx') || id.includes('node_modules/class-variance-authority')) {
              return 'utils';
            }
            if (id.includes('node_modules/@noble/secp256k1') || id.includes('node_modules/@scure/bip32') || id.includes('node_modules/@scure/bip39') || id.includes('node_modules/nostr-tools')) {
              return 'crypto';
            }
            if (id.includes('node_modules/recharts')) {
              return 'charts';
            }
            if (id.includes('node_modules/@tanstack/react-query') || id.includes('node_modules/@supabase/supabase-js')) {
              return 'api';
            }
            if (id.includes('node_modules/stripe')) {
              return 'payments';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'icons';
            }
            if (id.includes('node_modules/web-vitals')) {
              return 'monitoring';
            }
          },

          // Optimized chunk file naming for caching
          chunkFileNames: (chunkInfo) => {
            const hash = createHash('md5').update(chunkInfo.name).digest('hex').slice(0, 8);
            return `assets/js/[name]-${hash}.js`;
          },

          // Asset file naming with optimization
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            const hash = createHash('md5').update(assetInfo.name).digest('hex').slice(0, 8);

            if (/png|jpe?g|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-${hash}[extname]`;
            }
            if (/svg/i.test(ext)) {
              return `assets/icons/[name]-${hash}[extname]`;
            }
            if (/css/i.test(ext)) {
              return `assets/css/[name]-${hash}[extname]`;
            }
            if (/woff2?|ttf|eot/i.test(ext)) {
              return `assets/fonts/[name]-${hash}[extname]`;
            }
            return `assets/[name]-${hash}[extname]`;
          },

          entryFileNames: `assets/js/[name]-[hash].js`,
        },

        // External dependencies optimization
        external: [
          // Add externals here for CDN optimization if needed
        ],

        // Tree shaking (use Rollup defaults — moduleSideEffects:false strips the entire app)
        treeshake: true,
      },

      // Elite chunk size management
      chunkSizeWarningLimit: 400,

      // CSS optimization
      cssCodeSplit: true,
      cssMinify: isProd,

      // Assets optimization
      assetsInlineLimit: 4096, // Inline assets smaller than 4KB

      // Build performance optimization
      reportCompressedSize: false, // Disable for faster builds

      // Output options
      emptyOutDir: true,
    },

    // Dependency pre-bundling optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@reduxjs/toolkit',
        'react-redux',
        'tailwind-merge',
        'clsx',
        'framer-motion',
        'lucide-react',
        '@tanstack/react-query',
        '@supabase/supabase-js',
        'recharts',
        'web-vitals',
      ],
      exclude: [
        // Exclude dependencies that should not be pre-bundled
        '@noble/secp256k1',
        'nostr-tools',
        'arweave',
        'helia',
        '@helia/http',
        '@helia/unixfs',
      ],
      esbuildOptions: {
        target: 'es2020',
      },
    },

    // Preview server configuration
    preview: {
      port: 4173,
      host: true,
    },

    // Environment variables
    envPrefix: 'VITE_',

    // Global constants
    define: {
      __DEV__: isDev,
      __PROD__: isProd,
      __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },

    // CSS processing
    css: {
      devSourcemap: isDev,
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`,
        },
      },
    },

    // Worker configuration
    worker: {
      format: 'es',
      plugins: () => [react()],
    },

    // Test configuration (Vitest)
    test: {
      globals: true,
      environment: 'node',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'src/setupTests.ts'],
      },
    },
  };
});

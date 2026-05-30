/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite plugin: redirect MediaPipe face_mesh asset requests to /mediapipe/face_mesh/
// This is needed because MediaPipe resolves paths relative to the current page URL,
// which breaks in SPA routing (e.g. /vocabulary/flashcard/mediapipe/face_mesh/...)
function mediapipeRedirectPlugin() {
  const FACE_MESH_FILES = [
    'face_mesh_solution_packed_assets_loader.js',
    'face_mesh_solution_packed_assets.data',
    'face_mesh_solution_simd_wasm_bin.js',
    'face_mesh_solution_simd_wasm_bin.wasm',
    'face_mesh.binarypb',
  ];
  return {
    name: 'mediapipe-face-mesh-redirect',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url && !req.url.startsWith('/mediapipe/face_mesh/')) {
          const filename = req.url.split('/').pop()?.split('?')[0];
          if (filename && FACE_MESH_FILES.includes(filename)) {
            res.writeHead(302, { Location: `/mediapipe/face_mesh/${filename}` });
            res.end();
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    mediapipeRedirectPlugin(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['webgazer', '@tensorflow/tfjs', '@tensorflow/tfjs-core', '@tensorflow/tfjs-layers', '@tensorflow/tfjs-data', '@tensorflow/tfjs-backend-webgl'],
  },
  server: {
    // Disable host check to allow dynamic ngrok domains
    // This prioritizes readability and ease of development
    allowedHosts: true,

    // Optional: Make sure the server listens on all network interfaces
    host: '0.0.0.0'
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})


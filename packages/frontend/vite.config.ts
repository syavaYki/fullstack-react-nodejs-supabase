import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    port: 3000,
  },
  resolve: {
    dedupe: ['react', 'react-dom', '@emotion/react'],
  },
  ssr: {
    noExternal: [
      '@mui/material',
      '@mui/icons-material',
      '@mui/system',
      '@mui/utils',
      '@mui/styled-engine',
      '@mui/private-theming',
      '@emotion/react',
      '@emotion/styled',
    ],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
    ],
  },
});

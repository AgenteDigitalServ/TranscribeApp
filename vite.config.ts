import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  // Mescla variáveis do arquivo .env com variáveis do sistema (Vercel)
  const GEMINI_KEY = env.GEMINI_API_KEY || (process as any).env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || "";
  const GENERIC_KEY = env.API_KEY || (process as any).env.API_KEY || env.VITE_API_KEY || "";

  return {
    plugins: [
      react(),
      tailwindcss()
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(GENERIC_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(GEMINI_KEY)
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx']
    },
    build: {
      outDir: 'dist',
    }
  };
});
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // El bundle principal ya superó el límite por default de precacheo
      // (2 MiB) — el proyecto todavía no está dividido en chunks (ver el
      // warning de Rollup en cada build), así que subimos el techo en vez
      // de que `npm run build` falle. Si esto sigue creciendo, lo que
      // corresponde es code-splitting (dynamic import por sección/rol), no
      // seguir subiendo este número.
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Gestión Interna DDNA',
        short_name: 'DDNA',
        description: 'Sistema de gestión interna - Defensoría de Niños, Niñas y Adolescentes',
        theme_color: '#1e3a8a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
    }),
  ],
})

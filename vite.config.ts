import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `--mode single` inlines every asset into one dist/index.html. That build is what
// gets published for instant phone testing; the default build is the normal
// multi-asset bundle that Capacitor wraps for the App Store.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    target: 'es2020',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
}))

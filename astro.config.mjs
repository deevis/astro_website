import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

import svelte from '@astrojs/svelte';

export default defineConfig({
  integrations: [tailwind(), mdx(), svelte()],
  redirects: {
    '/showcase': '/playground'
  },
  server: {
    host: '0.0.0.0',
    port: 4321,
  },
  vite: {
    resolve: {
      dedupe: ['svelte', 'svelte/store'],
    },
    preview: {
      allowedHosts: ["darrenhicks.dev", "www.darrenhicks.dev", "localhost", "0.0.0.0"], 
    },
    ssr: {
      noExternal: ['swiper']
    },
    optimizeDeps: {
      include: ['swiper/modules', 'svelte', 'svelte/store'],
    },
  }
});
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

import svelte from '@astrojs/svelte';

export default defineConfig({
  integrations: [tailwind(), mdx(), svelte()],
  server: {
    host: '0.0.0.0',
    port: 4321,
  },
  vite: {
    preview: {
      allowedHosts: ["darrenhicks.dev", "www.darrenhicks.dev", "localhost", "0.0.0.0"], 
    },
    ssr: {
      noExternal: ['swiper']
    },
    optimizeDeps: {
      include: ['swiper/modules']
    }
  }
});
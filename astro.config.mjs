import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

export default defineConfig({
  integrations: [tailwind(), mdx()],
  vite: {
    ssr: {
      noExternal: ['swiper']
    },
    optimizeDeps: {
      include: ['swiper/modules']
    }
  }
});
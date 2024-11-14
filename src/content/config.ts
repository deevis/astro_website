import { defineCollection, z } from 'astro:content';

const articles = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    publishDate: z.string(),
    author: z.string(),
    image: z.object({
      src: z.string(),
      alt: z.string()
    }),
    description: z.string(),
    tags: z.array(z.string())
  })
});

export const collections = {
  articles
}; 
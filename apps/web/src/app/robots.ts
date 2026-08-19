import type { MetadataRoute } from 'next';

/** Closed Beta: do not index. Sitemap is withheld until public GA. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}

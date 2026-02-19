import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://wishlist.nuvio.cloud'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/settings/', '/account/', '/save/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

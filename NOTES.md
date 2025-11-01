# Important Notes

## Playwright Stealth Plugin

The `playwright-extra-plugin-stealth` package is currently a placeholder in npm and doesn't provide actual stealth functionality. However, the implementation already includes effective anti-detection techniques:

- Realistic user agent strings
- Proper HTTP headers (Accept-Language, etc.)
- Human-like delays (700-1500ms randomized)
- Mouse movements and scroll interactions
- Network idle waiting

These techniques are sufficient for most use cases. If you need additional stealth capabilities, consider:

1. **Puppeteer Alternative**: Use `puppeteer-extra` with `puppeteer-extra-plugin-stealth` (which is fully functional)
2. **Manual Implementation**: Add more techniques like:
   - Viewport randomization
   - Timezone randomization
   - WebGL fingerprint masking
   - Canvas fingerprint masking

## Metascraper Price

The `metascraper-price` package doesn't exist in npm. The implementation extracts prices from JSON-LD structured data instead, which is actually more reliable for product pages that include structured data.

## Testing

To test the API:

```bash
# Start dev server
npm run dev

# Test with curl
curl -X POST http://localhost:3000/api/fetch-product \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.amazon.com/dp/B0CL7LVV1G"}'
```

## Deployment

Remember:
- Do NOT run Playwright on Vercel serverless functions
- Deploy scraper service separately (Render/Fly.io/Railway)
- Use Dockerfile provided for container deployment

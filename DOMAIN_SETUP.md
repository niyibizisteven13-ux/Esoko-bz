# Bwenge domain setup

The application uses `https://bwenge.space` as its canonical public URL, with the Render URL available as a fallback.

## Render

1. Deploy the repository to Render using `render.yaml`.
2. In the Render service named `bwenge`, add both `bwenge.space` and `www.bwenge.space` as custom domains.
3. Copy the exact DNS records Render displays for the domain. Apex records can vary, so use Render's current values.
4. At the domain registrar, remove conflicting parking or redirect records and add Render's records.
5. In Cloudflare, set the Render-provided DNS records to **DNS only** (gray cloud) while verifying the domain. Do not proxy the Render custom domain until the site is confirmed working.
6. Wait for DNS and TLS verification, then confirm `APP_URL` and `FRONTEND_URLS` use the final HTTPS URL.

## Important

GitHub is the source-code host, not the backend host for this Express application. Connect GitHub to Render for automatic deployment, and point the domain DNS to Render. GitHub Pages alone cannot run the API, database, authentication, uploads, or Socket.IO server.

The canonical logo is `public/bwenge-logo.svg`, using the existing navy-and-gold logo artwork throughout the app.

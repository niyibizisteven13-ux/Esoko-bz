# Bwenge domain setup

The application uses the Render service URL `https://esoko-bz.onrender.com` as its canonical public URL.

## Render

1. Deploy the repository to Render using `render.yaml`.
2. The custom domain is optional. The service is available directly at `https://esoko-bz.onrender.com`.
3. Copy the exact DNS records Render displays for the domain. Apex records can vary, so use Render's current values.
4. At the domain registrar, remove conflicting parking or redirect records and add Render's records.
5. Add `www.bwenge.space` only if you later want a custom domain, then create the exact DNS record Render provides.
6. Wait for DNS and TLS verification, then confirm `APP_URL` and `FRONTEND_URLS` use the final HTTPS URL.

## Important

GitHub is the source-code host, not the backend host for this Express application. Connect GitHub to Render for automatic deployment, and point the domain DNS to Render. GitHub Pages alone cannot run the API, database, authentication, uploads, or Socket.IO server.

The canonical logo is `public/bwenge-logo.svg`, using the existing navy-and-gold logo artwork throughout the app.

# Bwenge domain setup

The application is configured to use `https://bwenge.space` as its canonical public URL.

## Render

1. Deploy the repository to Render using `render.yaml`.
2. In the Render service named `bwenge`, add the custom domain `bwenge.space`.
3. Copy the exact DNS records Render displays for the domain. Apex records can vary, so use Render's current values.
4. At the domain registrar, remove conflicting parking or redirect records and add Render's records.
5. Add `www.bwenge.space` as a second custom domain if you want the `www` address, then create the CNAME record Render provides.
6. Wait for DNS and TLS verification, then confirm `APP_URL` and `FRONTEND_URLS` use the final HTTPS URL.

## Important

GitHub is the source-code host, not the backend host for this Express application. Connect GitHub to Render for automatic deployment, and point the domain DNS to Render. GitHub Pages alone cannot run the API, database, authentication, uploads, or Socket.IO server.

The canonical logo is `public/bwenge-logo.svg`, using the existing navy-and-gold logo artwork throughout the app.

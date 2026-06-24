# TODO

## TikTok-style Customer Marketplace feed
- [x] Update `src/components/customer/Marketplace.tsx` to be visuals-only TikTok-style vertical feed cards (scrollable, snap-start).
- [ ] Add backend comments API using REST semantics: `GET/POST /api/products/:id/comments`, `PUT/DELETE /api/comments/:commentId`.
- [ ] Update `Marketplace.tsx` comment button to open a modal and call POST `/api/products/:id/comments`.
- [ ] Update `Marketplace.tsx` to fetch and display comment count / preview.

## Notes
- Backend/db currently does not include a `comments` table (per `db.ts`).
- `Marketplace.tsx` still uses placeholder sample products; should be wired to actual products API later.


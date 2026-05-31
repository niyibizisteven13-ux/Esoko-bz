# Esoko Nexus Local

A self-contained full-stack commerce and wallet app.

## Stack

- React frontend
- Express backend
- SQLite database in `data/esoko.db`
- JWT authentication
- No Firebase, Firestore, Google Cloud, Stripe, or external app backend

## Run

```bash
npm install
npm run seed
npm run dev
```

Open `http://localhost:5173`.

## Environment Variables

Copy `.env.example` to `.env` and set production values before deployment. At minimum, set:

- `JWT_SECRET` — strong random secret for signing JWTs
- `SSL_KEY_PATH` — path to your TLS private key file
- `SSL_CERT_PATH` — path to your TLS certificate file

When HTTPS is configured, the server will start with TLS support automatically.

## Deployment Notes

- Keep `.env` out of source control
- Use a local or cloud key store for production secrets
- Engage a Rwandan legal advisor to review Terms, Privacy, and Acceptable Use policies
- Perform professional security testing before going live

## Demo Accounts

- Admin: `admin@esoko.rw` / `admin123`
- Trader: `trader1@esoko.rw` / `trader123`
- Customer: `customer1@esoko.rw` / `customer123`
- Agent: `agent1@esoko.rw` / `agent123`

## Useful Commands

```bash
npm run lint
npm run build
npm run test:api
```

`npm run test:api` expects the dev server to be running and the database to be seeded.

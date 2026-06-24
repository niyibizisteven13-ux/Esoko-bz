k6 marketplace load test

Requirements
- Install k6: https://k6.io/docs/getting-started/installation/

Run

Basic (localhost):

```bash
k6 run scripts/k6/marketplace_test.js
```

Custom base URL, VUs and duration:

```bash
BASE_URL=http://localhost:3000 K6_VUS=100 K6_DURATION=2m k6 run scripts/k6/marketplace_test.js
```

If the API requires authentication, pass a bearer token:

```bash
BASE_URL=https://staging.example.com AUTH_TOKEN=eyJ... K6_VUS=50 K6_DURATION=1m k6 run scripts/k6/marketplace_test.js
```

Notes
- The script targets `/api/products?status=available&limit=100`. Adjust the path or query if your prod/staging API differs.
- Watch API and DB metrics (CPU, memory, DB connections, latency) while running tests.
- Start small (10-50 VUs) and ramp up progressively.

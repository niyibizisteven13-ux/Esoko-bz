import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export let options = {
  vus: __ENV.K6_VUS ? parseInt(__ENV.K6_VUS) : 50,
  duration: __ENV.K6_DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;

  // Hit the product listing endpoint (adjust query params as needed)
  const res = http.get(`${BASE_URL}/api/products?status=available&limit=100`, { headers });

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  // Random short sleep to simulate real users
  sleep(Math.random() * 2 + 0.5);
}

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';


const freeAllowed = new Counter('free_allowed_200');
const freeThrottled = new Counter('free_throttled_429');
const proAllowed = new Counter('pro_allowed_200');
const proThrottled = new Counter('pro_throttled_429');
const successRate = new Rate('success_rate');

export const options = {
  scenarios: {
    free_tier_traffic: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 5 },
        { duration: '15s', target: 15 },
        { duration: '5s', target: 0 },
      ],
      exec: 'testFreeTier',
    },
    pro_tier_traffic: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 5 },
        { duration: '20s', target: 10 },
        { duration: '5s', target: 0 },
      ],
      exec: 'testProTier',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<100'],
  },
};

const BASE_URL = 'http://localhost:3000/api/resource';

// Helper to safely fetch header value regardless of key casing
function getHeaderValue(headers, headerName) {
  const targetKey = headerName.toLowerCase();
  const matchedKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === targetKey
  );
  return matchedKey ? headers[matchedKey] : null;
}

export function testFreeTier() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': `free_user_${__VU}`,
    },
  };

  const res = http.get(BASE_URL, params);

  if (res.status === 200) {
    freeAllowed.add(1);
    successRate.add(true);
  } else if (res.status === 429) {
    freeThrottled.add(1);
    successRate.add(false);
  }

  const limitHeader = getHeaderValue(res.headers, 'x-ratelimit-limit');

  check(res, {
    'Free: status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'Free: limit header matches quota (5)': () => limitHeader === '5',
  });

  sleep(0.1);
}

export function testProTier() {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': `pro_user_${__VU}`,
    },
  };

  const res = http.get(BASE_URL, params);

  if (res.status === 200) {
    proAllowed.add(1);
    successRate.add(true);
  } else if (res.status === 429) {
    proThrottled.add(1);
    successRate.add(false);
  }

  const limitHeader = getHeaderValue(res.headers, 'x-ratelimit-limit');

  check(res, {
    'Pro: status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'Pro: limit header matches quota (50)': () => limitHeader === '50',
  });

  sleep(0.1);
}
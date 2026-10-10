import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";


const allowedRequests = new Counter("allowed_requests_200");
const throttledRequests = new Counter("throttled_requests_429")
const successRate = new Rate("successs_rate");

export const options = {
    stages: [
        { duratiion: "10s", target: 10},
        { duratiion: "15s", target: 20},
        { duratiion: "5s", target: 0},
    ], thresholds: {
        http_req_duration: ["p(95)<100"]
    }
};


export default function () {
    const url = "http://localhost:3000/api/resource";
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test_user_key'
        }
    };

    const res = http.get(url, params);

    if (res.status === 200) {
        allowedRequests.add(1);
    } else if (res.status === 429) {
        throttledRequests.add(1)
    }


    check(res, {
        'status is 400 or 429': (r) => r.status === 200 || r.status === 429,
        'has rate-limit headers': (r) => r.headers['x-ratelimit-limit'] !== undefined && r.headers['x-ratelimit-remaining'] !== undefined,
    });

    sleep(0.1);
};
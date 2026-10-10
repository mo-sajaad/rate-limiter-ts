# Distributed Rate Limiter Service

A high-performance, production-grade distributed rate limiting engine built with **Node.js**, **TypeScript**, **Express**, and **Redis**. Designed for microservice architectures to prevent API abuse, enforce multi-tier usage quotas, and maintain sub-20ms latency under high concurrency.

---

## Architecture Highlights

* **Atomic Sliding Window Algorithm**: Uses Redis `ZSET` structures with an embedded **Lua script** (`slidingWindow.lua`) to calculate request counts atomically and prevent race conditions.
* **Dynamic Tier Resolution**: Dynamically maps consumer API keys to plan quotas (e.g., *Free*, *Pro*, *Enterprise*) on every request.
* **Resilient & Fail-Open**: Implemented timeout wrappers (`Promise.race`) and fallback error boundaries to ensure API availability if Redis drops or stalls.
* **RFC-Compliant Headers**: Automatically populates standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` headers.
* **Benchmarked with k6**: Validated under heavy load with parallel multi-tier scenarios, achieving **~18ms P95 latency** across 3,500+ requests.

---

## System Architecture

```
Client Request ──► Express Middleware ──► Tier Resolver ──► Redis (Lua Script)
                         │                                         │
                         ├── Denied (429 Too Many Requests) ◄──────┤ Exceeded Limit
                         └── Passed (200 OK) ◄─────────────────────┘ Allowed
```

---

## Rate Limits Configuration

| Tier | Rate Limit | Window | Header Pattern |
| :--- | :--- | :--- | :--- |
| **Free** | 5 requests | 60 seconds | `x-api-key: free_*` |
| **Pro** | 50 requests | 60 seconds | `x-api-key: pro_*` |
| **Enterprise** | 500 requests | 60 seconds | `x-api-key: ent_*` |

---

## Tech Stack

* **Language:** TypeScript / Node.js
* **Framework:** Express
* **Database / In-Memory Store:** Redis Cloud (`node-redis` v4)
* **Scripting:** Lua
* **Load Testing:** k6

---

## Quick Start

### 1. Prerequisites
* Node.js v18+
* Redis instance (Local or Redis Cloud)
* [k6](https://k6.io/) (for running load benchmarks)

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
PORT=3000
REDIS_URL=redis://default:your_password@your_redis_host:port
```

### 3. Installation
```bash
npm install
```

### 4. Run the API Server
```bash
npx tsx src/app.ts
```

---

## Load Testing & Benchmarks

Run the k6 load testing suite to simulate parallel Free and Pro traffic spikes:

```bash
k6 run benchmarks/loadTest.js
```

### Verified Performance Results
* **Throughput:** ~100 requests/sec across 25 concurrent Virtual Users
* **P95 Latency:** `< 19ms`
* **Assertion Check Rate:** `100%`

---

## Project Structure

```text
├── benchmarks/
│   └── loadTest.js           # Multi-scenario k6 load test script
├── src/
│   ├── config/
│   │   ├── redis.ts          # Redis client connection & lifecycle management
│   │   └── tiers.ts          # Usage quotas and rate limit tier configurations
│   ├── middleware/
│   │   └── rateLimiter.ts    # Dynamic rate limiter middleware logic
│   ├── scripts/
│   │   └── slidingWindow.lua # Atomic sliding window Lua script
│   └── app.ts                # Express application entrypoint
├── package.json
└── README.md
```
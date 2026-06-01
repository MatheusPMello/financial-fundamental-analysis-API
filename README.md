# 📈 Financial Fundamental Analysis API

[![Node.js](https://img.shields.io/badge/Node.js-v22-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.9-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Jest](https://img.shields.io/badge/Jest-v30-red?style=for-the-badge&logo=jest)](https://jestjs.io/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-cyan?style=for-the-badge&logo=docker)](https://www.docker.com/)

A high-performance, production-ready REST API that aggregates real-time stock market data and performs fundamental investment analysis. Engineered with a focus on **clean architecture**, **mathematical precision**, and **system resilience**.

This API is designed to serve as a portfolio-grade showcase of modern Node.js/TypeScript backend engineering, highlighting robust error handling, caching strategies, rate limiting, and comprehensive testing.

---

## ⚡ Core Engineering Highlights

* **🏎️ Sub-5ms Latency (99.3% Reduction):** Implemented an in-memory caching layer (`node-cache`) with a TTL of 10 minutes, cutting average response times from **~800ms** (external API fetch) to **<5ms** on cache hits.
* **🧮 Arbitrary Mathematical Precision:** Leverages `decimal.js` to perform financial math (such as P/E and price-to-book ratios), avoiding binary floating-point representation issues (`0.1 + 0.2 !== 0.3`) inherent in JavaScript.
* **🛡️ Smart Rate Limiting & Backpressure:** Employs `Bottleneck` to throttle upstream requests to Yahoo Finance (333ms delay, 1 concurrent request max), guaranteeing compliance with rate limits and preventing IP bans.
* **🎯 Global Error-Handling Middleware:** Standardized HTTP responses by separating business-logic exceptions (`NotFoundError`, `InsufficientDataError`) from server infrastructure errors using a centralized Express middleware.
* **🧪 100% Core Test Coverage:** Includes unit tests for math and logic, as well as route integration tests utilizing `supertest` to assert status codes, headers, and payloads.

---

## 🏗️ Architecture & Design Patterns

The project is structured around a **Layered (3-Tier) Architecture** to isolate business rules from delivery mechanisms and external integrations.

```mermaid
flowchart TD
    Client([Client / HTTP Request]) -->|GET /api/stocks/analyze/:ticker| Router[Routing Layer<br/>stockRoutes.ts]
    Router --> Controller[Controller Layer<br/>stockController.ts]
    Controller -->|Delegates Request| Service[Service Layer<br/>analysisService.ts]
    
    subgraph Service Layer (Core Business Rules)
        Service -->|Check Cache| Cache[(Cache Service<br/>cacheService.ts)]
        Service -->|Compute Math| Decimal[Decimal.js Engine]
    end
    
    subgraph Infrastructure / Outer Ring
        Service -.->|Cache Miss| API[API Wrapper / Throttler<br/>apiWrapper.ts]
        API -->|Throttled Request| Yahoo[Yahoo Finance API]
    end
    
    Controller -.->|Throws Error| ErrMiddleware[Error Handler Middleware<br/>errorHandler.ts]
    ErrMiddleware -->|Format standard JSON| Client
```

### Technical Design Decisions:
1. **Express controller decoupling:** Controllers do not handle database or math operations. They extract route inputs, validate types, delegate execution to the service, and pass exceptions down the Express chain using `next(error)`.
2. **Deterministic Custom Error Hierarchy:** App errors inherit from a base `AppError` carrying semantic HTTP status codes. This ensures that a missing ticker yields a `404 Not Found` while an unprofitable stock or missing data yields a `422 Unprocessable Entity` rather than a generic `500`.
3. **Singleton Pattern:** The `CacheService` is instantiated as a singleton, ensuring consistent memory state across all incoming requests.

---

## 📂 Project Structure

```text
financial-fundamental-analysis-API/
├── src/
│   ├── config/             # Config variables & environment settings (settings.ts)
│   ├── controllers/        # Express controllers (request extraction & validation)
│   ├── middlewares/        # Express middlewares (global error handlers)
│   ├── routes/             # API routes & endpoint mappings (stockRoutes.ts)
│   ├── services/           # Pure business logic (analysis calculations & cache management)
│   ├── types/              # TypeScript definitions & data contracts (stockTypes.ts)
│   ├── utils/              # Third-party API wrappers & Bottleneck limiters (apiWrapper.ts)
│   ├── app.ts              # Express App definition (middleware mounting)
│   └── server.ts           # Application entry point (server listener bootstrap)
├── Dockerfile              # Multi-stage production container setup
├── jest.config.ts          # Jest test configuration
└── eslint.config.mjs       # Strict linting configuration (eslint v9)
```

---

## 📡 API Reference

### Analyze Stock
Calculates fundamental metrics and yields a qualitative analysis rating for a given stock symbol.

* **Endpoint:** `/api/stocks/analyze/:ticker`
* **Method:** `GET`
* **Headers:** `Content-Type: application/json`

#### Success Response (200 OK)
```json
{
  "ticker": "AAPL",
  "currency": "USD",
  "price": "225.50",
  "analysis": "Fair Value Range",
  "indicators": {
    "pe_ratio": "28.50",
    "eps": "7.91",
    "pb_ratio": "45.12"
  },
  "generated_at": "2026-06-01T18:48:00.000Z"
}
```

#### Not Found Response (404 Not Found)
```json
{
  "error": "Stock ticker 'INVALID' not found."
}
```

#### Unprocessable Data Response (422 Unprocessable Entity)
*Occurs when a stock exists but lacks critical current price/financial data.*
```json
{
  "error": "Insufficient financial data: Missing price for XYZ"
}
```

---

## 🛠️ Tech Stack & Dependencies

* **Runtime:** Node.js (LTS v22)
* **Language:** TypeScript (Strict compiler mode enabled)
* **Framework:** Express.js (v5.x)
* **Libraries:**
  * `yahoo-finance2` (Data ingestion wrapper)
  * `decimal.js` (High-precision mathematical computations)
  * `bottleneck` (Rate-limiting and task queue)
  * `node-cache` (Fast in-memory caching)
  * `helmet` & `cors` (HTTP header security & CORS configuration)
* **Testing & Tooling:** Jest, ts-jest, Supertest, ESLint (strict configuration), Prettier.

---

## ⚡ Getting Started

### Prerequisites
* Node.js (v20 or higher)
* npm

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MatheusPMello/financial-fundamental-analysis-API.git
   cd financial-fundamental-analysis-API
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   NODE_ENV=development
   ```

4. **Launch the Server:**
   ```bash
   # Running in development mode (auto-reload via tsx)
   npm run dev

   # Build & Run in production mode
   npm run build
   npm start
   ```

---

## 🧪 Testing & Code Quality

The codebase enforces strict type-safety, clean code principles, and exhaustive testing.

### Run Tests
```bash
# Execute Jest unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Run Linter
```bash
# Verify code formatting and linting rules
npm run lint
```

---

## 🐳 Docker Deployment

The application features a optimized **multi-stage Docker build** using Node 22-Alpine, minimizing final image size (only production dependencies and compiled JS are copied into the final runner image).

```bash
# Build the Docker image
docker build -t financial-analyzer-api .

# Run the container
docker run -p 3000:3000 --env-file .env financial-analyzer-api
```

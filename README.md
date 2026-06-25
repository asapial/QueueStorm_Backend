# QueueStorm Backend

QueueStorm Backend is an Express.js, TypeScript, Prisma, and PostgreSQL API for classifying customer support tickets. It validates incoming ticket payloads, sends classification prompts to an AI provider through OpenRouter, normalizes the response into a strict API contract, and logs classification attempts with Prisma.

The service is designed for the QueueStorm Warmup mock preliminary task and follows a modular, feature-oriented structure.

## Tech Stack

- Node.js
- Express.js 5
- TypeScript
- Zod
- Prisma 7
- PostgreSQL
- OpenRouter API
- tsx for local development
- tsup for production builds

## Project Structure

```text
src/
  api.ts
  app.ts
  server.ts
  config/
    env.ts
  lib/
    openrouter.ts
    prisma.ts
  middleware/
    error.middleware.ts
    notFound.middleware.ts
  modules/
    ticket/
      api.route.ts
      api.controller.ts
      api.service.ts
      api.validation.ts
      api.type.ts
      api.constant.ts
prisma/
  schema/
    schema.prisma
    auth.prisma
    ticket-log.prisma
```

## Architecture

```mermaid
flowchart TD
  Client["API Client"] --> App["Express App"]
  App --> Middleware["Global Middleware<br/>CORS, JSON Parser"]
  Middleware --> Routes["Ticket Routes"]
  Routes --> Controller["Ticket Controller"]
  Controller --> Validation["Zod Validation"]
  Validation --> Service["Ticket Service"]
  Service --> OpenRouter["OpenRouter AI API"]
  Service --> Prisma["Prisma Client"]
  Prisma --> Postgres["PostgreSQL"]
  App --> ErrorMiddleware["Error Middleware"]
  App --> NotFound["Not Found Middleware"]
```

## Request Flow

```mermaid
sequenceDiagram
  participant Client
  participant Express as Express App
  participant Route as Ticket Route
  participant Controller
  participant Zod as Zod Validator
  participant Service as Ticket Service
  participant AI as OpenRouter
  participant Prisma
  participant DB as PostgreSQL

  Client->>Express: POST /sort-ticket
  Express->>Route: Match route
  Route->>Controller: Forward request
  Controller->>Zod: Validate body
  Zod-->>Controller: Typed payload
  Controller->>Service: sortTicket(payload)
  Service->>AI: Send classification prompt
  AI-->>Service: Raw JSON-like response
  Service->>Service: Parse, normalize, enforce safety rules
  Service->>Prisma: Create TicketLog
  Prisma->>DB: Insert classification log
  DB-->>Prisma: Insert result
  Prisma-->>Service: Log complete
  Service-->>Controller: Classification response
  Controller-->>Client: 200 JSON response
```

If Prisma logging fails, the service catches the error and still returns the classification response.

## API Endpoints

### GET /health

Returns service status and uptime.

Example response:

```json
{
  "status": "ok",
  "service": "QueueStorm Warmup API",
  "uptime": 12.34
}
```

### POST /sort-ticket

Classifies a customer support ticket.

Request body:

```json
{
  "ticket_id": "T-001",
  "channel": "app",
  "locale": "en",
  "message": "I sent 5000 taka to a wrong number this morning, please help me get it back"
}
```

Required fields:

- `ticket_id`
- `message`

Optional fields:

- `channel`: `app`, `sms`, `call_center`, `merchant_portal`
- `locale`: `bn`, `en`, `mixed`

Response body:

```json
{
  "ticket_id": "T-001",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports sending money to the wrong recipient and requests assistance.",
  "human_review_required": false,
  "confidence": 0.85
}
```

## Classification Contract

Allowed `case_type` values:

- `wrong_transfer`
- `payment_failed`
- `refund_request`
- `phishing_or_social_engineering`
- `other`

Allowed `severity` values:

- `low`
- `medium`
- `high`
- `critical`

Allowed `department` values:

- `customer_support`
- `dispute_resolution`
- `payments_ops`
- `fraud_risk`

Safety constraints:

- `agent_summary` must stay neutral and factual.
- The API must never ask customers to share PIN, OTP, password, CVV, or full card number.
- `human_review_required` is true when the ticket is phishing/social engineering or severity is critical.

## Environment Variables

Create `.env` from `.env.example`.

```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
OPENROUTER_API_KEY=your_openrouter_api_key
```

## Local Setup

Install dependencies:

```powershell
npm install
```

Create environment file:

```powershell
copy .env.example .env
```

Generate Prisma Client:

```powershell
npm run generate
```

Run database migrations:

```powershell
npm run migrate
```

Start development server:

```powershell
npm run dev
```

## Scripts

```text
npm run dev          Start local development server with tsx watch
npm run generate     Generate Prisma Client
npm run migrate      Run Prisma migrations
npm run typecheck    Generate Prisma Client and run TypeScript checks
npm run build        Build production output into dist/
npm start            Start compiled production server
npm run check        Run typecheck and build
```

## Sample Curl Commands

Health check:

```bash
curl http://localhost:3000/health
```

Sort ticket:

```bash
curl -X POST http://localhost:3000/sort-ticket \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\":\"T-001\",\"channel\":\"app\",\"locale\":\"en\",\"message\":\"I sent 5000 taka to a wrong number this morning, please help me get it back\"}"
```

Validation error example:

```bash
curl -X POST http://localhost:3000/sort-ticket \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\":\"\",\"message\":\"\"}"
```

## Deployment

1. Set environment variables in the deployment platform.
2. Install dependencies with `npm install`.
3. Generate Prisma Client with `npm run generate`.
4. Apply database migrations with `npm run migrate` or a managed migration step.
5. Build the application with `npm run build`.
6. Start the application with `npm start`.

For Vercel serverless builds, the project includes:

```powershell
npm run vercel-build
```

The Vercel entry point is `src/api.ts`, which exports the Express app without calling `app.listen()`.

## Error Handling

The API uses centralized middleware for:

- Zod validation errors
- Unexpected internal errors
- Unknown routes

Ticket classification logging is non-blocking. If PostgreSQL or Prisma logging is unavailable, the API logs the failure and continues returning the classification result.

## Known Issues

- Classification depends on OpenRouter availability and a valid `OPENROUTER_API_KEY`.
- Prisma logging requires a reachable PostgreSQL database and applied migrations.
- AI output is parsed and normalized, but upstream model behavior can still vary.
- Relative local imports use `.js` extensions because the project is ESM TypeScript.

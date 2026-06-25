# QueueStorm Warmup API

Express.js + TypeScript + Prisma API for the QueueStorm Warmup mock preliminary task. It classifies support tickets using deterministic rules and attempts to save each classification to Prisma without blocking the API response if logging fails.

## Tech Stack

- Node.js
- Express.js
- TypeScript
- Prisma 7
- PostgreSQL
- Zod
- tsx for development
- tsup for production build

## Endpoints

### GET /health

Returns service status and uptime.

```json
{
  "status": "ok",
  "service": "QueueStorm Warmup API",
  "uptime": 12.34
}
```

### POST /sort-ticket

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

Sample response:

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

## Local Setup

```powershell
npm install
copy .env.example .env
npm run generate
npm run dev
```

For a production-style local run:

```powershell
npm run build
npm start
```

## Environment Variables

```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

## Database

Generate Prisma Client:

```powershell
npm run generate
```

Create and apply a migration after configuring `DATABASE_URL`:

```powershell
npm run migrate
```

The API catches Prisma logging errors and still returns classification responses.

## Deployment

1. Set `DATABASE_URL`, `NODE_ENV`, `PORT`, and `CORS_ORIGIN` in the host environment.
2. Run `npm install`.
3. Run `npm run build`.
4. Run migrations with `npm run migrate` or your deployment provider's migration step.
5. Start with `npm start`.

## Sample Curl

Health:

```bash
curl http://localhost:3000/health
```

Sort ticket:

```bash
curl -X POST http://localhost:3000/sort-ticket \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\":\"T-001\",\"channel\":\"app\",\"locale\":\"en\",\"message\":\"I sent 5000 taka to a wrong number this morning, please help me get it back\"}"
```

## Known Issues

- Prisma logging requires a reachable PostgreSQL database and an applied migration.
- Classification is deterministic keyword matching, not an ML model.
- Local relative imports use `.js` extensions because the project is ESM TypeScript.

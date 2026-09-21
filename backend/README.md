# SocraticAI Backend

Production-ready Node.js Express API for the SocraticAI platform.

## Features

- ✅ **Multi-Tenant Architecture** with Row-Level Security (RLS)
- ✅ **JWT Authentication** via Supabase Auth
- ✅ **Socratic AI Integration** with 4 modalities (Bias Blueprint, Devil's Advocate, Socratic Auditor, Source Scrutiny)
- ✅ **Document Upload & Analysis** (PDF, DOCX, TXT, MD, JSON)
- ✅ **Project & Session Management**
- ✅ **Real-time Message Streaming** via Server-Sent Events (SSE)
- ✅ **In-Memory Task Queue** for background jobs
- ✅ **Comprehensive Error Handling** with structured logging
- ✅ **Cost Optimization** with token counting and caching

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o
- **Storage**: Supabase Storage (S3-compatible)
- **Logging**: Pino (structured JSON logs)
- **File Parsing**: pdf-parse, mammoth, native fs

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Supabase project created (https://supabase.com)
- OpenAI API key

### 2. Clone & Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 3. Environment Variables

Required variables in `.env`:

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# OpenAI
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4o

# Document Upload
MAX_FILE_SIZE_MB=10
SUPPORTED_FILE_TYPES=pdf,docx,txt,md,json
```

### 4. Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to Supabase project
supabase link --project-ref your-project-id

# Run migrations
supabase db push

# Or manually copy migration SQL from /database/migrations to Supabase SQL editor
```

### 5. Run Development Server

```bash
npm run dev
```

Server will start on `http://localhost:5000`

Health check: `http://localhost:5000/health`

API docs: `http://localhost:5000/api`

## Project Structure

```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.ts           # Authentication (register, login, logout)
│   │   ├── projects.ts       # Project CRUD
│   │   ├── sessions.ts       # Session CRUD
│   │   ├── messages.ts       # Chat & AI generation
│   │   └── documents.ts      # File upload & storage
│   ├── services/
│   │   ├── openai.service.ts # OpenAI wrapper & Socratic prompts
│   │   └── document.service.ts # File parsing & storage
│   ├── middleware/
│   │   └── auth.ts           # JWT verification & RLS
│   ├── config/
│   │   └── supabase.ts       # Supabase client & initialization
│   ├── queue/
│   │   └── task.queue.ts     # In-memory task processor
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   ├── logger.ts             # Pino logging setup
│   └── server.ts             # Express app entry point
├── database/
│   └── migrations/
│       ├── 001_init_schema.sql      # Core users & billing tables
│       ├── 002_add_projects.sql     # Projects & sessions
│       └── 003_add_messages_documents.sql  # Messages & documents
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

### Authentication

```
POST   /api/auth/register          # Create new account
POST   /api/auth/login             # Login with email/password
POST   /api/auth/logout            # Logout (revoke session)
GET    /api/auth/me                # Get current user profile
```

**Example:**

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePassword123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePassword123"}'

# Response includes access_token and refresh_token
```

### Projects

```
GET    /api/projects              # List projects
POST   /api/projects              # Create project
GET    /api/projects/:projectId   # Get project details
PUT    /api/projects/:projectId   # Update project
DELETE /api/projects/:projectId   # Archive project
```

**Example:**

```bash
# Create project
curl -X POST http://localhost:5000/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My First Project","description":"Exploring critical thinking"}'
```

### Sessions

```
GET    /api/sessions              # List sessions
POST   /api/sessions              # Create session
GET    /api/sessions/:sessionId   # Get session
PUT    /api/sessions/:sessionId   # Update session
DELETE /api/sessions/:sessionId   # Delete session
```

### Messages (Chat & AI)

```
GET    /api/messages/session/:sessionId    # Get session messages
POST   /api/messages                       # Send message & get AI response
POST   /api/messages/:messageId/stream     # Stream AI response (SSE)
```

**Example:**

```bash
# Send message and get Socratic response
curl -X POST http://localhost:5000/api/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id":"abc-123",
    "content":"I believe AI will solve all human problems",
    "modality_type":"devil_advocate"
  }'
```

### Documents

```
POST   /api/documents/upload       # Upload document
GET    /api/documents              # List documents
GET    /api/documents/:documentId  # Get document & content
DELETE /api/documents/:documentId  # Delete document
```

**Example:**

```bash
# Upload document
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@mydocument.pdf" \
  -F "project_id=abc-123"
```

## Socratic Modalities

The AI can respond in 4 different Socratic modes:

### 1. **Bias Blueprint**
Identifies hidden assumptions, biases, and logical flaws in arguments.

```json
{
  "modality_type": "bias_blueprint",
  "content": "Our company should invest 100% in AI because it's the future"
}
```

### 2. **Devil's Advocate**
Generates strong counter-arguments and opposing viewpoints.

```json
{
  "modality_type": "devil_advocate",
  "content": "Remote work increases employee productivity"
}
```

### 3. **Socratic Auditor** (Default)
Asks probing questions to force deep reflection and discovery.

```json
{
  "modality_type": "socratic_auditor",
  "content": "I want to start my own business"
}
```

### 4. **Source Scrutiny**
Evaluates evidence quality and identifies missing research.

```json
{
  "modality_type": "source_scrutiny",
  "content": "Studies show that X causes Y",
  "document_id": "optional-document-id"
}
```

## Authentication

### JWT Token Flow

1. User registers/logs in → Supabase creates auth user
2. Backend returns `access_token` (1 hour) + `refresh_token` (7 days)
3. Client stores tokens in secure storage
4. All protected routes require `Authorization: Bearer <access_token>` header
5. Expired token → use refresh token to get new access token

### Row-Level Security (RLS)

All data is isolated at the database level:

- Users can only read/modify their own records
- Projects are limited to their owner
- Sessions are scoped to project owner
- Messages are scoped to session owner
- Documents are private to their uploader

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use production Supabase project
- [ ] Enable HTTPS
- [ ] Set secure CORS origins
- [ ] Implement rate limiting (add express-rate-limit)
- [ ] Set up monitoring & error tracking (Sentry)
- [ ] Configure automated backups
- [ ] Use environment secrets manager (AWS Secrets Manager, 1Password)
- [ ] Enable database connection pooling (PgBouncer)

### Deploy to Railway/Render

```bash
# Using Railway CLI
railway link
railway up

# Or using Render (connect GitHub repo)
# 1. Push code to GitHub
# 2. Create new Web Service on Render
# 3. Connect GitHub repo
# 4. Set environment variables
# 5. Deploy
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 5000

CMD ["node", "dist/server.js"]
```

```bash
docker build -t socratic-ai-backend .
docker run -p 5000:5000 --env-file .env socratic-ai-backend
```

## Error Handling

All errors return structured JSON:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "statusCode": 401,
    "timestamp": "2025-01-20T10:30:00.000Z"
  }
}
```

Common error codes:

- `INVALID_CREDENTIALS` - Login failed
- `MISSING_TOKEN` - No auth header
- `INSUFFICIENT_TIER` - User doesn't have required subscription
- `NOT_FOUND` - Resource doesn't exist
- `PERMISSION_DENIED` - User lacks access
- `INTERNAL_ERROR` - Server error

## Logging

Structured logging via Pino. In development, pretty-printed; in production, JSON.

```bash
# View logs
tail -f logs/app.log | jq

# Filter by level
tail -f logs/app.log | jq 'select(.level==50)'
```

## Testing

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- auth.test.ts
```

## Performance Optimization

### Token Caching

Tokens are counted and cached to optimize OpenAI costs:

```typescript
const tokenCount = aiService.countTokens(userStatement);
const estimatedCost = aiService.estimateCost(inputTokens, outputTokens);
```

### Database Indexes

All frequently-queried columns are indexed:

```sql
CREATE INDEX idx_sessions_user_id_created_at ON sessions(user_id, created_at);
CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at DESC);
```

### Connection Pooling

Supabase handles connection pooling automatically via `pgbouncer`.

## Troubleshooting

### "Cannot connect to Supabase"

- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check firewall rules in Supabase dashboard
- Ensure database migrations have run

### "OpenAI API key invalid"

- Verify `OPENAI_API_KEY` starts with `sk-`
- Check API key in OpenAI dashboard hasn't expired
- Ensure key has permission for `gpt-4o` model

### "File upload fails"

- Check `MAX_FILE_SIZE_MB` limit
- Verify file MIME type is in `SUPPORTED_FILE_TYPES`
- Ensure Supabase Storage bucket exists

## Support

- **Documentation**: https://docs.socratic-ai.app
- **Issues**: https://github.com/socratic-ai/backend/issues
- **Discussions**: https://github.com/socratic-ai/discussions

---

**Built with ❤️ for critical thinking**

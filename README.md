# SocraticAI - MVP

Complete implementation of SocraticAI, a vertical AI SaaS application that challenges users to think critically through Socratic questioning.

## 🎯 Project Overview

SocraticAI is a **production-ready MVP** that demonstrates:

- **Full-Stack Architecture**: React + TypeScript frontend, Node.js + Express backend
- **Multi-Tenant SaaS**: Complete user isolation via RLS policies
- **AI Integration**: OpenAI GPT-4o with 4 Socratic modalities
- **Document Management**: Upload, parse, and analyze documents (PDF, DOCX, TXT, MD, JSON)
- **Real-Time Chat**: Server-Sent Events for streaming AI responses
- **Scalable State Management**: Zustand for frontend, Supabase for backend

## 📋 Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- Axios (HTTP client)
- React Router (routing)

### Backend
- Node.js 18+ + Express
- TypeScript
- Supabase (PostgreSQL + Auth + Storage)
- OpenAI API (GPT-4o)
- Pino (structured logging)

### Database
- PostgreSQL (Supabase)
- Row-Level Security (RLS) for multi-tenancy
- Vector storage ready (pgvector)

## 🚀 Quick Start (Complete Setup)

### Prerequisites

- Node.js 18+ installed
- npm or yarn
- Supabase project (free tier at https://supabase.com)
- OpenAI API key (https://platform.openai.com/api-keys)

### Step 1: Clone & Setup Directory Structure

```bash
# Create project directory
mkdir socratic-ai
cd socratic-ai

# Create subdirectories
mkdir backend frontend database

# Backend setup
cd backend
npm install
cp .env
# Edit .env with Supabase and OpenAI credentials

# Frontend setup (new terminal window)
cd frontend
npm install
cp .env
```

### Step 2: Configure Supabase

1. Go to https://supabase.com and create a new project
2. In Project Settings, copy:
   - Project URL → `SUPABASE_URL`
   - Anon Key → `SUPABASE_ANON_KEY`
   - Service Role Key → `SUPABASE_SERVICE_ROLE_KEY`
   - JWT Secret → `SUPABASE_JWT_SECRET`

3. Add to `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

### Step 3: Run Database Migrations

```bash
cd backend

# Using Supabase CLI
supabase link --project-ref your-project-id

# Copy SQL from database/migrations/ into Supabase SQL editor and run:
# 1. 001_init_schema.sql
# 2. 002_add_projects.sql
# 3. 003_add_messages_documents.sql

# Or manually paste each file into Supabase SQL editor
```

### Step 4: Configure OpenAI

1. Get API key from https://platform.openai.com/api-keys
2. Add to `backend/.env`:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
```

### Step 5: Start Backend

```bash
cd backend
npm run dev
```

Backend will start on `http://localhost:5000`

### Step 6: Start Frontend (New Terminal)

```bash
cd frontend
npm run dev
```

Frontend will open at `http://localhost:3000`

## 📁 Project Structure

```
socratic-ai/
├── backend/
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic (OpenAI, documents)
│   │   ├── middleware/      # Auth, error handling
│   │   ├── config/          # Supabase setup
│   │   ├── queue/           # Task queue
│   │   ├── types/           # TypeScript types
│   │   ├── logger.ts        # Pino logger
│   │   └── server.ts        # Express app
│   ├── database/
│   │   └── migrations/      # SQL migrations
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components (future)
│   │   ├── store/           # Zustand state stores
│   │   ├── services/        # API client
│   │   ├── types/           # TypeScript types
│   │   ├── App.tsx          # Router & main component
│   │   ├── main.tsx         # Entry point
│   │   └── index.css        # Tailwind styles
│   ├── public/              # Static assets
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── .env
│   └── README.md
│
└── README.md (this file)
```

## 🔑 Key Features

### 1. User Authentication
- Email/password registration and login
- Supabase Auth (JWT-based)
- Automatic session management
- Protected routes

### 2. Project Management
- Create, read, update, delete projects
- Organize sessions within projects
- Archive projects (soft delete)

### 3. Chat Sessions
- Create sessions within projects
- Multi-turn conversations
- Message history
- Real-time streaming responses

### 4. Socratic AI Modalities

**4 distinct reasoning modes:**

1. **Bias Blueprint** 🔍
   - Identifies hidden assumptions
   - Finds logical flaws
   - Points out logical fallacies

2. **Devil's Advocate** ⚡
   - Generates counter-arguments
   - Stress-tests ideas
   - Explores alternative viewpoints

3. **Socratic Auditor** ❓
   - Asks probing questions
   - Forces deep reflection
   - Guides to self-discovery

4. **Source Scrutiny** 📊
   - Evaluates evidence quality
   - Identifies missing research
   - Pressure-tests claims

### 5. Document Management
- Upload files (PDF, DOCX, TXT, MD, JSON)
- Automatic parsing and extraction
- Use documents in Socratic analysis
- File size limits and validation

### 6. Multi-Tenant Architecture
- Complete data isolation via RLS
- Per-user projects, sessions, documents
- Secure API key management (encrypted)
- Audit logging ready

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/register      # Create account
POST   /api/auth/login         # Login
POST   /api/auth/logout        # Logout
GET    /api/auth/me            # Current user
```

### Projects
```
GET    /api/projects           # List projects
POST   /api/projects           # Create project
GET    /api/projects/:id       # Get project
PUT    /api/projects/:id       # Update project
DELETE /api/projects/:id       # Delete project
```

### Sessions
```
GET    /api/sessions           # List sessions
POST   /api/sessions           # Create session
GET    /api/sessions/:id       # Get session
PUT    /api/sessions/:id       # Update session
DELETE /api/sessions/:id       # Delete session
```

### Messages
```
GET    /api/messages/session/:id    # Get session messages
POST   /api/messages                # Send message & get AI response
POST   /api/messages/:id/stream     # Stream response (SSE)
```

### Documents
```
POST   /api/documents/upload    # Upload document
GET    /api/documents           # List documents
GET    /api/documents/:id       # Get document
DELETE /api/documents/:id       # Delete document
```

## 📊 Database Schema

### Core Tables
- `users` - Auth user references
- `user_profiles` - User info (name, tier, settings)
- `user_api_keys` - Encrypted API keys for OpenAI, Anthropic, etc.
- `user_subscriptions` - Billing info
- `subscription_tiers` - Pricing tiers (free, strategist, stoics)

### Application Tables
- `projects` - User projects (containers for sessions)
- `sessions` - Chat sessions (1 project → many sessions)
- `messages` - Chat messages (1 session → many messages)
- `documents` - Uploaded files (1 project → many documents)

### Usage & Billing
- `usage_logs` - Track API calls and token usage
- `audit_trail` - Compliance logging

## 🔐 Security Features

✅ **Row-Level Security (RLS)**
- All tables protected by RLS policies
- Users can only access their own data
- Database-level isolation

✅ **Authentication**
- JWT-based via Supabase Auth
- Automatic token refresh
- Secure session management

✅ **API Key Management**
- Encrypted storage at rest
- Never logged or exposed
- Support for rotation and revocation

✅ **CORS Protection**
- Restricted to frontend URL
- Prevents unauthorized access

✅ **Error Handling**
- No sensitive data in error messages
- Structured error responses
- Comprehensive logging

## 💰 Monetization

### Pricing Tiers (Ready to Implement)

1. **The Seeker (Free)**
   - 4 audits/month
   - $2.99 per additional audit
   - Trial hook for new users

2. **The Strategist ($7.99/mo)**
   - 8 audits/month
   - Unlimited modalities
   - Session history

3. **The Stoics ($19.99/mo)**
   - Unlimited audits
   - Data residency guarantee
   - Audit trails
   - Team collaboration (Phase 2)

## 📈 Performance

- **Frontend Bundle**: < 100KB (gzip)
- **API Response Time**: < 2s (with AI generation)
- **Database Query Performance**: < 100ms (indexed)
- **Concurrent Users**: Scales with Supabase limits

## 🚀 Deployment

### Frontend (Vercel)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Backend (Railway/Render)
```bash
# Railway
railway link
railway up

# Or connect GitHub repo to Render
```

### Database
- Supabase handles all hosting

## 🧪 Testing

### Backend
```bash
cd backend
npm run test
```

### Frontend
```bash
cd frontend
npm run test
npm run test:ui
```

## 📚 Documentation

- **Backend**: See `backend/README.md`
- **Frontend**: See `frontend/README.md`
- **API Docs**: Available at `http://localhost:5000/api` (running)

## 🛠️ Development Workflow

### 1. Make Backend Changes
```bash
cd backend
npm run dev
# Code changes auto-reload (via tsx watch)
```

### 2. Make Frontend Changes
```bash
cd frontend
npm run dev
# Vite auto-reload on save
```

### 3. Test Full Flow
1. Login at `http://localhost:3000`
2. Create a project
3. Create a session
4. Send a message to SocraticAI
5. Switch modalities and try again

## 🐛 Troubleshooting

### Backend won't start
```
Error: Cannot connect to Supabase
→ Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
→ Ensure database migrations have run
```

### Frontend shows "Cannot reach API"
```
→ Ensure backend is running on port 5000
→ Check VITE_API_URL in frontend/.env
→ Check CORS settings in backend
```

### No AI responses
```
→ Check OPENAI_API_KEY is valid
→ Verify OpenAI account has active billing
→ Check backend logs for API errors
```

### Documents won't upload
```
→ Check file size < 10MB
→ Verify file type is supported (pdf, docx, txt, md, json)
→ Check Supabase Storage bucket exists
```

## 📝 Git Workflow

```bash
# Clone this repo
git clone https://github.com/socratic-ai/mvp.git
cd socratic-ai

# Create feature branch
git checkout -b feature/your-feature

# Commit changes
git add .
git commit -m "feat: describe your changes"

# Push
git push origin feature/your-feature
```

## 🎓 Learning Resources

- **React**: https://react.dev
- **TypeScript**: https://www.typescriptlang.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Supabase**: https://supabase.com/docs
- **OpenAI API**: https://platform.openai.com/docs

## 📞 Support

- **Issues**: Create GitHub issue with detailed reproduction steps
- **Discussions**: Use GitHub Discussions for feature ideas
- **Security**: Email security@socratic-ai.app with details

## 📄 License

MIT License - See LICENSE file for details

## 🎉 Success Metrics

After successful setup, you should be able to:

✅ Register a new account  
✅ Create a project  
✅ Create a session  
✅ Send a message  
✅ Receive Socratic AI response  
✅ Switch between modalities  
✅ Upload a document  
✅ Use document in analysis  
✅ View session history  

---

**Built with ❤️ for critical thinking**

*Status: MVP Ready - Production Deployment Available*

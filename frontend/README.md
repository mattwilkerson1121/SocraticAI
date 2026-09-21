# SocraticAI Frontend

Modern React TypeScript frontend for the SocraticAI application.

## Features

- ✅ **React 18** with TypeScript for type-safe UI
- ✅ **Vite** for lightning-fast development and builds
- ✅ **Zustand** for lightweight, scalable state management
- ✅ **Tailwind CSS** for utility-first styling
- ✅ **React Router** for client-side routing
- ✅ **Axios** for API communication
- ✅ **Real-time chat interface** with streaming support
- ✅ **Document upload & management**
- ✅ **Multi-modality AI selection** (Bias Blueprint, Devil's Advocate, Socratic Auditor, Source Scrutiny)
- ✅ **Project & session organization**
- ✅ **Fully responsive design**

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript 5
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **State Management**: Zustand 4
- **Routing**: React Router 6
- **HTTP Client**: Axios
- **Testing**: Vitest

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:5000`

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env if needed
nano .env
```

### 4. Start Development Server

```bash
npm run dev
```

Frontend will open at `http://localhost:3000`

## Project Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── login.page.tsx         # Login page
│   │   ├── signup.page.tsx        # Signup page
│   │   ├── dashboard.page.tsx     # Projects dashboard
│   │   └── chat.page.tsx          # Chat interface
│   ├── components/                # Reusable components (future)
│   ├── store/
│   │   ├── auth.store.ts          # Auth state
│   │   ├── projects.store.ts      # Projects state
│   │   ├── chat.store.ts          # Chat/sessions state
│   │   └── documents.store.ts     # Documents state
│   ├── services/
│   │   └── api.client.ts          # API client wrapper
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   ├── App.tsx                    # Main app component with routing
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Global styles
├── public/
│   └── favicon.svg
├── index.html                     # HTML entry point
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Key Files Explained

### State Management (Zustand Stores)

```typescript
// Auth Store - manages user login/logout
import { useAuthStore } from './store/auth.store';
const { user, login, logout, isAuthenticated } = useAuthStore();

// Projects Store - manages project CRUD
import { useProjectsStore } from './store/projects.store';
const { projects, createProject, deleteProject } = useProjectsStore();

// Chat Store - manages sessions and messages
import { useChatStore } from './store/chat.store';
const { messages, sendMessage, currentModality } = useChatStore();

// Documents Store - manages uploaded files
import { useDocumentsStore } from './store/documents.store';
const { documents, uploadDocument } = useDocumentsStore();
```

### API Client

The `api.client.ts` provides a type-safe wrapper around the backend API:

```typescript
import { getApiClient } from './services/api.client';

const api = getApiClient();

// Auth
await api.login('user@example.com', 'password');
await api.register('user@example.com', 'password');
await api.logout();

// Projects
const projects = await api.listProjects();
const project = await api.createProject({ name: 'My Project' });

// Sessions
const sessions = await api.listSessions(projectId);
const session = await api.createSession({ project_id: projectId, title: 'New Session' });

// Messages
const response = await api.createMessage({
  session_id: sessionId,
  content: 'My belief is...',
  modality_type: 'devil_advocate'
});

// Documents
const doc = await api.uploadDocument(file, projectId);
await api.deleteDocument(documentId);
```

## Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | LoginPage | User login |
| `/signup` | SignupPage | New account creation |
| `/dashboard` | DashboardPage | View/create projects |
| `/chat/:sessionId` | ChatPage | Socratic conversation interface |

## UI Components

### Built-in Tailwind Components

The `index.css` includes pre-configured component classes:

```html
<!-- Buttons -->
<button class="btn-primary">Primary Button</button>
<button class="btn-secondary">Secondary Button</button>
<button class="btn-ghost">Ghost Button</button>

<!-- Cards -->
<div class="card">Card content here</div>

<!-- Forms -->
<input class="input" type="text" placeholder="Input field" />
<label class="label">Form Label</label>

<!-- Badges -->
<span class="badge-primary">Badge</span>
<span class="badge-success">Success</span>
<span class="badge-error">Error</span>

<!-- Messages -->
<div class="message-user">User message</div>
<div class="message-assistant">Assistant response</div>
```

## Styling with Tailwind

### Customization

Edit `tailwind.config.ts` to customize:

- Colors
- Fonts
- Spacing
- Breakpoints
- Animations

```typescript
export default {
  theme: {
    extend: {
      colors: {
        primary: { /* custom primary colors */ },
      },
    },
  },
};
```

### Color Palette

```
Primary (Sky Blue): primary-50 to primary-900
Accent (Purple): accent-50 to accent-900
Neutral (Gray): neutral-0 to neutral-950
Status: success, warning, error
```

## API Communication

### Making Requests

```typescript
import { getApiClient } from './services/api.client';

const api = getApiClient();

try {
  const user = await api.getCurrentUser();
  console.log(user);
} catch (error) {
  if (error instanceof Error) {
    console.error('API Error:', error.message);
  }
}
```

### Error Handling

All errors are typed:

```typescript
import { ApiError } from './types/index';

try {
  await api.login(email, password);
} catch (error) {
  const err = error as ApiError;
  console.error(`Error ${err.statusCode}: ${err.code}`);
}
```

### Token Management

Tokens are automatically managed:
- Stored in localStorage after login
- Attached to all authenticated requests
- Refreshed automatically when expired

## Build & Deployment

### Build for Production

```bash
npm run build
```

Creates optimized bundle in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Static Hosting (Vercel, Netlify, etc.)

1. Build the app: `npm run build`
2. Deploy the `dist/` folder
3. Configure server to redirect `404` to `index.html` (for client-side routing)

### Environment Setup for Production

Create `.env.production`:

```env
VITE_API_URL=https://api.yourdomain.com
VITE_ENABLE_DEBUG_MODE=false
```

## Development

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

### Testing

```bash
npm run test
npm run test:ui
```

## Performance Optimization

### Code Splitting

Vite automatically code-splits by route and vendor:

```typescript
// Automatic: each page component is code-split
const DashboardPage = () => { /* ... */ };
```

### Image Optimization

Place images in `public/` directory:

```html
<img src="/image.png" alt="Description" />
```

### CSS Optimization

- Tailwind purges unused CSS in production
- Final bundle size typically < 100KB (gzip)

## Troubleshooting

### "Cannot connect to backend"

- Ensure backend is running on `http://localhost:5000`
- Check `VITE_API_URL` in `.env`
- Check browser console for CORS errors

### "Styles not loading"

- Ensure Tailwind CSS is properly configured
- Run `npm run dev` to rebuild styles
- Clear browser cache

### "Login not working"

- Check backend API is accessible
- Verify email/password combination
- Check network tab in DevTools

### "Messages not sending"

- Verify API endpoint is correct
- Check OpenAI API key is configured in backend
- Check browser console for errors

## Deployment Checklist

- [ ] Update `VITE_API_URL` to production backend
- [ ] Set `VITE_ENABLE_DEBUG_MODE=false`
- [ ] Build: `npm run build`
- [ ] Test: `npm run preview`
- [ ] Deploy `dist/` folder
- [ ] Configure static file serving (redirect 404 to index.html)
- [ ] Test all pages and features
- [ ] Monitor error logs

## Support

- **Frontend Issues**: Check browser DevTools console
- **API Issues**: Check backend logs and network tab
- **Documentation**: Check README files in each directory

---

**Built with React + TypeScript + Tailwind**

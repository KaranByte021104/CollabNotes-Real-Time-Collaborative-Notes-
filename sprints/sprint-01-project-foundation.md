# Sprint 1 — Project Foundation & Monorepo Setup

## Goal
Set up the entire project from scratch as a clean monorepo with two separate applications: a Next.js frontend and a NestJS backend. By the end of this sprint, both apps should boot without errors and be ready to build features on top of.

---

## Monorepo Structure

Create a root folder called `collab-notes` with the following top-level structure:

```
collab-notes/
├── frontend/        ← Next.js app
├── backend/         ← NestJS app
├── .gitignore
└── README.md
```

Initialize a Git repository at the root level. The `.gitignore` should exclude `node_modules`, `.env`, `.next`, `dist`, and `build` folders for both apps.

---

## Backend Setup (NestJS)

Inside the `backend/` folder, initialize a new NestJS project using the Nest CLI with TypeScript.

### Dependencies to install:
- `@nestjs/typeorm` and `typeorm` for database ORM
- `pg` as the PostgreSQL driver
- `@nestjs/config` for environment variable management
- `class-validator` and `class-transformer` for DTO validation
- `@nestjs/mapped-types` for DTO utilities

### Configuration:
- Create a `.env` file in the `backend/` root with the following variables:
  - `DATABASE_HOST`
  - `DATABASE_PORT`
  - `DATABASE_USER`
  - `DATABASE_PASSWORD`
  - `DATABASE_NAME`
  - `JWT_SECRET`
  - `PORT` (default 3001)

- Set up a global `ConfigModule` in `AppModule` that loads the `.env` file and is available everywhere in the app (`isGlobal: true`).

- Set up a `TypeOrmModule` in `AppModule` that reads database credentials from the `ConfigService`. Set `synchronize: true` for development (this auto-creates/updates DB tables from entity definitions). Set `autoLoadEntities: true` so entities register themselves.

- Enable global validation pipe in `main.ts` using `app.useGlobalPipes(new ValidationPipe({ whitelist: true }))` so all incoming request bodies are automatically validated.

- Set the global API prefix to `/api` so all routes are available at `/api/...`.

- Enable CORS in `main.ts` to allow requests from the frontend origin (read from an env variable `FRONTEND_URL`, default `http://localhost:3000`).

### Health Check:
- Create a simple `GET /api/health` endpoint in `AppController` that returns `{ status: 'ok', timestamp: new Date().toISOString() }`.

---

## Frontend Setup (Next.js)

Inside the `frontend/` folder, initialize a new Next.js project with:
- TypeScript enabled
- App Router (not Pages Router)
- Tailwind CSS configured during setup
- ESLint enabled

### Additional dependencies to install:
- `shadcn/ui` — initialize it after Next.js is set up using `npx shadcn-ui@latest init`. Choose the following when prompted:
  - Style: **Default**
  - Base color: **Slate**
  - CSS variables: **Yes**
- Install the following Shadcn components right away as they'll be used throughout the app:
  - `button`, `input`, `label`, `card`, `dialog`, `toast`, `badge`, `avatar`, `skeleton`, `separator`, `tooltip`
- `axios` for HTTP requests
- `react-hook-form` for form handling
- `zod` for form validation schemas
- `@hookform/resolvers` to connect Zod with React Hook Form
- `lucide-react` for icons (comes with Shadcn but confirm it's installed)
- `sonner` for toast notifications (a lightweight toast library that pairs well with Shadcn)

### Environment Variables:
- Create a `.env.local` file in `frontend/` with:
  - `NEXT_PUBLIC_API_URL=http://localhost:3001/api`
  - `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001`

### Axios Instance:
- Create a file at `frontend/lib/axios.ts` that exports a pre-configured Axios instance with:
  - `baseURL` set to `process.env.NEXT_PUBLIC_API_URL`
  - A request interceptor that automatically attaches the JWT token from `localStorage` to the `Authorization: Bearer <token>` header on every request
  - A response interceptor that catches `401` responses and redirects the user to `/login`

### Global Layout:
- Update `app/layout.tsx` to:
  - Use the Inter font from `next/font/google`
  - Wrap the entire app in a `Toaster` component from Sonner so toasts work globally
  - Set the HTML `lang` attribute to `"en"`
  - Apply a clean background color using Tailwind: `bg-slate-50 dark:bg-slate-950` on the body

### Design Tokens & Theme:
- The color palette should use Slate as the neutral base (already configured by Shadcn)
- The primary accent color should be **Indigo** — update `globals.css` to set the Shadcn CSS variable `--primary` to an indigo shade (indigo-600 = `239 68% 47%` in HSL)
- Ensure dark mode is set to `class` strategy in `tailwind.config.ts` so it's toggled via a CSS class

### Placeholder Home Page:
- Update `app/page.tsx` to display a simple centered page with the app name **"CollabNotes"** in large text and a short tagline: *"Real-time collaborative notes for your team."* This is temporary and will be replaced in a later sprint.

---

## README

Create a `README.md` at the root of the monorepo with the following sections:

1. **Project Overview** — What this app does in 2-3 sentences
2. **Tech Stack** — List frontend, backend, database, and real-time tech
3. **Getting Started** — Step-by-step instructions to run both apps locally:
   - Prerequisites: Node.js 18+, PostgreSQL running locally
   - How to clone and install dependencies for both apps
   - How to copy `.env.example` to `.env` and fill in values
   - Commands to start backend (`npm run start:dev`) and frontend (`npm run dev`)
4. **Project Structure** — Brief description of the monorepo folder layout
5. **Environment Variables** — Table listing every env variable for both apps with descriptions

Create a `.env.example` for both `backend/` and `frontend/` that mirrors their respective `.env` files but with empty or placeholder values.

---

## Definition of Done

- [ ] Running `npm run start:dev` in `backend/` starts the NestJS server on port 3001 with no errors
- [ ] `GET http://localhost:3001/api/health` returns `{ status: 'ok' }`
- [ ] Running `npm run dev` in `frontend/` starts the Next.js app on port 3000 with no errors
- [ ] `http://localhost:3000` shows the placeholder CollabNotes home page
- [ ] Tailwind and Shadcn/ui are working (Shadcn Button component renders correctly if added to the page)
- [ ] Both `.env.example` files exist
- [ ] `README.md` exists at the root with setup instructions

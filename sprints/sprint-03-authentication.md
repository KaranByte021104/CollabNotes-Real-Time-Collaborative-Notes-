# Sprint 3 — Authentication (Backend + Frontend)

## Goal
Implement a complete JWT-based authentication system. Users can register with a name, email, and password, and log in to receive a token. The frontend has polished login and register pages, an auth context, and route protection so unauthenticated users cannot access the app.

---

## Backend — Auth Module

Create a new NestJS module at `backend/src/auth/`.

### Dependencies to install:
- `@nestjs/jwt`
- `@nestjs/passport`
- `passport`
- `passport-jwt`
- `bcrypt`
- `@types/bcrypt`
- `@types/passport-jwt`

---

### AuthModule Setup

The `AuthModule` should import:
- `JwtModule.registerAsync()` — reads `JWT_SECRET` and sets `expiresIn: '7d'` from `ConfigService`
- `TypeOrmModule.forFeature([User])` — so the auth service can access the User repository
- `PassportModule`

Export `JwtModule` so other modules can use it if needed.

---

### AuthService (`auth.service.ts`)

Create a service with the following methods:

**`register(name, email, password)`**
- Check if a user with that email already exists. If so, throw a `ConflictException` with the message `"Email already in use"`.
- Hash the password using `bcrypt.hash(password, 10)`.
- Save the new user to the database.
- Generate and return a JWT token using the method below.
- Return: `{ access_token: string, user: { id, name, email } }`

**`login(email, password)`**
- Find the user by email. If not found, throw an `UnauthorizedException` with message `"Invalid credentials"`.
- Compare the provided password against the stored hash using `bcrypt.compare`. If it doesn't match, throw the same `UnauthorizedException`.
- Generate and return a JWT token.
- Return: `{ access_token: string, user: { id, name, email } }`

**`generateToken(user)`** (private helper)
- Signs a JWT payload of `{ sub: user.id, email: user.email, name: user.name }` using `JwtService.sign()`.

---

### DTOs

Create `register.dto.ts` with fields: `name` (string, required, min length 2), `email` (valid email format), `password` (string, min length 6). Use `class-validator` decorators.

Create `login.dto.ts` with fields: `email` (valid email), `password` (string, required).

---

### JWT Strategy (`jwt.strategy.ts`)

Create a Passport JWT strategy that:
- Extracts the JWT from the `Authorization: Bearer <token>` header
- Uses the `JWT_SECRET` from `ConfigService` to verify the token
- On success, returns `{ userId: payload.sub, email: payload.email, name: payload.name }` — this becomes `req.user` in any controller

---

### JwtAuthGuard (`jwt-auth.guard.ts`)

Create a simple guard that extends `AuthGuard('jwt')` from Passport. This guard will be applied to all protected routes.

---

### CurrentUser Decorator (`current-user.decorator.ts`)

Create a custom parameter decorator called `@CurrentUser()` that extracts `req.user` from the request. Controllers will use this to get the authenticated user without accessing `req` manually.

---

### AuthController (`auth.controller.ts`)

Create two endpoints:

**`POST /api/auth/register`**
- Accepts a `RegisterDto` body
- Calls `AuthService.register()`
- Returns `201` with `{ access_token, user }`

**`POST /api/auth/login`**
- Accepts a `LoginDto` body
- Calls `AuthService.login()`
- Returns `200` with `{ access_token, user }`

Both endpoints should return clear, consistent error responses. NestJS handles this automatically via exceptions, but make sure the error messages are human-readable.

---

## Frontend — Auth Pages

### Auth Context (`frontend/context/auth-context.tsx`)

Create a React context that wraps the entire app (add it to `app/layout.tsx`).

The context should expose:
- `user` — the current user object `{ id, name, email }` or `null` if not logged in
- `token` — the JWT string or `null`
- `login(email, password)` — calls the backend, stores token in `localStorage` as `collab_notes_token`, sets user state
- `register(name, email, password)` — same as above
- `logout()` — clears `localStorage`, resets user state, redirects to `/login`
- `isLoading` — `true` while the context is initializing (reading from `localStorage` on mount)

On mount, the context should:
1. Read the token from `localStorage`
2. If a token exists, decode it (use `jwt-decode` library) to get the user info and set the user state — this persists the session across page refreshes
3. Set `isLoading` to `false`

Install `jwt-decode`: `npm install jwt-decode`

---

### Middleware / Route Protection

Create a `frontend/middleware.ts` file using Next.js Middleware. It should:
- Check for the `collab_notes_token` cookie (or read from a cookie set alongside localStorage — see note below) on every request
- Redirect unauthenticated users from any `/dashboard` or `/workspace/*` route to `/login`
- Redirect authenticated users away from `/login` and `/register` to `/dashboard`

> **Note on token storage:** Store the JWT in both `localStorage` (for the Axios interceptor) AND as a non-httpOnly cookie (via `document.cookie`) when logging in. This allows the Next.js middleware to read it server-side for redirect logic. The cookie should have `path=/` and `SameSite=Lax`.

---

### Register Page (`app/(auth)/register/page.tsx`)

Design a clean, professional registration page:

**Layout:**
- Vertically and horizontally centered on the full screen
- A white card (`bg-white dark:bg-slate-900`) with rounded corners, a subtle shadow, and generous internal padding (p-8 or p-10)
- App logo/name **"CollabNotes"** at the top of the card in indigo, using a custom SVG icon (a simple overlapping documents or pencil icon) next to the text
- A short subtitle: *"Create your account to get started"* in muted text

**Form fields (in order):**
1. Full Name — text input with label
2. Email Address — email input with label
3. Password — password input with show/hide toggle icon button inside the field
4. A **"Create Account"** button (full width, indigo background) that shows a loading spinner when submitting

**Below the form:**
- A line: *"Already have an account? Sign in"* — "Sign in" is a link to `/login`

**Validation:**
- Use `react-hook-form` + `zod` for all validation
- Show inline error messages directly below each field in a small red text, not as a toast or alert box
- Validate: name ≥ 2 characters, valid email format, password ≥ 6 characters

**On submit:**
- Call `AuthContext.register()`
- If successful, redirect to `/dashboard`
- If the server returns an error (e.g. email already in use), display it below the form in a red `Alert` component from Shadcn

---

### Login Page (`app/(auth)/login/page.tsx`)

Same layout as the Register page. 

**Form fields:**
1. Email Address
2. Password (with show/hide toggle)
3. A **"Sign In"** button with loading state

**Below the form:**
- *"Don't have an account? Create one"* — link to `/register`

**Validation and errors:** Same approach as register page.

**On submit:**
- Call `AuthContext.login()`
- If successful, redirect to `/dashboard`
- Show server errors inline below the form

---

### Loading State

Create a full-screen loading component (`components/ui/full-screen-loader.tsx`) that shows a centered spinner with the app name. This should be shown in the root layout while `AuthContext.isLoading` is `true` so there's no flash of incorrect content (e.g. briefly showing the login page to a logged-in user).

---

## Definition of Done

- [ ] `POST /api/auth/register` creates a user and returns a JWT
- [ ] `POST /api/auth/login` validates credentials and returns a JWT
- [ ] Duplicate email registration returns a `409 Conflict` with a clear message
- [ ] Wrong password returns a `401 Unauthorized` with a clear message
- [ ] The Register page shows all three fields with inline validation errors
- [ ] The Login page works end-to-end — user can log in and the token is stored
- [ ] After login, navigating to `/login` redirects to `/dashboard`
- [ ] After logout (call `AuthContext.logout()`), navigating to `/dashboard` redirects to `/login`
- [ ] Page refresh on a protected route keeps the user logged in (session persists via localStorage)
- [ ] Password is never stored or returned in plain text

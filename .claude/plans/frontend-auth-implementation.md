# Plan: Frontend Authentication Implementation

## Problem

The backend JWT auth system is fully built (login, register, JWT strategy, global guard), but the frontend has **zero auth integration**:
- `ApiClient.fetch()` never sends an `Authorization` header
- No login/register page exists in the web app
- No token storage (localStorage/cookies)
- No auth context/provider wrapping the app
- No route protection — all pages are accessible without auth
- Client-side calls to protected endpoints (`/bot-instances`, `/user-context`) return 401

## Goal

Wire up the frontend to the existing backend auth system so users can register, log in, and access protected endpoints.

## Scope

- Login + Register pages
- Auth context provider (token storage, current user state)
- Token injection into all API calls
- Route protection (redirect to login if unauthenticated)
- Logout functionality

## Existing Backend Endpoints (no backend changes needed)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /auth/register` | `@Public()` | Create user, returns `{ accessToken, expiresIn, user }` |
| `POST /auth/login` | `@Public()` | Login, returns `{ accessToken, expiresIn, user }` |
| `GET /auth/me` | Protected | Get current user profile |

**JWT payload**: `{ sub: userId, username, role }` — 24h expiry.

---

## Implementation Steps

### Step 1: Add auth methods to ApiClient

**File**: `apps/web/src/lib/api.ts`

- Add a `setToken(token: string | null)` method that stores the token in a class field
- Add a `getToken()` method that returns the stored token
- Modify `private fetch()` to include `Authorization: Bearer <token>` when a token is set
- Add `login(username, password)` method → calls `POST /auth/login`
- Add `register(username, password)` method → calls `POST /auth/register`
- Add `getMe()` method → calls `GET /auth/me`
- Add `logout()` method → clears the stored token

### Step 2: Create AuthProvider context

**New file**: `apps/web/src/lib/auth-context.tsx`

- `AuthProvider` component wrapping the app
- State: `user` (id, username, role) | null, `isLoading`, `isAuthenticated`
- On mount: check localStorage for saved token → call `getMe()` to validate → set user state
- `login(username, password)` → call API → save token to localStorage → set user
- `register(username, password)` → call API → save token to localStorage → set user
- `logout()` → clear localStorage → clear user → redirect to `/login`
- Export `useAuth()` hook for components to consume

### Step 3: Create Login page

**New file**: `apps/web/src/app/login/page.tsx`

- Simple form: username + password inputs, submit button
- Link to register page
- On submit: call `useAuth().login()` → redirect to `/` on success
- Show error message on failure
- If already authenticated, redirect to `/`
- Use existing shadcn/ui components (Input, Button, Card)

### Step 4: Create Register page

**New file**: `apps/web/src/app/login/register/page.tsx`

- Form: username + password + confirm password
- Link back to login
- On submit: call `useAuth().register()` → redirect to `/` on success
- Client-side validation: password min 8 chars, passwords must match
- Use existing shadcn/ui components

### Step 5: Add AuthProvider to root layout

**File**: `apps/web/src/app/layout.tsx`

- Wrap children with `<AuthProvider>` (inside existing providers)
- AuthProvider must be a client component, so wrap it appropriately

### Step 6: Add route protection middleware

**New file**: `apps/web/src/middleware.ts`

- Next.js middleware that checks for auth token in localStorage (via cookie)
- **Revised approach**: Since middleware can't access localStorage, store token in an HTTP cookie as well
- Public routes: `/login`, `/login/register`, `/setup`
- All other routes: if no auth cookie → redirect to `/login`

**Alternative (simpler)**: Use client-side protection in AuthProvider:
- If `!isAuthenticated && !isLoading` and path is not `/login` or `/setup` → redirect to `/login`
- This avoids cookie complexity and keeps token in localStorage only

### Step 7: Update UserStageProvider

**File**: `apps/web/src/lib/user-stage-context.tsx`

- Make it auth-aware: only fetch `/user-context` when authenticated
- Currently fires on mount and gets 401 — should skip when no token

### Step 8: Add logout button to the app shell

- Add a logout button/menu to the main navigation/header
- Calls `useAuth().logout()`

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/lib/api.ts` | Modify | Add token management + auth methods to ApiClient |
| `apps/web/src/lib/auth-context.tsx` | Create | Auth context provider with login/register/logout |
| `apps/web/src/app/login/page.tsx` | Create | Login page |
| `apps/web/src/app/login/register/page.tsx` | Create | Register page |
| `apps/web/src/app/login/layout.tsx` | Create | Minimal layout for auth pages (no sidebar/nav) |
| `apps/web/src/app/layout.tsx` | Modify | Wrap with AuthProvider |
| `apps/web/src/lib/user-stage-context.tsx` | Modify | Skip fetch when not authenticated |
| Navigation component (TBD) | Modify | Add logout button |

## Testing Plan

1. **Register flow**: Go to `/login/register` → create account → verify redirect to `/` → verify protected API calls succeed
2. **Login flow**: Go to `/login` → enter credentials → verify redirect → verify token persisted across page reload
3. **Protected routes**: Access `/bots` without token → verify redirect to `/login`
4. **Public routes**: Access `/login` and `/setup` without token → verify no redirect
5. **Logout**: Click logout → verify token cleared → verify redirect to `/login`
6. **Token expiry**: Verify that expired token triggers redirect to login (401 response handling)
7. **Console errors**: Verify no more 401 errors in browser console for authenticated users

## Non-Goals (out of scope)

- Token refresh mechanism (24h expiry is fine for now)
- RBAC enforcement on frontend (roles exist but aren't used yet)
- "Remember me" / persistent sessions
- OAuth / social login
- Password reset flow

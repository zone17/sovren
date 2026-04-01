# Email Signup Feature Plan

**Date**: 2026-04-01
**Branch**: `feat/squad-b/FRE-20-email-signup`
**Depth**: Standard
**Status**: In Progress

## Decisions

1. **Password auth** (not magic link) -- simpler for closed alpha, no email deliverability dependency for local dev
2. **Separate accounts** -- email and NOSTR are independent auth methods. Account linking deferred to future sprint
3. **No auto NOSTR keypair** for email users -- they use Sovren as regular platform until they optionally connect NOSTR
4. **Supabase Auth** for email -- use `supabase.auth.signUp()` / `supabase.auth.signInWithPassword()` directly
5. **Email confirmation** -- handled by Supabase's built-in flow; add `/auth/callback` route for confirmation redirect

## Implementation Units

### Unit 1: AuthContext + realAuthService -- Email Auth Methods
- Add `signUpWithEmail()` and `signInWithEmail()` to `realAuthService` using Supabase client
- Update `AuthContext` to wire `login()` and `signup()` through to real Supabase email auth
- Add `authMethod` field to track how user authenticated ('email' | 'nostr')

### Unit 2: Login Page -- Email Tab
- Add auth mode selector (NOSTR / Email) to Login.tsx (matching pattern already in Signup.tsx)
- Email mode: email + password form with sign-in button
- Keep NOSTR as default tab

### Unit 3: Signup Page -- Wire Email Signup to Supabase
- Signup.tsx already has email form UI -- just needs the backend wiring to actually work
- Show success message after signup: "Check your email for confirmation link"

### Unit 4: Auth Callback Route
- Add `/auth/callback` page to handle Supabase email confirmation redirects
- Extract token from URL hash, call `supabase.auth.getSession()`
- Redirect to `/profile` on success

### Unit 5: Update Tests
- Fix Login.test.tsx to match actual rendered UI
- Add email auth flow tests
- Verify Signup.test.tsx still passes

## Files Changed

- `packages/frontend/src/features/auth/services/realAuthService.ts` -- add email methods
- `packages/frontend/src/features/auth/services/AuthContext.tsx` -- wire email auth
- `packages/frontend/src/pages/Login.tsx` -- add email login tab
- `packages/frontend/src/pages/Signup.tsx` -- wire email signup to Supabase
- `packages/frontend/src/pages/AuthCallback.tsx` -- new: email confirmation handler
- `packages/frontend/src/App.tsx` -- add `/auth/callback` route
- `packages/frontend/src/pages/Login.test.tsx` -- fix tests
- `packages/frontend/src/pages/Signup.test.tsx` -- update tests

---
title: 'Email Signup Auth Integration: Supabase + React Context Pitfalls'
date: 2026-04-01
category: workflow-issues
module: Authentication, Supabase Auth, React Context
problem_type: workflow_issue
component: authentication
severity: high
applies_when:
  - Adding email auth alongside existing NOSTR/custom auth
  - Using Supabase Auth with a React AuthContext
  - Implementing email confirmation flows
  - Building dual auth systems (email + crypto)
tags:
  - supabase-auth
  - email-signup
  - react-context
  - authentication
  - email-confirmation
  - ssrf
---

# Email Signup Auth Integration: Supabase + React Context Pitfalls

## Context

Adding email signup (Supabase Auth) to Sovren alongside existing NOSTR authentication. PR #219 shipped the feature, but CE review caught 3 P1s and 5 P2s — all in the auth integration layer, not in Supabase itself. The pitfalls are in how React context, email confirmation, and dual auth systems interact.

## Guidance

### 1. Don't Set `isAuthenticated` Before Email Confirmation

Supabase `signUp()` returns a user object even when email confirmation is required (with no session). If you unconditionally call `setUser(result.user)`, the user is `isAuthenticated: true` before confirming their email — bypassing all protected routes.

**Rule:** Check for a session/token before setting auth state. No session = no authentication, regardless of what the user object contains. Return `{ requiresConfirmation: true }` instead.

### 2. Email Confirmation Callback Must Update React State

Supabase persists the session to localStorage after email confirmation, but your React AuthContext doesn't know about it. If the callback page just calls `supabase.auth.getSession()` and redirects, the destination page's AuthContext still has `isAuthenticated: false`.

**Fix:** Use a hard redirect (`window.location.href`) to reinitialize the app, or explicitly call the context's auth refresh method from the callback.

### 3. `email_verified` Must Use `email_confirmed_at`, Not `email`

`supabaseUser.email` is always present after signup (it's the email they typed). `supabaseUser.email_confirmed_at` is null until they click the link. Using `!!email` for `email_verified` means every user appears verified immediately.

### 4. Demo Mode Must Mirror Production Auth Flow

If demo mode bypasses email confirmation (immediately logs user in), developers never test the confirmation UI. Bugs in the confirmation flow ship to production untested. Demo `signUpWithEmail` should return `requiresConfirmation: true` just like production.

### 5. Password Minimum for Payment Platforms: 8+ Characters

6 characters is trivially guessable. For platforms handling Bitcoin payments, 8 is minimum (NIST SP 800-63B), 12 is industry standard for 2026.

## Why This Matters

- P1-1 (unconfirmed user authenticated) is a **security bypass** — unverified emails can access payment features
- P1-2 (callback broken) means **email signup doesn't work end-to-end** — users confirm but can't log in
- Demo mode divergence means these bugs **aren't caught during development**

## When to Apply

- Any Supabase Auth integration with React context
- Any dual auth system (email + crypto/social/SSO)
- Any email confirmation flow where the app uses client-side auth state
- Any demo/dev mode that shortcuts auth flows

## Examples

**Auth state after signup — wrong vs right:**

```
// WRONG: user set regardless of confirmation
const result = await signUpWithEmail(email, password);
setUser(result.user);  // isAuthenticated = true before email confirmed!

// RIGHT: only set user when session exists
const result = await signUpWithEmail(email, password);
if (result.requiresConfirmation) {
  return { success: true, requiresConfirmation: true };  // show "check email" UI
}
setUser(result.user);  // only when session/token exists
```

**email_verified mapping — wrong vs right:**

```
// WRONG: always true when email exists
email_verified: !!supabaseUser.email

// RIGHT: true only after confirmation click
email_verified: !!supabaseUser.email_confirmed_at
```

## Related

- docs/solutions/workflow-issues/quality-sprint-five-learnings-20260331.md — SSRF and type safety learnings from the same sprint
- PRs: #219 (email signup), #223 (P2/P3 remediation)
- Supabase Auth docs: https://supabase.com/docs/guides/auth/passwords

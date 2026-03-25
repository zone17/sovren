---
status: pending
priority: p3
issue_id: '216'
tags: [code-review, pr-85, type-safety]
---

# ISupabaseClient Interface Returns any

## Problem Statement

ISupabaseClient interface has from(table: string): any and rpc(fn: string, params?: any): any. Returns any, defeating the purpose of DI type safety.

## Findings

- File: `packages/backend/src/interfaces/shared/ISupabaseClient.ts`
- `from(table: string): any` — returns untyped query builder
- `rpc(fn: string, params?: any): any` — returns untyped RPC result
- All downstream code using this interface loses type checking, allowing incorrect column names, wrong parameter types, and missing error handling to pass TypeScript compilation

## Proposed Solutions

1. Return a typed query builder interface (e.g., `PostgrestQueryBuilder<T>`) using generics: `from<T>(table: string): PostgrestQueryBuilder<T>`
2. Define table-specific type mappings and use conditional types or overloads to return the correct type per table name

## Acceptance Criteria

- [ ] `from()` and `rpc()` return typed results instead of `any`
- [ ] Consumers of ISupabaseClient get type checking on query builder chains (select, insert, update, delete)
- [ ] No new `any` types are introduced in the fix
- [ ] Existing code compiles without errors after the type change

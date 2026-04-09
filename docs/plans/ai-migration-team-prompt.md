# Team Prompt: AI Provider Migration (OpenAI → Anthropic)

Copy the prompt below and paste it into a new Claude Code session in the Sovren project directory.

---

```
/team-builder standard Implement the AI provider migration from OpenAI to Anthropic Claude API.

## Context

Read the full plan at docs/plans/ai-provider-migration-plan.md — it has the complete audit, file list, code examples, and definition of done.

The short version: Our AI services (ai-recommendation-service.ts, ai-enhanced-features-service.ts) are configured for OpenAI GPT-4 but are 90% unimplemented stubs. We're building them on Anthropic's Claude API instead — 85-97% cheaper, with prompt caching, structured outputs (GA), and Batch API for offline workloads.

## What to build

1. **Provider abstraction layer** — Add AI_PROVIDER, ANTHROPIC_API_KEY, AI_MODEL_FAST, AI_MODEL_SMART to environment config (packages/shared/src/config/environment.ts and packages/backend/src/utils/env-validation.ts). Keep OPENAI_API_KEY as deprecated alias.

2. **Anthropic client module** — New file packages/backend/src/services/ai/anthropic-client.ts. Singleton @anthropic-ai/sdk client. System prompts use cache_control for prompt caching.

3. **Implement stub methods** using Claude API:
   - Content tagging (US-103): extractAITags(), extractRuleBasedTags() → Haiku 4.5 with structured outputs
   - Topic extraction (US-104): runTopicExtraction(), generateTopicHierarchy() → Haiku 4.5
   - Recommendations (US-095-098): generateHybridRecommendations() and sub-methods → Sonnet 4.6
   - All Claude API calls MUST use structured outputs (tool_choice with JSON schema) — no raw text parsing

4. **Batch API wrapper** — New file packages/backend/src/services/ai/batch-processor.ts for performContentClustering() and bulk tagging backfills. 50% cost savings on offline work.

5. **Frontend type updates**:
   - packages/frontend/src/types/content.ts:20 — change 'claude-3' to 'claude-4.5' in generated_by union
   - packages/frontend/src/store/slices/unifiedCmsSlice.ts:216 — change default model from 'gpt-4'
   - packages/frontend/lib/config/environment.ts — add AI_PROVIDER support

6. **Tests** — Unit tests for anthropic-client.ts, each implemented method, batch processor. Integration tests with mocked Anthropic responses.

## Model selection rules

- Haiku 4.5 (claude-haiku-4-5-20251001) — classification, extraction, tagging, similarity. $1/$5 per M tokens.
- Sonnet 4.6 (claude-sonnet-4-6-20250514) — reasoning, recommendations, multi-step orchestration. $3/$15 per M tokens.
- Never use Opus for these services — it's 5x the cost of Sonnet with no benefit for structured tasks.

## Critical patterns to follow

- Read docs/solutions/patterns/critical-patterns.md before writing any service code
- Pattern #2: Service-layer authorization on all data access methods
- Pattern #4: Non-atomic multi-table writes need RPC or compensating tx
- Pattern #6: SSRF validation if any user-supplied URLs reach the AI service
- Pattern #13 (common): Promise.allSettled for batch operations

## Branch

Create branch: feat/squad-a/SOV-ai-provider-migration

## Definition of done

See section 8 of docs/plans/ai-provider-migration-plan.md — all checkboxes must pass.
```

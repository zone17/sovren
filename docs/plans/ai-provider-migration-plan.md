# Plan: AI Provider Migration — OpenAI → Anthropic Claude API

> **Source**: Anthropic Daily Intelligence Report (2026-04-09)
> **Date**: 2026-04-09
> **Status**: Ready for implementation
> **Priority**: High — cost savings + alignment with toolchain
> **Estimated effort**: 3-5 days (1 engineer + review)

---

## 1. Problem Statement

Sovren's AI services (`ai-recommendation-service.ts`, `ai-enhanced-features-service.ts`) are configured for OpenAI (GPT-4, text-embedding-ada-002) but are **90% unimplemented stubs**. The environment config hardcodes `OPENAI_MODEL: 'gpt-4'` at $30/$60 per M tokens.

Since the services haven't been built yet, this is the ideal migration window. Building on Anthropic Claude API instead gives us:

- **~85% cost reduction** on classification/extraction tasks (Haiku 4.5 at $1/$5 vs GPT-4 at $30/$60)
- **Prompt caching** (up to 90% savings on repeated system prompts)
- **Structured outputs** (GA — eliminates JSON parsing failures)
- **Batch API** for offline workloads (50% additional savings + 300K output tokens)
- **Toolchain alignment** — development already runs on Claude Code / Anthropic models

---

## 2. Current State Audit

### Files with OpenAI references (production code only)

| File | Reference | Status |
|------|-----------|--------|
| `packages/shared/src/config/environment.ts:78-80` | `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4`), `OPENAI_MAX_TOKENS` | Env config |
| `packages/backend/src/utils/env-validation.ts:144-147` | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_MAX_TOKENS`, `OPENAI_TEMPERATURE` | Env validation |
| `packages/backend/src/services/ai-recommendation-service.ts:34,49,517` | `openaiApiKey`, `text-embedding-ada-002` | Service config (stubs) |
| `packages/backend/src/services/ai-enhanced-features-service.ts:39,1091` | `openaiApiKey` | Service config (stubs) |
| `packages/backend/src/types/ai-recommendations.ts:397` | `openai_api_key` | Type def |
| `packages/frontend/src/types/content.ts:20` | `'claude-3'` in `generated_by` union type | Type only — update to `'claude-4'` |
| `packages/frontend/src/types/content.ts:268` | `provider: 'openai' \| 'anthropic' \| ...` | Already supports anthropic |
| `packages/frontend/src/store/slices/unifiedCmsSlice.ts:216` | `model: 'gpt-4'` | Default in store |
| `packages/frontend/lib/config/environment.ts:41,231,233,316` | `OPENAI_API_KEY`, `isOpenAIConfigured`, `isAnthropicConfigured` | Already supports both |
| `packages/shared/src/config/environment-configs.ts:87,164` | `OPENAI_API_KEY` in required vars | Env config |
| `packages/testing/src/unit-testing/ai/AITestGenerator.ts:39` | `model: 'gpt-4-turbo'` | Test infra |
| `packages/testing/src/e2e-testing/E2ETestingFramework.ts:356` | `model: 'gpt-4'` | Test infra |

### Stub methods requiring implementation

**ai-recommendation-service.ts** — 12 stubs:
- `storeRecommendations()`, `enrichRecommendations()`, `calculatePersonalizationScore()`
- `processBehaviorForLearning()`, `analyzeBehaviorPatterns()`, `generateBehaviorBasedRecommendations()`
- `getContentDetails()`, `findSimilarContent()`, `processFeedbackForLearning()`
- `updateRecommendationMetrics()`, `processFeedbackAnalytics()`, `analyzeBehaviorData()`
- `getContentBasedRecommendations()`, `getCollaborativeRecommendations()`, `getBehaviorBasedRecommendations()`, `getTrendingRecommendations()`

**ai-enhanced-features-service.ts** — 10+ stubs:
- `extractAITags()`, `extractRuleBasedTags()`, `extractCollaborativeTags()`
- `runTopicExtraction()`, `generateTopicHierarchy()`
- `extractContentFeatures()`, `runClusteringAlgorithm()`, `calculateClusterQuality()`
- All `generate*Suggestions()` methods

---

## 3. Implementation Plan

### Phase 1: Provider Abstraction (Day 1)

#### 3.1a — Add provider-agnostic environment config

Update `packages/shared/src/config/environment.ts`:
```
AI_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic')
AI_API_KEY: z.string().optional()          // replaces OPENAI_API_KEY
AI_MODEL: z.string().default('claude-haiku-4-5-20251001')  // replaces OPENAI_MODEL
AI_MAX_TOKENS: z.coerce.number().default(4096)
```

Keep `OPENAI_API_KEY` as a deprecated alias that maps to `AI_API_KEY` when `AI_PROVIDER=openai`.

Mirror changes in `packages/backend/src/utils/env-validation.ts`.

#### 3.1b — Create Anthropic client module

New file: `packages/backend/src/services/ai/anthropic-client.ts`
```typescript
import Anthropic from '@anthropic-ai/sdk';

// Singleton client with prompt caching enabled
// System prompts cached with 1-hour TTL for classification tasks
```

**Dependency**: `npm install @anthropic-ai/sdk` in `packages/backend`

#### 3.1c — Update service config interfaces

In both AI services, change:
```typescript
// Before
interface AIServiceConfig {
  openaiApiKey?: string;
  embeddingModel?: string;
}

// After
interface AIServiceConfig {
  aiProvider: 'anthropic' | 'openai';
  aiApiKey?: string;
  aiModel?: string;
}
```

### Phase 2: Implement Stub Methods with Claude API (Days 2-3)

#### Model selection by task type

| Task | Model | Reasoning |
|------|-------|-----------|
| Content tagging (`extractAITags`) | Haiku 4.5 | Classification — fast, cheap |
| Topic extraction (`runTopicExtraction`) | Haiku 4.5 | Extraction — structured output |
| Content similarity (`findSimilarContent`) | Haiku 4.5 | Similarity scoring |
| Personalized recommendations (`generateHybridRecommendations`) | Sonnet 4.6 | Needs reasoning |
| Behavior analysis (`analyzeBehaviorPatterns`) | Haiku 4.5 | Pattern matching |
| Content enhancement orchestrator (`enhanceContent`) | Sonnet 4.6 | Multi-step reasoning |

#### Structured outputs (GA)

All Claude API calls should use structured outputs with JSON schema. Example for content tagging:

```typescript
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system: [{
    type: 'text',
    text: TAGGING_SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' }  // 5-min cache
  }],
  messages: [{ role: 'user', content: contentText }],
  // Structured output — no parsing failures
  tool_choice: { type: 'tool', name: 'generate_tags' },
  tools: [{
    name: 'generate_tags',
    description: 'Generate content tags',
    input_schema: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tag: { type: 'string' },
              confidence: { type: 'number' },
              category: { type: 'string', enum: ['topic', 'keyword', 'sentiment'] },
              reasoning: { type: 'string' }
            },
            required: ['tag', 'confidence', 'category']
          }
        }
      },
      required: ['tags']
    }
  }]
});
```

#### Prompt caching strategy

| System prompt | Cache TTL | Rationale |
|--------------|-----------|-----------|
| Content tagging instructions | 1 hour | Same instructions for all content |
| Topic extraction instructions | 1 hour | Same NLP extraction rules |
| Recommendation system prompt | 5 min (default) | User context varies |

Mark system prompts with `cache_control: { type: 'ephemeral' }`. For 1-hour caching, use the new extended TTL option.

### Phase 3: Batch API for Offline Workloads (Day 4)

Content clustering and bulk tagging backfills are not real-time. Use the Message Batches API:

```typescript
const batch = await client.batches.create({
  requests: contentItems.map((item, i) => ({
    custom_id: `tag-${item.id}`,
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: item.text }]
    }
  }))
});
// Poll for results, 50% cost savings
```

**Applicable methods**:
- `performContentClustering()` — batch all content feature extraction
- Bulk `generateContentTags()` — backfill tags for existing content
- `calculateContentSimilarity()` matrix — pairwise comparisons

### Phase 4: Frontend + Type Updates (Day 4-5)

- Update `content.ts:20` — `generated_by` type: `'claude-3'` → `'claude-4.5'`
- Update `unifiedCmsSlice.ts:216` — default model: `'gpt-4'` → `'claude-haiku-4-5-20251001'`
- Update `frontend/lib/config/environment.ts` — add `AI_PROVIDER` / `AI_API_KEY` support
- Add `ANTHROPIC_API_KEY` to `.env.example` files

---

## 4. Cost Projections

### Per-request estimates (content tagging — most common operation)

| Provider | Model | Input (1K tokens) | Output (200 tokens) | Total |
|----------|-------|-------------------|---------------------|-------|
| OpenAI | GPT-4 | $0.030 | $0.012 | $0.042 |
| Anthropic | Haiku 4.5 | $0.001 | $0.001 | $0.002 |
| Anthropic | Haiku 4.5 + cache hit | $0.0001 | $0.001 | $0.0011 |

**Savings**: 95% uncached, 97% with prompt caching

### Monthly projection (10K content items/month)

| Scenario | OpenAI GPT-4 | Anthropic Haiku 4.5 | Anthropic + Cache |
|----------|-------------|---------------------|-------------------|
| Tagging (10K) | $420 | $20 | $11 |
| Topic extraction (10K) | $420 | $20 | $11 |
| Recommendations (50K) | $2,100 | $100 | $55 |
| Batch clustering (monthly) | $210 | $10 | $5 (+ 50% batch) |
| **Total** | **$3,150** | **$150** | **~$85** |

---

## 5. Environment Variable Changes

### New variables

```env
# AI Provider Configuration
AI_PROVIDER=anthropic                    # 'anthropic' or 'openai'
ANTHROPIC_API_KEY=sk-ant-...            # Required when AI_PROVIDER=anthropic
AI_MODEL_FAST=claude-haiku-4-5-20251001  # Classification, extraction
AI_MODEL_SMART=claude-sonnet-4-6-20250514  # Reasoning, recommendations
AI_BATCH_ENABLED=true                    # Use Batch API for offline workloads
```

### Deprecated (keep for backwards compat)

```env
OPENAI_API_KEY=       # Maps to AI_API_KEY when AI_PROVIDER=openai
OPENAI_MODEL=         # Maps to AI_MODEL_SMART when AI_PROVIDER=openai
OPENAI_MAX_TOKENS=    # Maps to AI_MAX_TOKENS
OPENAI_TEMPERATURE=   # Anthropic uses top_p instead
```

---

## 6. Testing Strategy

- Unit tests for `anthropic-client.ts` — mock SDK responses
- Integration tests for each implemented stub method
- Verify structured output schema validation
- Test prompt caching behavior (cache hit vs miss)
- Test Batch API polling and result processing
- Test backwards compat: `AI_PROVIDER=openai` still works with existing config

---

## 7. Files to Create/Modify

### New files
- `packages/backend/src/services/ai/anthropic-client.ts` — shared client
- `packages/backend/src/services/ai/content-tagger.ts` — US-103 implementation
- `packages/backend/src/services/ai/topic-extractor.ts` — US-104 implementation
- `packages/backend/src/services/ai/recommendation-engine.ts` — US-095-098 implementation
- `packages/backend/src/services/ai/batch-processor.ts` — Batch API wrapper
- `packages/backend/src/services/ai/index.ts` — barrel exports

### Modified files
- `packages/shared/src/config/environment.ts` — add AI_PROVIDER, ANTHROPIC_API_KEY
- `packages/backend/src/utils/env-validation.ts` — mirror env changes
- `packages/backend/src/services/ai-recommendation-service.ts` — delegate to new modules
- `packages/backend/src/services/ai-enhanced-features-service.ts` — delegate to new modules
- `packages/backend/src/types/ai-recommendations.ts` — update config types
- `packages/frontend/src/types/content.ts` — update generated_by union
- `packages/frontend/src/store/slices/unifiedCmsSlice.ts` — update default model
- `packages/frontend/lib/config/environment.ts` — add AI_PROVIDER support
- `packages/shared/src/config/environment-configs.ts` — add ANTHROPIC_API_KEY
- `packages/backend/package.json` — add `@anthropic-ai/sdk` dependency

---

## 8. Definition of Done

- [ ] `@anthropic-ai/sdk` installed in backend package
- [ ] Provider-agnostic env config with backwards compat
- [ ] Anthropic client singleton with prompt caching
- [ ] All tagging stubs implemented (US-103) with Haiku 4.5
- [ ] All topic extraction stubs implemented (US-104) with Haiku 4.5
- [ ] Recommendation stubs implemented (US-095-098) with Sonnet 4.6
- [ ] Batch API wrapper for clustering and bulk operations
- [ ] Structured outputs on all Claude API calls
- [ ] Unit tests for all new modules
- [ ] Integration tests with mocked Anthropic responses
- [ ] Frontend type updates (`generated_by`, default model)
- [ ] `.env.example` updated with new variables
- [ ] CHANGELOG.md entry
- [ ] All quality gates passing

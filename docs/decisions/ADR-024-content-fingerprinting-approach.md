# ADR-024: Content Fingerprinting Approach

> **Note:** Originally numbered ADR-020 in `docs/adr/`. Renumbered to ADR-024 here because ADR-020
> in `docs/decisions/` is `ADR-020-rest-zod-api-contract-standard.md` (a different decision).


## Status

Accepted

## Date

2026-02-15

## Context

EPIC-008 (Content Shield) requires content fingerprinting (US-E8-003) to detect copies of creator content across the NOSTR relay network. The fingerprinting system must:

1. **Detect near-duplicates** — Not just exact copies, but paraphrased text and resized/cropped images
2. **Be fast** — Fingerprinting happens at content publish time; comparison runs in batch scans
3. **Be compact** — Hashes stored in the database and compared at scale
4. **Support text and images** — The two primary content types on Sovren
5. **Be non-reversible** — Hashes cannot reconstruct the original content

We considered:

- **A) Cryptographic hashes (SHA-256)**: Fast, compact, but only detects exact byte-identical copies. Useless for paraphrased text or resized images.
- **B) SimHash (text) + pHash (images)**: Locality-sensitive hashing that preserves similarity. Near-duplicates produce similar hashes. Industry standard for plagiarism detection.
- **C) Embedding-based similarity (ML)**: Generate vector embeddings and compute cosine similarity. Most accurate but requires ML inference, large storage (768+ dimensions), and is computationally expensive for batch scanning.
- **D) MinHash + LSH**: Good for set-based similarity (shingles) but overkill for our use case and harder to implement for images.

## Decision

**Option B: SimHash for text content + pHash for images.**

### Text Fingerprinting: SimHash

SimHash produces a fixed-size hash (64-bit) where similar documents produce similar hashes. The Hamming distance between two SimHash values correlates with document similarity.

**Algorithm:**

1. Tokenize text into word-level n-grams (bigrams)
2. Hash each n-gram with a standard hash function
3. For each bit position, sum +1 for 1-bits and -1 for 0-bits across all n-gram hashes
4. Final hash: bit is 1 if sum > 0, else 0

**Similarity calculation:**

- Hamming distance between two 64-bit SimHash values
- Similarity = 1 - (hamming_distance / 64)
- Threshold: >0.95 = exact copy, 0.70-0.95 = derivative, <0.70 = coincidental

**Implementation:** Custom TypeScript implementation (~100 lines). No native dependencies needed. We use `bigrams` for n-grams and FNV-1a for the per-gram hash (fast, well-distributed).

**Preprocessing:**

1. Strip HTML/markdown formatting
2. Normalize whitespace
3. Convert to lowercase
4. Remove stop words (optional, configurable)
5. Then generate bigrams and compute SimHash

### Image Fingerprinting: pHash (Perceptual Hash)

pHash produces a 64-bit hash where visually similar images produce similar hashes, even after resizing, compression, or minor edits.

**Algorithm:**

1. Resize image to 32x32 grayscale
2. Apply DCT (Discrete Cosine Transform)
3. Take top-left 8x8 DCT coefficients (low frequency)
4. Compute median of DCT values
5. Each bit: 1 if coefficient > median, else 0

**Similarity calculation:**

- Hamming distance between two 64-bit pHash values
- Similarity = 1 - (hamming_distance / 64)
- Same thresholds as text

**Implementation:** Use `sharp` (already in the dependency tree) for image resizing and grayscale conversion. Custom DCT + hash computation in TypeScript (~80 lines). Alternatively, use `phash-image` npm package if available and maintained.

### Storage

Both hash types produce 64-bit values, stored as 16-character hex strings in the `content_fingerprints` table. This is compact and indexable.

### Batch Scanning

The NOSTR relay scanner (US-E8-004a) computes fingerprints for incoming content and compares against the creator's registry:

1. Receive NOSTR event from relay subscription
2. Extract text content or image attachment
3. Compute SimHash or pHash
4. For each creator who has opted into scanning: compare against their fingerprint registry
5. If similarity > creator's threshold: create `content_alert`

**Optimization for scale:**

- Bloom filter pre-check: Before comparing all fingerprints, check a bloom filter of known hash prefixes to quickly eliminate non-matches
- Indexed `(hash_type, hash_value)` column for fast lookups
- Batch comparison: process relay events in batches of 100
- Rate limiting per relay to avoid bans

## Consequences

**Positive:**

- Lightweight: Both algorithms are O(n) where n is content length, with constant-size output
- No ML dependencies: Pure algorithmic approach with no inference costs
- Proven: SimHash and pHash are well-established in production systems (Google, TinEye)
- Compact storage: 16 hex chars per fingerprint vs 768+ floats for embeddings
- Fast comparison: Hamming distance is a single XOR + popcount operation

**Negative:**

- Lower accuracy than ML embeddings for semantic similarity (paraphrased content with different words)
- pHash struggles with heavy image manipulation (cropping >50%, overlay text, color inversion)
- SimHash is order-sensitive (shuffled paragraphs may not match)
- No video fingerprinting in v1 (text and images only)

**Mitigation:**

- For text: Combine SimHash with additional checks (Jaccard similarity on shingle sets) for borderline cases
- For images: Use multiple hash sizes (8x8 and 16x16 DCT) to catch more manipulation types
- Future: Add ML embedding layer as a second-pass verification for high-confidence alerts
- Video fingerprinting deferred to Phase 9+ (extract keyframes and apply pHash)

## References

- Charikar, M. (2002). "Similarity estimation techniques from rounding algorithms." STOC 2002.
- Zauner, C. (2010). "Implementation and Benchmarking of Perceptual Image Hash Functions." University of Applied Sciences Hagenberg.

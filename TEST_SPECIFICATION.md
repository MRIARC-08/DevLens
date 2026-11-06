# DevLens Architectural Guardrail Test Specification
**Project:** DevLens (`MRIARC-08/DevLens`)  
**Watchdog Bot:** `biscuitt-hemlooo[bot]` (Powered by Biscuit & Switch Gateway)  
**Evaluation Standard:** MADR 3.0 Four-Invariant Authorization Contract

---

## 1. Overview & Verification Architecture

Biscuit is an architectural decision guardrail for GitHub repositories. Unlike superficial linters or heuristic bots that trigger on file name keywords, Biscuit enforces a mathematically grounded **Four-Invariant Authorization Contract** before any warning may be published to a Pull Request.

If any invariant fails, the bot **abstains** (`ABSTAINED_UNCERTAIN`) or reports **no match** (`NO_REJECTED_MATCH`), ensuring **zero false alarms** on benign refactors.

### The Four Authorization Invariants

```
                ┌──────────────────────────────────────┐
                │        Candidate Pull Request        │
                └──────────────────┬───────────────────┘
                                   │
                                   ▼
          ┌──────────────────────────────────────────────────┐
          │ 1. DECISION_STATE Invariant                      │
          │    Is the matching alternative authoritatively   │
          │    marked as REJECTED in an accepted MADR?       │
          └────────────────────────┬─────────────────────────┘
                                   │ YES
                                   ▼
          ┌──────────────────────────────────────────────────┐
          │ 2. AUTHORITATIVE_RULING Invariant                │
          │    Is there a VERIFIED_EXACT text quotation by   │
          │    a core maintainer (@MRIARC-08) with quorum?   │
          └────────────────────────┬─────────────────────────┘
                                   │ YES
                                   ▼
          ┌──────────────────────────────────────────────────┐
          │ 3. ALTERNATIVE_CODE_ANCHOR Invariant             │
          │    Does the PR diff touch the active code anchor │
          │    bound to this rejected alternative?           │
          └────────────────────────┬─────────────────────────┘
                                   │ YES
                                   ▼
          ┌──────────────────────────────────────────────────┐
          │ 4. AST_STRUCTURAL_EQUIVALENCE Invariant          │
          │    Does the added code AST contain the masked-    │
          │    AST fingerprint of the rejected construct?    │
          └────────────────────────┬─────────────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  │ YES                             │ NO (e.g. Benign Refactor)
                  ▼                                 ▼
       ┌─────────────────────┐           ┌─────────────────────┐
       │ WARNING_AUTHORIZED  │           │ ABSTAINED_UNCERTAIN │
       │ (Comment Published) │           │   (Bot Is Silent)   │
       └─────────────────────┘           └─────────────────────┘
```

---

## 2. Phase 3 & Phase 4 Execution Instructions (For User)

As requested, you are executing Phase 3 and Phase 4 yourself. Here are the exact commands and operational flow:

### Phase 3: Knowledge Extraction (GitHub -> MADR Records)

To ingest the deliberation history from GitHub issues (#1 through #24) into structured Architectural Decision Records:

```bash
cd /Users/adarshchauhan/Downloads/biscuit

# Run the 4-Pass LLM Extraction Pipeline against DevLens:
uv run biscuit extract \
  --repo MRIARC-08/DevLens \
  --output docs/decisions \
  --format madr
```

**Expected Extraction Artifacts:**
- Structured MADR markdown files populated in `DevLens/docs/decisions/` (e.g., `ADR-001-ast-parsing.md`, `ADR-003-redis-caching.md`, etc.).
- SQLite / Postgres decision store populated with alternatives, code anchors, and verbatim evidence spans signed by `@MRIARC-08`.

---

### Phase 4: Bot Watchdog Evaluation

When evaluating a PR (or simulating via FastMCP / CLI):

```bash
cd /Users/adarshchauhan/Downloads/biscuit

# To run the watchdog evaluation against a PR diff or branch:
uv run biscuit watchdog evaluate \
  --repo MRIARC-08/DevLens \
  --pr <PR_NUMBER>
```

Or to run the interactive FastMCP server / Switch gateway listener:
```bash
uv run biscuit watchdog serve
```

---

## 3. Test Cases & Expected Bot Outputs

Use this specification to compare the bot's actual return against the expected rubric.

---

### Test Case A: True Positive (Direct Re-introduction of Rejected Babel AST)

- **Target File:** `src/lib/pipeline/parser.ts`
- **Scenario:** A contributor opens a PR replacing the regex parser with `@babel/parser` and `@babel/traverse`.
- **Violated Deliberation:** Issue #1 (`rfc: AST parsing architecture for repository file analysis`)
- **PR Code Modification:**
  ```typescript
  import { parse } from '@babel/parser';
  import traverse from '@babel/traverse';

  export function parseSourceFile(code: string, filename: string) {
    const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    traverse(ast, {
      ImportDeclaration(path) {
        // extract imports
      }
    });
  }
  ```

#### Expected Invariant Check Breakdown:
| Invariant | Expected Status | Detail / Reason |
| :--- | :---: | :--- |
| `DECISION_STATE` | **PASS (Satisfied)** | `lifecycle_status` is `REJECTED` in ADR-001. |
| `AUTHORITATIVE_RULING` | **PASS (Satisfied)** | `VERIFIED_EXACT` ruling quote by `@MRIARC-08` under `CORE_MAINTAINER_CONSENSUS`. |
| `ALTERNATIVE_CODE_ANCHOR` | **PASS (Satisfied)** | Touches active anchor `src/lib/pipeline/parser.ts`. |
| `AST_STRUCTURAL_EQUIVALENCE` | **PASS (Satisfied)** | Added code AST matches the rejected Babel parser/traverse construct. |

#### Expected Watchdog Return:
- **Verdict:** `WARNING_AUTHORIZED`
- **Action:** `COMMENT_PUBLISHED`
- **Expected Bot Output Citation:**
  > "We reject the full Babel AST parser alternative because its memory allocation model conflicts with Vercel serverless execution limits (exceeds 1024MB causing OOM crashes)." — `@MRIARC-08` (DevLens Issue #1)

---

### Test Case B: Hard Negative (Benign Regex Refactor in the Same File)

- **Target File:** `src/lib/pipeline/parser.ts`
- **Scenario:** A developer refactors `parser.ts` to add regex memoization or docstrings. They touch the exact file where Babel was rejected, but do **NOT** reintroduce Babel.
- **PR Code Modification:**
  ```typescript
  // Memoize regex compilation for performance
  const IMPORT_STATEMENT_REGEX = /import\s+([\s\S]*?)\s+from\s+['"](.*?)['"]/g;
  const EXPORT_STATEMENT_REGEX = /export\s+([\s\S]*?)\s+from\s+['"](.*?)['"]/g;

  export function parseSourceFileFast(code: string) {
    // Optimized line scan using accepted regex approach
    return [...code.matchAll(IMPORT_STATEMENT_REGEX)];
  }
  ```

#### Expected Invariant Check Breakdown:
| Invariant | Expected Status | Detail / Reason |
| :--- | :---: | :--- |
| `DECISION_STATE` | **PASS (Satisfied)** | ADR-001 exists with a rejected alternative. |
| `AUTHORITATIVE_RULING` | **PASS (Satisfied)** | Ruling exists for ADR-001. |
| `ALTERNATIVE_CODE_ANCHOR` | **PASS (Satisfied)** | Touches `src/lib/pipeline/parser.ts`. |
| `AST_STRUCTURAL_EQUIVALENCE` | **FAIL (Not Satisfied)** | Added code is **not** structurally equivalent to the rejected Babel construct (benign refactor). |

#### Expected Watchdog Return:
- **Verdict:** `ABSTAINED_UNCERTAIN`
- **Action:** `LOGGED_ONLY` (Bot remains silent; **NO comment posted**)
- **Critical Verification Point:** Verify that the bot does **NOT** post a false warning just because `parser.ts` was edited!

---

### Test Case C: True Positive (In-Memory LRU Cache in Serverless Handler)

- **Target File:** `src/lib/pipeline/resolver.ts`
- **Scenario:** A PR introduces `new LRUCache()` in module scope to cache resolved dependency trees.
- **Violated Deliberation:** Issue #4 (`rfc: In-Memory Node Cache vs Distributed Upstash Redis REST`)
- **PR Code Modification:**
  ```typescript
  import { LRUCache } from 'lru-cache';

  const graphCache = new LRUCache<string, any>({
    max: 500,
    ttl: 1000 * 60 * 60,
  });

  export function resolveGraphWithCache(repoId: string) {
    if (graphCache.has(repoId)) return graphCache.get(repoId);
    // compute...
  }
  ```

#### Expected Invariant Check Breakdown:
| Invariant | Expected Status | Detail / Reason |
| :--- | :---: | :--- |
| `DECISION_STATE` | **PASS (Satisfied)** | In-memory module cache is `REJECTED`. |
| `AUTHORITATIVE_RULING` | **PASS (Satisfied)** | `VERIFIED_EXACT` ruling quote by `@MRIARC-08`. |
| `ALTERNATIVE_CODE_ANCHOR` | **PASS (Satisfied)** | Touches `src/lib/pipeline/resolver.ts`. |
| `AST_STRUCTURAL_EQUIVALENCE` | **PASS (Satisfied)** | Masked AST subtree matches `new LRUCache` instantiation. |

#### Expected Watchdog Return:
- **Verdict:** `WARNING_AUTHORIZED`
- **Action:** `COMMENT_PUBLISHED`
- **Expected Bot Output Citation:**
  > "We strictly reject the in-memory module-level LRU cache alternative in serverless handlers because its memory model causes container memory bloat and cannot synchronize state across serverless lambda instances." — `@MRIARC-08` (DevLens Issue #4)

---

### Test Case D: Accepted Alternative Implementation (Upstash Redis REST)

- **Target File:** `src/lib/pipeline/resolver.ts`
- **Scenario:** A PR implements the *accepted* recommendation from Issue #4 using Upstash Redis over REST.
- **PR Code Modification:**
  ```typescript
  import { Redis } from '@upstash/redis';

  const redis = Redis.fromEnv();

  export async function getCachedGraph(repoId: string) {
    return await redis.get(`graph:${repoId}`);
  }
  ```

#### Expected Invariant Check Breakdown:
| Invariant | Expected Status | Detail / Reason |
| :--- | :---: | :--- |
| `DECISION_STATE` | **FAIL (Not Satisfied)** | Upstash Redis REST lifecycle status is `ACCEPTED`, not `REJECTED`. |
| `AUTHORITATIVE_RULING` | N/A | Not applicable for accepted alternative. |
| `ALTERNATIVE_CODE_ANCHOR` | Touches anchor | Matches accepted alternative anchor. |
| `AST_STRUCTURAL_EQUIVALENCE` | N/A | No rejected construct found. |

#### Expected Watchdog Return:
- **Verdict:** `NO_REJECTED_MATCH` (or `ALTERNATIVE_MISMATCH`)
- **Action:** `LOGGED_ONLY` (Silent approval; no warning)

---

### Test Case E: Hard Negative (Unverified Contributor Non-Ruling - Strict Mode)

- **Target File:** `tsconfig.json`
- **Scenario:** A PR sets `"strict": false` in `tsconfig.json`.
- **Referenced Deliberation:** Issue #22 (`rfc: Contributor Proposal: Disabling TypeScript Strict Mode`)
- **PR Code Modification:**
  ```json
  {
    "compilerOptions": {
      "strict": false
    }
  }
  ```

#### Expected Invariant Check Breakdown:
| Invariant | Expected Status | Detail / Reason |
| :--- | :---: | :--- |
| `DECISION_STATE` | **FAIL (Not Satisfied)** | Discussion was closed as stale; no accepted MADR record with `REJECTED` status. |
| `AUTHORITATIVE_RULING` | **FAIL (Not Satisfied)** | Only informal contributor comments exist (`@quick-hacker`); no maintainer ruling or consensus quorum. |
| `ALTERNATIVE_CODE_ANCHOR` | Touches anchor | `tsconfig.json`. |
| `AST_STRUCTURAL_EQUIVALENCE` | N/A | Invariant 1 and 2 failed. |

#### Expected Watchdog Return:
- **Verdict:** `ABSTAINED_UNCERTAIN`
- **Action:** `LOGGED_ONLY` (Bot remains silent; model inference never invents authority)
- **Critical Verification Point:** Proves the bot cannot be gaslit into posting warnings based on informal contributor complaints.

---

### Test Case F: Security Invariant True Positive (LocalStorage Session Token)

- **Target File:** `src/hooks/use-auth.ts` or `src/app/api/auth/`
- **Scenario:** A PR attempts to store the user's JWT auth token in `localStorage`.
- **Violated Deliberation:** Issue #7 (`rfc: User Session Authentication: Browser LocalStorage JWT vs HttpOnly Secure JWE Cookie`)
- **PR Code Modification:**
  ```typescript
  export function saveSession(token: string) {
    localStorage.setItem('auth_token', token);
  }
  ```

#### Expected Invariant Check Breakdown:
| Invariant | Expected Status | Detail / Reason |
| :--- | :---: | :--- |
| `DECISION_STATE` | **PASS (Satisfied)** | `localStorage` JWT storage is marked `REJECTED`. |
| `AUTHORITATIVE_RULING` | **PASS (Satisfied)** | `VERIFIED_EXACT` ruling quote by `@MRIARC-08` citing CWE-312 XSS vulnerability. |
| `ALTERNATIVE_CODE_ANCHOR` | **PASS (Satisfied)** | Touches `src/hooks/use-auth.ts`. |
| `AST_STRUCTURAL_EQUIVALENCE` | **PASS (Satisfied)** | `localStorage.setItem` call construct detected. |

#### Expected Watchdog Return:
- **Verdict:** `WARNING_AUTHORIZED`
- **Action:** `COMMENT_PUBLISHED`
- **Expected Bot Output Citation:**
  > "We strictly reject storing authentication session tokens in browser localStorage or sessionStorage due to cross-site scripting (XSS) credential exfiltration vulnerabilities (CWE-312)." — `@MRIARC-08` (DevLens Issue #7)

---

### Test Case G: True Positive (Stateful WebSockets in Serverless Status Route)

- **Target File:** `src/app/api/pipeline/status/route.ts`
- **Scenario:** A PR imports `ws` and attempts to start a WebSocket server in Next.js route handler.
- **Violated Deliberation:** Issue #5 (`rfc: Real-time Ingestion Progress: Stateful WebSockets (ws) vs Server-Sent Events (SSE)`)
- **PR Code Modification:**
  ```typescript
  import { WebSocketServer } from 'ws';

  const wss = new WebSocketServer({ noServer: true });

  export async function GET(req: Request) {
    // ws handling...
  }
  ```

#### Expected Invariant Check Breakdown:
| Invariant | Expected Status | Detail / Reason |
| :--- | :---: | :--- |
| `DECISION_STATE` | **PASS (Satisfied)** | `ws` WebSocket server is `REJECTED`. |
| `AUTHORITATIVE_RULING` | **PASS (Satisfied)** | `VERIFIED_EXACT` ruling by `@MRIARC-08` citing Vercel 15s execution timeout. |
| `ALTERNATIVE_CODE_ANCHOR` | **PASS (Satisfied)** | Touches `src/app/api/pipeline/status/route.ts`. |
| `AST_STRUCTURAL_EQUIVALENCE` | **PASS (Satisfied)** | `WebSocketServer` construct detected. |

#### Expected Watchdog Return:
- **Verdict:** `WARNING_AUTHORIZED`
- **Action:** `COMMENT_PUBLISHED`

---

### Test Case H: Normal Feature PR (Unrelated UI Component)

- **Target File:** `src/components/navbar.tsx`
- **Scenario:** Standard frontend UI feature PR adding an export button.
- **PR Code Modification:**
  ```tsx
  export function ExportButton() {
    return (
      <button className="px-3 py-1 bg-indigo-600 text-white rounded">
        Export Report
      </button>
    );
  }
  ```

#### Expected Invariant Check Breakdown:
| Invariant | Expected Status | Detail / Reason |
| :--- | :---: | :--- |
| `DECISION_STATE` | **FAIL (Not Satisfied)** | No matching rejected alternative exists for this UI component. |
| `AUTHORITATIVE_RULING` | N/A | |
| `ALTERNATIVE_CODE_ANCHOR` | N/A | |
| `AST_STRUCTURAL_EQUIVALENCE` | N/A | |

#### Expected Watchdog Return:
- **Verdict:** `NO_REJECTED_MATCH`
- **Action:** `LOGGED_ONLY` (Silent approval)

---

## 4. Master Evaluation Summary Table

| Test Case | Scenario / Code Pattern | Target File | Expected Verdict | Bot Action on GitHub |
| :--- | :--- | :--- | :---: | :---: |
| **Case A** | `@babel/parser` + `@babel/traverse` | `src/lib/pipeline/parser.ts` | `WARNING_AUTHORIZED` | **Posts Warning Comment** |
| **Case B** | Benign Regex optimization | `src/lib/pipeline/parser.ts` | `ABSTAINED_UNCERTAIN` | **Silent (No Comment)** |
| **Case C** | In-memory `new LRUCache()` | `src/lib/pipeline/resolver.ts` | `WARNING_AUTHORIZED` | **Posts Warning Comment** |
| **Case D** | Upstash Redis REST implementation | `src/lib/pipeline/resolver.ts` | `NO_REJECTED_MATCH` | **Silent (No Comment)** |
| **Case E** | Contributor `"strict": false` proposal | `tsconfig.json` | `ABSTAINED_UNCERTAIN` | **Silent (No Comment)** |
| **Case F** | `localStorage.setItem('auth_token', ...)` | `src/hooks/use-auth.ts` | `WARNING_AUTHORIZED` | **Posts Warning Comment** |
| **Case G** | Stateful `WebSocketServer` (`ws`) | `src/app/api/pipeline/status/route.ts` | `WARNING_AUTHORIZED` | **Posts Warning Comment** |
| **Case H** | Benign UI Button in Navbar | `src/components/navbar.tsx` | `NO_REJECTED_MATCH` | **Silent (No Comment)** |

---

## 5. Verification Checklist for Phase 4

When you run Phase 4, check off each row:
- [ ] **Precision:** Does the bot trigger warnings *only* on Cases A, C, F, G?
- [ ] **Zero False Alarms:** Does the bot stay silent on Cases B, D, E, H?
- [ ] **Exact Citations:** Does each warning quote the exact verbatim statement made by `@MRIARC-08`?
- [ ] **Quorum Verification:** Does the bot cite the authority role as `CORE_MAINTAINER_CONSENSUS` or `BDFL` without hallucinating `MODEL_INFERRED`?
- [ ] **Audit Trail:** Check `pr_watchdog_audit_log` to confirm all invariant checks are recorded.

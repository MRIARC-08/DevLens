# rfc: AST parsing architecture for repository file analysis (Babel vs. Regex vs. Tree-sitter)

* Status: ACCEPTED
* ID: DEC-DEVLENS-AST-PARSER-2026-11
* Date: 2026-11-05
* Source: https://github.com/MRIARC-08/DevLens/issues/1

## Context and Problem Statement

Repository file analysis requires parsing imported and exported symbols for dependency graph projection. The primary constraint is execution within Vercel Serverless Functions, which impose a 1024MB memory limit and 15-second execution timeout. Full syntactic AST parsing has caused out-of-memory crashes during repository ingestion, necessitating a lightweight parsing strategy.

## Considered Options

- **Full Babel AST Parser** (Status: DISPUTED)
  - Rationale: Memory allocation model incompatible with Vercel serverless constraints. Full Babel AST node allocation causes memory spikes exceeding 1024MB and triggers execution timeouts.
- **Optimized Regex Line Parser** (Status: ACCEPTED)
- **WebAssembly Tree-Sitter** (Status: DISPUTED)
  - Rationale: Tree-sitter CST parsing with WASM binaries rejected in favor of lighter regex-based extraction. No distinct advantage over regex approach given serverless memory constraints.

## Decision Outcome

**Chosen Option:** P2 (Optimized Regex Line Parser)

The Optimized Regex Line Parser provides fast import/export discovery without heavy AST node allocations, meeting Vercel serverless execution constraints. This approach avoids memory spikes that trigger OOM crashes and execution timeouts observed with full Babel AST parsing.

### Consequences

All repository parsing in src/lib/pipeline/parser.ts must remain lightweight. Heavy Babel AST node allocations are prohibited. Future enhancements must maintain memory efficiency within the 1024MB serverless environment limit.

## Evidence Provenance Quotes

> "In Vercel Serverless Functions, allocating full Babel AST nodes causes memory spikes exceeding 1024MB and triggers serverless execution timeouts (15s limit). We observed multiple OOM crashes during repository ingestion."
> — **@MRIARC-08** (OBJECTION)

> "We reject the full Babel AST parser alternative because its memory allocation model conflicts with Vercel serverless execution limits."
> — **@MRIARC-08** (RULING)

> "I propose we replace full Babel parsing with an optimized regex-based extractor in `src/lib/pipeline/parser.ts` for fast import/export discovery."
> — **@MRIARC-08** (PROPOSAL)

> "As lead maintainer, I concur with this benchmark. We reject the full Babel AST parser alternative because its memory allocation model conflicts with Vercel serverless execution limits. Decision: The regex line parser alternative is accepted for src/lib/pipeline/parser.ts. All repository parsing must remain lightweight without heavy Babel AST node allocations."
> — **@MRIARC-08** (RULING)

> "Closed as resolved. Decision recorded: Regex parser accepted; Full Babel AST parser rejected."
> — **@MRIARC-08** (RULING)

# Security Audit (Lightweight)

Scope: Vercel API routes under `/api` + Vite client in `/kod` + Supabase integration.  
Date: 2025-02-14

## Critical

None identified in current snapshot.

## High

### 1) Client-side Supabase credentials should only be loaded from env
- **Location:** `kod/src/lib/customSupabaseClient.js:3-10`
- **Risk:** Hardcoding a Supabase anon key in client code makes key rotation difficult and risks accidental exposure across environments.
- **Recommended minimal fix:** Load `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from environment at build time and fail fast if missing. Rotate the existing anon key if it was committed previously.

### 2) Avoid logging secret material (OpenAI API key)
- **Location:** `api/lib/llmClient.js:20-26`
- **Risk:** Logging secret prefixes or raw values can leak credentials to logs/observability systems.
- **Recommended minimal fix:** Log only boolean presence (e.g., `hasKey`) and avoid raw key or prefix in logs.

### 3) Rate limiting + strict input validation for cost/abuse endpoints
- **Locations:**  
  - `api/chat.js:16-47`  
  - `api/sales/message.js:23-66`  
  - `api/sales/session.js:26-82`
- **Risk:** Without rate limits or field validation, endpoints can be abused for cost (LLM calls) or unbounded data writes.
- **Recommended minimal fix:** Enforce per-IP rate limiting and field validation (required fields, max lengths, allowlists).

## Medium

### 1) Service-role Supabase client is reachable via unauthenticated endpoints
- **Locations:**  
  - `api/lib/supabaseAdmin.js:3-13`  
  - `api/sales/message.js:68-134`  
  - `api/sales/session.js:84-123`
- **Risk:** Public endpoints can write to privileged tables using the service role. If abuse occurs, data integrity can be impacted even with input validation.
- **Recommended minimal fix:** Require authenticated user context and verify ownership (e.g., check JWT / session). Alternatively, move writes to RLS-enabled anon client.

### 2) Telemetry logging may contain user-provided metadata
- **Location:** `api/chat.js:99-104`
- **Risk:** Metadata could include PII if callers pass it through; logs are often retained long-term.
- **Recommended minimal fix:** Log only non-sensitive identifiers (sessionId hash, lengths) and strip unknown fields.

### 3) .env files are not gitignored at repo root
- **Location:** `/workspace/LibAPP/.gitignore` (missing)
- **Risk:** Contributors could accidentally commit secrets in `.env` files.
- **Recommended minimal fix:** Add a repo-level `.gitignore` entry for `.env`, `.env.*`, and any environment files used locally.

## Low

### 1) Wide-open CORS on sales endpoints
- **Locations:**  
  - `api/sales/message.js:9-11`  
  - `api/sales/session.js:12-14`
- **Risk:** Any origin can POST to these endpoints. This expands abuse surface when combined with unauthenticated service-role access.
- **Recommended minimal fix:** Restrict `Access-Control-Allow-Origin` to trusted origins if possible.

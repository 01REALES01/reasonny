# RealMoney

Personal finance app with AI-assisted ingestion. Built to remove the friction that makes expense tracking fail: payments are captured automatically, categorized by a rule engine that learns, and reconciled against bank statements read by a vision model.

> **Status:** pre-implementation. Phase 0 (empirical validation) has not run yet.
> Documentation is currently in Spanish; it will be translated before the repository is made public.

## What makes it different

Not the expense tracker — that part is the substrate. The system is:

- **Event-driven ingestion** with client-generated idempotency keys, retry queues and statement reconciliation.
- **A three-tier capture architecture** designed so the top tier absorbs most transactions with zero interaction. The notification with buttons is scaffolding while the rule engine learns; its frequency should *fall* over time.
- **Vision-based statement extraction** with a fixed golden set, per-field accuracy metrics and prompt-version tracking.
- **Grounded financial education** where every claim is verified against its retrieved source, or the system stays silent.

## Documentation

| Document | Purpose |
| :--- | :--- |
| [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) | Architecture, data model, security model, flows |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Build order, blocks, decision criteria |
| [`docs/METRICS.md`](docs/METRICS.md) | Every measurement, with n, method and baseline |
| [`docs/AUDIT.md`](docs/AUDIT.md) | Audit of the original v1 spec — 3 blockers, 14 schema defects |
| [`CLAUDE.md`](CLAUDE.md) | Engineering rules enforced in this repository |

The `docs/archive/` folder keeps the original v1 specification and the external audits. They are not maintained — they are the record of how the design changed and why.

## Engineering principles

Nine non-negotiable principles govern the codebase, from "money is never a float" to "no metric is reported without n, methodology and baseline". See [`CLAUDE.md`](CLAUDE.md).

## Stack

Next.js 15 · TypeScript · Neon Postgres · Drizzle ORM · Neon Auth · Cloudflare R2 · Telegram Bot API · Gemini Flash · Zod v4 · Tailwind v4 · Serwist

## License

Not yet determined.

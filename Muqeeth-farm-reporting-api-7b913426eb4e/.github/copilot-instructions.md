---
name: 'flygoog-reporting-api workspace instructions'
description: 'Always-on guidance for Copilot Chat in the flygoog-reporting-api backend repository. Use this for architecture, coding patterns, and commands.'
---

## Project Summary

flygoog-reporting-api is a NestJS backend API using TypeScript, TypeORM with SQLite, JWT auth, and a layered module structure. Keep behavior consistent with existing modules under `src/` (daily-reports, feed-items, feed-receipts, parties, sales, sheds, users, seed).

## Quick start (commands)

- `npm install`
- `npm run start:dev` (dev server)
- `npm run build` (production build)
- `npm run test` (unit tests)
- `npm run test:e2e` (e2e tests)
- `npm run lint` (ESLint + autofix)
- `npm run format` (Prettier)

## Architecture notes

- `src/app.module.ts` is the root module.
- Each feature is in a subfolder module (`*/*.module.ts`, `*/*service.ts`, `*/*controller.ts`, `*/*entity.ts`, `*/*dto.ts`).
- Use dependency injection and scoped providers via `@Injectable()` and `@Module({ providers: [...] })`.
- Database access is through TypeORM entities and repositories.
- Auth is JWT-based, seen in `src/auth/jwt.strategy.ts` and `src/user` module.

## Code patterns

- Controllers should validate/transform using DTO classes (`class-validator` + `class-transformer`).
- Services contain business logic and repository operations.
- Avoid direct SQL; use TypeORM query builder/repository methods.
- Keep endpoints RESTful and modular (e.g., `/sheds`, `/daily-reports`).
- For new modules, follow existing pattern: module, controller, service, dto, entity.

## Testing and quality

- Unit tests in `src/**/*.spec.ts` and e2e in `test/app.e2e-spec.ts`.
- Prefer small, isolated tests using `@nestjs/testing` module builder.
- Keep 1st-level validation in DTOs and use exception filters as needed.

## Agent usage

- When generating code, prefer existing folder structure and naming conventions.
- If a breaking change is needed, propose update strategy and migration steps.
- Quote command previews and reasons in PR-like output.

## Links(not duplicated)

- `README.md` for project setup and test commands
- `QUICK_START.md` and `DAILY_REPORTS_API.md` for domain details

# Contributing

## Development

```bash
pnpm install
pnpm run build
pnpm test
```

Use `pnpm dev` for watch mode during development.

## Pull requests

- Keep changes focused on a single concern.
- Run `pnpm run build` and `pnpm test` before submitting.
- For tool changes, prefer clearer **descriptions** (purpose, when to use, inputs, returns, side effects) so LLM clients route calls correctly.

## Code style

- TypeScript with `strict` settings from the project `tsconfig`.
- Match existing patterns in `src/tools/` and `src/services/`.

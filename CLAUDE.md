# InsightRadar — Project Rules

## Code Style
- Use ES modules (import/export) everywhere
- Prefer async/await over .then() chains
- Use const by default, let when mutation is needed
- All functions must have JSDoc comments
- Error handling: wrap all async operations in try/catch

## Architecture Rules
- Chrome extension communicates with server via REST API
- All Claude API calls go through server/services/ai-analyzer.js
- Never expose API keys in the Chrome extension
- SQLite database lives in server/db/insight-radar.db

## Testing
- Write tests with Vitest
- Test files live next to source files: `*.test.js`
- Mock external APIs (Anthropic, fetch) in tests

## Git
- Commit messages: conventional commits (feat:, fix:, chore:)
- Branch per feature: feature/[name]

## Environment
- Node.js 20+
- .env file for ANTHROPIC_API_KEY (never commit)
- Default server port: 3001
- Default dashboard port: 5173

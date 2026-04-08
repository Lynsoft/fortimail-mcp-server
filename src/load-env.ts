/**
 * Load env files before any other app code reads process.env.
 * `.env.local` overrides `.env` (same convention as Next.js / Vite).
 * Paths resolve from the project root (parent of `dist/` or `src/`) so loading works
 * when the MCP host runs `node` with a cwd other than the repo.
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

config({ path: join(projectRoot, ".env") });
config({ path: join(projectRoot, ".env.local"), override: true });

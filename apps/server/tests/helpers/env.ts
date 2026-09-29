import { config as loadDotEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Integration tests talk to the real database, so the server's .env has to be loaded
 * before anything imports the Prisma client. Import this first in any suite that
 * touches the database; unit suites should not need it.
 */
const localEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));

for (const path of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "apps/server/.env"), localEnvPath]) {
  loadDotEnv({ path, override: false });
}

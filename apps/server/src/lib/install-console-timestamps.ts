// index.ts imports this before anything else, so even messages printed while the other modules
// load (environment warnings, database setup) get a timestamp in the pm2 logs.
import { installConsoleTimestamps, logTimestampsEnabled } from "./log-format.js";

if (logTimestampsEnabled()) installConsoleTimestamps();

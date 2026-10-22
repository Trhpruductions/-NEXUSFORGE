import { z } from "zod";

/**
 * Forms import zod from here. `jitless` stops zod from testing whether `new Function` is allowed: the website's
 * Content-Security-Policy refuses it, and browsers report the test as a violation even though zod catches it and
 * carries on (next.config.ts). Without the test zod simply uses its normal, non-compiled checks.
 */
z.config({ jitless: true });

export { z };

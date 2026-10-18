// Tests that write rows must never run against the owner's live database. That database is named "nexusforge" on the
// owner's machine. CI and the local test runner point at other, disposable databases, so any other name is allowed.
const LIVE_DATABASE_NAME = "nexusforge";

export function assertNotLiveDatabase(): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for this test");
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  if (name === LIVE_DATABASE_NAME) {
    throw new Error("This test writes rows and must not run against the live nexusforge database");
  }
}

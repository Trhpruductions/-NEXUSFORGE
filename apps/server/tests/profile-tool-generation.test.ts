import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSampleGenerationConflictResponse,
  buildSampleGenerationCooldownResponse,
  getSampleGenerationCooldownRemainingMs,
  getSampleGenerationRetryAfterSeconds,
  getSampleGenerationStaleThreshold,
  SAMPLE_PROFILE_GENERATION_COOLDOWN_MS,
  SAMPLE_PROFILE_GENERATION_STALE_MS,
} from "../src/lib/profile-tool-generation.js";

test("returns zero cooldown when there is no completed job", () => {
  assert.equal(getSampleGenerationCooldownRemainingMs(null, 1_000), 0);
});

test("computes cooldown remaining time from latest completion", () => {
  const completedAt = new Date("2026-05-10T12:00:00.000Z");
  const nowMs = completedAt.getTime() + 120_000;

  assert.equal(
    getSampleGenerationCooldownRemainingMs(completedAt, nowMs, SAMPLE_PROFILE_GENERATION_COOLDOWN_MS),
    180_000,
  );
});

test("cooldown remaining time never goes negative", () => {
  const completedAt = new Date("2026-05-10T12:00:00.000Z");
  const nowMs = completedAt.getTime() + SAMPLE_PROFILE_GENERATION_COOLDOWN_MS + 5_000;

  assert.equal(getSampleGenerationCooldownRemainingMs(completedAt, nowMs), 0);
});

test("retry-after seconds always rounds up to at least one second", () => {
  assert.equal(getSampleGenerationRetryAfterSeconds(1), 1);
  assert.equal(getSampleGenerationRetryAfterSeconds(1_001), 2);
});

test("stale threshold is derived from now minus stale window", () => {
  const nowMs = Date.parse("2026-05-10T12:30:00.000Z");
  const threshold = getSampleGenerationStaleThreshold(nowMs, SAMPLE_PROFILE_GENERATION_STALE_MS);

  assert.equal(threshold.toISOString(), "2026-05-10T12:00:00.000Z");
});

test("builds 409 conflict response when a generation job is already running", () => {
  const startedAt = new Date("2026-05-10T12:00:00.000Z");
  const response = buildSampleGenerationConflictResponse({
    id: "job-123",
    startedAt,
  });

  assert.equal(response.status, 409);
  assert.deepEqual(response.headers, {});
  assert.deepEqual(response.body, {
    error: "Sample profile generation already in progress",
    startedAt,
    jobId: "job-123",
  });
});

test("builds 503 retry response when no active job is visible after contention", () => {
  const response = buildSampleGenerationConflictResponse(null);

  assert.equal(response.status, 503);
  assert.deepEqual(response.headers, { "Retry-After": "1" });
  assert.deepEqual(response.body, {
    error: "Could not acquire generation lock. Please retry.",
    retryAfterSeconds: 1,
  });
});

test("builds 429 cooldown response with retry-after metadata", () => {
  const response = buildSampleGenerationCooldownResponse(293_235);

  assert.equal(response.status, 429);
  assert.deepEqual(response.headers, { "Retry-After": "294" });
  assert.deepEqual(response.body, {
    error: "Sample profile generation is cooling down",
    retryAfterMs: 293_235,
    retryAfterSeconds: 294,
  });
});

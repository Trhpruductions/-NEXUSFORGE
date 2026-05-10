export const SAMPLE_PROFILE_GENERATION_COOLDOWN_MS = 5 * 60 * 1000;
export const SAMPLE_PROFILE_GENERATION_STALE_MS = 30 * 60 * 1000;

export type SampleGenerationRunningJob = {
  id: string;
  startedAt: Date;
};

export function getSampleGenerationCooldownRemainingMs(
  latestCompletedAt: Date | null,
  nowMs: number = Date.now(),
  cooldownMs: number = SAMPLE_PROFILE_GENERATION_COOLDOWN_MS,
) {
  if (!latestCompletedAt) {
    return 0;
  }

  return Math.max(0, cooldownMs - (nowMs - latestCompletedAt.getTime()));
}

export function getSampleGenerationRetryAfterSeconds(cooldownRemainingMs: number) {
  return Math.max(1, Math.ceil(cooldownRemainingMs / 1000));
}

export function getSampleGenerationStaleThreshold(
  nowMs: number = Date.now(),
  staleMs: number = SAMPLE_PROFILE_GENERATION_STALE_MS,
) {
  return new Date(nowMs - staleMs);
}

export function buildSampleGenerationConflictResponse(runningJob: SampleGenerationRunningJob | null) {
  if (runningJob) {
    return {
      status: 409,
      headers: {} as Record<string, string>,
      body: {
        error: "Sample profile generation already in progress",
        startedAt: runningJob.startedAt,
        jobId: runningJob.id,
      },
    };
  }

  return {
    status: 503,
    headers: {
      "Retry-After": "1",
    },
    body: {
      error: "Could not acquire generation lock. Please retry.",
      retryAfterSeconds: 1,
    },
  };
}

export function buildSampleGenerationCooldownResponse(cooldownRemainingMs: number) {
  const retryAfterSeconds = getSampleGenerationRetryAfterSeconds(cooldownRemainingMs);

  return {
    status: 429,
    headers: {
      "Retry-After": String(retryAfterSeconds),
    },
    body: {
      error: "Sample profile generation is cooling down",
      retryAfterMs: cooldownRemainingMs,
      retryAfterSeconds,
    },
  };
}

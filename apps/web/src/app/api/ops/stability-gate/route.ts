import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

type GateCounts = {
  total?: number;
  pass?: number;
  warning?: number;
  fail?: number;
  error?: number;
  blocking?: number;
};

type GatePayload = {
  passed?: boolean;
  strictMode?: boolean;
  generatedAt?: string;
  counts?: GateCounts;
};

function resolveGateCandidates(): string[] {
  const override = process.env.NEXUSFORGE_GATE_PATH;
  const initCwd = process.env.INIT_CWD;
  return [
    override ? path.resolve(override) : null,
    initCwd ? path.join(initCwd, "var", "stability-gate-latest.json") : null,
    path.join(/* turbopackIgnore: true */ process.cwd(), "var", "stability-gate-latest.json"),
  ].filter((candidate): candidate is string => Boolean(candidate));
}

function parseGate(raw: string): GatePayload | null {
  try {
    const normalized = raw.replace(/^\uFEFF/, "").trim();
    return JSON.parse(normalized) as GatePayload;
  } catch {
    return null;
  }
}

export async function GET() {
  const candidates = resolveGateCandidates();
  const existingCandidates = candidates.filter((candidate) => existsSync(candidate));

  if (existingCandidates.length === 0) {
    return NextResponse.json(
      {
        status: "unknown",
        detail: "gate-file-missing",
      },
      { status: 200 },
    );
  }

  let parsed: GatePayload | null = null;
  for (const candidate of existingCandidates) {
    parsed = parseGate(readFileSync(candidate, "utf8"));
    if (parsed) {
      break;
    }
  }

  if (!parsed) {
    return NextResponse.json(
      {
        status: "unknown",
        detail: "gate-file-invalid",
      },
      { status: 200 },
    );
  }

  const blocking = Number(parsed.counts?.blocking ?? 0);
  const status = parsed.passed && blocking === 0 ? "healthy" : "degraded";

  return NextResponse.json({
    status,
    generatedAt: parsed.generatedAt ?? null,
    strictMode: Boolean(parsed.strictMode),
    counts: {
      total: Number(parsed.counts?.total ?? 0),
      pass: Number(parsed.counts?.pass ?? 0),
      warning: Number(parsed.counts?.warning ?? 0),
      fail: Number(parsed.counts?.fail ?? 0),
      error: Number(parsed.counts?.error ?? 0),
      blocking,
    },
  });
}

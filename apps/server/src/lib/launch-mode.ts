import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

type LaunchModeActor = {
  id: string;
  username: string;
};

type LaunchModeState = {
  desktopOnly: boolean;
  updatedAt: string;
  updatedBy: LaunchModeActor | null;
  source: "env" | "runtime";
};

const LAUNCH_MODE_RECORD_ID = 1;
const initialDesktopOnly = (process.env.NEXUSFORGE_DESKTOP_ONLY ?? "true") !== "false";

let lastKnownState: LaunchModeState = {
  desktopOnly: initialDesktopOnly,
  updatedAt: new Date().toISOString(),
  updatedBy: null,
  source: "env",
};

function mapRecordToState(record: {
  desktopOnly: boolean;
  source: string;
  updatedAt: Date;
  updatedById: string | null;
  updatedByUsername: string | null;
}): LaunchModeState {
  return {
    desktopOnly: record.desktopOnly,
    updatedAt: record.updatedAt.toISOString(),
    updatedBy:
      record.updatedById && record.updatedByUsername
        ? {
            id: record.updatedById,
            username: record.updatedByUsername,
          }
        : null,
    source: record.source === "runtime" ? "runtime" : "env",
  };
}

async function ensureLaunchModeRecord() {
  const existing = await prisma.runtimeLaunchMode.findUnique({
    where: { id: LAUNCH_MODE_RECORD_ID },
  });

  if (existing) {
    return existing;
  }

  try {
    return await prisma.runtimeLaunchMode.create({
      data: {
        id: LAUNCH_MODE_RECORD_ID,
        desktopOnly: initialDesktopOnly,
        source: "env",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentCreate = await prisma.runtimeLaunchMode.findUnique({
        where: { id: LAUNCH_MODE_RECORD_ID },
      });
      if (concurrentCreate) {
        return concurrentCreate;
      }
    }
    throw error;
  }
}

export async function getLaunchMode(): Promise<LaunchModeState> {
  try {
    const record = await ensureLaunchModeRecord();
    const nextState = mapRecordToState(record);
    lastKnownState = nextState;
    return nextState;
  } catch (error) {
    console.error("Failed to read launch mode from database. Falling back to last known state.", error);
    return lastKnownState;
  }
}

export async function setLaunchModeDesktopOnly(desktopOnly: boolean, actor: LaunchModeActor): Promise<LaunchModeState> {
  const record = await prisma.runtimeLaunchMode.upsert({
    where: { id: LAUNCH_MODE_RECORD_ID },
    create: {
      id: LAUNCH_MODE_RECORD_ID,
      desktopOnly,
      source: "runtime",
      updatedById: actor.id,
      updatedByUsername: actor.username,
    },
    update: {
      desktopOnly,
      source: "runtime",
      updatedById: actor.id,
      updatedByUsername: actor.username,
    },
  });

  const nextState = mapRecordToState(record);
  lastKnownState = nextState;
  return nextState;
}

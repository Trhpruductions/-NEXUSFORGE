export const botPermissionOptions = [
  "NONE",
  "moderateChat",
  "manageChannels",
  "manageRoles",
  "kickUsers",
  "banUsers",
  "streamAccess",
] as const;

export const botCommandPresetOptions = ["CUSTOM", "MODERATION", "UTILITY", "ECONOMY"] as const;

export type BotPermission = (typeof botPermissionOptions)[number];
export type BotCommandPreset = (typeof botCommandPresetOptions)[number];

type BotCommandPresetConfig = {
  preset: Exclude<BotCommandPreset, "CUSTOM">;
  name: string;
  description: string;
  responseTemplate: string;
  requiredPermission: BotPermission;
};

const presetMap: Record<Exclude<BotCommandPreset, "CUSTOM">, BotCommandPresetConfig> = {
  MODERATION: {
    preset: "MODERATION",
    name: "raid-lock",
    description: "Signals a moderation lockdown directive for the active forge.",
    responseTemplate: "Moderation lock engaged by {userName} in #{channel} for {forge}. Args: {args}.",
    requiredPermission: "moderateChat",
  },
  UTILITY: {
    preset: "UTILITY",
    name: "status-pulse",
    description: "Reports operational status for the active forge.",
    responseTemplate: "Utility pulse from {bot}: {forge} is stable in #{channel}. Requested by {userName}. Args: {args}.",
    requiredPermission: "NONE",
  },
  ECONOMY: {
    preset: "ECONOMY",
    name: "jackpot-sync",
    description: "Broadcasts economy synchronization status for controlled operators.",
    responseTemplate: "Economy sync authorized by {userName} for {forge}. Channel #{channel}. Payload: {args}.",
    requiredPermission: "manageRoles",
  },
};

export function getBotCommandPreset(preset?: string | null): BotCommandPresetConfig | null {
  if (!preset || preset === "CUSTOM") {
    return null;
  }

  if (preset in presetMap) {
    return presetMap[preset as Exclude<BotCommandPreset, "CUSTOM">];
  }

  return null;
}

export function renderBotCommandResponse(
  template: string,
  context: {
    userId: string;
    userName: string;
    forgeName: string;
    channelName: string;
    commandName: string;
    botName: string;
    args: string;
  },
) {
  const replacements: Record<string, string> = {
    "{user}": `<@${context.userId}>`,
    "{mention}": `<@${context.userId}>`,
    "{userName}": context.userName,
    "{forge}": context.forgeName,
    "{channel}": context.channelName,
    "{args}": context.args || "none",
    "{command}": context.commandName,
    "{bot}": context.botName,
  };

  return Object.entries(replacements).reduce(
    (content, [token, value]) => content.replaceAll(token, value),
    template,
  );
}
import { createHmac } from "node:crypto";

/** Public STUN servers find a direct path between two browsers. Strict NATs and firewalls need a TURN relay. */
const STUN_URLS = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

export type IceServer = { urls: string[]; username?: string; credential?: string };

/**
 * ICE servers for one built-in voice connection. When TURN_URLS and TURN_SHARED_SECRET are both set, a TURN
 * relay is added with short-lived credentials in the coturn "use-auth-secret" format: the username is the
 * expiry time and the password is an HMAC of it, so the long-lived secret never reaches the browser.
 */
export function buildIceServers(
  userId: string,
  config: { turnUrls?: string; turnSharedSecret?: string; turnCredentialTtlSeconds: number },
  now = Date.now()
): IceServer[] {
  const servers: IceServer[] = [{ urls: STUN_URLS }];
  const turnUrls = (config.turnUrls ?? "").split(",").map((url) => url.trim()).filter(Boolean);
  if (turnUrls.length === 0 || !config.turnSharedSecret) return servers;
  const username = `${Math.floor(now / 1000) + config.turnCredentialTtlSeconds}:${userId}`;
  const credential = createHmac("sha1", config.turnSharedSecret).update(username).digest("base64");
  servers.push({ urls: turnUrls, username, credential });
  return servers;
}

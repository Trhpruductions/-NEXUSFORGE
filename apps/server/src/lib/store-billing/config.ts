import { env } from "../../config/env.js";
import type { AppleConfig } from "./apple.js";
import type { GoogleConfig } from "./google.js";

// Keys are read from the environment (apps/server/.env). Keys pasted into .env often lose their line breaks, so
// literal "\n" sequences are turned back into newlines. A missing value leaves that store "not configured".

function pem(value: string): string {
  return value.replace(/\\n/g, "\n");
}

export function appleConfig(): AppleConfig | null {
  const { APPLE_IAP_ISSUER_ID: issuerId, APPLE_IAP_KEY_ID: keyId, APPLE_IAP_PRIVATE_KEY: privateKey } = env;
  const { APPLE_BUNDLE_ID: bundleId, APPLE_ROOT_CA_PEM: rootCert } = env;
  if (!issuerId || !keyId || !privateKey || !bundleId || !rootCert) return null;
  return { issuerId, keyId, privateKeyPem: pem(privateKey), bundleId, rootCertPem: pem(rootCert) };
}

export function googleConfig(): GoogleConfig | null {
  const { GOOGLE_PLAY_PACKAGE_NAME: packageName, GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: serviceAccountEmail } = env;
  const { GOOGLE_PLAY_PRIVATE_KEY: privateKey } = env;
  if (!packageName || !serviceAccountEmail || !privateKey) return null;
  return { packageName, serviceAccountEmail, privateKeyPem: pem(privateKey) };
}

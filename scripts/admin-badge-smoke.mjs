const API_BASE = (process.env.NEXUSFORGE_API_URL || "http://127.0.0.1:4001").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.NEXUSFORGE_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.NEXUSFORGE_ADMIN_PASSWORD || "";
const ADMIN_ACCESS_TOKEN = process.env.NEXUSFORGE_ADMIN_ACCESS_TOKEN || "";
const TARGET_USER_ID = process.env.NEXUSFORGE_BADGE_TEST_USER_ID || "";

const badgeKeys = ["vip", "staff", "legend", "founder", "developer", "moderator", "admin", "owner"];

function fail(message) {
  console.error(`[admin-badge-smoke] FAIL: ${message}`);
  process.exit(1);
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const detail = payload && typeof payload === "object" ? JSON.stringify(payload) : String(payload || "");
    throw new Error(`${response.status} ${response.statusText}${detail ? ` :: ${detail}` : ""}`);
  }

  return payload;
}

function chooseTargetUser(users, adminId) {
  if (TARGET_USER_ID) {
    const found = users.find((entry) => entry.id === TARGET_USER_ID);
    if (!found) {
      fail(`Configured target user ${TARGET_USER_ID} was not found in /api/admin/users`);
    }
    return found;
  }

  const candidate = users.find((entry) => entry.id !== adminId);
  if (!candidate) {
    fail("No non-admin target user available for badge smoke test. Set NEXUSFORGE_BADGE_TEST_USER_ID.");
  }

  return candidate;
}

function ensureBadgeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "string");
}

async function fetchAdminUsers(accessToken) {
  return requestJson("/api/admin/users", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function mutateBadge(accessToken, userId, badgeKey, action) {
  return requestJson(`/api/admin/users/${userId}/badges/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ badgeKey }),
  });
}

async function main() {
  console.log(`[admin-badge-smoke] Using API: ${API_BASE}`);

  let accessToken = ADMIN_ACCESS_TOKEN.trim();
  let actor = null;

  if (!accessToken) {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      fail(
        "Missing auth inputs. Provide either NEXUSFORGE_ADMIN_ACCESS_TOKEN or both NEXUSFORGE_ADMIN_EMAIL and NEXUSFORGE_ADMIN_PASSWORD.",
      );
    }

    const login = await requestJson("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });

    accessToken = String(login?.accessToken || "").trim();
    actor = login?.user ?? null;
  } else {
    console.log("[admin-badge-smoke] Using bearer token auth from NEXUSFORGE_ADMIN_ACCESS_TOKEN.");
  }

  if (!accessToken) {
    fail("Authentication failed: access token is empty.");
  }

  if (actor && !actor.isAdmin) {
    fail(`Authenticated user ${actor.username || actor.email} is not admin-enabled.`);
  }

  const listing = await fetchAdminUsers(accessToken);
  const users = Array.isArray(listing?.users) ? listing.users : [];
  if (!users.length) {
    fail("Admin users listing is empty.");
  }

  const actorId = actor?.id ? String(actor.id) : "";
  const target = chooseTargetUser(users, actorId);
  const beforeBadges = ensureBadgeList(target.manualBadges);

  let badgeKey = badgeKeys.find((key) => !beforeBadges.includes(key));
  const targetLabel = `${target.username} (${target.id})`;

  if (badgeKey) {
    console.log(`[admin-badge-smoke] Path A: grant+revoke for missing badge '${badgeKey}' on ${targetLabel}`);

    await mutateBadge(accessToken, target.id, badgeKey, "grant");
    const afterGrantUsers = (await fetchAdminUsers(accessToken)).users || [];
    const afterGrant = afterGrantUsers.find((entry) => entry.id === target.id);
    const afterGrantBadges = ensureBadgeList(afterGrant?.manualBadges);

    if (!afterGrantBadges.includes(badgeKey)) {
      fail(`Grant verification failed: ${badgeKey} not present after grant.`);
    }

    await mutateBadge(accessToken, target.id, badgeKey, "revoke");
    const afterRevokeUsers = (await fetchAdminUsers(accessToken)).users || [];
    const afterRevoke = afterRevokeUsers.find((entry) => entry.id === target.id);
    const afterRevokeBadges = ensureBadgeList(afterRevoke?.manualBadges);

    if (afterRevokeBadges.includes(badgeKey)) {
      fail(`Revoke verification failed: ${badgeKey} still present after revoke.`);
    }

    console.log(`[admin-badge-smoke] PASS: grant+revoke verified for '${badgeKey}' and state restored.`);
    return;
  }

  badgeKey = badgeKeys[0];
  console.log(`[admin-badge-smoke] Path B: all badges present; revoke+grant cycle for '${badgeKey}' on ${targetLabel}`);

  await mutateBadge(accessToken, target.id, badgeKey, "revoke");
  const afterRevokeUsers = (await fetchAdminUsers(accessToken)).users || [];
  const afterRevoke = afterRevokeUsers.find((entry) => entry.id === target.id);
  const afterRevokeBadges = ensureBadgeList(afterRevoke?.manualBadges);

  if (afterRevokeBadges.includes(badgeKey)) {
    fail(`Revoke verification failed: ${badgeKey} still present after revoke.`);
  }

  await mutateBadge(accessToken, target.id, badgeKey, "grant");
  const afterGrantUsers = (await fetchAdminUsers(accessToken)).users || [];
  const afterGrant = afterGrantUsers.find((entry) => entry.id === target.id);
  const afterGrantBadges = ensureBadgeList(afterGrant?.manualBadges);

  if (!afterGrantBadges.includes(badgeKey)) {
    fail(`Grant verification failed: ${badgeKey} missing after re-grant.`);
  }

  console.log(`[admin-badge-smoke] PASS: revoke+grant verified for '${badgeKey}' and state restored.`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

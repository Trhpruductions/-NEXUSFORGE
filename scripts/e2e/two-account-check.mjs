#!/usr/bin/env node
// Two authorised accounts exchange messages on a LOCAL API, and the server refuses what they should not do.
//
// Accounts: an owner (creates a server), a member (joins with the invite) and an outsider (never joins).
// Checks: messages flow both ways; the outsider cannot read or post; the member cannot edit someone else's message,
// delete it, change the server, create channels, ban, or transfer ownership; the owner can moderate.
//
// Safety: refuses any API that is not on localhost, and only runs with NF_E2E_ALLOW_WRITES=1, because it creates
// three accounts and a server on that API. It never prints passwords, tokens, invite codes or message bodies.
//
// usage: NF_E2E_ALLOW_WRITES=1 node scripts/e2e/two-account-check.mjs [apiBaseUrl]

import { randomBytes } from "node:crypto";

const API = (process.argv[2] ?? process.env.NF_E2E_API ?? "http://localhost:4101").replace(/\/$/, "");
const ORIGIN = process.env.NF_E2E_ORIGIN ?? "http://localhost:3502";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

if (!LOCAL_HOSTS.has(new URL(API).hostname)) {
  console.error("refusing: this check only runs against a local API");
  process.exit(2);
}
if (process.env.NF_E2E_ALLOW_WRITES !== "1") {
  console.error("refusing: set NF_E2E_ALLOW_WRITES=1 to allow this check to create test accounts and a server");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function call(method, path, { body, token, csrf } = {}) {
  const headers = { "content-type": "application/json", origin: ORIGIN };
  if (token) headers.authorization = `Bearer ${token}`;
  if (csrf) {
    headers["x-csrf-token"] = csrf;
    headers.cookie = `nf_csrf=${csrf}`;
  }
  const response = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json };
}

const tag = randomBytes(4).toString("hex");
async function makeAccount(label) {
  const username = `${label}${tag}`;
  const email = `${username}@preview.test`;
  const password = randomBytes(18).toString("base64url");
  const registered = await call("POST", "/api/auth/register", { body: { username, email, password, birthdate: "1995-01-01" } });
  if (registered.status !== 201) throw new Error(`could not create the ${label} account (status ${registered.status})`);
  const login = await call("POST", "/api/auth/login", { body: { email, password } });
  if (login.status !== 200 || !login.json?.accessToken) throw new Error(`could not sign in the ${label} account (status ${login.status})`);
  return { label, id: login.json.user?.id, token: login.json.accessToken, csrf: login.json.csrfToken };
}

// Accounts are created one at a time so the auth rate limit (per IP) is not hit in one burst.
const owner = await makeAccount("owner");
const member = await makeAccount("member");
const outsider = await makeAccount("outsider");
check("create three accounts and sign them in", Boolean(owner.token && member.token && outsider.token));

// The owner creates a server, and the server's text channel and invite are read back.
const created = await call("POST", "/api/forges", { body: { name: `Check ${tag}` }, token: owner.token, csrf: owner.csrf });
const forgeId = created.json?.forge?.id;
check("the owner creates a server", created.status === 201 && Boolean(forgeId), `status ${created.status}`);
if (!forgeId) process.exit(1);

const detail = await call("GET", `/api/forges/${forgeId}`, { token: owner.token });
const channel = detail.json?.forge?.channels?.find((entry) => entry.type === "TEXT");
const inviteCode = detail.json?.forge?.inviteCode;
check("the server has a text channel and an invite", Boolean(channel?.id && inviteCode), `status ${detail.status}`);
if (!channel?.id || !inviteCode) process.exit(1);

// The member joins with the invite; the outsider never does.
const joined = await call("POST", "/api/forges/join", { body: { inviteCode }, token: member.token, csrf: member.csrf });
check("the member joins with the invite", joined.status === 200 || joined.status === 201, `status ${joined.status}`);

// Messages flow between the owner and the member, in both directions.
const ownerText = `hello from the owner ${tag}`;
const fromOwner = await call("POST", "/api/messages", { body: { channelId: channel.id, content: ownerText }, token: owner.token, csrf: owner.csrf });
check("the owner posts a message", fromOwner.status === 201, `status ${fromOwner.status}`);
const ownerMessageId = fromOwner.json?.message?.id;

const readByMember = await call("GET", `/api/messages/${channel.id}`, { token: member.token });
check("the member reads the owner's message", readByMember.status === 200 && readByMember.json?.messages?.some((entry) => entry.content === ownerText), `status ${readByMember.status}`);

const memberText = `reply from the member ${tag}`;
const fromMember = await call("POST", "/api/messages", { body: { channelId: channel.id, content: memberText }, token: member.token, csrf: member.csrf });
check("the member posts a reply", fromMember.status === 201, `status ${fromMember.status}`);
const memberMessageId = fromMember.json?.message?.id;

const readByOwner = await call("GET", `/api/messages/${channel.id}`, { token: owner.token });
check("the owner reads the member's reply", readByOwner.status === 200 && readByOwner.json?.messages?.some((entry) => entry.content === memberText), `status ${readByOwner.status}`);

// The outsider is not a member: no read, no post, no view of the server.
const outsiderRead = await call("GET", `/api/messages/${channel.id}`, { token: outsider.token });
check("an outsider cannot read the channel", outsiderRead.status === 403 || outsiderRead.status === 404, `status ${outsiderRead.status}`);

const outsiderPost = await call("POST", "/api/messages", { body: { channelId: channel.id, content: `intrusion ${tag}` }, token: outsider.token, csrf: outsider.csrf });
check("an outsider cannot post to the channel", outsiderPost.status === 403 || outsiderPost.status === 404, `status ${outsiderPost.status}`);

const outsiderDetail = await call("GET", `/api/forges/${forgeId}`, { token: outsider.token });
check("an outsider cannot open the server", outsiderDetail.status === 403 || outsiderDetail.status === 404, `status ${outsiderDetail.status}`);

const anonymousRead = await call("GET", `/api/messages/${channel.id}`, {});
check("a signed-out request cannot read the channel", anonymousRead.status === 401, `status ${anonymousRead.status}`);

// The member has no moderation or management rights on this server.
const memberEdit = await call("PATCH", `/api/messages/${ownerMessageId}`, { body: { content: "edited by the member" }, token: member.token, csrf: member.csrf });
check("the member cannot edit the owner's message", memberEdit.status === 403, `status ${memberEdit.status}`);

const memberDeleteOwner = await call("DELETE", `/api/messages/${ownerMessageId}`, { token: member.token, csrf: member.csrf });
check("the member cannot delete the owner's message", memberDeleteOwner.status === 403 || memberDeleteOwner.status === 404, `status ${memberDeleteOwner.status}`);

const memberRename = await call("PATCH", `/api/forges/${forgeId}`, { body: { name: "renamed by the member" }, token: member.token, csrf: member.csrf });
check("the member cannot change the server", memberRename.status === 403, `status ${memberRename.status}`);

const memberChannel = await call("POST", `/api/forges/${forgeId}/channels`, { body: { name: "member-channel", type: "TEXT" }, token: member.token, csrf: member.csrf });
check("the member cannot create a channel", memberChannel.status === 403, `status ${memberChannel.status}`);

const memberBan = await call("POST", `/api/forges/${forgeId}/bans`, { body: { userId: outsider.id, reason: "check" }, token: member.token, csrf: member.csrf });
check("the member cannot ban anyone", memberBan.status === 403 || memberBan.status === 400, `status ${memberBan.status}`);

// A complete request, so the only reason to refuse is that the member is not the owner.
const memberTransfer = await call("POST", `/api/forges/${forgeId}/transfer`, { body: { userId: owner.id, confirmName: `Check ${tag}` }, token: member.token, csrf: member.csrf });
check("the member cannot transfer ownership", memberTransfer.status === 403, `status ${memberTransfer.status}`);

const ownerStill = await call("GET", `/api/forges/${forgeId}/permissions`, { token: owner.token });
const memberStill = await call("GET", `/api/forges/${forgeId}/permissions`, { token: member.token });
check("ownership did not move: the owner is still the owner, the member is not", ownerStill.json?.isOwner === true && memberStill.json?.isOwner === false, `owner ${ownerStill.json?.isOwner}, member ${memberStill.json?.isOwner}`);

// The owner can moderate: delete the member's message.
const ownerDeletesMember = await call("DELETE", `/api/messages/${memberMessageId}`, { token: owner.token, csrf: owner.csrf });
check("the owner can delete a member's message", ownerDeletesMember.status === 200 || ownerDeletesMember.status === 204, `status ${ownerDeletesMember.status}`);

const afterDelete = await call("GET", `/api/messages/${channel.id}`, { token: owner.token });
check("the deleted message is gone for the owner", afterDelete.status === 200 && !afterDelete.json?.messages?.some((entry) => entry.id === memberMessageId), `status ${afterDelete.status}`);

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);

#!/usr/bin/env node
// Real-time delivery and access control between separate accounts, on a LOCAL API.
//
// Accounts: owner A, member B (joins A's server, becomes A's friend), outsider C (never joins anything).
// Checks: sockets without a token are refused; a server message reaches a member's socket in real time but not an
// outsider's; a friend request can only be accepted by its receiver; a direct message reaches the other participant's
// socket and REST read, and not an outsider's; voice tokens go to members only.
//
// Safety: refuses any API that is not on localhost, and only runs with NF_E2E_ALLOW_WRITES=1, because it creates
// three accounts, a server and a direct-message thread on that API. It never prints passwords, tokens, invite codes or
// message bodies.
//
// usage: NF_E2E_ALLOW_WRITES=1 node scripts/e2e/realtime-and-access-check.mjs [apiBaseUrl]

import { randomBytes } from "node:crypto";
import { io } from "socket.io-client";

const API = (process.argv[2] ?? process.env.NF_E2E_API ?? "http://localhost:4101").replace(/\/$/, "");
const ORIGIN = process.env.NF_E2E_ORIGIN ?? "http://localhost:3502";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

if (!LOCAL_HOSTS.has(new URL(API).hostname)) {
  console.error("refusing: this check only runs against a local API");
  process.exit(2);
}
if (process.env.NF_E2E_ALLOW_WRITES !== "1") {
  console.error("refusing: set NF_E2E_ALLOW_WRITES=1 to allow this check to create test accounts, a server and a direct message");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

/** Connects a socket with a token and resolves once it is connected (or rejects with the server's reason). */
function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(API, { auth: token === undefined ? {} : { token }, transports: ["websocket"], forceNew: true, reconnection: false, timeout: 10000 });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error) => {
      socket.close();
      reject(error);
    });
  });
}

/** Records every payload of `event` that matches `predicate`. */
function listen(socket, event, predicate) {
  const seen = [];
  socket.on(event, (payload) => {
    if (predicate(payload)) seen.push(payload);
  });
  return seen;
}

const owner = await makeAccount("owner");
const member = await makeAccount("member");
const outsider = await makeAccount("outsider");
check("create three accounts and sign them in", Boolean(owner.token && member.token && outsider.token));

const created = await call("POST", "/api/forges", { body: { name: `Live ${tag}` }, token: owner.token, csrf: owner.csrf });
const forgeId = created.json?.forge?.id;
if (!forgeId) {
  console.error("could not create the server");
  process.exit(1);
}
const detail = await call("GET", `/api/forges/${forgeId}`, { token: owner.token });
const textChannel = detail.json?.forge?.channels?.find((entry) => entry.type === "TEXT");
const inviteCode = detail.json?.forge?.inviteCode;
const joined = await call("POST", "/api/forges/join", { body: { inviteCode }, token: member.token, csrf: member.csrf });
check("the member joins the owner's server", (joined.status === 200 || joined.status === 201) && Boolean(textChannel?.id), `status ${joined.status}`);
if (!textChannel?.id) process.exit(1);

// 1. The socket gateway refuses a connection with no token.
const anonymous = await new Promise((resolve) => {
  const socket = io(API, { auth: {}, transports: ["websocket"], forceNew: true, reconnection: false, timeout: 8000 });
  socket.once("connect", () => {
    socket.close();
    resolve("connected");
  });
  socket.once("connect_error", (error) => {
    socket.close();
    resolve(error.message);
  });
  setTimeout(() => resolve("timed out"), 9000);
});
check("a socket without a token is refused", anonymous !== "connected", anonymous);

// 2. Server messages: the member hears them in real time; the outsider does not.
const memberSocket = await connect(member.token);
const outsiderSocket = await connect(outsider.token);
const channelMarker = `live channel message ${tag}`;
const memberHeard = listen(memberSocket, "message:created", (payload) => JSON.stringify(payload).includes(channelMarker));
const outsiderHeard = listen(outsiderSocket, "message:created", (payload) => JSON.stringify(payload).includes(channelMarker));
memberSocket.emit("channel:join", textChannel.id);
outsiderSocket.emit("channel:join", textChannel.id);
await sleep(800);

const posted = await call("POST", "/api/messages", { body: { channelId: textChannel.id, content: channelMarker }, token: owner.token, csrf: owner.csrf });
check("the owner posts a server message", posted.status === 201, `status ${posted.status}`);
for (let waited = 0; waited < 5000 && memberHeard.length === 0; waited += 100) await sleep(100);
check("the member's socket receives the server message in real time", memberHeard.length > 0);
await sleep(2000);
check("the outsider's socket receives nothing from the server channel", outsiderHeard.length === 0, `received ${outsiderHeard.length}`);

// 3. Friends: a request can only be accepted by its receiver.
const request = await call("POST", "/api/friends/request", { body: { receiverId: member.id }, token: owner.token, csrf: owner.csrf });
const friendId = request.json?.friend?.id;
check("the owner sends a friend request to the member", request.status === 201 && Boolean(friendId), `status ${request.status}`);
const outsiderAccepts = await call("PATCH", `/api/friends/${friendId}`, { body: { status: "ACCEPTED" }, token: outsider.token, csrf: outsider.csrf });
check("an outsider cannot accept someone else's friend request", outsiderAccepts.status === 403 || outsiderAccepts.status === 404, `status ${outsiderAccepts.status}`);
const memberAccepts = await call("PATCH", `/api/friends/${friendId}`, { body: { status: "ACCEPTED" }, token: member.token, csrf: member.csrf });
check("the receiver accepts the friend request", memberAccepts.status === 200, `status ${memberAccepts.status}`);

// 4. Direct messages between the two friends: real time and REST, not to the outsider.
const thread = await call("POST", "/api/dms/threads", { body: { userId: member.id }, token: owner.token, csrf: owner.csrf });
const threadId = thread.json?.thread?.id;
check("the owner opens a direct message with the member", (thread.status === 200 || thread.status === 201) && Boolean(threadId), `status ${thread.status}`);
if (!threadId) process.exit(1);

const memberDm = await connect(member.token);
const outsiderDm = await connect(outsider.token);
const dmMarker = `live direct message ${tag}`;
const memberDmHeard = listen(memberDm, "dm:message", (payload) => JSON.stringify(payload).includes(dmMarker));
const outsiderDmHeard = listen(outsiderDm, "dm:message", (payload) => JSON.stringify(payload).includes(dmMarker));
memberDm.emit("dm:join", threadId);
outsiderDm.emit("dm:join", threadId);
await sleep(800);

const sentDm = await call("POST", `/api/dms/threads/${threadId}/messages`, { body: { content: dmMarker }, token: owner.token, csrf: owner.csrf });
check("the owner sends a direct message", sentDm.status === 201, `status ${sentDm.status}`);
for (let waited = 0; waited < 5000 && memberDmHeard.length === 0; waited += 100) await sleep(100);
check("the member's socket receives the direct message in real time", memberDmHeard.length > 0);
await sleep(2000);
check("the outsider's socket receives no direct message", outsiderDmHeard.length === 0, `received ${outsiderDmHeard.length}`);

const memberReads = await call("GET", `/api/dms/threads/${threadId}/messages`, { token: member.token });
check("the member reads the direct message over REST", memberReads.status === 200 && JSON.stringify(memberReads.json).includes(dmMarker), `status ${memberReads.status}`);
const outsiderReads = await call("GET", `/api/dms/threads/${threadId}/messages`, { token: outsider.token });
check("an outsider cannot read the direct message thread", outsiderReads.status === 403 || outsiderReads.status === 404, `status ${outsiderReads.status}`);
const outsiderSends = await call("POST", `/api/dms/threads/${threadId}/messages`, { body: { content: "intrusion" }, token: outsider.token, csrf: outsider.csrf });
check("an outsider cannot send into the direct message thread", outsiderSends.status === 403 || outsiderSends.status === 404, `status ${outsiderSends.status}`);

// 5. Voice tokens: members get one, outsiders do not.
const voiceChannelCreated = await call("POST", `/api/forges/${forgeId}/channels`, { body: { name: "voice-check", type: "VOICE" }, token: owner.token, csrf: owner.csrf });
const voiceChannelId = voiceChannelCreated.json?.channel?.id;
check("the owner creates a voice channel", voiceChannelCreated.status === 201 && Boolean(voiceChannelId), `status ${voiceChannelCreated.status}`);
const memberVoice = await call("POST", "/api/voice/token", { body: { channelId: voiceChannelId }, token: member.token, csrf: member.csrf });
check("a member gets a voice token", memberVoice.status === 200, `status ${memberVoice.status}`);
const outsiderVoice = await call("POST", "/api/voice/token", { body: { channelId: voiceChannelId }, token: outsider.token, csrf: outsider.csrf });
check("an outsider does not get a voice token", outsiderVoice.status === 403 || outsiderVoice.status === 404, `status ${outsiderVoice.status}`);

for (const socket of [memberSocket, outsiderSocket, memberDm, outsiderDm]) socket.close();

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);

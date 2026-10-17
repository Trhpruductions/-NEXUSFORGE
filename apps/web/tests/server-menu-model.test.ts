import test from "node:test";
import assert from "node:assert/strict";
import { MANAGE_TAB_IDS, isManageTab, manageTabsFor } from "../src/components/chat/forge-manage-tabs";
import { serverMenuItems } from "../src/components/layout/server-menu-model";

/**
 * The server rail's right-click menu and the settings panel share one tab list. These tests check the list for each
 * kind of person, and that every link the menu produces opens a tab the panel accepts.
 */

const owner = { isOwner: true, permissions: {} };
const moderator = { isOwner: false, permissions: { moderateChat: true, manageChannels: true } };
const member = { isOwner: false, permissions: {} };
const admin = { isOwner: false, permissions: { manageForge: true, manageRoles: true, banUsers: true, moderateChat: true, manageChannels: true } };

const ids = (access: Parameters<typeof manageTabsFor>[0]) => manageTabsFor(access).map((tab) => tab.id);

test("the owner sees every settings tab, and the danger tab deletes the server", () => {
  const tabs = ids(owner);
  for (const id of MANAGE_TAB_IDS) assert.ok(tabs.includes(id), `owner sees ${id}`);
  assert.equal(manageTabsFor(owner).at(-1)?.label, "Delete");
});

test("a plain member sees the common tabs and can only leave", () => {
  const tabs = ids(member);
  assert.deepEqual(tabs, ["overview", "channels", "members", "invites", "danger"]);
  assert.equal(manageTabsFor(member).at(-1)?.label, "Leave");
});

test("moderators get reports and webhooks, but not admin-only tabs", () => {
  const tabs = ids(moderator);
  assert.ok(tabs.includes("reports"));
  assert.ok(tabs.includes("webhooks"));
  assert.ok(!tabs.includes("audit"), "audit log needs manageForge");
  assert.ok(!tabs.includes("bots"), "bots are owner-only");
});

test("admin permissions open the admin tabs", () => {
  const tabs = ids(admin);
  for (const id of ["roles", "automod", "emoji", "stickers", "sounds", "bans", "audit"] as const) assert.ok(tabs.includes(id), `admin sees ${id}`);
  assert.ok(!tabs.includes("bots"));
});

test("with no access loaded yet, only the everyday tabs and Leave are offered", () => {
  assert.deepEqual(ids(undefined), ["overview", "channels", "members", "invites", "danger"]);
});

test("every settings tab id is a valid manage value, so a menu link opens the tab it names", () => {
  for (const id of MANAGE_TAB_IDS) assert.ok(isManageTab(id), `${id} is accepted`);
  assert.equal(isManageTab("not-a-tab"), false);
  assert.equal(isManageTab(null), false);
  assert.equal(isManageTab(undefined), false);
});

test("the menu opens the server, then lists the settings tabs with the danger action last", () => {
  const items = serverMenuItems({ forgeId: "forge-1", access: owner, unread: false, mentions: false });
  assert.equal(items[0].id, "open");
  assert.equal(items[0].action, "open");
  assert.ok(!items.some((item) => item.id === "read"), "no mark-as-read when nothing is unread");
  assert.equal(items.at(-1)?.id, "danger");
  assert.equal(items.at(-1)?.label, "Delete server");
  assert.equal(items.at(-1)?.danger, true);
});

test("settings items link to the manage tab, with the server id encoded", () => {
  const items = serverMenuItems({ forgeId: "a b&c", access: member, unread: false, mentions: false });
  const channels = items.find((item) => item.id === "channels");
  assert.equal(channels?.href, "/app/chat?forge=a%20b%26c&manage=channels");
  for (const item of items.filter((entry) => entry.href)) {
    const tab = new URL(item.href!, "http://local").searchParams.get("manage");
    assert.ok(isManageTab(tab), `${item.id} links to a valid tab`);
  }
});

test("mark as read appears only when the server has unread activity or mentions", () => {
  const unread = serverMenuItems({ forgeId: "f", access: member, unread: true, mentions: false });
  const mention = serverMenuItems({ forgeId: "f", access: member, unread: false, mentions: true });
  assert.ok(unread.some((item) => item.id === "read" && item.action === "read"));
  assert.ok(mention.some((item) => item.id === "read"));
});

test("a member who is not the owner sees Leave server, not Delete server", () => {
  const items = serverMenuItems({ forgeId: "f", access: member, unread: false, mentions: false });
  assert.equal(items.at(-1)?.label, "Leave server");
});

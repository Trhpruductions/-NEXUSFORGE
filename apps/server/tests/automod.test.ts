import test from "node:test";
import assert from "node:assert/strict";
import { countMentions, evaluateAutoMod, findBlockedLink, findForeignInvite, matchKeyword, normalize, type AutoModRule } from "../src/lib/automod.js";

const rule = (overrides: Partial<AutoModRule>): AutoModRule => ({
  id: "r1",
  name: "rule",
  enabled: true,
  type: "KEYWORDS",
  keywords: [],
  allowList: [],
  mentionLimit: null,
  blockMessage: true,
  alertModerators: false,
  timeoutMinutes: null,
  customMessage: null,
  exemptRoleIds: [],
  exemptChannelIds: [],
  ...overrides,
});
const ctx = { content: "", channelId: "c1", roleIds: [] as string[], exempt: false, ownInviteCodes: ["mysquad"] };

test("normalize undoes look-alike swaps and stretched letters", () => {
  assert.equal(normalize("FR33 C0iiiNS"), "fre coins");
});

test("keywords match whole words, case and look-alikes", () => {
  assert.equal(matchKeyword("get FR33 c0ins now", ["free coins"]), "free coins");
  assert.equal(matchKeyword("I'm a scammer", ["scam*"]), "scam*");
  assert.equal(matchKeyword("classic game", ["ass"]), null, "no match inside other words");
  assert.equal(matchKeyword("free coins? no thanks", ["free coins"], ["free coins? no"]), null, "allow-list phrases are skipped");
});

test("links are blocked unless their domain is allowed", () => {
  assert.equal(findBlockedLink("watch https://twitch.tv/me", ["twitch.tv"]), null);
  assert.equal(findBlockedLink("clips at clips.twitch.tv/abc", ["twitch.tv"]), null, "subdomains of allowed domains pass");
  assert.ok(findBlockedLink("go to https://free-skins.ru/claim", ["twitch.tv"]));
  assert.ok(findBlockedLink("visit freenitro.gift.xyz", []));
  assert.equal(findBlockedLink("no links here, just text.", []), null);
});

test("invites to other servers are caught; this forge's own invite is fine", () => {
  assert.ok(findForeignInvite("join discord.gg/abc123", ["mysquad"]));
  assert.ok(findForeignInvite("https://vexoragaming.com/invite/otherforge", ["mysquad"]));
  assert.equal(findForeignInvite("https://vexoragaming.com/invite/mysquad", ["mysquad"]), null);
});

test("mention spam counts distinct people", () => {
  assert.equal(countMentions("@a @b @a @c"), 3);
  const hit = evaluateAutoMod([rule({ type: "MENTION_SPAM", mentionLimit: 2 })], { ...ctx, content: "@a @b @c" });
  assert.equal(hit?.match, "3 mentions");
});

test("exempt members, roles and channels skip the rules", () => {
  const rules = [rule({ keywords: ["badword"], exemptRoleIds: ["mods"], exemptChannelIds: ["nsfw"] })];
  assert.ok(evaluateAutoMod(rules, { ...ctx, content: "badword" }));
  assert.equal(evaluateAutoMod(rules, { ...ctx, content: "badword", exempt: true }), null);
  assert.equal(evaluateAutoMod(rules, { ...ctx, content: "badword", roleIds: ["mods"] }), null);
  assert.equal(evaluateAutoMod(rules, { ...ctx, content: "badword", channelId: "nsfw" }), null);
  assert.equal(evaluateAutoMod([{ ...rules[0], enabled: false }], { ...ctx, content: "badword" }), null, "disabled rules do nothing");
});

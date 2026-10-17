import test from "node:test";
import assert from "node:assert/strict";

// storage.ts loads env.ts. Set what it needs before importing; the file store is never touched here
// because every test injects its own write, commit and remove.
process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET ??= "a".repeat(48);
process.env.JWT_REFRESH_SECRET ??= "b".repeat(48);
process.env.API_PUBLIC_URL = "https://api.example.test";
process.env.S3_PUBLIC_BASE_URL = "";
process.env.S3_BUCKET_NAME = "";
const { ownedProfileImageKey, swapStoredImage } = await import("../src/lib/storage.js");

const OLD_URL = "https://api.example.test/uploads/profiles/user-1/avatar-old.png";
const OLD_KEY = "profiles/user-1/avatar-old.png";
const NEW_FILE = {
  key: "profiles/user-1/avatar-new.png",
  url: "https://api.example.test/uploads/profiles/user-1/avatar-new.png",
};

/** Records every storage step in the order it happens. */
function steps(options: {
  previousUrl?: string | null;
  failWrite?: boolean;
  failCommit?: boolean;
  failRemove?: string;
  clear?: boolean;
}) {
  const events: string[] = [];
  const reported: string[] = [];
  const swap = swapStoredImage({
    ...(options.clear
      ? {}
      : {
          write: async () => {
            events.push("write");
            if (options.failWrite) throw new Error("disk full");
            return NEW_FILE;
          },
        }),
    commit: async (url) => {
      events.push(`commit:${url}`);
      if (options.failCommit) throw new Error("database unavailable");
      return options.previousUrl === undefined ? OLD_URL : options.previousUrl;
    },
    keyForOwnedUrl: (url) => ownedProfileImageKey(url, "user-1"),
    remove: async (key) => {
      events.push(`remove:${key}`);
      if (options.failRemove === key) throw new Error("file locked");
    },
    onCleanupError: (_error, key) => reported.push(key),
  });
  return { swap, events, reported };
}

test("replacing a picture writes the new file, then switches the row, then removes the old file", async () => {
  const { swap, events, reported } = steps({});
  const result = await swap;
  assert.deepEqual(events, ["write", `commit:${NEW_FILE.url}`, `remove:${OLD_KEY}`]);
  assert.equal(result.url, NEW_FILE.url);
  assert.equal(result.removedKey, OLD_KEY);
  assert.deepEqual(reported, []);
});

test("if the database write fails, the old file is kept and only the new file is removed", async () => {
  const { swap, events } = steps({ failCommit: true });
  await assert.rejects(swap, /database unavailable/);
  assert.deepEqual(events, ["write", `commit:${NEW_FILE.url}`, `remove:${NEW_FILE.key}`]);
  assert.equal(events.includes(`remove:${OLD_KEY}`), false, "the current picture must survive a failed replacement");
});

test("if writing the new file fails, nothing else happens", async () => {
  const { swap, events } = steps({ failWrite: true });
  await assert.rejects(swap, /disk full/);
  assert.deepEqual(events, ["write"]);
});

test("a failed removal of the old file is reported, and the replacement still succeeds", async () => {
  const { swap, events, reported } = steps({ failRemove: OLD_KEY });
  const result = await swap;
  assert.equal(result.url, NEW_FILE.url);
  assert.equal(events[events.length - 1], `remove:${OLD_KEY}`);
  assert.deepEqual(reported, [OLD_KEY]);
});

test("removing a picture clears the row first and deletes the old file only after that", async () => {
  const { swap, events } = steps({ clear: true });
  const result = await swap;
  assert.deepEqual(events, ["commit:null", `remove:${OLD_KEY}`]);
  assert.equal(result.url, null);
  assert.equal(result.removedKey, OLD_KEY);
});

test("removing a picture keeps the file when the database write fails", async () => {
  const { swap, events } = steps({ clear: true, failCommit: true });
  await assert.rejects(swap, /database unavailable/);
  assert.deepEqual(events, ["commit:null"]);
});

test("a previous picture that is not this user's profile file is never deleted", async () => {
  const foreign = steps({ previousUrl: "https://evil.example/uploads/profiles/user-1/avatar-old.png" });
  await foreign.swap;
  assert.equal(foreign.events.some((event) => event.startsWith("remove:")), false);

  const otherUser = steps({ previousUrl: "https://api.example.test/uploads/profiles/user-2/avatar-old.png" });
  await otherUser.swap;
  assert.equal(otherUser.events.some((event) => event.startsWith("remove:")), false);

  // A chat attachment or older upload that happens to be an avatar URL is left alone too.
  const chatUpload = steps({ previousUrl: "https://api.example.test/uploads/user-1/1700-abc-photo.png" });
  await chatUpload.swap;
  assert.equal(chatUpload.events.some((event) => event.startsWith("remove:")), false);
});

test("a row that still points at the file just written does not remove it", async () => {
  const { swap, events } = steps({ previousUrl: NEW_FILE.url });
  const result = await swap;
  assert.equal(events.some((event) => event === `remove:${NEW_FILE.key}`), false);
  assert.equal(result.removedKey, null);
});

test("only this user's profile pictures map to deletable keys", () => {
  assert.equal(ownedProfileImageKey(OLD_URL, "user-1"), OLD_KEY);
  assert.equal(ownedProfileImageKey(OLD_URL, "user-2"), null);
  assert.equal(ownedProfileImageKey("https://api.example.test/uploads/user-1/1700-abc.png", "user-1"), null);
  assert.equal(ownedProfileImageKey("https://evil.example/uploads/profiles/user-1/avatar-old.png", "user-1"), null);
  assert.equal(ownedProfileImageKey("https://api.example.test/uploads/profiles/user-1/../../user-2/a.png", "user-1"), null);
  assert.equal(ownedProfileImageKey("not a url", "user-1"), null);
});

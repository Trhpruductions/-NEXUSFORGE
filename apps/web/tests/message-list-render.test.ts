import { test } from "node:test";
import assert from "node:assert/strict";
import { installMiniDom } from "./helpers/mini-dom";
import type { Message } from "../src/lib/api";

/**
 * Render counts for the channel message list, with the real component and react-dom (on a tiny DOM stand-in).
 *
 * Counting rows without touching product code: every MessageRow render formats its timestamp exactly once with
 * Date#toLocaleTimeString, and nothing else in this tree calls it, so the number of calls is the number of rows
 * React rendered.
 */

const dom = installMiniDom();

function makeMessages(count: number): Message[] {
  const start = Date.UTC(2026, 9, 18, 12, 0, 0);
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    channelId: "c1",
    authorId: index % 3 === 0 ? "me" : `user${index % 5}`,
    content: `Message number ${index} with **bold** text, a \`code\` span and an @mention`,
    edited: false,
    createdAt: new Date(start + index * 60_000).toISOString(),
    reactions: [],
    author: { id: index % 3 === 0 ? "me" : `user${index % 5}`, username: `player${index % 5}`, premium: false },
  }));
}

async function setup() {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = await import("./helpers/react-query");
  const { MessageList } = await import("../src/components/chat/message-list");

  let rowRenders = 0;
  const original = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleTimeString = function (this: Date, ...args: Parameters<Date["toLocaleTimeString"]>) {
    rowRenders += 1;
    return original.apply(this, args);
  };

  const noop = () => undefined;
  const asyncNoop = async () => undefined;
  const stable = { onLoadOlder: noop, onReply: noop, onEdit: asyncNoop, onDelete: asyncNoop, onReact: noop };
  const members: never[] = [];
  const roles: never[] = [];
  const emojis = {};

  // Stands in for the chat page: the message box draft lives in the same component that renders the list.
  const controls: { setDraft: (value: string) => void; setMessages: (messages: Message[]) => void } = { setDraft: noop, setMessages: noop };
  function ChatPageLike({ initial, unstableProps }: { initial: Message[]; unstableProps: boolean }) {
    const [draft, setDraft] = React.useState("");
    const [messages, setMessages] = React.useState(initial);
    React.useEffect(() => {
      controls.setDraft = setDraft;
      controls.setMessages = setMessages;
    }, []);
    const callbacks = unstableProps
      ? { onLoadOlder: () => undefined, onReply: () => undefined, onEdit: async () => undefined, onDelete: async () => undefined, onReact: () => undefined }
      : stable;
    return React.createElement(
      "div",
      null,
      React.createElement("input", { value: draft, readOnly: true, "aria-label": "Message" }),
      React.createElement(MessageList, {
        // With unstableProps, a new array (same message objects) and new callbacks on every render, as before the fix.
        messages: unstableProps ? [...messages] : messages,
        selfId: "me",
        canModerate: false,
        members,
        roles,
        ownerId: "",
        hasOlder: false,
        loadingOlder: false,
        emojis,
        lastReadAt: null,
        ...callbacks,
      }),
    );
  }

  const container = dom.createContainer();
  const root = createRoot(container as unknown as HTMLElement);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const render = async (initial: Message[], unstableProps = false) => {
    await React.act(async () => {
      root.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(ChatPageLike, { initial, unstableProps })));
    });
  };
  const type = async (text: string) => {
    for (let index = 1; index <= text.length; index += 1) {
      await React.act(async () => controls.setDraft(text.slice(0, index)));
    }
  };
  const updateMessages = async (messages: Message[]) => {
    await React.act(async () => controls.setMessages(messages));
  };
  const counted = () => rowRenders;
  const cleanup = async () => {
    await React.act(async () => root.unmount());
    Date.prototype.toLocaleTimeString = original;
    queryClient.clear();
  };
  return { React, render, type, updateMessages, counted, cleanup, container };
}

test("typing in the message box re-renders no message rows", async () => {
  const harness = await setup();
  const messages = makeMessages(60);
  await harness.render(messages);
  const afterMount = harness.counted();
  assert.equal(afterMount, 60, "each row renders once on mount");
  assert.equal(harness.container.textContent.includes("Message number 59"), true);

  await harness.type("hello there, typing a message");
  assert.equal(harness.counted() - afterMount, 0, "keystrokes rendered message rows");
  await harness.cleanup();
});

test("rows stay put even if the page hands the list new callbacks and a new array on every render", async () => {
  const harness = await setup();
  await harness.render(makeMessages(40), true);
  const afterMount = harness.counted();
  assert.equal(afterMount, 40);
  await harness.type("abcdefghij");
  assert.equal(harness.counted() - afterMount, 0);
  await harness.cleanup();
});

test("a change to one message re-renders that row only; a new message renders just the new row", async () => {
  const harness = await setup();
  const messages = makeMessages(30);
  await harness.render(messages);
  const start = harness.counted();

  // Someone reacts to message 10 (the realtime handler replaces just that message object).
  const reacted = messages.map((message) => (message.id === "m10" ? { ...message, reactions: [{ id: "r1", messageId: "m10", userId: "user1", emoji: "🔥" }] as Message["reactions"] } : message));
  await harness.updateMessages(reacted);
  assert.equal(harness.counted() - start, 1);

  const next = [...reacted, { ...makeMessages(31)[30] }];
  await harness.updateMessages(next);
  assert.equal(harness.counted() - start, 2);
  await harness.cleanup();
});

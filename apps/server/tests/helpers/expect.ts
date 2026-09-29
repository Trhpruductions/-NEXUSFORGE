import assert from "node:assert/strict";

/**
 * A very small `expect` over node:assert, so suites written against a Jest-style API can
 * run on the built-in test runner without pulling in another test framework. Only the
 * matchers this repo actually uses are implemented; anything else should be added here
 * rather than reached for implicitly.
 */

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function matcher(expected?: RegExp | string) {
  return (error: unknown) => {
    if (expected === undefined) return true;
    const message = messageOf(error);
    return expected instanceof RegExp ? expected.test(message) : message.includes(expected);
  };
}

export function expect(actual: any) {
  return {
    toBe(expected: unknown) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: unknown) {
      assert.deepStrictEqual(actual, expected);
    },
    toBeDefined() {
      assert.notStrictEqual(actual, undefined, "expected value to be defined");
    },
    toBeUndefined() {
      assert.strictEqual(actual, undefined);
    },
    toBeNull() {
      assert.strictEqual(actual, null);
    },
    toBeTruthy() {
      assert.ok(actual, `expected ${String(actual)} to be truthy`);
    },
    toBeFalsy() {
      assert.ok(!actual, `expected ${String(actual)} to be falsy`);
    },
    toBeGreaterThan(value: number) {
      assert.ok(actual > value, `expected ${String(actual)} to be greater than ${value}`);
    },
    toBeGreaterThanOrEqual(value: number) {
      assert.ok(actual >= value, `expected ${String(actual)} to be at least ${value}`);
    },
    toBeLessThan(value: number) {
      assert.ok(actual < value, `expected ${String(actual)} to be less than ${value}`);
    },
    toBeLessThanOrEqual(value: number) {
      assert.ok(actual <= value, `expected ${String(actual)} to be at most ${value}`);
    },
    toContain(value: unknown) {
      assert.ok(
        typeof actual === "string" ? actual.includes(String(value)) : Array.isArray(actual) && actual.includes(value),
        `expected ${String(actual)} to contain ${String(value)}`,
      );
    },
    toHaveLength(length: number) {
      assert.strictEqual(actual?.length, length);
    },
    toThrow(expected?: RegExp | string) {
      assert.throws(actual, matcher(expected));
    },
    get rejects() {
      return {
        async toThrow(expected?: RegExp | string) {
          await assert.rejects(typeof actual === "function" ? actual() : actual, matcher(expected));
        },
      };
    },
    get resolves() {
      return {
        async toBe(expected: unknown) {
          assert.strictEqual(await actual, expected);
        },
      };
    },
  };
}

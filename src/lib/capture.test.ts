import { describe, expect, test } from "bun:test";
import { windowKey } from "./capture";

describe("windowKey", () => {
  test("uses CGWindowID when present (stable across array reordering)", () => {
    expect(windowKey({ pid: 100, window_index: 0, window_id: 42 })).toBe("wid:42");
    expect(windowKey({ pid: 999, window_index: 5, window_id: 42 })).toBe("wid:42");
  });

  test("falls back to pid:window_index when window_id is 0 or missing", () => {
    expect(windowKey({ pid: 100, window_index: 3, window_id: 0 })).toBe("100:3");
    expect(windowKey({ pid: 100, window_index: 3 })).toBe("100:3");
  });

  test("different windows of the same process produce different keys", () => {
    const a = windowKey({ pid: 100, window_index: 0, window_id: 1 });
    const b = windowKey({ pid: 100, window_index: 1, window_id: 2 });
    expect(a).not.toBe(b);
  });
});

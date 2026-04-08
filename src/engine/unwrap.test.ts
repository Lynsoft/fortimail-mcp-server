import { describe, it, expect } from "vitest";
import { unwrapList } from "./unwrap.js";

describe("unwrapList", () => {
  it("reads data array", () => {
    expect(unwrapList({ data: [{ a: 1 }] })).toEqual([{ a: 1 }]);
  });

  it("reads legacy collection array", () => {
    expect(unwrapList({ collection: [{ b: 2 }] })).toEqual([{ b: 2 }]);
  });
});

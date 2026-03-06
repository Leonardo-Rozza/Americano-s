import { describe, expect, it } from "vitest";
import { generateSeedOrder } from "../seeding";

describe("seeding", () => {
  it("generateSeedOrder(16) coincide con ITF/FIP", () => {
    expect(generateSeedOrder(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
  });

  it("generateSeedOrder(8) produce orden valido", () => {
    expect(generateSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

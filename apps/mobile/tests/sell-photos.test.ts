import { describe, expect, it } from "vitest";
import { movePhoto } from "../lib/move-photo";

describe("movePhoto", () => {
  const list = ["a", "b", "c", "d"];

  it("moves a photo to the front, making it the cover", () => {
    expect(movePhoto(list, 2, 0)).toEqual(["c", "a", "b", "d"]);
  });

  it("moves a photo later", () => {
    expect(movePhoto(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("changes nothing when dropped where it started or out of range", () => {
    expect(movePhoto(list, 1, 1)).toEqual(list);
    expect(movePhoto(list, -1, 2)).toEqual(list);
    expect(movePhoto(list, 1, 9)).toEqual(list);
  });

  it("never changes the list it was given", () => {
    movePhoto(list, 3, 0);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });
});

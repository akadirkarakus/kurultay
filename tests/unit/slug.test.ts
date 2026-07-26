import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases, strips Turkish diacritics, and hyphenates", () => {
    expect(slugify("Recep Tayyip Erdoğan")).toBe("recep-tayyip-erdogan");
    expect(slugify("İnternet Ünlüleri")).toBe("internet-unluleri");
    expect(slugify("Kıvanç Tatlıtuğ")).toBe("kivanc-tatlitug");
  });
});

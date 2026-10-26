import { describe, expect, it } from "vitest";
import { readNotFoundSuggestions } from "../not-found-data";

const suggestions = {
  authorSlug: "tara",
  displayName: "Tara",
  programs: [{ id: "p1", slug: "base", title: "Base" }],
};

describe("readNotFoundSuggestions", () => {
  it("passes a well-formed suggestions payload through", () => {
    expect(readNotFoundSuggestions(suggestions)).toBe(suggestions);
  });

  it("treats missing, malformed, or empty data as no suggestions", () => {
    expect(readNotFoundSuggestions(undefined)).toBeNull();
    expect(readNotFoundSuggestions(null)).toBeNull();
    expect(readNotFoundSuggestions("tara")).toBeNull();
    expect(readNotFoundSuggestions({ authorSlug: "tara" })).toBeNull();
    expect(
      readNotFoundSuggestions({ ...suggestions, programs: [] }),
    ).toBeNull();
  });
});

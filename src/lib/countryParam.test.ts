import { describe, expect, it } from "bun:test";
import { parseCountryParam, resolveCountry } from "./countryParam";

describe("parseCountryParam", () => {
  it("returns the code when input is a valid lowercase 2-letter code", () => {
    expect(parseCountryParam("us")).toBe("us");
    expect(parseCountryParam("de")).toBe("de");
  });

  it("lowercases uppercase and mixed-case input", () => {
    expect(parseCountryParam("DE")).toBe("de");
    expect(parseCountryParam("Ru")).toBe("ru");
  });

  it("trims surrounding whitespace", () => {
    expect(parseCountryParam("  fr ")).toBe("fr");
  });

  it("returns null when input is not a 2-letter code", () => {
    expect(parseCountryParam("usa")).toBeNull();
    expect(parseCountryParam("d")).toBeNull();
    expect(parseCountryParam("de1")).toBeNull();
    expect(parseCountryParam("1e")).toBeNull();
  });

  it("returns null when input is empty or missing", () => {
    expect(parseCountryParam("")).toBeNull();
    expect(parseCountryParam("   ")).toBeNull();
    expect(parseCountryParam(null)).toBeNull();
    expect(parseCountryParam(undefined)).toBeNull();
  });
});

describe("resolveCountry", () => {
  it("prefers a valid param over the fallback", () => {
    expect(resolveCountry("de", "fr")).toBe("de");
  });

  it("normalizes the param before preferring it", () => {
    expect(resolveCountry("DE", "fr")).toBe("de");
  });

  it("falls back when the param is invalid", () => {
    expect(resolveCountry("usa", "fr")).toBe("fr");
    expect(resolveCountry("", "fr")).toBe("fr");
    expect(resolveCountry(null, "fr")).toBe("fr");
  });

  it("falls back to us when neither param nor fallback is valid", () => {
    expect(resolveCountry(null, "us")).toBe("us");
    expect(resolveCountry(null, "")).toBe("us");
    expect(resolveCountry("usa", "1nvalid")).toBe("us");
  });
});

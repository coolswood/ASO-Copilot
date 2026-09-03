import { describe, expect, it } from "bun:test";
import { metricColor } from "./metricColor";

describe("metricColor", () => {
  it("returns success for high values and danger for low values by default", () => {
    expect(metricColor(80)).toBe("var(--success)");
    expect(metricColor(10)).toBe("var(--danger)");
  });

  it("returns warning for the middle band by default", () => {
    expect(metricColor(30)).toBe("var(--warning)");
    expect(metricColor(59)).toBe("var(--warning)");
  });

  it("treats the 60/30 boundaries as good/mid", () => {
    expect(metricColor(60)).toBe("var(--success)");
    expect(metricColor(29)).toBe("var(--danger)");
  });

  it("flips the good/bad direction when inverse", () => {
    expect(metricColor(20, true)).toBe("var(--success)");
    expect(metricColor(80, true)).toBe("var(--danger)");
    expect(metricColor(50, true)).toBe("var(--warning)");
  });
});

import { describe, expect, it } from "vitest";
import { markdownComponents } from "@/src/lib/markdown-components";

describe("markdownComponents", () => {
  it("defines distinct heading renderers", () => {
    expect(markdownComponents.h1).toBeDefined();
    expect(markdownComponents.h2).toBeDefined();
    expect(markdownComponents.h3).toBeDefined();
    expect(markdownComponents.h1).not.toBe(markdownComponents.h2);
  });
});

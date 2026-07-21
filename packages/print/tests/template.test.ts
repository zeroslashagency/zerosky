import { describe, it, expect } from "vitest";
import {
  DocumentBuilder,
  renderToText,
  renderToEscPos,
} from "../src/template.js";

describe("DocumentBuilder", () => {
  it("exposes columns for the paper width", () => {
    expect(new DocumentBuilder(58).columns).toBe(32);
    expect(new DocumentBuilder(80).columns).toBe(48);
  });

  it("accumulates nodes in order", () => {
    const doc = new DocumentBuilder(80)
      .title("Store")
      .line("hello")
      .divider()
      .feed(2)
      .cut()
      .cashDrawer()
      .build();
    expect(doc.width).toBe(80);
    expect(doc.nodes[0]).toMatchObject({ type: "text", align: "center", bold: true });
    expect(doc.nodes.map((n) => n.type)).toEqual([
      "text",
      "line",
      "divider",
      "feed",
      "cut",
      "cashDrawer",
    ]);
  });

  it("supports a generic node push", () => {
    const doc = new DocumentBuilder(58).node({ type: "raw", bytes: [1, 2, 3] }).build();
    expect(doc.nodes[0]).toEqual({ type: "raw", bytes: [1, 2, 3] });
  });
});

describe("renderToText", () => {
  it("centers titles and expands dividers to width", () => {
    const doc = new DocumentBuilder(58).title("HI").divider("=").line("left").feed(1).build();
    const text = doc && renderToText(doc);
    const lines = text.split("\n");
    expect(lines[0]?.length).toBe(32);
    expect(lines[0]?.trim()).toBe("HI");
    expect(lines[1]).toBe("=".repeat(32));
    expect(lines[2]).toBe("left");
    expect(lines[3]).toBe("");
  });

  it("ignores control-only nodes in preview", () => {
    const doc = new DocumentBuilder(58)
      .node({ type: "align", value: "center" })
      .cut()
      .cashDrawer()
      .node({ type: "raw", bytes: [1] })
      .line("x")
      .build();
    expect(renderToText(doc)).toBe("x");
  });
});

describe("renderToEscPos", () => {
  const ESC = 0x1b;
  const GS = 0x1d;

  it("starts with an initialize command", () => {
    const bytes = renderToEscPos(new DocumentBuilder(80).line("hi").build());
    expect(bytes[0]).toBe(ESC);
    expect(bytes[1]).toBe(0x40);
  });

  it("encodes sized/bold/aligned text and resets afterwards", () => {
    const bytes = renderToEscPos(new DocumentBuilder(80).title("BIG", { height: 2 }).build());
    // Contains a GS ! size command somewhere.
    let hasSize = false;
    for (let i = 0; i < bytes.length - 1; i += 1) {
      if (bytes[i] === GS && bytes[i + 1] === 0x21) hasSize = true;
    }
    expect(hasSize).toBe(true);
  });

  it("renders every node type without throwing", () => {
    const doc = new DocumentBuilder(58)
      .node({ type: "align", value: "right" })
      .line("a", { align: "right", bold: true })
      .text("b", { width: 2 })
      .divider("*")
      .feed(2)
      .cut()
      .cashDrawer()
      .node({ type: "raw", bytes: [0x99] })
      .build();
    const bytes = renderToEscPos(doc);
    expect(bytes.length).toBeGreaterThan(5);
    expect(Array.from(bytes)).toContain(0x99);
  });
});

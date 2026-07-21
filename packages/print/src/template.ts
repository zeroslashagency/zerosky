// @zerosky/print — template engine
// A small, declarative document model that templates emit. The renderer turns
// the model into ESC/POS bytes, so template authors never touch raw commands.

import { EscPosBuilder } from "./escpos.js";
import type { Alignment, PaperWidth } from "./escpos.js";
import { COLUMNS_FOR_WIDTH } from "./escpos.js";
import { center, divider } from "./formatter.js";

/** A single renderable node in a print document. */
export type PrintNode =
  | { type: "text"; value: string; align?: Alignment; bold?: boolean; width?: 1 | 2; height?: 1 | 2 }
  | { type: "line"; value: string; align?: Alignment; bold?: boolean }
  | { type: "divider"; char?: string }
  | { type: "feed"; lines?: number }
  | { type: "align"; value: Alignment }
  | { type: "cut" }
  | { type: "cashDrawer" }
  | { type: "raw"; bytes: number[] };

/** A complete document: paper width + ordered nodes. */
export interface PrintDocument {
  width: PaperWidth;
  nodes: PrintNode[];
}

/**
 * Fluent helper for assembling a {@link PrintDocument}. Keeps templates concise
 * and centralizes column math via the configured paper width.
 */
export class DocumentBuilder {
  readonly width: PaperWidth;
  readonly columns: number;
  private readonly nodes: PrintNode[] = [];

  constructor(width: PaperWidth) {
    this.width = width;
    this.columns = COLUMNS_FOR_WIDTH[width];
  }

  node(node: PrintNode): this {
    this.nodes.push(node);
    return this;
  }

  text(value: string, opts: Omit<Extract<PrintNode, { type: "text" }>, "type" | "value"> = {}): this {
    return this.node({ type: "text", value, ...opts });
  }

  line(value = "", opts: Omit<Extract<PrintNode, { type: "line" }>, "type" | "value"> = {}): this {
    return this.node({ type: "line", value, ...opts });
  }

  /** Center a title across the full width. */
  title(value: string, opts: { bold?: boolean; width?: 1 | 2; height?: 1 | 2 } = {}): this {
    return this.node({ type: "text", value, align: "center", bold: opts.bold ?? true, width: opts.width, height: opts.height });
  }

  divider(char = "-"): this {
    return this.node({ type: "divider", char });
  }

  feed(lines = 1): this {
    return this.node({ type: "feed", lines });
  }

  cut(): this {
    return this.node({ type: "cut" });
  }

  cashDrawer(): this {
    return this.node({ type: "cashDrawer" });
  }

  build(): PrintDocument {
    return { width: this.width, nodes: this.nodes };
  }
}

/**
 * Render a document to a plain-text preview (control codes stripped).
 * Useful for tests and on-screen previews.
 */
export function renderToText(doc: PrintDocument): string {
  const cols = COLUMNS_FOR_WIDTH[doc.width];
  const out: string[] = [];
  for (const node of doc.nodes) {
    switch (node.type) {
      case "text":
      case "line": {
        const value = node.align === "center" ? center(node.value, cols) : node.value;
        out.push(value);
        break;
      }
      case "divider":
        out.push(divider(cols, node.char ?? "-"));
        break;
      case "feed":
        for (let i = 0; i < (node.lines ?? 1); i += 1) out.push("");
        break;
      case "align":
      case "cut":
      case "cashDrawer":
      case "raw":
        break;
    }
  }
  return out.join("\n");
}

/** Render a document to ESC/POS bytes ready for a transport. */
export function renderToEscPos(doc: PrintDocument): Uint8Array {
  const b = new EscPosBuilder();
  const cols = COLUMNS_FOR_WIDTH[doc.width];
  b.initialize();

  for (const node of doc.nodes) {
    switch (node.type) {
      case "text":
      case "line": {
        if (node.align) b.align(node.align);
        if (node.bold) b.bold(true);
        const sized = node.type === "text" && (node.width || node.height);
        if (sized) b.size(node.width ?? 1, node.height ?? 1);
        b.line(node.value);
        if (sized) b.normalSize();
        if (node.bold) b.bold(false);
        if (node.align && node.align !== "left") b.align("left");
        break;
      }
      case "divider":
        b.align("left").line(divider(cols, node.char ?? "-"));
        break;
      case "feed":
        b.feed(node.lines ?? 1);
        break;
      case "align":
        b.align(node.value);
        break;
      case "cut":
        b.feed(1).cut();
        break;
      case "cashDrawer":
        b.cashDrawer();
        break;
      case "raw":
        b.raw(node.bytes);
        break;
    }
  }

  return b.build();
}

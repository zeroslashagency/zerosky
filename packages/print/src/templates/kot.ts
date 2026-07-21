// @zerosky/print — Kitchen Order Ticket (KOT) template
// No prices — kitchen/bar stations only need item, quantity, and prep notes.
// Uses large text for quantity/name so it's readable across a busy line.

import { DocumentBuilder } from "../template.js";
import type { PrintDocument } from "../template.js";
import type { KotData, TemplateOptions } from "../types.js";
import { twoCol } from "../formatter.js";

function formatTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
}

/** Build a KOT document for a given station (kitchen, bar, etc.). */
export function buildKot(data: KotData, options: TemplateOptions): PrintDocument {
  const locale = options.locale ?? "en-IN";
  const doc = new DocumentBuilder(options.width);
  const cols = doc.columns;

  const stationLabel = data.station ? data.station.toUpperCase() : "KITCHEN";
  doc.title(`** ${stationLabel} **`, { height: 2 });
  doc.line(`KOT: ${data.kotNumber}`, { bold: true });
  doc.line(twoCol(`Order: ${data.orderNumber}`, formatTime(data.createdAt, locale), cols));
  doc.line(twoCol(data.orderType, data.tableName ? `Table: ${data.tableName}` : "", cols));
  doc.divider("=");

  for (const item of data.items) {
    // Emphasize quantity x name for the line cook.
    doc.text(`${item.quantity} x ${item.name}`, { bold: true, width: 2, height: 2 });
    for (const mod of item.modifiers ?? []) {
      doc.line(`   - ${mod.name}`);
    }
    if (item.notes) {
      doc.line(`   >> ${item.notes}`, { bold: true });
    }
  }

  doc.divider("=");
  doc.feed(1).cut();

  return doc.build();
}

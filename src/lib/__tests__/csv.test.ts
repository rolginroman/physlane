import { describe, expect, it } from "vitest";
import {
  buildIntakeCsv,
  buildMeasurementsCsv,
  csvField,
  MEASUREMENTS_CSV_HEADER,
  type MeasurementCsvRow,
} from "../csv";

const row = (patch: Partial<MeasurementCsvRow> = {}): MeasurementCsvRow => ({
  takenAtIso: "2026-10-17T00:00:00.000Z",
  weightKg: 72.5,
  neckCm: 38,
  chestCm: null,
  waistCm: 85,
  hipsCm: null,
  armLeftCm: 36.2,
  armRightCm: null,
  thighLeftCm: 58,
  thighRightCm: null,
  calfCm: 39,
  notes: null,
  ...patch,
});

describe("csvField — RFC 4180 escaping", () => {
  it("passes plain fields through untouched", () => {
    expect(csvField("72.5")).toBe("72.5");
    expect(csvField("hello")).toBe("hello");
    expect(csvField("2026-10-17")).toBe("2026-10-17");
  });

  it("quotes fields with commas", () => {
    expect(csvField("tight, tired")).toBe('"tight, tired"');
  });

  it("doubles embedded quotes", () => {
    expect(csvField('said "hi"')).toBe('"said ""hi"""');
    expect(csvField('"')).toBe('""""');
  });

  it("quotes fields with newlines and keeps them inside quotes", () => {
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
    expect(csvField("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("empty string stays an empty cell (no quotes)", () => {
    expect(csvField("")).toBe("");
  });
});

describe("buildMeasurementsCsv", () => {
  it("empty dataset → header only", () => {
    expect(buildMeasurementsCsv([])).toBe(MEASUREMENTS_CSV_HEADER);
  });

  it("one line per row; null cells empty, numbers raw", () => {
    const out = buildMeasurementsCsv([row()]);
    expect(out.split("\n")).toHaveLength(2);
    expect(out.split("\n")[1]).toBe(
      "2026-10-17T00:00:00.000Z,72.5,38,,85,,36.2,,58,,39,",
    );
  });

  it("quotes notes with commas/quotes/newlines, leaves plain notes bare", () => {
    const withComma = buildMeasurementsCsv([row({ notes: "post-run, tight" })]);
    expect(withComma.endsWith(',"post-run, tight"')).toBe(true);

    const withQuote = buildMeasurementsCsv([row({ notes: 'felt "light"' })]);
    expect(withQuote.endsWith(',"felt ""light"""')).toBe(true);

    const withNewline = buildMeasurementsCsv([row({ notes: "a\nb" })]);
    expect(withNewline.endsWith(',"a\nb"')).toBe(true);
    // Newline stays inside the quoted field: total physical lines still 2.
    expect(withNewline.split("\n")).toHaveLength(3);

    const plain = buildMeasurementsCsv([row({ notes: "deload week" })]);
    expect(plain.endsWith(",deload week")).toBe(true);
  });

  it("empty notes → empty trailing cell", () => {
    const out = buildMeasurementsCsv([row({ notes: null })]);
    expect(out.split("\n")[1]?.endsWith(",")).toBe(true);
  });

  it("rows keep input order", () => {
    const out = buildMeasurementsCsv([
      row({ takenAtIso: "2026-01-01T00:00:00.000Z", weightKg: 80 }),
      row({ takenAtIso: "2026-02-01T00:00:00.000Z", weightKg: 79 }),
    ]);
    const lines = out.split("\n");
    expect(lines[1]?.startsWith("2026-01-01")).toBe(true);
    expect(lines[2]?.startsWith("2026-02-01")).toBe(true);
  });
});

describe("buildIntakeCsv", () => {
  it("empty dataset → header only", () => {
    expect(buildIntakeCsv([])).toBe("date_iso,kcal");
  });

  it("one line per logged day", () => {
    const out = buildIntakeCsv([
      { date: "2026-10-15", kcal: 2100 },
      { date: "2026-10-16", kcal: 1980 },
    ]);
    expect(out).toBe("date_iso,kcal\n2026-10-15,2100\n2026-10-16,1980");
  });
});

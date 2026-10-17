'use client';

import { useEffect, useRef, useState } from "react";
import type { ICellData, IWorkbookData } from "@univerjs/core";
import "@univerjs/preset-sheets-core/lib/index.css";

type UniverRuntime = Pick<typeof import("@univerjs/core"), "BooleanNumber" | "CellValueType" | "LocaleType" | "LogLevel">;

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }
  return count;
}

function inferDelimiter(text: string, src: string) {
  if (/\.tsv(?:$|[?#])/i.test(src)) return "\t";
  const sample = text.split(/\r?\n/).slice(0, 10);
  const tabs = sample.reduce((total, line) => total + countDelimiter(line, "\t"), 0);
  const commas = sample.reduce((total, line) => total + countDelimiter(line, ","), 0);
  return tabs > commas ? "\t" : ",";
}

function parseSeparatedValues(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\r" || char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && source[i + 1] === "\n") i += 1;
    } else {
      field += char;
    }
  }

  if (field.length || row.length || source.endsWith(delimiter)) {
    row.push(field);
    rows.push(row);
  }

  return rows.length ? rows : [[""]];
}

function buildWorkbook(rows: string[][], title: string, runtime: UniverRuntime): IWorkbookData {
  const { BooleanNumber, CellValueType, LocaleType } = runtime;
  const sheetId = "csv-sheet";
  const rowCount = Math.max(rows.length, 1);
  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  const cellData: Record<number, Record<number, ICellData>> = {};
  const columnData: Record<number, { w: number }> = {};

  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!cellData[rowIndex]) cellData[rowIndex] = {};
      cellData[rowIndex][columnIndex] = { v: value, t: CellValueType.STRING };

      const nextWidth = Math.max(72, Math.min(320, value.length * 8 + 28));
      columnData[columnIndex] = { w: Math.max(columnData[columnIndex]?.w ?? 0, nextWidth) };
    });
  });

  return {
    id: "csv-workbook",
    name: title || "CSV Attachment",
    appVersion: "0.25.0",
    locale: LocaleType.EN_US,
    styles: {},
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId,
        name: "Sheet1",
        tabColor: "",
        hidden: BooleanNumber.FALSE,
        freeze: { xSplit: 0, ySplit: 0, startRow: 0, startColumn: 0 },
        rowCount,
        columnCount,
        zoomRatio: 1,
        scrollTop: 0,
        scrollLeft: 0,
        defaultColumnWidth: 96,
        defaultRowHeight: 24,
        mergeData: [],
        cellData,
        rowData: {},
        columnData,
        rowHeader: { width: 46 },
        columnHeader: { height: 24 },
        showGridlines: BooleanNumber.TRUE,
        rightToLeft: BooleanNumber.FALSE,
      },
    },
    resources: [],
  };
}

export function CsvViewer({ src, title }: { src: string; title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let univer: { dispose(): void } | null = null;

    async function loadCsv() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Failed to load CSV (${res.status})`);
        const text = await res.text();
        const delimiter = inferDelimiter(text, src);
        const rows = parseSeparatedValues(text, delimiter);
        const container = containerRef.current;
        if (!container || cancelled) return;

        const [{ createUniver, mergeLocales }, { UniverSheetsCorePreset }, enUS, runtime] = await Promise.all([
          import("@univerjs/presets"),
          import("@univerjs/preset-sheets-core"),
          import("@univerjs/preset-sheets-core/locales/en-US"),
          import("@univerjs/core"),
        ]);
        if (!containerRef.current || cancelled) return;

        const created = createUniver({
          locale: runtime.LocaleType.EN_US,
          locales: {
            [runtime.LocaleType.EN_US]: mergeLocales(enUS.default),
          },
          logLevel: runtime.LogLevel.WARN,
          presets: [
            UniverSheetsCorePreset({
              container,
              header: true,
              toolbar: true,
              ribbonType: "simple",
              formulaBar: true,
              footer: {
                sheetBar: true,
                statisticBar: true,
                menus: true,
                zoomSlider: true,
              },
              contextMenu: true,
              disableAutoFocus: true,
            }),
          ],
        });
        univer = created.univer;
        created.univerAPI.createWorkbook(buildWorkbook(rows, title || "CSV Attachment", runtime));
        created.univerAPI.toggleDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load CSV");
          setLoading(false);
        }
      }
    }

    loadCsv();

    return () => {
      cancelled = true;
      const instance = univer;
      window.setTimeout(() => {
        instance?.dispose();
      }, 0);
    };
  }, [src, title]);

  return (
    <div className="relative h-full min-h-0 bg-white dark:bg-gray-950">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300">
          Loading spreadsheet…
        </div>
      ) : null}
      <div ref={containerRef} className="h-full min-h-0 w-full" />
      {error ? <div className="absolute inset-x-0 top-0 z-20 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
    </div>
  );
}

export default CsvViewer;

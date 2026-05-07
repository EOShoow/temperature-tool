import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "outputs");
const XLSX_PATH = path.join(OUT_DIR, "苏丹港_吉赞_NASA_POWER小时气温_2016_2025.xlsx");
const SUMMARY_JSON = path.join(ROOT, "data/summary/nasa_power_t2m_export_summary_2016_2025_lst.json");
const WIDE_CSV = path.join(ROOT, "data/processed/nasa_power_t2m_by_date_hour_2016_2025_port_sudan_jizan_lst.csv");
const PORT_CSV = path.join(ROOT, "data/processed/port_sudan_t2m_hourly_2016_2025_lst.csv");
const JIZAN_CSV = path.join(ROOT, "data/processed/jizan_saudi_t2m_hourly_2016_2025_lst.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function coerceCell(value) {
  if (value === "") return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function csvToMatrix(text) {
  return parseCsv(text).map((row, rowIndex) =>
    row.map((cell) => (rowIndex === 0 ? cell.replace(/^\uFEFF/, "") : coerceCell(cell))),
  );
}

function colLetter(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function rangeFor(rows, cols) {
  return `A1:${colLetter(cols - 1)}${rows}`;
}

function addMatrixSheet(workbook, name, matrix, freezeRows = 1) {
  const sheet = workbook.worksheets.add(name);
  sheet.getRange(rangeFor(matrix.length, matrix[0].length)).values = matrix;
  try {
    sheet.freezePanes = { rows: freezeRows, columns: 0 };
  } catch {
    // Older runtime builds may not expose freeze panes as a settable property.
  }
  return sheet;
}

function setWidths(sheet, widths) {
  for (const [range, width] of widths) {
    try {
      sheet.getRange(range).format.columnWidthPx = width;
    } catch {
      // Width styling is best-effort; data correctness does not depend on it.
    }
  }
}

const summary = JSON.parse(await fs.readFile(SUMMARY_JSON, "utf8"));
const wide = csvToMatrix(await fs.readFile(WIDE_CSV, "utf8"));
const port = csvToMatrix(await fs.readFile(PORT_CSV, "utf8"));
const jizan = csvToMatrix(await fs.readFile(JIZAN_CSV, "utf8"));

const workbook = Workbook.create();
const summarySheet = workbook.worksheets.add("摘要");
const summaryRows = [
  ["项目", "内容"],
  ["数据源", summary.source],
  ["接口", summary.endpoint],
  ["参数", `${summary.parameter} (${summary.parameter_meaning})`],
  ["时间标准", `${summary.time_standard} (当地太阳时)`],
  ["年份范围", `${summary.start_year}-${summary.end_year}`],
  ["合并长表行数", summary.combined_rows],
  ["宽表行数", summary.wide_rows],
  ["苏丹港坐标", `${summary.cities.port_sudan.latitude}, ${summary.cities.port_sudan.longitude}`],
  ["苏丹港小时数", summary.cities.port_sudan.row_count],
  ["苏丹港缺失值", summary.cities.port_sudan.missing_count],
  ["苏丹港温度范围", `${summary.cities.port_sudan.t2m_c_min} 至 ${summary.cities.port_sudan.t2m_c_max} °C`],
  ["苏丹港平均温度", `${summary.cities.port_sudan.t2m_c_mean} °C`],
  ["吉赞坐标", `${summary.cities.jizan_saudi.latitude}, ${summary.cities.jizan_saudi.longitude}`],
  ["吉赞小时数", summary.cities.jizan_saudi.row_count],
  ["吉赞缺失值", summary.cities.jizan_saudi.missing_count],
  ["吉赞温度范围", `${summary.cities.jizan_saudi.t2m_c_min} 至 ${summary.cities.jizan_saudi.t2m_c_max} °C`],
  ["吉赞平均温度", `${summary.cities.jizan_saudi.t2m_c_mean} °C`],
  ["说明", "T2M 为 2 米气温小时平均值，单位摄氏度；宽表按 date + hour_lst 对齐两个城市。"],
];
summarySheet.getRange(rangeFor(summaryRows.length, 2)).values = summaryRows;
setWidths(summarySheet, [["A:A", 160], ["B:B", 620]]);

const wideSheet = addMatrixSheet(workbook, "宽表_两城市对齐", wide);
setWidths(wideSheet, [["A:A", 110], ["B:B", 90], ["C:D", 135]]);

const portSheet = addMatrixSheet(workbook, "苏丹港_长表", port);
setWidths(portSheet, [["A:E", 120], ["F:G", 90], ["H:J", 130], ["K:K", 80], ["L:N", 140]]);

const jizanSheet = addMatrixSheet(workbook, "吉赞_长表", jizan);
setWidths(jizanSheet, [["A:E", 120], ["F:G", 90], ["H:J", 130], ["K:K", 80], ["L:N", 140]]);

try {
  const defaultSheet = workbook.worksheets.get("Sheet1");
  if (defaultSheet) workbook.worksheets.delete(defaultSheet);
} catch {
  // Some builds create no default sheet, or use a different delete API.
}

await fs.mkdir(OUT_DIR, { recursive: true });

const inspectSummary = await workbook.inspect({
  kind: "table",
  range: "摘要!A1:B20",
  include: "values",
  tableMaxRows: 20,
  tableMaxCols: 2,
});
console.log(inspectSummary.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

await workbook.render({ sheetName: "摘要", range: "A1:B20", scale: 2 });
await workbook.render({ sheetName: "宽表_两城市对齐", range: "A1:D30", scale: 2 });
await workbook.render({ sheetName: "苏丹港_长表", range: "A1:N30", scale: 2 });
await workbook.render({ sheetName: "吉赞_长表", range: "A1:N30", scale: 2 });

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(XLSX_PATH);
console.log(`saved ${XLSX_PATH}`);


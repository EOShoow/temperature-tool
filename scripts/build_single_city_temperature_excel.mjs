import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const ROOT = process.cwd();

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const cityId = argValue("--city-id");
const outputName = argValue("--output-name");
const startYear = argValue("--start-year", "2016");
const endYear = argValue("--end-year", "2025");
const timeStandard = argValue("--time-standard", "lst").toLowerCase();

if (!cityId || !outputName) {
  throw new Error("用法: node scripts/build_single_city_temperature_excel.mjs --city-id kuwait_city --output-name 科威特市_NASA_POWER小时气温_2016_2025.xlsx");
}

const OUT_DIR = path.join(ROOT, "outputs");
const XLSX_PATH = path.join(OUT_DIR, outputName);
const SUMMARY_JSON = path.join(
  ROOT,
  `data/summary/nasa_power_t2m_export_summary_${startYear}_${endYear}_${cityId}_${timeStandard}.json`,
);
const WIDE_CSV = path.join(
  ROOT,
  `data/processed/nasa_power_t2m_by_date_hour_${startYear}_${endYear}_${cityId}_${timeStandard}.csv`,
);
const LONG_CSV = path.join(ROOT, `data/processed/${cityId}_t2m_hourly_${startYear}_${endYear}_${timeStandard}.csv`);

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
    // Best-effort visual affordance.
  }
  return sheet;
}

function setWidths(sheet, widths) {
  for (const [range, width] of widths) {
    try {
      sheet.getRange(range).format.columnWidthPx = width;
    } catch {
      // Width styling is best-effort.
    }
  }
}

const summary = JSON.parse(await fs.readFile(SUMMARY_JSON, "utf8"));
const city = summary.cities[cityId];
if (!city) throw new Error(`summary 中未找到 ${cityId}`);

const wide = csvToMatrix(await fs.readFile(WIDE_CSV, "utf8"));
const long = csvToMatrix(await fs.readFile(LONG_CSV, "utf8"));

const workbook = Workbook.create();
const summarySheet = workbook.worksheets.add("摘要");
const summaryRows = [
  ["项目", "内容"],
  ["数据源", summary.source],
  ["接口", summary.endpoint],
  ["参数", `${summary.parameter} (${summary.parameter_meaning})`],
  ["时间标准", `${summary.time_standard} (当地太阳时)`],
  ["年份范围", `${summary.start_year}-${summary.end_year}`],
  ["城市", `${city.city_zh} / ${city.city_en}`],
  ["国家", `${city.country_zh} / ${city.country_en}`],
  ["坐标", `${city.latitude}, ${city.longitude}`],
  ["小时数", city.row_count],
  ["缺失值", city.missing_count],
  ["温度范围", `${city.t2m_c_min} 至 ${city.t2m_c_max} °C`],
  ["平均温度", `${city.t2m_c_mean} °C`],
  ["说明", "T2M 为 2 米气温小时平均值，单位摄氏度；宽表按 date + hour_lst 展开。"],
];
summarySheet.getRange(rangeFor(summaryRows.length, 2)).values = summaryRows;
setWidths(summarySheet, [["A:A", 150], ["B:B", 620]]);

const wideSheet = addMatrixSheet(workbook, "宽表_按日期小时", wide);
setWidths(wideSheet, [["A:A", 110], ["B:B", 90], ["C:C", 140]]);

const longSheet = addMatrixSheet(workbook, `${city.city_zh}_长表`, long);
setWidths(longSheet, [["A:E", 120], ["F:G", 90], ["H:J", 130], ["K:K", 80], ["L:N", 140]]);

try {
  const defaultSheet = workbook.worksheets.get("Sheet1");
  if (defaultSheet) workbook.worksheets.delete(defaultSheet);
} catch {
  // Some builds create no default sheet.
}

await fs.mkdir(OUT_DIR, { recursive: true });

const inspectSummary = await workbook.inspect({
  kind: "table",
  range: "摘要!A1:B15",
  include: "values",
  tableMaxRows: 15,
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

await workbook.render({ sheetName: "摘要", range: "A1:B15", scale: 2 });
await workbook.render({ sheetName: "宽表_按日期小时", range: "A1:C30", scale: 2 });
await workbook.render({ sheetName: `${city.city_zh}_长表`, range: "A1:N30", scale: 2 });

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(XLSX_PATH);
console.log(`saved ${XLSX_PATH}`);


"use strict";

const TOOL_VERSION = "0.1.0";
const NASA_ENDPOINT = "https://power.larc.nasa.gov/api/temporal/hourly/point";
const PARAMETER = "T2M";
const COMMUNITY = "AG";
const DEFAULT_SAMPLE = [
  "site_id,name,latitude,longitude,country",
  "kuwait_city,科威特市,29.3759,47.9774,科威特",
  "jizan_saudi,吉赞,16.8892,42.5511,沙特阿拉伯",
].join("\n");

const HOT_CITIES = [
  ["ahvaz", "阿瓦士", 31.3183, 48.6706, "伊朗"],
  ["basra", "巴士拉", 30.5085, 47.7804, "伊拉克"],
  ["jacobabad", "雅各布阿巴德", 28.281, 68.4388, "巴基斯坦"],
  ["riyadh", "利雅得", 24.7136, 46.6753, "沙特阿拉伯"],
  ["mecca", "麦加", 21.3891, 39.8579, "沙特阿拉伯"],
  ["kuwait_city", "科威特市", 29.3759, 47.9774, "科威特"],
  ["jizan_saudi", "吉赞", 16.8892, 42.5511, "沙特阿拉伯"],
  ["port_sudan", "苏丹港", 19.6158, 37.2164, "苏丹"],
];

const elements = {
  csvInput: document.getElementById("csvInput"),
  fileInput: document.getElementById("fileInput"),
  loadHotCities: document.getElementById("loadHotCities"),
  downloadTemplate: document.getElementById("downloadTemplate"),
  startYear: document.getElementById("startYear"),
  endYear: document.getElementById("endYear"),
  timeStandard: document.getElementById("timeStandard"),
  threshold: document.getElementById("threshold"),
  refreshCache: document.getElementById("refreshCache"),
  runButton: document.getElementById("runButton"),
  clearCache: document.getElementById("clearCache"),
  progressBar: document.getElementById("progressBar"),
  currentTask: document.getElementById("currentTask"),
  runSummary: document.getElementById("runSummary"),
  warnings: document.getElementById("warnings"),
  summaryTableBody: document.querySelector("#summaryTable tbody"),
  downloadButtons: document.getElementById("downloadButtons"),
  cacheStatus: document.getElementById("cacheStatus"),
};

let activeResult = null;

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows, columns, metadataLines = []) {
  const lines = [];
  for (const line of metadataLines) {
    lines.push(`# ${line}`);
  }
  lines.push(columns.join(","));
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(","));
  }
  return `\ufeff${lines.join("\n")}\n`;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function hotCitiesCsv() {
  return rowsToCsv([
    ["site_id", "name", "latitude", "longitude", "country"],
    ...HOT_CITIES,
  ]);
}

function parseCsv(text) {
  const cleaned = text.replace(/^\ufeff/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    const next = cleaned[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some((item) => item.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((item) => item.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeSiteId(value, fallback) {
  const source = value && value.trim() ? value.trim() : fallback;
  return source
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || fallback;
}

function parseSites(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("CSV 至少需要表头和一行坐标。");
  }

  const headers = rows[0].map(normalizeHeader);
  const indexOf = (...names) => {
    for (const name of names) {
      const index = headers.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  };

  const siteIdIndex = indexOf("site_id", "id");
  const nameIndex = indexOf("name", "city", "city_name");
  const latIndex = indexOf("latitude", "lat");
  const lonIndex = indexOf("longitude", "lon", "lng");
  const countryIndex = indexOf("country", "country_zh");

  if (latIndex < 0 || lonIndex < 0) {
    throw new Error("CSV 必须包含 latitude 和 longitude 字段。");
  }

  const usedIds = new Set();
  return rows.slice(1).map((row, offset) => {
    const lineNumber = offset + 2;
    const latitude = Number(row[latIndex]);
    const longitude = Number(row[lonIndex]);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error(`第 ${lineNumber} 行 latitude 不合法：${row[latIndex] || ""}`);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error(`第 ${lineNumber} 行 longitude 不合法：${row[lonIndex] || ""}`);
    }
    const name = nameIndex >= 0 ? (row[nameIndex] || "").trim() : "";
    const fallback = `site_${offset + 1}`;
    const siteId = normalizeSiteId(siteIdIndex >= 0 ? row[siteIdIndex] : name, fallback);
    if (usedIds.has(siteId)) {
      throw new Error(`site_id 重复：${siteId}`);
    }
    usedIds.add(siteId);
    return {
      site_id: siteId,
      name: name || siteId,
      latitude,
      longitude,
      country: countryIndex >= 0 ? (row[countryIndex] || "").trim() : "",
    };
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("nasa-power-temperature-tool", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("responses")) {
        db.createObjectStore("responses", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("responses", "readonly");
    const request = tx.objectStore("responses").get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(db, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("responses", "readwrite");
    tx.objectStore("responses").put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbClear(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("responses", "readwrite");
    tx.objectStore("responses").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function cacheKey(site, year, timeStandard) {
  return [
    PARAMETER,
    COMMUNITY,
    site.latitude.toFixed(4),
    site.longitude.toFixed(4),
    year,
    timeStandard,
  ].join("|");
}

function buildNasaUrl(site, year, timeStandard) {
  const params = new URLSearchParams({
    parameters: PARAMETER,
    community: COMMUNITY,
    latitude: site.latitude.toFixed(4),
    longitude: site.longitude.toFixed(4),
    start: `${year}0101`,
    end: `${year}1231`,
    format: "JSON",
    "time-standard": timeStandard,
    header: "true",
  });
  return `${NASA_ENDPOINT}?${params.toString()}`;
}

async function fetchWithRetry(url, retries = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      }
    }
  }
  throw lastError;
}

function dateParts(key) {
  const year = key.slice(0, 4);
  const month = key.slice(4, 6);
  const day = key.slice(6, 8);
  const hour = key.slice(8, 10);
  return {
    date: `${year}-${month}-${day}`,
    hour,
    datetime: `${year}-${month}-${day} ${hour}:00`,
  };
}

function parseT2mRecords(site, year, payload, timeStandard) {
  const parameter = payload?.properties?.parameter?.[PARAMETER];
  if (!parameter || typeof parameter !== "object") {
    throw new Error(`${site.site_id} ${year}: NASA JSON 中未找到 properties.parameter.${PARAMETER}`);
  }
  const fillValue = Number(payload?.header?.fill_value ?? -999);
  const hourColumn = `hour_${timeStandard.toLowerCase()}`;
  const datetimeColumn = `datetime_${timeStandard.toLowerCase()}`;

  return Object.keys(parameter).sort().map((key) => {
    const raw = parameter[key];
    const numeric = raw === null || raw === undefined ? null : Number(raw);
    const t2m = numeric === null || !Number.isFinite(numeric) || numeric <= fillValue ? null : numeric;
    const parts = dateParts(key);
    return {
      site_id: site.site_id,
      name: site.name,
      country: site.country,
      latitude: site.latitude.toFixed(4),
      longitude: site.longitude.toFixed(4),
      date: parts.date,
      [hourColumn]: parts.hour,
      [datetimeColumn]: parts.datetime,
      t2m_c: t2m === null ? "" : t2m.toFixed(2),
      source: "NASA POWER Hourly API",
      parameter: PARAMETER,
      time_standard: timeStandard,
    };
  });
}

function summarizeSite(site, rows, threshold, cacheHits, cacheMisses, failedYears) {
  const values = rows
    .map((row) => Number(row.t2m_c))
    .filter((value) => Number.isFinite(value));
  const exceedCount = values.filter((value) => value >= threshold).length;
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    site_id: site.site_id,
    name: site.name,
    country: site.country,
    latitude: site.latitude.toFixed(4),
    longitude: site.longitude.toFixed(4),
    row_count: rows.length,
    valid_count: values.length,
    missing_count: rows.length - values.length,
    t2m_c_min: values.length ? Math.min(...values).toFixed(2) : "",
    t2m_c_mean: values.length ? (sum / values.length).toFixed(2) : "",
    t2m_c_max: values.length ? Math.max(...values).toFixed(2) : "",
    threshold_c: threshold.toFixed(1),
    exceed_count: exceedCount,
    exceed_ratio: values.length ? (exceedCount / values.length).toFixed(6) : "",
    exceed_ratio_percent: values.length ? `${((exceedCount / values.length) * 100).toFixed(2)}%` : "",
    cache_hits: cacheHits,
    cache_misses: cacheMisses,
    failed_years: failedYears.join(";"),
  };
}

function buildWideRows(longRows, sites, timeStandard) {
  const hourColumn = `hour_${timeStandard.toLowerCase()}`;
  const wideMap = new Map();
  for (const row of longRows) {
    const key = `${row.date}|${row[hourColumn]}`;
    if (!wideMap.has(key)) {
      wideMap.set(key, { date: row.date, [hourColumn]: row[hourColumn] });
    }
    wideMap.get(key)[`${row.site_id}_t2m_c`] = row.t2m_c;
  }
  const columns = ["date", hourColumn, ...sites.map((site) => `${site.site_id}_t2m_c`)];
  const rows = Array.from(wideMap.values()).sort((a, b) => {
    const left = `${a.date} ${a[hourColumn]}`;
    const right = `${b.date} ${b[hourColumn]}`;
    return left.localeCompare(right);
  });
  for (const row of rows) {
    for (const column of columns) {
      if (!(column in row)) row[column] = "";
    }
  }
  return { rows, columns };
}

function setWarning(message, error = false) {
  elements.warnings.hidden = !message;
  elements.warnings.classList.toggle("error", error);
  elements.warnings.textContent = message || "";
}

function setProgress(done, total, message) {
  elements.progressBar.max = total || 1;
  elements.progressBar.value = done;
  elements.currentTask.textContent = message;
}

function setBusy(isBusy) {
  elements.runButton.disabled = isBusy;
  elements.clearCache.disabled = isBusy;
  elements.fileInput.disabled = isBusy;
}

function metadataLines(params) {
  return [
    "source=NASA POWER Hourly API",
    `endpoint=${NASA_ENDPOINT}`,
    `parameter=${PARAMETER}`,
    "parameter_meaning=2-meter air temperature, hourly average, degree Celsius",
    `time_standard=${params.timeStandard}`,
    `start_year=${params.startYear}`,
    `end_year=${params.endYear}`,
    `threshold_c=${params.threshold}`,
    `tool_version=${TOOL_VERSION}`,
  ];
}

function renderSummaryTable(rows) {
  elements.summaryTableBody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    const cells = [
      row.site_id,
      row.name,
      row.valid_count,
      row.missing_count,
      row.t2m_c_min,
      row.t2m_c_mean,
      row.t2m_c_max,
      row.exceed_count,
      row.exceed_ratio_percent,
      row.cache_hits,
      row.cache_misses,
    ];
    for (const value of cells) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    elements.summaryTableBody.appendChild(tr);
  }
}

function setDownloadsEnabled(result) {
  activeResult = result;
  elements.downloadButtons.querySelectorAll("button").forEach((button) => {
    const type = button.dataset.download;
    button.disabled = !result || (type === "errors" && result.errors.length === 0);
  });
}

function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function resultFilename(name, extension) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  return `nasa_power_t2m_${name}_${stamp}.${extension}`;
}

function downloadResult(type) {
  if (!activeResult) return;
  const meta = metadataLines(activeResult.params);
  if (type === "summary") {
    downloadText(
      resultFilename("summary", "csv"),
      toCsv(activeResult.summaryRows, activeResult.summaryColumns, meta),
      "text/csv;charset=utf-8",
    );
  } else if (type === "long") {
    downloadText(
      resultFilename("long", "csv"),
      toCsv(activeResult.longRows, activeResult.longColumns, meta),
      "text/csv;charset=utf-8",
    );
  } else if (type === "wide") {
    downloadText(
      resultFilename("wide", "csv"),
      toCsv(activeResult.wideRows, activeResult.wideColumns, meta),
      "text/csv;charset=utf-8",
    );
  } else if (type === "errors") {
    downloadText(
      resultFilename("errors", "csv"),
      toCsv(activeResult.errors, activeResult.errorColumns, meta),
      "text/csv;charset=utf-8",
    );
  } else if (type === "manifest") {
    downloadText(
      resultFilename("manifest", "json"),
      JSON.stringify(activeResult.manifest, null, 2),
      "application/json;charset=utf-8",
    );
  }
}

function collectParams() {
  const startYear = Number(elements.startYear.value);
  const endYear = Number(elements.endYear.value);
  const threshold = Number(elements.threshold.value);
  const timeStandard = elements.timeStandard.value;
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
    throw new Error("年份范围不合法。");
  }
  if (endYear - startYear > 40) {
    throw new Error("年份跨度过大，请缩小范围后重试。");
  }
  if (!Number.isFinite(threshold)) {
    throw new Error("超温阈值不合法。");
  }
  return {
    startYear,
    endYear,
    threshold,
    timeStandard,
    refreshCache: elements.refreshCache.checked,
  };
}

async function runExport() {
  setBusy(true);
  setDownloadsEnabled(null);
  setWarning("");
  elements.summaryTableBody.innerHTML = "";

  try {
    const params = collectParams();
    const sites = parseSites(elements.csvInput.value);
    const years = [];
    for (let year = params.startYear; year <= params.endYear; year += 1) years.push(year);
    const warnings = [];
    if (sites.length > 20) warnings.push(`本次包含 ${sites.length} 个点位，超过建议的 20 个点位。`);
    if (years.length > 10) warnings.push(`本次包含 ${years.length} 个自然年，超过建议的 10 年。`);
    if (warnings.length) setWarning(warnings.join(" "));

    const db = await openDatabase();
    const longRows = [];
    const summaryRows = [];
    const errors = [];
    const requests = [];
    const total = sites.length * years.length;
    let done = 0;

    for (const site of sites) {
      const siteRows = [];
      let cacheHits = 0;
      let cacheMisses = 0;
      const failedYears = [];
      for (const year of years) {
        const key = cacheKey(site, year, params.timeStandard);
        const url = buildNasaUrl(site, year, params.timeStandard);
        const requestRecord = {
          site_id: site.site_id,
          name: site.name,
          latitude: site.latitude,
          longitude: site.longitude,
          year,
          time_standard: params.timeStandard,
          cache_key: key,
          url,
          cache_hit: false,
          ok: false,
        };

        setProgress(done, total, `请求 ${site.name} ${year} ${params.timeStandard}`);
        try {
          let payload = null;
          if (!params.refreshCache) {
            const cached = await dbGet(db, key);
            if (cached?.payload) {
              payload = cached.payload;
              cacheHits += 1;
              requestRecord.cache_hit = true;
            }
          }
          if (!payload) {
            payload = await fetchWithRetry(url, 3);
            await dbPut(db, {
              key,
              payload,
              url,
              saved_at: new Date().toISOString(),
              site: {
                latitude: site.latitude,
                longitude: site.longitude,
              },
              year,
              time_standard: params.timeStandard,
              parameter: PARAMETER,
            });
            cacheMisses += 1;
          }
          const rows = parseT2mRecords(site, year, payload, params.timeStandard);
          siteRows.push(...rows);
          longRows.push(...rows);
          requestRecord.ok = true;
          requestRecord.row_count = rows.length;
        } catch (error) {
          failedYears.push(String(year));
          requestRecord.error = error.message || String(error);
          errors.push({
            site_id: site.site_id,
            name: site.name,
            latitude: site.latitude.toFixed(4),
            longitude: site.longitude.toFixed(4),
            year,
            error: requestRecord.error,
            url,
          });
        } finally {
          requests.push(requestRecord);
          done += 1;
          setProgress(done, total, `已完成 ${done}/${total}`);
        }
      }
      summaryRows.push(summarizeSite(site, siteRows, params.threshold, cacheHits, cacheMisses, failedYears));
      renderSummaryTable(summaryRows);
    }

    const wide = buildWideRows(longRows, sites, params.timeStandard);
    const summaryColumns = [
      "site_id",
      "name",
      "country",
      "latitude",
      "longitude",
      "row_count",
      "valid_count",
      "missing_count",
      "t2m_c_min",
      "t2m_c_mean",
      "t2m_c_max",
      "threshold_c",
      "exceed_count",
      "exceed_ratio",
      "exceed_ratio_percent",
      "cache_hits",
      "cache_misses",
      "failed_years",
    ];
    const hourColumn = `hour_${params.timeStandard.toLowerCase()}`;
    const datetimeColumn = `datetime_${params.timeStandard.toLowerCase()}`;
    const longColumns = [
      "site_id",
      "name",
      "country",
      "latitude",
      "longitude",
      "date",
      hourColumn,
      datetimeColumn,
      "t2m_c",
      "source",
      "parameter",
      "time_standard",
    ];
    const errorColumns = ["site_id", "name", "latitude", "longitude", "year", "error", "url"];
    const manifest = {
      tool_version: TOOL_VERSION,
      generated_at: new Date().toISOString(),
      source: "NASA POWER Hourly API",
      endpoint: NASA_ENDPOINT,
      parameter: PARAMETER,
      parameter_meaning: "2-meter air temperature, hourly average, degree Celsius",
      community: COMMUNITY,
      params,
      site_count: sites.length,
      sites,
      total_requests: requests.length,
      cache_hits: summaryRows.reduce((sum, row) => sum + Number(row.cache_hits || 0), 0),
      cache_misses: summaryRows.reduce((sum, row) => sum + Number(row.cache_misses || 0), 0),
      error_count: errors.length,
      requests,
      outputs: {
        summary_csv: "download button: summary.csv",
        long_csv: "download button: long.csv",
        wide_csv: "download button: wide.csv",
        errors_csv: errors.length ? "download button: errors.csv" : null,
      },
    };

    const result = {
      params,
      summaryRows,
      summaryColumns,
      longRows,
      longColumns,
      wideRows: wide.rows,
      wideColumns: wide.columns,
      errors,
      errorColumns,
      manifest,
    };

    setDownloadsEnabled(result);
    const completeText = `完成：${sites.length} 个点位，${years.length} 年，${longRows.length.toLocaleString()} 条小时记录，${errors.length} 个失败请求。`;
    elements.runSummary.textContent = completeText;
    setProgress(total, total, completeText);
    if (errors.length) {
      setWarning(`有 ${errors.length} 个请求失败，可下载 errors.csv 查看。`, true);
    }
  } catch (error) {
    setWarning(error.message || String(error), true);
    elements.runSummary.textContent = "运行失败。";
    setProgress(0, 1, "运行失败，请检查输入。");
  } finally {
    setBusy(false);
  }
}

async function updateCacheStatus() {
  try {
    await openDatabase();
    elements.cacheStatus.textContent = "缓存：IndexedDB 可用";
  } catch (error) {
    elements.cacheStatus.textContent = "缓存：不可用";
    setWarning(`浏览器 IndexedDB 不可用：${error.message || error}`, true);
  }
}

elements.csvInput.value = DEFAULT_SAMPLE;
elements.loadHotCities.addEventListener("click", () => {
  elements.csvInput.value = hotCitiesCsv();
});
elements.downloadTemplate.addEventListener("click", () => {
  downloadText("nasa_power_temperature_input_template.csv", `\ufeff${hotCitiesCsv()}\n`, "text/csv;charset=utf-8");
});
elements.fileInput.addEventListener("change", async () => {
  const file = elements.fileInput.files?.[0];
  if (!file) return;
  elements.csvInput.value = await file.text();
});
elements.runButton.addEventListener("click", () => {
  runExport();
});
elements.clearCache.addEventListener("click", async () => {
  setBusy(true);
  try {
    const db = await openDatabase();
    await dbClear(db);
    setWarning("浏览器缓存已清空。");
  } catch (error) {
    setWarning(`清空缓存失败：${error.message || error}`, true);
  } finally {
    setBusy(false);
  }
});
elements.downloadButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-download]");
  if (button) downloadResult(button.dataset.download);
});

updateCacheStatus();

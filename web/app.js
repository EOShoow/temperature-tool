"use strict";

const TOOL_VERSION = "0.3.0";
const NASA_ENDPOINT = "https://power.larc.nasa.gov/api/temporal/hourly/point";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const PARAMETER = "T2M";
const COMMUNITY = "AG";
const GEOCODE_MIN_INTERVAL_MS = 1000;
const DEFAULT_SAMPLE = [
  "site_id,name,latitude,longitude,country",
  "kuwait_city,科威特市,29.3759,47.9774,科威特",
  "jizan_saudi,吉赞,16.8892,42.5511,沙特阿拉伯",
].join("\n");

const CITY_GAZETTEER = [
  {
    site_id: "dubai",
    name_zh: "迪拜",
    name_en: "Dubai",
    aliases: ["迪拜市", "دبي", "Dubai, UAE"],
    country_zh: "阿联酋",
    country_code: "ae",
    latitude: 25.2048,
    longitude: 55.2708,
    source: "built-in",
  },
  {
    site_id: "ahvaz",
    name_zh: "阿瓦士",
    name_en: "Ahvaz",
    aliases: ["اهواز"],
    country_zh: "伊朗",
    country_code: "ir",
    latitude: 31.3183,
    longitude: 48.6706,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "basra",
    name_zh: "巴士拉",
    name_en: "Basra",
    aliases: ["البصرة"],
    country_zh: "伊拉克",
    country_code: "iq",
    latitude: 30.5085,
    longitude: 47.7804,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "jacobabad",
    name_zh: "雅各布阿巴德",
    name_en: "Jacobabad",
    aliases: [],
    country_zh: "巴基斯坦",
    country_code: "pk",
    latitude: 28.281,
    longitude: 68.4388,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "riyadh",
    name_zh: "利雅得",
    name_en: "Riyadh",
    aliases: ["الرياض"],
    country_zh: "沙特阿拉伯",
    country_code: "sa",
    latitude: 24.7136,
    longitude: 46.6753,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "mecca",
    name_zh: "麦加",
    name_en: "Mecca",
    aliases: ["Makkah", "مكة"],
    country_zh: "沙特阿拉伯",
    country_code: "sa",
    latitude: 21.3891,
    longitude: 39.8579,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "kuwait_city",
    name_zh: "科威特市",
    name_en: "Kuwait City",
    aliases: ["مدينة الكويت"],
    country_zh: "科威特",
    country_code: "kw",
    latitude: 29.3759,
    longitude: 47.9774,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "jizan_saudi",
    name_zh: "吉赞",
    name_en: "Jizan",
    aliases: ["Jazan", "جازان"],
    country_zh: "沙特阿拉伯",
    country_code: "sa",
    latitude: 16.8892,
    longitude: 42.5511,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "port_sudan",
    name_zh: "苏丹港",
    name_en: "Port Sudan",
    aliases: ["بورسودان"],
    country_zh: "苏丹",
    country_code: "sd",
    latitude: 19.6158,
    longitude: 37.2164,
    source: "built-in",
    hot_city: true,
  },
];

const HOT_CITIES = CITY_GAZETTEER
  .filter((city) => city.hot_city)
  .map((city) => [city.site_id, city.name_zh, city.latitude, city.longitude, city.country_zh]);

const elements = {
  csvInput: document.getElementById("csvInput"),
  fileInput: document.getElementById("fileInput"),
  loadHotCities: document.getElementById("loadHotCities"),
  downloadTemplate: document.getElementById("downloadTemplate"),
  geocodeQuery: document.getElementById("geocodeQuery"),
  geocodeCountry: document.getElementById("geocodeCountry"),
  geocodeButton: document.getElementById("geocodeButton"),
  geocodeStatus: document.getElementById("geocodeStatus"),
  geocodeResults: document.getElementById("geocodeResults"),
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
let lastGeocodeRequestAt = 0;

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isMostlyAscii(value) {
  return /^[\x00-\x7F\s,.'-]+$/.test(value);
}

function builtInSearch(query, countryHint) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedCountry = normalizeSearchText(countryHint);
  if (!normalizedQuery) return [];
  return CITY_GAZETTEER.filter((city) => {
    const names = [city.name_zh, ...city.aliases];
    if (!isMostlyAscii(query)) {
      names.push(city.name_en);
    } else {
      // For English city names, prefer external geocoding candidates unless the
      // user gives a qualified alias like "Dubai, UAE".
      names.push(...city.aliases.filter((alias) => alias.includes(",")));
    }
    const nameMatch = names.some((name) => normalizeSearchText(name) === normalizedQuery);
    if (!nameMatch) return false;
    if (!normalizedCountry) return true;
    return [city.country_zh, city.country_code].some((value) =>
      normalizeSearchText(value).includes(normalizedCountry),
    );
  }).map((city) => ({
    source: "built-in",
    display_name: `${city.name_zh} / ${city.name_en}, ${city.country_zh}`,
    name: city.name_zh,
    country: city.country_zh,
    country_code: city.country_code,
    latitude: city.latitude,
    longitude: city.longitude,
    category: "place",
    type: "city",
    site_id: city.site_id,
    confidence_label: "内置城市",
  }));
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

function currentSiteIds() {
  try {
    return new Set(parseSites(elements.csvInput.value).map((site) => site.site_id));
  } catch (_error) {
    const rows = parseCsv(elements.csvInput.value || "");
    if (rows.length < 2) return new Set();
    const headers = rows[0].map(normalizeHeader);
    const siteIdIndex = headers.indexOf("site_id");
    if (siteIdIndex < 0) return new Set();
    return new Set(rows.slice(1).map((row) => normalizeSiteId(row[siteIdIndex], "")).filter(Boolean));
  }
}

function appendCandidateToCsv(candidate) {
  const siteId = normalizeSiteId(candidate.site_id || candidate.name, "geocode_site");
  if (currentSiteIds().has(siteId)) {
    setGeocodeStatus(`site_id 已存在：${siteId}。请先在 CSV 中改名或删除重复行。`, true);
    return;
  }

  const hasText = elements.csvInput.value.trim().length > 0;
  const prefix = hasText ? elements.csvInput.value.replace(/\s+$/g, "") : "site_id,name,latitude,longitude,country";
  const line = rowsToCsv([
    [
      siteId,
      candidate.name || siteId,
      Number(candidate.latitude).toFixed(4),
      Number(candidate.longitude).toFixed(4),
      candidate.country || "",
    ],
  ]);
  elements.csvInput.value = `${prefix}\n${line}`;
  setGeocodeStatus(`已加入：${siteId}, ${candidate.name}, ${Number(candidate.latitude).toFixed(4)}, ${Number(candidate.longitude).toFixed(4)}`);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("nasa-power-temperature-tool", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("responses")) {
        db.createObjectStore("responses", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("geocodes")) {
        db.createObjectStore("geocodes", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbClearStores(db, storeNames) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    for (const storeName of storeNames) {
      tx.objectStore(storeName).clear();
    }
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

function geocodeCacheKey(query, countryHint) {
  return [normalizeSearchText(query), normalizeSearchText(countryHint)].join("|");
}

function buildNominatimUrl(query, countryHint) {
  const searchText = [query.trim(), countryHint.trim()].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    format: "jsonv2",
    q: searchText,
    limit: "5",
    "accept-language": "zh-CN,en",
    addressdetails: "1",
  });
  return `${NOMINATIM_ENDPOINT}?${params.toString()}`;
}

async function waitForGeocodeRateLimit() {
  const now = Date.now();
  const remaining = GEOCODE_MIN_INTERVAL_MS - (now - lastGeocodeRequestAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  lastGeocodeRequestAt = Date.now();
}

function rankGeocodeCandidate(candidate) {
  const placeTypes = ["city", "town", "municipality", "village"];
  const categoryScore = candidate.category === "place" ? 0 : 10;
  const typeScore = placeTypes.includes(candidate.type) ? 0 : candidate.type === "administrative" ? 7 : 3;
  const sourceScore = candidate.source === "built-in" ? -5 : 0;
  return sourceScore + categoryScore + typeScore - Number(candidate.importance || 0);
}

function normalizeNominatimResult(result) {
  const address = result.address || {};
  const name = result.name || address.city || address.town || address.state || result.display_name || "";
  const country = address.country || "";
  const candidate = {
    source: "nominatim",
    display_name: result.display_name || name,
    name,
    country,
    country_code: address.country_code || "",
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    category: result.category || "",
    type: result.type || result.addresstype || "",
    addresstype: result.addresstype || "",
    importance: Number(result.importance || 0),
    confidence_label: "地理编码候选",
  };
  if (candidate.category === "place" && ["city", "town", "municipality"].includes(candidate.type)) {
    candidate.confidence_label = "城市候选";
  } else if (candidate.category === "boundary") {
    candidate.confidence_label = "行政边界候选";
  }
  const readableId = normalizeSiteId(candidate.name || candidate.display_name, "");
  const stableFallback = `${candidate.type || "place"}_${result.place_id || result.osm_id || "site"}`;
  candidate.site_id = readableId && readableId.length > 2 ? readableId : stableFallback;
  return candidate;
}

function setGeocodeStatus(message, error = false) {
  elements.geocodeStatus.textContent = message;
  elements.geocodeStatus.classList.toggle("error", error);
}

function candidateMeta(candidate) {
  const pieces = [
    candidate.source === "built-in" ? "内置城市表" : "OpenStreetMap Nominatim",
    candidate.confidence_label,
    candidate.country,
    `${Number(candidate.latitude).toFixed(4)}, ${Number(candidate.longitude).toFixed(4)}`,
  ];
  return pieces.filter(Boolean).join(" · ");
}

function renderGeocodeCandidates(candidates) {
  elements.geocodeResults.innerHTML = "";
  if (!candidates.length) {
    const empty = document.createElement("div");
    empty.className = "candidate-empty";
    empty.textContent = "未找到候选。可以补充国家/地区提示后再查，或直接手工填写经纬度。";
    elements.geocodeResults.appendChild(empty);
    return;
  }

  for (const candidate of candidates) {
    const item = document.createElement("div");
    item.className = "candidate-item";

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "candidate-title";
    title.textContent = candidate.display_name || candidate.name;

    const meta = document.createElement("div");
    meta.className = "candidate-meta";
    meta.textContent = candidateMeta(candidate);

    body.append(title, meta);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "加入列表";
    button.addEventListener("click", () => appendCandidateToCsv(candidate));

    item.append(body, button);
    elements.geocodeResults.appendChild(item);
  }
}

async function runGeocodeSearch() {
  const query = elements.geocodeQuery.value.trim();
  const countryHint = elements.geocodeCountry.value.trim();
  if (!query) {
    setGeocodeStatus("请输入城市名。", true);
    elements.geocodeResults.innerHTML = "";
    return;
  }

  elements.geocodeButton.disabled = true;
  elements.geocodeResults.innerHTML = "";
  setGeocodeStatus("正在查询地名...");
  try {
    const builtIn = builtInSearch(query, countryHint);
    if (builtIn.length) {
      renderGeocodeCandidates(builtIn);
      setGeocodeStatus(`找到 ${builtIn.length} 个内置候选。`);
      return;
    }

    const db = await openDatabase();
    const { results, cacheHit } = await queryNominatim(db, query, countryHint);
    renderGeocodeCandidates(results);
    const suffix = cacheHit ? "来自本地地名缓存。" : "来自 OpenStreetMap Nominatim。";
    setGeocodeStatus(`找到 ${results.length} 个候选，${suffix}`);
  } catch (error) {
    setGeocodeStatus(`地名查询失败：${error.message || error}。仍可手工填写经纬度。`, true);
  } finally {
    elements.geocodeButton.disabled = false;
  }
}

async function queryNominatim(db, query, countryHint) {
  const key = geocodeCacheKey(query, countryHint);
  const cached = await dbGet(db, "geocodes", key);
  if (cached?.results) {
    return { results: cached.results, cacheHit: true };
  }

  await waitForGeocodeRateLimit();
  const url = buildNominatimUrl(query, countryHint);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Nominatim 请求失败：HTTP ${response.status}`);
  }
  const payload = await response.json();
  const results = payload
    .map(normalizeNominatimResult)
    .filter((candidate) => Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude))
    .sort((a, b) => rankGeocodeCandidate(a) - rankGeocodeCandidate(b));
  await dbPut(db, "geocodes", {
    key,
    query,
    countryHint,
    url,
    results,
    saved_at: new Date().toISOString(),
    source: "nominatim",
  });
  return { results, cacheHit: false };
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
  elements.geocodeButton.disabled = isBusy;
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
    button.disabled = !result;
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

function safeSheetName(name, usedNames) {
  const cleaned = String(name || "sheet")
    .replace(/[:\\/?*\[\]]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "sheet";
  let candidate = cleaned;
  let index = 2;
  while (usedNames.has(candidate)) {
    const suffix = `_${index}`;
    candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function rowsToAoa(rows, columns) {
  return [
    columns,
    ...rows.map((row) => columns.map((column) => row[column] ?? "")),
  ];
}

function summarySheetAoa(result) {
  const manifest = result.manifest;
  return [
    ["项目", "内容"],
    ["数据源", manifest.source],
    ["接口", manifest.endpoint],
    ["参数", `${manifest.parameter} (${manifest.parameter_meaning})`],
    ["时间标准", manifest.params.timeStandard],
    ["年份范围", `${manifest.params.startYear}-${manifest.params.endYear}`],
    ["超温阈值", `${manifest.params.threshold} °C`],
    ["点位数量", manifest.site_count],
    ["合并长表行数", result.longRows.length],
    ["宽表行数", result.wideRows.length],
    ["缓存命中", manifest.cache_hits],
    ["缓存未命中", manifest.cache_misses],
    ["失败请求", manifest.error_count],
    ["工具版本", manifest.tool_version],
    ["生成时间", manifest.generated_at],
    ["说明", "T2M 为 2 米气温小时平均值，单位摄氏度；宽表按 date + hour 对齐全部点位。"],
    [],
    [
      "site_id",
      "名称",
      "国家",
      "纬度",
      "经度",
      "小时数",
      "有效小时",
      "缺失值",
      "温度范围",
      "平均温度",
      "超温阈值",
      "超温小时数",
      "超温占比",
      "缓存命中",
      "缓存未命中",
      "失败年份",
    ],
    ...result.summaryRows.map((row) => [
      row.site_id,
      row.name,
      row.country,
      row.latitude,
      row.longitude,
      row.row_count,
      row.valid_count,
      row.missing_count,
      row.t2m_c_min || row.t2m_c_max ? `${row.t2m_c_min} 至 ${row.t2m_c_max} °C` : "",
      row.t2m_c_mean ? `${row.t2m_c_mean} °C` : "",
      `${row.threshold_c} °C`,
      row.exceed_count,
      row.exceed_ratio_percent,
      row.cache_hits,
      row.cache_misses,
      row.failed_years,
    ]),
  ];
}

function manifestRows(manifest) {
  const rows = [
    { key: "tool_version", value: manifest.tool_version },
    { key: "generated_at", value: manifest.generated_at },
    { key: "source", value: manifest.source },
    { key: "endpoint", value: manifest.endpoint },
    { key: "parameter", value: manifest.parameter },
    { key: "parameter_meaning", value: manifest.parameter_meaning },
    { key: "community", value: manifest.community },
    { key: "start_year", value: manifest.params.startYear },
    { key: "end_year", value: manifest.params.endYear },
    { key: "time_standard", value: manifest.params.timeStandard },
    { key: "threshold_c", value: manifest.params.threshold },
    { key: "refresh_cache", value: manifest.params.refreshCache },
    { key: "site_count", value: manifest.site_count },
    { key: "total_requests", value: manifest.total_requests },
    { key: "cache_hits", value: manifest.cache_hits },
    { key: "cache_misses", value: manifest.cache_misses },
    { key: "error_count", value: manifest.error_count },
    { key: "sheets", value: "摘要, 宽表_全部点位对齐, 每个点位长表, 运行记录, 错误记录(如有)" },
  ];
  for (const site of manifest.sites) {
    rows.push({
      key: `site.${site.site_id}`,
      value: `${site.name}, ${site.country || ""}, ${site.latitude}, ${site.longitude}`,
    });
  }
  return rows;
}

function autosizeSheet(sheet, rows, columns) {
  sheet["!cols"] = columns.map((column) => {
    const max = Math.max(
      String(column).length,
      ...rows.slice(0, 250).map((row) => String(row[column] ?? "").length),
    );
    return { wch: Math.min(Math.max(max + 2, 10), 42) };
  });
}

function appendJsonSheet(workbook, name, rows, columns, usedNames) {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  autosizeSheet(sheet, rows, columns);
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(name, usedNames));
}

function appendAoaSheet(workbook, name, aoa, usedNames) {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = aoa[0].map((_, columnIndex) => {
    const max = Math.max(...aoa.slice(0, 250).map((row) => String(row[columnIndex] ?? "").length));
    return { wch: Math.min(Math.max(max + 2, 10), 42) };
  });
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(name, usedNames));
}

function downloadExcelWorkbook() {
  if (!activeResult) return;
  if (!window.XLSX) {
    setWarning("Excel 导出组件未加载。请确认网络可访问 cdn.sheetjs.com，或改用本地静态服务后刷新页面。", true);
    return;
  }
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();

  appendAoaSheet(workbook, "摘要", summarySheetAoa(activeResult), usedNames);
  appendJsonSheet(workbook, "宽表_全部点位对齐", activeResult.wideRows, activeResult.wideColumns, usedNames);

  for (const site of activeResult.manifest.sites) {
    const rows = activeResult.longRows.filter((row) => row.site_id === site.site_id);
    appendJsonSheet(workbook, `${site.name || site.site_id}_长表`, rows, activeResult.longColumns, usedNames);
  }

  appendJsonSheet(workbook, "运行记录", manifestRows(activeResult.manifest), ["key", "value"], usedNames);

  if (activeResult.errors.length) {
    appendJsonSheet(workbook, "错误记录", activeResult.errors, activeResult.errorColumns, usedNames);
  }

  XLSX.writeFile(workbook, resultFilename("workbook", "xlsx"), { compression: true });
}

function downloadResult(type) {
  if (!activeResult) return;
  if (type === "excel") {
    downloadExcelWorkbook();
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
            const cached = await dbGet(db, "responses", key);
            if (cached?.payload) {
              payload = cached.payload;
              cacheHits += 1;
              requestRecord.cache_hit = true;
            }
          }
          if (!payload) {
            payload = await fetchWithRetry(url, 3);
            await dbPut(db, "responses", {
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
        workbook_xlsx: "download button: Excel workbook",
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
      setWarning(`有 ${errors.length} 个请求失败，下载 Excel 后可在“错误记录”sheet 查看。`, true);
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
elements.geocodeButton.addEventListener("click", () => {
  runGeocodeSearch();
});
elements.geocodeQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runGeocodeSearch();
  }
});
elements.geocodeCountry.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runGeocodeSearch();
  }
});
elements.runButton.addEventListener("click", () => {
  runExport();
});
elements.clearCache.addEventListener("click", async () => {
  setBusy(true);
  try {
    const db = await openDatabase();
    await dbClearStores(db, ["responses", "geocodes"]);
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

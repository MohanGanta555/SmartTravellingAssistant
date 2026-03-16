const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

let LOCAL_STATIONS_CACHE = null;
const loadLocalStations = () => {
  if (LOCAL_STATIONS_CACHE) return LOCAL_STATIONS_CACHE;
  let filePath = null;
  try {
    const dirDatasets = path.resolve(__dirname, '..', 'Datasets');
    if (fs.existsSync(dirDatasets)) {
      const names = fs.readdirSync(dirDatasets);
      const target = names.find(n => /^Station Master\.(json|csv|ndjson)$/i.test(n));
      if (target) filePath = path.join(dirDatasets, target);
    }
    if (!filePath) {
      const dir = path.resolve(__dirname, '..', 'Train_info');
      if (fs.existsSync(dir)) {
        const names = fs.readdirSync(dir);
        const target = names.find(n => /^list_of_stations\.(json|csv|ndjson)$/i.test(n));
        if (target) filePath = path.join(dir, target);
      }
    }
  } catch (_) {}
  if (!filePath) {
    const alt = [
      path.resolve(__dirname, '..', 'list_of_stations.json'),
      path.resolve(__dirname, '..', 'list_of_stations.csv'),
      path.resolve(__dirname, '..', 'list_of_stations.ndjson'),
    ];
    for (const p of alt) {
      try { if (fs.existsSync(p)) { filePath = p; break; } } catch (_) {}
    }
  }
  if (!filePath) {
    LOCAL_STATIONS_CACHE = [];
    return LOCAL_STATIONS_CACHE;
  }
  try {
    let items = [];
    if (filePath.endsWith('.json')) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      items = Array.isArray(data) ? data : data?.stations || data?.data || data?.results || [];
    } else if (filePath.endsWith('.ndjson')) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      items = raw.split(/\r?\n/).filter(Boolean).map(l => {
        try { return JSON.parse(l); } catch (_) { return null; }
      }).filter(Boolean);
    } else {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      if (lines.length > 1) {
        const header = lines[0].split(',').map(s => s.trim());
        const idx = (name) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(s => s.trim());
          const rec = {
            station_name: idx('station_name') >= 0 ? cols[idx('station_name')] : '',
            name: idx('name') >= 0 ? cols[idx('name')] : '',
            station_code: idx('station_code') >= 0 ? cols[idx('station_code')] : '',
            code: idx('code') >= 0 ? cols[idx('code')] : '',
            city: idx('city') >= 0 ? cols[idx('city')] : '',
            district: idx('district') >= 0 ? cols[idx('district')] : '',
          };
          items.push(rec);
        }
      }
    }
    LOCAL_STATIONS_CACHE = items;
    return LOCAL_STATIONS_CACHE;
  } catch (_) {
    LOCAL_STATIONS_CACHE = [];
    return LOCAL_STATIONS_CACHE;
  }
};

const normalizeText = (str = '') =>
  str.toLowerCase().replace(/junction|jn\.?|city|deccan|town|jnc|jct/gi, '').replace(/[^a-z]/g, '').trim();
const findStationCode = (q) => {
  const direct = (q || '').trim().toUpperCase();
  if (/^[A-Z]{2,5}$/.test(direct)) return direct;
  const nk = normalizeText(q);
  const cityFallbacks = {
    bengaluru: 'SBC',
    bangalore: 'SBC',
    hyderabad: 'HYB',
    mumbai: 'CSMT',
    bombay: 'CSMT',
    delhi: 'NDLS',
    newdelhi: 'NDLS',
    chennai: 'MAS',
    madras: 'MAS',
    kolkata: 'HWH',
    calcutta: 'HWH',
    pune: 'PUNE',
    ahmedabad: 'ADI',
    jaipur: 'JP',
    lucknow: 'LKO',
    kochi: 'ERS',
    ernakulam: 'ERS',
    thiruvananthapuram: 'TVC',
    trivandrum: 'TVC',
    varanasi: 'BSB',
    patna: 'PNBE',
    goa: 'MAO',
    panaji: 'MAO',
    nagpur: 'NGP',
    bhopal: 'BPL',
    chandigarh: 'CDG',
    secunderabad: 'SC',
    bapatla: 'BPP',
    chirala: 'CLX',
    tirupati: 'TPTY',
    tirupathi: 'TPTY',
    tirupathy: 'TPTY'
  };
  const items = loadLocalStations();
  const filtered = items.filter((s) => {
    const name = String(s?.station_name || s?.name || '');
    const code = String(s?.station_code || s?.code || '').toUpperCase();
    const city = String(s?.city || s?.district || '');
    const normName = normalizeText(name);
    const normCity = normalizeText(city);
    const hasName = !!normName;
    const hasCity = !!normCity;
    const matchName = hasName && nk && (normName.includes(nk) || nk.includes(normName));
    const matchCity = hasCity && nk && (normCity.includes(nk) || nk.includes(normCity));
    return matchName || matchCity || code === direct;
  });
  const first = filtered[0];
  if (first) {
    const ds = loadDatasets();
    const ranked = filtered
      .map((s) => {
        const code = String(s.station_code || s.code || '').toUpperCase();
        const name = String(s.station_name || s.name || '');
        const normName = normalizeText(name);
        const exactName = normName === nk;
        const inRoutes = !!(ds && ds.byStation && ds.byStation.get(code));
        return { code, exactName, inRoutes };
      })
      .sort((a, b) => {
        if (a.exactName !== b.exactName) return a.exactName ? -1 : 1;
        if (a.inRoutes !== b.inRoutes) return a.inRoutes ? -1 : 1;
        return a.code.localeCompare(b.code);
      });
    return ranked[0].code;
  }
  if (cityFallbacks[nk]) return cityFallbacks[nk];
  return '';
};

// Local Train dataset loader (supports JSON or CSV)
let TRAIN_INFO_CACHE = null;
const loadTrainInfo = () => {
  if (TRAIN_INFO_CACHE) return TRAIN_INFO_CACHE;
  let filePath = null;
  try {
    const dir = path.resolve(__dirname, '..', 'Train_info');
    if (fs.existsSync(dir)) {
      const names = fs.readdirSync(dir);
      const target = names.find(n => /^train_info\.(json|csv|ndjson)$/i.test(n));
      if (target) filePath = path.join(dir, target);
    }
  } catch (_) {}
  if (!filePath) {
    const alt = [
      path.resolve(__dirname, '..', 'train_info.json'),
      path.resolve(__dirname, '..', 'train_info.csv'),
      path.resolve(__dirname, '..', 'train_info.ndjson'),
      path.resolve(__dirname, '..', 'Train_info.json'),
      path.resolve(__dirname, '..', 'Train_info.csv'),
      path.resolve(__dirname, '..', 'Train_info.ndjson'),
    ];
    for (const p of alt) {
      try { if (fs.existsSync(p)) { filePath = p; break; } } catch (_) {}
    }
  }
  if (!filePath) {
    TRAIN_INFO_CACHE = { trainsByNumber: new Map(), byStation: new Map(), meta: { loaded: false } };
    return TRAIN_INFO_CACHE;
  }
  try {
    let records = [];
    if (filePath.endsWith('.json')) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      records = Array.isArray(data) ? data : data?.records || data?.data || [];
    } else if (filePath.endsWith('.ndjson')) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      records = raw.split(/\r?\n/).filter(Boolean).map(l => {
        try { return JSON.parse(l); } catch (_) { return null; }
      }).filter(Boolean);
    } else {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      const header = lines[0].split(',').map(s => s.trim());
      const idx = (name) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
      const mapLine = (line) => {
        const cols = line.split(',').map(s => s.trim());
        const get = (k) => {
          const i = idx(k);
          return i >= 0 ? cols[i] : '';
        };
        return {
          train_number: get('train_number'),
          train_name: get('train_name'),
          station_code: get('station_code'),
          arrival_time: get('arrival_time'),
          departure_time: get('departure_time'),
          distance: get('distance'),
          stop_number: get('stop_number'),
          running_days: get('running_days'),
        };
      };
      for (let i = 1; i < lines.length; i++) {
        const rec = mapLine(lines[i]);
        if (rec.train_number && rec.station_code) records.push(rec);
      }
    }
    const trainsByNumber = new Map();
    const byStation = new Map();
    for (const r of records) {
      const tn = String(r.train_number || '').trim();
      if (!tn) continue;
      const station = String(r.station_code || '').trim().toUpperCase();
      const stopNo = Number(r.stop_number || 0);
      const arr = String(r.arrival_time || '');
      const dep = String(r.departure_time || '');
      const name = r.train_name || '';
      const runningDays = r.running_days || '';
      let t = trainsByNumber.get(tn);
      if (!t) { t = { train_number: tn, train_name: name, running_days: runningDays, stops: [] }; trainsByNumber.set(tn, t); }
      if (name) t.train_name = name;
      if (runningDays) t.running_days = runningDays;
      t.stops.push({ station_code: station, arrival_time: arr, departure_time: dep, distance: Number(r.distance || 0), stop_number: stopNo });
      if (!byStation.has(station)) byStation.set(station, new Set());
      byStation.get(station).add(tn);
    }
    for (const t of trainsByNumber.values()) { t.stops.sort((a, b) => (a.stop_number - b.stop_number)); }
    TRAIN_INFO_CACHE = { trainsByNumber, byStation, meta: { loaded: true, filePath } };
    return TRAIN_INFO_CACHE;
  } catch (_) {
    TRAIN_INFO_CACHE = { trainsByNumber: new Map(), byStation: new Map(), meta: { loaded: false } };
    return TRAIN_INFO_CACHE;
  }
};

// Loader for backend/Datasets combining Train Route 1/2 and Calendar fragments
let DATASETS_CACHE = null;
let TYPES_CACHE = null;
const toHHMM = (t) => {
  const s = String(t || '').trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!m) return '';
  const hh = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0');
  return `${hh}:${mm}`;
};
const computeOffsets = (stops) => {
  let offsets = [];
  let lastMin = null;
  let dayOffset = 0;
  for (let i = 0; i < stops.length; i++) {
    const dep = stops[i].departure_time || stops[i].arrival_time || '';
    const m = /^(\d{1,2}):(\d{2})$/.exec(toHHMM(dep));
    const mins = m ? (Number(m[1]) * 60 + Number(m[2])) : 0;
    if (lastMin !== null && mins < lastMin) dayOffset++;
    offsets[i] = dayOffset;
    lastMin = mins;
  }
  return offsets;
};
const loadDatasets = () => {
  if (DATASETS_CACHE) return DATASETS_CACHE;
  const dir = path.resolve(__dirname, '..', 'Datasets');
  if (!fs.existsSync(dir)) {
    DATASETS_CACHE = { trainsByNumber: new Map(), byStation: new Map(), meta: { loaded: false } };
    return DATASETS_CACHE;
  }
  try {
    const names = fs.readdirSync(dir);
    const routeCsvs = names.filter(n => /^Train Route \d+\.csv$/i.test(n)).map(n => path.join(dir, n));
    const calendarJsons = names.filter(n => /^Train Calendar \d+\.json$/i.test(n)).map(n => path.join(dir, n));
    const trainsMeta = new Map();
    // Parse Train Route 1 (meta: name, running days)
    for (const p of routeCsvs) {
      if (!/Train Route 1\.csv$/i.test(p)) continue;
      const raw = fs.readFileSync(p, 'utf-8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      if (lines.length > 1) {
        const header = lines[0].split(',').map(s => s.replace(/^"+|"+$/g, '').trim());
        const idx = (name) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(s => s.replace(/^"+|"+$/g, '').trim());
          const tn = String(cols[idx('Train_No')] || '').trim();
          if (!tn) continue;
          const name = String(cols[idx('Train_Name')] || '').trim();
          const days = String(cols[idx('days')] || '').trim();
          const meta = trainsMeta.get(tn) || { train_number: tn, train_name: '', running_days: '' };
          if (name) meta.train_name = name;
          if (days) meta.running_days = days;
          trainsMeta.set(tn, meta);
        }
      }
    }
    // Parse Train Route 2 (stops)
    const trainsByNumber = new Map();
    const byStation = new Map();
    for (const p of routeCsvs) {
      const raw = fs.readFileSync(p, 'utf-8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      if (lines.length <= 1) continue;
      const header = lines[0].split(',').map(s => s.replace(/^"+|"+$/g, '').trim());
      const idx = (name) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
      const parseStop = (line) => {
        const cols = line.split(',').map(s => s.replace(/^"+|"+$/g, '').trim());
        return {
          stop_number: Number(cols[idx('SN')] || cols[idx('stop_number')] || 0),
          train_number: String(cols[idx('Train_No')] || '').trim(),
          station_code: String(cols[idx('Station_Code')] || '').trim().toUpperCase(),
          arrival_time: toHHMM(cols[idx('Arrival_time')] || cols[idx('arrival_time')] || ''),
          departure_time: toHHMM(cols[idx('Departure_Time')] || cols[idx('departure_time')] || ''),
          distance: Number(cols[idx('Distance')] || cols[idx('distance')] || 0),
          station_name: String(cols[idx('Station_Name')] || cols[idx('station_name')] || ''),
        };
      };
      for (let i = 1; i < lines.length; i++) {
        const r = parseStop(lines[i]);
        if (!r.train_number || !r.station_code) continue;
        let t = trainsByNumber.get(r.train_number);
        if (!t) {
          const meta = trainsMeta.get(r.train_number) || { train_number: r.train_number, train_name: '', running_days: '' };
          t = { train_number: r.train_number, train_name: meta.train_name || '', running_days: meta.running_days || '', stops: [] };
          trainsByNumber.set(r.train_number, t);
        }
        t.stops.push({ station_code: r.station_code, arrival_time: r.arrival_time, departure_time: r.departure_time, distance: r.distance, stop_number: r.stop_number });
        if (!byStation.has(r.station_code)) byStation.set(r.station_code, new Set());
        byStation.get(r.station_code).add(r.train_number);
      }
    }
    for (const t of trainsByNumber.values()) {
      t.stops.sort((a, b) => a.stop_number - b.stop_number);
      const offsets = computeOffsets(t.stops);
      for (let i = 0; i < t.stops.length; i++) {
        t.stops[i].day_offset = offsets[i] || 0;
      }
    }
    if (!TYPES_CACHE) {
      const typesByNumber = new Map();
      for (const p of calendarJsons) {
        try {
          const raw = fs.readFileSync(p, 'utf-8');
          const data = JSON.parse(raw);
          const feats = Array.isArray(data) ? data : data?.features || [];
          for (const f of feats) {
            const props = f?.properties || f || {};
            const num = String(props.number || props.trainNumber || props.train_no || '').trim();
            const typ = String(props.type || '').trim();
            if (num && typ) typesByNumber.set(num, typ);
          }
        } catch (_) {}
      }
      TYPES_CACHE = typesByNumber;
    }
    DATASETS_CACHE = { trainsByNumber, byStation, meta: { loaded: trainsByNumber.size > 0, dir }, typesByNumber: TYPES_CACHE || new Map() };
    return DATASETS_CACHE;
  } catch (err) {
    DATASETS_CACHE = { trainsByNumber: new Map(), byStation: new Map(), meta: { loaded: false } };
    return DATASETS_CACHE;
  }
};

const dayCode = (d) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d];
const runsOnDay = (runningDays, dayLabel) => {
  if (!runningDays) return true;
  if (Array.isArray(runningDays)) return runningDays.includes(dayLabel) || runningDays.includes(dayLabel.toLowerCase());
  const s = String(runningDays).toLowerCase();
  return s.includes(dayLabel.toLowerCase());
};
const parseHM = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return { h: 0, m: 0, ok: false };
  return { h: Number(m[1]), m: Number(m[2]), ok: true };
};
const durationMinutes = (dep, arr) => {
  const d = parseHM(dep), a = parseHM(arr);
  const depMin = d.h * 60 + d.m, arrMin = a.h * 60 + a.m;
  let diff = arrMin - depMin;
  if (diff < 0) diff += 24 * 60;
  return diff;
};

// Local trains search (no external APIs)
router.get('/local-trains', async (req, res) => {
  try {
    const rawSource = (req.query.sourceStation || '').trim();
    const rawDestination = (req.query.destinationStation || '').trim();
    const sourceStation = /^[A-Z]{2,5}$/.test(rawSource) ? rawSource.toUpperCase() : findStationCode(rawSource);
    const destinationStation = /^[A-Z]{2,5}$/.test(rawDestination) ? rawDestination.toUpperCase() : findStationCode(rawDestination);
    const startDate = (req.query.startDate || req.query.travelDate || '').trim();
    const endDate = (req.query.endDate || '').trim();
    if (!sourceStation || !destinationStation || !startDate) {
      return res.status(400).json({ message: 'sourceStation, destinationStation, and startDate are required' });
    }
    const data = loadDatasets().meta.loaded ? loadDatasets() : loadTrainInfo();
    if (!data.meta.loaded) {
      return res.status(500).json({ message: 'Dataset not found in backend/Datasets or Train_info' });
    }
    // Candidate trains containing both stations
    const candidates = new Set();
    const setA = data.byStation.get(sourceStation) || new Set();
    const setB = data.byStation.get(destinationStation) || new Set();
    for (const tn of setA) { if (setB.has(tn)) candidates.add(tn); }
    // Filter by order source before destination
    const filtered = [];
    for (const tn of candidates) {
      const t = data.trainsByNumber.get(tn);
      if (!t || !Array.isArray(t.stops)) continue;
      const sIdx = t.stops.findIndex(s => s.station_code === sourceStation);
      const dIdx = t.stops.findIndex(s => s.station_code === destinationStation);
      if (sIdx >= 0 && dIdx >= 0 && sIdx < dIdx) {
        const dep = t.stops[sIdx].departure_time || t.stops[sIdx].arrival_time;
        const arr = t.stops[dIdx].arrival_time || t.stops[dIdx].departure_time;
        const mins = durationMinutes(dep, arr);
        const sOffset = Number(t.stops[sIdx].day_offset || 0);
        const distStart = Number(t.stops[sIdx].distance || 0);
        const distEnd = Number(t.stops[dIdx].distance || 0);
        const segmentKm = Math.max(0, distEnd - distStart);
        const typesByNumber = DATASETS_CACHE?.typesByNumber || new Map();
        const rawType = String(typesByNumber.get(tn) || '').toLowerCase();
        const normName = String(t.train_name || '').toLowerCase();
        const classify = () => {
          const has = (...tokens) => tokens.every(tok => normName.includes(tok) || rawType.includes(tok));
          if (has('vande') && has('bharat')) return { label: 'Vande Bharat', rate: 3.5, short10: 120, short25: 200 };
          if (rawType.includes('rajdhani') || normName.includes('rajdhani')) return { label: 'Rajdhani', rate: 3.0, short10: 100, short25: 180 };
          if (normName.includes('shatabdi') || rawType.includes('shatabdi')) return { label: 'Shatabdi', rate: 2.8, short10: 90, short25: 160 };
          if (normName.includes('duronto') || rawType.includes('duronto')) return { label: 'Duronto', rate: 2.6, short10: 80, short25: 150 };
          if (rawType.includes('memu') || rawType.includes('dmu') || rawType.includes('demu') || rawType.includes('pass') ||
              normName.includes('memu') || normName.includes('dmu') || normName.includes('demu') || normName.includes('pass')) {
            return { label: 'General', rate: 1.0, short10: 30, short25: 50 };
          }
          if (rawType.includes('super') || normName.includes('sf') || normName.includes('super')) {
            return { label: 'Super Fast', rate: 2.2, short10: 60, short25: 100 };
          }
          if (rawType.includes('express') || normName.includes('express') || normName.includes('exp') || normName.includes('mail')) {
            return { label: 'Express', rate: 1.5, short10: 45, short25: 75 };
          }
          return { label: 'Express', rate: 1.5, short10: 45, short25: 75 };
        };
        const cls = classify();
        const cat = /general/i.test(cls.label)
          ? 'general'
          : (/super/i.test(cls.label) ? 'superfast' : 'express');
        const rate =
          segmentKm <= 10
            ? (cat === 'general' ? 1.5 : cat === 'express' ? 2.5 : 3.5)
            : segmentKm <= 25
            ? (cat === 'general' ? 2.0 : cat === 'express' ? 3.0 : 4.0)
            : (cat === 'general' ? 0.8 : cat === 'express' ? 1.3 : 1.5);
        const price = Math.round(segmentKm * rate);
        filtered.push({
          train_number: tn,
          train_name: t.train_name || '',
          departure_time: dep || '',
          arrival_time: arr || '',
          travel_duration: `${Math.floor(mins / 60)}h ${mins % 60}m`,
          running_days: t.running_days || '',
          source_day_offset: sOffset,
        train_type: cls.label,
        distance_km: segmentKm,
        price
        });
      }
    }
    if (filtered.length === 0) {
      return res.json({ dates: [], trains: [] });
    }
    // Build per-date availability using running_days
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const result = [];
    for (let t = start.getTime(); t <= end.getTime(); t += oneDayMs) {
      const dt = new Date(t);
      const boardingDayIdx = dt.getDay();
      let trainsForDay = filtered.filter(r => {
        const originDayIdx = (boardingDayIdx - Number(r.source_day_offset || 0) + 7) % 7;
        const originDay = dayCode(originDayIdx);
        return runsOnDay(r.running_days, originDay);
      }).map(r => ({
        ...r,
        boarding_date: dt.toISOString().slice(0,10),
      }));
      if (trainsForDay.length === 0 && filtered.length > 0) {
        trainsForDay = filtered.slice(0, Math.min(filtered.length, 6)).map(r => ({
          ...r,
          boarding_date: dt.toISOString().slice(0,10),
        }));
      } else if (trainsForDay.length === 1 && filtered.length > 1) {
        const extras = filtered.filter(r => !trainsForDay.some(x => x.train_number === r.train_number)).slice(0, 5).map(r => ({
          ...r,
          boarding_date: dt.toISOString().slice(0,10),
        }));
        trainsForDay = [...trainsForDay, ...extras];
      }
      result.push({ date: dt.toISOString().slice(0,10), trains: trainsForDay });
    }
    return res.json({ dates: result, trains: filtered, sourceStation, destinationStation });
  } catch (err) {
    return res.status(500).json({ message: err?.message || 'Local trains search failed' });
  }
});



// Local Bus dataset loader and search
let BUS_DATA_CACHE = null;
const loadBusData = () => {
  if (BUS_DATA_CACHE) return BUS_DATA_CACHE;
  const dir = path.resolve(__dirname, '..', 'Datasets');
  const names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const file = names.find(n => /^Pan_India_Bus_Routes_with_Days\.csv$/i.test(n)) ||
               names.find(n => /^Pan-India_Bus_Routes\.csv$/i.test(n));
  if (!file) {
    BUS_DATA_CACHE = { buses: [], meta: { loaded: false } };
    return BUS_DATA_CACHE;
  }
  try {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const header = lines[0].split(',').map(h => h.trim());
    const idx = (name) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
    const splitCSV = (line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.replace(/^"(.*)"$/,'$1').trim());
    const buses = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSV(lines[i]);
      const rec = {
        from: cols[idx('From')] || '',
        to: cols[idx('To')] || '',
        operator: cols[idx('Operator')] || '',
        distance: Number(cols[idx('Distance')] || 0),
        duration: cols[idx('Duration')] || '',
        busType: cols[idx('Bus Type')] || cols[idx('BusType')] || '',
        departure: cols[idx('Departure')] || '',
        arrival: cols[idx('Arrival')] || '',
        days: (cols[idx('Days')] || '').split(',').map(s => s.trim()).filter(Boolean),
      };
      if (rec.from && rec.to) buses.push(rec);
    }
    BUS_DATA_CACHE = { buses, meta: { loaded: buses.length > 0, file } };
    return BUS_DATA_CACHE;
  } catch (_) {
    BUS_DATA_CACHE = { buses: [], meta: { loaded: false } };
    return BUS_DATA_CACHE;
  }
};
const dow = (d) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d];
const normCity = (s='') => {
  const k = s.toLowerCase().trim();
  const aliases = {
    bengaluru: 'bangalore',
    bangalore: 'bangalore',
    banglore: 'bangalore',
    blr: 'bangalore',
    mumbai: 'mumbai',
    bombay: 'mumbai',
    panaji: 'panaji',
    goa: 'panaji',
    tirupati: 'tirupati',
    tirupathi: 'tirupati',
    tirupathy: 'tirupati'
  };
  return aliases[k] || k;
};
router.get('/buses', async (req, res) => {
  try {
    const sourceCity = (req.query.sourceCity || '').trim();
    const destinationCity = (req.query.destinationCity || '').trim();
    const travelDate = (req.query.travelDate || '').trim();
    if (!sourceCity || !destinationCity || !travelDate) {
      return res.status(400).json({ message: 'sourceCity, destinationCity and travelDate are required' });
    }
    const data = loadBusData();
    if (!data.meta.loaded) {
      return res.status(500).json({ message: 'Bus dataset not found in backend/Datasets' });
    }
    const day = dow(new Date(travelDate).getDay());
    const fromN = normCity(sourceCity);
    const toN = normCity(destinationCity);
    const matches = data.buses.filter(b =>
      normCity(b.from) === fromN &&
      normCity(b.to) === toN &&
      (b.days.length === 0 || b.days.includes(day))
    );
    const normalized = matches.map((b, idx) => ({
      id: `bus-${idx}-${b.operator.replace(/\s+/g,'-').toLowerCase()}`,
      operator: b.operator,
      busType: b.busType,
      departureTime: b.departure,
      arrivalTime: b.arrival,
      price: Math.max(30, Math.round((b.distance || 0) * 1.0)),
      availableSeats: undefined,
      distance: b.distance,
      duration: b.duration,
      day
    }));
    return res.json({ buses: normalized, sourceCity, destinationCity, travelDate, day });
  } catch (err) {
    return res.status(500).json({ message: err?.message || 'Local buses search failed' });
  }
});

router.__datasetsLoader = loadDatasets;
router.__findStationCode = findStationCode;
module.exports = router;

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Places.css";
import API_URL from "../api";

function Itinerary() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialTrip = location.state?.tripData;
  const tripData = useMemo(() => {
    if (initialTrip) {
      try { localStorage.setItem("tripData", JSON.stringify(initialTrip)); } catch (_) {}
      return initialTrip;
    }
    try {
      const stored = localStorage.getItem("tripData");
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return null;
  }, [initialTrip]);
  const hasSavedPlan = Array.isArray(initialTrip?.itineraryDays) && initialTrip.itineraryDays.length > 0;
  const readOnly = useMemo(() => !!initialTrip?.viewOnly, [initialTrip]);

  const toRad = (v) => (v * Math.PI) / 180;
  const haversineKm = (a, b) => {
    if (!a?.lat || !a?.lon || !b?.lat || !b?.lon) return 0;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const la1 = toRad(a.lat);
    const la2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const parseHours = (t) => {
    if (!t || typeof t !== "string") return 2;
    const m = t.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
    if (m) {
      const low = parseFloat(m[1]);
      const high = parseFloat(m[3]);
      return (low + high) / 2;
    }
    const single = t.match(/(\d+(\.\d+)?)/);
    if (single) return parseFloat(single[1]);
    return 2;
  };

  const estimateTransportHours = (opt, mode, distanceKm) => {
    if (!opt) return 0;
    if (opt.timeRequired) {
      const h = parseHours(opt.timeRequired);
      if (isFinite(h) && h > 0) return h;
    }
    if (mode === "flight") return Math.max(1, Math.round((distanceKm / 600) * 10) / 10);
    if (mode === "train") return Math.max(1, Math.round((distanceKm / 60) * 10) / 10);
    if (mode === "bus") return Math.max(1, Math.round((distanceKm / 45) * 10) / 10);
    if (mode === "car") return Math.max(1, Math.round((distanceKm / 60) * 10) / 10);
    return 0;
  };

  const [dailyCapacity, setDailyCapacity] = useState(8);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [dailyStartTime, setDailyStartTime] = useState("09:00");

  const [plan, setPlan] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [routeProfile, setRouteProfile] = useState(() => {
    const m = (tripData?.transportMode || "").toLowerCase();
    if (m === "car" || m === "bus") return "driving-car";
    if (m === "walk" || m === "walking") return "foot-walking";
    return "driving-car";
  });
  const [routedProfile, setRoutedProfile] = useState(null);
  const getCategoryIcon = (category) => {
    const map = {
      'religious': '🕍',
      'historical': '🏰',
      'nature': '🌳',
      'beach': '🏖️',
      'adventure': '🧗',
      'food': '🍕',
      'shopping': '🛍️',
      'museum': '🖼️',
      'park': '⛲',
      'travel': '🚗'
    };
    return map[category?.toLowerCase()] || '📍';
  };

  const budgetTotals = useMemo(() => {
    if (!tripData) {
      return {
        diffDays: 1,
        accommodationCost: 0,
        localTransportCost: 0,
        foodCost: 0,
        minTotal: 0,
        primaryTransport: 0,
      };
    }
    const oneDay = 24 * 60 * 60 * 1000;
    const startDate = new Date(tripData.startDate);
    const endDate = new Date(tripData.endDate);
    const diffDays = Math.round(Math.abs((startDate - endDate) / oneDay)) || 1;
    const travelers = Number(tripData.travelers || 1);
    const chosen = tripData?.chosenTransportOption || null;
    const chosenReturn = tripData?.includeReturn ? (tripData?.chosenReturnTransportOption || null) : null;
    const fallbackPrimary =
      travelers *
      (((chosen ? (chosen.price || chosen.estimatedCost || 0) : 0)) +
       ((chosenReturn ? (chosenReturn.price || chosenReturn.estimatedCost || 0) : 0)));
    const primaryTransport = Number(tripData.primaryTransportCost ?? fallbackPrimary);
    const hotels = Array.isArray(tripData.selectedHotels) ? tripData.selectedHotels : [];
    const hotelsCostPerNight = hotels.reduce((total, hotel) => total + Number(hotel.estimatedCost || 0), 0);
    const accommodationCost = hotelsCostPerNight * diffDays;
    const destKey = (tripData.destination || "").toLowerCase();
    const tier1 = ["bengaluru","bangalore","banglore","hyderabad","mumbai","delhi","chennai","kolkata","pune","ahmedabad","jaipur"];
    const localPerDay = tier1.includes(destKey) ? 400 : 250;
    const localTransportCost = localPerDay * diffDays * travelers;
    const foodPerDayPerTraveler = 500;
    const foodCost = foodPerDayPerTraveler * diffDays * travelers;
    const minTotal = primaryTransport + accommodationCost + localTransportCost + foodCost;
    return { diffDays, accommodationCost, localTransportCost, foodCost, minTotal, primaryTransport };
  }, [tripData]);
  const formatTransport = (opt, isReturn) => {
    if (!opt) return "";
    const mode = (tripData?.transportMode || "").toUpperCase();
    const date = isReturn ? tripData?.endDate : tripData?.startDate;
    if (opt.type === "flight") {
      const dep = opt.depAirport || tripData?.source || "";
      const arr = opt.arrAirport || tripData?.destination || "";
      const depTime = opt.depTime ? new Date(opt.depTime).toLocaleString() : "";
      const arrTime = opt.arrTime ? new Date(opt.arrTime).toLocaleString() : "";
      return `${mode} • ${opt.airline || ""} ${opt.flightCode || ""} • ${new Date(date).toLocaleDateString()} • Depart ${dep} ${opt.depIata ? `(${opt.depIata})` : ""} ${depTime} • Arrive ${arr} ${opt.arrIata ? `(${opt.arrIata})` : ""} ${arrTime}`;
    }
    if (opt.type === "bus") {
      return `${mode} • ${opt.busOperator || "Bus"} ${opt.busType ? `• ${opt.busType}` : ""} • ${new Date(date).toLocaleDateString()} • Depart ${opt.depTime || ""} • Arrive ${opt.arrTime || ""}`;
    }
    return `${mode} • ${new Date(date).toLocaleDateString()} • Duration ${opt.timeRequired || ""}`;
  };
  const transportLines = (opt, isReturn) => {
    if (!opt) return [];
    const hdr = isReturn ? "Return Travel" : "Outbound Travel";
    const mode = (tripData?.transportMode || "").toUpperCase();
    const date = isReturn ? tripData?.endDate : tripData?.startDate;
    if (opt.type === "flight") {
      const dep = opt.depAirport || tripData?.source || "";
      const arr = opt.arrAirport || tripData?.destination || "";
      const depT = opt.depTime ? new Date(opt.depTime).toLocaleString() : "";
      const arrT = opt.arrTime ? new Date(opt.arrTime).toLocaleString() : "";
      const lines = [
        hdr,
        `${mode} • Flight`,
        `${opt.airline || ""} ${opt.flightCode || ""}`.trim(),
        `Date: ${new Date(date).toLocaleDateString()}`,
        `Depart: ${dep} ${opt.depIata ? `(${opt.depIata})` : ""} ${depT}`.trim(),
        `Arrive: ${arr} ${opt.arrIata ? `(${opt.arrIata})` : ""} ${arrT}`.trim(),
      ];
      return lines.filter(Boolean);
    }
    if (opt.type === "bus") {
      const lines = [
        hdr,
        `${mode} • Bus`,
        `${opt.busOperator || "Bus"} ${opt.busType ? `• ${opt.busType}` : ""}`.trim(),
        `Date: ${new Date(date).toLocaleDateString()}`,
        `Depart: ${opt.depTime || ""}`.trim(),
        `Arrive: ${opt.arrTime || ""}`.trim(),
      ];
      return lines.filter(Boolean);
    }
    if (opt.type === "train") {
      const lines = [
        hdr,
        `${mode} • Train`,
        `${opt.trainName || "Train"} ${opt.trainNumber ? `(${opt.trainNumber})` : ""}`.trim(),
        `Date: ${new Date(date).toLocaleDateString()}`,
        `Depart: ${opt.depTime || ""}`.trim(),
        `Arrive: ${opt.arrTime || ""}`.trim(),
      ];
      return lines.filter(Boolean);
    }
    const lines = [
      hdr,
      `${mode} • Ground`,
      `Date: ${new Date(date).toLocaleDateString()}`,
      `Duration: ${opt.timeRequired || ""}`,
    ];
    return lines.filter(Boolean);
  };
  const renderHotels = () => {
    const hotels = tripData.selectedHotels || [];
    if (!Array.isArray(hotels) || hotels.length === 0) return null;
    return (
      <div className="trip-summary" style={{ flexDirection: "column", alignItems: "flex-start", gap: 12, background: '#f8fafc', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
        <span style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '1.1rem', fontWeight: 700 }}>🏨 Selected Accommodation:</span>
        {hotels.map((h, i) => (
          <div key={i} style={{ padding: "16px 20px", borderRadius: 16, background: "white", marginTop: 4, width: '100%', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>{h.name}</div>
            <div style={{ color: '#059669', fontWeight: 600, marginTop: 4 }}>₹{h.estimatedCost}/night {h.rating ? `• ⭐ ${h.rating}` : ""}</div>
            {h.address ? <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>📍 {h.address}</div> : null}
          </div>
        ))}
      </div>
    );
  };
  const handleDragStart = (dayIdx, itemIdx, e) => {
    if (readOnly) return;
    try {
      e.dataTransfer.setData("text/plain", JSON.stringify({ dayIdx, itemIdx }));
    } catch (_) {}
  };
  const handleDropOnCard = (targetDayIdx, targetItemIdx, e) => {
    if (readOnly) return;
    e.preventDefault();
    let payload = null;
    try {
      payload = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
    } catch (_) {}
    if (!payload || typeof payload.dayIdx !== "number" || typeof payload.itemIdx !== "number") return;
    setPlan(prev => {
      const days = prev?.days ? prev.days.map(d => ({ ...d, items: d.items.map(it => ({ ...it })) })) : [];
      if (!days[payload.dayIdx] || !days[payload.dayIdx].items[payload.itemIdx]) return prev;
      const [moved] = days[payload.dayIdx].items.splice(payload.itemIdx, 1);
      const tItems = days[targetDayIdx].items;
      const insertIdx = Math.max(0, Math.min(targetItemIdx, tItems.length));
      tItems.splice(insertIdx, 0, moved);
      return { ...prev, days };
    });
  };
  const handleDropOnDay = (targetDayIdx, e) => {
    if (readOnly) return;
    e.preventDefault();
    let payload = null;
    try {
      payload = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
    } catch (_) {}
    if (!payload || typeof payload.dayIdx !== "number" || typeof payload.itemIdx !== "number") return;
    setPlan(prev => {
      const days = prev?.days ? prev.days.map(d => ({ ...d, items: d.items.map(it => ({ ...it })) })) : [];
      if (!days[payload.dayIdx] || !days[payload.dayIdx].items[payload.itemIdx]) return prev;
      const [moved] = days[payload.dayIdx].items.splice(payload.itemIdx, 1);
      days[targetDayIdx].items.push(moved);
      return { ...prev, days };
    });
  };
  const fmtKm = (v) => {
    const n = Number(v || 0);
    if (!isFinite(n)) return "0 km";
    const precise = Math.round(n * 10) / 10;
    return precise < 0.1 ? "<0.1 km" : `${precise} km`;
  };
  const fmtMin = (v) => {
    const n = Number(v || 0);
    if (!isFinite(n)) return "0 min";
    const rounded = Math.max(0, Math.round(n));
    return rounded < 1 ? "<1 min" : `${rounded} min`;
  };

  const computePlan = (useMatrix) => {
    if (!tripData) return;
    const startDate = new Date(tripData.startDate);
    const endDate = new Date(tripData.endDate);
    const oneDayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.max(1, Math.floor(Math.abs((endDate - startDate)) / oneDayMs) + 1);

    const places = Array.isArray(tripData.selectedPlaces) ? tripData.selectedPlaces.filter(p => p?.coordinates) : [];
    const distanceKm = tripData?.distance || 0;
    const transportMode = tripData?.transportMode;
    const chosen = tripData?.chosenTransportOption || null;
    const chosenReturn = tripData?.includeReturn ? (tripData?.chosenReturnTransportOption || null) : null;

    const outboundHours = estimateTransportHours(chosen, transportMode, distanceKm);
    const returnHours = estimateTransportHours(chosenReturn, transportMode, distanceKm);
    const totalSightseeingHours = diffDays * dailyCapacity - outboundHours - returnHours;
    const effectiveHours = Math.max(dailyCapacity, Math.floor(totalSightseeingHours));

    const pts = places.map(p => ({ x: p.coordinates.lon, y: p.coordinates.lat, ref: p }));
    if (pts.length === 0) {
      setPlan({
        meta: { diffDays, outboundHours, returnHours, totalHours: totalSightseeingHours },
        days: Array.from({ length: diffDays }, (_, i) => ({
          date: new Date(startDate.getTime() + i * oneDayMs),
          items: [],
          summary: { totalPlaceHours: 0, travelKm: 0 },
        })),
      });
      try { localStorage.setItem("itineraryReady", "true"); } catch (_) {}
      return;
    }

    const dayCapacity = (idx) => {
      let cap = dailyCapacity;
      if (idx === 0) cap = Math.max(0, cap - outboundHours);
      if (idx === diffDays - 1) cap = Math.max(0, cap - returnHours);
      return cap;
    };
    const activeDayIndices = Array.from({ length: diffDays }, (_, i) => i).filter(i => dayCapacity(i) > 0);
    const K = Math.min(Math.max(1, activeDayIndices.length), Math.max(1, places.length));
    const days = Array.from({ length: diffDays }, (_, i) => ({
      date: new Date(startDate.getTime() + i * oneDayMs),
      items: [],
      summary: { totalPlaceHours: 0, travelKm: 0, travelMin: 0 },
    }));
    const modeLabel = (transportMode || "").trim();
    if (outboundHours > 0) {
      const di = activeDayIndices[0] ?? 0;
      days[di].items.push({
        name: `${modeLabel ? modeLabel.toUpperCase() : "Travel"} Outbound`,
        category: "travel",
        timeHours: outboundHours,
        coordinates: tripData?.locationCoords?.source || {},
      });
      days[di].summary.totalPlaceHours = Math.max(0, Math.round(outboundHours * 10) / 10);
    }
    if (returnHours > 0) {
      const di = activeDayIndices[Math.max(0, activeDayIndices.length - 1)] ?? Math.max(0, diffDays - 1);
      days[di].items.push({
        name: `${modeLabel ? modeLabel.toUpperCase() : "Travel"} Return`,
        category: "travel",
        timeHours: returnHours,
        coordinates: tripData?.locationCoords?.destination || {},
      });
      days[di].summary.totalPlaceHours = Math.max(0, Math.round((days[di].summary.totalPlaceHours + returnHours) * 10) / 10);
    }

    const pickInitialCentroids = () => {
      const cs = [];
      const used = new Set();
      for (let i = 0; i < K; i++) {
        let idx = Math.floor((i / K) * pts.length);
        while (used.has(idx)) idx = (idx + 1) % pts.length;
        used.add(idx);
        cs.push({ x: pts[idx].x, y: pts[idx].y });
      }
      return cs;
    };
    let centroids = pickInitialCentroids();
    let clusters = Array.from({ length: K }, () => []);
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    for (let iter = 0; iter < 10; iter++) {
      clusters = Array.from({ length: K }, () => []);
      for (const p of pts) {
        let best = 0, bestD = Infinity;
        for (let c = 0; c < K; c++) {
          const d = dist(p, centroids[c]);
          if (d < bestD) { bestD = d; best = c; }
        }
        clusters[best].push(p);
      }
      const newC = [];
      for (let c = 0; c < K; c++) {
        const arr = clusters[c];
        if (arr.length === 0) { newC.push(centroids[c]); continue; }
        const sx = arr.reduce((s, v) => s + v.x, 0);
        const sy = arr.reduce((s, v) => s + v.y, 0);
        newC.push({ x: sx / arr.length, y: sy / arr.length });
      }
      centroids = newC;
    }

    const orderCluster = (arr, start) => {
      if (arr.length <= 1) return arr;
      const unused = arr.slice();
      let current = start || unused[0];
      const path = [];
      while (unused.length) {
        let idx = 0, bestD = Infinity;
        for (let i = 0; i < unused.length; i++) {
          let d;
          if (useMatrix && matrix) {
            const aIdx = pts.findIndex(p => p === current);
            const bIdx = pts.findIndex(p => p === unused[i]);
            d = matrix.distKm[aIdx][bIdx] || dist(current, unused[i]);
          } else {
            d = dist(current, unused[i]);
          }
          if (d < bestD) { bestD = d; idx = i; }
        }
        const next = unused.splice(idx, 1)[0];
        path.push(next);
        current = next;
      }
      return path;
    };

    const twoOpt = (ordered) => {
      if (!useMatrix || !matrix || ordered.length < 4) return ordered;
      const idxMap = ordered.map(node => pts.findIndex(p => p === node));
      const total = (seq) => {
        let s = 0;
        for (let i = 0; i < seq.length - 1; i++) {
          const a = idxMap[seq[i]];
          const b = idxMap[seq[i + 1]];
          s += matrix.distKm[a][b] || dist(ordered[seq[i]], ordered[seq[i + 1]]);
        }
        return s;
      };
      let seq = ordered.map((_, i) => i);
      let improved = true;
      while (improved) {
        improved = false;
        for (let i = 1; i < seq.length - 2; i++) {
          for (let k = i + 1; k < seq.length - 1; k++) {
            const newSeq = seq.slice(0, i).concat(seq.slice(i, k + 1).reverse(), seq.slice(k + 1));
            if (total(newSeq) + 1e-6 < total(seq)) {
              seq = newSeq;
              improved = true;
            }
          }
        }
      }
      return seq.map(idx => ordered[idx]);
    };

    let globalOrdered = orderCluster(pts);
    globalOrdered = twoOpt(globalOrdered);
    const targetPerDay = Math.max(1, Math.ceil(globalOrdered.length / K));
    let cursor = 0;
    for (let di = 0; di < K; di++) {
      const dayIdx = activeDayIndices[di] ?? di;
      let remaining = Math.max(0, dayCapacity(dayIdx) - days[dayIdx].items.reduce((s, it) => s + (parseHours(it.timeHours) || 0), 0));
      let used = days[dayIdx].items.reduce((s, it) => s + (parseHours(it.timeHours) || 0), 0);
      let count = 0;
      let startMin = (() => {
        const [h, m] = String(dailyStartTime || "09:00").split(":").map(v => parseInt(v, 10));
        return (isNaN(h) || isNaN(m)) ? 9 * 60 : h * 60 + m;
      })();
      while (cursor < globalOrdered.length && count < targetPerDay) {
        const node = globalOrdered[cursor];
        const place = node.ref;
        const h = parseHours(place.timeRequired);
        if (h <= remaining) {
          days[dayIdx].items.push({
            name: place.name,
            category: place.category || place.type,
            timeHours: h,
            coordinates: place.coordinates,
          });
          startMin = startMin + Math.round(h * 60) + Number(bufferMinutes || 0);
          remaining -= h;
          used += h;
          count += 1;
          cursor += 1;
        } else {
          break;
        }
      }
      days[dayIdx].summary.totalPlaceHours = Math.max(0, Math.round(used * 10) / 10);
      days[dayIdx].summary.travelKm = 0;
      days[dayIdx].summary.travelKmPrecise = 0;
      days[dayIdx].summary.travelMin = 0;
      days[dayIdx].summary.travelMinPrecise = 0;
    }
    while (cursor < globalOrdered.length) {
      for (let di = 0; di < K && cursor < globalOrdered.length; di++) {
        const dayIdx = activeDayIndices[di] ?? di;
        let remaining = dayCapacity(dayIdx) - (days[dayIdx].summary.totalPlaceHours || 0);
        let startMin = (() => {
          const [h, m] = String(dailyStartTime || "09:00").split(":").map(v => parseInt(v, 10));
          const base = (isNaN(h) || isNaN(m)) ? 9 * 60 : h * 60 + m;
          return base + Math.round((days[dayIdx].summary.totalPlaceHours || 0) * 60) + Number(bufferMinutes || 0);
        })();
        const node = globalOrdered[cursor];
        const place = node.ref;
        const h = parseHours(place.timeRequired);
        if (h <= remaining) {
          days[dayIdx].items.push({
            name: place.name,
            category: place.category || place.type,
            timeHours: h,
            coordinates: place.coordinates,
          });
          days[dayIdx].summary.totalPlaceHours = Math.max(0, Math.round((days[dayIdx].summary.totalPlaceHours + h) * 10) / 10);
          cursor += 1;
        } else {
          continue;
        }
      }
    }

    setPlan({
      meta: { diffDays, outboundHours, returnHours, totalHours: totalSightseeingHours },
      days,
    });
    setRoutedProfile(null);
    try { localStorage.setItem("itineraryReady", "true"); } catch (_) {}
  };

  useEffect(() => {
    try { localStorage.setItem("itineraryReady", "false"); } catch (_) {}
    if (hasSavedPlan && initialTrip?.itineraryDays) {
      const days = initialTrip.itineraryDays.map(d => {
        const items = Array.isArray(d.items) ? d.items.map(it => ({ ...it })) : [];
        let travelKm = 0;
        let travelMin = 0;
        let totalPlaceHours = 0;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const h = parseFloat(it.timeHours) || 0;
          totalPlaceHours += h;
          if (i > 0) {
            const prev = items[i - 1];
            const km = haversineKm(prev.coordinates, it.coordinates);
            const min = Math.round((km / 40) * 60);
            it.prevLegKm = Math.round(km);
            it.prevLegMin = Math.round(min);
            travelKm += km;
            travelMin += min;
          } else {
            it.prevLegKm = 0;
            it.prevLegMin = 0;
          }
        }
        const summary = d.summary && typeof d.summary === "object"
          ? {
              totalPlaceHours: d.summary.totalPlaceHours ?? totalPlaceHours,
              travelKm: d.summary.travelKm ?? Math.round(travelKm),
              travelMin: d.summary.travelMin ?? Math.round(travelMin),
            }
          : { totalPlaceHours, travelKm: Math.round(travelKm), travelMin: Math.round(travelMin) };
        return {
          date: new Date(d.date),
          items,
          summary,
        };
      });
      setPlan({
        meta: {
          diffDays: days.length,
          outboundHours: 0,
          returnHours: 0,
          totalHours: days.length * dailyCapacity,
        },
        days,
      });
      try { localStorage.setItem("itineraryReady", "true"); } catch (_) {}
      return;
    }
    computePlan(false);
  }, [tripData]);

  useEffect(() => {
    const runMatrix = async () => {
      if (hasSavedPlan) return;
      if (!tripData || !Array.isArray(tripData.selectedPlaces) || tripData.selectedPlaces.length < 2) return;
      const key = process.env.REACT_APP_ORS_API_KEY;
      if (!key) return;
      try {
        const locations = tripData.selectedPlaces.map(p => [p.coordinates.lon, p.coordinates.lat]);
        const body = { locations, metrics: ["distance","duration"], units: "km" };
        const { data } = await axios.post(`https://api.openrouteservice.org/v2/matrix/${routeProfile}`, body, {
          headers: { Authorization: key, "Content-Type": "application/json" }
        });
        const distKm = (data.distances || []).map(row => row.map(v => (typeof v === "number" ? v : 0)));
        const durMin = (data.durations || []).map(row => row.map(v => (typeof v === "number" ? Math.round(v / 60) : 0)));
        setMatrix({ distKm, durMin });
        computePlan(true);
      } catch (_) {
      }
    };
    runMatrix();
  }, [tripData, routeProfile]);
  
  useEffect(() => {
    const enrichDirections = async () => {
      if (!plan) return;
      if (hasSavedPlan) return;
      if (routedProfile === routeProfile) return;
      const key = process.env.REACT_APP_ORS_API_KEY;
      if (!key) return;
      if (!plan) return;
      if (!plan) return;
      if (!routeProfile) return;
      if (routedProfile === routeProfile) return;
      const updatedDays = plan.days.map(d => ({
        ...d,
        items: d.items.map(it => ({ ...it })),
        summary: { ...d.summary }
      }));
      for (let i = 0; i < updatedDays.length; i++) {
        const d = updatedDays[i];
        if (!Array.isArray(d.items) || d.items.length < 2) continue;
        const coords = d.items.map(it => [it.coordinates.lon, it.coordinates.lat]);
        try {
          const { data } = await axios.post(`https://api.openrouteservice.org/v2/directions/${routeProfile}`, { coordinates: coords }, {
            headers: { Authorization: key, "Content-Type": "application/json" }
          });
          const segs = data?.features?.[0]?.properties?.segments || [];
          let tKm = 0;
          let tMin = 0;
          for (let s = 0; s < segs.length; s++) {
            const seg = segs[s] || {};
            const km = typeof seg.distance === "number" ? seg.distance / 1000 : 0;
            const min = typeof seg.duration === "number" ? Math.round(seg.duration / 60) : 0;
            tKm += km;
            tMin += min;
            const idx = s + 1;
            if (d.items[idx]) {
              d.items[idx].prevLegKm = Math.round(km);
              d.items[idx].prevLegMin = Math.round(min);
            }
          }
          d.summary.travelKm = Math.round(tKm);
          d.summary.travelKmPrecise = Math.round(tKm * 10) / 10;
          d.summary.travelMin = Math.round(tMin);
          d.summary.travelMinPrecise = Math.round(tMin);
        } catch (_) {}
      }
      setPlan(prev => ({ ...prev, days: updatedDays }));
      setRoutedProfile(routeProfile);
    };
    enrichDirections();
  }, [plan, routeProfile, routedProfile]);

  if (!tripData) {
    return (
      <div className="places-container">
        <div className="error-message">
          <h2>No Trip Data Found</h2>
          <p>Please plan your trip first from the Home page.</p>
          <button onClick={() => navigate("/")} className="back-button">← Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="places-container" id="itinerary-pdf-content">
      <header className="places-header">
        <h1>🗓️ Your Travel Itinerary</h1>
        <p>A professionally crafted day-wise plan for your upcoming adventure</p>
        <div className="trip-summary">
          <span>📍 {tripData.source} to {tripData.destination}</span>
          <span>👥 {tripData.travelers} Travelers</span>
          <span>📅 {new Date(tripData.startDate).toLocaleDateString()} - {new Date(tripData.endDate).toLocaleDateString()}</span>
        </div>
      </header>

      <main className="places-main">
        <div className="places-content">
          <div className="popular-places-section">
            <h2>🔍 Trip Overview</h2>
            <div className="trip-summary" style={{ gap: "12px", flexWrap: "wrap", justifyContent: 'flex-start', margin: '0' }}>
              <span>🚗 {tripData.transportMode.toUpperCase()} {tripData.includeReturn ? "(Round Trip)" : "(One Way)"}</span>
              <span>💰 Est. Min: ₹{tripData.finalMinBudget || 0}</span>
              <span>💵 Planned: ₹{tripData.finalBudget || 0}</span>
            </div>
            {renderHotels()}
            {saveError && <p className="error-message">{saveError}</p>}
          </div>

          <div className="popular-places-section">
            <h2>💰 Budget Allocation</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="budget-card">
                <div className="label">Transport</div>
                <div className="value">₹{budgetTotals.primaryTransport}</div>
              </div>
              <div className="budget-card">
                <div className="label">Accommodation</div>
                <div className="value">₹{budgetTotals.accommodationCost}</div>
              </div>
              <div className="budget-card">
                <div className="label">Local Transport</div>
                <div className="value">₹{budgetTotals.localTransportCost}</div>
              </div>
              <div className="budget-card">
                <div className="label">Food</div>
                <div className="value">₹{budgetTotals.foodCost}</div>
              </div>
            </div>
          </div>

          {plan?.days?.map((d, idx) => (
            <div
              key={idx}
              className="popular-places-section day-section"
              onDragOver={!readOnly ? (e) => e.preventDefault() : undefined}
              onDrop={!readOnly ? (e) => handleDropOnDay(idx, e) : undefined}
            >
              <h2>Day {idx + 1} • {d.date.toLocaleDateString()}</h2>
              {(idx === 0 && (plan?.meta?.outboundHours || 0) > 0) && (
                <p className="section-subtitle">Outbound travel reserved (~ {plan?.meta?.outboundHours}h)</p>
              )}
              {(idx === (plan?.days?.length || 1) - 1 && (plan?.meta?.returnHours || 0) > 0) && (
                <p className="section-subtitle">Return travel reserved (~ {plan?.meta?.returnHours}h)</p>
              )}
              {(idx === 0 && !!tripData.chosenTransportOption) && (
                <div style={{ background: "#f7f7f9", borderRadius: 8, padding: "10px 12px", margin: "8px 0" }}>
                  {transportLines(tripData.chosenTransportOption, false).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
              {d.items.length === 0 ? (
                <div className="no-places">
                  No scheduled places for this day.
                </div>
              ) : (
                <div className="places-grid">
                  {d.items.map((item, i) => (
                    <div
                      key={i}
                      className="place-card"
                      draggable={!readOnly}
                      onDragStart={!readOnly ? (e) => handleDragStart(idx, i, e) : undefined}
                      onDragOver={!readOnly ? (e) => e.preventDefault() : undefined}
                      onDrop={!readOnly ? (e) => handleDropOnCard(idx, i, e) : undefined}
                    >
                      <div className="place-image">
                        <div className="image-badge">{item.category === "travel" ? "🚗 Travel" : "🏛️ Visit"}</div>
                        <div className="category-icon-placeholder">
                          {getCategoryIcon(item.category)}
                        </div>
                      </div>
                      <div className="place-details">
                        <h3>{item.name}</h3>
                        <div className="place-meta">
                          <span className="type-chip">
                            {item.category === "travel" 
                              ? `🚗 ${tripData.transportMode.toUpperCase()}` 
                              : `✨ ${item.category}`}
                          </span>
                          {item.timeHours && (
                            <span className="distance-chip">⏱️ {item.timeHours}h</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(idx === (plan?.days?.length || 1) - 1 && !!tripData.includeReturn && !!tripData.chosenReturnTransportOption) && (
                <div style={{ background: "#f7f7f9", borderRadius: 8, padding: "10px 12px", margin: "8px 0" }}>
                  {transportLines(tripData.chosenReturnTransportOption, true).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="action-buttons">
            {!readOnly && (
              <button className="back-btn" onClick={() => navigate("/hotels", { state: { tripData } })}>
                <span>←</span> Back to Hotels
              </button>
            )}
            {readOnly ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                <div style={{ 
                  background: '#eff6ff', 
                  padding: '15px 20px', 
                  borderRadius: '12px', 
                  border: '1px solid #dbeafe',
                  color: '#1e40af',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }} className="no-print">
                  <span>💡</span>
                  <span><strong>Pro Tip:</strong> To keep the professional look in the PDF, ensure <strong>"Background Graphics"</strong> is enabled in your browser's print settings.</span>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <button className="continue-btn" onClick={() => window.print()} style={{ flex: 1 }}>
                    <span>📄</span> Download Professional PDF
                  </button>
                  <button className="back-btn" onClick={() => navigate("/profile")} style={{ flex: 1 }}>
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="continue-btn"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setSaveError(null);
                  try {
                    const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || "{}");
                    if (!userInfo?.token) {
                      setSaveError("Login required");
                      navigate("/login");
                      return;
                    }
                    const payload = {
                      source: tripData.source,
                      destination: tripData.destination,
                      startDate: tripData.startDate,
                      endDate: tripData.endDate,
                      travelers: tripData.travelers,
                      transportMode: tripData.transportMode,
                      chosenTransportOption: tripData.chosenTransportOption,
                      includeReturn: !!tripData.includeReturn,
                      chosenReturnTransportOption: tripData.chosenReturnTransportOption,
                      primaryTransportCost: budgetTotals.primaryTransport,
                      selectedHotels: tripData.selectedHotels || [],
                      finalBudget: tripData.finalBudget || 0,
                      finalMinBudget: tripData.finalMinBudget || 0,
                      selectedPlaces: tripData.selectedPlaces || [],
                      itineraryDays: (plan?.days || []).map(d => ({
                        date: d.date,
                        items: d.items,
                        summary: d.summary
                      }))
                    };
                    await axios.post(`${API_URL}/users/plans`, payload, {
                      headers: { Authorization: `Bearer ${userInfo.token}` }
                    });
                    setSaving(false);
                    navigate("/profile");
                  } catch (e) {
                    setSaving(false);
                    setSaveError(e.response?.data?.message || "Failed to save plan");
                  }
                }}
              >
                {saving ? "Saving..." : (
                  <>
                    Save & Finish <span>→</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Itinerary;

const router = require('../routes/transportRoutes');
const d = router.__datasetsLoader();
const a = (d.byStation.get('BPP') || new Set());
const b = (d.byStation.get('TPTY') || new Set());
const candidates = [...a].filter(tn => b.has(tn));
console.log('candidates', candidates.length);
let ordered = 0;
for (const tn of candidates) {
  const t = d.trainsByNumber.get(tn);
  const sIdx = t.stops.findIndex(s => s.station_code === 'BPP');
  const dIdx = t.stops.findIndex(s => s.station_code === 'TPTY');
  if (sIdx >= 0 && dIdx >= 0 && sIdx < dIdx) ordered++;
}
console.log('ordered', ordered);

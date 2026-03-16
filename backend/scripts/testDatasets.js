const router = require('../routes/transportRoutes');
const d = router.__datasetsLoader();
console.log(JSON.stringify({
  meta: d.meta,
  trainsCount: d.trainsByNumber.size,
  stationsCount: d.byStation.size,
  sampleTrain: (() => {
    const tn = [...d.trainsByNumber.keys()][0];
    const t = d.trainsByNumber.get(tn);
    return { train_number: tn, stops: (t?.stops || []).slice(0, 3) };
  })(),
}, null, 2));

const router = require('../routes/transportRoutes');
const d = router.__datasetsLoader();
const test = (name) => {
  const code = router.__findStationCode(name);
  return { name, code, hasStations: !!d.byStation.get((code || '').toUpperCase()) };
};
console.log(JSON.stringify({
  meta: d.meta,
  bapatla: test('bapatla'),
  tirupati: test('tirupati'),
  tirupathi: test('tirupathi'),
}, null, 2));

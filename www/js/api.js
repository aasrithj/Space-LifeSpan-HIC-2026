const NASA_API_KEY = window.SPACELIFESPAN_CONFIG?.NASA_API_KEY || 'DEMO_KEY';
const CACHE_TTL = 6 * 60 * 60 * 1000;
const SATELLITE_SEEDS = [
  {
    name: 'NOAA 18',
    group: 'weather',
    mission: 'Weather',
    purpose: 'Polar weather observation',
    launch: '2005-05-20',
    expectedLife: 15,
  },
  {
    name: 'NOAA 19',
    group: 'weather',
    mission: 'Weather',
    purpose: 'Polar weather observation',
    launch: '2009-02-06',
    expectedLife: 15,
  },
  {
    name: 'SUOMI NPP',
    group: 'weather',
    mission: 'Weather',
    purpose: 'Weather and climate monitoring',
    launch: '2011-10-28',
    expectedLife: 15,
  },
  {
    name: 'NOAA 20 (JPSS-1)',
    group: 'weather',
    mission: 'Weather',
    purpose: 'Operational weather forecasting',
    launch: '2017-11-18',
    expectedLife: 15,
  },
  {
    name: 'LANDSAT 8',
    group: 'resource',
    mission: 'Earth observation',
    purpose: 'Land and water imaging',
    launch: '2013-02-11',
    expectedLife: 15,
  },
  {
    name: 'LANDSAT 9',
    group: 'resource',
    mission: 'Earth observation',
    purpose: 'Land and water imaging',
    launch: '2021-09-27',
    expectedLife: 15,
  },
  {
    name: 'ISS (ZARYA)',
    group: 'stations',
    mission: 'Research',
    purpose: 'Crewed orbital research laboratory',
    launch: '1998-11-20',
    expectedLife: 30,
  },
  {
    name: 'GOES 16',
    group: 'goes',
    mission: 'Weather',
    purpose: 'Geostationary weather observation',
    launch: '2016-11-19',
    expectedLife: 15,
  },
];
const fallbackTles = {
  'NOAA 18': [
    '1 28654U 05018A   26330.50000000  .00000060  00000+0  74904-4 0  9991',
    '2 28654  99.1900 290.0000 0014000  80.0000 280.3000 14.12500000    01',
  ],
  'NOAA 19': [
    '1 33591U 09005A   26330.50000000  .00000072  00000+0  65000-4 0  9995',
    '2 33591  99.1800 300.0000 0014000 110.0000 250.2000 14.12400000    02',
  ],
  'SUOMI NPP': [
    '1 37849U 11061A   26330.50000000  .00000080  00000+0  70000-4 0  9994',
    '2 37849  98.7000 120.0000 0001300  95.0000 265.1000 14.19500000    05',
  ],
  'NOAA 20 (JPSS-1)': [
    '1 43013U 17073A   26330.50000000  .00000065  00000+0  60000-4 0  9995',
    '2 43013  98.7400  20.0000 0001000  90.0000 270.0000 14.19500000    02',
  ],
  'LANDSAT 8': [
    '1 39084U 13008A   26330.50000000  .00000062  00000+0  67000-4 0  9995',
    '2 39084  98.2100 160.0000 0001200  90.0000 270.0000 14.57100000    04',
  ],
  'LANDSAT 9': [
    '1 49260U 21088A   26330.50000000  .00000060  00000+0  65000-4 0  9992',
    '2 49260  98.2100 170.0000 0001200  90.0000 270.0000 14.57100000    04',
  ],
  'ISS (ZARYA)': [
    '1 25544U 98067A   26330.50000000  .00017000  00000+0  30000-3 0  9995',
    '2 25544  51.6400 190.0000 0005000  60.0000  30.0000 15.50000000    06',
  ],
  'GOES 16': [
    '1 41866U 16071A   26330.50000000 -.00000120  00000+0  00000+0 0  9995',
    '2 41866   0.0500 270.0000 0001000 180.0000  20.0000  1.00270000    09',
  ],
};
function readCache(key) {
  try {
    const item = JSON.parse(localStorage.getItem('sl-' + key));
    return item && Date.now() - item.time < CACHE_TTL ? item.data : null;
  } catch {
    return null;
  }
}
function writeCache(key, data) {
  try {
    localStorage.setItem('sl-' + key, JSON.stringify({ time: Date.now(), data }));
  } catch {}
}
async function cachedFetch(key, url) {
  const prior = readCache(key);
  try {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!response.ok) throw Error('HTTP ' + response.status);
    const data = await response.json();
    writeCache(key, data);
    return { data, source: 'live' };
  } catch (error) {
    return { data: prior, source: prior ? 'cache' : 'fallback', error: error.message };
  }
}
function groupFor(name) {
  const s = name.toUpperCase();
  if (s.includes('GPS') || s.includes('GALILEO')) return 'navigation';
  if (s.includes('NOAA') || s.includes('SUOMI') || s.includes('JPSS')) return 'weather';
  if (s.includes('LANDSAT')) return 'resource';
  if (s.includes('GOES')) return 'goes';
  if (s.includes('ISS') || s.includes('ZARYA')) return 'stations';
  return 'weather';
}
function seedFor(name) {
  const group = groupFor(name);
  return (
    SATELLITE_SEEDS.find((s) => s.name === name) || {
      name,
      group,
      mission:
        group === 'navigation'
          ? 'Navigation'
          : group === 'resource'
            ? 'Earth observation'
            : group === 'stations'
              ? 'Research'
              : 'Weather',
      purpose:
        group === 'navigation' ? 'Global positioning and timing services' : 'Public catalog object',
      launch: '2010-01-01',
      expectedLife: 15,
    }
  );
}
async function getSatellites() {
  const groups = ['weather', 'resource', 'stations', 'goes', 'gps-ops'];
  const fetched = await Promise.all(
    groups.map((g) =>
      cachedFetch('tle-' + g, `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=json`),
    ),
  );
  let records = [];
  fetched.forEach((result, index) => {
    if (Array.isArray(result.data))
      records.push(...result.data.map((row) => ({ ...row, _group: groups[index] })));
  });
  const unique = new Map(records.map((x) => [x.OBJECT_NAME || x.NAME, x]));
  const names = [
    ...SATELLITE_SEEDS.map((x) => x.name),
    ...records
      .filter((x) => x._group === 'gps-ops' && (x.OBJECT_NAME || x.NAME))
      .slice(0, 3)
      .map((x) => x.OBJECT_NAME || x.NAME),
  ];
  const satellites = [...new Set(names)].map((name) => {
    const raw = unique.get(name);
    const seed = seedFor(name);
    return {
      ...seed,
      noradId: raw?.NORAD_CAT_ID || name.match(/\d+/)?.[0] || '—',
      tle1: raw?.TLE_LINE1 || fallbackTles[name]?.[0],
      tle2: raw?.TLE_LINE2 || fallbackTles[name]?.[1],
      catalogLive: !!raw,
    };
  });
  const live = fetched.some((x) => x.source === 'live');
  return {
    satellites,
    source: live ? 'live' : fetched.some((x) => x.source === 'cache') ? 'cache' : 'fallback',
  };
}
async function getSpaceWeather() {
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [flares, storms] = await Promise.all([
    cachedFetch(
      'donki-flares',
      `https://api.nasa.gov/DONKI/FLR?startDate=${start}&api_key=${NASA_API_KEY}`,
    ),
    cachedFetch(
      'donki-storms',
      `https://api.nasa.gov/DONKI/GST?startDate=${start}&api_key=${NASA_API_KEY}`,
    ),
  ]);
  const data = [
    ...(Array.isArray(flares.data)
      ? flares.data.map((x) => ({ ...x, eventType: 'Solar flare' }))
      : []),
    ...(Array.isArray(storms.data)
      ? storms.data.map((x) => ({ ...x, eventType: 'Geomagnetic storm' }))
      : []),
  ];
  return {
    data,
    source:
      flares.source === 'live' || storms.source === 'live'
        ? 'live'
        : flares.source === 'cache' || storms.source === 'cache'
          ? 'cache'
          : 'fallback',
    flares: flares.data || [],
    storms: storms.data || [],
  };
}
async function getEarthEvents() {
  return cachedFetch(
    'eonet-events',
    'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60',
  );
}
function launchAge(date) {
  return Math.max(0, (Date.now() - new Date(date + 'T00:00:00Z')) / 31557600000);
}
function getPosition(sat, date = new Date()) {
  try {
    if (!window.satellite || !sat.tle1) return null;
    const rec = satellite.twoline2satrec(sat.tle1, sat.tle2),
      pv = satellite.propagate(rec, date);
    if (!pv.position || typeof pv.position === 'boolean') return null;
    const gmst = satellite.gstime(date),
      geo = satellite.eciToGeodetic(pv.position, gmst);
    return {
      lat: satellite.degreesLat(geo.latitude),
      lon: satellite.degreesLong(geo.longitude),
      altitude: pv.position ? Math.round(satellite.eciToGeodetic(pv.position, gmst).height) : 0,
      velocity:
        Math.round(Math.sqrt(pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2) * 100) /
        100,
      inclination: Number((rec.inclo * 180) / Math.PI).toFixed(2),
    };
  } catch {
    return null;
  }
}
window.SLApi = {
  SATELLITE_SEEDS,
  getSatellites,
  getSpaceWeather,
  getEarthEvents,
  getPosition,
  launchAge,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let fleet = [];
let events = [];
let activeSat = null;
let currentFilter = 'All';
const maps = {};
const satIcons = ['◈', '⌖', '✦', '◉'];

function switchView(name) {
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
  $$('.nav-link').forEach((button) =>
    button.classList.toggle('active', button.dataset.view === name),
  );
  const labels = {
    home: 'OVERVIEW',
    explorer: 'SATELLITE EXPLORER',
    life: 'MY LIFE',
    simulator: 'DECISION SIMULATOR',
  };
  $('#crumb').textContent = labels[name] || 'OVERVIEW';
  setTimeout(() => Object.values(maps).forEach((map) => map.invalidateSize()), 80);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('.nav-link').forEach((button) =>
  button.addEventListener('click', () => switchView(button.dataset.view)),
);
$$('[data-goto]').forEach((button) =>
  button.addEventListener('click', () => switchView(button.dataset.goto)),
);
$('.brand').addEventListener('click', (event) => {
  event.preventDefault();
  switchView('home');
});

function ageYears(sat) {
  return SLApi.launchAge(sat.launch);
}
function renderFleet() {
  const query = $('#sat-search').value.trim().toLowerCase();
  const filtered = fleet.filter((sat) => {
    const category = sat.mission === 'Weather' ? 'Weather' : sat.mission;
    return (
      (currentFilter === 'All' || category.toLowerCase() === currentFilter.toLowerCase()) &&
      `${sat.name} ${sat.noradId} ${sat.mission}`.toLowerCase().includes(query)
    );
  });
  $('#result-count').textContent = filtered.length;
  $('#sat-list').innerHTML =
    filtered
      .map(
        (sat) => `
    <button class="sat-row ${activeSat?.name === sat.name ? 'selected' : ''}" data-sat="${encodeURIComponent(sat.name)}">
      <span class="sat-orb">${satIcons[fleet.indexOf(sat) % satIcons.length]}</span>
      <span class="sat-row-main"><b>${sat.name}</b><small>${sat.mission} · NORAD ${sat.noradId}</small></span>
      <span class="sat-id">${sat.catalogLive ? 'LIVE' : 'PUBLIC'}</span>
    </button>`,
      )
      .join('') || '<div class="loading-row">No satellites match this search.</div>';
  $$('.sat-row[data-sat]').forEach((row) =>
    row.addEventListener('click', () => selectSatellite(decodeURIComponent(row.dataset.sat))),
  );
}
function drawDetailMap(sat, position) {
  if (!position || !window.L) return;
  const map = L.map('detail-map', { scrollWheelZoom: false, zoomControl: false }).setView(
    [position.lat, position.lon],
    2,
  );
  maps.detail = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 6,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);
  const points = [];
  for (let minute = -30; minute <= 30; minute++) {
    const point = SLApi.getPosition(sat, new Date(Date.now() + minute * 240000));
    if (point) points.push([point.lat, point.lon]);
  }
  if (points.length > 2) L.polyline(points, { color: '#3477f6', weight: 2 }).addTo(map);
  L.circleMarker([position.lat, position.lon], {
    radius: 5,
    color: '#fff',
    weight: 1,
    fillColor: '#3477f6',
    fillOpacity: 1,
  }).addTo(map);
}
function selectSatellite(name) {
  const sat = fleet.find((item) => item.name === name);
  if (!sat) return;
  activeSat = sat;
  renderFleet();
  const position = SLApi.getPosition(sat);
  const age = ageYears(sat);
  if (maps.detail) {
    maps.detail.remove();
    delete maps.detail;
  }
  $('#sat-detail').innerHTML = `
    <div class="sat-detail-header"><div class="sat-hero">${satIcons[fleet.indexOf(sat) % satIcons.length]}</div>
      <div><h2>${sat.name}</h2><p>${sat.purpose} · NORAD ${sat.noradId}</p><span class="status-pill green">● TRACKABLE OBJECT</span></div></div>
    <div class="detail-stats">
      <div class="detail-stat"><small>ORBITAL ALTITUDE</small><b>${position ? position.altitude.toLocaleString() + ' km' : 'Unavailable'}</b></div>
      <div class="detail-stat"><small>ORBITAL SPEED</small><b>${position ? position.velocity + ' km/s' : 'Unavailable'}</b></div>
      <div class="detail-stat"><small>INCLINATION</small><b>${position ? position.inclination + '°' : 'Unavailable'}</b></div>
      <div class="detail-stat"><small>MISSION AGE</small><b>${age.toFixed(1)} yrs</b></div>
      <div class="detail-stat"><small>LATITUDE</small><b>${position ? position.lat.toFixed(2) + '°' : 'Unavailable'}</b></div>
      <div class="detail-stat"><small>LONGITUDE</small><b>${position ? position.lon.toFixed(2) + '°' : 'Unavailable'}</b></div>
    </div><div class="eyebrow">ORBITAL TRACK</div><div class="detail-map" id="detail-map"></div>
    <p class="detail-copy"><b>Mission profile:</b> ${sat.purpose}. Public orbital elements support approximate position calculations. Internal component health, fuel state, and failure history are not available in the GP catalog. Simulator outputs are scenarios, not measured telemetry.</p>
    <button class="button primary" id="simulate-this">Assess this satellite →</button>`;
  drawDetailMap(sat, position);
  $('#simulate-this').addEventListener('click', () => {
    populateSim(sat);
    switchView('simulator');
  });
  $('#sim-satellite').value = sat.name;
}
function makeMap(id, center = [20, 0], zoom = 2) {
  if (!window.L || maps[id]) return maps[id];
  const map = L.map(id, { scrollWheelZoom: false, worldCopyJump: true }).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 8,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);
  maps[id] = map;
  return map;
}
function drawHomeMap() {
  const map = makeMap('home-map', [18, 0], 2);
  if (!map) return;
  map.eachLayer((layer) => {
    if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
  });
  fleet.slice(0, 6).forEach((sat, index) => {
    const position = SLApi.getPosition(sat);
    if (!position) return;
    L.circleMarker([position.lat, position.lon], {
      radius: 5,
      color: '#fff',
      weight: 1,
      fillColor: '#3477f6',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup(`<b>${sat.name}</b><br>${sat.mission} · ${position.altitude} km`);
    const track = [];
    for (let minute = -24; minute <= 24; minute++) {
      const point = SLApi.getPosition(sat, new Date(Date.now() + minute * 180000));
      if (point) track.push([point.lat, point.lon]);
    }
    if (track.length > 2)
      L.polyline(track, {
        color: ['#3477f6', '#159c74', '#795ee8', '#ed8b55'][index % 4],
        weight: 1,
        opacity: 0.6,
        dashArray: '4 5',
      }).addTo(map);
  });
  events.slice(0, 20).forEach((event) => {
    const coords = event.geometry?.at(-1)?.coordinates;
    if (coords?.length >= 2)
      L.circleMarker([coords[1], coords[0]], {
        radius: 4,
        color: '#df7955',
        fillColor: '#f39b70',
        fillOpacity: 0.8,
        weight: 1,
      })
        .addTo(map)
        .bindPopup(`<b>${event.title}</b><br>${event.categories?.[0]?.title || 'Earth event'}`);
  });
}
function drawLifeMap() {
  const map = makeMap('life-map', [40, -25], 2);
  if (!map) return;
  map.eachLayer((layer) => {
    if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
  });
  fleet.slice(0, 6).forEach((sat, index) => {
    const points = [];
    for (let minute = -36; minute <= 36; minute++) {
      const point = SLApi.getPosition(sat, new Date(Date.now() + minute * 240000));
      if (point) points.push([point.lat, point.lon]);
    }
    if (points.length > 2)
      L.polyline(points, {
        color: ['#3477f6', '#159c74', '#795ee8', '#ed8b55'][index % 4],
        weight: 1.5,
        opacity: 0.7,
      }).addTo(map);
  });
}
function renderWatch() {
  const watch = [...fleet].sort((a, b) => ageYears(b) - ageYears(a)).slice(0, 4);
  $('#watch-list').innerHTML = watch
    .map(
      (sat) =>
        `<div class="watch-item"><div class="sat-orb">◈</div><div><b>${sat.name}</b><small>${sat.mission} · ${ageYears(sat).toFixed(1)} years on orbit</small></div><em>${sat.catalogLive ? 'TRACKED' : 'PROFILE'}</em></div>`,
    )
    .join('');
}
function fillSimulator() {
  $('#sim-satellite').innerHTML = fleet
    .map((sat) => `<option value="${sat.name}">${sat.name} — ${sat.mission}</option>`)
    .join('');
  if (activeSat) $('#sim-satellite').value = activeSat.name;
}
function populateSim(sat) {
  if (!sat) return;
  activeSat = sat;
  $('#sim-satellite').value = sat.name;
  $('#age').value = Math.max(1, Math.min(25, Math.round(ageYears(sat))));
  updateSimulator();
}
function updateSimulator() {
  const input = {
    age: +$('#age').value,
    degradation: +$('#degradation').value,
    fuel: +$('#fuel').value,
    repair: +$('#repair').value,
    replace: +$('#replace').value,
    solar: +$('#solar').value,
  };
  for (const id of ['age', 'degradation', 'fuel', 'repair', 'replace', 'solar']) {
    $(`#${id}-output`).textContent = ['degradation', 'solar'].includes(id)
      ? input[id].toFixed(1)
      : input[id];
    const slider = $(`#${id}`);
    const percent = ((input[id] - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background = `linear-gradient(90deg,#3477f6 ${percent}%,#e5eaf1 ${percent}%)`;
  }
  const result = calculateScenario(input);
  const best = result.best;
  const titles = {
    keep: 'Keep operating',
    service: 'Schedule in-orbit servicing',
    replace: 'Deorbit & replace',
  };
  const summaries = {
    keep: 'Current assumptions favor continued operation with routine monitoring.',
    service:
      'The servicing scenario has the strongest modeled value and lowers risk under these assumptions.',
    replace:
      'Replacement provides the strongest modeled value after accounting for elevated failure risk.',
  };
  $('#recommendation').textContent = titles[best.key];
  $('#recommendation-copy').textContent = summaries[best.key];
  $('#confidence').textContent = result.robustness;
  $('#decision-tag').textContent = best.label.toUpperCase();
  $('#decision-tag').className =
    `status-pill ${best.key === 'keep' ? 'green' : best.key === 'service' ? 'blue-pill' : 'amber-pill'}`;
  $('#risk-value').innerHTML = `${result.fail}<span>%</span>`;
  const bars = Array.from({ length: 9 }, (_, index) => {
    const cumulative = 1 - Math.pow(1 - result.fail / 100, (index + 1) / 9);
    return Math.max(8, Math.min(100, Math.round(cumulative * 100)));
  });
  $('#risk-chart').innerHTML = bars.map((height) => `<i style="height:${height}%"></i>`).join('');
  $('#npv-value').innerHTML = `${best.npv < 0 ? '−' : '+'}$${Math.abs(best.npv)}<span>M</span>`;
  $('#op-value').textContent = `$${best.operatingValue}M`;
  $('#cost-value').textContent = `−$${best.cost}M`;
  $('#pathways').innerHTML = result.paths
    .map(
      (path) =>
        `<div class="path-row"><span>${path.label}</span><div class="path-track"><div class="path-bar ${path.key === best.key ? 'best' : ''}" style="width:${Math.max(7, Math.min(100, (path.npv + 100) / 2))}%"></div></div><b>${path.npv < 0 ? '−' : '+'}$${Math.abs(path.npv)}M</b></div>`,
    )
    .join('');
  $('#sustain-score').textContent = result.score;
  $('#sustain-title').textContent =
    best.key === 'replace' ? 'New launch and disposal impact' : 'Lower near-term launch demand';
  $('#sustain-copy').textContent =
    best.key === 'replace'
      ? 'Replacement adds launch emissions and requires responsible disposal of the aging spacecraft.'
      : 'Continuing service avoids a new launch in this scenario; end-of-life planning remains essential.';
}
function setDataStatus(message, live) {
  $('#data-status').textContent = message;
  $('.data-status i').style.background = live ? '#29c895' : '#e0a644';
}
async function loadData() {
  setDataStatus('Connecting to data', false);
  try {
    const [catalog, weather, earth] = await Promise.all([
      SLApi.getSatellites(),
      SLApi.getSpaceWeather(),
      SLApi.getEarthEvents(),
    ]);
    fleet = catalog.satellites;
    events = earth.data?.events || [];
    $('#tracked-count').textContent = fleet.length;
    $('#all-count').textContent = fleet.length;
    $('#event-count').textContent = earth.data?.events?.length ?? '—';
    const hazards = weather.data || [];
    $('#weather-level').textContent = hazards.length ? 'Elevated' : 'Quiet';
    $('#weather-pill').textContent = hazards.length
      ? `● ${hazards.length} EVENTS`
      : '● NO RECENT EVENTS';
    $('#weather-pill').className = `status-pill ${hazards.length ? 'amber-pill' : 'green'}`;
    $('#weather-pill').title =
      weather.source === 'fallback'
        ? 'NASA DONKI unavailable; showing no cached recent events.'
        : `NASA DONKI ${weather.source} data, recent 30 days`;
    $('#updated-time').textContent = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const live = [catalog, weather, earth].some((item) => item.source === 'live');
    const cached = [catalog, weather, earth].some((item) => item.source === 'cache');
    setDataStatus(
      live
        ? 'Public feeds connected'
        : cached
          ? 'Using cached public data'
          : 'Demo data · feeds unavailable',
      live,
    );
    renderWatch();
    renderFleet();
    fillSimulator();
    if (!activeSat && fleet.length) {
      activeSat = fleet[0];
      $('#age').value = Math.max(1, Math.min(25, Math.round(ageYears(activeSat))));
    }
    drawHomeMap();
    drawLifeMap();
    if (activeSat) selectSatellite(activeSat.name);
    updateSimulator();
    if (window.gsap)
      gsap.from('.metric-card', {
        y: 10,
        opacity: 0,
        duration: 0.4,
        stagger: 0.07,
        ease: 'power2.out',
      });
  } catch (error) {
    console.error('SpaceLifeSpan data load failed:', error);
    setDataStatus('Data load failed · use refresh', false);
    showToast('Could not load the dashboard data. Check your connection and refresh.');
  }
}
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

$('#sat-search').addEventListener('input', renderFleet);
$('#filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  currentFilter = button.dataset.filter;
  $$('.filter').forEach((filter) => filter.classList.toggle('active', filter === button));
  renderFleet();
});
$('#sim-satellite').addEventListener('change', (event) => {
  const sat = fleet.find((item) => item.name === event.target.value);
  if (sat) populateSim(sat);
});
$$('.interest').forEach((button) =>
  button.addEventListener('click', () => {
    button.classList.toggle('selected');
    try {
      localStorage.setItem(
        'sl-interests',
        JSON.stringify($$('.interest.selected').map((item) => item.textContent.trim())),
      );
    } catch {}
  }),
);
try {
  const selectedInterests = JSON.parse(localStorage.getItem('sl-interests') || '[]');
  $$('.interest').forEach((button) =>
    button.classList.toggle('selected', selectedInterests.includes(button.textContent.trim())),
  );
} catch {}
$('#save-region').addEventListener('click', () => {
  const region = $('#region-input').value.trim() || 'Seattle, WA';
  $('#region-input').value = region;
  $('#region-label').textContent = region;
  try {
    localStorage.setItem('sl-region', region);
  } catch {}
  showToast(`Region saved: ${region}`);
});
try {
  const region = localStorage.getItem('sl-region');
  if (region) {
    $('#region-input').value = region;
    $('#region-label').textContent = region;
  }
} catch {}
$('#locate-btn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Device location is unavailable. Enter a region instead.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      $('#region-input').value =
        `${position.coords.latitude.toFixed(2)}°, ${position.coords.longitude.toFixed(2)}°`;
      $('#save-region').click();
    },
    () => showToast('Location was not available. You can enter a region manually.'),
    { timeout: 7000, maximumAge: 60000 },
  );
});
['age', 'degradation', 'fuel', 'repair', 'replace', 'solar'].forEach((id) =>
  $(`#${id}`).addEventListener('input', updateSimulator),
);
$('#run-sim').addEventListener('click', () => {
  updateSimulator();
  showToast('Scenario comparison recalculated.');
});
$('#refresh-btn').addEventListener('click', loadData);
$('#settings-btn').addEventListener('click', () => switchView('life'));
$('#notifications-btn').addEventListener('click', () =>
  showToast('No new mission alerts. Refresh feeds to check for updates.'),
);
const dateLabel = $('#current-date');
if (dateLabel)
  dateLabel.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
    .format(new Date())
    .toUpperCase();
loadData();

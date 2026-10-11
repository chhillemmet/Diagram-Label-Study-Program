const STUDY_COUNTRIES = [
  'Algeria', 'Central African Republic', 'Democratic Republic of the Congo',
  'Republic of the Congo', "Cote d'Ivoire/Ivory Coast", 'Egypt', 'Ethiopia',
  'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Mali', 'Morocco',
  'Namibia', 'Nigeria', 'Rwanda', 'Sierra Leone', 'Somalia', 'South Africa',
  'Sudan', 'South Sudan', 'Tanzania', 'Tunisia', 'Zimbabwe',
];

// Region IDs correspond to the enclosed white areas in the two supplied maps.
const COUNTRY_REGION_IDS = {
  Algeria: 2, 'Central African Republic': 28,
  'Democratic Republic of the Congo': 33, 'Republic of the Congo': 36,
  "Cote d'Ivoire/Ivory Coast": 29, Egypt: 6, Ethiopia: 16, Kenya: 34,
  Lesotho: 57, Liberia: 31, Libya: 5, Madagascar: 48, Mali: 9, Morocco: 4,
  Namibia: 51, Nigeria: 18, Rwanda: 40, 'Sierra Leone': 30, Somalia: 24,
  'South Africa': 54, Sudan: 12, 'South Sudan': 23, Tanzania: 39, Tunisia: 3,
  Zimbabwe: 49,
};
const STUDY_FEATURES = [
  'Atlas Mountains', 'Sahara Desert', 'Nubian Desert', 'Congo Basin',
  'Ethiopian Highlands', 'Serengeti', 'Kalahari Desert', 'Namib Desert',
  'Dragon Mountains',
];
const FEATURE_REGION_IDS = {
  'Atlas Mountains': 2, 'Sahara Desert': 3, 'Nubian Desert': 4,
  'Congo Basin': 5, 'Ethiopian Highlands': 6, Serengeti: 7,
  'Kalahari Desert': 8, 'Namib Desert': 9, 'Dragon Mountains': 10,
};
const STUDY_ITEMS = [
  ...STUDY_COUNTRIES.map(name => ({ name, mapId: 'countries', regionId: COUNTRY_REGION_IDS[name], kind: 'country' })),
  ...STUDY_FEATURES.map(name => ({ name, mapId: 'geography', regionId: FEATURE_REGION_IDS[name], kind: 'geographic feature' })),
];
const MAPS = {
  countries: { source: document.querySelector('#source-map'), index: document.querySelector('#region-index') },
  geography: { source: document.querySelector('#source-geography-map'), index: document.querySelector('#geography-region-index') },
};
const ROUND_DELAY = 1500;
const FEEDBACK_COLORS = { correct: [92, 157, 100], wrong: [196, 76, 61] };

const homeScreen = document.querySelector('#home-screen');
const quizScreen = document.querySelector('#quiz-screen');
const resultsScreen = document.querySelector('#results-screen');
const appShell = document.querySelector('.app-shell');
const startButton = document.querySelector('#start-button');
const playAgainButton = document.querySelector('#play-again-button');
const startNote = document.querySelector('#setup-note');

let mapsReady = false;
let queue = [];
let roundIndex = 0;
let activeTarget = null;
let scoreByName = new Map();
let busy = false;

function setupIssue() {
  if (!mapsReady) return 'Loading the maps…';
  if (STUDY_COUNTRIES.length !== 25 || STUDY_FEATURES.length !== 9 || STUDY_ITEMS.length !== 34) return 'The study list is incomplete.';
  const missing = STUDY_ITEMS.filter(item => !item.regionId);
  if (missing.length) return `Map regions not configured for: ${missing.map(item => item.name).join(', ')}.`;
  return '';
}

function syncSetup() {
  const issue = setupIssue();
  startButton.disabled = Boolean(issue);
  startNote.textContent = issue;
  document.querySelector('#country-count').textContent = '34 places · one round';
}

function loadMaps() {
  Promise.all(Object.values(MAPS).flatMap(map => [map.source.decode(), map.index.decode()])).then(() => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      const width = map.source.naturalWidth;
      const height = map.source.naturalHeight;
      if (width !== 1011 || height !== 1082 || map.index.naturalWidth !== width || map.index.naturalHeight !== height) {
        throw new Error(`The ${mapId} map and region index do not match.`);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(map.index, 0, 0);
      map.labels = context.getImageData(0, 0, width, height).data;
    }
    mapsReady = true;
    renderMap(document.querySelector('#home-map'), 'countries');
    syncSetup();
  }).catch(() => {
    startNote.textContent = 'A map could not load. Open this page through GitHub Pages or a local web server.';
  });
}

function renderMap(canvas, mapId, regionColors = {}) {
  if (!mapsReady) return;
  const map = MAPS[mapId];
  const { naturalWidth: width, naturalHeight: height } = map.source;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  context.drawImage(map.source, 0, 0, width, height);
  if (!Object.keys(regionColors).length) return;
  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  for (let pixel = 0, offset = 0; pixel < map.labels.length / 4; pixel++, offset += 4) {
    const color = regionColors[map.labels[offset]];
    if (!color) continue;
    const opacity = 0.47;
    pixels[offset] = Math.round(pixels[offset] * (1 - opacity) + color[0] * opacity);
    pixels[offset + 1] = Math.round(pixels[offset + 1] * (1 - opacity) + color[1] * opacity);
    pixels[offset + 2] = Math.round(pixels[offset + 2] * (1 - opacity) + color[2] * opacity);
  }
  context.putImageData(frame, 0, 0);
}

function randomize(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function setScreen(screen) {
  appShell.classList.toggle('is-playing', screen === quizScreen);
  for (const panel of [homeScreen, quizScreen, resultsScreen]) panel.hidden = panel !== screen;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function beginRound() {
  const issue = setupIssue();
  if (issue) { startNote.textContent = issue; return; }
  queue = randomize(STUDY_ITEMS);
  roundIndex = 0;
  activeTarget = null;
  busy = false;
  scoreByName = new Map();
  setScreen(quizScreen);
  showTarget();
}

function showTarget() {
  if (roundIndex >= queue.length) { finishRound(); return; }
  activeTarget = queue[roundIndex];
  document.querySelector('#target-name').textContent = activeTarget.name;
  document.querySelector('#target-prompt-kind').textContent = activeTarget.kind;
  document.querySelector('#target-kind-label').textContent = `YOUR NEXT ${activeTarget.kind.toUpperCase()}`;
  document.querySelector('#map-type-label').textContent = activeTarget.mapId === 'countries' ? 'Countries' : 'Geographic features';
  document.querySelector('#progress-label').textContent = `${String(roundIndex + 1).padStart(2, '0')} / ${queue.length}`;
  document.querySelector('#progress-fill').style.width = `${(roundIndex / queue.length) * 100}%`;
  const feedback = document.querySelector('#feedback');
  feedback.className = 'feedback';
  feedback.textContent = `Click the ${activeTarget.kind} on the map.`;
  renderMap(document.querySelector('#quiz-map'), activeTarget.mapId);
  busy = false;
}

function regionAtClick(event) {
  const canvas = event.currentTarget;
  const bounds = canvas.getBoundingClientRect();
  const imageAspect = canvas.width / canvas.height;
  let imageWidth = bounds.width;
  let imageHeight = bounds.height;
  if (imageWidth / imageHeight > imageAspect) imageWidth = imageHeight * imageAspect;
  else imageHeight = imageWidth / imageAspect;
  const imageLeft = bounds.left + (bounds.width - imageWidth) / 2;
  const imageTop = bounds.top + (bounds.height - imageHeight) / 2;
  if (event.clientX < imageLeft || event.clientY < imageTop || event.clientX >= imageLeft + imageWidth || event.clientY >= imageTop + imageHeight) return 0;
  const x = Math.floor((event.clientX - imageLeft) * canvas.width / imageWidth);
  const y = Math.floor((event.clientY - imageTop) * canvas.height / imageHeight);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return 0;
  return MAPS[activeTarget.mapId].labels[(y * canvas.width + x) * 4];
}

function onMapClick(event) {
  if (busy || !activeTarget || event.button !== 0) return;
  const clickedRegion = regionAtClick(event);
  // Region 1 is the map background; zero is a border or separator line.
  if (clickedRegion < 2) return;
  answer(clickedRegion);
}

function answer(clickedRegion) {
  busy = true;
  const targetRegion = activeTarget.regionId;
  const correct = clickedRegion === targetRegion;
  scoreByName.set(activeTarget.name, correct);
  const flashColors = { [targetRegion]: FEEDBACK_COLORS.correct };
  if (!correct) flashColors[clickedRegion] = FEEDBACK_COLORS.wrong;
  renderMap(document.querySelector('#quiz-map'), activeTarget.mapId, flashColors);
  const feedback = document.querySelector('#feedback');
  feedback.className = `feedback ${correct ? 'good' : 'bad'}`;
  feedback.textContent = correct
    ? `Correct — ${activeTarget.name}.`
    : `Not quite. Your selection is red; ${activeTarget.name} is green.`;
  playTone(correct);
  window.setTimeout(() => { roundIndex += 1; showTarget(); }, ROUND_DELAY);
}

function playTone(correct) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain); gain.connect(context.destination);
    const now = context.currentTime;
    if (correct) {
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(760, now);
      oscillator.frequency.exponentialRampToValueAtTime(1040, now + .12);
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.12, now + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .22); oscillator.start(now); oscillator.stop(now + .23);
    } else {
      oscillator.type = 'sawtooth'; oscillator.frequency.setValueAtTime(180, now);
      oscillator.frequency.linearRampToValueAtTime(100, now + .25);
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.1, now + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .3); oscillator.start(now); oscillator.stop(now + .31);
    }
    oscillator.onended = () => context.close();
  } catch { /* The visual answer still works if audio is unavailable. */ }
}

function finishRound() {
  activeTarget = null;
  const correctItems = STUDY_ITEMS.filter(item => scoreByName.get(item.name) === true);
  const missedItems = STUDY_ITEMS.filter(item => scoreByName.get(item.name) !== true);
  for (const [mapId, canvasId] of [['countries', '#results-country-map'], ['geography', '#results-geography-map']]) {
    const items = STUDY_ITEMS.filter(item => item.mapId === mapId);
    const colors = {};
    for (const item of correctItems) if (item.mapId === mapId) colors[item.regionId] = FEEDBACK_COLORS.correct;
    for (const item of missedItems) if (item.mapId === mapId) colors[item.regionId] = FEEDBACK_COLORS.wrong;
    renderMap(document.querySelector(canvasId), mapId, colors);
  }
  document.querySelector('#score-count').textContent = String(correctItems.length);
  document.querySelector('#score-percent').textContent = `${Math.round(correctItems.length / STUDY_ITEMS.length * 100)}%`;
  document.querySelector('#correct-count').textContent = String(correctItems.length);
  document.querySelector('#missed-count').textContent = String(missedItems.length);
  document.querySelector('#results-lede').textContent = missedItems.length
    ? `You identified ${correctItems.length} of ${STUDY_ITEMS.length} places. Review the missed places and take another round.`
    : `You identified all ${STUDY_ITEMS.length} places. Excellent work.`;
  fillList('#correct-list', correctItems.map(item => item.name));
  fillList('#missed-list', missedItems.map(item => item.name));
  setScreen(resultsScreen);
}

function fillList(selector, names) {
  const list = document.querySelector(selector);
  list.replaceChildren();
  if (!names.length) {
    const item = document.createElement('li'); item.textContent = 'None'; list.append(item); return;
  }
  for (const name of names) { const item = document.createElement('li'); item.textContent = name; list.append(item); }
}

startButton.addEventListener('click', beginRound);
playAgainButton.addEventListener('click', beginRound);
document.querySelectorAll('[data-action="menu"]').forEach(button => button.addEventListener('click', () => setScreen(homeScreen)));
document.querySelector('#quiz-map').addEventListener('click', onMapClick);
loadMaps();
syncSetup();

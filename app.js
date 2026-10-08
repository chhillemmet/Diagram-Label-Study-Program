const STUDY_COUNTRIES = [
  'Algeria',
  'Central African Republic',
  'Democratic Republic of the Congo',
  'Republic of the Congo',
  "Cote d'Ivoire/Ivory Coast",
  'Egypt',
  'Ethiopia',
  'Kenya',
  'Lesotho',
  'Liberia',
  'Libya',
  'Madagascar',
  'Mali',
  'Morocco',
  'Namibia',
  'Nigeria',
  'Rwanda',
  'Sierra Leone',
  'Somalia',
  'South Africa',
  'Sudan',
  'South Sudan',
  'Tanzania',
  'Tunisia',
  'Zimbabwe',
];

// Region IDs come from the connected country areas in the supplied blank map.
const COUNTRY_REGION_IDS = {
  Algeria: 2,
  'Central African Republic': 28,
  'Democratic Republic of the Congo': 33,
  'Republic of the Congo': 36,
  "Cote d'Ivoire/Ivory Coast": 29,
  Egypt: 6,
  Ethiopia: 16,
  Kenya: 34,
  Lesotho: 55,
  Liberia: 31,
  Libya: 5,
  Madagascar: 48,
  Mali: 9,
  Morocco: 4,
  Namibia: 51,
  Nigeria: 18,
  Rwanda: 40,
  'Sierra Leone': 30,
  Somalia: 24,
  'South Africa': 54,
  Sudan: 12,
  'South Sudan': 23,
  Tanzania: 39,
  Tunisia: 3,
  Zimbabwe: 49,
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
const sourceMap = document.querySelector('#source-map');
const regionIndexImage = document.querySelector('#region-index');

let regionLabels = null;
let mapIsReady = false;
let queue = [];
let roundIndex = 0;
let activeTarget = null;
let scoreByCountry = new Map();
let busy = false;

function setupIssue() {
  if (!mapIsReady || !regionLabels) return 'Loading the map…';
  if (STUDY_COUNTRIES.length !== 25) return 'The study list must contain 25 countries.';
  if (new Set(STUDY_COUNTRIES).size !== 25) return 'The study list needs 25 different countries.';
  const missing = STUDY_COUNTRIES.filter(name => !COUNTRY_REGION_IDS[name]);
  if (missing.length) return `Map regions not configured for: ${missing.join(', ')}.`;
  return '';
}

function syncSetup() {
  const issue = setupIssue();
  startButton.disabled = Boolean(issue);
  startNote.textContent = issue;
  document.querySelector('#country-count').textContent = '25 countries · one round';
}

function loadMapData() {
  Promise.all([sourceMap.decode(), regionIndexImage.decode()]).then(() => {
    const width = sourceMap.naturalWidth;
    const height = sourceMap.naturalHeight;
    if (width !== 1011 || height !== 1082 || regionIndexImage.naturalWidth !== width || regionIndexImage.naturalHeight !== height) {
      throw new Error('The map image and region index do not match.');
    }
    const indexCanvas = document.createElement('canvas');
    indexCanvas.width = width;
    indexCanvas.height = height;
    const indexContext = indexCanvas.getContext('2d', { willReadFrequently: true });
    indexContext.drawImage(regionIndexImage, 0, 0);
    regionLabels = indexContext.getImageData(0, 0, width, height).data;
    mapIsReady = true;
    renderMap(document.querySelector('#home-map'));
    syncSetup();
  }).catch(() => {
    startNote.textContent = 'The map could not load. Open this page through GitHub Pages or a local web server.';
  });
}

function renderMap(canvas, regionColors = {}) {
  if (!mapIsReady) return;
  const width = sourceMap.naturalWidth;
  const height = sourceMap.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.drawImage(sourceMap, 0, 0, width, height);
  if (!Object.keys(regionColors).length) return;

  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  for (let pixel = 0, offset = 0; pixel < regionLabels.length / 4; pixel++, offset += 4) {
    const color = regionColors[regionLabels[offset]];
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
  queue = randomize(STUDY_COUNTRIES);
  roundIndex = 0;
  activeTarget = null;
  busy = false;
  scoreByCountry = new Map();
  renderMap(document.querySelector('#quiz-map'));
  setScreen(quizScreen);
  showTarget();
}

function showTarget() {
  if (roundIndex >= queue.length) { finishRound(); return; }
  activeTarget = queue[roundIndex];
  document.querySelector('#target-name').textContent = activeTarget;
  document.querySelector('#progress-label').textContent = `${String(roundIndex + 1).padStart(2, '0')} / ${queue.length}`;
  document.querySelector('#progress-fill').style.width = `${(roundIndex / queue.length) * 100}%`;
  const feedback = document.querySelector('#feedback');
  feedback.className = 'feedback';
  feedback.textContent = 'Click the country on the map.';
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
  return regionLabels[(y * canvas.width + x) * 4];
}

function onMapClick(event) {
  if (busy || !activeTarget) return;
  const clickedRegion = regionAtClick(event);
  // Region 1 is the surrounding white page; zero is ink/border pixels.
  if (clickedRegion < 2) return;
  answer(clickedRegion);
}

function answer(clickedRegion) {
  busy = true;
  const targetRegion = COUNTRY_REGION_IDS[activeTarget];
  const correct = clickedRegion === targetRegion;
  scoreByCountry.set(activeTarget, correct);
  const flashColors = { [targetRegion]: FEEDBACK_COLORS.correct };
  if (!correct) flashColors[clickedRegion] = FEEDBACK_COLORS.wrong;
  renderMap(document.querySelector('#quiz-map'), flashColors);

  const feedback = document.querySelector('#feedback');
  feedback.className = `feedback ${correct ? 'good' : 'bad'}`;
  feedback.textContent = correct
    ? `Correct — ${activeTarget}.`
    : `Not quite. The country you clicked is red; ${activeTarget} is green.`;
  playTone(correct);

  window.setTimeout(() => {
    roundIndex += 1;
    showTarget();
    renderMap(document.querySelector('#quiz-map'));
  }, ROUND_DELAY);
}

function playTone(correct) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    const now = context.currentTime;
    if (correct) {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(760, now);
      oscillator.frequency.exponentialRampToValueAtTime(1040, now + .12);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.12, now + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .22);
      oscillator.start(now);
      oscillator.stop(now + .23);
    } else {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(180, now);
      oscillator.frequency.linearRampToValueAtTime(100, now + .25);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.1, now + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .3);
      oscillator.start(now);
      oscillator.stop(now + .31);
    }
    oscillator.onended = () => context.close();
  } catch { /* The visual answer still works if audio is unavailable. */ }
}

function finishRound() {
  activeTarget = null;
  const correctNames = STUDY_COUNTRIES.filter(name => scoreByCountry.get(name) === true);
  const missedNames = STUDY_COUNTRIES.filter(name => scoreByCountry.get(name) !== true);
  const resultColors = {};
  for (const name of correctNames) resultColors[COUNTRY_REGION_IDS[name]] = FEEDBACK_COLORS.correct;
  for (const name of missedNames) resultColors[COUNTRY_REGION_IDS[name]] = FEEDBACK_COLORS.wrong;
  renderMap(document.querySelector('#results-map'), resultColors);

  document.querySelector('#score-count').textContent = String(correctNames.length);
  document.querySelector('#score-percent').textContent = `${Math.round(correctNames.length / STUDY_COUNTRIES.length * 100)}%`;
  document.querySelector('#correct-count').textContent = String(correctNames.length);
  document.querySelector('#missed-count').textContent = String(missedNames.length);
  document.querySelector('#results-lede').textContent = missedNames.length
    ? `You identified ${correctNames.length} of ${STUDY_COUNTRIES.length} countries. Review the missed countries and take another round.`
    : `You identified all ${STUDY_COUNTRIES.length} countries. Excellent work.`;
  fillList('#correct-list', correctNames);
  fillList('#missed-list', missedNames);
  setScreen(resultsScreen);
}

function fillList(selector, names) {
  const list = document.querySelector(selector);
  list.replaceChildren();
  if (!names.length) {
    const item = document.createElement('li');
    item.textContent = 'None';
    list.append(item);
    return;
  }
  for (const name of names) {
    const item = document.createElement('li');
    item.textContent = name;
    list.append(item);
  }
}

startButton.addEventListener('click', beginRound);
playAgainButton.addEventListener('click', beginRound);
document.querySelectorAll('[data-action="menu"]').forEach(button => button.addEventListener('click', () => setScreen(homeScreen)));
document.querySelector('#quiz-map').addEventListener('click', onMapClick);

loadMapData();
syncSetup();

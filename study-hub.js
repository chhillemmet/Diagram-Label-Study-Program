(() => {
  const $ = (selector) => document.querySelector(selector);
  const menu = $('#menu-screen'), quiz = $('#quiz-screen'), mapRoundScreen = $('#map-round-screen'), results = $('#results-screen');
  const inputs = [...document.querySelectorAll('input[name="subject"]')];
  let questions = [], current = 0, initialQuestionCount = 0, score = 0, bySubject = {}, locked = false, repeatMissed = true;
  let firstAttempts = new WeakMap();
  let includeMapRound = false, mapRoundStarted = false, mapResult = null;

  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffle = (items) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) { const j = rnd(0, i); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  };
  const fixed = (n, digits = 1) => Number(n).toFixed(digits);
  const numOptions = (answer, unit = '', digits = 1, offsets = null) => {
    const value = Number(answer);
    const delta = Math.max(1, Math.round(Math.abs(value) * .14 * 10) / 10);
    const ds = offsets || [delta, -delta, delta * 1.8];
    return shuffle([`${fixed(value, digits)}${unit}`, ...ds.map((d) => `${fixed(value + d, digits)}${unit}`)]);
  };
  const svg = (body, label) => `<svg viewBox="0 0 340 175" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><rect width="340" height="175" fill="#f8f7f2"/>${body}</svg>`;
  const rightTriangle = (angle, base, height, hyp = '') => svg(`<path d="M48 140 L258 140 L258 35 Z" fill="none" stroke="#303b34" stroke-width="3"/><path d="M244 140 L244 126 L258 126" fill="none" stroke="#303b34" stroke-width="2"/><path d="M78 140 A30 30 0 0 1 92 117" fill="none" stroke="#9154c5" stroke-width="2"/><text x="65" y="130" font-size="14" fill="#26302b">${angle}°</text><text x="143" y="162" font-size="14" fill="#26302b">${base}</text><text x="268" y="94" font-size="14" fill="#26302b">${height}</text>${hyp ? `<text x="144" y="80" font-size="14" fill="#26302b">${hyp}</text>` : ''}`, 'Right triangle with a marked angle and side lengths');
  const circleSvg = (rLabel) => svg(`<circle cx="170" cy="88" r="57" fill="none" stroke="#303b34" stroke-width="3"/><line x1="170" y1="88" x2="227" y2="88" stroke="#9154c5" stroke-width="3"/><text x="185" y="80" font-size="14" fill="#26302b">${rLabel}</text><text x="136" y="163" font-size="13" fill="#26302b">Sphere</text>`, 'Sphere with a labelled radius');
  const coneSvg = (r, h, s) => svg(`<ellipse cx="170" cy="135" rx="75" ry="20" fill="none" stroke="#303b34" stroke-width="3"/><path d="M95 135 L170 27 L245 135" fill="none" stroke="#303b34" stroke-width="3"/><line x1="170" y1="27" x2="170" y2="135" stroke="#9154c5" stroke-dasharray="5 4" stroke-width="2"/><line x1="170" y1="135" x2="245" y2="135" stroke="#9154c5" stroke-width="2"/><text x="177" y="91" font-size="13" fill="#26302b">h=${h}</text><text x="202" y="155" font-size="13" fill="#26302b">r=${r}</text><text x="210" y="75" font-size="13" fill="#26302b">s=${s}</text>`, 'Cone showing radius, perpendicular height and slant height');
  const solidSvg = (label, detail) => {
    let body;
    if (label.includes('Cube and sphere')) body = `<path d="M83 55 L224 55 L224 142 L83 142 Z M83 55 L112 35 L253 35 L224 55 M224 55 L253 35 L253 122 L224 142 M112 35 L112 122 L253 122" fill="none" stroke="#303b34" stroke-width="3"/><circle cx="153" cy="98" r="37" fill="none" stroke="#9154c5" stroke-width="3"/><text x="116" y="166" font-size="13" fill="#26302b">${detail}</text>`;
    else if (label.includes('pyramid')) body = `<path d="M170 28 L82 137 L258 137 Z M82 137 L128 154 L290 154 L258 137 M170 28 L128 154" fill="none" stroke="#303b34" stroke-width="3"/><line x1="170" y1="28" x2="170" y2="137" stroke="#9154c5" stroke-dasharray="5 4" stroke-width="2"/><text x="105" y="122" font-size="12" fill="#26302b">${detail}</text>`;
    else body = `<path d="M69 67 L183 67 L222 39 L108 39 Z M69 67 L69 124 L183 124 L183 67 M183 67 L222 39 L222 96 L183 124 M222 39 L274 70 L237 101 L222 96" fill="none" stroke="#303b34" stroke-width="3"/><path d="M222 39 L274 70 L237 101" fill="none" stroke="#9154c5" stroke-width="3"/><text x="76" y="151" font-size="12" fill="#26302b">${detail}</text>`;
    return svg(`${body}<text x="119" y="171" font-size="12" fill="#26302b">${label}</text>`, `${label} diagram with dimensions shown in the question`);
  };
  const make = (prompt, correct, options, diagram = '') => {
    const choices = [...new Set([String(correct), ...options.map(String)])];
    const answerValue = Number.parseFloat(correct);
    const unit = String(correct).replace(/^[\d.-]+/, '');
    while (choices.length < 4) choices.push(`${fixed(answerValue + choices.length * 3.7)}${unit}`);
    return { subject: 'math', subjectName: 'Academic Math 10', prompt, correct: String(correct), options: shuffle(choices), diagram };
  };

  function mathQuestions() {
    const bank = [];
    // 1.1: imperial conversions and unit referents.
    { const yd = rnd(4, 38), answer = yd * 3; bank.push(make(`Convert ${yd} yd. to feet.`, `${answer} ft.`, [`${yd} ft.`, `${yd * 12} ft.`, `${answer + 6} ft.`])); }
    { const inch = rnd(8, 72), answer = inch * 2.54; bank.push(make(`Convert ${inch} in. to centimetres. Use 1 in. = 2.54 cm and round to the nearest tenth.`, `${fixed(answer)} cm`, [`${fixed(inch / 2.54)} cm`, `${fixed(answer / 10)} cm`, `${fixed(answer + 2.5)} cm`])); }
    { const unit = ['1 mm','1 in.','1 ft.','1 m','1 km'][rnd(0,4)]; const choices = { '1 mm':['The width of an ant’s head','The length of a sheet of paper','The distance between two provinces','The diameter of a beach ball'], '1 in.':['The width of your largest toe','The diameter of a bicycle wheel','The distance to a nearby town','The length of a calculator'], '1 ft.':['The diameter of a basketball','The height of a hockey net','The distance between two cities','The height of a person'], '1 m':['The length of a large stride','The width of a classroom','The length of a dinner fork','The width of a keyboard'], '1 km':['About two and a half laps of an oval running track','The length of a snowboard','The length of an arm span','The length of a phone'] }[unit]; bank.push(make(`Which is a reasonable referent for ${unit}?`, choices[0], choices.slice(1))); }
    // 1.3: SI/imperial conversions and comparisons.
    { const yd = rnd(3, 19), answer = yd * .9144; bank.push(make(`A length is ${yd} yd. Convert it to metres using 1 yd. = 0.9144 m. Round to the nearest tenth.`, `${fixed(answer)} m`, [`${fixed(yd * 3)} m`, `${fixed(yd / .9144)} m`, `${fixed(answer + 1.5)} m`])); }
    { const ft = rnd(4, 11), inches = rnd(0, 11), total = ft * 12 + inches, cm = total * 2.54; bank.push(make(`A person is ${ft} ft. ${inches} in. tall. About how tall is that in centimetres? Use 1 in. = 2.54 cm.`, `${fixed(cm, 0)} cm`, [`${fixed(cm / 2.54, 0)} cm`, `${fixed(cm + 25, 0)} cm`, `${fixed(cm - 30, 0)} cm`])); }
    // 1.4: right pyramids and cones surface area.
    { const r = rnd(3, 8), h = rnd(6, 15), s = Math.sqrt(r*r+h*h), sa = Math.PI*r*(r+s); bank.push(make(`A right cone has radius ${r} cm and height ${h} cm. Find its total surface area to the nearest square centimetre.`, `${Math.round(sa)} cm²`, [`${Math.round(Math.PI*r*s)} cm²`, `${Math.round(Math.PI*r*r*h)} cm²`, `${Math.round(sa + 2*Math.PI*r)} cm²`], coneSvg(r, h, fixed(s)))); }
    { const side = rnd(3, 9), slant = rnd(6, 14), sa = side*side + 2*side*slant; bank.push(make(`A right square pyramid has base side ${side} cm and face slant height ${slant} cm. Find its total surface area.`, `${sa} cm²`, [`${2*side*side + side*slant} cm²`, `${side*side + 4*side*slant} cm²`, `${Math.round(sa * .75)} cm²`], solidSvg('Square pyramid', `base ${side} cm · slant ${slant} cm`))); }
    // 1.5: cone/pyramid volume.
    { const r = rnd(3, 8), h = rnd(5, 16), v = Math.PI*r*r*h/3; bank.push(make(`A cone has radius ${r} cm and perpendicular height ${h} cm. Find its volume to the nearest cubic centimetre.`, `${Math.round(v)} cm³`, [`${Math.round(Math.PI*r*r*h)} cm³`, `${Math.round(v*2)} cm³`, `${Math.round(Math.PI*r*h)} cm³`], coneSvg(r, h, '—'))); }
    { const side = rnd(4, 12), h = rnd(6, 18), v = side*side*h/3; bank.push(make(`A right square pyramid has base side ${side} m and height ${h} m. Find its volume.`, `${fixed(v)} m³`, [`${fixed(side*side*h)} m³`, `${fixed(side*side*h/2)} m³`, `${fixed(v + side*3)} m³`], solidSvg('Square pyramid', `base ${side} m · height ${h} m`))); }
    // 1.6: sphere surface area and volume.
    { const r = rnd(3, 12), sa = 4*Math.PI*r*r; bank.push(make(`A sphere has radius ${r} cm. Find its surface area to the nearest square centimetre.`, `${Math.round(sa)} cm²`, [`${Math.round(Math.PI*r*r)} cm²`, `${Math.round(4*Math.PI*r*r*r/3)} cm²`, `${Math.round(sa*2)} cm²`], circleSvg(`r = ${r} cm`))); }
    { const r = rnd(3, 10), v = 4*Math.PI*r*r*r/3; bank.push(make(`A sphere has radius ${r} cm. Find its volume to the nearest cubic centimetre.`, `${Math.round(v)} cm³`, [`${Math.round(4*Math.PI*r*r)} cm³`, `${Math.round(Math.PI*r*r*r)} cm³`, `${Math.round(v*1.5)} cm³`], circleSvg(`r = ${r} cm`))); }
    // 1.7: composite objects and exposed surface.
    { const r = rnd(3, 7), h = rnd(8, 17), cube = 2*r, air = cube**3 - 4*Math.PI*r**3/3; bank.push(make(`A sphere of radius ${r} cm fits exactly inside a cube. What is the volume of the air left in the cube, to the nearest cubic centimetre?`, `${Math.round(air)} cm³`, [`${Math.round(cube**3)} cm³`, `${Math.round(4*Math.PI*r*r)} cm³`, `${Math.round(air + 80)} cm³`], solidSvg('Cube and sphere', `cube edge ${cube} cm · sphere r ${r} cm`))); }
    { const r = rnd(3, 6), h = rnd(8, 16), slant = rnd(5, 10), v = Math.PI*r*r*h + Math.PI*r*r*slant/3; bank.push(make(`A rocket is a cylinder with a cone nose. Both have radius ${r} cm; the cylinder is ${h} cm tall and the cone is ${slant} cm tall. Find the total volume, to the nearest cubic centimetre.`, `${Math.round(v)} cm³`, [`${Math.round(Math.PI*r*r*(h+slant))} cm³`, `${Math.round(v/3)} cm³`, `${Math.round(v + 100)} cm³`], solidSvg('Cylinder with cone nose', `radius ${r} cm · cylinder ${h} cm · cone ${slant} cm`))); }
    // 2.1-2.7: right-triangle ratios, angles, lengths and two-triangle applications.
    { const a = rnd(3, 12), o = rnd(3, 15), angle = Math.atan(o/a)*180/Math.PI; bank.push(make(`A line rises ${o} units for every ${a} horizontal units. What is its angle of inclination to the nearest tenth of a degree?`, `${fixed(angle)}°`, [`${fixed(Math.atan(a/o)*180/Math.PI)}°`, `${fixed(angle+8)}°`, `${fixed(90-angle)}°`], rightTriangle('θ', `${a}`, `${o}`))); }
    { const angle = rnd(22, 72), base = rnd(5, 20), height = base*Math.tan(angle*Math.PI/180); bank.push(make(`A ramp makes a ${angle}° angle with the ground. Its horizontal run is ${base} m. How high does it rise, to the nearest tenth of a metre?`, `${fixed(height)} m`, [`${fixed(base/Math.tan(angle*Math.PI/180))} m`, `${fixed(base/Math.sin(angle*Math.PI/180))} m`, `${fixed(height+base)} m`], rightTriangle(`${angle}`, `${base} m`, '?'))); }
    { const angle = rnd(25, 70), hyp = rnd(7, 18), side = hyp*Math.sin(angle*Math.PI/180); bank.push(make(`In a right triangle, the hypotenuse is ${hyp} cm and a side opposite a ${angle}° angle is unknown. Find that side to the nearest tenth.`, `${fixed(side)} cm`, [`${fixed(hyp*Math.cos(angle*Math.PI/180))} cm`, `${fixed(hyp/Math.sin(angle*Math.PI/180))} cm`, `${fixed(side+2.5)} cm`], rightTriangle(`${angle}`, '?', '?', `${hyp} cm`))); }
    { const opposite = rnd(4, 18), hyp = rnd(opposite+3, opposite+15), angle = Math.asin(opposite/hyp)*180/Math.PI; bank.push(make(`A right triangle has opposite side ${opposite} cm and hypotenuse ${hyp} cm. Find the acute angle opposite that side to the nearest tenth.`, `${fixed(angle)}°`, [`${fixed(Math.acos(opposite/hyp)*180/Math.PI)}°`, `${fixed(Math.atan(opposite/hyp)*180/Math.PI)}°`, `${fixed(90-angle)}°`], rightTriangle('θ', '?', `${opposite} cm`, `${hyp} cm`))); }
    { const angle = rnd(25, 60), horizontal = rnd(15, 50), tower = horizontal*Math.tan(angle*Math.PI/180); bank.push(make(`From a point ${horizontal} m from a tower, the angle of elevation to its top is ${angle}°. Find the tower's height to the nearest tenth of a metre.`, `${fixed(tower)} m`, [`${fixed(horizontal/Math.tan(angle*Math.PI/180))} m`, `${fixed(horizontal/Math.sin(angle*Math.PI/180))} m`, `${fixed(tower+1.5)} m`], rightTriangle(`${angle}`, `${horizontal} m`, '?'))); }
    { const x = rnd(6, 15), ang = rnd(25, 55), ang2 = rnd(15, 40), h1=x*Math.tan(ang*Math.PI/180), h2=x*Math.tan(ang2*Math.PI/180), diff=Math.abs(h1-h2); bank.push(make(`Two trees are ${x*2} m apart. From the midpoint, their angles of elevation are ${ang}° and ${ang2}°. How much taller is the taller tree, to the nearest tenth of a metre?`, `${fixed(diff)} m`, [`${fixed(h1+h2)} m`, `${fixed(diff+x)} m`, `${fixed(diff/2)} m`], svg(`<line x1="48" y1="145" x2="292" y2="145" stroke="#303b34" stroke-width="3"/><line x1="82" y1="145" x2="82" y2="42" stroke="#47764f" stroke-width="7"/><line x1="258" y1="145" x2="258" y2="72" stroke="#47764f" stroke-width="7"/><circle cx="170" cy="145" r="5" fill="#9154c5"/><line x1="170" y1="145" x2="82" y2="42" stroke="#303b34" stroke-dasharray="5 4"/><line x1="170" y1="145" x2="258" y2="72" stroke="#303b34" stroke-dasharray="5 4"/><text x="92" y="66" font-size="13">${ang}°</text><text x="224" y="104" font-size="13">${ang2}°</text>`, 'Two trees and sight lines from a midpoint'))); }
    { const angle = rnd(25, 65), leg = rnd(7, 22), hyp=leg/Math.cos(angle*Math.PI/180); bank.push(make(`A ladder ${fixed(hyp)} m long rests against a wall. Its base is ${leg} m from the wall. What angle does it make with the ground, to the nearest tenth?`, `${fixed(angle)}°`, [`${fixed(90-angle)}°`, `${fixed(Math.atan(leg/hyp)*180/Math.PI)}°`, `${fixed(angle+10)}°`], rightTriangle('θ', `${leg} m`, '?', `${fixed(hyp)} m`))); }
    { const side=rnd(125,210), peak=rnd(72,118), height=side*Math.cos(peak*Math.PI/360); bank.push(make(`The front of a tent is an isosceles triangle. Each equal side is ${side} cm and the peak angle is ${peak}°. Find the maximum headroom, to the nearest centimetre.`, `${Math.round(height)} cm`, [`${Math.round(side*Math.sin(peak*Math.PI/360))} cm`, `${side} cm`, `${Math.round(height/2)} cm`], svg(`<path d="M70 145 L170 28 L270 145 Z" fill="none" stroke="#303b34" stroke-width="3"/><line x1="170" y1="28" x2="170" y2="145" stroke="#9154c5" stroke-width="2" stroke-dasharray="5 4"/><path d="M170 133 L182 133 L182 145" fill="none" stroke="#303b34" stroke-width="2"/><text x="115" y="81" font-size="13" fill="#26302b">${side} cm</text><text x="176" y="95" font-size="13" fill="#26302b">height</text><text x="158" y="53" font-size="13" fill="#26302b">${peak}°</text>`, 'Isosceles triangle with its vertical altitude drawn'))); }
    { const cities=[['Calgary',51.1],['Dawson Creek',55.8],['Edmonton',53.6],['Fort Nelson',58.8],['Inuvik',68.3],['Kelowna',49.9],['Prince Rupert',54.3],['Regina',50.5],['Saskatoon',52.1],['Vancouver',49.3],['Victoria',48.4],['Whitehorse',60.7]]; const target=cities[rnd(0,cities.length-1)], angle=target[1]+(rnd(-7,7)/10), run=rnd(3,8), rise=run*Math.tan(angle*Math.PI/180), wrong=shuffle(cities.filter(c=>c!==target)).slice(0,3).map(c=>`${c[0]} (${c[1]}°)`); bank.push(make(`A roof's cross-section rises ${fixed(rise)} m over a horizontal run of ${run} m. Which city has a latitude within 1° of the roof's angle of inclination?`, `${target[0]} (${target[1]}°)`, wrong, rightTriangle('θ', `${run} m`, `${fixed(rise)} m`))); }
    return bank;
  }

  const seenMathPrompts = new Set();
  function nextFreshMathSet() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('studyHubRecentMathPrompts') || '[]'); } catch { /* Storage can be unavailable in private or offline browser modes. */ }
    const used = new Set([...history, ...seenMathPrompts]);
    const fresh = new Map();
    for (let attempt = 0; attempt < 300 && fresh.size < 15; attempt++) {
      for (const question of mathQuestions()) if (!used.has(question.prompt)) fresh.set(question.prompt, question);
    }
    const round = shuffle([...fresh.values()]).slice(0, 15);
    if (round.length < 15) return shuffle(mathQuestions()).slice(0, 15);
    for (const question of round) seenMathPrompts.add(question.prompt);
    try { localStorage.setItem('studyHubRecentMathPrompts', JSON.stringify([...used, ...round.map(q => q.prompt)].slice(-1000))); } catch { /* The in-memory history still prevents repeats in this page. */ }
    return round;
  }

  function selectedQuestions() {
    const selected = inputs.filter((input) => input.checked).map((input) => input.value);
    const names = { acs: 'African Canadian Studies', drama: 'Drama', math: 'Academic Math 10' };
    const result = [];
    for (const id of selected) {
      let pool = (window.STUDY_BANKS[id] || []).map(([prompt, correct, ...wrong]) => ({ subject: id, subjectName: names[id], prompt, correct, options: shuffle([correct, ...wrong]) }));
      if (id === 'acs') {
        pool = shuffle(pool);
        if ($('#acs-length').value !== 'all') pool = pool.slice(0, 20);
      }
      if (id === 'math') pool = nextFreshMathSet();
      result.push(...pool);
    }
    return { selected, questions: shuffle(result) };
  }
  function show(screen) { for (const el of [menu, quiz, mapRoundScreen, results]) el.hidden = el !== screen; window.scrollTo({top:0,behavior:'smooth'}); }
  function begin() {
    const selected = inputs.filter((input) => input.checked);
    if (!selected.length) return;
    const round = selectedQuestions(); questions = round.questions; current = 0; initialQuestionCount = questions.length; score = 0; bySubject = {}; firstAttempts = new WeakMap();
    repeatMissed = $('#repeat-missed').checked;
    includeMapRound = inputs.some(input => input.checked && input.value === 'acs') && $('#include-map-round').checked;
    mapRoundStarted = false; mapResult = null; $('#map-quiz-frame').src = 'about:blank';
    show(quiz); renderQuestion();
  }
  function renderQuestion() {
    locked = false;
    const q = questions[current];
    const isReview = firstAttempts.has(q) && !firstAttempts.get(q);
    $('#quiz-subject-label').textContent = q.subjectName;
    $('#quiz-progress').textContent = isReview ? 'Review question' : `${current+1} / ${questions.length}`;
    $('#quiz-progress').classList.toggle('review', isReview);
    $('#progress-fill').style.width = `${current/questions.length*100}%`;
    $('#question-kicker').textContent = isReview ? `${q.subjectName.toUpperCase()} · REVIEW QUESTION` : `${q.subjectName.toUpperCase()} · QUESTION ${String(current+1).padStart(2,'0')}`;
    $('#question-kicker').classList.toggle('review', isReview);
    $('#question-text').textContent = q.prompt;
    const diagram = $('#question-diagram'); diagram.hidden = !q.diagram; diagram.innerHTML = q.diagram || '';
    const options = $('#answer-options'); options.replaceChildren();
    $('#answer-feedback').textContent = ''; $('#answer-feedback').className = 'answer-feedback'; $('#next-question').hidden = true;
    q.options.forEach((option, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'answer-option'; button.innerHTML = `<span class="option-letter">${String.fromCharCode(65+index)}</span><span></span>`; button.querySelector('span:last-child').textContent = option;
      button.addEventListener('click', () => chooseAnswer(q, option, button)); options.append(button);
    });
  }
  function chooseAnswer(q, option, button) {
    if (locked) return; locked = true;
    const correct = option === q.correct;
    if (!firstAttempts.has(q)) {
      firstAttempts.set(q, correct);
      bySubject[q.subject] ||= { name: q.subjectName, total: 0, correct: 0 };
      bySubject[q.subject].total++;
      if (correct) { score++; bySubject[q.subject].correct++; }
    }
    const willRepeat = !correct && repeatMissed && q.subject !== 'math';
    if (willRepeat) {
      const earliestLaterSlot = current + 2;
      const insertAt = earliestLaterSlot <= questions.length ? rnd(earliestLaterSlot, questions.length) : questions.length;
      questions.splice(insertAt, 0, q);
    }
    for (const answer of [...$('#answer-options').children]) { answer.disabled = true; if (answer.querySelector('span:last-child').textContent === q.correct) answer.classList.add('correct'); }
    if (!correct) button.classList.add('incorrect');
    const feedback = $('#answer-feedback'); feedback.className = `answer-feedback ${correct ? 'good' : 'bad'}`; feedback.textContent = correct ? 'That’s right.' : `Not quite. The answer is: ${q.correct}${willRepeat ? ' This question will come back later.' : ''}`;
    $('#next-question').textContent = current + 1 === questions.length ? 'See results →' : 'Next question →'; $('#next-question').hidden = false;
  }
  function finish() {
    if (includeMapRound && !mapResult) {
      if (!mapRoundStarted) {
        mapRoundStarted = true;
        $('#map-quiz-frame').src = './ACS%2011%20Map%20Study%20Tools/ACS-11-Map-Study-Tools.html?embedded=1';
      }
      show(mapRoundScreen);
      return;
    }
    const totalQuestions = initialQuestionCount + (mapResult?.total || 0);
    const totalScore = score + (mapResult?.correct || 0);
    if (mapResult) bySubject.map = { name: 'Africa map practice', total: mapResult.total, correct: mapResult.correct };
    const percent = Math.round(totalScore/totalQuestions*100);
    $('#results-title').textContent = percent >= 80 ? 'Nice work.' : 'Good practice.';
    $('#results-summary').textContent = `You got ${totalScore} of ${totalQuestions} questions right on the first try.`;
    $('#results-score').textContent = `${totalScore} / ${totalQuestions}`; $('#results-percent').textContent = `${percent}%`;
    const breakdown = $('#results-breakdown'); breakdown.replaceChildren();
    for (const group of Object.values(bySubject)) { const card = document.createElement('article'); card.className = 'breakdown-card'; const heading = document.createElement('h2'); heading.textContent = group.name; const text = document.createElement('p'); text.textContent = `${group.correct} / ${group.total} correct · ${Math.round(group.correct/group.total*100)}%`; card.append(heading,text); breakdown.append(card); }
    show(results);
  }
  function updateSelection() {
    const checked = inputs.filter((input) => input.checked);
    const acsSelected = checked.some((input) => input.value === 'acs');
    const retryableSubjectSelected = checked.some((input) => input.value === 'acs' || input.value === 'drama');
    $('#acs-length-panel').hidden = !acsSelected;
    $('.retry-setting').hidden = !retryableSubjectSelected;
    if (!acsSelected) $('#include-map-round').checked = false;
    inputs.forEach((input) => { input.disabled = checked.length === 1 && input.checked; });
    $('#start-quiz').disabled = !checked.length;
    const total = checked.map((input) => input.value === 'acs' ? ($('#acs-length').value === 'all' ? window.STUDY_BANKS.acs.length : 20) : ({drama:9,math:15}[input.value])).reduce((a,b)=>a+b,0);
    const mapNote = acsSelected && $('#include-map-round').checked ? ' + Africa map round (48 places)' : '';
    const minimumNote = checked.length === 1 ? ' At least one subject must stay selected.' : '';
    $('#selection-note').textContent = checked.length ? `${checked.length === 1 ? 'One subject' : `${checked.length} subjects`} selected · ${total} questions${mapNote}.${minimumNote}` : 'Choose at least one subject to begin.';
  }
  inputs.forEach((input) => input.addEventListener('change', updateSelection));
  $('#acs-length').addEventListener('change', updateSelection);
  $('#include-map-round').addEventListener('change', updateSelection);
  $('#select-all').addEventListener('click', () => { inputs.forEach((input) => { input.checked = true; }); updateSelection(); });
  $('#start-quiz').addEventListener('click', begin); $('#again-button').addEventListener('click', begin);
  $('#next-question').addEventListener('click', () => { if (current + 1 >= questions.length) finish(); else { current++; renderQuestion(); } });
  document.querySelectorAll('[data-action="menu"]').forEach((button) => button.addEventListener('click', () => show(menu)));
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== $('#map-quiz-frame').contentWindow) return;
    if (event.data?.type !== 'study-map-finished' || !Number.isInteger(event.data.correct) || !Number.isInteger(event.data.total)) return;
    mapResult = { correct: event.data.correct, total: event.data.total };
    finish();
  });
  updateSelection();
})();

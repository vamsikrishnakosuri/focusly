/**
 * @fileoverview The launch stage, embedded in the Output panel. A run
 * whose output looks like a rocket countdown is replayed on a
 * mission-control counter, and the rocket does exactly what the code
 * earned: a clean countdown ignites and climbs as the whole launch site
 * scrolls away beneath it into star-field space; a stuck or scrambled
 * count sputters and the rocket tips over and comes apart; a countdown
 * with no launch command hops and settles back.
 *
 * The backdrop is a two-layer "world": the launch site below, space
 * above. If custom art exists at img/rocket/launch-site.png it becomes
 * the site layer automatically; otherwise a built-in vector scene is
 * used. Everything else is inline SVG: no network, offline-build safe.
 */

/** Ticks per counter step, by speed setting. */
const ACB_ROCKET_SPEEDS = {slow: 1300, medium: 750, fast: 320};

/** How the speed setting stretches or squeezes the whole flight. */
const ACB_ROCKET_PACE = {slow: 1.25, medium: 1, fast: 0.55};

/** Altitude readouts shown while climbing. */
const ACB_ROCKET_ALTITUDES = ['1 km', '8 km', '30 km', '80 km', 'SPACE'];

let acbRocketRunId = 0;      // cancels a playing timeline when re-run
let acbRocketArt = null;     // true once img/rocket/launch-site.png loads
let acbRocketBusy = false;   // a timeline is playing right now

// Detect custom art once, up front, so the first stage build knows.
(function rocketDetectArt() {
    const probe = new Image();
    probe.onload = () => { acbRocketArt = true; };
    probe.onerror = () => { acbRocketArt = false; };
    probe.src = 'img/rocket/launch-site.png';
})();

/* ---- Rocket sounds: synthesized with WebAudio, no files and no
   network, so the offline study build carries them for free. Off by
   default; the learner switches them on with the stage's own button. */
let acbRocketAudio = null;

function rocketSoundOn() {
    try { return localStorage.getItem('acb.rocketSound') === 'true'; }
    catch (e) { return false; }
}

function rocketNoiseBuffer(ctx, seconds) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds,
        ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
}

function rocketPlaySound(kind) {
    if (!rocketSoundOn()) return;
    try {
        acbRocketAudio = acbRocketAudio ||
            new (window.AudioContext || window.webkitAudioContext)();
        const ctx = acbRocketAudio;
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;

        const tone = (freq, start, len, vol, type) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(vol, now + start);
            gain.gain.exponentialRampToValueAtTime(0.001,
                now + start + len);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + start);
            osc.stop(now + start + len + 0.05);
        };
        const rumble = (len, from, to, vol) => {
            const src = ctx.createBufferSource();
            src.buffer = rocketNoiseBuffer(ctx, len);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(from, now);
            filter.frequency.linearRampToValueAtTime(to, now + len);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(vol, now);
            gain.gain.linearRampToValueAtTime(0.001, now + len);
            src.connect(filter).connect(gain).connect(ctx.destination);
            src.start(now);
        };

        if (kind === 'tick') tone(760, 0, 0.09, 0.12, 'square');
        else if (kind === 'ignition') rumble(1.6, 260, 90, 0.3);
        else if (kind === 'launch') rumble(3.2, 220, 1500, 0.22);
        else if (kind === 'crash') {
            tone(110, 0, 0.55, 0.3);
            rumble(0.5, 900, 120, 0.25);
        } else if (kind === 'warn') {
            tone(520, 0, 0.16, 0.14);
            tone(392, 0.2, 0.24, 0.14);
        } else if (kind === 'success') {
            tone(523, 0, 0.16, 0.14);
            tone(659, 0.16, 0.16, 0.14);
            tone(784, 0.32, 0.3, 0.16);
        }
    } catch (e) { /* sound is never worth an error */ }
}

/**
 * Mission-control voice via the browser's built-in speech engine:
 * local voices only, so it stays a zero-network feature. Falls back to
 * the tick beep when no speech engine exists.
 * @param {string} text What the controller says.
 */
function rocketSay(text) {
    if (!rocketSoundOn()) return;
    try {
        if (!window.speechSynthesis) {
            rocketPlaySound('tick');
            return;
        }
        // A fast count must not queue up a backlog of numbers.
        window.speechSynthesis.cancel();
        const line = new SpeechSynthesisUtterance(text);
        line.rate = 1.15;
        line.pitch = 0.95;
        line.volume = 0.9;
        window.speechSynthesis.speak(line);
    } catch (e) { /* sound is never worth an error */ }
}

function rocketPaintSoundButton() {
    const button = document.getElementById('rkSound');
    if (!button) return;
    const on = rocketSoundOn();
    button.setAttribute('aria-pressed', String(on));
    button.innerHTML = on ?
        '<i class="fa-solid fa-volume-high" aria-hidden="true"></i>' :
        '<i class="fa-solid fa-volume-xmark" aria-hidden="true"></i>';
}

function rocketSpeed() {
    try {
        const saved = localStorage.getItem('acb.rocketSpeed');
        if (saved && ACB_ROCKET_SPEEDS[saved]) return saved;
    } catch (e) { /* default below */ }
    return 'medium';
}

function rocketSetSpeed(name) {
    try { localStorage.setItem('acb.rocketSpeed', name); } catch (e) { }
    const el = document.getElementById('rocketStage');
    if (!el) return;
    el.querySelectorAll('[data-rocket-speed]').forEach((b) =>
        b.classList.toggle('is-active', b.dataset.rocketSpeed === name));
}

/**
 * Reads a run's output into countdown facts.
 * @param {string} output Raw text of the last run.
 * @returns {{numbers: !Array<number>, message: ?string,
 *     breakAt: number, verdict: string}}
 */
function rocketParse(output) {
    const lines = String(output || '').split('\n')
        .map((l) => l.trim()).filter((l) => l.length);
    const numbers = [];
    let message = null;
    for (const line of lines) {
        if (/^-?\d+$/.test(line) && message === null) {
            numbers.push(parseInt(line, 10));
        } else if (numbers.length) {
            message = line;
            break;
        } else {
            return {numbers: [], message: null, breakAt: -1,
                verdict: 'not-countdown'};
        }
    }
    if (numbers.length < 3) {
        return {numbers, message, breakAt: -1, verdict: 'not-countdown'};
    }
    for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] !== numbers[i - 1] - 1) {
            return {numbers, message, breakAt: i,
                verdict: numbers[i] === numbers[i - 1] ?
                    'stalled' : 'scrambled'};
        }
    }
    if (numbers[numbers.length - 1] > 1) {
        return {numbers, message, breakAt: -1, verdict: 'stopped-early'};
    }
    return {numbers, message, breakAt: -1,
        verdict: message ? 'launch' : 'no-command'};
}

function rocketQuestActive() {
    return typeof acbTaskEngine !== 'undefined' && acbTaskEngine &&
        acbTaskEngine.task && acbTaskEngine.task.id === 'countdown';
}

/** Whether this run's output deserves the launch stage at all. */
function rocketShouldAnimate(parsed) {
    if (rocketQuestActive() && parsed.numbers.length >= 2) return true;
    if (parsed.numbers.length < 3) return false;
    // Non-climbing counts look like countdowns; so does anything that
    // starts from 5 or higher (a countdown attempt going the wrong
    // way), which keeps the times table and Fibonacci out of here.
    return parsed.numbers[1] <= parsed.numbers[0] ||
        parsed.numbers[0] >= 5;
}

function rocketMinimalMotion() {
    try {
        return typeof acbProfile === 'function' &&
            acbProfile().motion === 'minimal';
    } catch (e) { return false; }
}

function rocketClose() {
    acbRocketRunId++;
    try { window.speechSynthesis?.cancel(); } catch (e) { /* fine */ }
    document.getElementById('rocketStage')?.remove();
    const tab = document.getElementById('animTabButton');
    if (tab) {
        tab.hidden = true;
        if (tab.getAttribute('aria-selected') === 'true' &&
            typeof window.acbSelectIoTab === 'function') {
            window.acbSelectIoTab('output');
        }
    }
}

/** The rocket itself: shaded cartoon vector, in four break-apart pieces. */
function rocketShipSvg() {
    return '<svg class="rk-ship" viewBox="0 0 120 240" ' +
        'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<defs>' +
        '<linearGradient id="rkgHull" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#ffffff"/>' +
        '<stop offset="0.45" stop-color="#e9eef7"/>' +
        '<stop offset="0.8" stop-color="#b9c4d6"/>' +
        '<stop offset="1" stop-color="#98a5bb"/></linearGradient>' +
        '<linearGradient id="rkgNose" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#ff8a80"/>' +
        '<stop offset="0.5" stop-color="#e5534b"/>' +
        '<stop offset="1" stop-color="#b23530"/></linearGradient>' +
        '<linearGradient id="rkgFin" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#ef6c62"/>' +
        '<stop offset="1" stop-color="#a92f2a"/></linearGradient>' +
        '<radialGradient id="rkgGlass" cx="0.35" cy="0.3" r="0.9">' +
        '<stop offset="0" stop-color="#e8faff"/>' +
        '<stop offset="0.35" stop-color="#9fd8ff"/>' +
        '<stop offset="1" stop-color="#2f6ea8"/></radialGradient>' +
        '<linearGradient id="rkgFlameO" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#ffb347"/>' +
        '<stop offset="1" stop-color="#ff5722" stop-opacity="0.15"/>' +
        '</linearGradient>' +
        '<linearGradient id="rkgFlameI" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#fff6d8"/>' +
        '<stop offset="1" stop-color="#ffd54f" stop-opacity="0.2"/>' +
        '</linearGradient>' +
        '<filter id="rkfGlow" x="-60%" y="-60%" width="220%" ' +
        'height="220%"><feGaussianBlur stdDeviation="4"/></filter>' +
        '</defs>' +
        '<g id="rkFlame" class="rk-flame" opacity="0">' +
        '<path d="M44 196 Q60 250 76 196 Q60 214 44 196Z" ' +
        'fill="url(#rkgFlameO)" filter="url(#rkfGlow)"/>' +
        '<path d="M50 196 Q60 232 70 196 Q60 206 50 196Z" ' +
        'fill="url(#rkgFlameI)"/></g>' +
        '<g id="rkFinL" class="rk-piece">' +
        '<path d="M40 138 Q18 168 22 196 L40 186 Z" fill="url(#rkgFin)"/>' +
        '</g>' +
        '<g id="rkFinR" class="rk-piece">' +
        '<path d="M80 138 Q102 168 98 196 L80 186 Z" ' +
        'fill="url(#rkgFin)"/></g>' +
        '<g id="rkBody" class="rk-piece">' +
        '<path d="M40 92 Q38 168 46 196 L74 196 Q82 168 80 92 Z" ' +
        'fill="url(#rkgHull)"/>' +
        '<path d="M43 100 Q42 160 48 190 L52 190 Q46 160 47 100 Z" ' +
        'fill="#ffffff" opacity="0.55"/>' +
        '<rect x="40" y="150" width="40" height="9" fill="#1a936f"/>' +
        '<rect x="40" y="150" width="40" height="3" fill="#157a5b"/>' +
        '<rect x="46" y="192" width="28" height="10" rx="3" ' +
        'fill="#5d6b82"/>' +
        '<circle cx="60" cy="120" r="14" fill="#31456e"/>' +
        '<circle cx="60" cy="120" r="10" fill="url(#rkgGlass)"/>' +
        '<circle cx="56" cy="116" r="3" fill="#ffffff" opacity="0.9"/>' +
        '</g>' +
        '<g id="rkNose" class="rk-piece">' +
        '<path d="M40 92 Q47 44 60 30 Q73 44 80 92 Z" ' +
        'fill="url(#rkgNose)"/>' +
        '<path d="M44 88 Q50 50 58 36 L56 36 Q48 52 42 88 Z" ' +
        'fill="#ffd0cb" opacity="0.7"/>' +
        '<rect x="57" y="16" width="6" height="16" rx="3" ' +
        'fill="#98a5bb"/></g>' +
        '</svg>';
}

/** Built-in vector launch site, used until custom art is provided. */
function rocketFallbackSiteSvg() {
    const tree = (x, s) =>
        `<g transform="translate(${x},0) scale(${s})">` +
        '<rect x="-3" y="196" width="6" height="14" rx="2" ' +
        'fill="#7a5a3a"/>' +
        '<circle cx="0" cy="188" r="13" fill="#3f8f66"/>' +
        '<circle cx="-9" cy="194" r="8" fill="#357c57"/>' +
        '<circle cx="9" cy="194" r="8" fill="#357c57"/></g>';
    return '<svg class="rk-site-svg" viewBox="0 0 320 220" ' +
        'preserveAspectRatio="xMidYMax slice" ' +
        'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<rect x="0" y="150" width="320" height="70" fill="#2e6b4f"/>' +
        '<rect x="0" y="150" width="320" height="8" fill="#3a7d5d"/>' +
        '<rect x="216" y="70" width="10" height="96" fill="#5d6b82"/>' +
        '<rect x="212" y="64" width="30" height="6" fill="#5d6b82"/>' +
        '<rect x="222" y="76" width="8" height="4" fill="#46557a"/>' +
        '<rect x="222" y="94" width="8" height="4" fill="#46557a"/>' +
        '<rect x="222" y="112" width="8" height="4" fill="#46557a"/>' +
        '<rect x="60" y="120" width="52" height="34" rx="4" ' +
        'fill="#d7dde8"/>' +
        '<rect x="66" y="128" width="14" height="10" fill="#9fc4e8"/>' +
        '<rect x="88" y="128" width="14" height="10" fill="#9fc4e8"/>' +
        tree(20, 1) + tree(300, 0.85) + tree(130, 0.7) +
        '<rect x="128" y="158" width="64" height="10" rx="3" ' +
        'fill="#46557a"/>' +
        '<rect x="116" y="168" width="88" height="8" rx="3" ' +
        'fill="#38466a"/>' +
        '</svg>';
}

/**
 * Builds (or rebuilds) the stage as the first child of the Output panel.
 * @returns {?Element} The stage, or null if there is no output panel.
 */
function rocketBuildStage() {
    document.getElementById('rocketStage')?.remove();
    const host = document.getElementById('animTabPanel') ||
        document.getElementById('outputPanel');
    if (!host) return null;
    const el = document.createElement('div');
    el.id = 'rocketStage';
    el.className = 'rocket-stage';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Rocket launch');
    if (rocketMinimalMotion()) el.classList.add('rk-minimal');
    if (acbRocketArt) el.classList.add('rk-has-art');
    el.innerHTML =
        '<div class="rocket-stage__toolbar">' +
        '<span class="rocket-stage__speedlabel">Speed</span>' +
        '<button class="coach-chip" data-rocket-speed="slow" ' +
        'type="button">Slow</button>' +
        '<button class="coach-chip" data-rocket-speed="medium" ' +
        'type="button">Medium</button>' +
        '<button class="coach-chip" data-rocket-speed="fast" ' +
        'type="button">Fast</button>' +
        '<span class="rocket-stage__tabnote">Text output is on the ' +
        'Output tab</span>' +
        '</div>' +
        '<div class="rocket-stage__view">' +
        '<div class="rk-world" id="rkWorld">' +
        '<div class="rk-space"></div>' +
        '<div class="rk-site">' +
        (acbRocketArt ?
            '<img src="img/rocket/launch-site.png" alt="" ' +
            'class="rk-site-img">' :
            rocketFallbackSiteSvg()) +
        '</div></div>' +
        '<div class="rk-streaks" id="rkStreaks"></div>' +
        '<div class="rk-smoke" id="rkSmokeBox"></div>' +
        '<div class="rk-glow" id="rkGlow"></div>' +
        '<div class="rk-ship-slot" id="rkShipSlot">' + rocketShipSvg() +
        '</div>' +
        '</div>' +
        '<div class="rocket-stage__counter" id="rocketCounter" ' +
        'aria-live="polite">--</div>' +
        '<p class="rocket-stage__caption" id="rocketCaption"></p>';
    host.insertBefore(el, host.firstChild);

    // Small sound toggle, bottom-right of the stage view.
    const soundButton = document.createElement('button');
    soundButton.id = 'rkSound';
    soundButton.className = 'rk-sound';
    soundButton.type = 'button';
    soundButton.setAttribute('aria-label', 'Rocket sounds');
    el.querySelector('.rocket-stage__view').appendChild(soundButton);
    soundButton.addEventListener('click', () => {
        const next = !rocketSoundOn();
        try { localStorage.setItem('acb.rocketSound', String(next)); }
        catch (e) { /* fine */ }
        rocketPaintSoundButton();
        if (next) rocketPlaySound('tick');
    });
    rocketPaintSoundButton();

    const tab = document.getElementById('animTabButton');
    if (tab) tab.hidden = false;
    el.querySelectorAll('[data-rocket-speed]').forEach((b) =>
        b.addEventListener('click', () =>
            rocketSetSpeed(b.dataset.rocketSpeed)));
    rocketSetSpeed(rocketSpeed());

    // A field editor or dropdown left open floats above everything;
    // close Blockly's chaff so nothing hovers over the sky.
    try { Blockly.hideChaff(); } catch (e) { /* fine */ }
    return el;
}

/**
 * A puff of exhaust smoke at the pad. Ignition smoke rolls outward
 * sideways in both directions, the way real pad exhaust billows.
 * @param {Element} el The stage.
 * @param {boolean} big Ignition-sized.
 * @param {number=} dir -1 rolls left, 1 rolls right, 0 rises in place.
 */
function rocketPuff(el, big, dir = 0) {
    const box = el.querySelector('#rkSmokeBox');
    if (!box) return;
    const p = document.createElement('div');
    p.className = 'rk-puffball' + (big ? ' rk-puffball--big' : '') +
        (dir < 0 ? ' rk-puffball--left' : dir > 0 ?
            ' rk-puffball--right' : '');
    // With art the pad sits at 65.5%, so smoke belongs under the rocket.
    p.style.left = acbRocketArt ?
        (57 + Math.random() * 17) + '%' :
        (44 + Math.random() * 22) + '%';
    p.style.animationDelay = (Math.random() * 0.25) + 's';
    box.appendChild(p);
    setTimeout(() => p.remove(), 2900);
}

/** A thin steam wisp venting from the rocket during the count. */
function rocketSteam(el) {
    const box = el.querySelector('#rkSmokeBox');
    if (!box) return;
    const s = document.createElement('div');
    s.className = 'rk-steam';
    // Right at the nozzle: the slot centers on 65.5% with art, 50%
    // without, so the wisp may only wander a hair to either side.
    s.style.left = acbRocketArt ?
        (64.9 + Math.random() * 1.2) + '%' :
        (49.4 + Math.random() * 1.2) + '%';
    box.appendChild(s);
    setTimeout(() => s.remove(), 2600);
}

/** Sprites that drift past the window during the flight (art mode).
    Only fully-round worlds and the clean yellow satellite: drift-sat2
    (white dish) and drift-planet3 (crescent shadow) both read as
    broken sprites against the black of space, so they are out. */
const ACB_ROCKET_DRIFTERS = ['drift-sat1', 'drift-planet1',
    'drift-planet2', 'drift-planet4', 'drift-planet5', 'drift-planet6'];

let acbRocketLastDrift = -1;   // so two in a row are never the same

/**
 * A distant planet or satellite: it fades in already fully inside the
 * view (never sliced by an edge), drifts down a little, and fades away.
 * Small on purpose - they are far off, which is what sells the scale.
 * @param {Element} el The stage.
 * @param {number} i Sprite rotation index.
 */
function rocketDrifter(el, i) {
    const box = el.querySelector('#rkStreaks');
    if (!box) return;
    const vw = box.clientWidth || 320;
    const vh = box.clientHeight || 300;
    const img = document.createElement('img');
    img.className = 'rk-drifter';
    img.alt = '';
    // Random world each time, never the same one twice running.
    let pick = Math.floor(Math.random() * ACB_ROCKET_DRIFTERS.length);
    if (pick === acbRocketLastDrift) {
        pick = (pick + 1) % ACB_ROCKET_DRIFTERS.length;
    }
    acbRocketLastDrift = pick;
    img.src = 'img/rocket/' + ACB_ROCKET_DRIFTERS[pick] + '.png';
    const w = 20 + Math.random() * 26;
    // Fully inside the panel, clear of the rocket whether it rides at
    // 65.5% (climb) or centered (cruise).
    const leftMax = vw * 0.36 - w;
    const rightMin = vw * 0.82;
    const rightMax = vw - w - 12;
    const x = (rightMax > rightMin && Math.random() < 0.35) ?
        rightMin + Math.random() * (rightMax - rightMin) :
        12 + Math.random() * Math.max(leftMax - 12, 20);
    img.style.left = Math.round(x) + 'px';
    img.style.top = Math.round(vh * (0.06 + Math.random() * 0.2)) + 'px';
    img.style.width = Math.round(w) + 'px';
    // Sinking slowly down the view is what makes the rocket feel like
    // it is still climbing.
    img.style.setProperty('--fall', Math.round(vh * 0.45) + 'px');
    const dur = 10 + Math.random() * 3;
    img.style.animationDuration = dur + 's';
    box.appendChild(img);
    setTimeout(() => img.remove(), dur * 1000 + 300);
}

/** A cloud streak racing down the view while climbing. */
function rocketStreak(el) {
    const box = el.querySelector('#rkStreaks');
    if (!box) return;
    const s = document.createElement('div');
    s.className = 'rk-streak';
    s.style.left = (5 + Math.random() * 90) + '%';
    s.style.animationDuration = (0.7 + Math.random() * 0.6) + 's';
    s.style.opacity = String(0.22 + Math.random() * 0.28);
    box.appendChild(s);
    setTimeout(() => s.remove(), 1400);
}

const rocketWait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Shows the idle pad: rocket parked, no movement.
 * @param {string=} caption Optional message; defaults to "pad ready".
 */
function rocketShowIdle(caption) {
    const el = rocketBuildStage();
    if (!el) return;
    el.querySelector('#rocketCounter').textContent = '--';
    el.querySelector('#rocketCaption').textContent = caption ||
        'Pad ready. Run your countdown when you are set.';
}

/**
 * Why a quest run did not move the rocket, in the learner's terms.
 * @param {{numbers: !Array<number>, message: ?string}} parsed
 * @param {string} output The raw run output.
 * @returns {string}
 */
function rocketIdleReason(parsed, output) {
    if (!String(output || '').trim()) {
        return 'The rocket is waiting. Mission control heard nothing: ' +
            'add print blocks so it can hear your countdown.';
    }
    if (parsed.numbers.length === 0) {
        return 'The rocket is waiting. It heard words but no numbers: ' +
            'a countdown is numbers, 10 down to 1, one per line.';
    }
    return 'The rocket is waiting. It only heard ' +
        parsed.numbers.length + ' number' +
        (parsed.numbers.length === 1 ? '' : 's') +
        ': a full countdown runs from 10 all the way down to 1.';
}

/** Plays one run's countdown on the stage. */
async function rocketPlay(parsed) {
    acbRocketBusy = true;
    try {
        await rocketPlayTimeline(parsed);
    } finally {
        acbRocketBusy = false;
    }
}

async function rocketPlayTimeline(parsed) {
    const runId = ++acbRocketRunId;
    const el = rocketBuildStage();
    if (!el) return;
    const minimal = rocketMinimalMotion();
    const slot = el.querySelector('#rkShipSlot');
    const flame = el.querySelector('#rkFlame');
    const world = el.querySelector('#rkWorld');
    const counter = el.querySelector('#rocketCounter');
    const caption = el.querySelector('#rocketCaption');
    caption.textContent = 'Mission control reading your program...';

    await rocketWait(450);

    for (let i = 0; i < parsed.numbers.length; i++) {
        if (runId !== acbRocketRunId) return;
        counter.textContent = String(parsed.numbers[i]);
        if (typeof playUi === 'function') playUi('tick');
        rocketSay(String(parsed.numbers[i]));
        if (i % 2 === 0) rocketSteam(el);
        if (parsed.breakAt === i) {
            counter.classList.add('is-bad');
            break;
        }
        await rocketWait(ACB_ROCKET_SPEEDS[rocketSpeed()]);
    }
    if (runId !== acbRocketRunId) return;

    // On the quest, mission control is strict: the rocket only answers
    // to "Lift off!". In freeplay, any message launches (and gets
    // proudly quoted) - that stays.
    if (parsed.verdict === 'launch' && rocketQuestActive() &&
        !/lift\s*off/i.test(parsed.message || '')) {
        flame.setAttribute('opacity', '1');
        if (!minimal) slot.classList.add('rk-hopping');
        rocketPlaySound('warn');
        await rocketWait(1400);
        if (runId !== acbRocketRunId) return;
        flame.setAttribute('opacity', '0');
        slot.classList.remove('rk-hopping');
        const unknown = document.createElement('div');
        unknown.className = 'rk-mission rk-mission--warn';
        unknown.textContent = 'UNKNOWN COMMAND';
        el.querySelector('.rocket-stage__view').appendChild(unknown);
        caption.textContent = 'Mission control heard "' + parsed.message +
            '", but this rocket only answers to "Lift off!". ' +
            'What should the last print say?';
        return;
    }

    if (parsed.verdict === 'launch') {
        counter.textContent = 'IGNITION';
        counter.classList.add('is-go');
        rocketSay('Ignition');
        rocketPlaySound('ignition');
        flame.setAttribute('opacity', '1');
        el.querySelector('#rkGlow').classList.add('is-lit');
        if (!minimal) slot.classList.add('rk-shaking');
        for (let p = 0; p < 12; p++) {
            rocketPuff(el, true, p % 2 === 0 ? -1 : 1);
        }
        // With real art, a photographic smoke bank rolls out over the
        // pad. It lives inside the site layer so it stays glued to the
        // ground and scrolls away with the world during the climb.
        if (acbRocketArt && !minimal) {
            const bank = document.createElement('div');
            bank.className = 'rk-smoke-art';
            el.querySelector('.rk-site').appendChild(bank);
            setTimeout(() => bank.remove(), 6000);
        }
        await rocketWait(minimal ? 350 : 950);
        if (runId !== acbRocketRunId) return;

        // Ascent: the world scrolls down into space while the rocket
        // rides the middle of the view, vibrating, clouds streaking by.
        slot.classList.remove('rk-shaking');
        slot.classList.add('rk-riding');
        // Exhaust plume rides with the rocket for the whole climb.
        if (!minimal && !slot.querySelector('.rk-trail')) {
            const trail = document.createElement('div');
            trail.className = 'rk-trail';
            slot.appendChild(trail);
        }
        world.classList.add('rk-launching');
        rocketPlaySound('launch');
        // The pad's floodlit glow belongs to the ground, not to space.
        el.querySelector('#rkGlow').classList.remove('is-lit');
        if (typeof playChime === 'function') playChime('badge');

        // The climb is a journey, not a jump-cut: the ground takes its
        // time falling away while the altitude readout walks upward.
        // The speed setting squeezes or stretches the whole flight.
        const pace = ACB_ROCKET_PACE[rocketSpeed()] || 1;
        el.classList.toggle('rk-fast', rocketSpeed() === 'fast');
        let streakTimer = null;
        if (!minimal) {
            streakTimer = setInterval(() => rocketStreak(el), 420);
        }
        for (let a = 0; a < ACB_ROCKET_ALTITUDES.length; a++) {
            if (runId !== acbRocketRunId) {
                clearInterval(streakTimer);
                return;
            }
            counter.textContent = ACB_ROCKET_ALTITUDES[a];
            // At most one distant world during the whole climb.
            if (!minimal && acbRocketArt && a === 3) rocketDrifter(el, a);
            await rocketWait(minimal ? 300 : Math.round(2300 * pace));
        }
        clearInterval(streakTimer);
        if (runId !== acbRocketRunId) return;

        const finish = () => {
            counter.textContent = 'LIFT OFF';
            caption.textContent = 'A perfect countdown. ' +
                (parsed.message ?
                    'Your program said: "' + parsed.message + '"' :
                    'Beautiful work.');
            const banner = document.createElement('div');
            banner.className = 'rk-mission';
            banner.textContent = 'MISSION SUCCESSFUL';
            el.querySelector('.rocket-stage__view').appendChild(banner);
            rocketSay('Mission successful');
            rocketPlaySound('success');
        };

        if (minimal) {
            slot.classList.add('rk-departing');
            await rocketWait(900);
            if (runId !== acbRocketRunId) return;
            finish();
            return;
        }

        // Cruise: the ship glides to the middle of the window and sails
        // among the stars for a good stretch, one distant world at a
        // time sinking calmly by, before it finally leaves.
        caption.textContent = 'Sailing through space...';
        slot.classList.add('rk-center');
        const cruise = document.createElement('div');
        cruise.className = 'rk-cruise-stars';
        el.querySelector('.rocket-stage__view').appendChild(cruise);
        setTimeout(() => cruise.classList.add('is-on'), 60);
        let driftN = 0;
        const driftTimer = setInterval(() => {
            if (acbRocketArt) rocketDrifter(el, driftN++);
        }, Math.round(6800 * pace));
        for (let c = 0; c < 5; c++) {
            await rocketWait(Math.round(3400 * pace));
            if (runId !== acbRocketRunId) {
                clearInterval(driftTimer);
                return;
            }
        }
        clearInterval(driftTimer);

        // Departure: the ship accelerates clean off the top of the
        // screen, and the mission banner rises out of its exhaust path
        // as it crosses the edge.
        slot.classList.add('rk-departing');
        await rocketWait(1200);
        if (runId !== acbRocketRunId) return;
        finish();
        await rocketWait(5600);
        if (runId !== acbRocketRunId) return;
        cruise.classList.remove('is-on');
        setTimeout(() => cruise.remove(), 1600);
        return;
    }

    if (parsed.verdict === 'no-command') {
        flame.setAttribute('opacity', '1');
        if (!minimal) slot.classList.add('rk-hopping');
        rocketPlaySound('warn');
        await rocketWait(1400);
        if (runId !== acbRocketRunId) return;
        flame.setAttribute('opacity', '0');
        slot.classList.remove('rk-hopping');
        const warn = document.createElement('div');
        warn.className = 'rk-mission rk-mission--warn';
        warn.textContent = 'NO LAUNCH COMMAND';
        el.querySelector('.rocket-stage__view').appendChild(warn);
        caption.textContent = 'The countdown reached 1, but no launch ' +
            'command came after it. What should the program say last?';
        return;
    }

    if (parsed.verdict === 'stopped-early') {
        caption.textContent = 'The countdown stopped at ' +
            parsed.numbers[parsed.numbers.length - 1] +
            ' and never reached 1. How many times should it repeat?';
        return;
    }

    // stalled or scrambled: sputter, tip, come apart.
    await rocketWait(450);
    if (runId !== acbRocketRunId) return;
    for (let p = 0; p < 5; p++) rocketPuff(el, true);
    slot.classList.add('rk-tipping');
    await rocketWait(minimal ? 500 : 1100);
    if (runId !== acbRocketRunId) return;
    if (!minimal) {
        el.querySelector('#rkNose').style.transform =
            'translate(20px, 8px) rotate(34deg)';
        el.querySelector('#rkFinL').style.transform =
            'translate(-14px, 8px) rotate(-22deg)';
        el.querySelector('#rkFinR').style.transform =
            'translate(9px, 9px) rotate(16deg)';
    }
    rocketPlaySound('crash');
    // The crash gets its own bold verdict, mirror of the success banner.
    const failBanner = document.createElement('div');
    failBanner.className = 'rk-mission rk-mission--fail';
    failBanner.textContent = 'MISSION FAILED';
    el.querySelector('.rocket-stage__view').appendChild(failBanner);
    const rising = parsed.verdict === 'scrambled' &&
        parsed.numbers[parsed.breakAt] > parsed.numbers[parsed.breakAt - 1];
    caption.textContent = parsed.verdict === 'stalled' ?
        'The count got stuck at ' + parsed.numbers[parsed.breakAt] +
        '. Something in the loop needs to change the number each time ' +
        'round.' :
        rising ?
        'Your count is going up, but a countdown goes down. What should ' +
        'the change block do each time round?' :
        'The numbers jumped out of order. A countdown drops by exactly ' +
        'one each time.';
}

/** Entry point: called after every finished run. */
function rocketStageOnRun() {
    const output = (typeof acbLastRunOutput === 'string') ?
        acbLastRunOutput : '';
    const failed = (typeof acbLastRunError !== 'undefined') &&
        acbLastRunError;
    if (failed) return;
    const parsed = rocketParse(output);
    if (!rocketShouldAnimate(parsed)) {
        if (rocketQuestActive()) {
            // Quest run that is not a countdown yet: rocket stays
            // parked, and the caption says exactly why.
            rocketShowIdle(rocketIdleReason(parsed, output));
            if (typeof window.acbSelectIoTab === 'function') {
                window.acbSelectIoTab('anim');
            }
        } else {
            rocketClose();
        }
        return;
    }
    rocketPlay(parsed);
    if (typeof window.acbSelectIoTab === 'function') {
        window.acbSelectIoTab('anim');
    }
}

function setupRocketStage() {
    document.addEventListener('acb-run-finished', () => {
        // Give the output pipeline the same tick the quest checker gets.
        setTimeout(rocketStageOnRun, 60);
    });
    // Selecting the Rocket quest stages the pad before the first run.
    document.addEventListener('acb-task', () => {
        setTimeout(() => {
            if (rocketQuestActive() &&
                !document.getElementById('rocketStage')) {
                rocketShowIdle();
                // Picking the quest brings the pad into view right away.
                if (typeof window.acbSelectIoTab === 'function') {
                    window.acbSelectIoTab('anim');
                }
            } else if (!rocketQuestActive() &&
                document.getElementById('rocketStage')) {
                // Close only when the learner moved to a DIFFERENT
                // quest. Finishing the Rocket quest also fires this
                // event with no task, and tearing the stage down then
                // would cut the winning liftoff off mid-flight.
                const other = typeof acbTaskEngine !== 'undefined' &&
                    acbTaskEngine && acbTaskEngine.task;
                if (other && !acbRocketBusy) rocketClose();
            }
        }, 80);
    });
}

setupRocketStage();

/**
 * @fileoverview The frustration detector: sensor-free, local-only, kind.
 * Grounded in two literatures. UX telemetry's classic signals - rage
 * clicks (rapid clicks in one spot) and the thrashed cursor (fast erratic
 * direction reversals) - and the educational-programming findings that
 * REPEATED FAILING RUNS are the core frustration metric for novices, with
 * deletion bursts and undo storms as supporting evidence.
 *
 * Every signal feeds a decaying score (half-life ~45s), so isolated
 * events fade and only clusters cross the threshold. When one does, Blox
 * checks in ONCE - naming the struggle kindly, offering a hint, a
 * breather, or "I'm fine" - then stays quiet for 8 minutes minimum.
 * Nothing is recorded, stored, or sent anywhere; the score lives and dies
 * in this tab. Off-switch in the sensory profile.
 */

const ACB_FRUSTRATION = {
    score: 0,
    lastDecay: 0,
    lastCheckIn: 0,
    clicks: [],          // recent {t, x, y}
    moves: [],           // recent {t, x, vx}
    undoTimes: [],
    deleteTimes: [],
    failStreak: 0,
    lastErrorText: '',
};

const ACB_FRUSTRATION_THRESHOLD = 70;
const ACB_FRUSTRATION_COOLDOWN_MS = 8 * 60 * 1000;

function frustrationCareOn() {
    return (typeof acbProfile !== 'function') ||
        acbProfile().care !== 'off';
}

function frustrationAdd(points) {
    const now = performance.now();
    // Exponential decay with ~45s half-life since the last update.
    const dt = now - (ACB_FRUSTRATION.lastDecay || now);
    ACB_FRUSTRATION.score *= Math.pow(0.5, dt / 45000);
    ACB_FRUSTRATION.lastDecay = now;
    ACB_FRUSTRATION.score += points;
    if (ACB_FRUSTRATION.score >= ACB_FRUSTRATION_THRESHOLD) {
        frustrationCheckIn();
    }
}

/* ------------------------------ signals -------------------------------- */

function frustrationOnPointerDown(event) {
    const now = performance.now();
    const clicks = ACB_FRUSTRATION.clicks;
    clicks.push({t: now, x: event.clientX, y: event.clientY});
    while (clicks.length && now - clicks[0].t > 1400) clicks.shift();
    // Rage click: 4+ clicks within 1.4s, all inside a 44px circle.
    if (clicks.length >= 4) {
        const cx = clicks.reduce((a, c) => a + c.x, 0) / clicks.length;
        const cy = clicks.reduce((a, c) => a + c.y, 0) / clicks.length;
        const tight = clicks.every((c) =>
            Math.hypot(c.x - cx, c.y - cy) < 44);
        if (tight) {
            clicks.length = 0;
            frustrationAdd(30);
        }
    }
}

const ACB_THRASH = {lastX: null, dir: 0, swing: 0, turns: []};

/**
 * Thrashed cursor, done right: adjacent samples are slow exactly at the
 * turnaround, so velocity products never fire on real hardware. Instead we
 * watch TURNING POINTS - each time the horizontal direction flips after a
 * swing of at least 40px. Five wide flips within 1.5 seconds is shaking.
 */
function frustrationOnPointerMove(event) {
    const now = performance.now();
    const state = ACB_THRASH;
    if (state.lastX === null) { state.lastX = event.clientX; return; }
    const dx = event.clientX - state.lastX;
    state.lastX = event.clientX;
    if (Math.abs(dx) < 2) return;             // micro-jitter is not motion
    const dir = Math.sign(dx);
    if (state.dir !== 0 && dir !== state.dir) {
        // A turning point: count it only if the swing was a real sweep.
        if (state.swing >= 40) {
            state.turns.push(now);
            while (state.turns.length && now - state.turns[0] > 1500) {
                state.turns.shift();
            }
            if (state.turns.length >= 5) {
                state.turns.length = 0;
                frustrationAdd(25);
            }
        }
        state.swing = 0;
    }
    state.dir = dir;
    state.swing += Math.abs(dx);
}

function frustrationOnRun() {
    setTimeout(() => {
        const errorText = (typeof acbLastRunError !== 'undefined') ?
            acbLastRunError : '';
        if (errorText) {
            ACB_FRUSTRATION.failStreak += 1;
            const sameError = errorText === ACB_FRUSTRATION.lastErrorText;
            ACB_FRUSTRATION.lastErrorText = errorText;
            // The literature's strongest signal: errors that persist across
            // quick retries. Second fail +25, same error again +35.
            if (ACB_FRUSTRATION.failStreak >= 2) {
                frustrationAdd(sameError ? 35 : 25);
            }
        } else {
            ACB_FRUSTRATION.failStreak = 0;
            ACB_FRUSTRATION.lastErrorText = '';
        }
    }, 700);
}

function frustrationOnWorkspaceEvent(event) {
    if (!event) return;
    const now = performance.now();
    if (event.type === 'delete') {
        const times = ACB_FRUSTRATION.deleteTimes;
        times.push(now);
        while (times.length && now - times[0] > 6000) times.shift();
        if (times.length >= 3) {           // deletion burst
            times.length = 0;
            frustrationAdd(25);
        }
    }
}

function frustrationOnKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) &&
        String(event.key).toLowerCase() === 'z') {
        const now = performance.now();
        const times = ACB_FRUSTRATION.undoTimes;
        times.push(now);
        while (times.length && now - times[0] > 5000) times.shift();
        if (times.length >= 4) {           // undo storm
            times.length = 0;
            frustrationAdd(20);
        }
    }
}

/* ----------------------------- the check-in ---------------------------- */

function frustrationCheckIn() {
    const now = Date.now();
    if (!frustrationCareOn()) { ACB_FRUSTRATION.score = 0; return; }
    if (now - ACB_FRUSTRATION.lastCheckIn <
        ACB_FRUSTRATION_COOLDOWN_MS) return;
    if (document.body.classList.contains('acb-break-open')) return;
    ACB_FRUSTRATION.lastCheckIn = now;
    ACB_FRUSTRATION.score = 0;

    coachSay('This bit seems to be fighting back - that is the puzzle ' +
        'being a puzzle, not you failing. What sounds good?');
    if (typeof bloxMood === 'function') bloxMood('oops');
    let row = document.getElementById('careChips');
    if (!row) {
        row = document.createElement('div');
        row.id = 'careChips';
        row.className = 'coach-card__actions';
        const message = document.getElementById('coachMessage');
        message?.parentNode?.insertBefore(row, message.nextSibling);
    }
    row.hidden = false;
    row.innerHTML =
        '<button id="careHint" class="coach-chip" type="button">' +
            '💡 A hint</button>' +
        '<button id="careBreak" class="coach-chip" type="button">' +
            '🌿 Short breather</button>' +
        '<button id="careFine" class="coach-chip" type="button">' +
            'I\'m fine, thanks</button>';
    const dismiss = () => { row.innerHTML = ''; row.hidden = true; };
    document.getElementById('careHint').addEventListener('click', () => {
        dismiss();
        document.getElementById('nowCardStuck')?.click() ||
            coachSay('Pick a quest and the hint button lives on the step ' +
                'card. For free building: try the smallest version first.');
    });
    document.getElementById('careBreak').addEventListener('click', () => {
        dismiss();
        const timer = (typeof getBreakTimer === 'function') &&
            getBreakTimer();
        if (timer && timer.isEnabled()) {
            timer.core.state = 'nudging';
            timer.core.takeBreak();
            document.dispatchEvent(new CustomEvent('acb-break-timer',
                {detail: {action: 'break-started'}}));
        } else {
            coachSay('Stand up, roll your shoulders, look far away for a ' +
                'minute. The blocks will wait for you.');
        }
    });
    document.getElementById('careFine').addEventListener('click', () => {
        dismiss();
        coachSay('Good. You know your own head best - I am here if that ' +
            'changes.');
    });
}

/* -------------------------------- setup -------------------------------- */

function setupFrustration(workspace) {
    document.addEventListener('pointerdown', frustrationOnPointerDown, true);
    document.addEventListener('pointermove', frustrationOnPointerMove,
        {capture: true, passive: true});
    document.addEventListener('keydown', frustrationOnKeyDown, true);
    document.getElementById('runButton')?.addEventListener('click',
        frustrationOnRun);
    workspace.addChangeListener(frustrationOnWorkspaceEvent);
}

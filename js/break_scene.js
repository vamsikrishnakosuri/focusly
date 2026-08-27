/**
 * @fileoverview The break scene: when a break starts, the whole app softens
 * behind a blur and one calm card takes the middle - a big countdown, a slow
 * breathing circle, and optional break sounds (rain, ocean, brown noise,
 * campfire - the synthesized ambient engine, at no download cost). The
 * learner either enjoys the pause or ends it with one tap; Esc works too.
 * Nothing is ever locked: "I'm back" is always one click away, and the
 * workspace underneath is untouched.
 *
 * Driven by the plugin's 'acb-break-timer' events; the plugin's own small
 * corner card stays hidden while the scene is up.
 */

let acbBreakScene = null;   // {el, tick}

function breakSoundPref() {
    try {
        const stored = localStorage.getItem('acb.breakSound') || 'off';
        return stored === 'mix' ? 'forest' : stored;
    } catch (e) { return 'off'; }
}

function setBreakSound(kind) {
    try { localStorage.setItem('acb.breakSound', kind); }
    catch (e) { /* fine */ }
    if (!acbBreakScene) return;
    acbBreakScene.el.querySelectorAll('[data-break-sound]').forEach((b) =>
        b.classList.toggle('is-picked', b.dataset.breakSound === kind));
    breakOnlineStop();   // a preset chip takes over from any online sound
    const vol = (typeof acbProfile === 'function') ?
        acbProfile().ambientVol : 0.25;
    if (typeof acbAmbient !== 'undefined') {
        acbAmbient.apply({ambient: kind, ambientVol: vol});
    }
}

/** A break the learner started by hand (no timer involved):
 *  {startedAt, endsAt: number|null, pausedTimer: boolean}. */
let acbManualBreak = null;

function breakSceneClose(endBreakToo) {
    if (!acbBreakScene) return;
    clearInterval(acbBreakScene.tick);
    acbBreakScene.el.remove();
    acbBreakScene = null;
    document.body.classList.remove('acb-break-open');
    document.removeEventListener('keydown', breakSceneEsc, true);
    breakOnlineStop();
    // Break sound off; the learner's everyday ambience comes back.
    if (typeof acbAmbient !== 'undefined' && typeof acbProfile === 'function') {
        acbAmbient.apply(acbProfile());
    }
    if (acbManualBreak) {
        if (acbManualBreak.pausedTimer &&
            typeof getBreakTimer === 'function') {
            const timer = getBreakTimer();
            if (timer && typeof timer.resumeTimer === 'function') {
                timer.resumeTimer();
            }
        }
        acbManualBreak = null;
        return;  // no timer bookkeeping: the timer never entered break
    }
    if (endBreakToo) {
        // The plugin's own button does the bookkeeping when present.
        const pluginButton = document.querySelector('.acb-break-nudge button');
        if (pluginButton) pluginButton.click();
        else if (typeof getBreakTimer === 'function') {
            getBreakTimer()?.core?.endBreak();
        }
    }
}

function breakSceneEsc(event) {
    if (event.key === 'Escape') breakSceneClose(true);
}

function breakSceneShow() {
    if (acbBreakScene) return;
    const el = document.createElement('div');
    el.id = 'breakOverlay';
    el.className = 'break-scene';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'On a break');
    el.innerHTML =
        '<div class="break-scene__card">' +
            '<div class="break-scene__breath" aria-hidden="true"></div>' +
            '<h2 class="break-scene__title">Break time 🌿</h2>' +
            '<p class="break-scene__count" id="breakSceneCount">–:––</p>' +
            '<p class="break-scene__line">Step away, stretch, look far ' +
                'away. Your blocks are exactly as you left them.</p>' +
            '<div class="break-scene__sounds" role="group" ' +
                'aria-label="Break sounds">' +
                '<button class="coach-chip" data-break-sound="off" ' +
                    'type="button">🔇 Quiet</button>' +
                '<button class="coach-chip" data-break-sound="rain" ' +
                    'type="button">🌧 Rain</button>' +
                '<button class="coach-chip" data-break-sound="ocean" ' +
                    'type="button">🌊 Ocean</button>' +
                '<button class="coach-chip" data-break-sound="brown" ' +
                    'type="button">🟤 Deep noise</button>' +
                '<button class="coach-chip" data-break-sound="fire" ' +
                    'type="button">🔥 Campfire</button>' +
                '<button class="coach-chip" data-break-sound="forest" ' +
                    'type="button">🌲 Forest</button>' +
                '<button class="coach-chip" id="breakMoreSounds" ' +
                    'type="button" title="Blox searches free CC0 sounds ' +
                    'online">✨ More sounds</button>' +
            '</div>' +
            '<div class="break-scene__lengths" id="breakLengths" hidden ' +
                'role="group" aria-label="Break length">' +
                '<button class="coach-chip" data-break-len="0" ' +
                    'type="button">Just a pause</button>' +
                '<button class="coach-chip" data-break-len="3" ' +
                    'type="button">3 min</button>' +
                '<button class="coach-chip" data-break-len="5" ' +
                    'type="button">5 min</button>' +
                '<button class="coach-chip" data-break-len="10" ' +
                    'type="button">10 min</button>' +
            '</div>' +
            '<div class="break-scene__online" id="breakOnline" hidden>' +
                '<input id="breakSoundQuery" type="text" maxlength="40" ' +
                    'placeholder="thunderstorm, stream, night birds…" ' +
                    'aria-label="Describe a sound to find">' +
                '<div id="breakSoundResults" ' +
                    'class="break-scene__results"></div>' +
            '</div>' +
            '<button class="break-scene__back" id="breakSceneBack" ' +
                'type="button">I\'m back - end break</button>' +
            '<p class="break-scene__hint">Esc also brings you back.</p>' +
        '</div>';
    document.body.appendChild(el);
    document.body.classList.add('acb-break-open');

    el.querySelector('#breakSceneBack').addEventListener('click',
        () => breakSceneClose(true));
    el.querySelectorAll('[data-break-sound]').forEach((button) => {
        button.addEventListener('click',
            () => setBreakSound(button.dataset.breakSound));
    });
    el.querySelectorAll('[data-break-len]').forEach((button) => {
        button.addEventListener('click', () => {
            if (!acbManualBreak) return;
            const minutes = Number(button.dataset.breakLen) || 0;
            acbManualBreak.endsAt = minutes ?
                Date.now() + minutes * 60000 : null;
            el.querySelectorAll('[data-break-len]').forEach((b) =>
                b.classList.toggle('is-active', b === button));
        });
    });
    breakOnlineSetup(el);
    document.addEventListener('keydown', breakSceneEsc, true);

    const count = el.querySelector('#breakSceneCount');
    const update = () => {
        if (acbBreakScene && acbBreakScene.extending) return;
        const timer = (typeof getBreakTimer === 'function') &&
            getBreakTimer();
        const timerOnBreak = timer && timer.getStateName() === 'break';
        if (!timerOnBreak && !acbManualBreak) {
            breakSceneClose(false);
            return;
        }
        let ms;
        if (timerOnBreak) {
            ms = Math.max(0, timer.remainingMs());
        } else if (acbManualBreak.endsAt) {
            ms = acbManualBreak.endsAt - Date.now();
            if (ms <= 0) {
                breakSceneClose(false);
                return;
            }
        } else {
            // Open-ended pause: count up, so time stays visible without
            // the pressure of a deadline.
            ms = Date.now() - acbManualBreak.startedAt;
        }
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        count.textContent = h > 0 ?
            `${h}h ${String(m).padStart(2, '0')}m ` +
                `${String(s).padStart(2, '0')}s` :
            `${m}m ${String(s).padStart(2, '0')}s`;
    };
    acbBreakScene = {el, tick: setInterval(update, 500)};
    update();

    // Remembered break sound starts on its own; picking is one tap.
    const pref = breakSoundPref();
    setBreakSound(pref);
}

/* ---- Online sounds: CC0 recordings found live through the server ------ */

let acbBreakOnlineAudio = null;

function breakOnlineStop() {
    try { acbBreakOnlineAudio?.pause(); } catch (e) { /* fine */ }
    acbBreakOnlineAudio = null;
}

function breakOnlinePlay(url) {
    breakOnlineStop();
    if (typeof acbAmbient !== 'undefined') {
        acbAmbient.apply({ambient: 'off'});
    }
    const vol = (typeof acbProfile === 'function') ?
        acbProfile().ambientVol : 0.25;
    acbBreakOnlineAudio = new Audio(url);
    acbBreakOnlineAudio.loop = true;
    acbBreakOnlineAudio.volume = Math.min(1, vol * 2.2);
    acbBreakOnlineAudio.play().catch(() => { /* needs a gesture; had one */ });
}

function breakOnlineSetup(el) {
    const button = el.querySelector('#breakMoreSounds');
    const panel = el.querySelector('#breakOnline');
    const input = el.querySelector('#breakSoundQuery');
    const results = el.querySelector('#breakSoundResults');
    if (!button || !panel) return;
    button.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) input.focus();
    });
    const search = async () => {
        const query = input.value.trim();
        if (!query) return;
        results.textContent = 'Blox is listening around…';
        try {
            const server = (typeof ACB_COACH_SERVER !== 'undefined') ?
                ACB_COACH_SERVER : window.FOCUSLY_COACH_URL;
            const response = await fetch(
                `${server}/sounds?query=${encodeURIComponent(query)}`);
            if (response.status === 501) {
                results.textContent = 'Online sounds are not switched on ' +
                    'for this server yet. The built-in scenes still work.';
                return;
            }
            if (!response.ok) throw new Error(String(response.status));
            const {sounds} = await response.json();
            results.innerHTML = '';
            if (!sounds.length) {
                results.textContent = 'Nothing calm came back for that - ' +
                    'try different words, like "soft rain window".';
                return;
            }
            for (const sound of sounds.slice(0, 4)) {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'coach-chip';
                chip.textContent = `▷ ${sound.name} · ${sound.seconds}s`;
                chip.title = `CC0, by ${sound.by} on Freesound`;
                chip.addEventListener('click', () => {
                    results.querySelectorAll('.coach-chip').forEach((c) =>
                        c.classList.remove('is-picked'));
                    chip.classList.add('is-picked');
                    el.querySelectorAll('[data-break-sound]').forEach((c) =>
                        c.classList.remove('is-picked'));
                    breakOnlinePlay(sound.url);
                });
                results.appendChild(chip);
            }
        } catch (e) {
            results.textContent = 'Could not reach the sound library just ' +
                'now. The built-in scenes still work.';
        }
    };
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); search(); }
        event.stopPropagation();   // Esc in the field must not end the break
    });
}

/**
 * The break ran out: instead of snapping back to work, the scene offers
 * a gentle choice - back to it, or a little longer. Extending re-enters
 * the plugin's own break state, so every display stays truthful.
 */
function breakExtendOffer() {
    if (!acbBreakScene) return;
    acbBreakScene.extending = true;
    const count = document.getElementById('breakSceneCount');
    const line = document.querySelector('.break-scene__line');
    if (count) count.textContent = 'Break finished';
    if (line) {
        line.innerHTML = '';
        const wrap = document.createElement('span');
        wrap.className = 'break-scene__extend';
        for (const minutes of [2, 5]) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'coach-chip';
            chip.textContent = `+${minutes} more minutes`;
            chip.addEventListener('click', () => {
                const timer = getBreakTimer();
                timer.core.state = 'break';
                timer.core.breakEndsAt =
                    timer.core.now() + minutes * 60000;
                acbBreakScene.extending = false;
                line.textContent = 'Step away, stretch, look far away. ' +
                    'Your blocks are exactly as you left them.';
            });
            wrap.appendChild(chip);
        }
        line.appendChild(wrap);
    }
    // No pressure either way: after 25 quiet seconds, back to work.
    setTimeout(() => {
        if (acbBreakScene && acbBreakScene.extending) {
            breakSceneClose(false);
        }
    }, 25000);
}

function breakSceneManualStart() {
    if (acbBreakScene) return;
    const timer = (typeof getBreakTimer === 'function') && getBreakTimer();
    acbManualBreak = {startedAt: Date.now(), endsAt: null,
        pausedTimer: false};
    if (timer && timer.getStateName() === 'working' &&
        typeof timer.pauseTimer === 'function' &&
        !(typeof timer.isPaused === 'function' && timer.isPaused())) {
        timer.pauseTimer();
        acbManualBreak.pausedTimer = true;
    }
    breakSceneShow();
    const lengths = document.getElementById('breakLengths');
    if (lengths) lengths.hidden = false;
}

function setupBreakScene() {
    document.getElementById('breakNowButton')?.addEventListener(
        'click', breakSceneManualStart);
    document.addEventListener('acb-break-timer', (event) => {
        const action = event.detail && event.detail.action;
        if (action === 'break-started') breakSceneShow();
        else if (action === 'break-over') breakExtendOffer();
        else if (action === 'break-ended' || action === 'disabled') {
            breakSceneClose(false);
        }
    });
}

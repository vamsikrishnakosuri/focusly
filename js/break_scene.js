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
    try { return localStorage.getItem('acb.breakSound') || 'off'; }
    catch (e) { return 'off'; }
}

function setBreakSound(kind) {
    try { localStorage.setItem('acb.breakSound', kind); }
    catch (e) { /* fine */ }
    if (!acbBreakScene) return;
    acbBreakScene.el.querySelectorAll('[data-break-sound]').forEach((b) =>
        b.classList.toggle('is-picked', b.dataset.breakSound === kind));
    const vol = (typeof acbProfile === 'function') ?
        acbProfile().ambientVol : 0.25;
    if (kind === 'mix') {
        if (typeof acbAmbient !== 'undefined') {
            acbAmbient.apply({ambient: 'off'});
        }
        breakMixerStart(vol);
    } else {
        breakMixerStop();
        if (typeof acbAmbient !== 'undefined') {
            acbAmbient.apply({ambient: kind, ambientVol: vol});
        }
    }
}

/* --------------- the mixer: blend your own break sound ----------------- */

const ACB_MIX_PARTS = ['rain', 'ocean', 'wind', 'fire'];
const ACB_MIX_LABELS = {rain: '🌧 Rain', ocean: '🌊 Waves',
    wind: '🍃 Wind', fire: '🔥 Crackle'};
let acbBreakMixer = null;   // {ctx, parts: {kind: gainNode}}

function breakMixLevels() {
    try {
        return {rain: 0.6, ocean: 0, wind: 0.25, fire: 0.2,
            ...JSON.parse(localStorage.getItem('acb.breakMix') || '{}')};
    } catch (e) {
        return {rain: 0.6, ocean: 0, wind: 0.25, fire: 0.2};
    }
}

function breakMixerStart(masterVol) {
    breakMixerStop();
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const levels = breakMixLevels();
        const parts = {};
        for (const kind of ACB_MIX_PARTS) {
            const source = ctx.createBufferSource();
            source.buffer = acbAmbient.buffer(kind, ctx);
            source.loop = true;
            const gain = ctx.createGain();
            gain.gain.value = (levels[kind] || 0) * masterVol * 2;
            source.connect(gain).connect(ctx.destination);
            source.start();
            parts[kind] = gain;
        }
        acbBreakMixer = {ctx, parts, masterVol};
    } catch (e) { /* comfort only */ }
}

function breakMixerStop() {
    try { acbBreakMixer?.ctx.close(); } catch (e) { /* fine */ }
    acbBreakMixer = null;
}

function breakMixerSet(kind, level) {
    const levels = breakMixLevels();
    levels[kind] = level;
    try { localStorage.setItem('acb.breakMix', JSON.stringify(levels)); }
    catch (e) { /* fine */ }
    if (acbBreakMixer?.parts[kind]) {
        acbBreakMixer.parts[kind].gain.value =
            level * acbBreakMixer.masterVol * 2;
    }
}

function breakSceneClose(endBreakToo) {
    if (!acbBreakScene) return;
    clearInterval(acbBreakScene.tick);
    acbBreakScene.el.remove();
    acbBreakScene = null;
    breakMixerStop();
    document.body.classList.remove('acb-break-open');
    document.removeEventListener('keydown', breakSceneEsc, true);
    // Break sound off; the learner's everyday ambience comes back.
    if (typeof acbAmbient !== 'undefined' && typeof acbProfile === 'function') {
        acbAmbient.apply(acbProfile());
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
                '<button class="coach-chip" data-break-sound="mix" ' +
                    'type="button">🎛 My mix</button>' +
            '</div>' +
            '<div class="break-scene__mixer" id="breakMixer" hidden>' +
                ACB_MIX_PARTS.map((kind) =>
                    `<label class="break-scene__mix-row">` +
                    `<span>${ACB_MIX_LABELS[kind]}</span>` +
                    `<input type="range" min="0" max="100" ` +
                    `data-mix="${kind}" ` +
                    `aria-label="${ACB_MIX_LABELS[kind]} amount"></label>`
                ).join('') +
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
        button.addEventListener('click', () => {
            setBreakSound(button.dataset.breakSound);
            const mixer = el.querySelector('#breakMixer');
            if (mixer) mixer.hidden = button.dataset.breakSound !== 'mix';
        });
    });
    const startLevels = breakMixLevels();
    el.querySelectorAll('[data-mix]').forEach((slider) => {
        slider.value = String(Math.round(
            (startLevels[slider.dataset.mix] || 0) * 100));
        slider.addEventListener('input', () =>
            breakMixerSet(slider.dataset.mix, Number(slider.value) / 100));
    });
    document.addEventListener('keydown', breakSceneEsc, true);

    const count = el.querySelector('#breakSceneCount');
    const update = () => {
        const timer = (typeof getBreakTimer === 'function') &&
            getBreakTimer();
        if (!timer || timer.getStateName() !== 'break') {
            breakSceneClose(false);
            return;
        }
        const ms = Math.max(0, timer.remainingMs());
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

function setupBreakScene() {
    document.addEventListener('acb-break-timer', (event) => {
        const action = event.detail && event.detail.action;
        if (action === 'break-started') breakSceneShow();
        else if (action === 'break-ended' || action === 'break-over' ||
                 action === 'disabled') {
            breakSceneClose(false);
        }
    });
}

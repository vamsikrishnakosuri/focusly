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
    if (typeof acbAmbient !== 'undefined') {
        const vol = (typeof acbProfile === 'function') ?
            acbProfile().ambientVol : 0.25;
        acbAmbient.apply({ambient: kind, ambientVol: vol});
    }
}

function breakSceneClose(endBreakToo) {
    if (!acbBreakScene) return;
    clearInterval(acbBreakScene.tick);
    acbBreakScene.el.remove();
    acbBreakScene = null;
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
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        count.textContent = `${m}:${String(s).padStart(2, '0')}`;
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

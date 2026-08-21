/**
 * @fileoverview The sensory profile: Focusly's customization flagship.
 * One friendly wizard (first visit) + a gear entry to revisit; a handful of
 * high-impact accommodations rather than an endless settings page:
 *
 *   - Reading style: font (Nunito / Lexend / OpenDyslexic), letter spacing,
 *     text size. Spacing matters more than letterforms per the dyslexia
 *     research; both are offered as preferences, never as treatments.
 *   - Motion: full or minimal (gliding hand, spins, confetti all respect it,
 *     alongside the OS-level prefers-reduced-motion).
 *   - Sound: celebration chimes on/off plus an ambient focus mixer
 *     (white / pink / brown noise, synthesized - no downloads). Evidence:
 *     small but significant attention gains for ADHD youth in a 2024
 *     meta-analysis; about a third do worse, hence strictly opt-in.
 *   - Coach tone: warm or extra-brief, carried to the AI server.
 */

/* ------------------------------------------------------------------------ */
/* Profile state                                                             */
/* ------------------------------------------------------------------------ */

const ACB_PROFILE_DEFAULTS = {
    font: 'nunito',        // nunito | lexend | dyslexic
    spacing: 'normal',     // normal | roomy
    textSize: 'normal',    // normal | large
    motion: 'full',        // full | minimal
    tone: 'warm',          // warm | brief
    ambient: 'off',        // off | white | pink | brown
    readAloud: 'off',      // off | on   (coach messages + step reader)
    cheer: 'on',           // on | off   (motivation messenger)
    care: 'on',            // on | off   (frustration check-ins)
    companion: 'off',      // off | on   (body-double presence)
    ambientVol: 0.25,
};

function acbProfile() {
    return {...ACB_PROFILE_DEFAULTS, ...acbReadJson('acb.profile', {})};
}

function saveProfile(patch) {
    const next = {...acbProfile(), ...patch};
    acbWriteJson('acb.profile', next);
    applyProfile(next);
    return next;
}

/* ------------------------------------------------------------------------ */
/* Applying the profile                                                      */
/* ------------------------------------------------------------------------ */

const ACB_FONT_LINKS = {
    lexend: 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;700;800&display=swap',
    dyslexic: 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.css',
};

function ensureFontLoaded(font) {
    const href = ACB_FONT_LINKS[font];
    if (!href || document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

function applyProfile(profile) {
    const p = profile || acbProfile();
    ensureFontLoaded(p.font);
    const family = p.font === 'lexend' ?
        "'Lexend', 'Nunito', system-ui, sans-serif" :
        p.font === 'dyslexic' ?
        "'open-dyslexic', 'Nunito', system-ui, sans-serif" :
        "'Nunito', 'Segoe UI', system-ui, sans-serif";
    document.documentElement.style.setProperty('--acb-font', family);
    document.documentElement.style.setProperty('--acb-letter-spacing',
        p.spacing === 'roomy' ? '0.045em' : 'normal');
    document.documentElement.style.setProperty('--acb-text-scale',
        p.textSize === 'large' ? '1.12' : '1');
    document.body.classList.toggle('acb-no-motion', p.motion === 'minimal');
    if (typeof applyCompanion === 'function') applyCompanion(p);
    // Ambient + tone are read live by their consumers.
    acbAmbient.apply(p);
}

/* ------------------------------------------------------------------------ */
/* Ambient sound engine: looped generated-noise buffers, no assets.          */
/* ------------------------------------------------------------------------ */

const acbAmbient = {
    ctx: null,
    source: null,
    gain: null,

    buffer(kind, ctx) {
        // Longer loops for the scenes so the repetition is not noticeable.
        const seconds = {ocean: 16, rain: 8, wind: 12, fire: 10, forest: 14}[kind] || 4;
        const rate = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, rate * seconds, rate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, last = 0, lp = 0;
        for (let i = 0; i < data.length; i++) {
            const white = Math.random() * 2 - 1;
            const t = i / rate;
            if (kind === 'white') {
                data[i] = white * 0.28;
            } else if (kind === 'pink') {
                // Paul Kellet's economy pink noise approximation.
                b0 = 0.99765 * b0 + white * 0.0990460;
                b1 = 0.96300 * b1 + white * 0.2965164;
                b2 = 0.57000 * b2 + white * 1.0526913;
                data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
            } else if (kind === 'brown') {
                last = (last + 0.02 * white) / 1.02;
                data[i] = last * 3.2;
            } else if (kind === 'rain') {
                // Steady hiss (softened white) - droplets are added below.
                lp += 0.18 * (white - lp);
                data[i] = lp * 0.4;
            } else if (kind === 'ocean') {
                // Deep noise breathing on two slow, out-of-phase swells.
                last = (last + 0.02 * white) / 1.02;
                const swell = 0.5 + 0.32 * Math.sin(2 * Math.PI * 0.0625 * t) +
                    0.18 * Math.sin(2 * Math.PI * 0.146 * t + 1.7);
                data[i] = last * 3.0 * Math.max(0.12, swell);
            } else if (kind === 'wind') {
                // Softened noise whose tone and strength wander slowly.
                const a = 0.03 + 0.024 * (1 + Math.sin(2 * Math.PI * 0.05 * t));
                lp += a * (white - lp);
                const gust = 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.083 * t + 0.9);
                data[i] = lp * 1.15 * gust;
            } else if (kind === 'fire') {
                // A low ember rumble - crackles are added below.
                last = (last + 0.02 * white) / 1.02;
                data[i] = last * 1.1;
            } else if (kind === 'forest') {
                // A soft leafy hush - birdsong is added below.
                const a = 0.05 + 0.03 * (1 + Math.sin(2 * Math.PI * 0.07 * t));
                lp += a * (white - lp);
                data[i] = lp * 0.8 *
                    (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.05 * t + 2.1));
            }
        }
        if (kind === 'rain') {
            // Individual droplets: short decaying pings at random moments.
            const drops = Math.floor(seconds * 22);
            for (let d = 0; d < drops; d++) {
                const at = Math.floor(Math.random() * (data.length - 500));
                const f = 900 + Math.random() * 1900;
                const amp = 0.05 + Math.random() * 0.09;
                for (let j = 0; j < 420; j++) {
                    data[at + j] += Math.sin(2 * Math.PI * f * j / rate) *
                        amp * Math.exp(-j / 90);
                }
            }
        } else if (kind === 'fire') {
            // Crackles: sparse noise bursts with a fast decay.
            const pops = Math.floor(seconds * 12);
            for (let p = 0; p < pops; p++) {
                const at = Math.floor(Math.random() * (data.length - 900));
                const amp = 0.10 + Math.random() * 0.22;
                const decay = 60 + Math.random() * 320;
                for (let j = 0; j < 800; j++) {
                    data[at + j] += (Math.random() * 2 - 1) *
                        amp * Math.exp(-j / decay);
                }
            }
        }
        if (kind === 'forest') {
            // Birdsong: sparse two-note chirps, gentle downward sweeps.
            const chirps = Math.floor(seconds * 1.2);
            for (let c = 0; c < chirps; c++) {
                const at = Math.floor(Math.random() * (data.length - 8000));
                const f0 = 2400 + Math.random() * 1400;
                const notes = 1 + Math.floor(Math.random() * 2);
                for (let n = 0; n < notes; n++) {
                    const offset = at + n * 2600;
                    const amp = 0.05 + Math.random() * 0.06;
                    for (let j = 0; j < 2200; j++) {
                        const sweep = f0 * (1 - 0.18 * (j / 2200));
                        data[offset + j] +=
                            Math.sin(2 * Math.PI * sweep * j / rate) *
                            amp * Math.sin(Math.PI * j / 2200);
                    }
                }
            }
        }
        // Normalize each loop to the same comfortable peak.
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
            peak = Math.max(peak, Math.abs(data[i]));
        }
        if (peak > 0) {
            const s = 0.3 / peak;
            for (let i = 0; i < data.length; i++) data[i] *= s;
        }
        return buffer;
    },

    apply(profile) {
        const p = profile || acbProfile();
        this.stop();
        if (p.ambient === 'off') return;
        try {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext ||
                    window.webkitAudioContext)();
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.source = this.ctx.createBufferSource();
            this.source.buffer = this.buffer(p.ambient, this.ctx);
            this.source.loop = true;
            this.gain = this.ctx.createGain();
            this.gain.gain.value = Math.max(0, Math.min(0.6, p.ambientVol));
            this.source.connect(this.gain).connect(this.ctx.destination);
            this.source.start();
        } catch (e) { /* ambience is optional comfort */ }
    },

    stop() {
        try { this.source?.stop(); } catch (e) { /* already stopped */ }
        this.source = null;
    },
};

/* ------------------------------------------------------------------------ */
/* The wizard                                                                */
/* ------------------------------------------------------------------------ */

function openSensoryWizard() {
    const wizard = document.getElementById('sensoryWizard');
    if (!wizard) return;
    const p = acbProfile();
    // Reflect current choices.
    wizard.querySelectorAll('[data-pref]').forEach((el) => {
        const [key, value] = el.dataset.pref.split(':');
        el.classList.toggle('is-picked', String(p[key]) === value);
    });
    const vol = document.getElementById('ambientVol');
    if (vol) vol.value = String(Math.round(p.ambientVol * 100));
    wizard.hidden = false;
}

function closeSensoryWizard() {
    const wizard = document.getElementById('sensoryWizard');
    if (wizard) wizard.hidden = true;
    try { localStorage.setItem('acb.profileSeen', 'true'); }
    catch (e) { /* fine */ }
}

function setupSensory() {
    applyProfile(acbProfile());

    const wizard = document.getElementById('sensoryWizard');
    if (!wizard) return;

    // The little (i) on each section: tap to read what the options do.
    wizard.querySelectorAll('.pref-info').forEach((button) => {
        button.addEventListener('click', () => {
            const text = button.closest('h3').nextElementSibling;
            if (!text || !text.classList.contains('pref-info__text')) return;
            text.hidden = !text.hidden;
            button.setAttribute('aria-expanded', String(!text.hidden));
        });
    });

    wizard.querySelectorAll('[data-pref]').forEach((el) => {
        el.addEventListener('click', () => {
            const [key, value] = el.dataset.pref.split(':');
            saveProfile({[key]: value});
            wizard.querySelectorAll(`[data-pref^="${key}:"]`)
                .forEach((sib) => sib.classList.remove('is-picked'));
            el.classList.add('is-picked');
            if (key === 'ambient' && value !== 'off') {
                // audible immediately so the choice is informed
            }
        });
    });

    document.getElementById('ambientVol')?.addEventListener('input', (e) => {
        saveProfile({ambientVol: Number(e.target.value) / 100});
    });

    document.getElementById('sensoryDone')?.addEventListener('click',
        closeSensoryWizard);
    document.getElementById('sensoryOpen')?.addEventListener('click',
        openSensoryWizard);
    wizard.addEventListener('click', (event) => {
        if (event.target === wizard) closeSensoryWizard();
    });

    // First visit: offer the wizard once, gently, after things settle.
    let seen = false;
    try { seen = localStorage.getItem('acb.profileSeen') === 'true'; }
    catch (e) { /* fine */ }
    if (!seen) setTimeout(openSensoryWizard, 1600);
}


/* ------------------------------------------------------------------------ */
/* Read-aloud: Web Speech API. The speaker button on the step card always   */
/* works; the profile toggle additionally reads coach messages aloud.       */
/* ------------------------------------------------------------------------ */

function acbSpeak(text) {
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(String(text));
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    } catch (e) { /* speech is optional */ }
}

function acbMaybeSpeakCoach(text) {
    if (acbProfile().readAloud === 'on') acbSpeak(text);
}

/* ------------------------------------------------------------------------ */
/* Body double: Blox keeps you gentle company - and you can tell he is       */
/* there. A green presence dot on his avatar, an immediate hello, the cube   */
/* idling in a slow turn, quiet acknowledgments while you work, and a soft   */
/* re-engage line after an idle spell. Presence, never surveillance and     */
/* never a demand. Evidence: 85% of surveyed neurodivergent users report    */
/* body doubling improves task completion; AI companions measured           */
/* similarly (2025).                                                         */
/* ------------------------------------------------------------------------ */

let acbCompanionTimer = null;
let acbCompanionSpin = null;
let acbCompanionLastActivity = 0;
let acbCompanionIdleNudged = false;
let acbCompanionSinceLine = 0;
let acbCompanionListening = false;

// Test hooks: shrink these to fast-forward the companion in a harness.
let ACB_COMPANION_TICK_MS = 60 * 1000;        // heartbeat
let ACB_COMPANION_IDLE_MS = 4 * 60 * 1000;    // silence before a nudge
let ACB_COMPANION_LINE_EVERY = 4;             // active ticks between lines

const ACB_PRESENCE_LINES = [
    'Still here, working alongside you.',
    'No rush. I am right here.',
    'Your pace is the right pace.',
    'Here with you. The next small step is enough.',
    'That stack is coming along. I am around.',
];
const ACB_IDLE_LINES = [
    'No pressure. One small block whenever you are ready.',
    'Taking a moment is fine. I will be here when you look back.',
    'Stuck or resting? Either is okay. Tap "I\'m stuck" if you want a hand.',
];
let acbPresenceIndex = 0;
let acbIdleIndex = 0;

function acbCompanionSay(line) {
    if (document.visibilityState === 'hidden') return;
    const message = document.getElementById('coachMessage');
    if (!message || message.classList.contains('is-thinking')) return;
    message.textContent = line;
}

function acbCompanionActivity() {
    acbCompanionLastActivity = Date.now();
    acbCompanionIdleNudged = false;
}

function applyCompanion(profile) {
    const p = profile || acbProfile();
    clearInterval(acbCompanionTimer);
    acbCompanionTimer = null;
    if (acbCompanionSpin) { cancelAnimationFrame(acbCompanionSpin); acbCompanionSpin = null; }
    document.querySelector('.coach-card')
        ?.classList.toggle('has-companion', p.companion === 'on');
    if (p.companion !== 'on') return;

    // You should FEEL the switch flip: an immediate hello, and the cube
    // loads now (not lazily on the first AI thought) so it can idle.
    acbCompanionSay('I am here. Let us build together.');
    if (typeof ensureBloxSpinner === 'function') ensureBloxSpinner();

    // Presence follows activity, not just a clock: any workspace event,
    // key, or click counts as "working together".
    if (!acbCompanionListening) {
        acbCompanionListening = true;
        for (const type of ['pointerdown', 'keydown']) {
            document.addEventListener(type, acbCompanionActivity, true);
        }
        document.addEventListener('acb-task', acbCompanionActivity);
    }
    acbCompanionActivity();
    acbCompanionSinceLine = 0;

    acbCompanionTimer = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        const idleFor = Date.now() - acbCompanionLastActivity;
        if (idleFor >= ACB_COMPANION_IDLE_MS) {
            // One gentle re-engage per idle spell - the classic body-double
            // "still with you", never an alarm, never repeated.
            if (!acbCompanionIdleNudged) {
                acbCompanionIdleNudged = true;
                acbCompanionSay(ACB_IDLE_LINES[acbIdleIndex++ %
                    ACB_IDLE_LINES.length]);
            }
            return;
        }
        // Actively working: an occasional quiet acknowledgment.
        acbCompanionSinceLine++;
        if (acbCompanionSinceLine >= ACB_COMPANION_LINE_EVERY) {
            acbCompanionSinceLine = 0;
            acbCompanionSay(ACB_PRESENCE_LINES[acbPresenceIndex++ %
                ACB_PRESENCE_LINES.length]);
        }
    }, ACB_COMPANION_TICK_MS);

    // The cube keeps you company with a very slow idle turn.
    const noMotion = document.body.classList.contains('acb-no-motion') ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (noMotion) return;
    const spin = () => {
        if (acbProfile().companion !== 'on') return;
        const state = (typeof bloxSpinState !== 'undefined') ? bloxSpinState : null;
        if (state && !state.spinning) {
            state.model.rotation.y += 0.004;
            state.renderer.render(state.scene, state.camera);
        }
        acbCompanionSpin = requestAnimationFrame(spin);
    };
    acbCompanionSpin = requestAnimationFrame(spin);
}

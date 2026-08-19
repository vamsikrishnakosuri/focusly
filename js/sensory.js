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
        const seconds = 4;
        const rate = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, rate * seconds, rate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, last = 0;
        for (let i = 0; i < data.length; i++) {
            const white = Math.random() * 2 - 1;
            if (kind === 'white') {
                data[i] = white * 0.28;
            } else if (kind === 'pink') {
                // Paul Kellet's economy pink noise approximation.
                b0 = 0.99765 * b0 + white * 0.0990460;
                b1 = 0.96300 * b1 + white * 0.2965164;
                b2 = 0.57000 * b2 + white * 1.0526913;
                data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
            } else {  // brown
                last = (last + 0.02 * white) / 1.02;
                data[i] = last * 3.2;
            }
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

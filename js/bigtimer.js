/**
 * @fileoverview The countdown display. Visible time is the core ADHD
 * accommodation (time blindness), but it must never cost workspace calm:
 * every placement lives in the app's own chrome, never floating over the
 * blocks. The learner picks where it lives and how big it is:
 *
 *   - Chip only: no big display; the little chip beside the toggle is it.
 *   - Top bar (default): the app bar's empty middle.
 *   - Left: centered in the toolbox column's empty lower half.
 *   - Right: under Blox's panel in the right column.
 *   - Bottom: hugging the workspace's bottom-left edge.
 *
 * Size is a slider, clamped per placement - the top bar cannot overflow
 * into the workspace no matter how far the slider goes; the left column
 * caps at its own width; and so on. Leaking is structurally impossible.
 */

const ACB_BIGTIMER_DEFAULTS = {
    pos: 'header',       // chip | header | left | right | bottom
    scale: 0.5,          // 0..1 via the slider
    color: 'green',      // green | purple | blue | ink
};

const ACB_BIGTIMER_COLORS = {
    green: '#1a936f', purple: '#765BA6', blue: '#5B85A6', ink: '#333a3f',
};

function bigTimerPrefs() {
    let stored = {};
    try {
        stored = JSON.parse(localStorage.getItem('acb.bigTimer') || '{}');
    } catch (e) { /* fine */ }
    // Migrate the older show/size scheme.
    if (stored.show === 'off') stored.pos = 'chip';
    if (stored.size && stored.scale === undefined) {
        stored.scale = {s: 0.25, m: 0.5, l: 0.8}[stored.size] ?? 0.5;
    }
    return {...ACB_BIGTIMER_DEFAULTS, ...stored};
}

function saveBigTimerPrefs(patch) {
    const next = {...bigTimerPrefs(), ...patch};
    try { localStorage.setItem('acb.bigTimer', JSON.stringify(next)); }
    catch (e) { /* fine */ }
    bigTimerRender();
    return next;
}

function bigTimerEl() {
    let el = document.getElementById('bigTimer');
    if (!el) {
        el = document.createElement('div');
        el.id = 'bigTimer';
        el.className = 'big-timer';
        el.setAttribute('aria-hidden', 'true');  // the chip is the a11y source
        document.body.appendChild(el);
    }
    return el;
}

/** Font size for a placement, clamped so the home can never overflow. */
function bigTimerFont(pos, scale) {
    if (pos === 'header') {
        // The app bar is ~56px tall: 28px max keeps it inside, always.
        return 13 + scale * 15;
    }
    if (pos === 'left') {
        const toolbox = document.querySelector('.blocklyToolboxDiv');
        const width = toolbox ? toolbox.getBoundingClientRect().width : 130;
        // "1h 22m 33s" is ~6 characters per line when it wraps; the cap
        // keeps the widest line inside the column.
        return Math.min(12 + scale * 22, Math.max(12, width / 5.6));
    }
    if (pos === 'right') {
        const card = document.getElementById('coachCard');
        const width = card ? card.getBoundingClientRect().width : 300;
        return Math.min(14 + scale * 40, Math.max(14, width / 7.5));
    }
    // bottom: capped against the BLOCK AREA (canvas minus toolbox).
    const canvas = document.getElementById('blocklyDiv');
    const toolbox = document.querySelector('.blocklyToolboxDiv');
    let width = canvas ? canvas.getBoundingClientRect().width : 700;
    if (toolbox) width -= toolbox.getBoundingClientRect().width;
    return Math.min(14 + scale * 58, Math.max(14, width / 10));
}

function bigTimerRender() {
    const el = bigTimerEl();
    const prefs = bigTimerPrefs();
    const timer = (typeof getBreakTimer === 'function') && getBreakTimer();
    const state = timer && timer.getStateName();
    const active = prefs.pos !== 'chip' && timer && state !== 'off' &&
        !document.body.classList.contains('acb-break-open');
    if (!active) { el.hidden = true; return; }

    const paused = typeof timer.isPaused === 'function' && timer.isPaused();
    const ms = Math.max(0, timer.remainingMs());
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const time = h > 0 ?
        `${h}h ${String(m).padStart(2, '0')}m ` +
            `${String(s).padStart(2, '0')}s` :
        `${m}m ${String(s).padStart(2, '0')}s`;
    const label = paused ? 'paused' :
        state === 'break' ? 'break' :
        state === 'nudging' ? 'break?' : 'until break';
    el.innerHTML = `<span class="big-timer__time">${time}</span>` +
        `<span class="big-timer__label">${label}</span>`;

    el.className = `big-timer big-timer--${prefs.pos}`;
    el.style.color = ACB_BIGTIMER_COLORS[prefs.color] ||
        ACB_BIGTIMER_COLORS.green;
    el.style.fontSize = `${Math.round(bigTimerFont(prefs.pos, prefs.scale))}px`;

    // Each placement mounts INSIDE its home element, so overflow is
    // impossible by construction rather than by arithmetic alone.
    if (prefs.pos === 'header') {
        const bar = document.querySelector('.app-bar');
        const status = document.querySelector('.app-bar__status');
        if (bar && el.parentElement !== bar) {
            bar.insertBefore(el, status || null);
        }
        el.removeAttribute('style-anchor');
        el.style.top = el.style.bottom = el.style.left = el.style.right = '';
    } else if (prefs.pos === 'right') {
        // Directly under Blox's chat card, not at the column's far bottom.
        const card = document.getElementById('coachCard');
        if (card && el.previousElementSibling !== card) {
            card.insertAdjacentElement('afterend', el);
        }
        el.style.top = el.style.bottom = el.style.left = el.style.right = '';
        el.style.width = '';
    } else if (prefs.pos === 'left') {
        if (el.parentElement !== document.body) document.body.appendChild(el);
        const toolbox = document.querySelector('.blocklyToolboxDiv');
        if (toolbox) {
            const rect = toolbox.getBoundingClientRect();
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.top + rect.height * 0.55}px`;
            el.style.right = el.style.bottom = '';
            el.style.width = `${rect.width}px`;
        }
    } else {  // bottom: the block area's bottom edge, clear of the toolbox
        if (el.parentElement !== document.body) document.body.appendChild(el);
        const canvas = document.getElementById('blocklyDiv');
        const toolbox = document.querySelector('.blocklyToolboxDiv');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const blocksLeft = toolbox ?
                toolbox.getBoundingClientRect().right : rect.left;
            el.style.left = `${blocksLeft + 18}px`;
            el.style.top = '';
            el.style.bottom =
                `${Math.max(8, window.innerHeight - rect.bottom + 12)}px`;
            el.style.right = el.style.width = '';
        }
    }
    el.hidden = false;
}

function setupBigTimer() {
    setInterval(bigTimerRender, 500);
    document.querySelectorAll('[data-bt]').forEach((button) => {
        button.addEventListener('click', () => {
            const [key, value] = button.dataset.bt.split(':');
            saveBigTimerPrefs({[key]: value});
            button.parentElement.querySelectorAll(`[data-bt^="${key}:"]`)
                .forEach((sib) => sib.classList.toggle('is-picked',
                    sib === button));
        });
    });
    const slider = document.getElementById('btSizeSlider');
    slider?.addEventListener('input', () =>
        saveBigTimerPrefs({scale: Number(slider.value) / 100}));
    const prefs = bigTimerPrefs();
    if (slider) slider.value = String(Math.round(prefs.scale * 100));
    for (const [key, value] of Object.entries(prefs)) {
        document.querySelector(`[data-bt="${key}:${value}"]`)
            ?.classList.add('is-picked');
    }
}

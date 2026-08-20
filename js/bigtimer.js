/**
 * @fileoverview The big canvas timer. The chip's little countdown is easy
 * to miss; when the timer is on, a large readable countdown can sit right
 * on the workspace - visible time is one of the best-evidenced ADHD
 * supports (time blindness is the barrier; making time concrete is the
 * accommodation). The learner controls it fully: on/off, size, corner,
 * and color, from the timer dropdown.
 */

const ACB_BIGTIMER_DEFAULTS = {
    show: 'on',            // on | off
    size: 'm',             // s | m | l
    pos: 'top-center',     // top-left | top-center | top-right | bottom-right
    color: 'green',        // green | purple | blue | ink
};

const ACB_BIGTIMER_COLORS = {
    green: '#1a936f', purple: '#765BA6', blue: '#5B85A6', ink: '#333a3f',
};

function bigTimerPrefs() {
    try {
        return {...ACB_BIGTIMER_DEFAULTS,
            ...JSON.parse(localStorage.getItem('acb.bigTimer') || '{}')};
    } catch (e) { return {...ACB_BIGTIMER_DEFAULTS}; }
}

function saveBigTimerPrefs(patch) {
    const next = {...bigTimerPrefs(), ...patch};
    try { localStorage.setItem('acb.bigTimer', JSON.stringify(next)); }
    catch (e) { /* fine */ }
    bigTimerRender();   // reflect immediately
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

function bigTimerRender() {
    const el = bigTimerEl();
    const prefs = bigTimerPrefs();
    const timer = (typeof getBreakTimer === 'function') && getBreakTimer();
    const state = timer && timer.getStateName();
    const active = prefs.show === 'on' && timer &&
        state !== 'off' && !document.body.classList.contains('acb-break-open');
    if (!active) { el.hidden = true; return; }

    const paused = typeof timer.isPaused === 'function' && timer.isPaused();
    const ms = Math.max(0, timer.remainingMs());
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const label = paused ? 'paused' :
        state === 'break' ? 'break' :
        state === 'nudging' ? 'break?' : 'until break';
    el.innerHTML = `<span class="big-timer__time">${m}m ` +
        `${String(s).padStart(2, '0')}s</span>` +
        `<span class="big-timer__label">${label}</span>`;

    el.className = `big-timer big-timer--${prefs.size} ` +
        `big-timer--${prefs.pos}`;
    el.style.color = ACB_BIGTIMER_COLORS[prefs.color] ||
        ACB_BIGTIMER_COLORS.green;

    // Anchor to the workspace's own rectangle, whatever the layout.
    const canvas = document.getElementById('blocklyDiv');
    if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const margin = 14;
        el.style.top = prefs.pos.startsWith('top') ?
            `${rect.top + margin}px` : '';
        el.style.bottom = prefs.pos.startsWith('bottom') ?
            `${window.innerHeight - rect.bottom + margin}px` : '';
        if (prefs.pos.endsWith('left')) {
            el.style.left = `${rect.left + 70 + margin}px`;
            el.style.right = '';
            el.style.transform = '';
        } else if (prefs.pos.endsWith('center')) {
            el.style.left = `${rect.left + rect.width / 2}px`;
            el.style.right = '';
            el.style.transform = 'translateX(-50%)';
        } else {
            el.style.right = `${window.innerWidth - rect.right + margin}px`;
            el.style.left = '';
            el.style.transform = '';
        }
    }
    el.hidden = false;
}

function setupBigTimer() {
    setInterval(bigTimerRender, 500);
    // Controls live in the timer dropdown; chips carry data-bt="key:value".
    document.querySelectorAll('[data-bt]').forEach((button) => {
        button.addEventListener('click', () => {
            const [key, value] = button.dataset.bt.split(':');
            saveBigTimerPrefs({[key]: value});
            button.parentElement.querySelectorAll(`[data-bt^="${key}:"]`)
                .forEach((sib) => sib.classList.toggle('is-picked',
                    sib === button));
        });
    });
    // Reflect stored choices on the chips at load.
    const prefs = bigTimerPrefs();
    for (const [key, value] of Object.entries(prefs)) {
        document.querySelector(`[data-bt="${key}:${value}"]`)
            ?.classList.add('is-picked');
    }
}

/**
 * @fileoverview The time wheel: an Apple-style picker for the focus timer.
 * Click the Work or Break value and three snapping columns appear - h, m,
 * s, each labeled - scrolled with the finger or wheel, one soft tick per
 * detent (through the master sounds switch), committing on settle. Typing
 * in the field still works; the wheel is the pleasant path, not the only
 * one.
 */

let acbWheelOpen = null;   // the currently open .time-wheel element

const ACB_WHEEL_ITEM_H = 28;

function wheelColumn(max, initial, caption) {
    const col = document.createElement('div');
    col.className = 'time-wheel__unit';
    const label = document.createElement('div');
    label.className = 'time-wheel__caption';
    label.textContent = caption;
    const scroller = document.createElement('div');
    scroller.className = 'time-wheel__col';
    scroller.dataset.value = String(initial);
    scroller.setAttribute('role', 'listbox');
    scroller.setAttribute('aria-label', caption);
    const pad1 = document.createElement('div');
    pad1.className = 'time-wheel__spacer';
    scroller.appendChild(pad1);
    for (let i = 0; i <= max; i++) {
        const item = document.createElement('div');
        item.className = 'time-wheel__item';
        item.textContent = String(i).padStart(2, '0');
        scroller.appendChild(item);
    }
    const pad2 = document.createElement('div');
    pad2.className = 'time-wheel__spacer';
    scroller.appendChild(pad2);
    col.appendChild(label);
    col.appendChild(scroller);
    return {col, scroller};
}

function wheelValue(scroller) {
    return Math.max(0, Math.round(scroller.scrollTop / ACB_WHEEL_ITEM_H));
}

function wheelPaint(scroller) {
    const idx = wheelValue(scroller);
    const items = scroller.querySelectorAll('.time-wheel__item');
    items.forEach((item, i) =>
        item.classList.toggle('is-centered', i === idx));
}

function closeTimeWheel() {
    if (acbWheelOpen) {
        acbWheelOpen.remove();
        acbWheelOpen = null;
        document.removeEventListener('pointerdown', wheelOutside, true);
    }
}

function wheelOutside(event) {
    if (acbWheelOpen && !acbWheelOpen.contains(event.target) &&
        !event.target.classList?.contains('timer-input')) {
        closeTimeWheel();
    }
}

/** Formats minutes as the input's display text: "25m 00s" / "1h 30m 00s". */
function wheelDisplay(minutes) {
    const total = Math.round((Number(minutes) || 0) * 60);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ?
        `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` :
        `${m}m ${String(s).padStart(2, '0')}s`;
}

function openTimeWheel(input, key, maxHours, minSecondsTotal) {
    closeTimeWheel();
    const timer = (typeof getBreakTimer === 'function') && getBreakTimer();
    if (!timer) return;
    const startTotal = Math.round(timer.getDurations()[key] * 60);
    const start = {
        h: Math.floor(startTotal / 3600),
        m: Math.floor((startTotal % 3600) / 60),
        s: startTotal % 60,
    };

    const wheel = document.createElement('div');
    wheel.className = 'time-wheel';
    const hours = wheelColumn(maxHours, start.h, 'hours');
    const minutes = wheelColumn(59, start.m, 'min');
    const seconds = wheelColumn(59, start.s, 'sec');
    wheel.appendChild(hours.col);
    wheel.appendChild(minutes.col);
    wheel.appendChild(seconds.col);
    const band = document.createElement('div');
    band.className = 'time-wheel__band';
    wheel.appendChild(band);
    input.closest('.timer-dropdown__row').insertAdjacentElement(
        'afterend', wheel);
    acbWheelOpen = wheel;
    document.addEventListener('pointerdown', wheelOutside, true);

    const scrollers = [hours.scroller, minutes.scroller, seconds.scroller];
    let commitTimer = null;
    const commit = () => {
        const total = Math.max(minSecondsTotal,
            wheelValue(hours.scroller) * 3600 +
            wheelValue(minutes.scroller) * 60 +
            wheelValue(seconds.scroller));
        timer.setDurations({[key]: total / 60});
        input.value = wheelDisplay(total / 60);
    };
    for (const scroller of scrollers) {
        // Land on the starting value (after layout).
        requestAnimationFrame(() => {
            scroller.scrollTop =
                Number(scroller.dataset.value) * ACB_WHEEL_ITEM_H;
            wheelPaint(scroller);
        });
        let lastIdx = Number(scroller.dataset.value);
        scroller.addEventListener('scroll', () => {
            const idx = wheelValue(scroller);
            if (idx !== lastIdx) {
                lastIdx = idx;
                if (typeof playUi === 'function') playUi('tick');
                wheelPaint(scroller);
            }
            clearTimeout(commitTimer);
            commitTimer = setTimeout(commit, 320);
        }, {passive: true});
    }
}

function setupTimeWheels() {
    const workInput = document.getElementById('timerWorkInput');
    const breakInput = document.getElementById('timerBreakInput');
    workInput?.addEventListener('focus',
        () => openTimeWheel(workInput, 'workMinutes', 4, 5));
    breakInput?.addEventListener('focus',
        () => openTimeWheel(breakInput, 'breakMinutes', 2, 5));
}

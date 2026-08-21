/**
 * @fileoverview The motivation messenger: small, calm encouragement at
 * moments that earn it - never on a random clock, never loud, never in the
 * way. Praise lands on EFFORT and RECOVERY (the mindset the ADHD coaching
 * literature backs), not on streak-keeping or attendance:
 *
 *   - comeback: a clean run right after a failed one (the best moment in
 *     all of programming).
 *   - momentum: the 3rd and 7th run of a session.
 *   - persistence: every ~12 visible minutes of continued work.
 *   - return: coming back from a break.
 *
 * Presentation: one soft toast, bottom-center, fades by itself, shows in
 * focus mode too (encouragement is not clutter). Hard cadence cap: at
 * most one toast per 4 minutes. The sensory profile can turn it off -
 * every stimulus in Focusly stays under the learner's control.
 */

const ACB_MOTIVATION_LINES = {
    comeback: [
        'Broken, examined, fixed. That is real debugging.',
        'It failed, you looked, it works. That skill is the whole job.',
        'From error to working run - that is the loop that builds coders.',
    ],
    momentum: [
        'Third run already - you are properly building now.',
        'Seven runs deep. This is what steady looks like.',
    ],
    persistence: [
        'Still at it. Focus like this is worth noticing.',
        'Quiet, steady progress. It counts double.',
        'You have been building for a while - respect.',
    ],
    returned: [
        'Welcome back. Small restart, same builder.',
        'Break taken, focus refreshed. Pick any small piece to restart.',
    ],
};

let acbMotivationLastAt = 0;
let acbMotivationRuns = 0;
let acbMotivationLastFailed = false;
let acbMotivationWorkMs = 0;
let acbMotivationTick = null;

function motivationOn() {
    return (typeof acbProfile !== 'function') ||
        acbProfile().cheer !== 'off';
}

function motivationToast(category) {
    const now = Date.now();
    if (!motivationOn()) return;
    if (now - acbMotivationLastAt < 4 * 60 * 1000) return;   // cadence cap
    acbMotivationLastAt = now;
    const lines = ACB_MOTIVATION_LINES[category] || [];
    const line = lines[Math.floor(now / 1000) % lines.length];
    if (!line) return;
    let toast = document.getElementById('motivationToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'motivationToast';
        toast.className = 'motivation-toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
    }
    toast.textContent = line;
    toast.classList.remove('is-showing');
    void toast.offsetWidth;   // restart the animation
    toast.classList.add('is-showing');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() =>
        toast.classList.remove('is-showing'), 6000);
}

function setupMotivation() {
    // Runs: comebacks and momentum.
    document.getElementById('runButton')?.addEventListener('click', () => {
        setTimeout(() => {
            const failed = typeof acbLastRunError !== 'undefined' &&
                !!acbLastRunError;
            if (!failed) {
                acbMotivationRuns += 1;
                if (acbMotivationLastFailed) motivationToast('comeback');
                else if (acbMotivationRuns === 3 ||
                         acbMotivationRuns === 7) {
                    motivationToast('momentum');
                }
            }
            acbMotivationLastFailed = failed;
        }, 600);
    });

    // Persistence: visible, recently-active work time.
    let lastActivity = Date.now();
    for (const type of ['pointerdown', 'keydown']) {
        document.addEventListener(type,
            () => { lastActivity = Date.now(); }, true);
    }
    acbMotivationTick = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        if (document.body.classList.contains('acb-break-open')) return;
        if (Date.now() - lastActivity > 90 * 1000) return;   // idle
        acbMotivationWorkMs += 30 * 1000;
        if (acbMotivationWorkMs >= 12 * 60 * 1000) {
            acbMotivationWorkMs = 0;
            motivationToast('persistence');
        }
    }, 30 * 1000);

    // Returning from a break.
    document.addEventListener('acb-break-timer', (event) => {
        const action = event.detail && event.detail.action;
        if (action === 'break-ended' || action === 'break-over') {
            // Let the break scene fold away first.
            setTimeout(() => motivationToast('returned'), 1200);
        }
    });
}

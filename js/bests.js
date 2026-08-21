/**
 * @fileoverview Personal bests: the leaderboard where the only rival is
 * yesterday's you. Ranked class boards are the one gamification element
 * the ADHD literature consistently flags as harmful (public comparison
 * lands hardest on the already-overwhelmed), so Focusly keeps score
 * against the self instead: most XP in a day, longest focus session,
 * quests finished, comebacks (a clean run right after a failed one),
 * best streak. New records celebrate quietly; nothing is ever compared
 * to anyone else, and it all lives in this browser.
 */

const ACB_BESTS_DEFAULTS = {
    xpDayBest: 0,          // most XP earned in a single day
    focusBestMs: 0,        // longest single focus-mode session
    questsTotal: 0,
    comebacks: 0,
    streakBest: 0,
};

function acbBests() {
    try {
        return {...ACB_BESTS_DEFAULTS,
            ...JSON.parse(localStorage.getItem('acb.bests') || '{}')};
    } catch (e) { return {...ACB_BESTS_DEFAULTS}; }
}

function saveBests(patch) {
    const next = {...acbBests(), ...patch};
    try { localStorage.setItem('acb.bests', JSON.stringify(next)); }
    catch (e) { /* fine */ }
    return next;
}

let acbBestToastAt = 0;

function bestCelebrate(text) {
    // A record is worth a beat of joy, but never a parade: one toast,
    // badge chime, and at most one celebration per 3 minutes.
    const now = Date.now();
    if (now - acbBestToastAt < 3 * 60 * 1000) return;
    acbBestToastAt = now;
    if (typeof playChime === 'function') playChime('badge');
    if (typeof showXpToast === 'function') showXpToast(`★ ${text}`);
}

/* ------------------------------ tracking ------------------------------- */

function bestsTodayKey() {
    return 'acb.xpToday.' + new Date().toISOString().slice(0, 10);
}

function bestsAddXp(amount) {
    if (!amount) return;
    let today = 0;
    try { today = Number(localStorage.getItem(bestsTodayKey()) || 0); }
    catch (e) { /* fine */ }
    today += amount;
    try { localStorage.setItem(bestsTodayKey(), String(today)); }
    catch (e) { /* fine */ }
    const bests = acbBests();
    if (today > bests.xpDayBest) {
        const wasReal = bests.xpDayBest > 0;
        saveBests({xpDayBest: today});
        if (wasReal) bestCelebrate('New best: most XP in one day!');
    }
}

let acbFocusStartedAt = null;

function bestsOnFocusChange() {
    const inFocus = document.body.classList.contains('acb-focus-mode');
    if (inFocus && acbFocusStartedAt === null) {
        acbFocusStartedAt = Date.now();
    } else if (!inFocus && acbFocusStartedAt !== null) {
        const sessionMs = Date.now() - acbFocusStartedAt;
        acbFocusStartedAt = null;
        const bests = acbBests();
        if (sessionMs > bests.focusBestMs && sessionMs > 60 * 1000) {
            const wasReal = bests.focusBestMs > 0;
            saveBests({focusBestMs: sessionMs});
            if (wasReal) {
                bestCelebrate('New best: your longest focus session!');
            }
        }
    }
}

let acbBestsLastRunFailed = false;

function bestsOnRun() {
    setTimeout(() => {
        const failed = (typeof acbLastRunError !== 'undefined') &&
            !!acbLastRunError;
        if (!failed && acbBestsLastRunFailed) {
            saveBests({comebacks: acbBests().comebacks + 1});
        }
        acbBestsLastRunFailed = failed;
    }, 800);
}

/* ------------------------------- the panel ----------------------------- */

function bestsFormatMs(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes >= 60) {
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    }
    return minutes > 0 ? `${minutes}m` : 'not yet';
}

function openBestsPanel() {
    let modal = document.getElementById('bestsModal');
    modal?.remove();
    const bests = acbBests();
    let streakNow = 0;
    try {
        const streak = JSON.parse(localStorage.getItem('acb.streak') || '{}');
        streakNow = (streak.days || []).length;
    } catch (e) { /* fine */ }
    if (streakNow > bests.streakBest) {
        saveBests({streakBest: streakNow});
        bests.streakBest = streakNow;
    }
    let today = 0;
    try { today = Number(localStorage.getItem(bestsTodayKey()) || 0); }
    catch (e) { /* fine */ }

    const rows = [
        ['Most XP in one day', bests.xpDayBest || 'not yet',
            `today so far: ${today}`],
        ['Longest focus session', bestsFormatMs(bests.focusBestMs), ''],
        ['Quests finished', bests.questsTotal || 0, ''],
        ['Comebacks (fixed a broken run)', bests.comebacks || 0, ''],
        ['Best streak', bests.streakBest ?
            `${bests.streakBest} days` : 'not yet', ''],
    ];
    modal = document.createElement('div');
    modal.id = 'bestsModal';
    modal.className = 'quest-map';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'My personal bests');
    modal.innerHTML =
        '<div class="quest-map__card bests-card">' +
        '<header class="quest-map__header"><h2>★ My bests</h2>' +
        '<button id="bestsClose" class="coach-chip" type="button">' +
        'Close</button></header>' +
        '<div class="quest-map__body">' +
        '<p class="challenge-modal__line">Your only rival here is a ' +
        'previous you. Nothing on this page is compared with anyone ' +
        'else, ever.</p>' +
        rows.map(([label, value, hint]) =>
            `<div class="bests-row"><span>${label}</span>` +
            `<strong>${value}</strong>` +
            (hint ? `<em>${hint}</em>` : '') + '</div>').join('') +
        '</div></div>';
    document.body.appendChild(modal);
    document.getElementById('bestsClose').addEventListener('click',
        () => modal.remove());
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.remove();
    });
}

function setupBests() {
    document.addEventListener('acb-task', (event) => {
        const detail = event.detail || {};
        if (detail.action === 'step' || detail.action === 'complete') {
            bestsAddXp(Number(detail.xp) || 0);
        }
        if (detail.action === 'complete') {
            saveBests({questsTotal: acbBests().questsTotal + 1});
        }
    });
    document.addEventListener('acb-focus-mode-change', bestsOnFocusChange);
    document.getElementById('runButton')?.addEventListener('click',
        bestsOnRun);
    window.addEventListener('pagehide', bestsOnFocusChange);
    document.getElementById('bestsOpen')?.addEventListener('click', () => {
        document.getElementById('settingsDropdown')
            ?.setAttribute('hidden', '');
        openBestsPanel();
    });
}

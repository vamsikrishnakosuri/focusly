/**
 * @fileoverview "Juice & Journey": sounds, badges, the quest map, streak
 * grace, and daily micro-quests. Built on the evidence rules from
 * FEATURE-RESEARCH.md: every reward deterministic, mastery praised (never
 * attendance), streaks forgive, no ranks, celebration always skippable and
 * reduced-motion aware.
 */

/* ------------------------------------------------------------------------ */
/* Sound engine: tiny synthesized chimes via WebAudio. No assets, no sudden  */
/* audio, one master switch. Celebration only - errors stay silent.         */
/* ------------------------------------------------------------------------ */

let acbAudioCtx = null;
let acbSoundsOn = true;
try { acbSoundsOn = localStorage.getItem('acb.sounds') !== 'false'; }
catch (e) { /* fine */ }

function acbTone(freq, startAt, duration, gainPeak, ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
    gain.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001,
        ctx.currentTime + startAt + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + startAt);
    osc.stop(ctx.currentTime + startAt + duration + 0.05);
}

/** kind: 'step' | 'quest' | 'badge' | 'daily' */
function playChime(kind) {
    if (!acbSoundsOn) return;
    try {
        if (!acbAudioCtx) acbAudioCtx = new (window.AudioContext ||
            window.webkitAudioContext)();
        const ctx = acbAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        if (kind === 'step') {
            acbTone(880, 0, 0.18, 0.06, ctx);
            acbTone(1174.7, 0.09, 0.22, 0.05, ctx);
        } else if (kind === 'quest') {
            acbTone(523.3, 0, 0.25, 0.07, ctx);
            acbTone(659.3, 0.12, 0.25, 0.07, ctx);
            acbTone(784, 0.24, 0.4, 0.07, ctx);
        } else if (kind === 'badge') {
            acbTone(1046.5, 0, 0.16, 0.06, ctx);
            acbTone(1568, 0.1, 0.3, 0.05, ctx);
        } else if (kind === 'daily') {
            acbTone(987.8, 0, 0.2, 0.05, ctx);
        }
    } catch (e) { /* sound is decoration */ }
}

/* ------------------------------------------------------------------------ */
/* Badges: mastery-based, deterministic, never attendance. Awarded once.    */
/* ------------------------------------------------------------------------ */

const ACB_BADGES = [
    {id: 'first-run', emoji: '▶️', name: 'First run',
     desc: 'Ran your very first program.'},
    {id: 'hello-coder', emoji: '🎉', name: 'Hello, coder',
     desc: 'Completed your first quest.'},
    {id: 'first-loop', emoji: '🔁', name: 'First loop',
     desc: 'Used a loop in a program you ran.'},
    {id: 'first-if', emoji: '🔀', name: 'Decision maker',
     desc: 'Used an if block in a program you ran.'},
    {id: 'first-variable', emoji: '📦', name: 'Memory keeper',
     desc: 'Used a variable in a program you ran.'},
    {id: 'first-function', emoji: '🧩', name: 'Function builder',
     desc: 'Defined and used your own function.'},
    {id: 'self-debugger', emoji: '🔧', name: 'Self-debugger',
     desc: 'A run failed - and your very next run worked.'},
    {id: 'bridge-walker', emoji: '⇄', name: 'Bridge walker',
     desc: 'Turned typed code into blocks.'},
    {id: 'quest-author', emoji: '✨', name: 'Quest author',
     desc: 'Created your own challenge with Blox.'},
    {id: 'beginner-island', emoji: '🏝️', name: 'Beginner Island',
     desc: 'Completed all three beginner quests.'},
    {id: 'logic-peaks', emoji: '⛰️', name: 'Logic Peaks',
     desc: 'Completed all three intermediate quests.'},
    {id: 'algorithm-summit', emoji: '🏔️', name: 'Algorithm Summit',
     desc: 'Completed all three advanced quests.'},
    {id: 'clean-solver', emoji: '🎯', name: 'Clean solver',
     desc: 'Finished a whole quest without using a near-answer hint.'},
];

function acbReadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch (e) { return fallback; }
}
function acbWriteJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* fine */ }
}

function awardBadge(id) {
    const earned = acbReadJson('acb.badges', {});
    if (earned[id]) return false;
    const badge = ACB_BADGES.find((b) => b.id === id);
    if (!badge) return false;
    earned[id] = Date.now();
    acbWriteJson('acb.badges', earned);
    playChime('badge');
    showXpToast(`${badge.emoji} Badge: ${badge.name}!`);
    document.dispatchEvent(new CustomEvent('acb-badge', {detail: {id}}));
    return true;
}

/** Quest completions record: {taskId: count}. */
function recordQuestDone(taskId, level) {
    const done = acbReadJson('acb.done', {});
    done[taskId] = (done[taskId] || 0) + 1;
    acbWriteJson('acb.done', done);
    awardBadge('hello-coder');
    const doneIds = Object.keys(done);
    const levelDone = (lvl) => (typeof ACB_TASKS !== 'undefined') &&
        ACB_TASKS.filter((t) => t.level === lvl && !String(t.id).startsWith('custom-'))
            .every((t) => doneIds.includes(t.id));
    if (levelDone('beginner')) awardBadge('beginner-island');
    if (levelDone('intermediate')) awardBadge('logic-peaks');
    if (levelDone('advanced')) awardBadge('algorithm-summit');
}

/* ------------------------------------------------------------------------ */
/* Streak with grace: freezes absorb a missed day; a weekly view exists     */
/* for anyone who finds consecutive-day purity stressful. Absence is never  */
/* shown as failure.                                                        */
/* ------------------------------------------------------------------------ */

function acbDayString(offsetDays = 0) {
    const d = new Date(Date.now() - offsetDays * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
        '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Advances streak state for today's visit. Rules:
 *  - same day: no change
 *  - 1-day gap: streak continues
 *  - 2-day gap with a freeze available: freeze absorbs it, streak continues
 *  - otherwise: streak restarts at 1 (warmly - never shown as loss)
 * Every 7 streak days earns a freeze (max 2 held).
 */
function advanceStreak() {
    const s = acbReadJson('acb.streak.v2', null) || {
        last: null, count: 0, freezes: 1, days: [],
    };
    const today = acbDayString();
    if (s.last === today) return s;
    const yesterday = acbDayString(1);
    const dayBefore = acbDayString(2);
    let usedFreeze = false;
    if (s.last === yesterday) {
        s.count += 1;
    } else if (s.last === dayBefore && s.freezes > 0) {
        s.freezes -= 1;
        s.count += 1;
        usedFreeze = true;
    } else {
        s.count = 1;
    }
    s.last = today;
    s.days = (s.days || []).filter((d) => d >= acbDayString(6));
    if (!s.days.includes(today)) s.days.push(today);
    if (s.count > 0 && s.count % 7 === 0 && s.freezes < 2) s.freezes += 1;
    s.usedFreezeToday = usedFreeze;
    acbWriteJson('acb.streak.v2', s);
    return s;
}

/* ------------------------------------------------------------------------ */
/* Daily micro-quests: three tiny, auto-tracked, one-session-sized goals,   */
/* rotated deterministically by date. Each pays 10 XP.                      */
/* ------------------------------------------------------------------------ */

const ACB_DAILY_POOL = [
    {id: 'run-one', text: 'Run a program', event: 'run'},
    {id: 'two-steps', text: 'Complete 2 quest steps', event: 'step', need: 2},
    {id: 'use-loop', text: 'Run a program with a loop', event: 'run-loop'},
    {id: 'use-if', text: 'Run a program with an if block', event: 'run-if'},
    {id: 'ask-blox', text: 'Ask Blox anything (hint, chat, or explain)',
     event: 'blox'},
    {id: 'try-bridge', text: 'Peek at your code as text (Code tab)',
     event: 'code-tab'},
];

function todaysDailies() {
    const today = acbDayString();
    let seed = 0;
    for (const ch of today) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
    const picks = [];
    const pool = [...ACB_DAILY_POOL];
    for (let i = 0; i < 3 && pool.length; i++) {
        picks.push(pool.splice(seed % pool.length, 1)[0]);
        seed = Math.floor(seed / 3) + 17;
    }
    return picks;
}

function dailyState() {
    const key = 'acb.dailies.' + acbDayString();
    return {key, state: acbReadJson(key, {})};
}

/** Records progress toward a daily; awards on completion. */
function dailyProgress(eventName) {
    const dailies = todaysDailies();
    const {key, state} = dailyState();
    let changed = false;
    for (const daily of dailies) {
        if (daily.event !== eventName) continue;
        if (state[daily.id] === 'done') continue;
        const need = daily.need || 1;
        const now = (typeof state[daily.id] === 'number' ? state[daily.id] : 0) + 1;
        if (now >= need) {
            state[daily.id] = 'done';
            playChime('daily');
            showXpToast(`☑️ Daily done: ${daily.text} (+10 XP)`);
            document.dispatchEvent(new CustomEvent('acb-task',
                {detail: {action: 'daily', xp: 10}}));
        } else {
            state[daily.id] = now;
        }
        changed = true;
    }
    if (changed) acbWriteJson(key, state);
    paintMapChipDot();
    // Cosmetics apply on load, and again once the 3D Blox exists.
    applyCosmetics();
    setTimeout(applyCosmetics, 3500);
}

function paintMapChipDot() {
    const dot = document.getElementById('mapChipDot');
    if (!dot) return;
    const {state} = dailyState();
    const remaining = todaysDailies().some((d) => state[d.id] !== 'done');
    dot.hidden = !remaining;
}

/* ------------------------------------------------------------------------ */
/* The Quest Map: journey view + badge shelf + dailies + streak, one calm   */
/* overlay. All quests stay unlocked (autonomy); the suggested next node    */
/* simply glows.                                                            */
/* ------------------------------------------------------------------------ */

function renderQuestMap() {
    const body = document.getElementById('questMapBody');
    if (!body || typeof ACB_TASKS === 'undefined') return;
    const done = acbReadJson('acb.done', {});
    const streak = acbReadJson('acb.streak.v2', {count: 0, freezes: 0, days: []});
    const earned = acbReadJson('acb.badges', {});
    const xp = Number(acbReadJson('acb.xp.v1', 0)) || 0;
    const activeQuest = (typeof acbTaskEngine !== 'undefined' &&
        acbTaskEngine && acbTaskEngine.task) ? acbTaskEngine.task.id : null;

    const islands = [
        {level: 'beginner', name: 'Beginner Island', emoji: '🏝️'},
        {level: 'intermediate', name: 'Logic Peaks', emoji: '⛰️'},
        {level: 'advanced', name: 'Algorithm Summit', emoji: '🏔️'},
    ];
    let suggested = null;
    for (const island of islands) {
        for (const task of ACB_TASKS.filter((t) => t.level === island.level &&
            !String(t.id).startsWith('custom-'))) {
            if (!done[task.id] && !suggested) suggested = task.id;
        }
    }

    const {state: dstate} = dailyState();
    const dailiesHtml = todaysDailies().map((d) => {
        const isDone = dstate[d.id] === 'done';
        return `<li class="map-daily ${isDone ? 'is-done' : ''}">` +
            `${isDone ? '☑' : '☐'} ${d.text}</li>`;
    }).join('');

    const islandsHtml = islands.map((island) => {
        const nodes = ACB_TASKS
            .filter((t) => t.level === island.level && !String(t.id).startsWith('custom-'))
            .map((t) => {
                const isDone = !!done[t.id];
                const isActive = t.id === activeQuest;
                const isSuggested = t.id === suggested;
                return `<button type="button" class="map-node` +
                    `${isDone ? ' is-done' : ''}${isActive ? ' is-active' : ''}` +
                    `${isSuggested ? ' is-suggested' : ''}" data-task="${t.id}">` +
                    `<span class="map-node__mark">${isDone ? '✓' : isActive ? '▶' : ''}</span>` +
                    `<span>${t.title}</span>` +
                    `<span class="map-node__xp">${t.xp} XP</span></button>`;
            }).join('');
        return `<section class="map-island"><h3>${island.emoji} ${island.name}</h3>` +
            `<div class="map-island__nodes">${nodes}</div></section>`;
    }).join('');

    const customTasks = ACB_TASKS.filter((t) => String(t.id).startsWith('custom-'));
    const customHtml = customTasks.length ?
        `<section class="map-island"><h3>✨ My challenges</h3>` +
        `<div class="map-island__nodes">` + customTasks.map((t) =>
            `<button type="button" class="map-node${done[t.id] ? ' is-done' : ''}" ` +
            `data-task="${t.id}"><span class="map-node__mark">` +
            `${done[t.id] ? '✓' : ''}</span><span>${t.title}</span>` +
            `<span class="map-node__xp">${t.xp} XP</span></button>`).join('') +
        `</div></section>` : '';

    const badgesHtml = ACB_BADGES.map((b) => {
        const has = !!earned[b.id];
        return `<div class="map-badge ${has ? 'is-earned' : ''}" ` +
            `title="${b.name}: ${b.desc}">` +
            `<span class="map-badge__emoji">${has ? b.emoji : '❔'}</span>` +
            `<span class="map-badge__name">${has ? b.name : '???'}</span></div>`;
    }).join('');

    const weekCount = (streak.days || []).length;
    body.innerHTML =
        `<div class="map-stats">` +
        `<span class="chip chip--xp">⭐ ${xp} XP</span>` +
        `<span class="chip chip--streak" title="Freezes protect your streak ` +
        `when a day is missed">🔥 ${streak.count} day streak · ` +
        `${weekCount}/7 this week · ${streak.freezes} 🧊</span></div>` +
        `<section class="map-island"><h3>☑️ Today's little quests (+10 XP each)</h3>` +
        `<ul class="map-dailies">${dailiesHtml}</ul></section>` +
        islandsHtml + customHtml +
        `<section class="map-island"><h3>🏅 Badges</h3>` +
        `<div class="map-badges">${badgesHtml}</div></section>` +
        `<section class="map-island"><h3>\u2726 Spark shop</h3>` +
        `<div id="mapShop"></div></section>`;

    body.querySelectorAll('.map-node').forEach((node) => {
        node.addEventListener('click', () => {
            const select = document.getElementById('taskSelect');
            if (!select) return;
            select.value = node.dataset.task;
            select.dispatchEvent(new Event('change'));
            closeQuestMap();
        });
    });
}

function openQuestMap() {
    const map = document.getElementById('questMap');
    if (!map) return;
    renderQuestMap();
    renderShop();
    map.hidden = false;
}
function closeQuestMap() {
    const map = document.getElementById('questMap');
    if (map) map.hidden = true;
}

/* ------------------------------------------------------------------------ */
/* Wiring                                                                    */
/* ------------------------------------------------------------------------ */

function setupJuice(workspace) {
    // Sounds toggle in settings.
    const soundsToggle = document.getElementById('soundsToggle');
    soundsToggle?.setAttribute('aria-checked', String(acbSoundsOn));
    soundsToggle?.addEventListener('click', () => {
        acbSoundsOn = !acbSoundsOn;
        try { localStorage.setItem('acb.sounds', String(acbSoundsOn)); }
        catch (e) { /* fine */ }
        soundsToggle.setAttribute('aria-checked', String(acbSoundsOn));
        if (acbSoundsOn) playChime('step');
    });

    // Map open/close.
    document.getElementById('mapChip')?.addEventListener('click', openQuestMap);
    document.getElementById('questMapClose')?.addEventListener('click', closeQuestMap);
    document.getElementById('questMap')?.addEventListener('click', (event) => {
        if (event.target === document.getElementById('questMap')) closeQuestMap();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeQuestMap();
    });

    // Streak advance (replaces the old simple streak).
    const streak = advanceStreak();
    const streakLabel = document.getElementById('streakChipLabel');
    if (streakLabel) {
        streakLabel.textContent =
            streak.count === 1 ? '1 day' : `${streak.count} days`;
    }
    const streakChip = document.getElementById('streakChip');
    if (streakChip) {
        streakChip.title = `${streak.count}-day streak · ` +
            `${(streak.days || []).length}/7 days this week · ` +
            `${streak.freezes} freeze${streak.freezes === 1 ? '' : 's'} held`;
        streakChip.hidden = false;
    }
    if (streak.usedFreezeToday) {
        setTimeout(() => showXpToast('🧊 A freeze kept your streak safe'), 2500);
    }

    // Celebration + record hooks.
    document.addEventListener('acb-task', (event) => {
        const action = event.detail?.action;
        if (action === 'step') { playChime('step'); addSparks(1); }
        if (action === 'daily') addSparks(1);
        if (action === 'complete') {
            playChime('quest');
            addSparks(5);
            celebrateConfetti();
            const finished = ACB_TASKS.find?.((t) => t.id === event.detail.taskId);
            recordQuestDone(event.detail.taskId, finished?.level);
            if (typeof acbTaskEngine !== 'undefined' && acbTaskEngine &&
                acbTaskEngine.helpCost === 0) {
                awardBadge('clean-solver');
            }
        }
        if (action === 'step' || action === 'complete') dailyProgress('step');
    });

    // Mastery badges from what actually ran.
    let lastRunFailed = false;
    document.addEventListener('acb-run-finished', () => {
        awardBadge('first-run');
        dailyProgress('run');
        const types = new Set(workspace.getAllBlocks(false).map((b) => b.type));
        const failed = typeof acbLastRunError === 'string' && !!acbLastRunError;
        if (!failed) {
            if (types.has('controls_repeat_ext') || types.has('controls_for') ||
                types.has('controls_whileUntil')) {
                awardBadge('first-loop');
                dailyProgress('run-loop');
            }
            if (types.has('controls_if')) {
                awardBadge('first-if');
                dailyProgress('run-if');
            }
            if (types.has('variables_set')) awardBadge('first-variable');
            if (types.has('procedures_callnoreturn')) awardBadge('first-function');
            if (lastRunFailed) awardBadge('self-debugger');
        }
        lastRunFailed = failed;
    });

    document.addEventListener('acb-bridge-used', () => {
        awardBadge('bridge-walker');
    });
    document.addEventListener('acb-challenge-created', () => {
        awardBadge('quest-author');
    });
    document.getElementById('codeTabButton')?.addEventListener('click',
        () => dailyProgress('code-tab'));
    for (const id of ['nowCardStuck', 'coachExplainButton',
                      'coachDebugButton', 'coachChatForm']) {
        const el = document.getElementById(id);
        el?.addEventListener(id === 'coachChatForm' ? 'submit' : 'click',
            () => dailyProgress('blox'));
    }

    paintMapChipDot();
    // Cosmetics apply on load, and again once the 3D Blox exists.
    applyCosmetics();
    setTimeout(applyCosmetics, 3500);
}


/* ------------------------------------------------------------------------ */
/* Sparks: the token economy (evidence: token-economy RCT improved ADHD     */
/* attention). Earned deterministically, spent on cosmetics in the map      */
/* shop. Never required for progress; never random.                         */
/* ------------------------------------------------------------------------ */

function sparksBalance() {
    return Number(acbReadJson('acb.sparks', 0)) || 0;
}
function addSparks(n) {
    acbWriteJson('acb.sparks', sparksBalance() + n);
}

const ACB_SHOP = [
    {id: 'blox-sky', kind: 'tint', name: 'Sky Blox', emoji: '\ud83d\udfe6',
     price: 8, value: 0x4b7be5},
    {id: 'blox-sunset', kind: 'tint', name: 'Sunset Blox', emoji: '\ud83d\udfe7',
     price: 8, value: 0xf59e2d},
    {id: 'blox-royal', kind: 'tint', name: 'Royal Blox', emoji: '\ud83d\udfea',
     price: 8, value: 0x8e6bd8},
    {id: 'accent-ocean', kind: 'accent', name: 'Ocean accent', emoji: '\ud83c\udf0a',
     price: 12, value: '#2273b8'},
    {id: 'accent-berry', kind: 'accent', name: 'Berry accent', emoji: '\ud83e\uded0',
     price: 12, value: '#a2447e'},
];

function cosmetics() {
    return acbReadJson('acb.cosmetics', {owned: [], tint: null, accent: null});
}

function applyCosmetics() {
    const c = cosmetics();
    const accentItem = ACB_SHOP.find((i) => i.id === c.accent);
    document.documentElement.style.setProperty('--acb-green',
        accentItem ? accentItem.value : '#178a5e');
    document.documentElement.style.setProperty('--acb-green-dark',
        accentItem ? accentItem.value : '#0f7a52');
    const tintItem = ACB_SHOP.find((i) => i.id === c.tint);
    if (typeof bloxSpinState !== 'undefined' && bloxSpinState) {
        bloxSpinState.model.traverse((node) => {
            if (node.material && node.material.name === 'blox_green') {
                node.material.color.setHex(tintItem ? tintItem.value : 0x008d43);
            }
        });
        bloxSpinState.renderer.render(bloxSpinState.scene, bloxSpinState.camera);
    }
}

function renderShop() {
    const holder = document.getElementById('mapShop');
    if (!holder) return;
    const c = cosmetics();
    const items = ACB_SHOP.map((item) => {
        const owned = c.owned.includes(item.id);
        const equipped = c.tint === item.id || c.accent === item.id;
        const action = !owned ? `Buy \u00b7 ${item.price} \u2726` :
            equipped ? 'Equipped \u2713' : 'Equip';
        return `<div class="map-badge is-earned shop-item">` +
            `<span class="map-badge__emoji">${item.emoji}</span>` +
            `<span class="map-badge__name">${item.name}</span>` +
            `<button type="button" class="coach-chip shop-item__buy" ` +
            `data-item="${item.id}" ${(!owned && sparksBalance() < item.price) ?
                'disabled' : ''}>${action}</button></div>`;
    }).join('');
    holder.innerHTML =
        `<p class="map-sparks">You have <strong>${sparksBalance()} \u2726 sparks</strong>` +
        ` \u00b7 earn 1 per step, 5 per quest, 1 per daily</p>` +
        `<div class="map-badges">${items}</div>`;
    holder.querySelectorAll('.shop-item__buy').forEach((button) => {
        button.addEventListener('click', () => {
            const item = ACB_SHOP.find((i) => i.id === button.dataset.item);
            const state = cosmetics();
            if (!state.owned.includes(item.id)) {
                if (sparksBalance() < item.price) return;
                addSparks(-item.price);
                state.owned.push(item.id);
                playChime('badge');
            }
            if (item.kind === 'tint') {
                state.tint = state.tint === item.id ? null : item.id;
            } else {
                state.accent = state.accent === item.id ? null : item.id;
            }
            acbWriteJson('acb.cosmetics', state);
            applyCosmetics();
            renderShop();
        });
    });
}

/* ------------------------------------------------------------------------ */
/* Confetti: a short, deterministic celebration. Fully disabled by the      */
/* minimal-motion profile and prefers-reduced-motion.                        */
/* ------------------------------------------------------------------------ */

function celebrateConfetti() {
    if (document.body.classList.contains('acb-no-motion') ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#178a5e', '#4b7be5', '#f59e2d', '#f4c430', '#8e6bd8'];
    for (let i = 0; i < 26; i++) {
        const bit = document.createElement('div');
        bit.className = 'confetti-bit';
        bit.style.left = (30 + Math.random() * 40) + 'vw';
        bit.style.background = colors[i % colors.length];
        bit.style.animationDelay = (Math.random() * 0.25) + 's';
        bit.style.setProperty('--drift', (Math.random() * 160 - 80) + 'px');
        document.body.appendChild(bit);
        setTimeout(() => bit.remove(), 1900);
    }
}

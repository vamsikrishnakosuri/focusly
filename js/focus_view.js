/**
 * @fileoverview Focus view: the learner decides what Focus Mode strips
 * away. Anything except the workspace itself can be hidden - toolbox,
 * quest bar, XP and streak chips, timer chip, coach panel, output card -
 * down to a bare canvas if that is what calm means to them. Plus Goal
 * mode: in focus, the quest bar area can carry their own written goal
 * ("what am I doing right now"), the externalized working memory that
 * survives a distraction.
 */

const ACB_FOCUS_HIDE_OPTIONS = [
    {key: 'toolbox', label: 'Block drawer (toolbox)'},
    {key: 'quest', label: 'Quest bar'},
    {key: 'chips', label: 'XP and streak chips'},
    {key: 'timer', label: 'Timer chip'},
    {key: 'coach', label: 'Blox panel'},
    {key: 'io', label: 'Output and Code card'},
];

function focusHidePrefs() {
    try {
        return JSON.parse(localStorage.getItem('acb.focusHide') || '{}');
    } catch (e) { return {}; }
}

function applyFocusView() {
    const prefs = focusHidePrefs();
    for (const option of ACB_FOCUS_HIDE_OPTIONS) {
        document.body.classList.toggle('acb-fhide-' + option.key,
            !!prefs[option.key]);
    }
    const workspace = (typeof Blockly !== 'undefined') &&
        Blockly.getMainWorkspace();
    if (workspace && typeof Blockly.svgResize === 'function') {
        setTimeout(() => Blockly.svgResize(workspace), 60);
    }
}

/* ------------------------------ Goal mode ------------------------------ */

function focusGoal() {
    try { return localStorage.getItem('acb.focusGoal') || ''; }
    catch (e) { return ''; }
}

function focusGoalChip() {
    let chip = document.getElementById('focusGoalChip');
    if (!chip) {
        chip = document.createElement('button');
        chip.id = 'focusGoalChip';
        chip.type = 'button';
        chip.className = 'focus-goal';
        chip.title = 'Your goal for this focus session - click to change';
        document.querySelector('.quest-bar')?.appendChild(chip);
        chip.addEventListener('click', () => {
            const input = document.createElement('input');
            input.id = 'focusGoalInput';
            input.className = 'focus-goal__input';
            input.maxLength = 60;
            input.value = focusGoal();
            input.placeholder = 'What is your goal right now?';
            chip.replaceWith(input);
            input.focus();
            const commit = () => {
                try {
                    localStorage.setItem('acb.focusGoal', input.value.trim());
                } catch (e) { /* fine */ }
                input.replaceWith(chip);
                focusGoalRender();
            };
            input.addEventListener('blur', commit);
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') input.blur();
                if (event.key === 'Escape') { input.value = focusGoal(); input.blur(); }
            });
        });
    }
    return chip;
}

/* ---- Micro-goals: Blox splits the goal, one tiny step at a time ------- */

function microGoals() {
    try {
        return JSON.parse(localStorage.getItem('acb.microGoals') || 'null');
    } catch (e) { return null; }
}

function saveMicroGoals(value) {
    try {
        if (value) {
            localStorage.setItem('acb.microGoals', JSON.stringify(value));
        } else {
            localStorage.removeItem('acb.microGoals');
        }
    } catch (e) { /* fine */ }
}

function microControls() {
    let done = document.getElementById('microDone');
    if (!done) {
        const bar = document.querySelector('.quest-bar');
        done = document.createElement('button');
        done.id = 'microDone';
        done.type = 'button';
        done.className = 'coach-chip micro-done';
        done.textContent = '✓';
        done.title = 'This micro-goal is done - show the next one';
        bar?.appendChild(done);
        done.addEventListener('click', () => {
            const micro = microGoals();
            if (!micro) return;
            micro.index += 1;
            if (micro.index >= micro.steps.length) {
                saveMicroGoals(null);
                if (typeof playChime === 'function') playChime('quest');
                if (typeof celebrateConfetti === 'function') {
                    celebrateConfetti();
                }
                coachSay(`🎉 "${micro.goal}" - done, micro-step by ` +
                    'micro-step. That is how big things get built.');
            } else {
                saveMicroGoals(micro);
                if (typeof playChime === 'function') playChime('step');
            }
            focusGoalRender();
        });
        const quit = document.createElement('button');
        quit.id = 'microQuit';
        quit.type = 'button';
        quit.className = 'coach-chip micro-quit';
        quit.textContent = '✕';
        quit.title = 'Drop the micro-goals, keep the goal';
        bar?.appendChild(quit);
        quit.addEventListener('click', () => {
            saveMicroGoals(null);
            focusGoalRender();
        });
    }
    return {done, quit: document.getElementById('microQuit')};
}

function focusGoalHelpChip() {
    let help = document.getElementById('focusGoalHelp');
    if (!help) {
        help = document.createElement('button');
        help.id = 'focusGoalHelp';
        help.type = 'button';
        help.className = 'coach-chip focus-goal__help';
        help.textContent = '✨ Want help?';
        help.title = 'Blox can split your goal into tiny micro-goals';
        document.querySelector('.quest-bar')?.appendChild(help);
        help.addEventListener('click', openGoalHelpPop);
    }
    return help;
}

function closeGoalHelpPop() {
    document.getElementById('goalHelpPop')?.remove();
}

function openGoalHelpPop() {
    closeGoalHelpPop();
    const pop = document.createElement('div');
    pop.id = 'goalHelpPop';
    pop.className = 'goal-help-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Micro-goal help');
    pop.innerHTML =
        '<p class="goal-help-pop__text">Blox can split this goal into ' +
        'tiny micro-goals - a small first step beats a big wall. Use ' +
        'the AI for this?</p>' +
        '<div class="goal-help-pop__actions">' +
        '<button id="goalHelpYes" class="now-card__button ' +
        'now-card__button--primary" type="button">Yes, split it</button>' +
        '<button id="goalHelpNo" class="coach-chip" type="button">' +
        'No thanks</button></div>';
    const bar = document.querySelector('.quest-bar');
    document.body.appendChild(pop);
    const rect = bar.getBoundingClientRect();
    pop.style.left = `${rect.left + 40}px`;
    pop.style.top = `${rect.bottom + 8}px`;
    document.getElementById('goalHelpNo').addEventListener('click',
        closeGoalHelpPop);
    document.getElementById('goalHelpYes').addEventListener('click',
        requestMicroGoals);
    setTimeout(() => document.addEventListener('pointerdown',
        goalHelpOutside, true), 0);
}

function goalHelpOutside(event) {
    const pop = document.getElementById('goalHelpPop');
    if (pop && !pop.contains(event.target)) {
        closeGoalHelpPop();
        document.removeEventListener('pointerdown', goalHelpOutside, true);
    }
}

async function requestMicroGoals() {
    const yes = document.getElementById('goalHelpYes');
    const goal = focusGoal();
    if (!yes || !goal) return;
    yes.disabled = true;
    yes.textContent = 'Blox is thinking…';
    if (typeof bloxSpinStart === 'function') bloxSpinStart();
    try {
        const server = (typeof ACB_COACH_SERVER !== 'undefined') ?
            ACB_COACH_SERVER : window.FOCUSLY_COACH_URL;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60000);
        const response = await fetch(`${server}/author`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({level: 'beginner', topic: goal}),
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`server said ${response.status}`);
        const {task} = await response.json();
        const steps = (task.steps || []).map((s) => s.text)
            .filter(Boolean).slice(0, 5);
        if (!steps.length) throw new Error('no steps came back');
        saveMicroGoals({goal, steps, index: 0});
        closeGoalHelpPop();
        coachSay('Here is your goal in tiny pieces - just the one in the ' +
            'bar for now. Tap ✓ when a piece is done and the next appears.');
    } catch (e) {
        const text = document.querySelector('.goal-help-pop__text');
        if (text) {
            text.textContent = 'Blox could not reach his thinking server ' +
                'just now. Your goal is safe; try the split again in a ' +
                'minute.';
        }
        if (yes) { yes.disabled = false; yes.textContent = 'Try again'; }
    } finally {
        if (typeof bloxSpinStop === 'function') bloxSpinStop();
        focusGoalRender();
    }
}

function focusGoalRender() {
    // Never leave a stale editor behind (e.g. focus mode toggled off
    // while the goal input was open).
    const stray = document.getElementById('focusGoalInput');
    if (stray && !document.getElementById('focusGoalChip')) stray.remove();
    const chip = focusGoalChip();
    const help = focusGoalHelpChip();
    const {done, quit} = microControls();
    const inFocus = document.body.classList.contains('acb-focus-mode');
    const goal = focusGoal();
    const micro = microGoals();
    const microActive = inFocus && micro && micro.goal === goal &&
        micro.index < micro.steps.length;
    chip.hidden = !inFocus;
    help.hidden = !inFocus || !goal || !!microActive;
    done.hidden = !microActive;
    if (quit) quit.hidden = !microActive;
    if (!inFocus) { closeGoalHelpPop(); return; }
    if (microActive) {
        chip.textContent = `🎯 ${micro.index + 1}/${micro.steps.length}: ` +
            micro.steps[micro.index];
        chip.classList.remove('is-empty');
    } else {
        chip.textContent = goal ? `🎯 ${goal}` : '🎯 Set a goal…';
        chip.classList.toggle('is-empty', !goal);
    }
}

/* -------------------------------- setup -------------------------------- */

function setupFocusView() {
    // Collapsed by default: one row in settings opens the checklist.
    const toggle = document.getElementById('focusViewToggle');
    const list = document.getElementById('focusViewList');
    toggle?.addEventListener('click', () => {
        list.hidden = !list.hidden;
        toggle.setAttribute('aria-expanded', String(!list.hidden));
    });
    if (list) {
        const prefs = focusHidePrefs();
        for (const option of ACB_FOCUS_HIDE_OPTIONS) {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'settings-item';
            item.setAttribute('role', 'menuitemcheckbox');
            item.setAttribute('aria-checked', String(!!prefs[option.key]));
            item.innerHTML = `<span class="focus-view__mark">` +
                `${prefs[option.key] ? '☑' : '☐'}</span> ${option.label}`;
            item.addEventListener('click', () => {
                const now = focusHidePrefs();
                now[option.key] = !now[option.key];
                try {
                    localStorage.setItem('acb.focusHide',
                        JSON.stringify(now));
                } catch (e) { /* fine */ }
                item.setAttribute('aria-checked', String(!!now[option.key]));
                item.querySelector('.focus-view__mark').textContent =
                    now[option.key] ? '☑' : '☐';
                applyFocusView();
            });
            list.appendChild(item);
        }
    }
    applyFocusView();
    focusGoalRender();
    // Focus mode toggling re-applies the hides and the goal chip.
    document.addEventListener('acb-focus-mode-change', () => {
        applyFocusView();
        focusGoalRender();
    });
}

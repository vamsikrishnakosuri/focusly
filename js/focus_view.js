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

function focusGoalRender() {
    const chip = focusGoalChip();
    const inFocus = document.body.classList.contains('acb-focus-mode');
    chip.hidden = !inFocus;
    if (inFocus) {
        const goal = focusGoal();
        chip.textContent = goal ? `🎯 ${goal}` : '🎯 Set a goal…';
        chip.classList.toggle('is-empty', !goal);
    }
}

/* -------------------------------- setup -------------------------------- */

function setupFocusView() {
    // Checklist in the settings menu, under its own heading.
    const list = document.getElementById('focusViewList');
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

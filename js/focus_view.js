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

/**
 * A goal Blox can actually split is concrete: "print 1 to 5", "build a
 * countdown". "not sure", "idk", "help" are feelings, not goals - splitting
 * them would produce confident nonsense, so Blox asks for substance first.
 */
function goalTooVague(goal) {
    const text = String(goal || '').trim().toLowerCase();
    if (text.replace(/[^a-z]/g, '').length < 6) return true;
    return /^(not sure|notsure|no idea|idk|i don'?t know|dont know|help|help me|nothing|anything|something|whatever|test|asdf+|hmm+|\?+)\b/
        .test(text);
}

async function splitGoalViaBlox() {
    const goal = focusGoal();
    if (!goal) {
        coachSay('Set a goal in the top bar first (turn on Focus mode), ' +
            'then I will slice it small for you.');
        return;
    }
    if (goalTooVague(goal)) {
        coachSay(`"${goal}" is a feeling, not a goal yet - I would only ` +
            'split it into confident nonsense. Tell me what you want to ' +
            'build, even roughly ("print my name 3 times"), and I will ' +
            'slice it small.');
        return;
    }
    let aiAllowed = true;
    try { aiAllowed = localStorage.getItem('acb.aiCoach') !== 'false'; }
    catch (e) { /* fine */ }
    if (!aiAllowed) {
        coachSay('You have my AI switched off, so I will not split ' +
            'anything. Turn it on in the settings if you change your mind.');
        return;
    }
    coachThinking('Slicing your goal into tiny pieces…');
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
        if (!response.ok) {
            const err = new Error(`server said ${response.status}`);
            err.status = response.status;
            throw err;
        }
        const {task} = await response.json();
        const steps = (task.steps || []).map((s) => s.text)
            .filter(Boolean).slice(0, 5);
        if (!steps.length) throw new Error('no steps came back');
        saveMicroGoals({goal, steps, index: 0});
        coachSay('Here is your goal in tiny pieces - just the one in the ' +
            'bar for now. Tap ✓ when a piece is done and the next appears.');
    } catch (e) {
        if (e.status === 429) {
            coachSay('I have split a lot this hour and the splitter is ' +
                'taking a breather. Your goal is safe - try again in a ' +
                'while, or split it yourself: what is the smallest ' +
                'first piece?');
        } else if (e.status >= 400 && e.status < 600) {
            coachSay('I could not slice that one into coding steps - ' +
                'phrase it as something to build ("print my name 3 ' +
                'times") and I will try again.');
        } else {
            coachSay('I could not reach my thinking server just now. ' +
                'Your goal is safe; try the split again in a minute.');
        }
    } finally {
        if (typeof bloxSpinStop === 'function') bloxSpinStop();
        focusGoalRender();
    }
}

/* ---- Goal quote: a calm line matched to what the goal is about -------- */

const ACB_GOAL_QUOTES = {
    study: [
        'One page at a time is still reading.',
        'Understanding grows in quiet minutes like this one.',
        'Study is just curiosity with a chair.',
    ],
    finish: [
        'Done is a direction, not a leap.',
        'The last mile is shorter than it looks.',
        'Finishing is a series of small keeps-going.',
    ],
    build: [
        'Every program is small pieces, kindly arranged.',
        'Build the tiny version first. It teaches you the big one.',
        'Blocks click together one at a time. So does progress.',
    ],
    calm: [
        'Begin small. Momentum does the rest.',
        'The next small step is enough.',
        'Slow is smooth, and smooth is fast.',
    ],
};

function goalQuoteFor(goal) {
    const text = String(goal || '').toLowerCase();
    const bucket =
        /homework|study|assignment|read|exam|class|essay|paper|revis/
            .test(text) ? 'study' :
        /finish|complete|submit|done|due|wrap/
            .test(text) ? 'finish' :
        /build|make|create|code|program|print|loop|block|variable|game|list/
            .test(text) ? 'build' : 'calm';
    const lines = ACB_GOAL_QUOTES[bucket];
    let hash = 0;
    for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
    return lines[hash % lines.length];
}

function goalQuoteEl() {
    let quote = document.getElementById('goalQuote');
    if (!quote) {
        quote = document.createElement('div');
        quote.id = 'goalQuote';
        quote.className = 'goal-quote';
        document.body.appendChild(quote);
    }
    return quote;
}

function focusGoalRender() {
    // Never leave a stale editor behind (e.g. focus mode toggled off
    // while the goal input was open).
    const stray = document.getElementById('focusGoalInput');
    if (stray && !document.getElementById('focusGoalChip')) stray.remove();
    const chip = focusGoalChip();
    const {done, quit} = microControls();
    const inFocus = document.body.classList.contains('acb-focus-mode');
    const goal = focusGoal();
    const micro = microGoals();
    const microActive = inFocus && micro && micro.goal === goal &&
        micro.index < micro.steps.length;
    chip.hidden = !inFocus;
    done.hidden = !microActive;
    if (quit) quit.hidden = !microActive;
    // Blox's own split chip lives in his panel: present exactly when he is.
    const splitChip = document.getElementById('coachSplitGoal');
    if (splitChip) splitChip.hidden = !inFocus || !goal || !!microActive;
    // The quote: calm, matched to the goal, living INSIDE the app bar
    // (between the goal and the countdown) so it can never straddle the
    // workspace at any window size.
    const quote = goalQuoteEl();
    if (inFocus && goal) {
        quote.textContent = goalQuoteFor(goal);
        const bar = document.querySelector('.app-bar');
        if (bar && quote.parentElement !== bar) {
            const anchor = document.getElementById('bigTimer');
            bar.insertBefore(quote,
                (anchor && anchor.parentElement === bar) ?
                    anchor : document.querySelector('.app-bar__status'));
        }
        quote.hidden = false;
    } else {
        quote.hidden = true;
    }
    if (!inFocus) return;
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
    document.getElementById('coachSplitGoal')?.addEventListener('click',
        splitGoalViaBlox);
    document.addEventListener('acb-focus-mode-change', () => {
        applyFocusView();
        focusGoalRender();
    });
}

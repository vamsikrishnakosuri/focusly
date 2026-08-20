/**
 * @fileoverview Walk me through it: Blox explains the learner's own program
 * block by block. Each block glows in the workspace while Blox describes it
 * in plain words, top to bottom, at the learner's own pace (Next) or gently
 * automatic (Auto). With several separate stacks Blox first asks which one -
 * or walks all of them in order and then sums up what the whole program does.
 *
 * Static explanation of structure; the stepper (stepper.js) is the live
 * companion that actually executes block by block.
 */

let acbWalk = null;   // {steps: [{id, depth, text}], index, autoTimer}

/** Statement-level traversal: block, its inner stacks, then its next. */
function walkOrder(block, depth, out) {
    while (block) {
        out.push({block, depth});
        for (const input of block.inputList) {
            const isStatement = input.connection &&
                input.connection.type === Blockly.ConnectionType.NEXT_STATEMENT;
            const child = isStatement && input.connection.targetBlock();
            if (child) walkOrder(child, depth + 1, out);
        }
        block = block.nextConnection && block.nextConnection.targetBlock();
    }
    return out;
}

/** One plain-words line for a block: what it says + what that means. */
function walkText(entry) {
    const block = entry.block;
    let label = '';
    try { label = block.toString(); } catch (e) { /* fine */ }
    if (label.length > 70) label = label.slice(0, 67) + '...';
    const catalog = (typeof ACB_BLOCK_EXPLANATIONS !== 'undefined' &&
        ACB_BLOCK_EXPLANATIONS[block.type]) || '';
    // First sentence only: a walkthrough line should stay glanceable.
    const firstSentence = catalog.split(/(?<=\.)\s/)[0] || '';
    const inside = entry.depth > 0 ? 'Inside that: ' : '';
    return `${inside}"${label}". ${firstSentence}`.trim();
}

function walkChipsRow() {
    let row = document.getElementById('coachWalkChips');
    if (!row) {
        row = document.createElement('div');
        row.id = 'coachWalkChips';
        row.className = 'coach-card__actions';
        const message = document.getElementById('coachMessage');
        message?.parentNode?.insertBefore(row, message.nextSibling);
    }
    return row;
}

function walkStop(workspace) {
    if (acbWalk) {
        clearInterval(acbWalk.autoTimer);
        acbWalk.bubble?.remove();
    }
    acbWalk = null;
    document.removeEventListener('keydown', walkEscape, true);
    try { workspace.highlightBlock(null); } catch (e) { /* fine */ }
    const row = document.getElementById('coachWalkChips');
    if (row) { row.innerHTML = ''; row.hidden = true; }
}

function walkEscape(event) {
    if (event.key === 'Escape' && acbWalk) {
        walkStop(Blockly.getMainWorkspace());
    }
}

/**
 * The tour bubble: Blox's explanation anchored to the glowing block itself,
 * with the tour controls inside it, so eyes never leave the workspace.
 */
function walkBubble(workspace, block, counter, text) {
    acbWalk.bubble?.remove();
    const el = document.createElement('div');
    el.className = 'block-callout block-callout--walk';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Blox walks you through this block');
    el.innerHTML =
        '<div class="block-callout__head">' +
            `<strong class="block-callout__title"></strong>` +
            '<span class="walk-bubble__count"></span>' +
        '</div>' +
        '<p class="block-callout__text"></p>' +
        '<div class="block-callout__actions walk-bubble__actions">' +
            '<button class="coach-chip" data-walk="next" type="button">' +
                'Next ▶</button>' +
            '<button class="coach-chip" data-walk="auto" type="button">' +
                '⏩ Auto</button>' +
            '<button class="coach-chip" data-walk="done" type="button">' +
                'Done</button>' +
        '</div>';
    el.querySelector('.block-callout__title').textContent = 'Blox';
    el.querySelector('.walk-bubble__count').textContent = counter;
    el.querySelector('.block-callout__text').textContent = text;
    el.querySelector('[data-walk="next"]').addEventListener('click',
        () => walkAdvance(workspace));
    el.querySelector('[data-walk="done"]').addEventListener('click',
        () => { walkStop(workspace); coachSay('Anytime. I am here.'); });
    el.querySelector('[data-walk="auto"]').addEventListener('click',
        (event) => {
            if (!acbWalk) return;
            if (acbWalk.autoTimer) {
                clearInterval(acbWalk.autoTimer);
                acbWalk.autoTimer = null;
                event.currentTarget.textContent = '⏩ Auto';
                return;
            }
            event.currentTarget.textContent = '⏸ Pause';
            acbWalk.autoTimer = setInterval(
                () => walkAdvance(workspace), 3400);
        });
    if (acbWalk.autoTimer) {
        el.querySelector('[data-walk="auto"]').textContent = '⏸ Pause';
    }
    document.body.appendChild(el);
    // Anchor beside the block, exactly like the What-is-this bubble.
    const rect = block.getSvgRoot().getBoundingClientRect();
    const w = el.offsetWidth || 280;
    const h = el.offsetHeight || 120;
    let left = rect.right + 16;
    let top = rect.top + rect.height / 2 - 24;
    if (left + w > window.innerWidth - 12) {
        left = Math.max(12, Math.min(rect.left, window.innerWidth - w - 12));
        top = rect.bottom + 14;
        el.classList.add('block-callout--below');
    }
    top = Math.max(12, Math.min(top, window.innerHeight - h - 12));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    acbWalk.bubble = el;
}

function walkShowCurrent(workspace) {
    const walk = acbWalk;
    if (!walk) return false;
    if (walk.index >= walk.steps.length) {
        walkFinish(workspace);
        return false;
    }
    const step = walk.steps[walk.index];
    try { workspace.highlightBlock(step.block.id); } catch (e) { /* fine */ }
    // Bring an off-screen block into view before anchoring the bubble.
    try {
        const view = workspace.getParentSvg().getBoundingClientRect();
        const rect = step.block.getSvgRoot().getBoundingClientRect();
        if (rect.top < view.top || rect.bottom > view.bottom ||
            rect.left < view.left || rect.right > view.right) {
            workspace.centerOnBlock(step.block.id);
        }
    } catch (e) { /* anchoring still works, roughly */ }
    const counter = `${walk.index + 1} of ${walk.steps.length}`;
    setTimeout(() => {
        if (acbWalk === walk && walk.index < walk.steps.length) {
            walkBubble(workspace, step.block, counter, step.text);
        }
    }, 60);
    if (typeof acbMaybeSpeakCoach === 'function') {
        acbMaybeSpeakCoach(step.text);
    }
    return true;
}

async function walkFinish(workspace) {
    const wasAll = acbWalk && acbWalk.all;
    walkStop(workspace);
    if (!wasAll) {
        coachSay('That is the whole stack, top to bottom. Want the live ' +
            'version? The Step through button under Output runs it for real, ' +
            'one block at a time.');
        return;
    }
    // Walked everything: sum up what the program does, Blox-style.
    coachThinking('Putting the whole picture together…');
    const ai = await aiCoach('chat', {question:
        'In two short sentences, what does my whole program do, top to bottom?'});
    coachSay((ai && ai.text) ||
        'That is every stack, in the order they sit. Each stack runs on its ' +
        'own; Run executes them all.');
}

function walkAdvance(workspace) {
    if (!acbWalk) return;
    acbWalk.index++;
    walkShowCurrent(workspace);
}

function walkBegin(workspace, tops, all) {
    walkStop(workspace);
    if (typeof stepperCleanup === 'function') stepperCleanup(workspace);
    const steps = [];
    for (const top of tops) walkOrder(top, 0, steps);
    for (const s of steps) s.text = walkText(s);
    acbWalk = {steps, index: 0, autoTimer: null, all, bubble: null};
    const row = document.getElementById('coachWalkChips');
    if (row) { row.innerHTML = ''; row.hidden = true; }
    document.addEventListener('keydown', walkEscape, true);
    coachSay('Follow me on the canvas - I will explain each block where ' +
        'it lives. Esc ends the tour anytime.');
    walkShowCurrent(workspace);
}

function walkStart(workspace) {
    const tops = workspace.getTopBlocks(true)
        .filter((b) => b.isEnabled ? b.isEnabled() : true);
    if (!tops.length) {
        coachSay('Nothing to walk through yet - drag a few blocks in first.');
        return;
    }
    if (tops.length === 1) {
        walkBegin(workspace, tops, false);
        return;
    }
    // Several stacks: ask which one, using each stack's first block as its name.
    coachSay(`You have ${tops.length} separate stacks. Which one should I ` +
        'walk you through?');
    const row = walkChipsRow();
    row.hidden = false;
    row.innerHTML = '';
    tops.forEach((top, i) => {
        const chip = document.createElement('button');
        chip.className = 'coach-chip';
        chip.type = 'button';
        let name = '';
        try { name = top.toString(); } catch (e) { /* fine */ }
        if (name.length > 24) name = name.slice(0, 21) + '...';
        chip.textContent = `Stack ${i + 1}: ${name}`;
        chip.addEventListener('click', () => walkBegin(workspace, [top], false));
        row.appendChild(chip);
    });
    const allChip = document.createElement('button');
    allChip.className = 'coach-chip';
    allChip.type = 'button';
    allChip.textContent = 'All of them';
    allChip.addEventListener('click', () => walkBegin(workspace, tops, true));
    row.appendChild(allChip);
}

function setupWalkthrough(workspace) {
    document.getElementById('coachWalkButton')?.addEventListener('click',
        () => walkStart(workspace));
    // Editing the blocks mid-walk would desync the tour: end it quietly.
    workspace.addChangeListener((event) => {
        if (acbWalk && event && !event.isUiEvent &&
            event.type !== 'toolbox_item_select') {
            walkStop(workspace);
        }
    });
}

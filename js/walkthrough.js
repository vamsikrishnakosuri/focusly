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
    if (acbWalk) clearInterval(acbWalk.autoTimer);
    acbWalk = null;
    try { workspace.highlightBlock(null); } catch (e) { /* fine */ }
    const row = document.getElementById('coachWalkChips');
    if (row) { row.innerHTML = ''; row.hidden = true; }
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
    const count = `(${walk.index + 1} of ${walk.steps.length}) `;
    coachSay(count + step.text);
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
    acbWalk = {steps, index: 0, autoTimer: null, all};

    const row = walkChipsRow();
    row.hidden = false;
    row.innerHTML =
        '<button id="walkNext" class="coach-chip" type="button">Next &#9654;</button>' +
        '<button id="walkAuto" class="coach-chip" type="button">&#9193; Auto</button>' +
        '<button id="walkStopBtn" class="coach-chip" type="button">Done</button>';
    document.getElementById('walkNext').addEventListener('click',
        () => walkAdvance(workspace));
    document.getElementById('walkAuto').addEventListener('click', () => {
        if (!acbWalk) return;
        if (acbWalk.autoTimer) {
            clearInterval(acbWalk.autoTimer);
            acbWalk.autoTimer = null;
            document.getElementById('walkAuto').textContent = '⏩ Auto';
            return;
        }
        document.getElementById('walkAuto').textContent = '⏸ Pause';
        acbWalk.autoTimer = setInterval(() => walkAdvance(workspace), 3200);
    });
    document.getElementById('walkStopBtn').addEventListener('click',
        () => { walkStop(workspace); coachSay('Anytime. I am here.'); });

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

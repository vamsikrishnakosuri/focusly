/**
 * @fileoverview Refactoring helper: the duplicate-stack detector. When two
 * separate stacks are exact copies of each other (same blocks, same fields,
 * ignoring position), Blox points it out once, gently - the earliest, most
 * concrete version of "don't repeat yourself" a learner can meet. The two
 * stacks glow briefly so "these two" needs no explaining.
 *
 * One tip per distinct duplicate per session, never while a quest check,
 * walkthrough, or stepper session is mid-flight.
 */

let acbRefactorTimer = null;
const acbRefactorShown = new Set();

/** Structure-only signature: block types + fields, no ids, no coordinates. */
function stackSignature(block) {
    try {
        const state = Blockly.serialization.blocks.save(block,
            {addCoordinates: false, saveIds: false});
        return JSON.stringify(state, (key, value) =>
            (key === 'id' || key === 'x' || key === 'y') ? undefined : value);
    } catch (e) {
        return null;
    }
}

function findDuplicateStacks(workspace) {
    const seen = new Map();
    for (const top of workspace.getTopBlocks(false)) {
        // Only meaningful stacks: at least 2 blocks in the chain.
        let length = 0;
        for (let b = top; b; b = b.getNextBlock && b.getNextBlock()) length++;
        if (length < 2 && top.getChildren(false).length === 0) continue;
        const signature = stackSignature(top);
        if (!signature) continue;
        if (seen.has(signature)) return {a: seen.get(signature), b: top, signature};
        seen.set(signature, top);
    }
    return null;
}

function refactorCheck(workspace) {
    if (typeof acbStepSession !== 'undefined' && acbStepSession) return;
    if (typeof acbWalk !== 'undefined' && acbWalk) return;
    const dup = findDuplicateStacks(workspace);
    if (!dup || acbRefactorShown.has(dup.signature)) return;
    acbRefactorShown.add(dup.signature);
    for (const block of [dup.a, dup.b]) {
        try {
            const svg = block.getSvgRoot();
            svg.classList.add('acb-block-glow');
            setTimeout(() => svg.classList.remove('acb-block-glow'), 3500);
        } catch (e) { /* fine */ }
    }
    coachSay('Those two glowing stacks are identical twins. Programmers ' +
        'avoid building the same thing twice: you could keep just one, or ' +
        'wrap it in a function from the Functions drawer and reuse it by name.');
}

function setupRefactor(workspace) {
    workspace.addChangeListener((event) => {
        if (!event || event.isUiEvent) return;
        if (typeof acbReplay !== 'undefined' && acbReplay) return;
        clearTimeout(acbRefactorTimer);
        acbRefactorTimer = setTimeout(() => refactorCheck(workspace), 1500);
    });
}

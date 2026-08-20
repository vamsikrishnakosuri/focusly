/**
 * @fileoverview "What is this?" - right-click any block and Blox answers in
 * a speech bubble pointing at that very block, instead of Blockly's stock
 * Help item that ejects the learner to an external page. Layers:
 *
 *   1. Instantly: the local teaching-grade explanation (offline, 0ms).
 *   2. A beat later: Blox's live AI explanation replaces it (sparkle-marked).
 *   3. "Tell me more": the block's own guide - the RIGHT one. Blockly's
 *      stock helpUrls send half the blocks to Wikipedia (math_arithmetic ->
 *      wikipedia.org/wiki/Arithmetic) because the official block wiki has no
 *      Math or Functions pages at all. So ACB_HELP_MAP curates, per block,
 *      the exact wiki page AND section; that section's text and pictures
 *      render inside the bubble, with a link to the same spot underneath.
 *      Blocks with no wiki page anywhere get Blox's own deeper text and no
 *      misleading external link.
 */

let acbCallout = null;   // {el, blockId}

/**
 * Per-block guide locations on the Blockly block wiki (the
 * RaspberryPiFoundation fork, per Vamsi's request; identical pages and
 * section slugs to google/blockly's, verified against the real headings).
 * Pages that do not exist on either wiki (Math, Functions - see the wiki's
 * own Home index) are deliberately absent; those blocks use ACB_DEEP_LOCAL
 * below instead.
 */
const ACB_HELP_MAP = {
    controls_if: {page: 'IfElse'},
    logic_compare: {page: 'Logic', anchor: 'comparisons'},
    logic_operation: {page: 'Logic', anchor: 'logical-operations'},
    logic_negate: {page: 'Logic', anchor: 'not'},
    logic_boolean: {page: 'Logic', anchor: 'values'},
    logic_ternary: {page: 'Logic', anchor: 'ternary-operator'},
    logic_null: {page: 'Logic', anchor: 'values'},
    controls_repeat_ext: {page: 'Loops', anchor: 'repeat'},
    controls_whileUntil: {page: 'Loops', anchor: 'repeat-while'},
    controls_for: {page: 'Loops', anchor: 'count-with'},
    controls_forEach: {page: 'Loops', anchor: 'for-each'},
    controls_flow_statements:
        {page: 'Loops', anchor: 'loop-termination-blocks'},
    text: {page: 'Text', anchor: 'text-creation'},
    text_join: {page: 'Text', anchor: 'text-creation'},
    text_append: {page: 'Text', anchor: 'text-modification'},
    text_length: {page: 'Text', anchor: 'text-length'},
    text_isEmpty: {page: 'Text', anchor: 'checking-for-empty-text'},
    text_indexOf: {page: 'Text', anchor: 'finding-text'},
    text_charAt: {page: 'Text', anchor: 'extracting-a-single-character'},
    text_getSubstring: {page: 'Text', anchor: 'extracting-a-region-of-text'},
    text_changeCase: {page: 'Text', anchor: 'adjusting-text-case'},
    text_trim: {page: 'Text', anchor: 'trimming-removing-spaces'},
    text_count: {page: 'Text', anchor: 'counting-substrings'},
    text_replace: {page: 'Text', anchor: 'replacing-substrings'},
    text_reverse: {page: 'Text', anchor: 'reversing-text'},
    text_print: {page: 'Text', anchor: 'printing-text'},
    text_prompt_ext: {page: 'Text', anchor: 'getting-input-from-the-user'},
    lists_create_with: {page: 'Lists', anchor: 'create-list-with'},
    lists_repeat: {page: 'Lists', anchor: 'create-list-with'},
    lists_length: {page: 'Lists', anchor: 'length-of'},
    lists_isEmpty: {page: 'Lists', anchor: 'is-empty'},
    lists_indexOf: {page: 'Lists', anchor: 'finding-items-in-a-list'},
    lists_getIndex: {page: 'Lists', anchor: 'getting-items-from-a-list'},
    lists_setIndex: {page: 'Lists', anchor: 'in-list-set'},
    lists_getSublist: {page: 'Lists', anchor: 'getting-a-sublist'},
    lists_split:
        {page: 'Lists', anchor: 'splitting-strings-and-joining-lists'},
    lists_sort: {page: 'Lists'},
    lists_reverse: {page: 'Lists', anchor: 'reversing-a-list'},
    variables_get: {page: 'Variables', anchor: 'get'},
    variables_set: {page: 'Variables', anchor: 'set'},
    math_change: {page: 'Variables', anchor: 'change'},
};

/**
 * Deeper local explanations for blocks the wiki does not cover (no Math or
 * Functions pages exist). Written in Blox's voice: what, when, tiny example.
 */
const ACB_DEEP_LOCAL = {
    math_number: 'A number block is a plain value: 5, 0, -3, 2.5 all work. ' +
        'On its own it does nothing; snap it into a slot - repeat 5 times, ' +
        'set count to 0 - and it feeds that block its value.',
    math_arithmetic: 'Pick the operation from the dropdown: + adds, - ' +
        'subtracts, × multiplies, ÷ divides, ^ raises to a power. Example: ' +
        'put 7 and 3 in the slots with × and the block hands over 21. You ' +
        'can nest them: (2 + 3) × 4 is an arithmetic block inside another.',
    math_single: 'One-input math: square root, absolute value, negate, ln, ' +
        'log10, e^ and 10^. Example: square root of 25 hands over 5. ' +
        'Absolute value turns -8 into 8.',
    math_trig: 'The triangle functions: sin, cos, tan and their inverses, ' +
        'working in degrees. Example: sin of 30 hands over 0.5. Mostly ' +
        'useful for angles, circles, and waves.',
    math_atan2: 'Gives the angle (in degrees) of the line from (0,0) to ' +
        'the point (X, Y). Example: atan2 of X=1, Y=1 is 45. Handy for ' +
        '"which direction is that point?"',
    math_constant: 'Famous numbers, ready-made: π (3.14159…), e (2.718…), ' +
        'φ the golden ratio, √2, √½, and infinity. Use π with arithmetic ' +
        'blocks for anything involving circles.',
    math_number_property: 'A yes/no test on a number: is it even, odd, ' +
        'prime, whole, positive, negative, or divisible by another number? ' +
        'Example: "is 7 prime" hands over true. Snap it where a condition ' +
        'goes, like inside an if block.',
    math_round: 'Rounds a decimal to a whole number: round 3.4 gives 3, ' +
        'round 3.5 gives 4. Round up always climbs (3.1 becomes 4); round ' +
        'down always drops (3.9 becomes 3).',
    math_on_list: 'Takes a whole list of numbers and gives one summary: ' +
        'sum, minimum, maximum, average, median, modes, standard deviation, ' +
        'or a random item. Example: sum of the list 1, 2, 3 hands over 6.',
    math_modulo: 'The remainder after dividing. 10 ÷ 3 is 3 remainder 1, ' +
        'so "remainder of 10 ÷ 3" hands over 1. Classic use: a number is ' +
        'even when remainder of it ÷ 2 equals 0.',
    math_constrain: 'Keeps a number inside a range. Constrain 150 between ' +
        '1 and 100 hands over 100; constrain -5 the same way hands over 1. ' +
        'Useful to stop a value running away.',
    math_random_int: 'A surprise whole number between your low and high, ' +
        'both included. Random integer from 1 to 6 is a dice roll. Run it ' +
        'again and you will likely get a different result.',
    math_random_float: 'A surprise decimal between 0 and 1, like 0.7231. ' +
        'Multiply it to scale it up: random fraction × 100 gives a random ' +
        'value from 0 up to 100.',
    procedures_defnoreturn: 'This defines a function: a named bundle of ' +
        'blocks you can run by name, as many times as you like. Build the ' +
        'steps once inside it, then use its call block wherever needed. ' +
        'If you would otherwise copy a stack twice, wrap it here instead.',
    procedures_defreturn: 'A function that hands a value back. The blocks ' +
        'inside do the work; whatever sits in the return slot is the ' +
        'answer the call block delivers. Example: a "double" function ' +
        'that returns its input × 2.',
    procedures_callnoreturn: 'Runs your function: one block that stands ' +
        'for the whole bundle of steps you defined. Change the definition ' +
        'once and every call updates with it.',
    procedures_callreturn: 'Runs your function and hands over its returned ' +
        'value - snap it anywhere a value fits, like into a print block ' +
        'or a variable.',
    procedures_ifreturn: 'An early exit for functions: if the condition is ' +
        'true, stop here and (optionally) return this value, skipping the ' +
        'rest of the function.',
};

function calloutClose() {
    if (!acbCallout) return;
    acbCallout.el.remove();
    acbCallout = null;
    document.removeEventListener('pointerdown', calloutOutside, true);
    document.removeEventListener('keydown', calloutEsc, true);
}

function calloutOutside(event) {
    if (acbCallout && !acbCallout.el.contains(event.target)) calloutClose();
}

function calloutEsc(event) {
    if (event.key === 'Escape') calloutClose();
}

/** GitHub's heading -> anchor slug rule (close enough for these pages). */
function calloutSlug(heading) {
    return heading.toLowerCase().replace(/[^\w\s-]/g, '').trim()
        .replace(/\s+/g, '-');
}

/**
 * Cuts the markdown down to just the mapped section: from the heading whose
 * slug matches `anchor` to the next heading of the same or higher level, so
 * sub-sections stay included. No anchor (or no match) keeps the whole page.
 */
function calloutSection(md, anchor) {
    if (!anchor) return md;
    const lines = md.split('\n');
    let start = -1;
    let level = 0;
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^(#+)\s*(.+)$/);
        if (!m) continue;
        if (start < 0) {
            if (calloutSlug(m[2]) === anchor) {
                start = i;
                level = m[1].length;
            }
        } else if (m[1].length <= level) {
            return lines.slice(start, i).join('\n');
        }
    }
    return start >= 0 ? lines.slice(start).join('\n') : md;
}

/** Fetches a wiki page and returns {text, images} for one section. */
async function fetchWikiDetails(page, anchor) {
    try {
        const base =
            'https://raw.githubusercontent.com/wiki/RaspberryPiFoundation/blockly/';
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(base + page + '.md', {signal: ctrl.signal});
        if (!res.ok) return null;
        const md = calloutSection(await res.text(), anchor);
        // Illustrations: absolute URLs pass through, wiki-relative ones
        // (like "if-if.png") resolve against the wiki's raw root.
        const images = [...md.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)]
            .map((match) => match[1])
            .filter((src) => /\.(png|gif|jpe?g|svg|webp)([?#]|$)/i.test(src))
            .map((src) => /^https?:\/\//.test(src) ? src : base + src)
            .slice(0, 3);
        const text = md
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/^#+ .*$/gm, ' ')
            .replace(/[*_`>|]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text && !images.length) return null;
        return {
            text: text.length > 1600 ? text.slice(0, 1597) + '…' : text,
            images,
        };
    } catch (e) {
        return null;
    }
}

async function showBlockCallout(block, workspace) {
    calloutClose();
    const type = block.type;
    let label = '';
    try { label = block.toString(); } catch (e) { /* fine */ }
    if (label.length > 46) label = label.slice(0, 43) + '...';

    const el = document.createElement('div');
    el.className = 'block-callout';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Blox explains this block');
    el.innerHTML =
        '<div class="block-callout__head">' +
            `<strong class="block-callout__title"></strong>` +
            '<button class="block-callout__close" type="button" ' +
                'aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="block-callout__scroll">' +
            '<p class="block-callout__text"></p>' +
            '<p class="block-callout__more" hidden></p>' +
            '<div class="block-callout__actions">' +
                '<button class="coach-chip block-callout__tellmore" ' +
                    'type="button">Tell me more</button>' +
            '</div>' +
        '</div>';
    el.querySelector('.block-callout__title').textContent = label || type;

    const local = (typeof ACB_BLOCK_EXPLANATIONS !== 'undefined' &&
        ACB_BLOCK_EXPLANATIONS[type]) ||
        'This one is new to me. Try running it and watch the Output.';
    const textEl = el.querySelector('.block-callout__text');
    textEl.textContent = local;

    // Position: to the right of the block, tail pointing left; below the
    // block when the right edge would leave the viewport.
    const rect = block.getSvgRoot().getBoundingClientRect();
    document.body.appendChild(el);
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

    acbCallout = {el, blockId: block.id};
    document.addEventListener('pointerdown', calloutOutside, true);
    document.addEventListener('keydown', calloutEsc, true);
    el.querySelector('.block-callout__close')
        .addEventListener('click', calloutClose);

    if (typeof acbMaybeSpeakCoach === 'function') acbMaybeSpeakCoach(local);

    // "Tell me more": the curated guide section, words and pictures, in
    // the bubble - with a link to the very same spot for the full page.
    // Blocks with no wiki page anywhere get Blox's deeper local text.
    el.querySelector('.block-callout__tellmore')
        .addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const moreEl = el.querySelector('.block-callout__more');
            const mapped = ACB_HELP_MAP[type];
            if (!mapped) {
                moreEl.textContent = ACB_DEEP_LOCAL[type] ||
                    (typeof ACB_BLOCK_EXPLANATIONS_SIMPLE !== 'undefined' &&
                        ACB_BLOCK_EXPLANATIONS_SIMPLE[type]) ||
                    'That is all I have on this one for now. Try it in a ' +
                    'tiny program and watch what changes.';
                moreEl.hidden = false;
                button.remove();
                if (typeof acbMaybeSpeakCoach === 'function') {
                    acbMaybeSpeakCoach(moreEl.textContent);
                }
                return;
            }
            button.disabled = true;
            button.textContent = 'Fetching the guide…';
            const guideUrl =
                'https://github.com/RaspberryPiFoundation/blockly/wiki/' +
                mapped.page + (mapped.anchor ? `#${mapped.anchor}` : '');
            const details = await fetchWikiDetails(mapped.page, mapped.anchor);
            if (!acbCallout || acbCallout.el !== el) return;  // closed
            const link = document.createElement('a');
            link.href = guideUrl;
            link.target = '_blank';
            link.rel = 'noopener';
            link.className = 'coach-chip';
            link.textContent = 'Open the full guide ↗';
            if (details) {
                el.classList.add('block-callout--wide');
                for (const src of details.images) {
                    const img = document.createElement('img');
                    img.src = src;
                    img.alt = `Illustration for the ${type} block`;
                    img.loading = 'lazy';
                    img.className = 'block-callout__img';
                    moreEl.appendChild(img);
                }
                if (details.text) {
                    const span = document.createElement('span');
                    span.textContent = details.text;
                    moreEl.appendChild(span);
                }
                moreEl.hidden = false;
                if (details.text &&
                    typeof acbMaybeSpeakCoach === 'function') {
                    acbMaybeSpeakCoach(details.text);
                }
            }
            // The link always lands somewhere correct: the curated page.
            button.replaceWith(link);
        });

    // Quiet AI upgrade of the first explanation (never blocks the bubble).
    try {
        const ai = await aiCoach('explain', {blockType: type});
        if (ai && ai.text && acbCallout && acbCallout.el === el) {
            textEl.textContent = '✨ ' + ai.text;
        }
    } catch (e) { /* the local text stands */ }
}

function setupCallout(workspace) {
    if (typeof Blockly === 'undefined' ||
        !Blockly.ContextMenuRegistry) return;
    const registry = Blockly.ContextMenuRegistry.registry;
    // Replace the stock Help item (a hard redirect, often to Wikipedia)
    // with an in-place answer from Blox.
    try { registry.unregister('blockHelp'); } catch (e) { /* not present */ }
    try {
        registry.register({
            id: 'acbWhatIsThis',
            scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
            weight: 1,
            displayText: () => '💬 What is this?',
            preconditionFn: (scope) =>
                scope && scope.block ? 'enabled' : 'hidden',
            callback: (scope) => showBlockCallout(scope.block, workspace),
        });
    } catch (e) { /* double registration on hot reload is fine */ }
    // The bubble anchors to screen coordinates: close it when the canvas
    // moves under it or the block changes.
    workspace.addChangeListener((event) => {
        if (acbCallout && event &&
            event.type !== 'toolbox_item_select') calloutClose();
    });
}

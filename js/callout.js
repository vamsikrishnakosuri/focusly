/**
 * @fileoverview "What is this?" - right-click any block and Blox answers in
 * a speech bubble pointing at that very block, instead of Blockly's stock
 * Help item that ejects the learner to a GitHub wiki page. Layers:
 *
 *   1. Instantly: the local teaching-grade explanation (offline, 0ms).
 *   2. A beat later: Blox's live AI explanation replaces it (sparkle-marked),
 *      aware of the learner's actual workspace.
 *   3. "Tell me more": a deeper dive - AI first; if the server is asleep,
 *      the block's own wiki page is fetched and summarized inline; failing
 *      that, the simpler local explanation. Nobody leaves the app.
 */

let acbCallout = null;   // {el, blockId}

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

/**
 * github.com/{o}/{r}/wiki/{Page} -> {text, images} pulled from the page's
 * raw markdown, or null when it cannot be fetched.
 */
async function fetchWikiDetails(helpUrl) {
    try {
        const url = typeof helpUrl === 'function' ? helpUrl() : helpUrl;
        const m = String(url || '').match(
            /github\.com\/([^/]+)\/([^/]+)\/wiki\/([^/#?]+)/);
        if (!m) return null;
        const raw = `https://raw.githubusercontent.com/wiki/${m[1]}/${m[2]}/${m[3]}.md`;
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(raw, {signal: ctrl.signal});
        if (!res.ok) return null;
        const md = await res.text();
        // The page's illustrations: absolute URLs pass through, wiki-relative
        // ones (like "if-if.png") resolve against the wiki's raw root.
        const wikiBase = `https://raw.githubusercontent.com/wiki/${m[1]}/${m[2]}/`;
        const images = [...md.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)]
            .map((match) => match[1])
            .filter((src) => /\.(png|gif|jpe?g|svg|webp)([?#]|$)/i.test(src))
            .map((src) => /^https?:\/\//.test(src) ? src : wikiBase + src)
            .slice(0, 2);
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
            text: text.length > 620 ? text.slice(0, 617) + '…' : text,
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
        '<p class="block-callout__text"></p>' +
        '<p class="block-callout__more" hidden></p>' +
        '<div class="block-callout__actions">' +
            '<button class="coach-chip block-callout__tellmore" ' +
                'type="button">Tell me more</button>' +
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

    // "Tell me more" pulls the block's own guide page - words and pictures -
    // into the bubble. Only when the fetch fails does it fall back to a link
    // that opens the full page, so the help URL is never wasted.
    el.querySelector('.block-callout__tellmore')
        .addEventListener('click', async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            button.textContent = 'Fetching the guide…';
            const details = await fetchWikiDetails(block.helpUrl);
            if (!acbCallout || acbCallout.el !== el) return;  // closed meanwhile
            const moreEl = el.querySelector('.block-callout__more');
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
                    const p = document.createElement('span');
                    p.textContent = details.text;
                    moreEl.appendChild(p);
                }
                moreEl.hidden = false;
                button.remove();
                if (details.text &&
                    typeof acbMaybeSpeakCoach === 'function') {
                    acbMaybeSpeakCoach(details.text);
                }
            } else {
                // Could not reach the guide: hand over the real page.
                const url = typeof block.helpUrl === 'function' ?
                    block.helpUrl() : block.helpUrl;
                if (url) {
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener';
                    link.className = 'coach-chip';
                    link.textContent = 'Open the full guide ↗';
                    button.replaceWith(link);
                } else {
                    moreEl.textContent = (typeof
                        ACB_BLOCK_EXPLANATIONS_SIMPLE !== 'undefined' &&
                        ACB_BLOCK_EXPLANATIONS_SIMPLE[type]) ||
                        'That is all I have on this one for now.';
                    moreEl.hidden = false;
                    button.remove();
                }
            }
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
    // Replace the stock Help item (a hard redirect to a GitHub wiki) with
    // an in-place answer from Blox.
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

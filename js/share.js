/**
 * @fileoverview Share links: the whole program travels inside the URL.
 * "Copy share link" (settings menu) puts a #p=... link on the clipboard;
 * opening such a link loads those exact blocks - no server, no account,
 * works on GitHub Pages. The honest first step toward collaboration:
 * show-and-tell today, real-time editing another day.
 */

function shareEncode(workspace) {
    const json = JSON.stringify(
        Blockly.serialization.workspaces.save(workspace));
    return btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function shareDecode(fragment) {
    const b64 = fragment.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

async function shareCopyLink(workspace) {
    try {
        const url = location.origin + location.pathname +
            '#p=' + shareEncode(workspace);
        await navigator.clipboard.writeText(url);
        coachSay('Link copied. Anyone who opens it gets this exact ' +
            'program on their canvas - nothing of yours is uploaded ' +
            'anywhere; the blocks travel inside the link itself.');
        if (typeof showXpToast === 'function') showXpToast('🔗 Link copied');
    } catch (e) {
        coachSay('Copying did not work in this browser. You can share by ' +
            'using the Code tab instead: copy the text there.');
    }
}

function setupShare(workspace) {
    document.getElementById('shareOpen')?.addEventListener('click', () => {
        document.getElementById('settingsDropdown')
            ?.setAttribute('hidden', '');
        shareCopyLink(workspace);
    });

    // Arriving via a share link: those blocks win the canvas.
    if (location.hash.startsWith('#p=')) {
        try {
            const state = shareDecode(location.hash.slice(3));
            Blockly.serialization.workspaces.load(state, workspace);
            history.replaceState(null, '', location.pathname);
            setTimeout(() => {
                // The welcome-back card would talk over the delivery.
                document.querySelector('.acb-welcome-card')?.remove();
                coachSay('This program arrived by link - it is all yours ' +
                    'now. Run it, change it, break it, rebuild it.');
            }, 900);
        } catch (e) {
            coachSay('That share link seems damaged. Ask for a fresh one.');
        }
    }
}

/**
 * @fileoverview Build together: realtime pair programming, ADHD-first.
 * Not Google-Docs-style concurrent editing (a conflict machine) but the
 * pair-programming model that actually teaches: one person DRIVES (their
 * blocks are everyone's blocks, live), everyone else navigates and can
 * take the keys with one tap. Clear turns, zero merge conflicts.
 *
 * Plumbing: WebRTC data channels via PeerJS and its free public broker -
 * peer to peer, no Focusly server, programs never stored anywhere. The
 * room code IS the address. School networks that block WebRTC get a calm
 * failure message, never a hang.
 */

let acbCollab = null;
// {peer, isHost, conns: Map, myId, name, roomCode, driverId,
//  roster: [{id, name}], applying, sendTimer}

function collabLoadPeerJs() {
    return new Promise((resolve, reject) => {
        if (window.Peer) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('peerjs failed to load'));
        document.head.appendChild(script);
    });
}

const collabRoomCode = () => {
    const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += abc[Math.floor(Math.random() * abc.length)];
    }
    return code;
};

/* ---------------------------- presence bar ----------------------------- */

function collabBar() {
    let bar = document.getElementById('collabBar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'collabBar';
        bar.className = 'collab-bar';
        document.body.appendChild(bar);
    }
    return bar;
}

function collabRenderBar() {
    const bar = collabBar();
    if (!acbCollab) { bar.hidden = true; return; }
    bar.hidden = false;
    const meDriving = acbCollab.driverId === acbCollab.myId;
    const names = acbCollab.roster.map((p) => {
        const driving = p.id === acbCollab.driverId;
        return `<span class="collab-bar__name${driving ? ' is-driving' : ''}">` +
            `${driving ? '🔑 ' : ''}${p.name}</span>`;
    }).join('');
    bar.innerHTML =
        `<span class="collab-bar__room">👥 ${acbCollab.roomCode}</span>${names}` +
        (meDriving ?
            '<span class="collab-bar__you">You are driving</span>' :
            '<button id="collabAskDrive" class="coach-chip" type="button">' +
            'Take the keys 🔑</button>') +
        '<button id="collabLeave" class="coach-chip" type="button">Leave</button>';
    document.getElementById('collabAskDrive')?.addEventListener('click',
        () => collabSend({type: 'drive', driverId: acbCollab.myId}));
    document.getElementById('collabLeave')?.addEventListener('click',
        collabLeave);
    collabUpdateOverlay();
}

/** Navigators cannot edit: a soft glass pane over the canvas says so. */
function collabUpdateOverlay() {
    let pane = document.getElementById('collabPane');
    const blockly = document.getElementById('blocklyDiv') ||
        document.querySelector('.blocklyDiv, #blockly');
    const shouldBlock = acbCollab && acbCollab.driverId !== acbCollab.myId;
    if (!shouldBlock) { pane?.remove(); return; }
    if (!pane && blockly) {
        pane = document.createElement('div');
        pane.id = 'collabPane';
        pane.className = 'collab-pane';
        const driver = acbCollab.roster.find(
            (p) => p.id === acbCollab.driverId);
        pane.innerHTML = `<span>${driver ? driver.name : 'Your partner'} ` +
            'is driving. Watch along, or take the keys.</span>';
        blockly.parentElement.appendChild(pane);
        const rect = blockly.getBoundingClientRect();
        const parentRect = blockly.parentElement.getBoundingClientRect();
        pane.style.left = `${rect.left - parentRect.left}px`;
        pane.style.top = `${rect.top - parentRect.top}px`;
        pane.style.width = `${rect.width}px`;
        pane.style.height = `${rect.height}px`;
    }
}

/* ------------------------------ messaging ------------------------------ */

/** Route a message: hosts handle it directly, guests send it up the wire. */
function collabSend(message) {
    if (!acbCollab) return;
    if (acbCollab.isHost) collabHostHandle(message, null);
    else acbCollab.hostConn?.send(message);
}

function collabBroadcast(message, exceptConn) {
    for (const conn of acbCollab.conns.values()) {
        if (conn !== exceptConn && conn.open) conn.send(message);
    }
}

/** The host is the room's switchboard: apply locally, echo to the rest. */
function collabHostHandle(message, fromConn) {
    if (message.type === 'hello') {
        const entry = {id: message.id, name: message.name};
        acbCollab.roster = acbCollab.roster.filter((p) => p.id !== entry.id);
        acbCollab.roster.push(entry);
        collabSyncRoster();
        // Late joiner gets the current program immediately.
        if (fromConn) {
            fromConn.send({type: 'state',
                json: collabSnapshot(), driverId: acbCollab.driverId});
        }
        coachSay(`${message.name} joined the room. Build together!`);
    } else if (message.type === 'state') {
        if (message.from === acbCollab.driverId) {
            if (message.from !== acbCollab.myId) collabApply(message.json);
            collabBroadcast(message, fromConn);
        }
    } else if (message.type === 'drive') {
        acbCollab.driverId = message.driverId;
        collabSyncRoster();
        const who = acbCollab.roster.find((p) => p.id === message.driverId);
        coachSay(`🔑 ${who ? who.name : 'Your partner'} has the keys now.`);
    } else if (message.type === 'bye') {
        acbCollab.roster = acbCollab.roster.filter(
            (p) => p.id !== message.id);
        if (acbCollab.driverId === message.id) {
            acbCollab.driverId = acbCollab.myId;
        }
        collabSyncRoster();
    }
}

function collabSyncRoster() {
    collabBroadcast({type: 'roster', roster: acbCollab.roster,
        driverId: acbCollab.driverId}, null);
    collabRenderBar();
}

function collabGuestHandle(message) {
    if (message.type === 'roster') {
        acbCollab.roster = message.roster;
        const hadKeys = acbCollab.driverId === acbCollab.myId;
        acbCollab.driverId = message.driverId;
        if (!hadKeys && message.driverId === acbCollab.myId) {
            coachSay('🔑 You have the keys - your blocks are live for ' +
                'everyone now.');
        }
        collabRenderBar();
    } else if (message.type === 'state') {
        if (message.driverId) acbCollab.driverId = message.driverId;
        if (message.from !== acbCollab.myId) collabApply(message.json);
        collabRenderBar();
    }
}

/* ----------------------------- state sync ------------------------------ */

function collabSnapshot() {
    return JSON.stringify(Blockly.serialization.workspaces.save(
        Blockly.getMainWorkspace()));
}

function collabApply(json) {
    acbCollab.applying = true;
    try {
        Blockly.serialization.workspaces.load(
            JSON.parse(json), Blockly.getMainWorkspace());
    } catch (e) { /* skip a bad frame */ }
    setTimeout(() => { if (acbCollab) acbCollab.applying = false; }, 120);
}

function collabOnWorkspaceChange(event) {
    if (!acbCollab || acbCollab.applying) return;
    if (event && event.isUiEvent) return;
    if (acbCollab.driverId !== acbCollab.myId) return;   // navigators watch
    clearTimeout(acbCollab.sendTimer);
    acbCollab.sendTimer = setTimeout(() => {
        if (!acbCollab) return;
        const message = {type: 'state', json: collabSnapshot(),
            from: acbCollab.myId, driverId: acbCollab.driverId};
        if (acbCollab.isHost) collabBroadcast(message, null);
        else acbCollab.hostConn?.send(message);
    }, 350);
}

/* ---------------------------- create / join ---------------------------- */

async function collabCreate(name) {
    await collabLoadPeerJs();
    const code = collabRoomCode();
    return new Promise((resolve) => {
        const peer = new Peer('focusly-' + code);
        peer.on('open', (id) => {
            acbCollab = {peer, isHost: true, conns: new Map(), myId: id,
                name, roomCode: code, driverId: id,
                roster: [{id, name}], applying: false, sendTimer: null};
            peer.on('connection', (conn) => {
                acbCollab.conns.set(conn.peer, conn);
                conn.on('data', (m) => collabHostHandle(m, conn));
                conn.on('close', () => {
                    acbCollab?.conns.delete(conn.peer);
                    collabHostHandle({type: 'bye', id: conn.peer}, null);
                });
            });
            collabRenderBar();
            coachSay(`Room "${code}" is open. Share the code (or the ` +
                'link on your clipboard) and build together.');
            try {
                navigator.clipboard.writeText(location.origin +
                    location.pathname + '#room=' + code);
            } catch (e) { /* the code on screen is enough */ }
            resolve(code);
        });
        peer.on('error', () => {
            coachSay('Could not reach the meeting point (some networks ' +
                'block it). Everything else works; try another network ' +
                'for rooms.');
            resolve(null);
        });
    });
}

async function collabJoin(code, name) {
    await collabLoadPeerJs();
    return new Promise((resolve) => {
        const peer = new Peer();
        peer.on('open', (id) => {
            const conn = peer.connect('focusly-' + code.toLowerCase(),
                {reliable: true});
            conn.on('open', () => {
                acbCollab = {peer, isHost: false, conns: new Map(),
                    hostConn: conn, myId: id, name,
                    roomCode: code.toLowerCase(),
                    driverId: null, roster: [], applying: false,
                    sendTimer: null};
                conn.on('data', collabGuestHandle);
                conn.on('close', () => {
                    coachSay('The room closed. Your blocks stay with you.');
                    collabLeave();
                });
                conn.send({type: 'hello', id, name});
                collabRenderBar();
                resolve(true);
            });
            setTimeout(() => {
                if (!acbCollab) {
                    coachSay(`No room "${code}" answered. Check the code, ` +
                        'or the host may have left.');
                    try { peer.destroy(); } catch (e) { /* fine */ }
                    resolve(false);
                }
            }, 9000);
        });
        peer.on('error', () => {
            coachSay('Could not reach the meeting point (some networks ' +
                'block it). Try another network for rooms.');
            resolve(false);
        });
    });
}

function collabLeave() {
    if (!acbCollab) return;
    try {
        if (!acbCollab.isHost) {
            acbCollab.hostConn?.send({type: 'bye', id: acbCollab.myId});
        }
        acbCollab.peer.destroy();
    } catch (e) { /* fine */ }
    acbCollab = null;
    collabRenderBar();
    document.getElementById('collabPane')?.remove();
}

/* ------------------------------- the modal ----------------------------- */

function collabOpenModal() {
    let modal = document.getElementById('collabModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'collabModal';
        modal.className = 'quest-map';
        modal.setAttribute('role', 'dialog');
        modal.innerHTML =
            '<div class="quest-map__card collab-modal__card">' +
            '<header class="quest-map__header"><h2>👥 Build together</h2>' +
            '<button id="collabClose" class="coach-chip" type="button">' +
            'Close</button></header>' +
            '<div class="quest-map__body">' +
            '<p class="challenge-modal__line">Pair programming, live: one ' +
            'of you drives the blocks, the other watches and takes the ' +
            'keys anytime. Peer to peer - your program goes only to the ' +
            'person you invite, never to a server.</p>' +
            '<label class="timer-dropdown__row"><span>Your name</span>' +
            '<input id="collabName" type="text" maxlength="20" ' +
            'placeholder="e.g. Vamsi"></label>' +
            '<div class="pref-row">' +
            '<button id="collabCreateBtn" class="now-card__button ' +
            'now-card__button--primary" type="button">Create a room</button>' +
            '</div><hr class="collab-modal__rule">' +
            '<label class="timer-dropdown__row"><span>Room code</span>' +
            '<input id="collabCode" type="text" maxlength="5" ' +
            'placeholder="e.g. k3mp7"></label>' +
            '<div class="pref-row">' +
            '<button id="collabJoinBtn" class="now-card__button ' +
            'now-card__button--secondary" type="button">Join a room</button>' +
            '</div><p id="collabStatus" class="challenge-modal__line"></p>' +
            '</div></div>';
        document.body.appendChild(modal);
        document.getElementById('collabClose').addEventListener('click',
            () => { modal.hidden = true; });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.hidden = true;
        });
        const nameOf = () =>
            (document.getElementById('collabName').value || 'Builder')
                .trim().slice(0, 20);
        document.getElementById('collabCreateBtn').addEventListener('click',
            async () => {
                document.getElementById('collabStatus').textContent =
                    'Opening the room…';
                const code = await collabCreate(nameOf());
                document.getElementById('collabStatus').textContent = code ?
                    `Room open: ${code} - the invite link is on your ` +
                    'clipboard.' : 'Could not open a room on this network.';
                if (code) setTimeout(() => { modal.hidden = true; }, 1800);
            });
        document.getElementById('collabJoinBtn').addEventListener('click',
            async () => {
                const code = document.getElementById('collabCode').value.trim();
                if (code.length < 4) return;
                document.getElementById('collabStatus').textContent =
                    'Knocking…';
                const ok = await collabJoin(code, nameOf());
                document.getElementById('collabStatus').textContent =
                    ok ? 'You are in!' : 'Could not join.';
                if (ok) setTimeout(() => { modal.hidden = true; }, 1200);
            });
    }
    modal.hidden = false;
}

function setupCollab(workspace) {
    workspace.addChangeListener(collabOnWorkspaceChange);
    document.getElementById('collabOpen')?.addEventListener('click', () => {
        document.getElementById('settingsDropdown')
            ?.setAttribute('hidden', '');
        collabOpenModal();
    });
    // Arriving through an invite link: prefill and open the join flow.
    if (location.hash.startsWith('#room=')) {
        const code = location.hash.slice(6);
        history.replaceState(null, '', location.pathname);
        setTimeout(() => {
            collabOpenModal();
            document.getElementById('collabCode').value = code;
            document.getElementById('collabStatus').textContent =
                'Invited to room ' + code +
                ' - type your name and press Join.';
        }, 600);
    }
    window.addEventListener('pagehide', collabLeave);
}

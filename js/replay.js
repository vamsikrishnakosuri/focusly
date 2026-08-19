/**
 * @fileoverview Replay my building: a time-lapse of the learner's own work.
 * The workspace is snapshotted quietly as they build (debounced, deduped,
 * capped); "Replay my building" in the settings menu opens a scrubber that
 * plays the session back snapshot by snapshot - "look how far you came" is
 * a reward, and rewatching your own process is how you notice what you did.
 *
 * Replay never touches the record: entering saves the live workspace, the
 * recorder pauses, and leaving restores exactly what was there.
 */

const ACB_HISTORY_MAX = 240;
let acbHistory = [];
let acbHistoryTimer = null;
let acbReplay = null;   // {savedLive, playTimer}

function historyRecord(workspace) {
    try {
        const json = JSON.stringify(
            Blockly.serialization.workspaces.save(workspace));
        if (acbHistory.length &&
            acbHistory[acbHistory.length - 1] === json) return;
        acbHistory.push(json);
        if (acbHistory.length > ACB_HISTORY_MAX) acbHistory.shift();
    } catch (e) { /* recording is best-effort */ }
}

function replayLoad(workspace, index) {
    const json = acbHistory[Math.max(0, Math.min(index, acbHistory.length - 1))];
    if (!json) return;
    try {
        Blockly.serialization.workspaces.load(JSON.parse(json), workspace);
    } catch (e) { /* skip a bad frame */ }
    const label = document.getElementById('replayLabel');
    if (label) {
        label.textContent = `moment ${index + 1} of ${acbHistory.length}`;
    }
}

function replayClose(workspace) {
    if (!acbReplay) return;
    clearInterval(acbReplay.playTimer);
    try {
        Blockly.serialization.workspaces.load(
            JSON.parse(acbReplay.savedLive), workspace);
    } catch (e) { /* the live state was also the last snapshot */ }
    acbReplay = null;
    const bar = document.getElementById('replayBar');
    if (bar) bar.hidden = true;
}

function replayOpen(workspace) {
    if (acbHistory.length < 2) {
        coachSay('Not much to replay yet - build a little first, then come ' +
            'back and watch your own time-lapse.');
        return;
    }
    if (typeof stepperCleanup === 'function') stepperCleanup(workspace);
    if (typeof walkStop === 'function') walkStop(workspace);
    acbReplay = {
        savedLive: JSON.stringify(
            Blockly.serialization.workspaces.save(workspace)),
        playTimer: null,
    };
    const bar = document.getElementById('replayBar');
    const slider = document.getElementById('replaySlider');
    slider.max = String(acbHistory.length - 1);
    slider.value = '0';
    bar.hidden = false;
    replayLoad(workspace, 0);
    coachSay('This is your session, moment by moment. Drag the slider or ' +
        'press play and watch how the program grew.');
}

function setupReplay(workspace) {
    workspace.addChangeListener((event) => {
        if (!event || event.isUiEvent || acbReplay) return;
        clearTimeout(acbHistoryTimer);
        acbHistoryTimer = setTimeout(() => {
            if (!acbReplay) historyRecord(workspace);
        }, 700);
    });

    document.getElementById('replayOpen')?.addEventListener('click', () => {
        document.getElementById('settingsDropdown')?.setAttribute('hidden', '');
        replayOpen(workspace);
    });
    document.getElementById('replaySlider')?.addEventListener('input', (e) => {
        if (acbReplay) replayLoad(workspace, Number(e.target.value));
    });
    document.getElementById('replayPlay')?.addEventListener('click', () => {
        if (!acbReplay) return;
        const slider = document.getElementById('replaySlider');
        const button = document.getElementById('replayPlay');
        if (acbReplay.playTimer) {
            clearInterval(acbReplay.playTimer);
            acbReplay.playTimer = null;
            button.textContent = '▶';
            return;
        }
        if (Number(slider.value) >= acbHistory.length - 1) slider.value = '0';
        button.textContent = '⏸';
        acbReplay.playTimer = setInterval(() => {
            const next = Number(slider.value) + 1;
            if (next >= acbHistory.length) {
                clearInterval(acbReplay.playTimer);
                acbReplay.playTimer = null;
                button.textContent = '▶';
                return;
            }
            slider.value = String(next);
            replayLoad(workspace, next);
        }, 550);
    });
    document.getElementById('replayClose')?.addEventListener('click',
        () => replayClose(workspace));
}

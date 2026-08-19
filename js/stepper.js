/**
 * @fileoverview The stepper: a real debugger for blocks. ICSE 2024's
 * NuzzleBug paper opens with the observation that mainstream block
 * environments provide no debugging support at all; Scratch 1.4 had
 * single-stepping and removed it. Here it returns:
 *
 *   - Step: execute exactly one block; that block glows in the workspace.
 *   - Auto: gentle slow-motion playback (350ms per block).
 *   - Live watchers: every variable's current value updates per step.
 *   - Errors: the failing block glows red and the friendly translation
 *     appears - block-level blame instead of a wall of text.
 *
 * Powered by Neil Fraser's JS-Interpreter (sandboxed, loaded lazily) over
 * code generated with a highlightBlock() statement prefix.
 */

let acbStepSession = null;   // {interp, declared, autoTimer, currentId}

function ensureInterpreterLib() {
    return new Promise((resolve, reject) => {
        if (window.Interpreter) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/gh/NeilFraser/JS-Interpreter@master/acorn_interpreter.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('interpreter failed to load'));
        document.head.appendChild(script);
    });
}

function stepperUi(state) {
    const start = document.getElementById('debugStart');
    const controls = document.getElementById('debugCtrls');
    if (!start || !controls) return;
    start.hidden = state === 'running';
    controls.hidden = state !== 'running';
}

function stepperCleanup(workspace) {
    if (!acbStepSession) return;
    clearInterval(acbStepSession.autoTimer);
    try { workspace.highlightBlock(null); } catch (e) { /* fine */ }
    document.querySelectorAll('.acb-block-error')
        .forEach((el) => el.classList.remove('acb-block-error'));
    acbStepSession = null;
    stepperUi('idle');
}

async function stepperStart(workspace) {
    stepperCleanup(workspace);
    try {
        await ensureInterpreterLib();
    } catch (e) {
        coachSay('The stepper could not load (offline?). Run still works.');
        return;
    }
    const generator = javascript.javascriptGenerator;
    let code;
    try {
        generator.STATEMENT_PREFIX = 'highlightBlock(%1);\n';
        generator.addReservedWords('highlightBlock');
        code = generator.workspaceToCode(workspace);
    } finally {
        generator.STATEMENT_PREFIX = null;
    }
    if (!code.trim()) {
        coachSay('Nothing to step through yet - place some blocks first.');
        return;
    }
    clearOutput();
    document.getElementById('outputTabButton')?.click();

    const declared = [...new Set(
        (code.match(/var (\w+)/g) || []).map((m) => m.slice(4)))]
        .filter((name) => name !== 'highlightBlock');

    const session = {declared, autoTimer: null, currentId: null, done: false};
    session.interp = new Interpreter(code, (interp, globalObject) => {
        // The minified build mangles interp.globalObject; keep the reference
        // the init callback hands us, it is the only reliable way in.
        session.globalScope = globalObject;
        interp.setProperty(globalObject, 'highlightBlock',
            interp.createNativeFunction((id) => {
                session.currentId = String(id);
                session.hitBlock = true;
            }));
        const consoleObj = interp.nativeToPseudo({});
        interp.setProperty(globalObject, 'console', consoleObj);
        interp.setProperty(consoleObj, 'log',
            interp.createNativeFunction((...args) => {
                appendOutput(args.map((a) =>
                    String(interp.pseudoToNative(a))).join(' '));
            }));
        // window.alert / prompt safety stubs
        interp.setProperty(globalObject, 'alert',
            interp.createNativeFunction((t) =>
                appendOutput(String(interp.pseudoToNative(t)))));
    });
    acbStepSession = session;
    stepperUi('running');
    coachSay('Step mode: each press runs exactly one block, and that block ' +
        'glows. Watch the values change underneath the Output.');
}

function stepperLiveVars(workspace) {
    const session = acbStepSession;
    if (!session) return;
    const values = {};
    if (!session.globalScope) return;
    for (const name of session.declared) {
        try {
            const pseudo = session.interp.getProperty(
                session.globalScope, name);
            if (pseudo !== undefined) {
                values[name] = session.interp.pseudoToNative(pseudo);
            }
        } catch (e) { /* not yet defined */ }
    }
    renderRunVars(values);
}

/** Runs until the next block boundary. Returns false when finished. */
function stepperStepOnce(workspace) {
    const session = acbStepSession;
    if (!session || session.done) return false;
    session.hitBlock = false;
    try {
        let alive = true;
        // Advance micro-steps until we cross into the next block (or end).
        for (let i = 0; i < 40000; i++) {
            alive = session.interp.step();
            if (!alive || session.hitBlock) break;
        }
        if (session.hitBlock) {
            try { workspace.highlightBlock(session.currentId); }
            catch (e) { /* block may be gone */ }
        }
        stepperLiveVars(workspace);
        if (!alive) {
            session.done = true;
            try { workspace.highlightBlock(null); } catch (e) { /* fine */ }
            clearInterval(session.autoTimer);
            appendOutput('— program finished —');
            stepperUi('idle');
            document.getElementById('debugStart').hidden = false;
            acbStepSession = null;
            return false;
        }
        return true;
    } catch (error) {
        // Block-level blame: the failing block glows red.
        if (session.currentId) {
            try {
                const block = workspace.getBlockById(session.currentId);
                block?.getSvgRoot().classList.add('acb-block-error');
            } catch (e) { /* fine */ }
        }
        const message = error && error.message ? error.message : String(error);
        appendOutput('Error: ' + message);
        const debugBox = document.getElementById('coachDebugger');
        const debugText = document.getElementById('coachDebuggerText');
        if (debugBox && debugText && typeof translateRunError === 'function') {
            debugText.textContent = translateRunError(message) +
                ' The glowing red block is where it stopped.';
            debugBox.hidden = false;
        }
        clearInterval(session.autoTimer);
        stepperUi('idle');
        acbStepSession = null;
        return false;
    }
}

function setupStepper(workspace) {
    document.getElementById('debugStart')?.addEventListener('click',
        () => stepperStart(workspace));
    document.getElementById('debugStep')?.addEventListener('click',
        () => stepperStepOnce(workspace));
    document.getElementById('debugAuto')?.addEventListener('click', () => {
        const session = acbStepSession;
        if (!session) return;
        if (session.autoTimer) {
            clearInterval(session.autoTimer);
            session.autoTimer = null;
            document.getElementById('debugAuto').textContent = '⏩ Auto';
            return;
        }
        document.getElementById('debugAuto').textContent = '⏸ Pause';
        session.autoTimer = setInterval(() => {
            if (!stepperStepOnce(workspace)) {
                clearInterval(session?.autoTimer);
            }
        }, 350);
    });
    document.getElementById('debugStop')?.addEventListener('click',
        () => stepperCleanup(workspace));
    // Editing the workspace mid-session would desync the trace: end it.
    workspace.addChangeListener((event) => {
        if (acbStepSession && event && !event.isUiEvent &&
            event.type !== 'toolbox_item_select') {
            stepperCleanup(workspace);
        }
    });
}

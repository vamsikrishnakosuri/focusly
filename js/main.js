// The app window (Focus Mode's clean window, or the gear's "Open in app
// window") is a continuation of the same session, not a return visit:
// restore the workspace silently instead of showing the Welcome back card.
// A reload triggered by the focus hand-off returning is also a
// continuation, not a return visit - the learner never left.
let acbSilentReload = false;
try {
    acbSilentReload = sessionStorage.getItem('acb.silentReload') === '1';
    sessionStorage.removeItem('acb.silentReload');
} catch (e) { /* fine */ }
window.ACB_SILENT_RESUME =
    (window.name === 'acb-app-window') || acbSilentReload;

// list block program xml
const PROGRAMS = [
    { "id": "Program1", "label": "Program 1", "file": "xml/tasks/task-1.xml" },
    { "id": "Program2", "label": "Program 2 (Incomplete)",   "file": "xml/tasks/task-2.xml" },
    { "id": "Program2Comp", "label": "Program 2 (Complete)",    "file": "xml/tasks/task-2-complete.xml" },
    // { "id": "Test1", "label": "Test 1",    "file": "xml/tests/test1.xml" },
    // { "id": "Test2", "label": "Test 2",    "file": "xml/tests/test2.xml" },
];

function populateProgramsToDom() {
    const select = document.getElementById('programSelect');
    select.innerHTML = '<option value="Default">None: select a program…</option>';
    PROGRAMS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.label;
        select.appendChild(opt);
    });
}

function getProgramIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('programId');
    return v ? v.trim() : null;
}

function findProgramById(id) {
    const target = String(id).toLowerCase();
    return PROGRAMS.find(p => p.id.toLowerCase() === target);
}

async function fetchProgramXmlById(id) {
    const entry = PROGRAMS.find(p => p.id === id);
    if (!entry) throw new Error('Program not found');
    const res = await fetch(entry.file, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    return await res.text();
}


function loadXmlToWorkspace(workspace, xmlString) {
    try {
        const textToDom = (Blockly.Xml.textToDom || Blockly.utils.xml.textToDom);
        const xml = textToDom(xmlString);
        Blockly.Xml.clearWorkspaceAndLoadFromXml(xml.documentElement || xml, workspace);
        requestAnimationFrame(() => {
            if (typeof workspace.scrollCenter === 'function') workspace.scrollCenter();
            if (typeof Blockly.svgResize === 'function') Blockly.svgResize(workspace);
            syncFocusModeStepBlocks(workspace);
        });
    } catch (e) {
        alert("Invalid XML format.");
        console.error(e);
    }
}

async function loadSelectedProgramIntoWorkspace(workspace) {
    const select = document.getElementById('programSelect');
    const id = select.value;
    if (!id) {
        alert('Pick a program first.');
        return;
    }
    try {
        const xml = await fetchProgramXmlById(id);
        loadXmlToWorkspace(workspace, xml);
    } catch (e) {
        console.error(e);
        alert('Could not load XML file.');
    }
}

async function autoLoadProgramFromQuery(workspace) {
    const programId = getProgramIdFromQuery();
    if (!programId) {
        return;
    }

    const match = findProgramById(programId);
    if (!match) {
        console.warn(`No program found for id "${programId}".`);
        return;
    }

    const select = document.getElementById('programSelect');
    select.value = match.id;

    // Trigger the change event to load the program
    const changeEvent = new Event('change', { bubbles: true });
    select.dispatchEvent(changeEvent);
}

// Global instructions overlay manager
let instructionsManager = null;

function initWorkspace() {
    // load program as html select items
    populateProgramsToDom();

    // Initialize instructions overlay
    instructionsManager = window.initInstructionsOverlay();

    // Set initial button state based on default selection (Default)
    const select = document.getElementById('programSelect');
    const initialSelection = select.value; // This will be "Default"
    if (instructionsManager) {
        instructionsManager.setProgramId(initialSelection);
    }

    // Override the text_print block to use console.log instead of alert
    javascript.javascriptGenerator.forBlock['text_print'] = function(block, generator) {
        const msg = generator.valueToCode(block, 'TEXT', javascript.Order.NONE) || "''";
        return 'console.log(' + msg + ');\n';
    };

    // Blockly Workspace Initialization
    const workspace = Blockly.inject('blocklyDiv', {
        toolbox: toolboxConfig,
        grid: {spacing: 20, length: 3, colour: "#ccc", snap: true},
        zoom: {
            controls: true,
            wheel: true,
            startScale: 1.0,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2,
            pinch: true
        },
        trashcan: true
    });

    window.workspace = workspace;

    let nav = new NavigationController();
    nav.init();
    nav.addWorkspace(workspace);

    // The pressed-keys overlay serves screen-reader demos; for everyone
    // else it is sudden unexplained chrome. Off unless opted in.
    const keyOverlay = new KeyOverlay({ hideDelayMs: 5000 });
    let showKeysPressed = false;
    try { showKeysPressed = localStorage.getItem('acb.keyOverlay') === 'true'; }
    catch (e) { /* fine */ }
    if (showKeysPressed) keyOverlay.attach();
    const keysToggle = document.getElementById('showKeysToggle');
    keysToggle?.setAttribute('aria-checked', String(showKeysPressed));
    keysToggle?.addEventListener('click', () => {
        showKeysPressed = !showKeysPressed;
        try { localStorage.setItem('acb.keyOverlay', String(showKeysPressed)); }
        catch (e) { /* fine */ }
        keysToggle.setAttribute('aria-checked', String(showKeysPressed));
        if (showKeysPressed) { keyOverlay.attach(); } else { keyOverlay.detach(); }
    });

    setupFocusModeToggle();
    setupThemeToggle();
    setupBreakTimerChip();
    setupSettingsMenu();
    setupLayoutOptions();
    setupIoTabs();
    setupRewards();
    setupCoachCard();
    setupQuests(workspace);
    setupSplitter();
    setupAiCoach();
    setupCoachChat();
    setupCodeBridge(workspace);
    if (typeof setupJuice === 'function') setupJuice(workspace);
    if (typeof setupSensory === 'function') setupSensory();
    setupWorkspaceSearch(workspace);
    if (typeof setupStepper === 'function') setupStepper(workspace);
    if (typeof setupWalkthrough === 'function') setupWalkthrough(workspace);
    if (typeof setupReplay === 'function') setupReplay(workspace);
    if (typeof setupRefactor === 'function') setupRefactor(workspace);
    if (typeof setupCallout === 'function') setupCallout(workspace);
    if (typeof setupUiSounds === 'function') setupUiSounds(workspace);
    if (typeof setupBreakScene === 'function') setupBreakScene();
    if (typeof setupBloxMoods === 'function') setupBloxMoods();
    if (typeof setupShare === 'function') setupShare(workspace);
    if (typeof setupCollab === 'function') setupCollab(workspace);
    if (typeof setupBigTimer === 'function') setupBigTimer();
    if (typeof setupTimeWheels === 'function') setupTimeWheels();
    if (typeof setupMotivation === 'function') setupMotivation();
    if (typeof setupFrustration === 'function') setupFrustration(workspace);
    if (typeof setupBests === 'function') setupBests();
    if (typeof setupFocusView === 'function') setupFocusView();

    // Researcher reset: wipe every acb.* key and reload, so the next
    // participant starts from the true first-visit experience. Two taps,
    // like Finish quest, so a stray click never erases a session.
    const studyReset = document.getElementById('studyReset');
    let studyResetArmed = null;
    studyReset?.addEventListener('click', () => {
        if (studyResetArmed) {
            clearTimeout(studyResetArmed);
            try {
                const doomed = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('acb')) doomed.push(key);
                }
                doomed.forEach((key) => localStorage.removeItem(key));
            } catch (e) { /* fine */ }
            location.reload();
            return;
        }
        studyReset.textContent = 'Sure? Tap again to erase everything';
        studyResetArmed = setTimeout(() => {
            studyResetArmed = null;
            studyReset.textContent = '\u{1F9F9} Reset everything (new person)';
        }, 4000);
    });
    // Blox's 3D self appears from the start (a beat after load, so it
    // never competes with startup), not just on the first question.
    setTimeout(() => { if (typeof ensureBloxSpinner === 'function') ensureBloxSpinner(); }, 1200);

    document.getElementById("runButton").addEventListener("click", () => {
        // Clear output panel
        clearOutput();

        // Setup output capture only when running code
        const restoreConsole = setupOutputCapture();

        generateCode(Blockly.getMainWorkspace());
        acbLastRunError = '';
        try {
            eval(document.getElementById("codeOutput").textContent);
        } catch (error) {
            appendOutput("Error: " + error.message);
            acbLastRunError = error.message;
            // Surface the friendly translation immediately, and let the AI
            // deepen it in the background when available.
            const debugBox = document.getElementById('coachDebugger');
            const debugText = document.getElementById('coachDebuggerText');
            if (debugBox && debugText) {
                debugText.textContent = translateRunError(error.message);
                debugBox.hidden = false;
            }
            aiCoach('debug').then((ai) => {
                if (ai && ai.text && debugText) {
                    debugText.textContent = `✨ ${ai.text}`;
                }
            });
        } finally {
            // Restore original console.log after execution
            restoreConsole();
        }
        // Watchers: surface every variable's final value from this run.
        // Direct eval of the generated code declares its vars in this
        // scope, so we can read them back by name right here.
        try {
            const declared = [...new Set((document.getElementById('codeOutput')
                .textContent.match(/var (\w+)/g) || [])
                .map((m) => m.slice(4)))];
            const values = {};
            for (const name of declared) {
                try { values[name] = eval(name); } catch (e) { /* unset */ }
            }
            renderRunVars(values);
        } catch (e) { /* watchers are optional */ }
        // Let the quest engine check whether this run completed the step.
        document.dispatchEvent(new CustomEvent('acb-run-finished'));
    });

    document.getElementById("languageSelect").addEventListener("change", generateCode);

    // Auto-load program when selection changes
    document.getElementById("programSelect").addEventListener("change", async () => {
        const select = document.getElementById("programSelect");
        const selectedId = select.value;

        // Update instructions manager with current program
        if (instructionsManager) {
            instructionsManager.setProgramId(selectedId);
        }

        if (!selectedId || selectedId === "Default") {
            // Clear workspace if no program selected
            workspace.clear();
            return;
        }

        try {
            const xml = await fetchProgramXmlById(selectedId);
            loadXmlToWorkspace(workspace, xml);
        } catch (e) {
            console.error(e);
            alert('Could not load the selected program.');
        }
    });

    document.getElementById("showShortcuts")?.addEventListener("click", () => {
        nav?.showShortcuts();
    });

    // Info button to show instructions
    document.getElementById("showInstructions")?.addEventListener("click", () => {
        instructionsManager?.show();
    });

    // auto select & load program if query param is provided
    autoLoadProgramFromQuery(workspace);
    // renderKeyboardHints(null);
}

/* ------------------------------------------------------------------------ */
/* The code bridge: edit the program as real JavaScript (Monaco, the editor  */
/* inside VS Code) and turn it back into blocks. The conversion is the       */
/* plugin's deterministic codeToBlocks - exact or refused with line-by-line  */
/* reasons, never guessed.                                                   */
/* ------------------------------------------------------------------------ */

let acbMonacoEditor = null;

function ensureMonaco() {
    return new Promise((resolve, reject) => {
        if (window.monaco) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js';
        script.onload = () => {
            window.require.config({paths: {
                vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs',
            }});
            window.require(['vs/editor/editor.main'], () => resolve());
        };
        script.onerror = () => reject(new Error('Monaco failed to load'));
        document.head.appendChild(script);
    });
}

function setupCodeBridge(workspace) {
    const editButton = document.getElementById('codeEditButton');
    const applyButton = document.getElementById('codeApplyButton');
    const cancelButton = document.getElementById('codeCancelButton');
    const host = document.getElementById('monacoHost');
    const pre = document.getElementById('codeOutput');
    const errorList = document.getElementById('codeBridgeErrors');
    if (!editButton || !applyButton || !host || !pre) return;
    if (typeof codeToBlocks !== 'function') {
        editButton.hidden = true;
        return;
    }

    let preEditState = null;   // workspace snapshot for Cancel

    const setEditing = (editing) => {
        editButton.hidden = editing;
        applyButton.hidden = !editing;
        cancelButton.hidden = !editing;
        host.hidden = !editing;
        pre.style.display = editing ? 'none' : '';
        if (!editing && errorList) {
            errorList.hidden = true;
            errorList.innerHTML = '';
        }
    };

    editButton.addEventListener('click', async () => {
        // The bridge speaks JavaScript; align the view first.
        const lang = document.getElementById('languageSelect');
        if (lang && lang.value !== 'javascript') {
            lang.value = 'javascript';
            lang.dispatchEvent(new Event('change'));
        }
        generateCode();
        const source = pre.textContent;
        try {
            preEditState = Blockly.serialization.workspaces.save(workspace);
        } catch (e) { preEditState = null; }
        editButton.disabled = true;
        try {
            await ensureMonaco();
        } catch (e) {
            coachSay('The text editor could not load (offline?). Blocks ' +
                'still work as always.');
            editButton.disabled = false;
            return;
        }
        editButton.disabled = false;
        if (!acbMonacoEditor) {
            acbMonacoEditor = monaco.editor.create(host, {
                value: source,
                language: 'javascript',
                minimap: {enabled: false},
                fontSize: 13,
                automaticLayout: true,
                scrollBeyondLastLine: false,
            });
            // Live sync: as they type, problem lines are explained - and the
            // moment the code converts cleanly, the blocks update to match,
            // so editing "5" to "7" changes the block right away. Cancel
            // restores the snapshot taken when editing began.
            let liveTimer = null;
            acbMonacoEditor.onDidChangeModelContent(() => {
                clearTimeout(liveTimer);
                liveTimer = setTimeout(() => {
                    if (host.hidden) return;
                    const result = codeToBlocks(acbMonacoEditor.getValue());
                    paintBridgeProblems(result);
                    if (result.ok) {
                        try {
                            Blockly.serialization.workspaces.load(
                                result.state, workspace);
                        } catch (e) { /* apply stays available */ }
                    }
                }, 600);
            });
        } else {
            acbMonacoEditor.setValue(source);
        }
        paintBridgeProblems(codeToBlocks(source));
        setEditing(true);
    });

    /** Renders converter problems into the list and the editor margins. */
    const paintBridgeProblems = (result) => {
        const model = acbMonacoEditor && acbMonacoEditor.getModel();
        if (!model || !errorList) return;
        errorList.innerHTML = '';
        if (result.ok) {
            errorList.hidden = true;
            monaco.editor.setModelMarkers(model, 'acb-bridge', []);
            return;
        }
        for (const problem of result.errors) {
            const item = document.createElement('li');
            item.textContent = problem.line ?
                `Line ${problem.line}: ${problem.message}` : problem.message;
            errorList.appendChild(item);
        }
        errorList.hidden = false;
        monaco.editor.setModelMarkers(model, 'acb-bridge',
            result.errors.filter((p) => p.line).map((p) => ({
                severity: monaco.MarkerSeverity.Error,
                message: p.message,
                startLineNumber: p.line, startColumn: 1,
                endLineNumber: p.line,
                endColumn: model.getLineMaxColumn(p.line),
            })));
    };

    cancelButton.addEventListener('click', () => {
        // Live sync may have rewritten the canvas: put it back exactly.
        if (preEditState) {
            try {
                Blockly.serialization.workspaces.load(preEditState, workspace);
            } catch (e) { /* nothing better to do */ }
        }
        generateCode();
        setEditing(false);
    });

    applyButton.addEventListener('click', () => {
        if (!acbMonacoEditor) return;
        const source = acbMonacoEditor.getValue();
        const result = codeToBlocks(source);
        paintBridgeProblems(result);
        if (!result.ok) return;
        try {
            Blockly.serialization.workspaces.load(result.state, workspace);
        } catch (e) {
            coachSay('Those blocks did not assemble cleanly. The code is ' +
                'valid; this is on me - try a simpler shape for now.');
            console.error('Bridge load failed', e);
            return;
        }
        if (typeof Blockly.svgResize === 'function') Blockly.svgResize(workspace);
        generateCode();
        setEditing(false);
        document.dispatchEvent(new CustomEvent('acb-bridge-used'));
        showXpToast('⇄ Your code became blocks');
        coachSay('Text and blocks are the same program in two outfits. ' +
            'Change either one whenever you like.');
    });
}

function generateCode() {
    const language = document.getElementById("languageSelect").value;
    let code;
    switch (language) {
        case "javascript":
            code = javascript.javascriptGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "python":
            code = python.pythonGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "php":
            code = php.phpGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "lua":
            code = lua.luaGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "dart":
            code = dart.dartGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "xml":
            const xmlDom = Blockly.Xml.workspaceToDom(Blockly.getMainWorkspace());
            code = Blockly.Xml.domToPrettyText(xmlDom);
            break;
        default:
            code = "// Select a language";
    }
    let codePanel = document.getElementById("codeOutput");
    codePanel.textContent = code;
    codePanel.classList.remove('prettyprinted');
    if (typeof PR === 'object') {
        PR.prettyPrint();
    }
}

// Output panel management
let outputLineCount = 0;

/** Text of the most recent run, for the quest engine's output checks. */
let acbLastRunOutput = '';

function clearOutput() {
    const outputPanel = document.getElementById("outputPanel");
    outputPanel.innerHTML = '';
    outputLineCount = 0;
    acbLastRunOutput = '';
    const runVars = document.getElementById('runVars');
    if (runVars) { runVars.hidden = true; runVars.innerHTML = ''; }
}

function appendOutput(text) {
    const outputPanel = document.getElementById("outputPanel");
    outputPanel.setAttribute('tabindex', '-1');
    acbLastRunOutput += text + '\n';

    // Split by newlines if the text contains multiple lines
    const lines = text.toString().split('\n');

    lines.forEach(line => {
        outputLineCount++;

        const lineDiv = document.createElement('div');
        lineDiv.className = 'output-line';
        lineDiv.setAttribute('data-output-line', outputLineCount);

        const lineNumber = document.createElement('div');
        lineNumber.className = 'output-line-number';
        lineNumber.textContent = outputLineCount;

        const lineContent = document.createElement('div');
        lineContent.className = 'output-line-content';
        lineContent.textContent = line;

        lineDiv.appendChild(lineNumber);
        lineDiv.appendChild(lineContent);
        outputPanel.appendChild(lineDiv);
    });

    // Auto-scroll to bottom
    outputPanel.scrollTop = outputPanel.scrollHeight;
}

function setupOutputCapture() {
    // Save original console.log
    const originalLog = console.log;

    // Override console.log
    console.log = function(...args) {
        // Call original console.log
        originalLog.apply(console, args);

        // Append to output panel
        const output = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        appendOutput(output);
    };

    // Return a function to restore the original console.log
    return function restoreConsole() {
        console.log = originalLog;
    };
}

/* ------------------------------------------------------------------------ */
/* Focus Mode demo wiring                                                    */
/*                                                                           */
/* The plugin owns the behaviour; this is only the host page's button and    */
/* the demo's choice of which blocks count as "this step's blocks".          */
/* ------------------------------------------------------------------------ */

/**
 * Wires the Focus button to the plugin and keeps its label and ARIA state in
 * step with the plugin, whichever way focus mode was toggled (button or
 * Ctrl+Shift+F).
 */
function setupFocusModeToggle() {
    const button = document.getElementById('focusModeToggle');
    if (!button) return;

    if (typeof getFocusMode !== 'function') {
        // Running against an older build of the plugin.
        button.disabled = true;
        button.title = 'Focus mode is not available in this build';
        return;
    }

    const paint = (enabled) => {
        button.setAttribute('aria-pressed', String(enabled));
        button.setAttribute(
            'aria-label', enabled ? 'Turn focus mode off' : 'Turn focus mode on');
        const icon = button.querySelector('i');
        if (icon) {
            icon.className = enabled ? 'fas fa-sun' : 'fas fa-moon';
        }
    };

    const openFocusAppWindow = () => {
        try {
            return window.open(window.location.href, 'acb-app-window',
                `popup=yes,left=0,top=0,width=${screen.availWidth},` +
                `height=${screen.availHeight}`);
        } catch (e) {
            return null;
        }
    };

    button.addEventListener('click', () => {
        const focusMode = getFocusMode();
        if (!focusMode) return;
        if (!focusMode.enabled && window.name !== 'acb-app-window') {
            window.acbFocusPendingWin = openFocusAppWindow();
        }
        focusMode.toggle();
    });

    document.addEventListener('acb-focus-mode-change', (event) => {
        paint(!!event.detail?.enabled);
    });

    // Focus Mode's strongest form: its own clean window. Turning Focus ON
    // in a normal tab opens the app window (the toggle click is the user
    // gesture popup blockers require) and this tab becomes a hand-off
    // screen that watches for the window to close. Turning Focus OFF
    // inside the app window closes it, and the original tab resumes.
    const inAppWindow = window.name === 'acb-app-window';

    // Inside the app window, offer true full screen (browser chrome gone
    // too). Fullscreen needs a user gesture, so it is a button, not
    // automatic.
    if (inAppWindow) {
        const status = document.querySelector('.app-bar__status');
        if (status) {
            const fsChip = document.createElement('button');
            fsChip.type = 'button';
            fsChip.className = 'chip chip--icon';
            fsChip.title = 'Full screen';
            fsChip.setAttribute('aria-label', 'Toggle full screen');
            fsChip.innerHTML = '<i class="fas fa-expand" aria-hidden="true"></i>';
            fsChip.addEventListener('click', () => {
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                    fsChip.innerHTML =
                        '<i class="fas fa-expand" aria-hidden="true"></i>';
                } else {
                    document.documentElement.requestFullscreen();
                    fsChip.innerHTML =
                        '<i class="fas fa-compress" aria-hidden="true"></i>';
                }
            });
            status.insertBefore(fsChip, status.firstChild);
        }
    }

    document.addEventListener('acb-focus-mode-change', (event) => {
        const enabled = !!event.detail?.enabled;
        if (enabled && !inAppWindow) {
            // Fill the whole monitor (minus the OS taskbar) so nothing else
            // is visible to pull attention away.
            let win = (window.acbFocusPendingWin &&
                !window.acbFocusPendingWin.closed) ?
                window.acbFocusPendingWin : null;
            window.acbFocusPendingWin = null;
            if (!win) win = openFocusAppWindow();
            if (!win) {
                // Popup blocked; focus mode still works in this tab -
                // but say so, instead of looking broken.
                if (typeof showXpToast === 'function') {
                    showXpToast('Pop-up blocked \u2014 allow pop-ups here ' +
                        'to get the clean Focus window. Focusing in this ' +
                        'tab instead.');
                }
                return;
            }
            const overlay = document.createElement('div');
            overlay.className = 'handoff-overlay';
            overlay.innerHTML =
                '<div class="handoff-overlay__card" role="status">' +
                '<p class="handoff-overlay__title">Focus Mode is on 🌙</p>' +
                '<p class="handoff-overlay__line">Your workspace moved to a ' +
                'clean window. Turn Focus off there and you will land right ' +
                'back here.</p></div>';
            document.body.appendChild(overlay);
            const watcher = setInterval(() => {
                if (win.closed) {
                    clearInterval(watcher);
                    try {
                        sessionStorage.setItem('acb.silentReload', '1');
                    } catch (e) { /* fine */ }
                    window.location.reload();
                }
            }, 800);
        } else if (!enabled && inAppWindow) {
            // Save is already flushed by the plugin; hand back to the tab.
            window.close();
        }
    });

    // Coach in Focus Mode: off by default (Focus strips everything), but a
    // learner who wants hints even while focused can keep the coach around.
    const coachToggle = document.getElementById('coachInFocusToggle');
    const applyCoachInFocus = (on) => {
        document.body.classList.toggle('acb-coach-in-focus', on);
        coachToggle?.setAttribute('aria-checked', String(on));
    };
    let coachInFocus = false;
    try { coachInFocus = localStorage.getItem('acb.coachInFocus') === 'true'; }
    catch (e) { /* fine */ }
    applyCoachInFocus(coachInFocus);
    coachToggle?.addEventListener('click', () => {
        coachInFocus = !coachInFocus;
        applyCoachInFocus(coachInFocus);
        try { localStorage.setItem('acb.coachInFocus', String(coachInFocus)); }
        catch (e) { /* fine */ }
    });

    // The plugin may have restored a saved preference during addWorkspace.
    paint(!!getFocusMode()?.isEnabled());
}

/**
 * The header timer chip: a live Pomodoro-style countdown ("18:32 · break"),
 * mint while working, amber during a break, grey when off. Clicking it opens
 * a small panel to pick work/break lengths or turn the timer off. The timer
 * itself lives in the plugin; this is only its face.
 */
function setupBreakTimerChip() {
    const chip = document.getElementById('breakTimerChip');
    const dropdown = document.getElementById('timerDropdown');
    const label = document.getElementById('breakTimerChipLabel');
    if (!chip || !dropdown || !label) return;

    if (typeof getBreakTimer !== 'function') {
        chip.disabled = true;
        chip.title = 'Break timer is not available in this build';
        return;
    }

    const workInput = document.getElementById('timerWorkInput');
    const breakInput = document.getElementById('timerBreakInput');
    const toggleButton = document.getElementById('timerToggleButton');
    const toggleLabel = document.getElementById('timerToggleButtonLabel');

    // "12m 05s" / "1h 05m 30s" - explicit units; a bare 12:05 reads as
    // clock time.
    const mmss = (ms) => {
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        return h > 0 ?
            `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` :
            `${m}m ${String(s).padStart(2, '0')}s`;
    };

    /** 25.5 minutes -> "25m 30s"; 90 minutes -> "1h 30m 00s". Units are
     * always visible, so nobody wonders what they are setting. */
    const minutesToMmss = (minutes) => {
        const total = Math.round((Number(minutes) || 0) * 60);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const sec = total % 60;
        return h > 0 ?
            `${h}h ${String(m).padStart(2, '0')}m ` +
                `${String(sec).padStart(2, '0')}s` :
            `${m}m ${String(sec).padStart(2, '0')}s`;
    };

    /**
     * "25", "25:30", "1:30:00" -> minutes (possibly fractional). Two
     * numbers mean minutes:seconds; three mean hours:minutes:seconds.
     * Returns null for garbage or out-of-range values.
     * @param {string} raw
     * @param {number} minSeconds
     * @param {number} maxSeconds
     */
    const parseMmss = (raw, minSeconds, maxSeconds) => {
        const text = String(raw).trim().toLowerCase();
        let seconds = null;
        let match = text.match(/^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/);
        if (match) {
            seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 +
                Number(match[3]);
        }
        if (seconds === null) {
            // Unit style, as the field displays it: "25m 30s", "1h 30m".
            match = text.match(
                /^(?:(\d{1,2})\s*h)?\s*(?:(\d{1,3})\s*m)?\s*(?:(\d{1,3})\s*s)?$/);
            if (match && (match[1] || match[2] || match[3])) {
                seconds = Number(match[1] || 0) * 3600 +
                    Number(match[2] || 0) * 60 + Number(match[3] || 0);
            }
        }
        if (seconds === null) {
            match = text.match(/^(\d{1,3})(?::([0-5]?\d))?$/);
            if (match) {
                seconds = Number(match[1]) * 60 + Number(match[2] || 0);
            }
        }
        if (seconds === null || seconds < minSeconds ||
            seconds > maxSeconds) return null;
        return seconds / 60;
    };

    const switchEl = document.getElementById('breakTimerSwitch');
    const pauseButton = document.getElementById('timerPauseButton');
    const pauseLabel = document.getElementById('timerPauseButtonLabel');

    const paint = () => {
        const timer = getBreakTimer();
        if (!timer) return;
        const state = timer.getStateName();
        const paused = typeof timer.isPaused === 'function' && timer.isPaused();
        chip.classList.toggle('is-off', state === 'off');
        chip.classList.toggle('is-break', state === 'break');
        if (switchEl) switchEl.setAttribute('aria-checked', String(state !== 'off'));
        // The little analog disk: how much of the current phase remains.
        const arc = document.getElementById('timerArcFg');
        if (arc) {
            const CIRC = 2 * Math.PI * 5.5;
            let fraction = 1;
            if (state === 'working' || state === 'nudging' || paused) {
                const d = timer.getDurations();
                fraction = Math.max(0, Math.min(1,
                    timer.remainingMs() / (d.workMinutes * 60000)));
            } else if (state === 'break') {
                const d = timer.getDurations();
                fraction = Math.max(0, Math.min(1,
                    timer.remainingMs() / (d.breakMinutes * 60000)));
            }
            arc.style.strokeDasharray = String(CIRC);
            arc.style.strokeDashoffset = String(CIRC * (1 - fraction));
        }
        // Time lives in exactly one place: when the big display is on,
        // the chip shows only the state word, never a second countdown.
        const bigShowing = (typeof bigTimerPrefs === 'function') &&
            bigTimerPrefs().pos !== 'chip';
        if (state === 'off') {
            label.textContent = 'Timer';
            chip.setAttribute('aria-label', 'Timer off. Click for details.');
        } else if (paused) {
            label.textContent = bigShowing ?
                'Paused' : 'Paused ' + mmss(timer.remainingMs());
            chip.setAttribute('aria-label', 'Break reminder paused. Click for details.');
        } else if (state === 'break') {
            label.textContent = bigShowing ?
                'Break' : 'Break ' + mmss(timer.remainingMs());
            chip.setAttribute('aria-label', 'On a break. Click for details.');
        } else if (state === 'nudging') {
            label.textContent = 'Break?';
            chip.setAttribute('aria-label', 'Break suggested. Click for details.');
        } else {
            label.textContent = bigShowing ?
                'Working' : mmss(timer.remainingMs()) + ' · break';
            chip.setAttribute('aria-label', 'Break reminder running, ' +
                mmss(timer.remainingMs()) + ' until break. Click for details.');
        }
        if (toggleLabel) {
            toggleLabel.textContent = state === 'off' ?
                'Turn timer on' : 'Turn timer off';
        }
        if (pauseButton) {
            pauseButton.hidden = state === 'off';
            if (pauseLabel) {
                pauseLabel.textContent = paused ? 'Resume timer' : 'Pause timer';
            }
        }
    };

    const syncInputs = () => {
        const timer = getBreakTimer();
        if (!timer) return;
        const d = timer.getDurations();
        if (workInput) workInput.value = minutesToMmss(d.workMinutes);
        if (breakInput) breakInput.value = minutesToMmss(d.breakMinutes);
    };

    const isOpen = () => !dropdown.hidden;
    const close = (returnFocus) => {
        if (!isOpen()) return;
        dropdown.hidden = true;
        chip.setAttribute('aria-expanded', 'false');
        if (returnFocus) chip.focus();
    };
    const open = () => {
        syncInputs();
        dropdown.hidden = false;
        chip.setAttribute('aria-expanded', 'true');
    };

    chip.addEventListener('click', () => {
        if (isOpen()) { close(false); } else { open(); }
    });

    dropdown.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            close(true);
        }
    });

    document.addEventListener('click', (event) => {
        if (isOpen() && !dropdown.contains(event.target) &&
            !chip.contains(event.target)) {
            close(false);
        }
    });

    // Free-typed times, MM:SS or H:MM:SS.
    // Work: 1:00 up to 4 hours. Break: 0:30 up to 2 hours.
    const commitTime = (input, key, minSeconds, maxSeconds) => {
        const minutes = parseMmss(input.value, minSeconds, maxSeconds);
        if (minutes === null) {
            syncInputs();  // revert to the last good value, no error wall
            return;
        }
        getBreakTimer()?.setDurations({[key]: minutes});
        syncInputs();
        paint();
    };
    workInput?.addEventListener('change',
        () => commitTime(workInput, 'workMinutes', 5, 14400));
    breakInput?.addEventListener('change',
        () => commitTime(breakInput, 'breakMinutes', 5, 7200));
    for (const input of [workInput, breakInput]) {
        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
        });
    }
    toggleButton?.addEventListener('click', () => {
        getBreakTimer()?.toggle();
        paint();
    });
    pauseButton?.addEventListener('click', () => {
        const timer = getBreakTimer();
        if (!timer) return;
        if (timer.isPaused()) { timer.resumeTimer(); } else { timer.pauseTimer(); }
        paint();
    });

    // The little switch on the chip is a one-tap on/off, like the mockup's
    // breakReminder toggle. It must not also open the dropdown.
    if (switchEl) {
        switchEl.addEventListener('click', (event) => {
            event.stopPropagation();
            getBreakTimer()?.toggle();
            paint();
        });
        switchEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                getBreakTimer()?.toggle();
                paint();
            }
        });
    }

    document.addEventListener('acb-break-timer', paint);
    setInterval(paint, 1000);
    paint();
}

/**
 * Output and Code share one card with two tabs; the language picker only
 * matters on the Code tab, so it only appears there.
 */
function setupIoTabs() {
    const outputButton = document.getElementById('outputTabButton');
    const codeButton = document.getElementById('codeTabButton');
    const outputPanel = document.getElementById('outputTabPanel');
    const codePanel = document.getElementById('codeTabPanel');
    const lang = document.getElementById('languageSelect');
    if (!outputButton || !codeButton || !outputPanel || !codePanel) return;

    const animButton = document.getElementById('animTabButton');
    const animPanel = document.getElementById('animTabPanel');

    const select = (which) => {
        const tabs = [
            ['output', outputButton, outputPanel],
            ['code', codeButton, codePanel],
            ['anim', animButton, animPanel],
        ];
        for (const [name, button, panel] of tabs) {
            if (!button || !panel) continue;
            const on = name === which;
            button.setAttribute('aria-selected', String(on));
            panel.hidden = !on;
        }
        if (lang) lang.hidden = which !== 'code';
        // The animation deserves the column: the coach steps aside only
        // while this tab is open, and returns on Output or Code.
        document.body.classList.toggle('acb-anim-tab', which === 'anim');
    };
    // The rocket stage (and future animated outputs) switch tabs too.
    window.acbSelectIoTab = select;

    outputButton.addEventListener('click', () => select('output'));
    codeButton.addEventListener('click', () => select('code'));
    animButton?.addEventListener('click', () => select('anim'));

    // Running a program is the moment the learner wants to see its result.
    document.getElementById('runButton')?.addEventListener('click', () => select('output'));
}

/**
 * XP and day-streak chips. Deliberately gentle: XP for running programs,
 * streak for showing up. Both vanish in Focus Mode (8% of participants said
 * game elements distract them, so Focus strips every game element).
 */
function setupRewards() {
    const xpChip = document.getElementById('xpChip');
    const xpLabel = document.getElementById('xpChipLabel');
    const streakChip = document.getElementById('streakChip');
    const streakLabel = document.getElementById('streakChipLabel');
    if (!xpChip || !streakChip) return;

    const read = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
        catch (e) { return fallback; }
    };
    const write = (key, value) => {
        try { localStorage.setItem(key, JSON.stringify(value)); }
        catch (e) { /* fine */ }
    };

    // Streaks live in juice.js (v2, with freezes). XP: +25 per run.
    let xp = Number(read('acb.xp.v1', 0)) || 0;
    const paintXp = () => { if (xpLabel) xpLabel.textContent = `${xp} XP`; };
    paintXp();
    xpChip.hidden = false;
    xpChip.title = 'Earned by running your programs';

    document.getElementById('runButton')?.addEventListener('click', () => {
        xp += 25;
        write('acb.xp.v1', xp);
        paintXp();
    });

    // Steps and quests pay out through the task engine's events.
    document.addEventListener('acb-task', (event) => {
        const earned = Number(event.detail?.xp) || 0;
        if (earned > 0) {
            xp += earned;
            write('acb.xp.v1', xp);
            paintXp();
        }
    });
}

/* ------------------------------------------------------------------------ */
/* Quests: the task engine drives the NOW card, quest pips, toolbox filter   */
/* ------------------------------------------------------------------------ */

/** @type {?TaskEngine} */
let acbTaskEngine = null;

function coachSay(text) {
    // A sparkle reply is the AI talking; remember when, so the idle
    // nudge never talks over an answer the learner is still reading.
    if (String(text).startsWith('\u2728')) {
        window.acbAiAnswerAt = Date.now();
    }
    const message = document.getElementById('coachMessage');
    if (!message) return;
    message.classList.remove('is-thinking');
    message.textContent = text;
    if (typeof bloxSpinStop === 'function') bloxSpinStop();
    if (typeof acbMaybeSpeakCoach === 'function') {
        acbMaybeSpeakCoach(String(text).replace(/^\u2728\s*/, ''));
    }
}

/** A visible "working on it" state, so waiting never looks like nothing. */
function coachThinking(text) {
    const message = document.getElementById('coachMessage');
    if (!message) return;
    message.textContent = text;
    message.classList.add('is-thinking');
    bloxSpinStart();
}

/* ------------------------------------------------------------------------ */
/* Blox in 3D: Vamsi's cube model becomes the coach avatar, and it spins    */
/* while Blox is thinking - the load indicator IS the mascot. three.js and  */
/* the model load lazily on the first thought; any failure quietly keeps    */
/* the flat avatar.                                                         */
/* ------------------------------------------------------------------------ */

let bloxSpinState = null;   // {renderer, scene, camera, model, spinning}
let bloxSpinLoading = null; // in-flight promise

function ensureBloxSpinner() {
    if (bloxSpinState) return Promise.resolve(bloxSpinState);
    if (bloxSpinLoading) return bloxSpinLoading;
    const holder = document.querySelector('.coach-card__avatar');
    if (!holder) return Promise.resolve(null);
    bloxSpinLoading = (async () => {
        try {
            const three = await import('three');
            const {OBJLoader} =
                await import('three/addons/loaders/OBJLoader.js');
            const {MTLLoader} =
                await import('three/addons/loaders/MTLLoader.js');
            const materials = await new MTLLoader()
                .setPath('models/').loadAsync('blox-logo.mtl');
            materials.preload();
            const model = await new OBJLoader().setMaterials(materials)
                .setPath('models/').loadAsync('blox-logo.obj');
            const scene = new three.Scene();
            const camera = new three.PerspectiveCamera(30, 1, 0.1, 10);
            camera.position.set(1.7, 1.6, 2.3);
            camera.lookAt(0, 0.45, 0);
            scene.add(new three.AmbientLight(0xffffff, 1.2));
            const key = new three.DirectionalLight(0xffffff, 2.2);
            key.position.set(2, 3, 2);
            scene.add(key);
            scene.add(model);
            model.rotation.y = 0.7;
            const canvas = document.createElement('canvas');
            canvas.className = 'coach-card__avatar-3d';
            const renderer = new three.WebGLRenderer(
                {canvas, alpha: true, antialias: true});
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.setSize(30, 30);
            holder.innerHTML = '';
            holder.appendChild(canvas);
            renderer.render(scene, camera);
            bloxSpinState = {renderer, scene, camera, model, spinning: false};
            return bloxSpinState;
        } catch (e) {
            return null;  // flat avatar stays; 3D is decoration
        }
    })();
    return bloxSpinLoading;
}

function bloxSpinStart() {
    ensureBloxSpinner().then((s) => {
        if (!s || s.spinning) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;  // no motion; the static cube still shows presence
        }
        s.spinning = true;
        const step = () => {
            if (!s.spinning) return;
            s.model.rotation.y += 0.07;
            s.renderer.render(s.scene, s.camera);
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
}

function bloxSpinStop() {
    if (bloxSpinState && bloxSpinState.spinning) {
        bloxSpinState.spinning = false;
        bloxSpinState.renderer.render(bloxSpinState.scene, bloxSpinState.camera);
    }
}

/** The most recent run's error message, '' when the last run was clean. */
let acbLastRunError = '';

/**
 * Turns a JavaScript runtime error into learner language, pointing at the
 * kind of block to check.
 */
function translateRunError(message) {
    const undef = String(message).match(/^(\w+) is not defined/);
    if (undef) {
        return `Your program mentions a variable named "${undef[1]}" that ` +
            'never got a value. Check your set blocks: is it created and ' +
            'set before it is used?';
    }
    if (/Maximum call stack|too much recursion/i.test(message)) {
        return 'The program calls itself round and round without a way to ' +
            'stop. Check the condition that should end the loop or function.';
    }
    if (/is not a function/.test(message)) {
        return 'The program tried to use something as an action that is ' +
            'not one. Check the blocks that changed most recently.';
    }
    return `The program stopped with: "${message}". Read your Output up to ` +
        'that point; the last printed line shows how far it got.';
}

/* ------------------------------------------------------------------------ */
/* Ghost cursor: an animated pointing hand that glides to whatever the      */
/* learner should look at. Decoration, never a requirement — every place    */
/* it points is also announced in text.                                     */
/* ------------------------------------------------------------------------ */

function ghostCursorElement() {
    let el = document.getElementById('acbGhostCursor');
    if (!el) {
        el = document.createElement('div');
        el.id = 'acbGhostCursor';
        el.className = 'acb-ghost-cursor';
        el.setAttribute('aria-hidden', 'true');
        el.textContent = '👆';
        document.body.appendChild(el);
    }
    return el;
}

function hideGhostCursor() {
    const el = document.getElementById('acbGhostCursor');
    if (el) el.classList.remove('is-visible', 'is-bouncing');
    clearTimeout(hideGhostCursor._timer);
}

function pointGhostCursorAt(target) {
    if (!target || !target.getBoundingClientRect) return;
    const rect = target.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const el = ghostCursorElement();
    const reduced =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.body.classList.contains('acb-no-motion');
    const endX = rect.left + rect.width / 2;
    const endY = rect.top + rect.height / 2 + 6;

    clearTimeout(hideGhostCursor._timer);
    el.classList.remove('is-bouncing');
    if (reduced) {
        // No gliding for reduced-motion users: appear at the target.
        el.style.transition = 'none';
        el.style.left = endX + 'px';
        el.style.top = endY + 'px';
        el.classList.add('is-visible');
    } else {
        const workspaceRect =
            document.getElementById('blocklyDiv').getBoundingClientRect();
        el.style.transition = 'none';
        el.style.left = (workspaceRect.left + workspaceRect.width / 2) + 'px';
        el.style.top = (workspaceRect.top + workspaceRect.height / 2) + 'px';
        el.classList.add('is-visible');
        void el.offsetWidth;  // flush, so the glide animates
        el.style.transition = '';
        el.style.left = endX + 'px';
        el.style.top = endY + 'px';
        setTimeout(() => el.classList.add('is-bouncing'), 950);
    }
    hideGhostCursor._timer = setTimeout(hideGhostCursor, 4500);
}

function showXpToast(text) {
    const toast = document.getElementById('xpToast');
    const toastText = document.getElementById('xpToastText');
    if (!toast || !toastText) return;
    toastText.textContent = text;
    toast.hidden = false;
    clearTimeout(showXpToast._timer);
    showXpToast._timer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function setupQuests(workspace) {
    const select = document.getElementById('taskSelect');
    const nowCard = document.getElementById('nowCard');
    if (!select || !nowCard || typeof TaskEngine !== 'function' ||
        typeof ACB_TASKS === 'undefined') return;

    acbTaskEngine = new TaskEngine();

    /** Whether the learner flipped the toolbox to show everything. */
    let showAllBlocks = false;

    document.getElementById('nowCardAllBlocks')?.addEventListener('click', () => {
        showAllBlocks = !showAllBlocks;
        const button = document.getElementById('nowCardAllBlocks');
        button.setAttribute('aria-pressed', String(showAllBlocks));
        button.textContent = showAllBlocks ?
            'Only this step’s blocks ▸' : 'All blocks ▸';
        const step = acbTaskEngine.currentStep();
        if (!step) return;
        if (showAllBlocks) { restoreToolbox(); } else { narrowToolbox(step.blocks); }
    });

    // Fill the picker, grouped by level.
    const groups = {beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced'};
    for (const [level, label] of Object.entries(groups)) {
        const group = document.createElement('optgroup');
        group.label = label;
        for (const task of ACB_TASKS.filter((t) => t.level === level)) {
            const problems = validateTask(task);
            if (problems.length) {
                console.error(`Task ${task.id} skipped: ${problems.join('; ')}`);
                continue;
            }
            const option = document.createElement('option');
            option.value = task.id;
            option.textContent = task.title;
            group.appendChild(option);
        }
        select.appendChild(group);
    }

    // AI-authored challenges: saved locally, listed under their own group,
    // created via the "My own challenge" entry at the bottom.
    const customGroup = document.createElement('optgroup');
    customGroup.label = 'My challenges';
    customGroup.hidden = true;
    select.appendChild(customGroup);
    const customOption = document.createElement('option');
    customOption.value = '__custom';
    customOption.textContent = '✨ My own challenge…';
    select.appendChild(customOption);

    const loadCustomTasks = () => {
        try {
            return JSON.parse(localStorage.getItem('acb.customTasks') || '[]');
        } catch (e) {
            return [];
        }
    };
    const addCustomOption = (task) => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = `✨ ${task.title}`;
        customGroup.appendChild(option);
        customGroup.hidden = false;
    };
    for (const task of loadCustomTasks()) {
        if (!validateTask(task).length) {
            ACB_TASKS.push(task);
            addCustomOption(task);
        }
    }

    const narrowToolbox = (blocks) => {
        if (typeof filterToolboxDef !== 'function' ||
            typeof toolboxConfig === 'undefined') return;
        const allowed = [...blocks];
        if (blocks.some((b) => b.startsWith('variables_') || b === 'math_change')) {
            allowed.push('VARIABLE');
        }
        workspace.updateToolbox(filterToolboxDef(toolboxConfig, allowed));
        // Keep Focus Mode's own filter in agreement.
        if (typeof getFocusMode === 'function') {
            getFocusMode()?.setStepBlocks(allowed);
        }
    };

    const restoreToolbox = () => {
        if (typeof toolboxConfig !== 'undefined') {
            workspace.updateToolbox(toolboxConfig);
        }
    };

    /** Parsons seeding: scatter the step's given pieces on an empty canvas. */
    const seedParsons = (step) => {
        if (workspace.getAllBlocks(false).length) return;
        step.parsons.forEach((state, i) => {
            try {
                const block = Blockly.serialization.blocks.append(
                    state, workspace);
                block.moveBy(40 + (i % 2) * 280, 30 + Math.floor(i / 2) * 130);
            } catch (e) { /* a bad piece is skipped, not fatal */ }
        });
    };

    const renderPips = () => {
        const pips = document.getElementById('questPips');
        const steps = document.getElementById('questSteps');
        if (!pips || !steps) return;
        if (!acbTaskEngine.task) {
            pips.hidden = true;
            steps.hidden = true;
            return;
        }
        pips.innerHTML = '';
        for (let i = 0; i < acbTaskEngine.stepCount(); i++) {
            const pip = document.createElement('span');
            pip.className = 'quest-bar__pip' +
                (i < acbTaskEngine.stepIndex ? ' quest-bar__pip--done' :
                 i === acbTaskEngine.stepIndex ? ' quest-bar__pip--current' : '');
            pips.appendChild(pip);
        }
        pips.hidden = false;
        steps.textContent =
            `step ${acbTaskEngine.stepNumber()} of ${acbTaskEngine.stepCount()}`;
        steps.hidden = false;
    };

    const renderStep = () => {
        const step = acbTaskEngine.currentStep();
        if (!step) {
            nowCard.hidden = true;
            renderPips();
            return;
        }
        document.getElementById('nowCardStepNum').textContent =
            String(acbTaskEngine.stepNumber());
        const xpTag = document.getElementById('nowCardXp');
        if (xpTag) xpTag.textContent = `· worth ${acbTaskEngine.currentStepXp()} XP`;
        document.getElementById('nowCardText').textContent = step.text;
        // Auto-checked steps advance by themselves; the button demotes to a
        // quiet escape hatch so nobody is ever trapped by a detector bug.
        const doneButton = document.getElementById('nowCardDone');
        if (step.check) {
            doneButton.textContent = 'Skip this step →';
            doneButton.className =
                'now-card__button now-card__button--secondary';
        } else {
            doneButton.textContent =
                acbTaskEngine.onLastStep() ? 'Finish quest ✓' : 'Done, next step';
            doneButton.className =
                'now-card__button now-card__button--primary';
        }
        // Back only exists once there is somewhere to go back to.
        const backButton = document.getElementById('nowCardBack');
        if (backButton) backButton.hidden = acbTaskEngine.stepIndex === 0;
        nowCard.hidden = false;
        hideCoachHint();
        if (step.parsons) {
            // Parsons mode: every piece is already on the canvas, scrambled.
            narrowToolbox([]);
            seedParsons(step);
        } else if (showAllBlocks) {
            restoreToolbox();
        } else {
            narrowToolbox(step.blocks);
        }
        renderStepChips(step.parsons ? {blocks: []} : step);
        renderPips();
        renderChecklist();
    };

    /**
     * The quest's full step list in the coach panel, finished steps struck
     * out - the satisfying part of crossing things off, without the
     * overwhelm of showing details for steps not yet reached.
     */
    const renderChecklist = () => {
        const holder = document.getElementById('coachChecklist');
        const list = document.getElementById('coachChecklistItems');
        if (!holder || !list) return;
        if (!acbTaskEngine.task) {
            holder.hidden = true;
            return;
        }
        list.innerHTML = '';
        acbTaskEngine.task.steps.forEach((step, i) => {
            const item = document.createElement('li');
            item.className = 'coach-checklist__item' +
                (i < acbTaskEngine.stepIndex ? ' is-done' :
                 i === acbTaskEngine.stepIndex ? ' is-current' : '');
            item.textContent = i <= acbTaskEngine.stepIndex ?
                step.text : '· · ·';
            if (i < acbTaskEngine.stepIndex) {
                item.setAttribute('aria-label', `Done: ${step.text}`);
            }
            list.appendChild(item);
        });
        holder.hidden = false;
    };

    /**
     * "For this step" chips: one per needed block, click to be walked to
     * it (right drawer opens, the block glows, the hand points). The
     * design's "no hunting" panel, living on the NOW card.
     */
    const renderStepChips = (step) => {
        const holder = document.getElementById('nowCardBlocks');
        if (!holder) return;
        holder.innerHTML = '';
        const seen = new Set();
        for (const type of step.blocks) {
            if (seen.has(type)) continue;
            seen.add(type);
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'now-card__block-chip';
            chip.textContent = (typeof labelForBlockType === 'function') ?
                labelForBlockType(type) : type;
            chip.title = 'Show me this block';
            chip.addEventListener('click', () => guideToBlock(type));
            holder.appendChild(chip);
        }
    };

    /** Opens the right drawer and glows the block of the given type. */
    const guideToBlock = (type) => {
        nudgeType = type;
        const categoryName = categoryNameForBlock(type);
        if (!categoryName) return;
        const toolbox = workspace.getToolbox && workspace.getToolbox();
        if (!toolbox) return;
        const item = toolbox.getToolboxItems().find(
            (i) => i.getName && i.getName() === categoryName);
        if (item) toolbox.setSelectedItem(item);
    };

    /* ---- "My own challenge": AI decomposition of any problem ---------- */

    const challengeModal = document.getElementById('challengeModal');
    const challengeStatus = document.getElementById('challengeStatus');

    const closeChallengeModal = () => {
        if (challengeModal) challengeModal.hidden = true;
        if (challengeStatus) challengeStatus.textContent = '';
    };

    document.getElementById('challengeCancel')?.addEventListener('click', () => {
        closeChallengeModal();
        select.value = '';
    });

    // "Level" decides how the coach sizes the steps, the vocabulary of
    // blocks, and the XP (100/150/200). The ? dot explains in place.
    const LEVEL_HINTS = {
        beginner: 'Beginner: first steps. Tiny steps, few block types, ' +
            'lots of guidance. Worth 100 XP.',
        intermediate: 'Intermediate: comfortable with loops and variables. ' +
            'Steps assume some basics. Worth 150 XP.',
        advanced: 'Advanced: multi-part logic like FizzBuzz. Fewer, bigger ' +
            'steps. Worth 200 XP.',
    };
    const levelSelect = document.getElementById('challengeLevel');
    const levelHint = document.getElementById('challengeLevelHint');
    const paintLevelHint = () => {
        if (levelHint && !levelHint.hidden) {
            levelHint.textContent = LEVEL_HINTS[levelSelect?.value] || '';
        }
    };
    document.getElementById('challengeLevelHelp')?.addEventListener('click', () => {
        if (!levelHint) return;
        levelHint.hidden = !levelHint.hidden;
        paintLevelHint();
    });
    levelSelect?.addEventListener('change', paintLevelHint);

    // No idea of their own, no teacher assignment: one press invents one.
    const SURPRISE_TOPICS = [
        'a short story generator that mixes a hero, a place, and a twist',
        'a countdown that launches something exciting',
        'a times-table quiz that prints question and answer',
        'a pattern printer that draws shapes from characters',
        'a savings tracker that adds pocket money week by week',
        'a dice game that prints rolls until a six appears',
        'a temperature converter between Celsius and Fahrenheit',
        'a secret-code maker that shifts letters in a word',
    ];
    document.getElementById('challengeSurprise')?.addEventListener('click', () => {
        const box = document.getElementById('challengeText');
        if (!box) return;
        box.value = SURPRISE_TOPICS[
            Math.floor(Math.random() * SURPRISE_TOPICS.length)];
        document.getElementById('challengeCreate')?.click();
    });

    document.getElementById('challengeCreate')?.addEventListener('click', async () => {
        const topic = document.getElementById('challengeText')?.value.trim();
        const level = document.getElementById('challengeLevel')?.value || 'intermediate';
        if (!topic) {
            challengeStatus.textContent = 'Describe the problem first, or ' +
                'press Surprise me.';
            return;
        }
        if (!acbAiCoachAvailable) {
            challengeStatus.textContent = 'Reaching the coach server… ' +
                '(a sleeping server can take up to a minute)';
            const ok = await acbCheckCoachHealth(45000);
            if (!ok) {
                challengeStatus.textContent = 'The coach server is not ' +
                    'answering. If it was asleep it may need a minute - ' +
                    'try once more.';
                return;
            }
        }
        challengeStatus.textContent =
            'Blox is designing your quest… (up to a minute)';
        const createButton = document.getElementById('challengeCreate');
        createButton.disabled = true;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 60000);
            const response = await fetch(`${ACB_COACH_SERVER}/author`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({level, topic}),
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (!response.ok) {
                let detail = '';
                try { detail = (await response.json()).detail || ''; }
                catch (e2) { /* no detail */ }
                throw new Error(detail || `server said ${response.status}`);
            }
            const {task} = await response.json();
            // Never trust generated content without the same validation
            // authored tasks get; also make the id collision-proof.
            task.id = `custom-${task.id}-${Date.now().toString(36)}`.slice(0, 40);
            const problems = validateTask(task);
            if (problems.length) throw new Error(problems.join('; '));
            const saved = loadCustomTasks();
            saved.push(task);
            try { localStorage.setItem('acb.customTasks', JSON.stringify(saved)); }
            catch (e) { /* it just will not persist */ }
            ACB_TASKS.push(task);
            addCustomOption(task);
            closeChallengeModal();
            document.dispatchEvent(new CustomEvent('acb-challenge-created'));
            select.value = task.id;
            select.dispatchEvent(new Event('change'));
        } catch (e) {
            challengeStatus.textContent = e.name === 'AbortError' ?
                'The coach took too long. Try once more; a simpler wording ' +
                'can help.' :
                `That did not work: ${e.message}. If the server was just ` +
                'updated, restart it (Ctrl+C, then node index.js).';
        } finally {
            createButton.disabled = false;
        }
    });

    select.addEventListener('change', () => {
        if (select.value === '__custom') {
            if (challengeModal) {
                challengeModal.hidden = false;
                document.getElementById('challengeText')?.focus();
            }
            return;
        }
        const task = ACB_TASKS.find((t) => t.id === select.value);
        if (!task) {
            acbTaskEngine.exit();
            nowCard.hidden = true;
            restoreToolbox();
            renderPips();
            return;
        }
        // A quest starts on a fresh canvas — unless it declares that it
        // builds on the blocks already there (task.relatedTo lists quest
        // ids whose workspace should carry over).
        let previousQuest = null;
        try { previousQuest = localStorage.getItem('acb.workspaceQuest'); }
        catch (e) { /* fine */ }
        const carriesOver = previousQuest &&
            (task.relatedTo || []).includes(previousQuest);
        try { localStorage.setItem('acb.workspaceQuest', task.id); }
        catch (e) { /* fine */ }
        showAllBlocks = false;
        const allBlocksButton = document.getElementById('nowCardAllBlocks');
        if (allBlocksButton) {
            allBlocksButton.setAttribute('aria-pressed', 'false');
            allBlocksButton.textContent = 'All blocks ▸';
        }
        acbTaskEngine.start(task);
        // The rule: a quest STARTING FRESH (step 1) begins on a clean
        // canvas, so free-built blocks never haunt it; RESUMING mid-quest
        // keeps the learner's work; relatedTo carries blocks deliberately.
        if (!carriesOver && acbTaskEngine.stepNumber() === 1 &&
            workspace.getAllBlocks(false).length) {
            workspace.clear();
            if (typeof clearOutput === 'function') clearOutput();
        }
        coachSay(acbTaskEngine.stepNumber() > 1 ?
            `Welcome back to "${task.title}". You were on step ` +
                `${acbTaskEngine.stepNumber()}. Keep going!` :
            `"${task.title}": ${task.quest}. One small step at a time.`);
        renderStep();
    });

    /**
     * A finished quest is the learner's moment: their blocks and their
     * output STAY on screen, and a small card offers the choice - roll on
     * to the next quest, or stay and savour the thing they just built.
     */
    const handleQuestComplete = (result) => {
        showXpToast(`Quest complete! +${result.xpAwarded} XP 🏁`);
        select.value = '';
        try { localStorage.removeItem('acb.workspaceQuest'); }
        catch (e) { /* fine */ }
        restoreToolbox();
        renderStep();

        // The finished checklist is the payoff: every step struck out,
        // the LAST one included, instead of the list vanishing the
        // moment the quest completes.
        const holder = document.getElementById('coachChecklist');
        const list = document.getElementById('coachChecklistItems');
        if (holder && list) {
            list.innerHTML = '';
            result.task.steps.forEach((step) => {
                const item = document.createElement('li');
                item.className = 'coach-checklist__item is-done';
                item.textContent = step.text;
                item.setAttribute('aria-label', `Done: ${step.text}`);
                list.appendChild(item);
            });
            holder.hidden = false;
        }

        const doneCard = document.getElementById('questDoneCard');
        const doneText = document.getElementById('questDoneText');
        const nextButton = document.getElementById('questDoneNext');
        const stayButton = document.getElementById('questDoneStay');
        const index = ACB_TASKS.findIndex((t) => t.id === result.task.id);
        const next = ACB_TASKS[index + 1];

        if (!doneCard || !doneText || !nextButton || !stayButton) return;
        doneText.textContent = next ?
            `You built "${result.task.title}"! Your program and its output ` +
            'are still here to look at.' :
            `You built "${result.task.title}" and finished the whole ` +
            'catalog! The canvas is yours.';
        nextButton.hidden = !next;
        if (next) nextButton.textContent = `Next quest: ${next.title} →`;
        nextButton.onclick = () => {
            doneCard.hidden = true;
            workspace.clear();
            if (typeof clearOutput === 'function') clearOutput();
            select.value = next.id;
            select.dispatchEvent(new Event('change'));
        };
        stayButton.onclick = () => { doneCard.hidden = true; };
        doneCard.hidden = false;
        coachSay(`You finished "${result.task.title}"! Take a moment with ` +
            'your output, and move on whenever you choose.');
    };

    // Any manual quest pick puts the completion card away.
    select.addEventListener('change', () => {
        const doneCard = document.getElementById('questDoneCard');
        if (doneCard) doneCard.hidden = true;
    });

    // Finishing a quest is a one-way door, so the final press asks for a
    // deliberate second tap - an accidental click must never end a quest.
    let finishArmed = null;
    document.getElementById('nowCardDone')?.addEventListener('click', () => {
        const doneButton = document.getElementById('nowCardDone');
        if (acbTaskEngine.onLastStep()) {
            if (!finishArmed) {
                finishArmed = setTimeout(() => {
                    finishArmed = null;
                    renderStep();  // restore the normal label
                }, 4000);
                doneButton.textContent = 'Sure? Tap again to finish';
                return;
            }
            clearTimeout(finishArmed);
            finishArmed = null;
        }
        const stepNum = acbTaskEngine.stepNumber();
        const result = acbTaskEngine.markStepDone();
        if (result.taskComplete) {
            handleQuestComplete(result);
        } else {
            showXpToast(`Step ${stepNum} complete · +${result.xpAwarded} XP`);
            renderStep();
        }
    });

    // The card must never cover the learner's blocks. Default is
    // "dock": the card sits in its own strip below the canvas and the
    // canvas SHRINKS to make room - nothing is ever hidden behind it,
    // at any zoom or text size. Move cycles the other placements for
    // anyone who prefers the floating card.
    const nowPositions = ['dock', 'center', 'left', 'min'];
    const applyNowPos = (pos) => {
        nowCard.classList.toggle('now-card--dock', pos === 'dock');
        nowCard.classList.toggle('now-card--left', pos === 'left');
        nowCard.classList.toggle('now-card--min', pos === 'min');
        document.body.classList.toggle('acb-now-dock', pos === 'dock');
        const moveButton = document.getElementById('nowCardMove');
        if (moveButton) {
            moveButton.textContent = pos === 'min' ? 'Expand' : 'Move';
        }
        // The canvas changed size; Blockly has to re-measure or the
        // right edge of the workspace goes dead.
        try { Blockly.svgResize(Blockly.getMainWorkspace()); }
        catch (e) { /* fine */ }
    };
    let nowPos = 'dock';
    try { nowPos = localStorage.getItem('acb.nowCardPos') || 'dock'; }
    catch (e) { /* fine */ }
    if (!nowPositions.includes(nowPos)) nowPos = 'dock';
    applyNowPos(nowPos);
    // Whenever the canvas strip changes size (card appears, grows with
    // text size, browser zoom), Blockly must re-measure itself or the
    // freed space goes dead.
    if (window.ResizeObserver) {
        const canvasBox = document.getElementById('blocklyDiv');
        if (canvasBox) {
            new ResizeObserver(() => {
                try { Blockly.svgResize(Blockly.getMainWorkspace()); }
                catch (e) { /* fine */ }
            }).observe(canvasBox);
        }
    }
    document.getElementById('nowCardMove')?.addEventListener('click', () => {
        nowPos = nowPositions[
            (nowPositions.indexOf(nowPos) + 1) % nowPositions.length];
        try { localStorage.setItem('acb.nowCardPos', nowPos); }
        catch (e) { /* fine */ }
        applyNowPos(nowPos);
    });

    document.getElementById('nowCardStuck')?.addEventListener('click', () => {
        // Blox answers in the coach card, and the Animation tab hides
        // that card - so a click there would burn a hint invisibly.
        // Come back to Output first, then let Blox respond in view.
        const animTab = document.getElementById('animTabButton');
        if (animTab?.getAttribute('aria-selected') === 'true' &&
            typeof window.acbSelectIoTab === 'function') {
            window.acbSelectIoTab('output');
        }
        revealNextHint();
    });

    document.getElementById('nowCardSpeak')?.addEventListener('click', () => {
        const step = acbTaskEngine.currentStep();
        if (step && typeof acbSpeak === 'function') {
            acbSpeak(`Step ${acbTaskEngine.stepNumber()}. ${step.text}`);
        }
    });

    document.getElementById('nowCardRestart')?.addEventListener('click', () => {
        if (!acbTaskEngine.task) return;
        acbTaskEngine.restart();
        coachSay('Back to step 1. Fresh eyes help!');
        renderStep();
    });

    // One step back - the undo for a hasty "Skip this step". Start over
    // stays for going all the way back to step 1.
    document.getElementById('nowCardBack')?.addEventListener('click', () => {
        if (!acbTaskEngine.task || acbTaskEngine.stepIndex === 0) return;
        acbTaskEngine.stepIndex--;
        acbTaskEngine.hintsUsed = 0;
        try {
            acbTaskEngine._writeProgress(
                acbTaskEngine.task.id, acbTaskEngine.stepIndex);
        } catch (e) { /* progress persistence is best-effort */ }
        coachSay('Back one step. Your blocks are all still here.');
        renderStep();
    });

    // "Start fresh" on the welcome-back card means fresh: quest progress
    // clears along with the saved workspace.
    document.addEventListener('acb-session-resume', (event) => {
        if (event.detail?.action !== 'fresh') return;
        try {
            const stale = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('acb.task.')) stale.push(key);
            }
            stale.forEach((key) => localStorage.removeItem(key));
        } catch (e) { /* fine */ }
        if (acbTaskEngine.task) {
            acbTaskEngine.restart();
            renderStep();
        }
    });

    /* ---- Guided nudge (Swift Playgrounds style, gentle version) ------ */
    /* If the learner sits on a step for a while without touching the      */
    /* workspace, the toolbox drawer holding that step's blocks glows and  */
    /* the coach points at it. Any edit clears and re-arms the timer.      */

    const IDLE_NUDGE_MS = () => Number(window.ACB_IDLE_NUDGE_MS) || 20000;
    let idleTimer = null;

    const categoryNameForBlock = (type) => {
        if (typeof toolboxConfig === 'undefined') return null;
        for (const item of toolboxConfig.contents || []) {
            if (String(item.kind).toLowerCase() !== 'category') continue;
            if (item.custom === 'VARIABLE' &&
                (type.startsWith('variables_') || type === 'math_change')) {
                return item.name;
            }
            for (const inner of item.contents || []) {
                if (inner.type === type) return item.name;
            }
        }
        return null;
    };

    /** Block type the active nudge is pointing at, or null. */
    let nudgeType = null;

    const clearNudge = () => {
        nudgeType = null;
        document.querySelectorAll('.blocklyTreeRow.acb-nudge')
            .forEach((row) => row.classList.remove('acb-nudge'));
        document.querySelectorAll('.acb-block-glow')
            .forEach((el) => el.classList.remove('acb-block-glow'));
        document.querySelectorAll('.acb-button-glow')
            .forEach((el) => el.classList.remove('acb-button-glow'));
        document.querySelectorAll('.acb-el-glow')
            .forEach((el) => el.classList.remove('acb-el-glow'));
        hideGhostCursor();
    };

    /**
     * What the learner should look at next, from the checker's own eyes:
     * {kind: 'block'|'nesting'|'field'|'stack'|'output', type}. 'block'
     * means fetch from the toolbox; everything else lives on the canvas
     * or the Run button.
     */
    const nudgeTarget = () => {
        const step = acbTaskEngine.currentStep();
        if (!step) return null;
        if (step.check && typeof extractFacts === 'function' &&
            typeof checkSatisfied === 'function') {
            const verdict = checkSatisfied(
                step.check, extractFacts(workspace), acbLastRunOutput);
            if (verdict.missingDetails && verdict.missingDetails.length) {
                return verdict.missingDetails[0];
            }
        }
        // No authored check (custom AI quests): fall back to presence -
        // point only at a block type NOT yet on the canvas, and stay
        // quiet when everything the step lists is already placed.
        const placed = new Set(
            workspace.getAllBlocks(false).map((b) => b.type));
        const absent = step.blocks.find((type) => !placed.has(type));
        return absent ? {kind: 'block', type: absent} : null;
    };

    /**
     * Glows the nudge target inside the open flyout: the block itself, or
     * the drawer's button (the Variables drawer shows only "Create
     * variable" until one exists, and that button IS the next move).
     * @returns {boolean} Whether something in the flyout was highlighted.
     */
    const highlightFlyoutTarget = () => {
        if (!nudgeType) return false;
        const flyout = workspace.getFlyout && workspace.getFlyout();
        if (!flyout || !flyout.isVisible()) return false;
        const match = flyout.getWorkspace().getAllBlocks(false)
            .find((b) => b.type === nudgeType);
        if (match && match.getSvgRoot) {
            const svg = match.getSvgRoot();
            svg.classList.add('acb-block-glow');
            pointGhostCursorAt(svg);
            return true;
        }
        const flyoutButton =
            document.querySelector('.blocklyFlyout .blocklyFlyoutButton');
        if (flyoutButton) {
            flyoutButton.classList.add('acb-button-glow');
            pointGhostCursorAt(flyoutButton);
            return true;
        }
        return false;
    };

    const fireNudge = () => {
        const step = acbTaskEngine.currentStep();
        if (!step || document.visibilityState === 'hidden') {
            armNudge();
            return;
        }
        // A break is rest, not idleness - and the same goes for replay,
        // the walkthrough tour, and a live stepper session. The hand
        // stays away and tries again later.
        if (document.body.classList.contains('acb-break-open') ||
            (typeof acbReplay !== 'undefined' && acbReplay) ||
            (typeof acbWalk !== 'undefined' && acbWalk) ||
            (typeof acbStepSession !== 'undefined' && acbStepSession)) {
            armNudge();
            return;
        }
        // Reading one of Blox's answers is engagement, not idleness.
        // Leave the reply on screen; try again later.
        if (Date.now() - (window.acbAiAnswerAt || 0) < 120000) {
            armNudge();
            return;
        }
        // Watching the launch animation is engagement too: no pointing
        // hand while the Animation tab is open or a flight is playing.
        if (document.body.classList.contains('acb-anim-tab') ||
            (typeof acbRocketBusy !== 'undefined' && acbRocketBusy)) {
            armNudge();
            return;
        }
        clearNudge();
        const target = nudgeTarget();
        if (!target) return;

        // The checker sees the whole environment; point where the actual
        // gap is: canvas, Run button, or toolbox.
        if (target.kind === 'field' || target.kind === 'nesting') {
            const canvasBlock = workspace.getAllBlocks(false)
                .find((b) => b.type === target.type);
            if (canvasBlock && canvasBlock.getSvgRoot) {
                const svg = canvasBlock.getSvgRoot();
                svg.classList.add('acb-block-glow');
                pointGhostCursorAt(svg);
                coachSay(target.kind === 'field' ?
                    'The block you need is already on your canvas. It is ' +
                    'glowing; click the value on it and change what it says.' :
                    'The glowing block on your canvas is in the wrong spot. ' +
                    'Drag it inside its container.');
                armNudge();
                return;
            }
        }
        if (target.kind === 'output') {
            const runButton = document.getElementById('runButton');
            if (runButton) {
                runButton.classList.add('acb-el-glow');
                pointGhostCursorAt(runButton);
                coachSay('Everything looks placed. Press the glowing Run ' +
                    'button to see your program work.');
                armNudge();
                return;
            }
        }
        if (target.kind === 'stack') {
            const top = workspace.getTopBlocks(false)[1];
            if (top && top.getSvgRoot) {
                const svg = top.getSvgRoot();
                svg.classList.add('acb-block-glow');
                pointGhostCursorAt(svg);
                coachSay('Your blocks are in separate stacks; only connected ' +
                    'blocks run together. Snap the glowing one onto the rest.');
                armNudge();
                return;
            }
        }

        // Default: fetch a block from the toolbox.
        nudgeType = target.type;
        const categoryName = nudgeType && categoryNameForBlock(nudgeType);
        if (!categoryName) return;

        // If the right drawer is already open, point inside it instead of
        // telling the learner to open what they already opened.
        const toolbox = workspace.getToolbox && workspace.getToolbox();
        const selected = toolbox && toolbox.getSelectedItem &&
            toolbox.getSelectedItem();
        const rightDrawerOpen = selected && selected.getName &&
            selected.getName() === categoryName &&
            workspace.getFlyout() && workspace.getFlyout().isVisible();
        if (rightDrawerOpen && highlightFlyoutTarget()) {
            coachSay('No rush! The glowing piece in the open drawer is ' +
                'the one this step needs.');
            armNudge();
            return;
        }

        let targetRow = null;
        for (const label of document.querySelectorAll('.blocklyTreeLabel')) {
            if (label.textContent === categoryName) {
                targetRow = label.closest('.blocklyTreeRow');
                break;
            }
        }
        if (!targetRow) return;
        targetRow.classList.add('acb-nudge');
        pointGhostCursorAt(targetRow);
        // Acknowledge what is already placed, then name the exact block,
        // so the guide never reads as blind to the learner's progress.
        const blockLabel = (typeof labelForBlockType === 'function') ?
            labelForBlockType(nudgeType) : nudgeType;
        coachSay(workspace.getAllBlocks(false).length ?
            `Good progress, I can see what you have placed. Next you need ` +
            `the "${blockLabel}" block; the ${categoryName} drawer is glowing.` :
            `No rush! The "${blockLabel}" block you need is in the glowing ` +
            `${categoryName} drawer.`);
        armNudge();  // nudge again later if they stay stuck
    };

    // When the learner opens a drawer during a nudge, move the glow and
    // the pointer onto the exact block.
    workspace.addChangeListener((event) => {
        if (!nudgeType) return;
        if (event.type !== Blockly.Events.TOOLBOX_ITEM_SELECT &&
            event.type !== 'toolbox_item_select') return;
        setTimeout(highlightFlyoutTarget, 80);
    });

    const armNudge = () => {
        clearTimeout(idleTimer);
        if (!acbTaskEngine.task) return;
        idleTimer = setTimeout(fireNudge, IDLE_NUDGE_MS());
    };

    // Any interaction means "not idle": real edits, but also UI activity
    // like browsing drawers or selecting blocks. The nudge is for the
    // learner who has genuinely stopped, not the one who is mid-hunt.
    workspace.addChangeListener((event) => {
        if (event && event.isUiEvent) {
            armNudge();  // still active, push the timer back
            return;
        }
        clearNudge();
        armNudge();
    });
    // Typing happens inside Blockly's floating field editor, which lives
    // outside the workspace div, so listen document-wide: any keypress or
    // click anywhere means the learner is active.
    document.addEventListener('pointerdown', () => armNudge(), true);
    document.addEventListener('keydown', () => armNudge(), true);
    document.addEventListener('acb-task', () => {
        clearNudge();
        armNudge();
    });

    /* ---- Auto-magic steps -------------------------------------------- */
    /* The app recognises success instead of being told about it: every    */
    /* workspace edit (debounced) and every finished run re-evaluates the  */
    /* current step's check; a pass celebrates and advances on its own.    */

    const PRAISE = [
        'Yes! That is exactly it.',
        'Got it in one. On to the next!',
        'That clicked into place beautifully.',
        'You are on a roll.',
    ];
    let praiseIndex = 0;
    let advancing = false;
    let checkTimer = null;

    const celebrateAdvance = () => {
        if (advancing) return;
        advancing = true;
        const stepNum = acbTaskEngine.stepNumber();
        const result = acbTaskEngine.markStepDone();
        if (result.taskComplete) {
            handleQuestComplete(result);
        } else {
            showXpToast(`✨ Step ${stepNum} done · +${result.xpAwarded} XP`);
            coachSay(PRAISE[praiseIndex++ % PRAISE.length]);
            renderStep();
        }
        advancing = false;
        // If the workspace already satisfies the next step too (a learner
        // racing ahead), let the next celebration land after a beat.
        if (!result.taskComplete) setTimeout(evaluateStep, 900);
    };

    const evaluateStep = () => {
        const step = acbTaskEngine.currentStep();
        if (!step || !step.check || advancing) return;
        if (typeof extractFacts !== 'function' ||
            typeof checkSatisfied !== 'function') return;
        const facts = extractFacts(workspace);
        const verdict = checkSatisfied(step.check, facts, acbLastRunOutput);
        if (verdict.pass) celebrateAdvance();
    };

    workspace.addChangeListener((event) => {
        if (event && event.isUiEvent) return;
        clearTimeout(checkTimer);
        checkTimer = setTimeout(evaluateStep, 450);
    });
    document.addEventListener('acb-run-finished', () => {
        clearTimeout(checkTimer);
        evaluateStep();
    });
}

/* ------------------------------------------------------------------------ */
/* The AI provider: a guardrailed server proxy (see server/README.md). The   */
/* browser never sees an API key. Every call has a 2.5 second budget; any    */
/* failure falls calmly back to the authored hints and the local debugger,   */
/* so the coach never shows a spinner or an error wall.                      */
/* ------------------------------------------------------------------------ */

let ACB_COACH_SERVER = (() => {
    try {
        return localStorage.getItem('acb.coachServer') ||
            window.FOCUSLY_COACH_URL || 'http://localhost:8124';
    } catch (e) {
        return window.FOCUSLY_COACH_URL || 'http://localhost:8124';
    }
})();

let acbAiCoachAvailable = false;

/**
 * Is the coach server reachable? Self-healing on two fronts: a page
 * loaded while the server was asleep recovers on a later check, and a
 * stale saved server URL falls back to the page default (adopting it
 * and clearing the bad override when the default answers).
 * @param {number=} timeoutMs Per-attempt cap.
 * @returns {!Promise<boolean>}
 */
async function acbCheckCoachHealth(timeoutMs = 12000) {
    const tryUrl = async (url) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const r = await fetch(url + '/health',
                {signal: controller.signal});
            const h = await r.json();
            return !!h.ok;
        } catch (e) {
            return false;
        } finally {
            clearTimeout(timer);
        }
    };
    // Every server this page could talk to, in preference order. The
    // localhost one matters: when the hosted server is unreachable from
    // this network, a coach running on this same machine still rescues
    // the session.
    const candidates = [ACB_COACH_SERVER];
    if (window.FOCUSLY_COACH_URL) {
        candidates.push(window.FOCUSLY_COACH_URL);
    }
    // A locally-running coach is worth a try - but only from a local
    // page: Chrome's private-network rules block public https sites
    // from reaching localhost at all.
    if (window.location.protocol !== 'https:' ||
        ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        candidates.push('http://localhost:8124');
    }
    for (const url of [...new Set(candidates)]) {
        if (await tryUrl(url)) {
            if (url !== ACB_COACH_SERVER) {
                ACB_COACH_SERVER = url;
                try { localStorage.removeItem('acb.coachServer'); }
                catch (e) { /* fine */ }
            }
            acbAiCoachAvailable = true;
            return true;
        }
    }
    acbAiCoachAvailable = false;
    return false;
}
let acbAiCoachEnabled = true;
try { acbAiCoachEnabled = localStorage.getItem('acb.aiCoach') !== 'false'; }
catch (e) { /* fine */ }

function setupAiCoach() {
    const toggle = document.getElementById('aiCoachToggle');
    const status = document.getElementById('aiCoachStatus');
    const paint = () => {
        toggle?.setAttribute('aria-checked', String(acbAiCoachEnabled));
        if (status) {
            status.textContent = !acbAiCoachAvailable ? '(offline)' :
                acbAiCoachEnabled ? '(on)' : '(off)';
        }
    };
    toggle?.addEventListener('click', () => {
        acbAiCoachEnabled = !acbAiCoachEnabled;
        try { localStorage.setItem('acb.aiCoach', String(acbAiCoachEnabled)); }
        catch (e) { /* fine */ }
        paint();
    });
    paint();
    // Check now, and keep checking: a Render server waking from sleep
    // (or one started after this page loaded) comes online without
    // anyone needing to refresh.
    acbCheckCoachHealth().then(paint);
    setInterval(() => { acbCheckCoachHealth().then(paint); }, 30000);
}

/**
 * One guardrailed call to the coach server. Returns the structured reply,
 * or null on any failure or after 2.5s: the caller always has an authored
 * fallback ready.
 */
async function aiCoach(mode, extra = {}, timeoutMs = 2500) {
    if (!acbAiCoachAvailable || !acbAiCoachEnabled) return null;
    const workspace = Blockly.getMainWorkspace();
    if (!workspace || typeof extractFacts !== 'function') return null;
    const step = acbTaskEngine && acbTaskEngine.currentStep();
    const payload = {
        mode,
        facts: extractFacts(workspace),
        lastOutput: (typeof acbLastRunOutput === 'string') ?
            acbLastRunOutput.slice(0, 400) : '',
        lastError: acbLastRunError || '',
        tone: (typeof acbProfile === 'function') ? acbProfile().tone : 'warm',
        task: acbTaskEngine && acbTaskEngine.task ? {
            title: acbTaskEngine.task.title,
            stepIndex: acbTaskEngine.stepNumber(),
            stepCount: acbTaskEngine.stepCount(),
            stepText: step ? step.text : '',
            allowedBlocks: step ? step.blocks : [],
            authoredHints: step ? step.hints : [],
        } : null,
        code: (() => {
            try {
                return String(javascript.javascriptGenerator
                    .workspaceToCode(workspace)).slice(0, 700);
            } catch (e) { return ''; }
        })(),
        gap: (() => {
            try {
                if (!step || !step.check ||
                    typeof checkSatisfied !== 'function') return [];
                const verdict = checkSatisfied(step.check,
                    extractFacts(workspace),
                    (typeof acbLastRunOutput === 'string') ?
                        acbLastRunOutput : '');
                return verdict.pass ? [] : verdict.missing.slice(0, 6);
            } catch (e) { return []; }
        })(),
        ...extra,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${ACB_COACH_SERVER}/coach`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        if (!response.ok) return null;
        const reply = await response.json();
        return (reply && typeof reply.text === 'string') ? reply : null;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/* ------------------------------------------------------------------------ */
/* The Coach: buttons, not chat. Progressive hints, block explainer, and a   */
/* friendly local debugger. Structured, gated, never writes code — the same  */
/* contract a live model must honour when it plugs in behind this panel.     */
/* ------------------------------------------------------------------------ */

/** Hints revealed for the current step, in order, as displayed. */
let acbHintHistory = [];
/** Which revealed hint is on screen (index into acbHintHistory). */
let acbHintView = -1;
/** Guards against double-clicks while an AI hint is loading. */
let acbHintBusy = false;

function hideCoachHint() {
    const hints = document.getElementById('coachHints');
    if (hints) hints.hidden = true;
    const debug = document.getElementById('coachDebugger');
    if (debug) debug.hidden = true;
    acbHintHistory = [];
    acbHintView = -1;
    acbHintBusy = false;
}

/**
 * Shows acbHintHistory[acbHintView] with ◀ to revisit earlier hints and
 * the wide button either walking forward through revealed hints or
 * revealing the next level.
 */
function renderHintView() {
    const hints = document.getElementById('coachHints');
    const text = document.getElementById('coachHintText');
    const more = document.getElementById('coachHintMore');
    const prev = document.getElementById('coachHintPrev');
    if (!hints || !text || !more || !prev) return;
    const current = acbHintHistory[acbHintView];
    if (!current) return;
    text.textContent = current.display;

    prev.hidden = acbHintView === 0;
    prev.onclick = () => {
        if (acbHintView > 0) { acbHintView--; renderHintView(); }
    };

    const atNewest = acbHintView === acbHintHistory.length - 1;
    if (!atNewest) {
        more.textContent = 'Next hint ▶';
        more.hidden = false;
        more.onclick = () => { acbHintView++; renderHintView(); };
    } else if (current.level < 3) {
        more.textContent = `Show hint ${current.level + 1} of 3`;
        more.hidden = false;
        more.onclick = () => revealNextHint();
    } else {
        more.hidden = true;
    }
    hints.hidden = false;
    // A hint nobody sees is a hint wasted: with the box fully laid out
    // (text AND buttons), scroll its bottom edge into view. Instant and
    // direct - smooth scrolls cancel each other, and rAF callbacks never
    // fire in a backgrounded tab.
    try {
        hints.scrollIntoView({block: 'end'});
    } catch (e) { /* fine */ }
}

/** Friendly names for block types, for direct help sentences. */
const ACB_BLOCK_NAMES = {
    'variables_set': 'set variable',
    'variables_get': 'variable',
    'math_change': 'change variable',
    'controls_repeat_ext': 'repeat',
    'text_print': 'print',
    'math_number': 'number',
    'text': 'text',
    'controls_if': 'if',
    'math_number_property': 'is even or odd',
    'math_arithmetic': 'math',
};

function acbBlockName(type) {
    return ACB_BLOCK_NAMES[type] || String(type).replace(/_/g, ' ');
}

/** Which toolbox drawer holds a block type, or null. */
function acbDrawerFor(type) {
    if (typeof toolboxConfig === 'undefined') return null;
    for (const item of toolboxConfig.contents || []) {
        if (String(item.kind).toLowerCase() !== 'category') continue;
        if (item.custom === 'VARIABLE' &&
            (type.startsWith('variables_') || type === 'math_change')) {
            return item.name;
        }
        for (const inner of item.contents || []) {
            if (inner.type === type) return item.name;
        }
    }
    return null;
}

/**
 * Direct help, read straight off the learner's workspace: exactly which
 * blocks to remove, add, move, or retype for the CURRENT step. Returns
 * null when the step has no authored check to diagnose against.
 * @returns {?Array<string>} Concrete fix-it lines, in order.
 */
function acbStuckDiagnosis() {
    if (!acbTaskEngine || !acbTaskEngine.task) return null;
    const step = acbTaskEngine.currentStep();
    if (!step || !step.check) return null;
    if (typeof extractFacts !== 'function' ||
        typeof checkSatisfied !== 'function') return null;
    const workspace = Blockly.getMainWorkspace();
    if (!workspace) return null;
    const facts = extractFacts(workspace);
    const output = (typeof acbLastRunOutput === 'string') ?
        acbLastRunOutput : '';
    const lines = [];
    const has = (type) => facts.blocks.some((b) => b.type === type);

    // Junk first: block types no step of this quest ever uses. Value
    // pieces (numbers, text, variable chips) ride attached inside other
    // blocks, so they are never junk on their own.
    const carriers = new Set(['text', 'math_number', 'variables_get',
        'logic_boolean']);
    const allowed = new Set();
    for (const s of acbTaskEngine.task.steps) {
        for (const t of (s.blocks || [])) allowed.add(t);
    }
    const flagged = new Set();
    for (const b of facts.blocks) {
        if (!allowed.has(b.type) && !carriers.has(b.type) &&
            !flagged.has(b.type)) {
            flagged.add(b.type);
            lines.push('Remove the "' + acbBlockName(b.type) +
                '" block. This quest never needs it.');
        }
    }

    const check = step.check;
    for (const want of check.blocks || []) {
        const count = facts.blocks.filter(
            (b) => b.type === want.type).length;
        const need = want.count || 1;
        if (count < need) {
            const drawer = acbDrawerFor(want.type);
            lines.push('Add ' + (need - count > 1 ?
                (need - count) + ' more' : 'a') + ' "' +
                acbBlockName(want.type) + '" block' +
                (drawer ? ' from the ' + drawer + ' drawer' : '') + '.');
        }
    }
    for (const want of check.within || []) {
        const ok = facts.blocks.filter((b) => b.type === want.child &&
            b.ancestors.includes(want.of)).length >= (want.count || 1);
        if (ok) continue;
        if (has(want.child)) {
            lines.push('Move your "' + acbBlockName(want.child) +
                '" block INSIDE the "' + acbBlockName(want.of) +
                '" block.');
        } else {
            const drawer = acbDrawerFor(want.child);
            lines.push('Add a "' + acbBlockName(want.child) + '" block' +
                (drawer ? ' from the ' + drawer + ' drawer' : '') +
                ' and snap it inside the "' + acbBlockName(want.of) +
                '" block.');
        }
    }
    for (const want of check.fields || []) {
        const hit = facts.blocks.some((b) => {
            if (b.type !== want.type) return false;
            const value = b.fields[want.name];
            if (want.equals !== undefined) {
                return String(value) === String(want.equals);
            }
            if (want.includes !== undefined) {
                return String(value || '').toLowerCase()
                    .includes(String(want.includes).toLowerCase());
            }
            return value !== undefined;
        });
        if (hit) continue;
        const wanted = want.equals !== undefined ?
            want.equals : want.includes;
        if (want.type === 'text') {
            lines.push('Click the text box between the quotes and ' +
                'type: ' + wanted);
        } else if (want.equals !== undefined) {
            lines.push(has(want.type) ?
                'Click the value on a "' + acbBlockName(want.type) +
                    '" block and type ' + want.equals + '.' :
                'You need a "' + acbBlockName(want.type) +
                    '" block set to ' + want.equals + '.');
        } else if (want.includes !== undefined) {
            lines.push('Change the text so it says "' +
                want.includes + '".');
        }
    }
    if (check.singleStack && facts.topStacks !== 1) {
        lines.push('Snap all your blocks into ONE connected stack.');
    }
    if (check.output && lines.length === 0) {
        const needles = [].concat(check.output.includes);
        const unmet = needles.filter((n) => n !== undefined &&
            !String(output).toLowerCase()
                .includes(String(n).toLowerCase()));
        if (unmet.length) {
            lines.push(output ?
                'Run again. The output still needs to show ' +
                    unmet.map((m) => '"' + m + '"').join(' and ') + '.' :
                'Your blocks look placed. Press "Run my code" so the ' +
                    'output can be checked.');
        }
    }
    if (!lines.length) {
        lines.push('Everything for this step looks right. Press ' +
            '"Run my code", then "Done, next step".');
    }
    return lines;
}

async function revealNextHint() {
    if (!acbTaskEngine || !acbTaskEngine.currentStep()) {
        coachSay('Pick a quest first, then I can give you step-by-step hints.');
        return;
    }
    if (acbHintBusy) return;  // a slow AI reply must not skip levels

    // Direct help beats a riddle: when the step has an authored check,
    // read the learner's actual workspace and say exactly what to fix.
    // Every press re-reads the workspace, so the advice stays current.
    const direct = acbStuckDiagnosis();
    if (direct) {
        acbTaskEngine.nextHint();       // keep help accounting honest
        const display = 'Here is exactly what to do:\n' +
            direct.map((l, i) => (i + 1) + '. ' + l).join('\n');
        const newest = acbHintHistory[acbHintHistory.length - 1];
        if (!newest || newest.display !== display) {
            acbHintHistory.push({level: 3, display});
        }
        acbHintView = acbHintHistory.length - 1;
        renderHintView();
        return;
    }
    acbHintBusy = true;
    const more = document.getElementById('coachHintMore');
    if (more) more.disabled = true;
    try {
        const hint = acbTaskEngine.nextHint();
        if (!hint) return;
        // Show the wait, never a blank.
        const hintsBox = document.getElementById('coachHints');
        const hintText = document.getElementById('coachHintText');
        if (hintsBox && hintText && acbAiCoachAvailable && acbAiCoachEnabled) {
            hintText.textContent = 'Finding a good hint…';
            hintsBox.hidden = false;
        }
        // The ladder ends at 3: asking again just shows it, no duplicate.
        const newest = acbHintHistory[acbHintHistory.length - 1];
        if (newest && newest.level === 3 && hint.level === 3) {
            acbHintView = acbHintHistory.length - 1;
            renderHintView();
            return;
        }
        // The engine's gate decides the level; the AI (when on)
        // personalises the wording. Authored text is the instant fallback.
        // The near-answer counts as deep help: the quest quietly pays a
        // little less at the finish (never shown as a minus anywhere).
        if (hint.level === 3) acbTaskEngine.registerHelp(5);
        const ai = await aiCoach('hint', {level: hint.level});
        acbHintHistory.push({
            level: hint.level,
            display: ai && ai.text ?
                `Hint ${hint.level} ✨ ${ai.text}` :
                `Hint ${hint.level}. ${hint.text}`,
        });
        acbHintView = acbHintHistory.length - 1;
        renderHintView();
    } finally {
        acbHintBusy = false;
        if (more) more.disabled = false;
    }
}

/**
 * The block the learner is "on": selection for mouse users, else the
 * keyboard cursor, else the plugin's placement marker. Checking selection
 * alone would silently fail exactly the users this plugin exists for.
 */
function currentBlockForCoach(workspace) {
    try {
        const selected = Blockly.getSelected && Blockly.getSelected();
        if (selected && selected.type) return selected;
    } catch (e) { /* fall through */ }
    const fromNode = (node) => {
        if (!node) return null;
        try {
            if (node.isConnection && node.isConnection()) {
                return node.getLocation().getSourceBlock();
            }
            return typeof node.getSourceBlock === 'function' ?
                node.getSourceBlock() : null;
        } catch (e) {
            return null;
        }
    };
    try {
        const cursorBlock = fromNode(workspace.getCursor()?.getCurNode());
        if (cursorBlock) return cursorBlock;
    } catch (e) { /* fall through */ }
    try {
        return fromNode(workspace.getMarker('local_marker_1')?.getCurNode());
    } catch (e) {
        return null;
    }
}

/**
 * Opt-in coach chat (off by default, per the guardrail spec): a small
 * ask-the-coach box, scope-locked to the current quest server-side. Short
 * history rides along so follow-up questions make sense.
 */
function setupCoachChat() {
    const toggle = document.getElementById('coachChatToggle');
    const form = document.getElementById('coachChatForm');
    const input = document.getElementById('coachChatInput');
    if (!toggle || !form || !input) return;

    let enabled = false;
    try { enabled = localStorage.getItem('acb.coachChat') === 'true'; }
    catch (e) { /* fine */ }
    const paint = () => {
        toggle.setAttribute('aria-checked', String(enabled));
        form.hidden = !enabled;
    };
    toggle.addEventListener('click', () => {
        enabled = !enabled;
        try { localStorage.setItem('acb.coachChat', String(enabled)); }
        catch (e) { /* fine */ }
        paint();
    });
    paint();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = input.value.trim();
        if (!message) return;
        if (!acbAiCoachAvailable) {
            // One live retry before giving up - the server may just be
            // waking, or came up after the page loaded.
            coachThinking('Reaching Blox (a sleeping server can take ' +
                'up to a minute)');
            const ok = await acbCheckCoachHealth(45000);
            if (!ok) {
                coachSay('I could not reach the coach server. If it ' +
                    'was asleep it may need a minute - try once more.');
                return;
            }
        }
        input.value = '';
        input.disabled = true;
        coachThinking('Thinking about that');
        // A workspace diagnosis in chat is deep help too, same quiet cost.
        if (acbTaskEngine && acbTaskEngine.task) acbTaskEngine.registerHelp(5);
        // Shared history: explanations Blox already gave are part of the
        // thread, so follow-up questions have their context.
        const ai = await aiCoach('chat',
            {message, history: acbChatHistory.slice(-6)}, 15000);
        input.disabled = false;
        input.focus();
        if (ai && ai.text) {
            acbChatHistory.push({from: 'learner', text: message});
            acbChatHistory.push({from: 'coach', text: ai.text});
            coachSay(`✨ ${ai.text}`);
        } else {
            const withYou = (typeof acbProfile === 'function' &&
                acbProfile().companion === 'on');
            coachSay(withYou ?
                'My thinking part could not reach the server just now, ' +
                'but I am not going anywhere. Catch your breath, try once ' +
                'more in a moment, or take a hint - I will wait right here.' :
                'I could not answer just now. Try once more in a moment, ' +
                'or use the hint button - it works without the server.');
        }
    });
}

/**
 * Shared follow-up context: every explanation Blox gives is seeded into
 * this history, so a follow-up question in the chat box continues the
 * same thread. "Explain another way" re-explains with a new strategy
 * each press.
 */
const acbChatHistory = [];
let acbExplainContext = null;  // {blockType: ?string, attempt, lastText}

function showExplanation(text, blockType, attempt) {
    coachSay(`✨ ${text}`);
    acbExplainContext = {blockType, attempt, lastText: text};
    acbChatHistory.push(
        {from: 'learner', text: blockType ?
            `What does the ${blockType} block do?` :
            'What does my program do?'},
        {from: 'coach', text});
    const again = document.getElementById('coachAgainButton');
    if (again) again.hidden = false;
    // Open the follow-up lane contextually, whatever the chat setting.
    const chatForm = document.getElementById('coachChatForm');
    const chatInput = document.getElementById('coachChatInput');
    if (chatForm && chatForm.hidden) chatForm.hidden = false;
    if (chatInput) chatInput.placeholder = 'Follow-up question? Ask Blox…';
}

/** The re-explanation strategies, in the order the button walks them. */
const EXPLAIN_STRATEGIES = [
    null,  // attempt 1 is the standard explanation
    'a concrete everyday example',
    'a step-by-step walkthrough of what happens when it runs',
    'the simplest possible wording, one short sentence',
];

async function explainAnotherWay() {
    if (!acbExplainContext) return;
    const context = acbExplainContext;
    const attempt = context.attempt + 1;
    coachThinking('Let me put that differently…');
    const ai = await aiCoach('explain', {
        blockType: context.blockType || undefined,
        variant: attempt,
        previousExplanation: context.lastText.slice(0, 300),
    });
    if (ai && ai.text) {
        showExplanation(ai.text, context.blockType, attempt);
        return;
    }
    // Offline: walk the authored second-pass explanation, then admit the
    // limit honestly rather than repeating.
    const simple = context.blockType &&
        typeof ACB_BLOCK_EXPLANATIONS_SIMPLE !== 'undefined' &&
        ACB_BLOCK_EXPLANATIONS_SIMPLE[context.blockType];
    if (simple && attempt === 2) {
        showExplanation(simple, context.blockType, attempt);
    } else {
        coachSay('That is my clearest offline wording. Try placing the ' +
            'block and pressing Run to watch what it does, or start the ' +
            'coach server for richer explanations.');
    }
}

function setupCoachCard() {
    const message = document.getElementById('coachMessage');
    if (!message) return;

    document.getElementById('coachAgainButton')
        ?.addEventListener('click', explainAnotherWay);

    document.addEventListener('acb-session-resume', (event) => {
        const action = event.detail?.action;
        if (action === 'resumed') {
            coachSay('Picked up right where you left off. You have got this.');
        } else if (action === 'fresh') {
            coachSay('Fresh start! Pick a quest and dive in.');
        }
    });

    document.getElementById('coachExplainButton')?.addEventListener('click', async () => {
        const ws = Blockly.getMainWorkspace();
        const block = ws && currentBlockForCoach(ws);
        const hasBlocks = ws && ws.getAllBlocks(false).length > 0;
        if (!block && !hasBlocks) {
            coachSay('The workspace is empty. Place a block, or click one ' +
                'in a drawer, then ask me again.');
            return;
        }
        if (block) {
            // A specific block is selected: explain that one.
            const fallback = (typeof ACB_BLOCK_EXPLANATIONS !== 'undefined' &&
                ACB_BLOCK_EXPLANATIONS[block.type]) ||
                'That one is new to me. Try running it and watch what the Output does.';
            coachThinking('Looking at that block…');
            const ai = await aiCoach('explain', {blockType: block.type});
            showExplanation((ai && ai.text) || fallback, block.type, 1);
            return;
        }
        // Nothing selected but the canvas has a program: explain the whole
        // thing - the coach reads the workspace facts either way.
        coachThinking('Reading your workspace…');
        const ai = await aiCoach('explain', {});
        if (ai && ai.text) {
            showExplanation(ai.text, null, 1);
        } else {
            const types = [...new Set(ws.getAllBlocks(false).map((b) => b.type))];
            const named = types.slice(0, 4)
                .map((t) => (typeof labelForBlockType === 'function') ?
                    labelForBlockType(t) : t).join(', ');
            coachSay(`Your program uses: ${named}. Click one block and ask ` +
                'again for its story, or press Run to watch it work.');
        }
    });

    document.getElementById('coachDebugButton')?.addEventListener('click', async () => {
        const ws = Blockly.getMainWorkspace();
        if (!ws) return;
        const debug = document.getElementById('coachDebugger');
        const debugText = document.getElementById('coachDebuggerText');
        if (!debug || !debugText) return;
        debugText.textContent = 'Checking your blocks and your last run…';
        debug.hidden = false;
        bloxSpinStart();  // the cube thinks along, whichever button asked
        const ai = await aiCoach('debug');
        bloxSpinStop();
        const local = acbLastRunError ?
            translateRunError(acbLastRunError) : friendlyDiagnosis(ws);
        debugText.textContent = ai && ai.text ? `✨ ${ai.text}` : local;
    });
}

/**
 * The friendly debugger: local, deterministic checks in kind cause-and-
 * effect language. Never judges, never writes the fix.
 */
function friendlyDiagnosis(workspace) {
    const tops = workspace.getTopBlocks(false);
    if (!tops.length) {
        return 'The workspace is empty. Drag a block in and we are off.';
    }
    if (tops.length > 1) {
        return `I see ${tops.length} separate block stacks. Blocks only run ` +
            'together when they are snapped into one stack. Try connecting them.';
    }
    const all = workspace.getAllBlocks(false);
    for (const block of all) {
        for (const input of block.inputList || []) {
            if (input.connection &&
                input.connection.type === Blockly.ConnectionType.NEXT_STATEMENT &&
                !input.connection.targetBlock()) {
                return `Your "${block.type.includes('repeat') ? 'repeat' : 'container'}" ` +
                    'block is empty inside. Whatever should happen goes in there.';
            }
        }
    }
    if (!all.some((b) => b.type === 'text_print')) {
        return 'Nothing prints yet. Without a print block the program works ' +
            'in silence. Add one so you can see what it is doing.';
    }
    return 'The structure looks right to me! Press Run and read the Output ' +
        'panel line by line. Does it match what you expected?';
}

/* ------------------------------------------------------------------------ */
/* Splitter: drag (or arrow-key) the boundary between workspace and panels.  */
/* ------------------------------------------------------------------------ */

function setupSplitter() {
    const splitter = document.getElementById('mainSplitter');
    const mainArea = document.getElementById('mainArea');
    const panel = document.querySelector('.execution-panel');
    if (!splitter || !mainArea || !panel) return;

    const KEY = 'acb.panelSize.v1';
    const read = () => {
        try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
        catch (e) { return {}; }
    };
    const sizes = read();

    const orientation = () =>
        mainArea.classList.contains('layout-below') ? 'below' : 'side';

    const clampAndApply = (px) => {
        const o = orientation();
        const total = o === 'side' ? mainArea.clientWidth : mainArea.clientHeight;
        const clamped = Math.max(260, Math.min(px, total - 320));
        panel.style.flex = `0 0 ${clamped}px`;
        sizes[o] = clamped;
        try { localStorage.setItem(KEY, JSON.stringify(sizes)); }
        catch (e) { /* fine */ }
        const ws = Blockly.getMainWorkspace();
        if (ws && typeof Blockly.svgResize === 'function') Blockly.svgResize(ws);
    };

    const applySaved = () => {
        const o = orientation();
        splitter.setAttribute('aria-orientation',
            o === 'side' ? 'vertical' : 'horizontal');
        if (sizes[o]) {
            panel.style.flex = `0 0 ${sizes[o]}px`;
        } else {
            panel.style.flex = '';
        }
        const ws = Blockly.getMainWorkspace();
        if (ws && typeof Blockly.svgResize === 'function') Blockly.svgResize(ws);
    };
    applySaved();
    // Layout preset buttons re-apply the saved size for the new orientation.
    window.__acbApplySavedPanelSize = applySaved;

    let dragging = false;
    splitter.addEventListener('pointerdown', (event) => {
        dragging = true;
        splitter.classList.add('is-dragging');
        splitter.setPointerCapture(event.pointerId);
        event.preventDefault();
    });
    splitter.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        const rect = mainArea.getBoundingClientRect();
        const px = orientation() === 'side' ?
            rect.right - event.clientX :
            rect.bottom - event.clientY;
        clampAndApply(px);
    });
    const endDrag = () => {
        dragging = false;
        splitter.classList.remove('is-dragging');
    };
    splitter.addEventListener('pointerup', endDrag);
    splitter.addEventListener('pointercancel', endDrag);

    splitter.addEventListener('keydown', (event) => {
        const o = orientation();
        const current = panel.getBoundingClientRect();
        const size = o === 'side' ? current.width : current.height;
        const grow = o === 'side' ?
            (event.key === 'ArrowLeft') : (event.key === 'ArrowUp');
        const shrink = o === 'side' ?
            (event.key === 'ArrowRight') : (event.key === 'ArrowDown');
        if (grow || shrink) {
            event.preventDefault();
            clampAndApply(size + (grow ? 24 : -24));
        }
    });
}

/**
 * Panel layout choice, from the gear menu: side-by-side (panels right of
 * the workspace) or stacked (panels below). Remembered across visits.
 */
function setupLayoutOptions() {
    const mainArea = document.getElementById('mainArea');
    const sideItem = document.getElementById('layoutSide');
    const belowItem = document.getElementById('layoutBelow');
    if (!mainArea || !sideItem || !belowItem) return;

    const apply = (layout) => {
        const below = layout === 'below';
        mainArea.classList.toggle('layout-below', below);
        mainArea.classList.toggle('layout-side', !below);
        sideItem.setAttribute('aria-checked', String(!below));
        belowItem.setAttribute('aria-checked', String(below));
        try { localStorage.setItem('acb.layout', below ? 'below' : 'side'); }
        catch (e) { /* fine */ }
        // Blockly must remeasure its injection div after the flex change.
        // Immediately (works even in a hidden tab, where rAF never fires),
        // and again on the next frame in case fonts/scrollbars settle.
        const resize = () => {
            const ws = Blockly.getMainWorkspace();
            if (ws && typeof Blockly.svgResize === 'function') Blockly.svgResize(ws);
        };
        // The splitter keeps one saved size per orientation; use it.
        if (typeof window.__acbApplySavedPanelSize === 'function') {
            window.__acbApplySavedPanelSize();
        }
        resize();
        requestAnimationFrame(resize);
    };

    sideItem.addEventListener('click', () => apply('side'));
    belowItem.addEventListener('click', () => apply('below'));

    let saved = null;
    try { saved = localStorage.getItem('acb.layout'); } catch (e) { /* fine */ }
    if (saved === 'below') apply('below');
}

/**
 * The gear menu. Settings that are not attention tools (theme, keyboard
 * shortcuts, task instructions) live here so the header stays quiet.
 */
function setupSettingsMenu() {
    const button = document.getElementById('settingsButton');
    const dropdown = document.getElementById('settingsDropdown');
    if (!button || !dropdown) return;

    const isOpen = () => !dropdown.hidden;

    const close = (returnFocus) => {
        if (!isOpen()) return;
        dropdown.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        if (returnFocus) button.focus();
    };

    const open = () => {
        dropdown.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        const first = dropdown.querySelector('button:not(:disabled)');
        if (first) first.focus();
    };

    button.addEventListener('click', () => {
        if (isOpen()) { close(false); } else { open(); }
    });

    // Esc closes and returns focus to the gear; arrows move between items.
    dropdown.addEventListener('keydown', (event) => {
        const items = Array.from(
            dropdown.querySelectorAll('button:not(:disabled)'));
        const index = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
            event.stopPropagation();
            close(true);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            items[(index + 1) % items.length]?.focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            items[(index - 1 + items.length) % items.length]?.focus();
        }
    });

    // Clicking anywhere else closes the menu.
    document.addEventListener('click', (event) => {
        if (isOpen() && !dropdown.contains(event.target) &&
            !button.contains(event.target)) {
            close(false);
        }
    });

    // Opening an overlay from the menu should also put the menu away.
    // The theme item stays open so the learner can click through the cycle
    // and watch the workspace change.
    for (const id of ['showShortcuts', 'showInstructions', 'openAppWindow']) {
        document.getElementById(id)?.addEventListener('click', () => close(false));
    }

    // A clean window: just this app, no tabs, no other pages competing.
    // A browser cannot move an existing tab into a popup, so we open the
    // popup and turn THIS tab into a calm hand-off screen instead of
    // leaving two live copies running side by side.
    const appWindowItem = document.getElementById('openAppWindow');
    if (window.name === 'acb-app-window' && appWindowItem) {
        appWindowItem.hidden = true;  // already in the app window
    }
    appWindowItem?.addEventListener('click', () => {
        const win = window.open(window.location.href, 'acb-app-window',
            'popup=yes,width=1366,height=850');
        if (!win) return;  // popup blocked; nothing to hand off
        const overlay = document.createElement('div');
        overlay.className = 'handoff-overlay';
        overlay.innerHTML =
            '<div class="handoff-overlay__card" role="status">' +
            '<p class="handoff-overlay__title">Coding continues in the app window</p>' +
            '<p class="handoff-overlay__line">Your work is saved automatically. ' +
            'You can close this tab.</p>' +
            '<button type="button" class="now-card__button now-card__button--secondary" ' +
            'onclick="window.location.reload()">Bring it back here</button></div>';
        document.body.appendChild(overlay);
    });
}

/**
 * Wires the theme button: each click moves to the next theme in the cycle
 * (Bright, Calm, Dark) and the button label always names the current one.
 */
function setupThemeToggle() {
    const button = document.getElementById('themeToggle');
    if (!button) return;

    if (typeof getThemeSwitcher !== 'function') {
        button.disabled = true;
        button.title = 'Theme switching is not available in this build';
        return;
    }

    const paint = (label) => {
        const text = document.getElementById('themeToggleLabel');
        if (text) text.textContent = label;
        button.setAttribute('aria-label', `Switch theme, current theme ${label}`);
    };

    // The theme covers the WHOLE environment, not just the Blockly
    // canvas: a body class drives the page-wide palette in main.css.
    const paintBody = (name) => {
        for (const t of ['calm', 'dark', 'contrast']) {
            document.body.classList.toggle('acb-theme-' + t, name === t);
        }
    };

    button.addEventListener('click', () => {
        const switcher = getThemeSwitcher();
        if (switcher) switcher.cycle();
    });

    document.addEventListener('acb-theme-change', (event) => {
        if (event.detail?.label) paint(event.detail.label);
        if (event.detail?.theme) paintBody(event.detail.theme);
    });

    // The plugin may have restored a remembered theme during addWorkspace.
    const switcher = getThemeSwitcher();
    if (switcher) {
        paint(THEME_LABELS[switcher.getThemeName()]);
        paintBody(switcher.getThemeName());
    }
}

/**
 * Demo policy: treat the blocks already used by the loaded program as "the
 * blocks this step needs", so focus mode has something concrete to narrow the
 * toolbox to. Real step-by-step task definitions replace this later.
 * @param {!Blockly.WorkspaceSvg} workspace
 */
function syncFocusModeStepBlocks(workspace) {
    if (typeof getFocusMode !== 'function') return;
    const focusMode = getFocusMode();
    if (!focusMode) return;

    const types = new Set();
    for (const block of workspace.getAllBlocks(false)) {
        types.add(block.type);
    }
    // Variables are a dynamic category; keep the drawer if the task uses them.
    if (workspace.getAllVariables().length) {
        types.add('VARIABLE');
    }
    focusMode.setStepBlocks(Array.from(types));
}


/* ------------------------------------------------------------------------ */
/* Variable watchers: after a run, every variable's final value sits under   */
/* the Output header. Bret Victor's rule - show the state.                   */
/* ------------------------------------------------------------------------ */

function renderRunVars(values) {
    const holder = document.getElementById('runVars');
    if (!holder) return;
    const names = Object.keys(values);
    if (!names.length) { holder.hidden = true; return; }
    holder.innerHTML = names.map((name) => {
        let shown;
        try {
            shown = JSON.stringify(values[name]);
            if (shown && shown.length > 40) shown = shown.slice(0, 37) + '...';
        } catch (e) { shown = String(values[name]); }
        return `<span class="run-var"><span class="run-var__name">${name}</span>` +
            ` = ${shown ?? 'undefined'}</span>`;
    }).join('');
    holder.hidden = false;
}

/* ------------------------------------------------------------------------ */
/* Workspace search: Ctrl+F finds blocks by their readable text, Enter       */
/* cycles matches, the found block glows and centres. A decade-old Scratch   */
/* ask; trivial on Blockly's tree.                                           */
/* ------------------------------------------------------------------------ */

function setupWorkspaceSearch(workspace) {
    const box = document.getElementById('wsSearch');
    const input = document.getElementById('wsSearchInput');
    const count = document.getElementById('wsSearchCount');
    if (!box || !input) return;
    let matches = [];
    let index = -1;

    const clearGlow = () => {
        document.querySelectorAll('.acb-search-hit')
            .forEach((el) => el.classList.remove('acb-search-hit'));
    };

    const showMatch = () => {
        clearGlow();
        if (!matches.length) {
            count.textContent = input.value.trim() ? '0' : '';
            return;
        }
        index = ((index % matches.length) + matches.length) % matches.length;
        const block = matches[index];
        count.textContent = `${index + 1}/${matches.length}`;
        try {
            workspace.centerOnBlock(block.id);
            block.getSvgRoot().classList.add('acb-search-hit');
        } catch (e) { /* block may have vanished */ }
    };

    const runSearch = () => {
        const q = input.value.trim().toLowerCase();
        matches = !q ? [] : workspace.getAllBlocks(false).filter((b) => {
            try { return b.toString().toLowerCase().includes(q); }
            catch (e) { return false; }
        });
        index = 0;
        showMatch();
    };

    const close = () => {
        box.hidden = true;
        clearGlow();
        input.value = '';
        count.textContent = '';
    };

    document.addEventListener('keydown', (event) => {
        const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName) ||
            document.activeElement?.isContentEditable;
        if ((event.ctrlKey || event.metaKey) && event.key === 'f' &&
            (!typing || document.activeElement === input)) {
            event.preventDefault();
            box.hidden = false;
            input.focus();
            input.select();
        }
    });

    input.addEventListener('input', runSearch);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            index += event.shiftKey ? -1 : 1;
            showMatch();
        } else if (event.key === 'Escape') {
            event.stopPropagation();
            close();
        }
    });
    document.getElementById('wsSearchClose')
        ?.addEventListener('click', close);
}

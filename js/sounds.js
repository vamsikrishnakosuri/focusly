/**
 * @fileoverview Interaction sounds: the quiet audio language of the canvas.
 * Every frequent action gets a tiny, warm, low-volume cue - the UI sound
 * rule of thumb is "the more often it plays, the softer and shorter it must
 * be" - and celebrations (juice.js chimes) sit brighter and higher so the
 * two layers never fight. Envelopes always ramp in over 20ms: nothing ever
 * clicks or startles, which matters for auditory defensiveness. The one
 * master switch (settings -> sounds) governs all of it, and every sound has
 * a visual twin, so audio is never load-bearing.
 *
 * All synthesized in WebAudio: no files, no licenses, nothing to download.
 */

const ACB_UI_LAST = {};   // kind -> last play time, for throttling

function acbGlide(f0, f1, startAt, duration, gainPeak, ctx, type) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    const t = ctx.currentTime + startAt;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainPeak, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
}

/**
 * kind: select | grab | snap | detach | drop | delete | run | tick | refuse
 */
function playUi(kind) {
    if (typeof acbSoundsOn !== 'undefined' && !acbSoundsOn) return;
    const now = performance.now();
    const minGap = kind === 'select' ? 200 : 110;
    if (ACB_UI_LAST[kind] && now - ACB_UI_LAST[kind] < minGap) return;
    ACB_UI_LAST[kind] = now;
    try {
        if (!acbAudioCtx) acbAudioCtx = new (window.AudioContext ||
            window.webkitAudioContext)();
        const ctx = acbAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        if (kind === 'select') {
            // The most frequent sound in the app: barely-there mid tick.
            acbTone(660, 0, 0.05, 0.028, ctx);
        } else if (kind === 'grab') {
            acbGlide(240, 330, 0, 0.07, 0.04, ctx);
        } else if (kind === 'snap') {
            // The dopamine moment - a soft wooden "tock" plus a warm fifth.
            acbGlide(420, 380, 0, 0.06, 0.10, ctx, 'triangle');
            acbTone(587.3, 0.02, 0.10, 0.05, ctx);
        } else if (kind === 'detach') {
            acbGlide(330, 240, 0, 0.06, 0.035, ctx);
        } else if (kind === 'drop') {
            acbTone(196, 0, 0.06, 0.05, ctx);
        } else if (kind === 'delete') {
            acbGlide(420, 140, 0, 0.15, 0.05, ctx, 'triangle');
        } else if (kind === 'run') {
            acbTone(523.3, 0, 0.08, 0.05, ctx);
            acbTone(784, 0.07, 0.1, 0.05, ctx);
        } else if (kind === 'tick') {
            acbTone(700, 0, 0.03, 0.03, ctx);
        } else if (kind === 'refuse') {
            // Gentle "not quite": two soft low taps, no alarm.
            acbTone(220, 0, 0.07, 0.04, ctx);
            acbTone(220, 0.11, 0.07, 0.04, ctx);
        }
    } catch (e) { /* sound is decoration */ }
}

function setupUiSounds(workspace) {
    workspace.addChangeListener((event) => {
        if (!event) return;
        if (typeof acbReplay !== 'undefined' && acbReplay) return;
        if (event.type === 'selected') {
            if (event.newElementId) playUi('select');
        } else if (event.type === 'drag') {
            if (event.isStart) playUi('grab');
        } else if (event.type === 'move') {
            if (event.newParentId) playUi('snap');
            else if (event.oldParentId) playUi('detach');
            else if (event.reason && event.reason.includes('drag')) {
                playUi('drop');
            }
        } else if (event.type === 'delete') {
            playUi('delete');
        }
    });
    document.getElementById('runButton')?.addEventListener('click',
        () => playUi('run'));
    document.getElementById('debugStep')?.addEventListener('click',
        () => playUi('tick'));
}

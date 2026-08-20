/**
 * @fileoverview Blox has feelings. The 3D cube already spins while thinking;
 * now it also reacts to what happens - a little hop-and-spin when a step
 * lands, a proper wobble-cheer when a quest finishes, a gentle "hm" tilt
 * when a run errors, a small nod when a run comes back clean. Emotion is
 * information: the mascot's body shows program state at a glance, which is
 * exactly the kind of glanceable feedback the survey's overwhelm findings
 * favor over more text.
 *
 * Every animation respects reduced-motion (profile or OS) and never runs
 * while the thinking spin is active - thinking always wins.
 */

let bloxMoodAnim = null;   // current requestAnimationFrame loop id

function bloxMotionAllowed() {
    if (document.body.classList.contains('acb-no-motion')) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return false;
    }
    return true;
}

/**
 * Runs one mood animation on the cube. fn(progress 0..1, model) mutates the
 * model each frame; the base pose is restored at the end.
 */
function bloxAnimate(durationMs, fn) {
    ensureBloxSpinner().then((s) => {
        if (!s || s.spinning || !bloxMotionAllowed()) return;
        if (bloxMoodAnim) cancelAnimationFrame(bloxMoodAnim);
        const start = performance.now();
        const step = () => {
            if (s.spinning) { bloxMoodAnim = null; return; }  // thinking wins
            const t = Math.min(1, (performance.now() - start) / durationMs);
            fn(t, s.model);
            s.renderer.render(s.scene, s.camera);
            if (t < 1) {
                bloxMoodAnim = requestAnimationFrame(step);
            } else {
                s.model.rotation.z = 0;
                s.model.rotation.x = 0;
                s.model.position.y = 0;
                s.renderer.render(s.scene, s.camera);
                bloxMoodAnim = null;
            }
        };
        bloxMoodAnim = requestAnimationFrame(step);
    });
}

/** mood: 'happy' | 'cheer' | 'oops' | 'nod' */
function bloxMood(mood) {
    if (mood === 'happy') {
        // Two little hops with a quarter turn.
        bloxAnimate(900, (t, m) => {
            m.position.y = Math.abs(Math.sin(t * Math.PI * 2)) *
                0.35 * (1 - t * 0.5);
            m.rotation.y += 0.045;
        });
    } else if (mood === 'cheer') {
        // The full wobble: fast spin plus a side-to-side dance.
        bloxAnimate(1500, (t, m) => {
            m.rotation.y += 0.12 * (1 - t * 0.4);
            m.rotation.z = Math.sin(t * Math.PI * 6) * 0.22 * (1 - t);
            m.position.y = Math.abs(Math.sin(t * Math.PI * 3)) * 0.4 * (1 - t);
        });
    } else if (mood === 'oops') {
        // A slow, sympathetic head-tilt: "hm, let's look at that."
        bloxAnimate(1100, (t, m) => {
            const lean = t < 0.3 ? t / 0.3 : t > 0.75 ? (1 - t) / 0.25 : 1;
            m.rotation.z = lean * 0.28;
        });
    } else if (mood === 'nod') {
        bloxAnimate(650, (t, m) => {
            m.rotation.x = Math.sin(t * Math.PI * 2) * 0.18 * (1 - t * 0.3);
        });
    }
}

function setupBloxMoods() {
    // Quest progress: step landed -> happy; quest done -> full cheer.
    document.addEventListener('acb-task', (event) => {
        const action = event.detail && event.detail.action;
        if (action === 'step') bloxMood('happy');
        else if (action === 'complete' || action === 'quest') {
            bloxMood('cheer');
        }
    });
    // Runs: after the pipeline settles, clean -> nod, error -> gentle tilt.
    document.getElementById('runButton')?.addEventListener('click', () => {
        setTimeout(() => {
            if (typeof acbLastRunError !== 'undefined' && acbLastRunError) {
                bloxMood('oops');
            } else {
                bloxMood('nod');
            }
        }, 450);
    });
}

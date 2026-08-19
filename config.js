/**
 * @fileoverview Deployment configuration. This file is meant to differ
 * between environments: locally it stays empty (the app talks to
 * http://localhost:8124); on the hosted site, set FOCUSLY_COACH_URL to the
 * deployed coach server, e.g. 'https://focusly-coach.onrender.com'.
 * A learner's own localStorage 'acb.coachServer' still overrides both.
 */
window.FOCUSLY_COACH_URL = '';

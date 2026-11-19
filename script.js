/* ════════════════════════════════════════════════════════════════
   Verse — website interactions
   1. Scroll reveals (IntersectionObserver, once, spring easing)
   2. Hero dot-grid waveform (canvas twin of voice/Waveform.tsx)
   3. Live demo: scripted pipeline — type → trace → stream, with
      effort-scaled thinking and a repair-ladder rerun toast
   4. Feature card accordions
   No dependencies. No network.
   ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var reducedMotion = false;
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* very old engines */ }

  function nowStamp() {
    var d = new Date();
    var h = d.getHours() % 12 || 12;
    var m = ('0' + d.getMinutes()).slice(-2);
    return h + ':' + m;
  }

  /* ── 1. scroll reveals ─────────────────────────────────────────── */

  function initReveal() {
    var targets = $$('[data-reveal]');
    if (!targets.length) return;

    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var gi = 0; // stagger counter reset per observer batch
    /* stagger by DOM order within the same frame of visibility */
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        observer.unobserve(el);
        var delay = Math.min(gi, 5) * 70;
        gi = (gi + 1) % 8;
        setTimeout(function () { el.classList.add('is-in'); }, delay);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ── 2. hero dot-grid waveform (Waveform.tsx twin) ────────────── */

  function initWaveform() {
    var canvas = $('#wave');
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var ROWS = 6;
    var width = 0;
    var dpr = 1;
    var lastT = 0;

    function measure() {
      var cw = Math.floor(canvas.clientWidth || 0);
      if (cw <= 0) return;              // not laid out yet
      if (cw === width && canvas.width) return; // unchanged
      width = cw;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(56 * dpr);
      canvas.style.height = '56px';
      draw(lastT);
    }

    function draw(t) {
      if (!ctx) return;
      if (!width) { measure(); if (!width) return; }
      var height = 56;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      var centerY = height / 2;
      var rowGap = Math.max(6, Math.min(11, height / (ROWS + 1)));
      var step = 9;
      var cols = Math.max(1, Math.floor(width / step));
      var leftPad = (width - ((cols - 1) * step)) / 2;
      // slow global breath — the orb's 2.4s cadence, diluted
      var envelope = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(t * 0.0026));

      for (var c = 0; c < cols; c += 1) {
        var x = leftPad + c * step;
        var phase = Math.sin(c * 0.34 - t * 0.0011) * 0.5 + 0.5;
        var spark = Math.pow(Math.sin(c * 0.11 - t * 0.0007) * 0.5 + 0.5, 3);
        var level = Math.max(0, (phase * 0.5 + spark * 0.9)) * envelope * 0.62;
        if (level > 1) level = 1;

        for (var r = 0; r < ROWS; r += 1) {
          var rowOffset = r - (ROWS - 1) / 2;
          if (level <= 0.004) {
            ctx.beginPath();
            ctx.arc(x, centerY + rowOffset * rowGap * 0.62, 0.55, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(148, 163, 184, 0.07)';
            ctx.fill();
            continue;
          }
          var fall = 1 - (Math.abs(rowOffset) / ((ROWS - 1) / 2 + 0.001)) * 0.72;
          var intensity = level * Math.max(0.08, fall);
          if (intensity < 0.02) {
            ctx.beginPath();
            ctx.arc(x, centerY + rowOffset * rowGap * 0.62, 0.55, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(148, 163, 184, 0.07)';
            ctx.fill();
            continue;
          }
          var y = centerY + rowOffset * rowGap * (0.62 + level * 0.55);
          var radius = 0.55 + intensity * 1.85;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(203, 213, 225, ' + (0.07 + intensity * 0.7) + ')';
          ctx.fill();
        }
      }
    }

    if (reducedMotion) {
      measure();
      return;
    }

    var running = false;
    var onScreen = false;
    var rafId = 0;

    function loop(t) {
      if (!running) return;
      lastT = t;
      draw(t);
      rafId = window.requestAnimationFrame(loop);
    }

    // Only animate while the canvas is on screen.
    if (typeof IntersectionObserver !== 'undefined') {
      var vis = new IntersectionObserver(function (entries) {
        onScreen = entries.some(function (en) { return en.isIntersecting; });
        if (onScreen && !running && !document.hidden) {
          running = true;
          rafId = window.requestAnimationFrame(loop);
        } else if (!onScreen && running) {
          running = false;
          window.cancelAnimationFrame(rafId);
        }
      }, { threshold: 0.01 });
      vis.observe(canvas);
    } else {
      onScreen = true;
      running = true;
      rafId = window.requestAnimationFrame(loop);
    }

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () { measure(); });
      ro.observe(canvas);
    } else {
      window.addEventListener('resize', measure);
    }

    // Do not burn frames in a hidden tab.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && running) {
        running = false;
        window.cancelAnimationFrame(rafId);
      } else if (!document.hidden && !running && onScreen) {
        running = true;
        rafId = window.requestAnimationFrame(loop);
      }
    });

    measure();
  }

  /* ── 3. live demo ──────────────────────────────────────────────── */

  var LADDER_BASE = 'nemotron-lightning';
  var LADDER_FALLBACK = 'flint-v1.0';

  var EFFORT_STEPS = {
    off: 0,
    low: 2,
    medium: 4,
    high: 7
  };

  var STEP_NAMES = [
    'Reading the prompt',
    'Planning the reply',
    'Structuring the answer',
    'Checking facts against context',
    'Walking the edge cases',
    'Trying a cheaper framing first',
    'Committing to the wording'
  ];

  var SCRIPTS = {
    quantum: {
      user: 'Explain quantum tunneling',
      answer:
        'A particle crosses a barrier it does not have the energy to climb. Classically, that is final: too little energy, no crossing. In quantum mechanics a particle is described by a wave, and the wave does not stop at the wall — it decays through it, leaving a small amplitude on the far side. That amplitude is the probability of finding the particle beyond the barrier.\n\nThe odds fall with a thicker wall, a heavier particle and a higher barrier — but they never reach zero. Alpha decay, flash memory and the fusion that lights the sun all run on this.'
    },
    agents: {
      user: '/agents 3 design a landing page',
      agents: { count: 3, names: ['Scout', 'Analyst', 'Critic'], goal: 'design a landing page' },
      answer:
        'The panel split the goal across three workers and merged their output:\n\n— One page, one claim: the hero states a single sentence above the fold; no sliders, no carousels.\n— Structure: hero, proof strip, three concrete capabilities, one repeated call to action.\n— Type: one family, three sizes; hierarchy carried by weight, not by a second color.\n— Disagreement: two workers wanted light chrome, one argued for the dark void — the synthesis kept dark, matching the brand.\n\nOne document came back, not three opinions.'
    },
    notes: {
      user: 'Summarize notes.md',
      attachment: { name: 'notes.md', meta: 'text · 1.2 KB' },
      answer:
        'Three threads survived the read:\n\n— The residency deadline moved to the 15th; the deposit still follows the old date.\n— The two bike routes converge by the quay — one lock, one key.\n— The reading list runs PLATO before SIMULA; swap them only if the library copy is late.\n\nDropped: eleven lines of weather and a duplicated grocery list.'
    }
  };

  var GENERIC_ANSWER =
    'This page is a static demo, so no model runs behind it. In the app, that message streams token by token through the same repair ladder, with the thinking trace scaled to the effort you picked.';

  var demoState = {
    busy: false,
    effort: 'medium',
    lastKey: null,
    runs: { quantum: 0, agents: 0, notes: 0 },
    model: LADDER_BASE
  };

  var demoEl = {}; // cached elements

  function cacheDemoElements() {
    demoEl.shell = $('#demoShell');
    demoEl.timeline = $('#demoTimeline');
    demoEl.toast = $('#demoToast');
    demoEl.input = $('#demoInput');
    demoEl.send = $('#demoSend');
    demoEl.attach = $('#demoAttach');
    demoEl.modelName = $('#demoModelName');
    demoEl.modelChip = $('#demoModelChip');
    demoEl.whisper = $('#demoWhisper');
    demoEl.effortRow = $('#effortRow');
    demoEl.effortHint = $('#effortHint');
    demoEl.promptChips = $('#promptChips');
    return Boolean(demoEl.shell && demoEl.timeline && demoEl.input && demoEl.send);
  }

  function followTimeline() {
    if (!demoEl.timeline) return;
    demoEl.timeline.scrollTop = demoEl.timeline.scrollHeight;
  }

  function whisper(text) {
    if (!demoEl.whisper) return;
    demoEl.whisper.innerHTML = '';
    if (!text) return;
    var span = document.createElement('span');
    span.textContent = text;
    demoEl.whisper.appendChild(span);
  }

  var toastTimer = 0;

  function toast(text, highlight) {
    if (!demoEl.toast) return;
    demoEl.toast.textContent = text;
    demoEl.toast.className = 'demo-toast show' + (highlight ? ' is-answer' : '');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      demoEl.toast.className = 'demo-toast';
    }, 2800);
  }

  function setModel(name, switched) {
    demoState.model = name;
    if (demoEl.modelName) demoEl.modelName.textContent = name;
    if (demoEl.modelChip) {
      if (switched) demoEl.modelChip.classList.add('is-switched');
      else demoEl.modelChip.classList.remove('is-switched');
    }
  }

  function setBusy(busy) {
    demoState.busy = busy;
    if (demoEl.send) demoEl.send.disabled = busy || !(demoEl.input && demoEl.input.value.trim().length > 0);
    if (demoEl.promptChips) {
      $$('#promptChips button').forEach(function (chip) {
        chip.disabled = busy;
        chip.classList.toggle('is-replay', !busy && chip.getAttribute('data-prompt') === demoState.lastKey);
      });
    }
  }

  /* — build blocks — */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildOrb() {
    var orb = el('span', 'orb');
    var halo = el('span', 'orb-halo');
    var core = el('span', 'orb-core');
    orb.appendChild(halo);
    orb.appendChild(core);
    return orb;
  }

  function buildAttachmentChip(name, meta) {
    var chip = el('span', 'atchip');
    chip.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
    var b = el('b', null, name);
    var i = el('i', null, meta);
    chip.appendChild(b);
    chip.appendChild(i);
    return chip;
  }

  function buildAgentCard(spec) {
    var card = el('div', 'agent-card');
    card.appendChild(el('span', 'agent-card-title', spec.count + ' workers · ' + spec.goal));
    spec.names.forEach(function (name) {
      var row = el('span', 'agent-worker');
      row.appendChild(el('i', 'wdot'));
      var b = el('b', null, name);
      var status = el('span', 'worker-status', 'queued');
      row.appendChild(b);
      row.appendChild(status);
      card.appendChild(row);
    });
    return card;
  }

  function buildAssistantShell() {
    var msg = el('div', 'msg msg-assistant msg-streaming');
    var row = el('div', 'model-row');
    row.appendChild(buildOrb());
    var name = el('span', 'model-name', demoState.model);
    row.appendChild(name);
    msg.appendChild(row);
    return msg;
  }

  function buildDrawer() {
    var drawer = el('div', 'tdrawer');
    drawer.setAttribute('data-open', 'false');

    var pill = el('button', 'tdrawer-pill is-live');
    pill.type = 'button';
    pill.setAttribute('aria-expanded', 'false');
    pill.appendChild(el('i', 'tdrawer-dot'));
    pill.appendChild(el('span', 'tdrawer-label', 'Thinking…'));
    pill.innerHTML += '<svg class="tdrawer-chev" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

    var panel = el('div', 'tdrawer-panel');
    var clip = el('div');
    var list = el('ol');
    clip.appendChild(list);
    panel.appendChild(clip);

    pill.addEventListener('click', function () {
      var open = drawer.getAttribute('data-open') === 'true';
      drawer.setAttribute('data-open', open ? 'false' : 'true');
      pill.setAttribute('aria-expanded', open ? 'false' : 'true');
    });

    drawer.appendChild(pill);
    drawer.appendChild(panel);

    return {
      node: drawer,
      pill: pill,
      label: $('.tdrawer-label', pill) || null,
      list: list,
      open: function (openState) {
        drawer.setAttribute('data-open', openState ? 'true' : 'false');
        pill.setAttribute('aria-expanded', openState ? 'true' : 'false');
      }
    };
  }

  function addDrawerStep(drawer, text) {
    var li = el('li');
    li.appendChild(el('b'));
    li.appendChild(el('span', null, text));
    drawer.list.appendChild(li);
    followTimeline();
    return li;
  }

  function buildActionsRow(msgNode) {
    var actions = el('div', 'msg-actions');
    var copy = el('button', null, 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      var textNode = $('.answer', msgNode);
      copyText(textNode ? textNode.textContent : '').then(function (ok) {
        if (ok) copy.textContent = 'Copied';
        window.setTimeout(function () { copy.textContent = 'Copy'; }, 1200);
      });
    });
    var stamp = el('time', null, nowStamp());
    actions.appendChild(copy);
    actions.appendChild(stamp);
    return actions;
  }

  function copyText(text) {
    return new Promise(function (resolve) {
      if (!text) { resolve(false); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { resolve(true); },
          function () { resolve(legacyCopy(text)); }
        );
        return;
      }
      resolve(legacyCopy(text));
    });
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  /* — run pipeline — */

  function typeUserBubble(text) {
    var msg = el('div', 'msg msg-user');
    var bubble = el('div', 'bubble');
    var span = el('span');
    bubble.appendChild(span);
    msg.appendChild(bubble);
    demoEl.timeline.appendChild(msg);
    followTimeline();

    if (reducedMotion) {
      span.textContent = text;
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      var i = 0;
      var timer = window.setInterval(function () {
        i += 1;
        span.textContent = text.slice(0, i);
        followTimeline();
        if (i >= text.length) {
          window.clearInterval(timer);
          resolve();
        }
      }, 24);
    });
  }

  function beginAssistant() {
    var msg = buildAssistantShell();
    demoEl.timeline.appendChild(msg);
    followTimeline();
    return msg;
  }

  function runThinking(msg, labels) {
    if (!labels || labels.length === 0) return Promise.resolve(null);

    var drawer = buildDrawer();
    var anchor = $('.model-row', msg);
    if (anchor && anchor.nextSibling) msg.insertBefore(drawer.node, anchor.nextSibling);
    else if (anchor) msg.appendChild(drawer.node);
    else msg.appendChild(drawer.node);

    drawer.open(true);
    followTimeline();

    if (reducedMotion) {
      labels.forEach(function (label) {
        var li = addDrawerStep(drawer, label);
        li.classList.add('is-shown');
        li.classList.add('is-done');
      });
      return Promise.resolve(drawer);
    }

    return new Promise(function (resolve) {
      var shown = 0;
      var settleMs = Math.max(220, 560 - labels.length * 30);
      function nextStep() {
        if (shown >= labels.length) {
          resolve(drawer);
          return;
        }
        var li = addDrawerStep(drawer, labels[shown]);
        li.classList.add('is-shown');
        window.setTimeout(function () {
          li.classList.add('is-done');
        }, settleMs);
        shown += 1;
        window.setTimeout(nextStep, 640);
      }
      // first step appears after a short derivation beat
      window.setTimeout(nextStep, 420);
    });
  }

  function streamAnswer(msg, answer) {
    return new Promise(function (resolve) {
      var answerBox = el('div', 'answer');
      var textSpan = el('span', 'answer-text');
      var caret = el('span', 'caret');
      answerBox.appendChild(textSpan);
      answerBox.appendChild(caret);
      msg.appendChild(answerBox);
      followTimeline();

      var end = function () {
        textSpan.textContent = answer;
        if (caret.parentNode) caret.parentNode.removeChild(caret);
        resolve();
      };

      if (reducedMotion) { end(); return; }

      var words = answer.split(' ');
      var w = 0;
      function pushWord() {
        w += 1;
        textSpan.textContent = words.slice(0, w).join(' ');
        followTimeline();
        if (w >= words.length) {
          window.setTimeout(end, 260);
          return;
        }
        var jitter = 34 + Math.floor((w % 5) * 17);
        if (answer[w] === ' ') jitter += 40;
        window.setTimeout(pushWord, jitter);
      }
      window.setTimeout(pushWord, 200);
    });
  }

  function finishAssistant(msg, drawer) {
    msg.classList.remove('msg-streaming');
    if (drawer && drawer.label) {
      drawer.pill.classList.remove('is-live');
      if (drawer.label) drawer.label.textContent = 'Thought process';
    }
    if (drawer) drawer.open(false);
    msg.appendChild(buildActionsRow(msg));
    followTimeline();
  }

  function runAgentCard(msg, spec) {
    var card = buildAgentCard(spec);
    var anchor = $('.model-row', msg);
    if (anchor && anchor.nextSibling) msg.insertBefore(card, anchor.nextSibling);
    else if (anchor) msg.appendChild(card);
    else msg.appendChild(card);
    followTimeline();

    var rows = $$('.agent-worker', card);
    if (reducedMotion) {
      rows.forEach(function (row) {
        row.classList.add('is-done');
        var st = $('.worker-status', row);
        if (st) st.textContent = 'merged';
      });
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      var i = 0;
      function tick() {
        if (i >= rows.length) { resolve(); return; }
        (function (idx) {
          rows[idx].classList.add('is-run');
          var st = $('.worker-status', rows[idx]);
          if (st) st.textContent = 'running';
          window.setTimeout(function () {
            rows[idx].classList.remove('is-run');
            rows[idx].classList.add('is-done');
            if (st) st.textContent = 'merged';
            i += 1;
            window.setTimeout(tick, 180);
          }, 620 + idx * 160);
        })(i);
      }
      window.setTimeout(tick, 320);
    });
  }

  function stepsFor(key, effort) {
    var n = EFFORT_STEPS[effort] != null ? EFFORT_STEPS[effort] : 4;
    var s = [];
    for (var i = 0; i < n && i < STEP_NAMES.length; i += 1) s.push(STEP_NAMES[i]);
    if (key === 'agents' && n > 3) s[3] = 'Scout: surveying the brief';
    if (key === 'agents' && n > 4) s[4] = 'Analyst: weighing layout trade-offs';
    if (key === 'agents' && n > 5) s[5] = 'Critic: stress-testing the draft';
    if (key === 'agents' && n > 6) s[6] = 'Synthesizing one answer';
    if (key === 'notes' && n > 2) s[2] = 'Reading notes.md';
    if (key === 'notes' && n > 2) s[0] = 'Opening the attachment';
    return s;
  }

  function runScripted(key) {
    if (demoState.busy) return;
    var spec = null;
    if (key === 'quantum') spec = SCRIPTS.quantum;
    if (key === 'agents') spec = SCRIPTS.agents;
    if (key === 'notes') spec = SCRIPTS.notes;
    if (!spec) return;

    // repair ladder: re-running the same prompt means the first model is busy
    if (demoState.lastKey === key) {
      setModel(LADDER_FALLBACK, true);
      toast('busy — switched to ' + LADDER_FALLBACK, true);
    } else {
      setModel(LADDER_BASE, false);
    }
    demoState.lastKey = key;
    demoState.runs[key] = (demoState.runs[key] || 0) + 1;

    execute(spec, key);
  }

  function runTypedInput() {
    if (demoState.busy) return;
    var text = demoEl.input ? demoEl.input.value.trim() : '';
    if (!text) return;
    if (demoEl.input) demoEl.input.value = '';
    autosizeInput();
    if (demoState.lastKey === '__typed__') {
      setModel(LADDER_FALLBACK, true);
      toast('busy — switched to ' + LADDER_FALLBACK, true);
    } else {
      setModel(LADDER_BASE, false);
    }
    demoState.lastKey = '__typed__';
    execute({ user: text, answer: GENERIC_ANSWER }, 'typed');
  }

  function execute(spec, key) {
    setBusy(true);
    whisper(null);
    demoEl.timeline.innerHTML = '';

    var pre = Promise.resolve();
    if (spec.attachment) {
      pre = new Promise(function (resolve) {
        var seed = el('div', 'msg msg-user');
        seed.appendChild(buildAttachmentChip(spec.attachment.name, spec.attachment.meta));
        demoEl.timeline.appendChild(seed);
        followTimeline();
        window.setTimeout(resolve, reducedMotion ? 30 : 500);
      });
    }

    pre.then(function () {
      return typeUserBubble(spec.user);
    }).then(function () {
      var msg = beginAssistant();
      var steps = stepsFor(key, demoState.effort);

      return runThinking(msg, steps)
        .then(function (drawer) {
          if (key === 'agents' && spec.agents) {
            return runAgentCard(msg, spec.agents).then(function () { return drawer; });
          }
          return drawer;
        })
        .then(function (drawer) {
          return streamAnswer(msg, spec.answer).then(function () { return drawer; });
        })
        .then(function (drawer) {
          finishAssistant(msg, drawer);
          setBusy(false);
          whisper('session saved locally — restored instantly');
        });
    }).catch(function () {
      // never leave the demo wedged
      setBusy(false);
    });
  }

  /* — effort + input wiring — */

  function setEffort(effort) {
    if (!EFFORT_STEPS[effort] && EFFORT_STEPS[effort] !== 0) return;
    demoState.effort = effort;
    $$('#effortRow button').forEach(function (btn) {
      var on = btn.getAttribute('data-effort') === effort;
      if (on) btn.setAttribute('aria-pressed', 'true');
      else btn.removeAttribute('aria-pressed');
    });
    var n = EFFORT_STEPS[effort];
    if (demoEl.effortHint) {
      demoEl.effortHint.textContent = n === 0
        ? 'off — the trace is skipped entirely'
        : n + ' trace steps';
    }
  }

  function autosizeInput() {
    if (!demoEl.input) return;
    demoEl.input.style.height = '0px';
    demoEl.input.style.height = Math.min(120, Math.max(36, demoEl.input.scrollHeight)) + 'px';
  }

  function initDemo() {
    if (!cacheDemoElements()) return;

    if (demoEl.attach) {
      demoEl.attach.addEventListener('click', function () {
        demoEl.attach.classList.add('is-spin');
        toast('attachments are native to the desktop app', false);
        window.setTimeout(function () {
          demoEl.attach.classList.remove('is-spin');
        }, 600);
      });
    }

    if (demoEl.input) {
      demoEl.input.addEventListener('input', function () {
        autosizeInput();
        if (demoEl.send && !demoState.busy) {
          demoEl.send.disabled = demoEl.input.value.trim().length === 0;
        }
      });
      demoEl.input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          if (!demoState.busy && demoEl.input.value.trim().length > 0) runTypedInput();
        }
      });
    }

    if (demoEl.send) {
      demoEl.send.addEventListener('click', runTypedInput);
    }

    if (demoEl.effortRow) {
      $$('#effortRow button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setEffort(btn.getAttribute('data-effort') || 'medium');
          if (demoState.busy && demoEl.effortHint) {
            // live-editable: the current run keeps its target, the next run applies it
            demoEl.effortHint.textContent += ' — applies to the next run';
          }
        });
      });
    }

    if (demoEl.promptChips) {
      $$('#promptChips button').forEach(function (chip) {
        chip.addEventListener('click', function () {
          runScripted(chip.getAttribute('data-prompt') || '');
        });
      });
    }

    setBusy(false);
  }

  /* ── 4. feature accordions ─────────────────────────────────────── */

  function initFeatures() {
    $$('.feature-card').forEach(function (card) {
      var head = $('.feature-head', card);
      var body = $('.feature-body', card);
      var inner = $('.feature-body-inner', card);
      if (!head || !body || !inner) return;

      head.addEventListener('click', function () {
        var isOpen = card.getAttribute('data-open') === 'true';

        // close the others — one story at a time
        $$('.feature-card[data-open="true"]').forEach(function (other) {
          if (other === card) return;
          collapse(other);
        });

        if (isOpen) {
          collapse(card);
        } else {
          card.setAttribute('data-open', 'true');
          head.setAttribute('aria-expanded', 'true');
          if (reducedMotion) {
            body.style.height = 'auto';
          } else {
            body.style.height = inner.scrollHeight + 'px';
            body.addEventListener('transitionend', function onEnd(event) {
              if (event.propertyName !== 'height') return;
              if (card.getAttribute('data-open') === 'true') {
                body.style.height = 'auto';
              }
              body.removeEventListener('transitionend', onEnd);
            });
          }
          body.style.opacity = '1';
        }
      });
    });

    function collapse(card) {
      var head = $('.feature-head', card);
      var body = $('.feature-body', card);
      var inner = $('.feature-body-inner', card);
      if (!body) return;
      card.setAttribute('data-open', 'false');
      if (head) head.setAttribute('aria-expanded', 'false');

      if (reducedMotion) {
        body.style.height = '0px';
        body.style.opacity = '0';
        return;
      }

      // pin current height, force reflow, then animate down
      if (body.style.height === 'auto') {
        if (inner) body.style.height = inner.scrollHeight + 'px';
        void body.offsetHeight; /* reflow */
      }
      body.style.height = '0px';
      body.style.opacity = '0';
    }
  }

  /* ── boot ──────────────────────────────────────────────────────── */

  function init() {
    initReveal();
    initWaveform();
    initDemo();
    initFeatures();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

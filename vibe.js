(function () {
    'use strict';

    var root = document.documentElement;
    root.classList.add('js', 'is-loading');
    if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function lerp(a, b, t) { return a + (b - a) * t; }

    var lang = 'fr';
    var opened = false;
    var winReady = false;

    var loader, story, pin, bar, chaps, winEl, bodyEl, fileEl, stateEl;

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        loader = $('#loader'); story = $('#story'); pin = $('#pin'); bar = $('#bar');
        chaps = $$('.chap');
        winEl = $('#win'); bodyEl = $('#win-body'); fileEl = $('#win-file'); stateEl = $('#win-state');
        winReady = !!(winEl && bodyEl);

        try { var saved = localStorage.getItem('vibe-lang'); if (saved === 'en' || saved === 'fr') { lang = saved; } } catch (e) {}
        initLang();
        applyLang(lang);

        initMenu();
        initReveal();
        initMagnetic();
        initStory();
        initLoader();
    }

    function initLang() {
        $$('[data-lang]').forEach(function (btn) {
            btn.addEventListener('click', function () { applyLang(btn.getAttribute('data-lang')); });
        });
    }

    function applyLang(l) {
        lang = l;
        root.lang = l;
        $$('[data-en]').forEach(function (el) {
            if (el._fr === undefined) { el._fr = el.innerHTML; }
            el.innerHTML = l === 'en' ? el.getAttribute('data-en') : el._fr;
        });
        $$('[data-aria-en]').forEach(function (el) {
            if (el._frAria === undefined) { el._frAria = el.getAttribute('aria-label'); }
            el.setAttribute('aria-label', l === 'en' ? el.getAttribute('data-aria-en') : el._frAria);
        });
        $$('[data-lang]').forEach(function (btn) {
            btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang') === l));
        });
        var meta = $('meta[name="description"]');
        if (meta) {
            meta.setAttribute('content', l === 'en'
                ? 'Vibe Coding: coding with AI, without living with the black box. AI, security, development, networks: stakes and dangers.'
                : "Vibe Coding : coder avec l'IA, sans subir la boîte noire. IA, sécurité, développement, réseaux : enjeux et dangers.");
        }
        try { localStorage.setItem('vibe-lang', l); } catch (e) {}
        if (winReady && current >= 0) { renderScene(current, true); }
    }

    var run = 0;
    var current = -1;

    function scenes() {
        var en = lang === 'en';
        return [
            {
                file: 'prompt → server.js',
                state: en ? 'generating…' : 'génération…',
                tone: 'blue',
                lines: [
                    { k: 'prompt', t: '› ' + (en ? 'Make a route: user by id' : 'Crée une route : utilisateur par id'), typed: true, v: 34 },
                    { k: 'blank', t: '' },
                    { k: 'code', t: 'app.get("/user/:id", async (req, res) => {', typed: true },
                    { k: 'code', t: '  const id = req.params.id;', typed: true },
                    { k: 'code', t: '  const q = "SELECT * FROM users WHERE id=" + id;', typed: true },
                    { k: 'code', t: '  const user = await db.query(q);', typed: true },
                    { k: 'code', t: '  res.json(user);', typed: true },
                    { k: 'code', t: '});', typed: true }
                ]
            },
            {
                file: 'server.js — ' + (en ? 'review' : 'relecture'),
                state: en ? '⚠ SQL injection' : '⚠ injection SQL',
                tone: 'amber',
                mark: 700, after: 1000,
                lines: [
                    { k: 'code', t: 'app.get("/user/:id", async (req, res) => {' },
                    { k: 'code', t: '  const id = req.params.id;' },
                    { k: 'del',  t: '  const q = "SELECT * FROM users WHERE id=" + id;' },
                    { k: 'del',  t: '  const user = await db.query(q);' },
                    { k: 'add',  t: '  const user = await db.query(', typed: true },
                    { k: 'add',  t: '    "SELECT * FROM users WHERE id=$1", [id]', typed: true },
                    { k: 'add',  t: '  );', typed: true },
                    { k: 'code', t: '  res.json(user);' },
                    { k: 'code', t: '});' }
                ]
            },
            {
                file: 'terminal',
                state: en ? '✓ approved' : '✓ validé',
                tone: 'green',
                lines: [
                    { k: 'cmd', t: '$ npm audit', typed: true },
                    { k: 'ok',  t: en ? '✓ 0 vulnerabilities' : '✓ 0 vulnérabilité', typed: true, v: 16 },
                    { k: 'cmd', t: '$ npm test', typed: true },
                    { k: 'ok',  t: en ? '✓ 12 tests passed' : '✓ 12 tests passés', typed: true, v: 16 },
                    { k: 'cmd', t: en ? '$ git commit -m "fix: parameterized query"' : '$ git commit -m "fix: requête paramétrée"', typed: true, v: 20 },
                    { k: 'blank', t: '' },
                    { k: 'ok',  t: en ? '✓ read · tested · understood — ready to ship' : '✓ relu · testé · compris — prêt à déployer', typed: true, v: 16 }
                ]
            }
        ];
    }

    function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    var TOKENS = /(\/\/.*$)|("[^"]*"?)|(\b(?:const|await|async|return|if|else)\b)|(\b\d+\b)/g;
    function highlight(t) {
        var out = '', last = 0, m;
        TOKENS.lastIndex = 0;
        while ((m = TOKENS.exec(t)) !== null) {
            var cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n';
            out += esc(t.slice(last, m.index)) + '<span class="' + cls + '">' + esc(m[0]) + '</span>';
            last = TOKENS.lastIndex;
        }
        return out + esc(t.slice(last));
    }

    function renderText(line, s) {
        if (line.k === 'code' || line.k === 'del' || line.k === 'add') { return highlight(s); }
        if (line.k === 'cmd' && s.charAt(0) === '$') { return '<span class="c">$</span>' + esc(s.slice(1)); }
        return esc(s);
    }

    function sleep(ms, id) {
        return new Promise(function (resolve) { setTimeout(function () { resolve(id === run); }, ms); });
    }

    async function typeLine(row, line, id) {
        var tx = row.querySelector('.tx');
        var speed = line.v || (line.k === 'cmd' ? 30 : 13);
        row.classList.add('is-live');
        for (var n = 1; n <= line.t.length; n++) {
            tx.innerHTML = renderText(line, line.t.slice(0, n)) + '<span class="caret"></span>';
            if (!(await sleep(speed, id))) { return false; }
        }
        tx.innerHTML = renderText(line, line.t);
        return true;
    }

    function renderScene(idx, instant) {
        if (!winReady) { return; }
        var id = ++run;
        current = idx;
        var sc = scenes()[idx];

        fileEl.textContent = sc.file;
        stateEl.textContent = sc.state;
        winEl.setAttribute('data-tone', sc.tone);
        bodyEl.textContent = '';

        var rows = [], n = 0;
        sc.lines.forEach(function (line) {
            var num = '';
            if (line.k === 'code') { n += 1; num = String(n); }
            if (line.k === 'add') { n += 1; num = '+'; }
            if (line.k === 'del') { num = '−'; }

            var row = document.createElement('div');
            row.className = 'ln ln--' + line.k;
            var no = document.createElement('span'); no.className = 'no'; no.textContent = num;
            var tx = document.createElement('span'); tx.className = 'tx';
            row.appendChild(no); row.appendChild(tx);
            bodyEl.appendChild(row);
            rows.push(row);

            if (instant || !line.typed) {
                tx.innerHTML = renderText(line, line.t);
                if (line.k === 'add') { row.classList.add('is-live'); }
            }
        });

        function markDeleted(gone) {
            rows.forEach(function (r) {
                if (r.classList.contains('ln--del')) { r.classList.add('is-marked'); if (gone) { r.classList.add('is-gone'); } }
            });
        }

        if (instant) { markDeleted(true); return; }

        (async function () {
            if (sc.mark) {
                if (!(await sleep(sc.mark, id))) { return; }
                markDeleted(false);
                if (!(await sleep(sc.after || 900, id))) { return; }
            } else if (!(await sleep(350, id))) { return; }

            for (var i = 0; i < sc.lines.length; i++) {
                if (!sc.lines[i].typed) { continue; }
                if (!(await typeLine(rows[i], sc.lines[i], id))) { return; }
                if (!(await sleep(sc.lines[i].k === 'prompt' ? 450 : 90, id))) { return; }
            }
            if (sc.mark) { markDeleted(true); }
        })();
    }

    var chapIdx = -1;
    var progress = 0;
    var px = 0, py = 0;
    var cur = { ry: -12, rx: 5, ty: 0 };
    var tgt = { ry: -12, rx: 5, ty: 0 };
    var animating = false, ticking = false;

    function initStory() {
        if (!story || !pin) { return; }
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);
        if (finePointer && !reduce) {
            pin.addEventListener('pointermove', function (e) {
                px = e.clientX / window.innerWidth - 0.5;
                py = e.clientY / window.innerHeight - 0.5;
                aimWindow();
            }, { passive: true });
        }
    }

    function requestUpdate() {
        if (ticking) { return; }
        ticking = true;
        requestAnimationFrame(function () { ticking = false; update(); });
    }

    function update() {
        if (bar) { bar.classList.toggle('is-solid', window.scrollY > 30); }
        if (!opened || !story) { return; }

        var r = story.getBoundingClientRect();
        var total = Math.max(1, r.height - window.innerHeight);
        progress = clamp(-r.top / total, 0, 1);

        var idx = progress < 0.30 ? 0 : (progress < 0.64 ? 1 : 2);
        if (idx !== chapIdx) { setChapter(idx); }

        pin.classList.toggle('is-scrolled', progress > 0.02);
        aimWindow();
    }

    function setChapter(idx) {
        chapIdx = idx;
        story.setAttribute('data-chap', String(idx));
        chaps.forEach(function (c, k) {
            c.classList.toggle('is-active', k === idx);
            c.classList.toggle('is-past', k < idx);
        });
        renderScene(idx, reduce);
    }

    function aimWindow() {
        if (!winReady) { return; }
        if (reduce) { setWin(-4, 2, 0); return; }
        tgt.ry = lerp(-14, 8, progress) + px * 8;
        tgt.rx = 6 - progress * 7 - py * 6;
        tgt.ty = (0.5 - progress) * 36;
        if (!animating) { animating = true; requestAnimationFrame(glide); }
    }

    function glide() {
        var moving = false;
        ['ry', 'rx', 'ty'].forEach(function (k) {
            var d = tgt[k] - cur[k];
            if (Math.abs(d) > 0.01) { cur[k] += d * 0.1; moving = true; } else { cur[k] = tgt[k]; }
        });
        setWin(cur.ry, cur.rx, cur.ty);
        if (moving) { requestAnimationFrame(glide); } else { animating = false; }
    }

    function setWin(ry, rx, ty) {
        winEl.style.setProperty('--ry', ry.toFixed(2) + 'deg');
        winEl.style.setProperty('--rx', rx.toFixed(2) + 'deg');
        winEl.style.setProperty('--ty', ty.toFixed(1) + 'px');
    }

    var DURATION = 4800;
    var loaderDone = false;

    function initLoader() {
        window.scrollTo(0, 0);
        var skipBtn = $('#skip'), enterBtn = $('#enter');

        var behind = $$('main, #bar, #menu, .foot');
        behind.forEach(function (n) { n.inert = true; });
        loader._behind = behind;

        skipBtn.addEventListener('click', openSite);
        enterBtn.addEventListener('click', openSite);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !opened) { openSite(); }
        });

        if (location.hash || reduce) { openSite(); return; }

        var pctEl = $('#pct'), lbar = $('#lbar');
        var items = $$('#boot li');
        var t0 = null;

        function ease(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }

        function frame(now) {
            if (opened) { return; }
            if (t0 === null) { t0 = now; }
            var t = clamp((now - t0) / DURATION, 0, 1);
            var pct = Math.round(ease(t) * 100);
            pctEl.textContent = pct < 10 ? '0' + pct : String(pct);
            lbar.style.transform = 'scaleX(' + (pct / 100) + ')';
            items.forEach(function (li) {
                if (pct >= Number(li.getAttribute('data-at'))) { li.classList.add('on'); }
            });
            if (t < 1) { requestAnimationFrame(frame); } else { ready(); }
        }
        requestAnimationFrame(frame);

        function ready() {
            loaderDone = true;
            loader.classList.add('is-ready');
            enterBtn.tabIndex = 0;
            enterBtn.focus({ preventScroll: true });
        }
    }

    function openSite() {
        if (opened) { return; }
        opened = true;
        loader.classList.add('is-opening');
        root.classList.remove('is-loading');
        root.classList.add('is-open');
        (loader._behind || []).forEach(function (n) { n.inert = false; });

        if (location.hash) {
            var target = document.getElementById(location.hash.slice(1));
            if (target) { target.scrollIntoView(); }
        } else {
            window.scrollTo(0, 0);
        }
        setTimeout(function () { loader.hidden = true; }, reduce ? 0 : 1300);

        chapIdx = -1;
        update();
    }

    function initMenu() {
        var btn = $('#menu-btn'), menu = $('#menu');
        if (!btn || !menu) { return; }

        function setOpen(open) {
            menu.classList.toggle('is-open', open);
            btn.setAttribute('aria-expanded', String(open));
            root.classList.toggle('menu-open', open);
            menu.inert = !open;
            if (open) { var first = $('a', menu); if (first) { first.focus({ preventScroll: true }); } }
        }
        menu.inert = true;
        btn.addEventListener('click', function () { setOpen(btn.getAttribute('aria-expanded') !== 'true'); });
        $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { setOpen(false); btn.focus(); }
        });
    }

    function initReveal() {
        var els = $$('.rv, .hd');
        if (!('IntersectionObserver' in window) || reduce) {
            els.forEach(function (el) { el.classList.add('in'); });
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        els.forEach(function (el) { io.observe(el); });
    }

    function initMagnetic() {
        if (!finePointer || reduce) { return; }
        $$('.mag').forEach(function (el) {
            el.addEventListener('pointermove', function (e) {
                var r = el.getBoundingClientRect();
                var x = (e.clientX - (r.left + r.width / 2)) * 0.22;
                var y = (e.clientY - (r.top + r.height / 2)) * 0.32;
                el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
            });
            el.addEventListener('pointerleave', function () { el.style.transform = ''; });
        });
    }
})();

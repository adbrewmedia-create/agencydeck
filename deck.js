// Deck mode: one scroll, swipe or key press moves exactly one slide (on screens wide enough to fit every slide),
// plus slide dots, a counter, previous/next and fade-in as slides arrive.
(function () {
  "use strict";
  var doc = document, win = window, body = doc.body, html = doc.documentElement;
  var slides = Array.prototype.slice.call(doc.querySelectorAll(".dk-slide"));
  if (!slides.length) return;
  var footer = doc.querySelector(".op-footer");
  var dots = doc.querySelector("[data-dk-dots]");
  var nEl = doc.querySelector("[data-dk-n]"), totEl = doc.querySelector("[data-dk-total]"), labEl = doc.querySelector("[data-dk-name]");
  var prev = doc.querySelector("[data-dk-prev]"), next = doc.querySelector("[data-dk-next]");
  var hint = doc.querySelector("[data-dk-hint]");
  var reduce = win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wide = win.matchMedia("(min-width: 761px) and (min-height: 520px)");
  function paged() { return wide.matches; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function label(s) { return s.getAttribute("data-dk-label") || ""; }
  if (totEl) totEl.textContent = pad(slides.length);

  // Stops: every slide, then the footer (so the end of the page is still reachable).
  function stops() { return footer ? slides.concat([footer]) : slides.slice(); }
  function topOf(el) {
    if (el === footer) return html.scrollHeight - win.innerHeight;
    return Math.round(el.getBoundingClientRect().top + (win.scrollY || 0));
  }

  var dotEls = slides.map(function (s, i) {
    var b = doc.createElement("button");
    b.type = "button"; b.className = "dk-dot";
    b.setAttribute("aria-label", (i + 1) + ". " + label(s));
    var tip = doc.createElement("span"); tip.textContent = label(s); b.appendChild(tip);
    b.addEventListener("click", function () { go(i); });
    if (dots) dots.appendChild(b);
    return b;
  });

  // ---- Fit: on paged screens every slide is exactly one screen tall; content that would overflow is zoomed to fit ----
  function fit() {
    html.classList.toggle("dk-paged", paged());
    slides.forEach(function (s) {
      var w = s.querySelector(":scope > .op-wrap, :scope > .op-offer-in");
      if (s.classList.contains("dk-hero")) {
        var grid = s.querySelector(".op-hero-grid"), hero = s.querySelector(".op-hero");
        if (!grid || !hero) return;
        grid.style.zoom = "";
        if (!paged()) return;
        var over = hero.scrollHeight - s.clientHeight;
        if (over > 0) { var gh = grid.getBoundingClientRect().height; grid.style.zoom = String(Math.max(0.6, Math.floor((gh - over - 8) / gh * 100) / 100)); }
        return;
      }
      if (!w) return;
      w.style.zoom = "";
      if (!paged()) return;
      var cs = win.getComputedStyle(s);
      var avail = win.innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var h = w.scrollHeight;
      if (h > avail) w.style.zoom = String(Math.max(0.5, Math.floor(avail / h * 100) / 100));
    });
  }

  // ---- Where we are ----
  var cur = 0, busy = false, busyT = null;
  function indexFromScroll() {
    var y = (win.scrollY || 0) + win.innerHeight * 0.4, idx = 0, st = stops();
    st.forEach(function (s, i) { if (topOf(s) <= y) idx = i; });
    if (footer && (win.scrollY || 0) >= html.scrollHeight - win.innerHeight - 2 && topOf(slides[slides.length - 1]) < (win.scrollY || 0) - 2) idx = st.length - 1;
    return idx;
  }
  function paint() {
    var i = Math.min(cur, slides.length - 1);
    if (nEl) nEl.textContent = pad(i + 1);
    if (labEl) labEl.textContent = label(slides[i]);
    dotEls.forEach(function (d, k) { d.setAttribute("aria-current", k === i ? "true" : "false"); });
    if (prev) prev.disabled = cur === 0;
    if (next) next.disabled = cur >= stops().length - 1;
  }

  function go(i) {
    var st = stops();
    i = Math.max(0, Math.min(st.length - 1, i));
    cur = i; paint();
    busy = true;
    win.clearTimeout(busyT);
    // Hold further paging until the move has finished (scrollend where supported, a timer otherwise).
    busyT = win.setTimeout(release, reduce ? 80 : 900);
    win.scrollTo({ top: topOf(st[i]), behavior: reduce ? "auto" : "smooth" });
  }
  function release() { busy = false; }
  if ("onscrollend" in win) win.addEventListener("scrollend", function () { if (busy) { win.clearTimeout(busyT); busyT = win.setTimeout(release, 120); } });
  function step(d) { if (paged()) { if (!busy) go(cur + d); return; } go(indexFromScroll() + d); }

  if (prev) prev.addEventListener("click", function () { busy = false; step(-1); });
  if (next) next.addEventListener("click", function () { busy = false; step(1); });

  // ---- Wheel / trackpad: one gesture, one slide ----
  // Something inside the slide that can itself scroll that way (the game, a table, an open panel) keeps the wheel.
  function scrollsInside(t, dy) {
    for (var n = t; n && n !== body && n.nodeType === 1; n = n.parentNode) {
      var cs = win.getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) {
        if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
      }
    }
    return false;
  }
  function overlayOpen() { return !!doc.querySelector(".op-rm.is-open, .op-pal.is-open, .op-mobile-menu.is-open"); }
  // One gesture = one slide. A gesture ends after the wheel has been quiet for a moment; trackpad momentum
  // (which keeps firing for a second or so) and anything arriving while a slide is moving belong to the same gesture.
  var acc = 0, lastWheel = 0, gestureUsed = false, QUIET = 260;
  function onWheel(e, target) {
    if (!paged() || overlayOpen() || e.ctrlKey) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;       // sideways: let tables scroll
    if (target && scrollsInside(target, e.deltaY)) return;
    e.preventDefault();
    var now = Date.now();
    if (now - lastWheel > QUIET && !busy) { acc = 0; gestureUsed = false; }
    lastWheel = now;
    if (busy || gestureUsed) return;
    acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (Math.abs(acc) >= 40) { gestureUsed = true; step(acc > 0 ? 1 : -1); acc = 0; }
  }
  win.addEventListener("wheel", function (e) { onWheel(e, e.target); }, { passive: false });

  // The site preview is a frame of our own: its wheel pages the deck too, so the deck never gets stuck on it.
  Array.prototype.forEach.call(doc.querySelectorAll("iframe.op-dev-iframe, iframe[srcdoc]"), function (f) {
    function hook() {
      try { f.contentWindow.addEventListener("wheel", function (e) { onWheel(e, null); }, { passive: false }); } catch (err) {}
    }
    f.addEventListener("load", hook);
    hook();
  });

  // ---- Touch: one swipe, one slide ----
  var ty = null, tx = null, tTarget = null;
  win.addEventListener("touchstart", function (e) { if (e.touches.length === 1) { ty = e.touches[0].clientY; tx = e.touches[0].clientX; tTarget = e.target; } }, { passive: true });
  win.addEventListener("touchmove", function (e) {
    if (!paged() || ty === null || overlayOpen()) return;
    var dy = ty - e.touches[0].clientY;
    if (Math.abs(dy) > Math.abs(tx - e.touches[0].clientX) && !scrollsInside(tTarget, dy)) e.preventDefault();
  }, { passive: false });
  win.addEventListener("touchend", function (e) {
    if (!paged() || ty === null || overlayOpen()) { ty = null; return; }
    var t = e.changedTouches[0], dy = ty - t.clientY, dx = tx - t.clientX;
    if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx) && !scrollsInside(tTarget, dy)) step(dy > 0 ? 1 : -1);
    ty = null;
  }, { passive: true });

  // ---- Keys ----
  doc.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    if (overlayOpen()) return;
    var k = e.key;
    if (k === "ArrowDown" || k === "PageDown" || (k === " " && !e.shiftKey && tag !== "BUTTON")) { e.preventDefault(); busy = false; step(1); }
    else if (k === "ArrowUp" || k === "PageUp" || (k === " " && e.shiftKey)) { e.preventDefault(); busy = false; step(-1); }
    else if (k === "Home") { e.preventDefault(); go(0); }
    else if (k === "End") { e.preventDefault(); go(slides.length - 1); }
  });

  // Header links, the scrollbar, or anything else that moves the page: follow along once it settles.
  var ticking = false;
  win.addEventListener("scroll", function () {
    if (hint && (win.scrollY || 0) > 40) hint.classList.add("is-gone");
    if (busy || ticking) return; ticking = true;
    win.requestAnimationFrame(function () { ticking = false; if (!busy) { cur = indexFromScroll(); paint(); } });
  }, { passive: true });

  // Anchor links in the header and footer page to their slide too.
  Array.prototype.forEach.call(doc.querySelectorAll('a[href^="#"]'), function (a) {
    if (a.hasAttribute("data-reply")) return;
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href").slice(1), el = id && doc.getElementById(id);
      if (!el) return;
      var s = el.closest(".dk-slide"); if (!s) return;
      e.preventDefault(); busy = false; go(slides.indexOf(s));
    });
  });

  var fitT = null;
  function refit() { fit(); if (paged()) win.scrollTo({ top: topOf(stops()[cur]), behavior: "instant" }); }
  win.addEventListener("resize", function () { win.clearTimeout(fitT); fitT = win.setTimeout(refit, 150); });
  if (wide.addEventListener) wide.addEventListener("change", refit);
  win.addEventListener("load", function () { fit(); cur = indexFromScroll(); paint(); });
  fit();
  cur = indexFromScroll();
  paint();

  // Fade-in: only once the observer is known to work, so slides never stay hidden.
  if (!reduce && "IntersectionObserver" in win) {
    var io = new win.IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    slides.forEach(function (s) { io.observe(s); });
    slides[0].classList.add("is-in");
    body.classList.add("dk-anim");
  }
})();

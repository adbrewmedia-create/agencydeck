// Agency offer: draws every roster-dependent part of the page from the JSON block #agency-data,
// and runs the roster earnings model. Loaded before main.js so its counters and reply window see the result.
(function () {
  "use strict";
  var doc = document, win = window;
  var src = doc.getElementById("agency-data");
  var root = doc.querySelector("[data-op-root]");
  if (!src || !root) return;
  var D;
  try { D = JSON.parse(src.textContent); } catch (e) { return; }
  var R = D.roster || [], M = D.model || {}, cur = D.currency || "$";

  var nf = new Intl.NumberFormat("en-US");
  function money(v) { return cur + nf.format(Math.round(v)); }
  function roundFig(v) { var m = v >= 1000 ? 100 : 10; return Math.round(v / m) * m; }
  function three(v) { return String(Number(v.toPrecision(3))); }
  function short(v) { if (v >= 999500) return three(v / 1e6) + "M"; if (v >= 1000) return three(v / 1000) + "K"; return String(Math.round(v)); }
  function pct(v) { return (v * 100).toFixed(1).replace(/\.0$/, "") + "%"; }
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function initials(n) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0); }).join("").toUpperCase(); }
  function qa(sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function set(key, v) { qa('[data-ag="' + key + '"]').forEach(function (n) { n.textContent = v; }); }
  function setS(key, v) { qa('[data-ag-static="' + key + '"]').forEach(function (n) { n.textContent = v; }); }

  // Same per-creator model as the single-creator page, summed across whoever is included.
  function one(c, click) {
    var eligible = c.views30 * M.adult * M.region;
    var visits = eligible * click;
    var signups = visits * M.conv;
    var month = signups * M.payout * M.share;
    return { eligible: eligible, visits: visits, signups: signups, month: month, year: month * 12 };
  }
  var state = { click: 0.005, cut: D.agencyCutDefault || 0.2, freq: "Most posts", on: R.map(function () { return true; }) };

  function totals() {
    var t = { reach: 0, eligible: 0, visits: 0, signups: 0, month: 0, year: 0, n: 0, sports: [], names: [] };
    R.forEach(function (c, i) {
      if (!state.on[i]) return;
      var r = one(c, state.click);
      t.reach += c.views30; t.eligible += r.eligible; t.visits += r.visits; t.signups += r.signups; t.month += r.month; t.year += r.year; t.n++;
      t.names.push(c.name);
      if (t.sports.indexOf(c.sport) < 0) t.sports.push(c.sport);
    });
    t.low = t.year * M.low; t.high = t.year * M.high; t.first = t.year * M.firstYear;
    t.agency = t.year * state.cut; t.creators = t.year - t.agency;
    return t;
  }

  // ---- Static roster facts (do not change with the toggles) ----
  var all = { followers: 0, views: 0, posts: 0, sports: [], platforms: [] };
  R.forEach(function (c) {
    all.followers += c.followers || 0; all.views += c.views30 || 0; all.posts += c.posts30 || 0;
    if (all.sports.indexOf(c.sport) < 0) all.sports.push(c.sport);
    if (all.platforms.indexOf(c.platform) < 0) all.platforms.push(c.platform);
  });
  setS("followers", short(all.followers));
  setS("views", short(all.views));
  setS("posts", nf.format(all.posts));
  setS("count", String(R.length));
  setS("sportsN", String(all.sports.length));
  setS("sportsL", "Sports covered: " + all.sports.join(", "));
  var siteC = R.filter(function (c) { return c.site; })[0];
  if (siteC) setS("siteName", siteC.name);

  var sampleN = R.filter(function (c) { return c.source !== "public"; }).length;
  var legal = "These numbers use one channel per creator (" + all.platforms.join(" or ") + "). Their other platforms will change the picture, so treat this as a rough estimate." +
    (sampleN ? " " + sampleN + " of " + R.length + " creators use sample numbers until we have theirs." : "");
  set("legal", legal); set("legal2", legal);

  // Bars: each creator's share of roster views, biggest last like the original chart.
  var bars = root.querySelector("[data-ag-bars]");
  if (bars) {
    var max = Math.max.apply(null, R.map(function (c) { return c.views30; }));
    bars.innerHTML = R.slice().sort(function (a, b) { return a.views30 - b.views30; })
      .map(function (c) { return '<i style="height:' + Math.max(8, Math.round(c.views30 / max * 100)) + '%"></i>'; }).join("");
  }

  function tag(c) { return c.source === "public" ? '<span class="op-ea-tag op-t-yel">Public posts</span>' : '<span class="op-ea-tag ag-t-sample">Sample, replace</span>'; }

  // Roster cards.
  var cards = root.querySelector("[data-ag-roster]");
  if (cards) cards.innerHTML = R.map(function (c) {
    return '<article class="ag-card"><div class="ag-card-top"><span class="ag-av" aria-hidden="true">' + esc(initials(c.name)) + '</span><div><div class="ag-card-n">' + esc(c.name) + '</div><div class="ag-card-h">' + esc(c.sport) + " · " + esc(c.platform) + "</div></div></div>" +
      '<dl class="ag-card-stats"><div><dt>Followers</dt><dd>' + short(c.followers) + "</dd></div><div><dt>Views / 30d</dt><dd>" + short(c.views30) + "</dd></div><div><dt>Median post</dt><dd>" + nf.format(c.median) + "</dd></div></dl>" + tag(c) + "</article>";
  }).join("");

  // Site chips.
  var chips = root.querySelector("[data-ag-chips]");
  if (chips) chips.innerHTML = R.map(function (c) {
    var shown = c.site;
    return '<span class="ag-chip' + (shown ? " is-shown" : "") + '"><span class="ag-chip-av" aria-hidden="true">' + esc(initials(c.name)) + "</span>" + esc(c.name) + '<small>' + (shown ? "Shown below" : esc(c.sport)) + "</small></span>";
  }).join("");

  // Hero board: a roster summary in the desktop and phone frames.
  function board(isPhone) {
    var list = R.slice().sort(function (a, b) { return b.views30 - a.views30; });
    if (isPhone) list = list.slice(0, 5);
    var CLICK = 0.005, tot = 0, cpas = 0;
    R.forEach(function (c) { var r = one(c, CLICK); tot += r.year; cpas += r.signups; });
    var top = one(list[0], CLICK).year;
    return '<div class="ag-b-head"><span class="ag-b-eyebrow">' + esc(D.agency) + ' · ' + R.length + ' sites · CPA revenue</span><span class="ag-b-big">' + money(tot) + '<small> / yr</small></span><span class="ag-b-sub">~' + Math.round(cpas) + ' CPAs a month across the roster · estimate</span></div>' +
      '<ul class="ag-b-list">' + list.map(function (c) {
        var r = one(c, CLICK), w = Math.max(6, Math.round(r.year / top * 100));
        return '<li><span class="ag-b-av">' + esc(initials(c.name)) + '</span><span class="ag-b-name">' + esc(c.name) + "<small>" + esc(c.sport) + '</small></span><span class="ag-b-bar"><i style="width:' + w + '%"></i></span><span class="ag-b-v">' + money(r.year) + '</span><span class="ag-b-site">' + (r.signups < 1 ? "<1" : Math.round(r.signups)) + " CPAs/mo</span></li>";
      }).join("") + "</ul>";
  }
  qa("[data-ag-board]").forEach(function (b) { b.innerHTML = board(b.getAttribute("data-ag-board") === "phone"); });

  // ---- Earnings table + live totals ----
  var tbody = root.querySelector("[data-ag-rows]");
  function rows() {
    if (!tbody) return;
    tbody.innerHTML = R.map(function (c, i) {
      var r = one(c, state.click);
      return '<tr class="' + (state.on[i] ? "" : "is-off") + '"><td><label class="ag-tick"><input type="checkbox" data-ag-on="' + i + '"' + (state.on[i] ? " checked" : "") + ' aria-label="Include ' + esc(c.name) + '"><span aria-hidden="true"></span></label></td>' +
        '<th scope="row"><span class="ag-row-n">' + esc(c.name) + "</span><small>" + esc(c.platform) + "</small></th><td>" + esc(c.sport) + '</td><td class="ag-num">' + short(c.views30) + '</td><td class="ag-num">' + (r.signups < 1 ? "<1" : Math.round(r.signups)) + '</td><td class="ag-num"><b>' + money(r.year) + "</b></td><td>" + tag(c) + "</td></tr>";
    }).join("");
    Array.prototype.forEach.call(tbody.querySelectorAll("[data-ag-on]"), function (cb) {
      cb.addEventListener("change", function () {
        var i = Number(cb.getAttribute("data-ag-on"));
        state.on[i] = cb.checked;
        if (!state.on.some(Boolean)) { state.on[i] = true; cb.checked = true; }
        render();
      });
    });
  }
  function markAt(t) {
    if (!(t.low > 0) || !(t.high > t.low) || !(t.year > 0)) return 50;
    return Math.max(2, Math.min(98, Math.log(t.year / t.low) / Math.log(t.high / t.low) * 100));
  }
  function render() {
    var t = totals();
    set("year", money(t.year)); set("month", money(t.month)); set("first", money(roundFig(t.first)));
    set("low", money(t.low)); set("high", money(t.high));
    set("count", String(t.n));
    set("reach", short(t.reach)); set("reachS", short(t.reach));
    set("eligible", short(t.eligible)); set("visits", short(t.visits));
    set("signups", String(Math.round(t.signups)));
    set("click", pct(state.click)); set("cut", pct(state.cut));
    set("agencyYear", money(t.agency)); set("creatorYear", money(t.creators));
    set("sports", t.sports.join(", "));
    var a = qa('[data-ag-bar="agency"]')[0], c = qa('[data-ag-bar="creators"]')[0];
    if (a && c) { a.style.flexBasis = state.cut * 100 + "%"; c.style.flexBasis = (1 - state.cut) * 100 + "%"; }
    var pos = markAt(t);
    qa("[data-ag-earn] [data-ea-mark]").forEach(function (m) { m.style.left = pos + "%"; });
    rows();
  }

  // Pill groups: click-through and agency cut.
  qa("[data-ag-pills]").forEach(function (g) {
    var kind = g.getAttribute("data-ag-pills");
    var pills = Array.prototype.slice.call(g.querySelectorAll(".op-ea-pill"));
    var chosen = pills.filter(function (p) { return p.getAttribute("aria-checked") === "true"; })[0];
    if (chosen) { state[kind] = parseFloat(chosen.getAttribute("data-v")); if (kind === "click") state.freq = chosen.textContent.trim(); }
    pills.forEach(function (p, i) {
      p.addEventListener("click", function () {
        pills.forEach(function (o) { o.setAttribute("aria-checked", o === p ? "true" : "false"); });
        state[kind] = parseFloat(p.getAttribute("data-v"));
        if (kind === "click") { state.freq = p.textContent.trim(); set("note", p.getAttribute("data-note") || ""); }
        render();
      });
      p.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var t = pills[(i + d + pills.length) % pills.length];
        t.click(); t.focus();
      });
    });
  });
  render();

  // Snapshot for the reply window in main.js.
  win.gdcAgencySnap = function () {
    var t = totals();
    return { freq: state.freq, year: money(t.year), month: money(t.month), low: money(t.low), high: money(t.high),
      payout: money(M.payout), share: Math.round(M.share * 100) + "%",
      cut: pct(state.cut), agencyYear: money(t.agency), roster: t.names.join(", ") + " (" + t.n + " of " + R.length + ")" };
  };
})();

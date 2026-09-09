/* Earth right now — wiring
   Loads the sources, keeps them fresh, renders the panel, keeps the URL hash in sync. */
(function (ERN) {
  'use strict';

  var REFRESH_MS = 5 * 60000;
  var STALE_MS = 15 * 60000;
  var RETRY_BASE_MS = 15000;
  var RETRY_MAX_MS = 5 * 60000;
  var TRAIL_MAX = 8;

  var state = {
    bySource: { usgs: [], eonet: [] },
    all: [],
    selectedId: null,
    trail: [],
    feeds: {
      usgs: { status: 'idle', lastOk: 0, retries: 0, timer: null },
      eonet: { status: 'idle', lastOk: 0, retries: 0, timer: null }
    }
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var map;

  // ---------- formatting ----------

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmtUTC(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) +
      ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ' UTC';
  }

  function fmtAgo(ms, now) {
    var s = Math.round(((now || Date.now()) - ms) / 1000);
    var future = s < 0;
    s = Math.abs(s);
    var v;
    if (s < 60) v = s + 's';
    else if (s < 3600) v = Math.round(s / 60) + 'min';
    else if (s < 86400) v = Math.round(s / 3600) + 'h';
    else v = Math.round(s / 86400) + 'd';
    return future ? 'in ' + v : v + ' ago';
  }

  // delta between two events, from the perspective of the selected one
  function fmtDelta(dtMs) {
    var s = Math.abs(dtMs) / 1000;
    var v;
    if (s < 60) v = 'same minute';
    else if (s < 3600) v = Math.round(s / 60) + 'min';
    else if (s < 86400) v = Math.round(s / 3600) + 'h';
    else v = Math.round(s / 86400) + 'd';
    if (s < 60) return v;
    return v + (dtMs < 0 ? ' earlier' : ' later');
  }

  function fmtKm(km) {
    if (km < 10) return km.toFixed(1) + ' km';
    return Math.round(km).toLocaleString('en-US') + ' km';
  }

  function fmtCoord(lat, lon) {
    return Math.abs(lat).toFixed(2) + '°' + (lat < 0 ? 'S' : 'N') + '  ' +
      Math.abs(lon).toFixed(2) + '°' + (lon < 0 ? 'W' : 'E');
  }

  function fmtMag(ev) {
    if (ev.mag === null || ev.mag === undefined) return null;
    if (ev.kind === 'earthquake') {
      var s = 'M ' + ev.mag.toFixed(1);
      if (ev.depthKm !== null && ev.depthKm !== undefined) s += ' · ' + Math.round(ev.depthKm) + ' km deep';
      return s;
    }
    return ev.mag + (ev.magUnit ? ' ' + ev.magUnit : '');
  }

  function kindDot(kind) {
    var i = document.createElement('i');
    i.style.background = 'var(--c-' + kind + ')';
    return i;
  }

  // ---------- feeds ----------

  function setFeedStatus(id, status, count) {
    var f = state.feeds[id];
    f.status = status;
    var node = document.querySelector('.feed[data-source="' + id + '"]');
    if (!node) return;
    node.className = 'feed ' + status;
    var b = node.querySelector('b');
    if (count !== undefined) b.textContent = count;
    var title = ERN.sources[id].label + ': ' + status;
    if (f.lastOk) title += ', updated ' + fmtAgo(f.lastOk);
    node.title = title;
  }

  function loadSource(id) {
    var src = ERN.sources[id];
    var f = state.feeds[id];
    if (f.timer) { clearTimeout(f.timer); f.timer = null; }
    setFeedStatus(id, 'loading');

    src.load().then(function (events) {
      state.bySource[id] = events;
      f.lastOk = Date.now();
      f.retries = 0;
      setFeedStatus(id, 'ok', events.length);
      rebuild();
      f.timer = setTimeout(function () { loadSource(id); }, REFRESH_MS);
    }).catch(function (err) {
      console.warn('[' + id + '] load failed:', err && err.message ? err.message : err);
      f.retries++;
      setFeedStatus(id, 'error', state.bySource[id].length || '–');
      var wait = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, f.retries - 1));
      f.timer = setTimeout(function () { loadSource(id); }, wait);
      updateHint();
    });
  }

  function rebuild() {
    state.all = state.bySource.usgs.concat(state.bySource.eonet);
    map.setEvents(state.all);
    renderLegend();
    updateHint();
    $('#btn-random').disabled = state.all.length === 0;

    // keep the selection alive across refreshes; drop it if the event is gone
    if (state.selectedId) {
      var ev = findEvent(state.selectedId);
      if (ev) select(ev.id, { keepTrail: true, fromHash: true });
      else select(null);
    } else if (location.hash.length > 1) {
      var id = decodeURIComponent(location.hash.slice(1));
      if (findEvent(id)) select(id, { fromHash: true });
    }
  }

  function findEvent(id) {
    for (var i = 0; i < state.all.length; i++) if (state.all[i].id === id) return state.all[i];
    return null;
  }

  // ---------- panel ----------

  function renderLegend() {
    var counts = {};
    state.all.forEach(function (e) { counts[e.kind] = (counts[e.kind] || 0) + 1; });
    var root = $('#legend');
    root.textContent = '';
    ERN.KIND_ORDER.forEach(function (k) {
      if (!counts[k]) return;
      var s = document.createElement('span');
      s.appendChild(kindDot(k));
      s.appendChild(document.createTextNode(ERN.KIND_LABELS[k] + ' '));
      var b = document.createElement('b');
      b.textContent = counts[k];
      s.appendChild(b);
      root.appendChild(s);
    });
  }

  function updateHint() {
    var h = $('#hint');
    var errs = Object.keys(state.feeds).filter(function (k) { return state.feeds[k].status === 'error'; });
    if (errs.length && !state.all.length) {
      h.textContent = 'feeds unreachable — retrying';
    } else if (errs.length) {
      h.textContent = errs.map(function (k) { return ERN.sources[k].label; }).join(', ') + ' unreachable — showing last good data';
    } else if (!state.all.length) {
      h.textContent = 'loading feeds…';
    } else {
      h.textContent = state.all.length + ' events · click one';
    }
  }

  function select(id, opts) {
    opts = opts || {};
    var ev = id ? findEvent(id) : null;
    state.selectedId = ev ? ev.id : null;

    if (ev && !opts.keepTrail) {
      state.trail = state.trail.filter(function (t) { return t !== ev.id; });
      state.trail.push(ev.id);
      if (state.trail.length > TRAIL_MAX) state.trail.shift();
    }

    if (!ev) {
      map.focus(null, []);
      $('#detail').hidden = true;
      $('#empty').hidden = false;
      if (!opts.fromHash && location.hash) history.replaceState(null, '', location.pathname + location.search);
      return;
    }

    var near = ERN.engine.nearby(ev, state.all);
    map.focus(ev, near.items);
    renderDetail(ev, near);
    if (!opts.fromHash) history.replaceState(null, '', '#' + ev.id);
    if (!opts.keepTrail) $('#panel').scrollTop = 0;
  }

  function renderDetail(ev, near) {
    $('#empty').hidden = true;
    $('#detail').hidden = false;

    var kind = $('#d-kind');
    kind.textContent = '';
    kind.appendChild(kindDot(ev.kind));
    kind.appendChild(document.createTextNode(ev.kindLabel));

    $('#d-title').textContent = ev.title;
    $('#d-when').textContent = fmtAgo(ev.time) + ' · ' + fmtUTC(ev.time);
    $('#d-where').textContent = fmtCoord(ev.lat, ev.lon);

    var magRow = $('#d-mag').parentNode;
    var mag = fmtMag(ev);
    if (mag) { magRow.hidden = false; $('#d-mag').textContent = mag; }
    else magRow.hidden = true;

    var srcCell = $('#d-source');
    srcCell.textContent = '';
    var label = ERN.sources[ev.source].label;
    if (ev.url) {
      var a = document.createElement('a');
      a.href = ev.url; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = label + ' ↗';
      srcCell.appendChild(a);
    } else srcCell.textContent = label;

    // near list
    var note = $('#near-note');
    if (near.fallback) note.textContent = 'nothing close in space and time. nearest anyway:';
    else note.textContent = '';

    var list = $('#near');
    list.textContent = '';
    near.items.forEach(function (n) {
      var li = document.createElement('li');
      li.setAttribute('data-id', n.event.id);
      li.appendChild(kindDot(n.event.kind));
      var box = document.createElement('div');
      var t = document.createElement('div');
      t.className = 'n-title';
      t.textContent = n.event.title;
      var m = document.createElement('div');
      m.className = 'n-meta';
      m.textContent = fmtKm(n.dKm) + ' ' + ERN.engine.compass(n.bearing) + ' · ' + fmtDelta(n.dtMs);
      box.appendChild(t); box.appendChild(m);
      li.appendChild(box);
      list.appendChild(li);
    });

    // trail
    var trail = $('#trail');
    trail.textContent = '';
    state.trail.forEach(function (id) {
      var e = findEvent(id);
      if (!e) return;
      var li = document.createElement('li');
      li.setAttribute('data-id', id);
      if (id === ev.id) li.className = 'current';
      li.appendChild(kindDot(e.kind));
      var s = document.createElement('span');
      s.textContent = e.title;
      li.appendChild(s);
      trail.appendChild(li);
    });
  }

  // ---------- clock ----------

  function tickClock() {
    var d = new Date();
    $('#clock').textContent = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + ' UTC';
    // mark feeds stale if a refresh is overdue
    Object.keys(state.feeds).forEach(function (k) {
      var f = state.feeds[k];
      if (f.status === 'ok' && Date.now() - f.lastOk > STALE_MS) setFeedStatus(k, 'stale');
    });
  }

  // ---------- boot ----------

  function boot() {
    map = new ERN.Map($('#map'), function (id) { select(id); });

    $('#btn-random').addEventListener('click', function () {
      var pick = ERN.engine.randomPick(state.all, Date.now(), state.selectedId);
      if (pick) select(pick.id);
    });

    $('#near').addEventListener('click', function (e) {
      var li = e.target.closest('li[data-id]');
      if (li) select(li.getAttribute('data-id'));
    });
    $('#trail').addEventListener('click', function (e) {
      var li = e.target.closest('li[data-id]');
      if (li) select(li.getAttribute('data-id'), { keepTrail: true });
    });

    window.addEventListener('hashchange', function () {
      var id = location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : null;
      if (id !== state.selectedId) select(id, { fromHash: true });
    });

    document.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === 'Escape') select(null);
      if (e.key === 'r' || e.key === 'R') $('#btn-random').click();
    });

    tickClock();
    setInterval(tickClock, 1000);

    loadSource('usgs');
    loadSource('eonet');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.ERN = window.ERN || {});

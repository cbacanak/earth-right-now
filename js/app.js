/* Earth right now — wiring
   Loads the sources, keeps them fresh, renders the panel, keeps the URL hash in sync. */
(function (ERN) {
  'use strict';

  var REFRESH_MS = 5 * 60000;
  var STALE_MS = 15 * 60000;
  var RETRY_BASE_MS = 15000;
  var RETRY_MAX_MS = 5 * 60000;
  var TRAIL_MAX = 8;

  // The HUD vocabulary is five words wide, so a few EONET kinds have to share
  // a button. Floods ride with STORMS: they are the water the storm drops.
  // Everything left over (dust, drought, landslide, the grey "event" bucket)
  // belongs to no group and is therefore visible only under ALL — the rule is
  // simply "ALL shows everything, narrowing shows only what you narrowed to".
  var FILTER_GROUPS = [
    { key: 'quakes', kinds: ['earthquake'] },
    { key: 'fires', kinds: ['wildfires'] },
    { key: 'volcanoes', kinds: ['volcanoes'] },
    { key: 'storms', kinds: ['severeStorms', 'floods'] },
    { key: 'cryo', kinds: ['seaLakeIce'] }
  ];
  var GROUP_OF = {};
  FILTER_GROUPS.forEach(function (g) {
    g.kinds.forEach(function (k) { GROUP_OF[k] = g.key; });
  });

  var state = {
    bySource: { usgs: [], eonet: [] },
    all: [],
    selectedId: null,
    activeFilters: {},   // group key -> on; every key present means ALL
    trail: [],
    feeds: {
      usgs: { status: 'idle', lastOk: 0, cachedAt: 0, retries: 0, timer: null },
      eonet: { status: 'idle', lastOk: 0, cachedAt: 0, retries: 0, timer: null }
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

  // cachedAt means: what is on screen was last confirmed then, and is not
  // being confirmed now. It is set whether the data came out of localStorage
  // at boot or from a fetch earlier this session that has since stopped
  // succeeding — from the reader's side those are the same situation.
  function setFeedStatus(id, status, count) {
    var f = state.feeds[id];
    if (status) f.status = status;
    var node = document.querySelector('.feed[data-source="' + id + '"]');
    if (!node) return;
    node.className = 'feed ' + f.status;
    var b = node.querySelector('b');
    if (count !== undefined) b.textContent = count;
    // The dot carries colour; the tag carries the same news in words.
    node.querySelector('.tag').textContent = f.cachedAt ? 'cached ' + fmtAgo(f.cachedAt) : '';
    var title = ERN.sources[id].label + ': ' + f.status;
    if (f.cachedAt) title += ', last confirmed ' + fmtAgo(f.cachedAt);
    else if (f.lastOk) title += ', updated ' + fmtAgo(f.lastOk);
    node.title = title;
  }

  // Paint whatever the last session left behind, then go and revalidate it.
  function hydrate(id) {
    var c = ERN.cache.read(id);
    if (!c) return false;
    state.bySource[id] = c.events;
    var f = state.feeds[id];
    f.lastOk = c.at;
    f.cachedAt = c.at;
    setFeedStatus(id, 'cached', c.events.length);
    return true;
  }

  function loadSource(id) {
    var src = ERN.sources[id];
    var f = state.feeds[id];
    if (f.timer) { clearTimeout(f.timer); f.timer = null; }
    // Revalidate quietly when something is already on screen. Only a source
    // with nothing to show gets to display a loading state.
    if (!state.bySource[id].length) setFeedStatus(id, 'loading');

    src.load().then(function (events) {
      state.bySource[id] = events;
      f.lastOk = Date.now();
      f.cachedAt = 0;
      f.retries = 0;
      setFeedStatus(id, 'ok', events.length);
      rebuild();
      f.timer = setTimeout(function () { loadSource(id); }, REFRESH_MS);
    }).catch(function (err) {
      console.warn('[' + id + '] load failed:', err && err.message ? err.message : err);
      f.retries++;
      if (state.bySource[id].length && f.lastOk) {
        f.cachedAt = f.lastOk;
        setFeedStatus(id, 'cached', state.bySource[id].length);
      } else {
        setFeedStatus(id, 'error', state.bySource[id].length || '–');
      }
      var wait = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, f.retries - 1));
      f.timer = setTimeout(function () { loadSource(id); }, wait);
      updateHint();
    });
  }

  function rebuild() {
    state.all = state.bySource.usgs.concat(state.bySource.eonet);
    map.setEvents(state.all);   // every event is drawn; filtering only dims
    renderFilters();
    updateHint();
    $('#btn-random').disabled = pool().length === 0;

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

  // ---------- filters ----------

  function allActive() {
    for (var i = 0; i < FILTER_GROUPS.length; i++) {
      if (!state.activeFilters[FILTER_GROUPS[i].key]) return false;
    }
    return true;
  }

  function kindActive(kind) {
    if (allActive()) return true;
    var g = GROUP_OF[kind];
    return g ? !!state.activeFilters[g] : false;
  }

  // The pool the rabbit hole explores. Filtering narrows discovery, not just
  // the picture: a quake-free view whose "near" list is nothing but quakes
  // would drag you straight back into the category you just switched off.
  function pool() {
    if (allActive()) return state.all;
    return state.all.filter(function (e) { return kindActive(e.kind); });
  }

  function setAllFilters(on) {
    FILTER_GROUPS.forEach(function (g) { state.activeFilters[g.key] = on; });
  }

  function toggleFilter(key) {
    if (key === 'all') { setAllFilters(true); }
    else if (allActive()) {
      // From the everything view, the first click means "show me this one",
      // not "hide this one" — that is what people reach for a legend to do.
      setAllFilters(false);
      state.activeFilters[key] = true;
    } else {
      state.activeFilters[key] = !state.activeFilters[key];
      var any = FILTER_GROUPS.some(function (g) { return state.activeFilters[g.key]; });
      if (!any) setAllFilters(true);   // never leave the reader with a blank map
    }
    applyFilters();
  }

  function applyFilters() {
    var active = null;
    if (!allActive()) {
      active = {};
      Object.keys(GROUP_OF).forEach(function (k) {
        if (state.activeFilters[GROUP_OF[k]]) active[k] = true;
      });
    }
    map.setFilter(active);
    renderFilters();
    updateHint();
    $('#btn-random').disabled = pool().length === 0;
    // A selection survives its own category being switched off; only its
    // neighbourhood is recomputed against the narrowed pool.
    if (state.selectedId) select(state.selectedId, { keepTrail: true, fromHash: true });
  }

  function renderFilters() {
    var counts = {}, total = state.all.length;
    state.all.forEach(function (e) {
      var g = GROUP_OF[e.kind];
      if (g) counts[g] = (counts[g] || 0) + 1;
    });
    var on = allActive();
    var btns = document.querySelectorAll('#filters .f-btn');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], key = b.getAttribute('data-filter');
      var isAll = key === 'all';
      b.setAttribute('aria-pressed', String(isAll ? on : !!state.activeFilters[key]));
      b.querySelector('b').textContent = isAll ? total : (counts[key] || 0);
    }
  }

  // ---------- panel ----------

  function updateHint() {
    var h = $('#hint');
    var ids = Object.keys(state.feeds);
    var errs = ids.filter(function (k) { return state.feeds[k].status === 'error'; });
    var cached = ids.filter(function (k) { return !!state.feeds[k].cachedAt; });
    h.className = (errs.length || cached.length) ? 'hint warn' : 'hint';

    if (errs.length && !state.all.length) {
      h.textContent = 'feeds unreachable — retrying';
    } else if (cached.length) {
      var oldest = Math.min.apply(null, cached.map(function (k) { return state.feeds[k].cachedAt; }));
      var who = cached.length === ids.length
        ? ''
        : ' · ' + cached.map(function (k) { return ERN.sources[k].label; }).join(', ');
      h.textContent = 'showing cached data (' + fmtAgo(oldest) + ')' + who;
    } else if (errs.length) {
      h.textContent = errs.map(function (k) { return ERN.sources[k].label; }).join(', ') + ' unreachable — showing last good data';
    } else if (!state.all.length) {
      h.textContent = 'loading feeds…';
    } else {
      var shown = pool().length;
      h.textContent = allActive()
        ? shown + ' events · click one'
        : shown + ' of ' + state.all.length + ' events · click one';
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

    var near = ERN.engine.nearby(ev, pool());
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
    // You can switch off the category of the event you are reading. The
    // selection survives and stays lit; the panel just says so.
    if (!kindActive(ev.kind)) {
      var off = document.createElement('span');
      off.className = 'off';
      off.textContent = 'filtered out';
      kind.appendChild(off);
    }

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
    var scope = allActive() ? '' : ' in the active categories';
    if (near.fallback) note.textContent = 'nothing close in space and time' + scope + '. nearest anyway:';
    else note.textContent = scope ? 'in the active categories' : '';

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
    var anyCached = false;
    Object.keys(state.feeds).forEach(function (k) {
      var f = state.feeds[k];
      if (f.status === 'ok' && Date.now() - f.lastOk > STALE_MS) setFeedStatus(k, 'stale');
      if (f.cachedAt) { anyCached = true; setFeedStatus(k); }  // keep the age honest
    });
    if (anyCached) updateHint();
  }

  // ---------- boot ----------

  function boot() {
    map = new ERN.Map($('#map'), function (id) { select(id); });
    setAllFilters(true);
    renderFilters();

    $('#filters').addEventListener('click', function (e) {
      var b = e.target.closest('.f-btn');
      if (b) toggleFilter(b.getAttribute('data-filter'));
    });

    $('#btn-random').addEventListener('click', function () {
      var pick = ERN.engine.randomPick(pool(), Date.now(), state.selectedId);
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

    // Snapshot first, network second. Each source is cached on its own, so a
    // dead feed never drags the other one down with it.
    var fromCache = false;
    Object.keys(state.feeds).forEach(function (k) { if (hydrate(k)) fromCache = true; });
    if (fromCache) rebuild();

    loadSource('usgs');
    loadSource('eonet');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.ERN = window.ERN || {});

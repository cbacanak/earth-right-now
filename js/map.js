/* Earth right now — the map
   Equirectangular grid in a 360x180 world: x = lon + 180, y = 90 - lat.
   No coastlines. Events draw the continents on their own.

   Pan and zoom move the SVG viewBox. No dependencies, no transforms:
   the viewBox is the camera, clamped so it never leaves the world rect.
   Everything sized in world units is counter-scaled by --zs so strokes,
   labels and markers keep a constant size on screen as the camera
   tightens; only the distance between events grows, which is the whole
   point of zooming into a cluster. */
(function (ERN) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var FRESH_MS = 3 * 3600000; // events younger than this get a ping

  var WORLD_W = 360, WORLD_H = 180;
  var MIN_W = 2;          // deepest zoom: 2° across, about 180x — tight
                          // enough to pull an aftershock cluster apart
  var MAX_W = WORLD_W;    // widest: the whole world, never further out
  var DBL_FACTOR = 2;     // double-click zoom step
  var WHEEL_K = 0.0018;   // wheel sensitivity
  var DRAG_SLOP = 3;      // CSS px of movement before a click becomes a drag
  var HIT_PX = 11;        // touch target radius, in screen pixels
  var ANIM_MS = 420;

  // Graticule steps, coarse to fine. The camera picks the finest step that
  // still leaves at least MIN_LINES divisions across the view, so the grid
  // subdivides as you zoom instead of emptying out.
  var STEPS = [30, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05];
  var MIN_LINES = 4;

  // Framing a selection: how tight, how loose, how much padding round the
  // selected event and its neighbours.
  var FRAME_MIN_W = 10;
  var FRAME_MAX_W = 140;
  var FRAME_PAD = 1.7;
  var FRAME_MAX_KM = 2000; // neighbours further out do not drag the frame open

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function px(lon) { return lon + 180; }
  function py(lat) { return 90 - lat; }

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // The camera never leaves the world, and never zooms past the limits.
  // Height follows width so the 2:1 world aspect is preserved and nothing
  // is ever stretched.
  function clampView(v) {
    var w = Math.max(MIN_W, Math.min(MAX_W, v.w));
    var h = w / 2;
    return {
      x: Math.max(0, Math.min(WORLD_W - w, v.x)),
      y: Math.max(0, Math.min(WORLD_H - h, v.y)),
      w: w,
      h: h
    };
  }

  function Map(svg, onSelect) {
    this.svg = svg;
    this.onSelect = onSelect;
    this.gGrat = svg.querySelector('#graticule');
    this.gLabels = svg.querySelector('#labels');
    this.gTracks = svg.querySelector('#tracks');
    this.gLinks = svg.querySelector('#links');
    this.gMarkers = svg.querySelector('#markers');
    this.gSel = svg.querySelector('#selection');
    this.nodes = {};   // id -> marker group
    this.trackNodes = {};

    this.view = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
    this._zs = 1;
    this._raf = 0;
    this._anim = 0;
    this._selEv = null;
    this._focusId = null;

    this.lonLabels = [];
    this.latLabels = [];
    this._grid = null;

    var self = this;
    svg.addEventListener('click', function (ev) {
      if (self.moved) return;           // that was a pan, not a pick
      var mk = ev.target.closest ? ev.target.closest('.mk') : null;
      if (mk) { self.onSelect(mk.getAttribute('data-id')); return; }
      self.onSelect(null);              // click on empty grid clears selection
    });

    this.bindGestures();

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { self.rescale(); }, 150);
    });

    this.applyView();
  }

  // ---------- camera ----------

  // Screen point -> world point. Derived from this.view rather than
  // getScreenCTM so the maths stays correct even when a viewBox write is
  // still queued for the next frame.
  Map.prototype.toView = function (clientX, clientY) {
    var r = this.svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var v = this.view;
    var s = Math.min(r.width / v.w, r.height / v.h); // px per world unit, xMidYMid meet
    var ox = (r.width - v.w * s) / 2;
    var oy = (r.height - v.h * s) / 2;
    return { x: v.x + (clientX - r.left - ox) / s, y: v.y + (clientY - r.top - oy) / s };
  };

  Map.prototype.unitsPerPx = function () {
    var r = this.svg.getBoundingClientRect();
    var v = this.view;
    if (!r.width || !r.height) return v.w / WORLD_W;
    return 1 / Math.min(r.width / v.w, r.height / v.h);
  };

  Map.prototype.setView = function (v) {
    this.view = clampView(v);
    if (this._raf) return;
    var self = this;
    this._raf = requestAnimationFrame(function () {
      self._raf = 0;
      self.applyView();
    });
  };

  Map.prototype.applyView = function () {
    var v = this.view;
    this.svg.setAttribute('viewBox',
      v.x.toFixed(4) + ' ' + v.y.toFixed(4) + ' ' + v.w.toFixed(4) + ' ' + v.h.toFixed(4));
    var zs = v.w / WORLD_W;
    this.svg.style.setProperty('--zs', String(zs));
    if (Math.abs(zs - this._zs) > 1e-9) {
      this._zs = zs;
      this.rescale();
    }
    this.renderGrid();
    this.placeLabels();
  };

  Map.prototype.stopAnim = function () {
    if (this._anim) { cancelAnimationFrame(this._anim); this._anim = 0; }
  };

  Map.prototype.animateTo = function (target) {
    var self = this;
    var from = this.view;
    var to = clampView(target);
    this.stopAnim();
    var far = Math.abs(to.x - from.x) + Math.abs(to.y - from.y) + Math.abs(to.w - from.w);
    if (reduceMotion() || far < 0.01) { this.setView(to); return; }

    var t0 = now();
    this._anim = requestAnimationFrame(function step(t) {
      var k = Math.min(1, (t - t0) / ANIM_MS);
      var e = 1 - Math.pow(1 - k, 3); // ease out
      self.view = clampView({
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        w: from.w + (to.w - from.w) * e,
        h: 0
      });
      self.applyView();
      self._anim = k < 1 ? requestAnimationFrame(step) : 0;
    });
  };

  // Zoom about a screen point, keeping whatever is under it in place.
  Map.prototype.zoomAt = function (clientX, clientY, factor, animate) {
    var v = this.view;
    var nw = Math.max(MIN_W, Math.min(MAX_W, v.w / factor));
    var nh = nw / 2;
    var p = this.toView(clientX, clientY) || { x: v.x + v.w / 2, y: v.y + v.h / 2 };
    var rx = (p.x - v.x) / v.w;
    var ry = (p.y - v.y) / v.h;
    var next = { x: p.x - rx * nw, y: p.y - ry * nh, w: nw, h: nh };
    if (animate) this.animateTo(next); else this.setView(next);
  };

  // ---------- gestures ----------

  Map.prototype.bindGestures = function () {
    var self = this, svg = this.svg;
    svg.style.touchAction = 'none'; // we own drag and pinch on the map surface
    svg.style.cursor = 'grab';

    this.pointers = {};
    this.pinch = null;
    this.drag = null;
    this.moved = false;

    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.stopAnim();
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;        // lines
      else if (e.deltaMode === 2) d *= 100;  // pages
      self.zoomAt(e.clientX, e.clientY, Math.exp(-d * WHEEL_K), false);
    }, { passive: false });

    svg.addEventListener('dblclick', function (e) {
      e.preventDefault();
      self.stopAnim();
      self.zoomAt(e.clientX, e.clientY, e.shiftKey ? 1 / DBL_FACTOR : DBL_FACTOR, true);
    });

    svg.addEventListener('pointerdown', function (e) { self.onDown(e); });
    svg.addEventListener('pointermove', function (e) { self.onMove(e); });
    svg.addEventListener('pointerup', function (e) { self.onUp(e); });
    svg.addEventListener('pointercancel', function (e) { self.onUp(e); });
  };

  Map.prototype.pointerCount = function () {
    var n = 0;
    for (var k in this.pointers) if (this.pointers.hasOwnProperty(k)) n++;
    return n;
  };

  Map.prototype.grabFrom = function (clientX, clientY) {
    this.downAt = { x: clientX, y: clientY };
    this.drag = { view: this.view, upp: this.unitsPerPx() };
  };

  // Capture is deliberately NOT taken on pointerdown: capturing retargets the
  // following pointerup to the <svg>, which makes the browser report the click
  // on the root instead of the marker and silently kills event selection.
  // It is taken only once a gesture is definitely not a click.
  Map.prototype.capture = function (id) {
    try { this.svg.setPointerCapture(Number(id)); } catch (err) { /* not fatal */ }
  };

  Map.prototype.onDown = function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.stopAnim();
    this.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

    var n = this.pointerCount();
    if (n === 1) {
      this.moved = false;
      this.pinch = null;
      this.grabFrom(e.clientX, e.clientY);
      this.svg.style.cursor = 'grabbing';
    } else if (n === 2) {
      this.drag = null;
      this.pinch = null;   // seeded on the first move of the pair
      this.moved = true;   // a two-finger gesture is never a pick
      for (var k in this.pointers) {
        if (this.pointers.hasOwnProperty(k)) this.capture(k);
      }
    }
  };

  Map.prototype.onMove = function (e) {
    if (!this.pointers[e.pointerId]) return;
    this.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

    if (this.pointerCount() >= 2) { this.onPinch(); return; }
    if (!this.drag) return;

    var dx = e.clientX - this.downAt.x;
    var dy = e.clientY - this.downAt.y;
    if (!this.moved && Math.abs(dx) + Math.abs(dy) > DRAG_SLOP) {
      this.moved = true;
      this.capture(e.pointerId);  // a drag now; keep events if the pointer leaves
    }
    if (!this.moved) return;

    var d = this.drag;
    this.setView({ x: d.view.x - dx * d.upp, y: d.view.y - dy * d.upp, w: d.view.w, h: d.view.h });
  };

  // Pinch is handled frame to frame rather than against the gesture start,
  // so clamping at the limits cannot accumulate drift.
  Map.prototype.onPinch = function () {
    var ids = [];
    for (var k in this.pointers) if (this.pointers.hasOwnProperty(k)) ids.push(k);
    var a = this.pointers[ids[0]], b = this.pointers[ids[1]];
    var dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var prev = this.pinch;

    if (prev) {
      var was = this.toView(prev.mx, prev.my);
      var is = this.toView(mx, my);
      if (was && is) {
        var v = this.view;
        this.setView({ x: v.x + (was.x - is.x), y: v.y + (was.y - is.y), w: v.w, h: v.h });
      }
      if (Math.abs(dist - prev.dist) > 0.5) this.zoomAt(mx, my, dist / prev.dist, false);
    }
    this.pinch = { dist: dist, mx: mx, my: my };
    this.moved = true;
  };

  Map.prototype.onUp = function (e) {
    delete this.pointers[e.pointerId];
    if (this.svg.hasPointerCapture && this.svg.hasPointerCapture(e.pointerId)) {
      try { this.svg.releasePointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
    }

    var n = this.pointerCount();
    if (n < 2) this.pinch = null;
    if (n === 0) {
      this.drag = null;
      this.svg.style.cursor = 'grab';
    } else if (n === 1) {
      // one finger lifted out of a pinch: carry on panning with the other
      for (var k in this.pointers) {
        if (this.pointers.hasOwnProperty(k)) { this.grabFrom(this.pointers[k].x, this.pointers[k].y); break; }
      }
    }
  };

  // ---------- grid ----------

  function stepsFor(w) {
    for (var i = 0; i < STEPS.length; i++) {
      if (w / STEPS[i] >= MIN_LINES) return { major: STEPS[i], minor: STEPS[i + 1] || STEPS[i] / 2 };
    }
    var last = STEPS[STEPS.length - 1];
    return { major: last, minor: last / 2 };
  }

  function isMultiple(v, step) {
    var k = v / step;
    return Math.abs(k - Math.round(k)) < 1e-6;
  }

  // Rebuild the graticule for the current camera. Only the visible band plus a
  // margin is drawn, so a fine step never puts thousands of lines in the DOM.
  Map.prototype.renderGrid = function () {
    var v = this.view;
    var st = stepsFor(v.w);
    var d = this._grid;
    if (d && d.major === st.major &&
        v.x >= d.x0 && v.x + v.w <= d.x1 && v.y >= d.y0 && v.y + v.h <= d.y1) return;

    var padX = v.w * 0.6, padY = v.h * 0.6;
    var x0 = Math.max(0, v.x - padX), x1 = Math.min(WORLD_W, v.x + v.w + padX);
    var y0 = Math.max(0, v.y - padY), y1 = Math.min(WORLD_H, v.y + v.h + padY);
    this._grid = { major: st.major, x0: x0, x1: x1, y0: y0, y1: y1 };

    var g = this.gGrat, L = this.gLabels, i;
    g.textContent = '';
    L.textContent = '';
    this.lonLabels = [];
    this.latLabels = [];

    for (i = Math.ceil(x0 / st.minor) * st.minor; i <= x1 + 1e-9; i += st.minor) {
      var majX = isMultiple(i, st.major);
      el('line', {
        class: 'grat' + (majX ? (i === 180 ? ' major zero' : ' major') : ''),
        x1: i, y1: y0, x2: i, y2: y1
      }, g);
      if (majX) {
        var t = el('text', { class: 'map-label', 'data-at': i }, L);
        t.textContent = lonLabel(i - 180);
        this.lonLabels.push(t);
      }
    }
    for (i = Math.ceil(y0 / st.minor) * st.minor; i <= y1 + 1e-9; i += st.minor) {
      var majY = isMultiple(i, st.major);
      el('line', {
        class: 'grat' + (majY ? (i === 90 ? ' major zero' : ' major') : ''),
        x1: x0, y1: i, x2: x1, y2: i
      }, g);
      if (majY) {
        var t2 = el('text', { class: 'map-label', 'data-at': i }, L);
        t2.textContent = latLabel(90 - i);
        this.latLabels.push(t2);
      }
    }

    // tropics and polar circles, dashed, only while they read as distinct
    if (st.major >= 5) {
      [23.44, -23.44, 66.56, -66.56].forEach(function (lat) {
        var y = py(lat);
        if (y >= y0 && y <= y1) el('line', { class: 'grat dashed', x1: x0, y1: y, x2: x1, y2: y }, g);
      });
    }

    // edge ticks along the world boundary, like a scale bar
    for (i = Math.ceil(x0 / st.minor) * st.minor; i <= x1 + 1e-9; i += st.minor) {
      var lx = (isMultiple(i, st.major) ? 2 : 1) * this._zs;
      if (y1 >= WORLD_H) el('line', { class: 'tick', x1: i, y1: WORLD_H, x2: i, y2: WORLD_H - lx }, g);
      if (y0 <= 0) el('line', { class: 'tick', x1: i, y1: 0, x2: i, y2: lx }, g);
    }
    for (i = Math.ceil(y0 / st.minor) * st.minor; i <= y1 + 1e-9; i += st.minor) {
      var ly = (isMultiple(i, st.major) ? 2 : 1) * this._zs;
      if (x0 <= 0) el('line', { class: 'tick', x1: 0, y1: i, x2: ly, y2: i }, g);
      if (x1 >= WORLD_W) el('line', { class: 'tick', x1: WORLD_W, y1: i, x2: WORLD_W - ly, y2: i }, g);
    }
  };

  // Labels ride the edge of the camera, not the edge of the world, so the
  // coordinate readout survives a zoom.
  Map.prototype.placeLabels = function () {
    var v = this.view, zs = this._zs, i, n;
    var baseY = v.y + v.h - 2.6 * zs;
    var baseX = v.x + 2.6 * zs;
    for (i = 0; i < this.lonLabels.length; i++) {
      n = this.lonLabels[i];
      n.setAttribute('x', parseFloat(n.getAttribute('data-at')) + 0.8 * zs);
      n.setAttribute('y', baseY);
    }
    for (i = 0; i < this.latLabels.length; i++) {
      n = this.latLabels[i];
      n.setAttribute('x', baseX);
      n.setAttribute('y', parseFloat(n.getAttribute('data-at')) - 0.8 * zs);
    }
  };

  function deg(v) {
    return (Math.round(Math.abs(v) * 1000) / 1000) + '°';
  }
  function lonLabel(lon) {
    if (Math.abs(lon) < 1e-9) return '0°';
    return deg(lon) + (lon < 0 ? 'W' : 'E');
  }
  function latLabel(lat) {
    if (Math.abs(lat) < 1e-9) return 'EQ';
    return deg(lat) + (lat < 0 ? 'S' : 'N');
  }

  function radiusFor(ev) {
    if (ev.kind === 'earthquake') {
      var m = ev.mag === null ? 2.5 : ev.mag;
      return Math.max(0.7, Math.min(3.0, 0.7 + (m - 2.5) * 0.45));
    }
    return 1.2;
  }

  // Hit targets stay about HIT_PX wide on screen whatever the zoom.
  Map.prototype.hitRadius = function (base) {
    var zs = this._zs;
    return Math.min(4 * zs, Math.max((base + 0.5) * zs, HIT_PX * this.unitsPerPx()));
  };

  // Re-apply screen-constant sizes after a zoom or a viewport change.
  Map.prototype.rescale = function () {
    var zs = this._zs;
    var circles = this.gMarkers.querySelectorAll('circle[data-r]');
    for (var i = 0; i < circles.length; i++) {
      var c = circles[i];
      var base = parseFloat(c.getAttribute('data-r'));
      c.setAttribute('r', c.getAttribute('class') === 'hit' ? this.hitRadius(base) : base * zs);
    }
    this.drawSelection();
  };

  // ---------- events ----------

  Map.prototype.setEvents = function (events, stamp) {
    var self = this;
    stamp = stamp || Date.now();
    this.gMarkers.textContent = '';
    this.gTracks.textContent = '';
    this.nodes = {};
    this.trackNodes = {};
    var zs = this._zs;

    // bigger / older underneath, small and fresh on top
    var sorted = events.slice().sort(function (a, b) { return radiusFor(b) - radiusFor(a); });

    sorted.forEach(function (ev) {
      if (ev.track) self.drawTrack(ev);
      var r = radiusFor(ev);
      var g = el('g', { class: 'mk k-' + ev.kind + (stamp - ev.time < FRESH_MS ? ' fresh' : ''), 'data-id': ev.id }, self.gMarkers);
      var x = px(ev.lon), y = py(ev.lat);
      el('circle', { class: 'hit', cx: x, cy: y, r: self.hitRadius(r), 'data-r': r }, g);
      if (r >= 1.6 || stamp - ev.time < FRESH_MS) {
        el('circle', { class: 'halo', cx: x, cy: y, r: (r + 0.6) * zs, 'data-r': r + 0.6 }, g);
      }
      el('circle', { class: 'core', cx: x, cy: y, r: r * zs, 'data-r': r }, g);
      var title = el('title', null, g);
      title.textContent = ev.title;
      self.nodes[ev.id] = g;
    });
  };

  Map.prototype.drawTrack = function (ev) {
    var pts = ev.track;
    var d = '';
    for (var i = 0; i < pts.length; i++) {
      var cmd = 'L';
      if (i === 0 || Math.abs(pts[i][0] - pts[i - 1][0]) > 180) cmd = 'M'; // antimeridian jump
      d += cmd + px(pts[i][0]).toFixed(2) + ' ' + py(pts[i][1]).toFixed(2) + ' ';
    }
    var p = el('path', { class: 'track k-' + ev.kind, d: d.trim(), 'data-id': ev.id }, this.gTracks);
    this.trackNodes[ev.id] = p;
    return p;
  };

  // Highlight a selection and its neighbourhood; null clears.
  Map.prototype.focus = function (ev, near) {
    near = near || [];
    this.gLinks.textContent = '';
    var all = this.gMarkers.querySelectorAll('.mk.selected, .mk.near');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('selected', 'near');
    var tr = this.gTracks.querySelectorAll('.track.selected, .track.near');
    for (var j = 0; j < tr.length; j++) tr[j].classList.remove('selected', 'near');

    if (!ev) {
      this._selEv = null;
      this._focusId = null;
      this.drawSelection();
      this.gMarkers.classList.remove('focused');
      this.gTracks.classList.remove('focused');
      return;   // the camera stays where the reader put it
    }
    this.gMarkers.classList.add('focused');
    this.gTracks.classList.add('focused');

    var x = px(ev.lon), y = py(ev.lat);
    var node = this.nodes[ev.id];
    if (node) { node.classList.add('selected'); this.gMarkers.appendChild(node); }
    if (this.trackNodes[ev.id]) this.trackNodes[ev.id].classList.add('selected');

    for (var k = 0; k < near.length; k++) {
      var o = near[k].event;
      var n = this.nodes[o.id];
      if (n) n.classList.add('near');
      if (this.trackNodes[o.id]) this.trackNodes[o.id].classList.add('near');
      if (Math.abs(o.lon - ev.lon) <= 180) {
        el('line', { class: 'link', x1: x, y1: y, x2: px(o.lon), y2: py(o.lat) }, this.gLinks);
      }
    }

    this._selEv = ev;
    this.drawSelection();

    // Only a genuinely new pick moves the camera. A five-minute feed
    // refresh re-selects the same event and must not yank the view.
    if (ev.id !== this._focusId) {
      this._focusId = ev.id;
      this.frame(ev, near);
    }
  };

  // Crosshair and ring on the selected event, sized for the current zoom.
  Map.prototype.drawSelection = function () {
    this.gSel.textContent = '';
    var ev = this._selEv;
    if (!ev) return;
    var zs = this._zs;
    var x = px(ev.lon), y = py(ev.lat);
    var r = (radiusFor(ev) + 1.2) * zs;
    var near = 0.6 * zs, far = 2.5 * zs;
    el('circle', { class: 'sel-ring', cx: x, cy: y, r: r }, this.gSel);
    el('line', { class: 'sel-cross', x1: x - r - far, y1: y, x2: x - r - near, y2: y }, this.gSel);
    el('line', { class: 'sel-cross', x1: x + r + near, y1: y, x2: x + r + far, y2: y }, this.gSel);
    el('line', { class: 'sel-cross', x1: x, y1: y - r - far, x2: x, y2: y - r - near }, this.gSel);
    el('line', { class: 'sel-cross', x1: x, y1: y + r + near, x2: x, y2: y + r + far }, this.gSel);
  };

  // Ease the camera onto the selected event and the neighbours worth seeing.
  Map.prototype.frame = function (ev, near) {
    var minLon = ev.lon, maxLon = ev.lon, minLat = ev.lat, maxLat = ev.lat;
    for (var i = 0; i < near.length; i++) {
      var o = near[i].event;
      if (near[i].dKm > FRAME_MAX_KM) continue;        // too far to frame with
      if (Math.abs(o.lon - ev.lon) > 90) continue;     // wraps the antimeridian
      if (o.lon < minLon) minLon = o.lon;
      if (o.lon > maxLon) maxLon = o.lon;
      if (o.lat < minLat) minLat = o.lat;
      if (o.lat > maxLat) maxLat = o.lat;
    }
    // The camera is 2:1, so a latitude span needs twice its width.
    var span = Math.max((maxLon - minLon) * FRAME_PAD, (maxLat - minLat) * FRAME_PAD * 2);
    // A lone event gets a wide frame for context. A tight cluster gets pulled
    // right in — separating events that sit on the same pixel is the reason
    // zoom exists here at all.
    var w = span > 0 ? Math.max(span, MIN_W) : FRAME_MIN_W;
    w = Math.max(MIN_W, Math.min(FRAME_MAX_W, w));
    var cx = px((minLon + maxLon) / 2);
    var cy = py((minLat + maxLat) / 2);
    this.animateTo({ x: cx - w / 2, y: cy - w / 4, w: w, h: w / 2 });
  };

  // Back to the whole world.
  Map.prototype.reset = function () {
    this.animateTo({ x: 0, y: 0, w: WORLD_W, h: WORLD_H });
  };

  ERN.Map = Map;
})(window.ERN = window.ERN || {});

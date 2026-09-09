/* Earth right now — the map
   Equirectangular grid in a 360x180 SVG viewBox: x = lon + 180, y = 90 - lat.
   No coastlines. Events draw the continents on their own. */
(function (ERN) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var FRESH_MS = 3 * 3600000; // events younger than this get a ping

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function px(lon) { return lon + 180; }
  function py(lat) { return 90 - lat; }

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
    this.drawGrid();

    var self = this;
    svg.addEventListener('click', function (ev) {
      var mk = ev.target.closest ? ev.target.closest('.mk') : null;
      if (mk) { self.onSelect(mk.getAttribute('data-id')); return; }
      // click on empty grid clears selection
      self.onSelect(null);
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { self.rehit(); }, 150);
    });
  }

  // Re-size hit circles after a viewport change so touch targets stay usable.
  Map.prototype.rehit = function () {
    var hits = this.gMarkers.querySelectorAll('circle.hit');
    for (var i = 0; i < hits.length; i++) {
      hits[i].setAttribute('r', this.hitRadius(parseFloat(hits[i].getAttribute('data-r'))));
    }
  };

  Map.prototype.drawGrid = function () {
    var g = this.gGrat, i;
    // 10° minor lines
    for (i = -180; i <= 180; i += 10) {
      if (i % 30 === 0) continue;
      el('line', { class: 'grat', x1: px(i), y1: 0, x2: px(i), y2: 180 }, g);
    }
    for (i = -80; i <= 80; i += 10) {
      if (i % 30 === 0) continue;
      el('line', { class: 'grat', x1: 0, y1: py(i), x2: 360, y2: py(i) }, g);
    }
    // 30° major lines
    for (i = -150; i <= 150; i += 30) {
      el('line', { class: 'grat major' + (i === 0 ? ' zero' : ''), x1: px(i), y1: 0, x2: px(i), y2: 180 }, g);
    }
    for (i = -60; i <= 60; i += 30) {
      el('line', { class: 'grat major' + (i === 0 ? ' zero' : ''), x1: 0, y1: py(i), x2: 360, y2: py(i) }, g);
    }
    // tropics and polar circles, dashed
    [23.44, -23.44, 66.56, -66.56].forEach(function (lat) {
      el('line', { class: 'grat dashed', x1: 0, y1: py(lat), x2: 360, y2: py(lat) }, g);
    });
    // edge ticks every 10°, like a scale bar
    for (i = -180; i <= 180; i += 10) {
      var len = i % 30 === 0 ? 2 : 1;
      el('line', { class: 'tick', x1: px(i), y1: 180, x2: px(i), y2: 180 - len }, g);
      el('line', { class: 'tick', x1: px(i), y1: 0, x2: px(i), y2: len }, g);
    }
    for (i = -90; i <= 90; i += 10) {
      var l2 = i % 30 === 0 ? 2 : 1;
      el('line', { class: 'tick', x1: 0, y1: py(i), x2: l2, y2: py(i) }, g);
      el('line', { class: 'tick', x1: 360, y1: py(i), x2: 360 - l2, y2: py(i) }, g);
    }

    // labels
    var L = this.gLabels;
    for (i = -150; i <= 150; i += 30) {
      var t = el('text', { class: 'map-label', x: px(i) + 0.8, y: 177.4 }, L);
      t.textContent = lonLabel(i);
    }
    for (i = -60; i <= 60; i += 30) {
      var t2 = el('text', { class: 'map-label', x: 2.6, y: py(i) - 0.8 }, L);
      t2.textContent = latLabel(i);
    }
  };

  function lonLabel(lon) {
    if (lon === 0) return '0°';
    return Math.abs(lon) + '°' + (lon < 0 ? 'W' : 'E');
  }
  function latLabel(lat) {
    if (lat === 0) return 'EQ';
    return Math.abs(lat) + '°' + (lat < 0 ? 'S' : 'N');
  }

  function radiusFor(ev) {
    if (ev.kind === 'earthquake') {
      var m = ev.mag === null ? 2.5 : ev.mag;
      return Math.max(0.7, Math.min(3.0, 0.7 + (m - 2.5) * 0.45));
    }
    return 1.2;
  }

  // viewBox units per CSS pixel changes with the viewport; hit areas want ~10px.
  Map.prototype.unitsPerPx = function () {
    var w = this.svg.clientWidth || 1, h = this.svg.clientHeight || 1;
    var scale = Math.min(w / 360, h / 180); // px per unit under xMidYMid meet
    return scale > 0 ? 1 / scale : 1;
  };

  Map.prototype.hitRadius = function (r) {
    var want = 10 * this.unitsPerPx();
    return Math.min(4, Math.max(r + 0.5, want));
  };

  Map.prototype.setEvents = function (events, now) {
    var self = this;
    now = now || Date.now();
    this.gMarkers.textContent = '';
    this.gTracks.textContent = '';
    this.nodes = {};
    this.trackNodes = {};

    // bigger / older underneath, small and fresh on top
    var sorted = events.slice().sort(function (a, b) { return radiusFor(b) - radiusFor(a); });

    sorted.forEach(function (ev) {
      if (ev.track) self.drawTrack(ev);
      var r = radiusFor(ev);
      var g = el('g', { class: 'mk k-' + ev.kind + (now - ev.time < FRESH_MS ? ' fresh' : ''), 'data-id': ev.id }, self.gMarkers);
      var x = px(ev.lon), y = py(ev.lat);
      el('circle', { class: 'hit', cx: x, cy: y, r: self.hitRadius(r), 'data-r': r }, g);
      if (r >= 1.6 || now - ev.time < FRESH_MS) {
        el('circle', { class: 'halo', cx: x, cy: y, r: r + 0.6 }, g);
      }
      el('circle', { class: 'core', cx: x, cy: y, r: r }, g);
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
    this.gLinks.textContent = '';
    this.gSel.textContent = '';
    var all = this.gMarkers.querySelectorAll('.mk.selected, .mk.near');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('selected', 'near');
    var tr = this.gTracks.querySelectorAll('.track.selected, .track.near');
    for (var j = 0; j < tr.length; j++) tr[j].classList.remove('selected', 'near');

    if (!ev) {
      this.gMarkers.classList.remove('focused');
      this.gTracks.classList.remove('focused');
      return;
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

    // crosshair + ring on the selected event
    var r = radiusFor(ev) + 1.2;
    el('circle', { class: 'sel-ring', cx: x, cy: y, r: r }, this.gSel);
    el('line', { class: 'sel-cross', x1: x - r - 2.5, y1: y, x2: x - r - 0.6, y2: y }, this.gSel);
    el('line', { class: 'sel-cross', x1: x + r + 0.6, y1: y, x2: x + r + 2.5, y2: y }, this.gSel);
    el('line', { class: 'sel-cross', x1: x, y1: y - r - 2.5, x2: x, y2: y - r - 0.6 }, this.gSel);
    el('line', { class: 'sel-cross', x1: x, y1: y + r + 0.6, x2: x, y2: y + r + 2.5 }, this.gSel);
  };

  ERN.Map = Map;
})(window.ERN = window.ERN || {});

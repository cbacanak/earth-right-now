/* Earth right now — the rabbit-hole engine
   One question: given an event, what else is near it in space and time?
   "Show me something" is the same engine with a random seed. */
(function (ERN) {
  'use strict';

  var R_EARTH = 6371; // km
  var D2R = Math.PI / 180;

  // Tunables. Distance decays over ~600 km, time over ~3 days.
  // Distance gates, time modulates: something far away is never "near",
  // however recent it is. With these numbers the cutoff lands around 1,500 km.
  var DIST_SCALE_KM = 600;
  var TIME_SCALE_H = 72;
  var TIME_FLOOR = 0.5;         // an old neighbour still counts, at half weight
  var CROSS_KIND_BONUS = 1.15;  // a fire next to a quake is a better story than another quake
  var MIN_SCORE = 0.08;         // below this, "near" would be a lie
  var MAX_NEAR = 8;

  function haversineKm(a, b) {
    var dLat = (b.lat - a.lat) * D2R;
    var dLon = (b.lon - a.lon) * D2R;
    var la1 = a.lat * D2R, la2 = b.lat * D2R;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Initial bearing from a to b, degrees clockwise from north.
  function bearingDeg(a, b) {
    var la1 = a.lat * D2R, la2 = b.lat * D2R;
    var dLon = (b.lon - a.lon) * D2R;
    var y = Math.sin(dLon) * Math.cos(la2);
    var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
    return ((Math.atan2(y, x) / D2R) + 360) % 360;
  }

  var COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function compass(deg) {
    return COMPASS[Math.round(deg / 45) % 8];
  }

  function score(a, b) {
    var dKm = haversineKm(a, b);
    var dtH = Math.abs(a.time - b.time) / 3600000;
    var s = Math.exp(-dKm / DIST_SCALE_KM) * (TIME_FLOOR + (1 - TIME_FLOOR) * Math.exp(-dtH / TIME_SCALE_H));
    if (a.kind !== b.kind) s *= CROSS_KIND_BONUS;
    return { score: s, dKm: dKm, dtMs: b.time - a.time, bearing: bearingDeg(a, b) };
  }

  // Related events for `ev` among `all`, best first.
  // Returns { items: [{event, score, dKm, dtMs, bearing}], fallback: bool }
  function nearby(ev, all, limit) {
    limit = limit || MAX_NEAR;
    var scored = [];
    for (var i = 0; i < all.length; i++) {
      var o = all[i];
      if (o.id === ev.id) continue;
      var r = score(ev, o);
      r.event = o;
      scored.push(r);
    }
    scored.sort(function (x, y) { return y.score - x.score; });

    var good = [];
    for (var j = 0; j < scored.length && good.length < limit; j++) {
      if (scored[j].score >= MIN_SCORE) good.push(scored[j]);
    }
    if (good.length) return { items: good, fallback: false };

    // Nothing genuinely near. Show the nearest few by distance, honestly labelled.
    scored.sort(function (x, y) { return x.dKm - y.dKm; });
    return { items: scored.slice(0, 3), fallback: true };
  }

  // mulberry32 — tiny seeded PRNG so "show me something" is reproducible per seed.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Random event, preferring ones that actually lead somewhere (>= 2 real neighbours).
  // `exclude` keeps it from handing you the event you're already looking at.
  function randomPick(all, seed, exclude) {
    if (!all.length) return null;
    var rand = rng(seed === undefined ? Date.now() : seed);
    var pool = all.filter(function (e) { return e.id !== exclude; });
    if (!pool.length) pool = all;

    // Sample a handful of candidates and keep the ones with a real neighbourhood.
    // Cheaper than scoring the whole set and random enough for a toy.
    var tries = Math.min(pool.length, 24);
    var candidates = [];
    var seen = {};
    while (candidates.length < tries) {
      var idx = Math.floor(rand() * pool.length);
      if (seen[idx]) { if (Object.keys(seen).length >= pool.length) break; continue; }
      seen[idx] = true;
      candidates.push(pool[idx]);
    }
    var lively = candidates.filter(function (e) {
      var n = nearby(e, all, 3);
      return !n.fallback && n.items.length >= 2;
    });
    var from = lively.length ? lively : candidates;
    return from[Math.floor(rand() * from.length)] || null;
  }

  ERN.engine = {
    haversineKm: haversineKm,
    bearingDeg: bearingDeg,
    compass: compass,
    score: score,
    nearby: nearby,
    randomPick: randomPick,
    rng: rng,
    MIN_SCORE: MIN_SCORE
  };
})(typeof window !== 'undefined' ? (window.ERN = window.ERN || {}) : (module.exports = {}));

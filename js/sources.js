/* Earth right now — data sources (Stage 1: USGS + NASA EONET, keyless, browser-direct)
   Every source returns a list of normalised events:
   {
     id        'usgs:ci40123' | 'eonet:EONET_1234'
     source    'usgs' | 'eonet'
     kind      'earthquake' | 'wildfires' | 'volcanoes' | 'severeStorms' | 'seaLakeIce' | 'floods' | 'other'
     kindLabel human label
     title     string
     lat, lon  degrees
     time      ms since epoch (latest observation)
     mag       number | null
     magUnit   string | null
     url       link to the source page
     track     [[lon, lat], ...] | null   (EONET storm tracks)
   }
*/
(function (ERN) {
  'use strict';

  // M2.5+ over the last 7 days: global coverage, still recent. all_day is
  // mostly Californian micro-quakes and leaves the rest of the grid empty.
  var USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
  var EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=60';

  var KIND_LABELS = {
    earthquake: 'earthquake',
    wildfires: 'wildfire',
    volcanoes: 'volcano',
    severeStorms: 'storm',
    seaLakeIce: 'sea / lake ice',
    floods: 'flood',
    other: 'event'
  };

  var KNOWN_KINDS = ['earthquake', 'wildfires', 'volcanoes', 'severeStorms', 'seaLakeIce', 'floods'];

  function kindOf(categoryId) {
    if (categoryId === 'earthquakes') return 'earthquake';
    return KNOWN_KINDS.indexOf(categoryId) >= 0 ? categoryId : 'other';
  }

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function validLatLon(lat, lon) {
    return lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  // ---- USGS ----
  function parseUSGS(geojson) {
    var out = [];
    var feats = (geojson && geojson.features) || [];
    for (var i = 0; i < feats.length; i++) {
      var f = feats[i];
      var p = f.properties || {};
      var c = (f.geometry && f.geometry.coordinates) || [];
      var lon = num(c[0]), lat = num(c[1]);
      if (!validLatLon(lat, lon)) continue;
      var time = num(p.time);
      if (time === null) continue;
      out.push({
        id: 'usgs:' + f.id,
        source: 'usgs',
        kind: 'earthquake',
        kindLabel: KIND_LABELS.earthquake,
        title: p.place ? 'M ' + fmtMag(p.mag) + ' — ' + p.place : (p.title || 'Earthquake'),
        lat: lat,
        lon: lon,
        time: time,
        mag: num(p.mag),
        magUnit: 'M',
        depthKm: num(c[2]),
        url: p.url || null,
        track: null
      });
    }
    return out;
  }

  function fmtMag(m) {
    var n = num(m);
    return n === null ? '?' : n.toFixed(1);
  }

  // ---- EONET ----
  function parseEONET(json) {
    var out = [];
    var events = (json && json.events) || [];
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      var geoms = e.geometry || [];
      if (!geoms.length) continue;

      // Geometry entries are chronological observations. Latest = current position.
      var points = [];
      var latest = null;
      for (var g = 0; g < geoms.length; g++) {
        var pt = pointOf(geoms[g]);
        if (!pt) continue;
        var t = Date.parse(geoms[g].date);
        var rec = { lon: pt[0], lat: pt[1], time: isFinite(t) ? t : null, mag: num(geoms[g].magnitudeValue), magUnit: geoms[g].magnitudeUnit || null };
        points.push(rec);
        if (!latest || (rec.time !== null && (latest.time === null || rec.time >= latest.time))) latest = rec;
      }
      if (!latest || latest.time === null) continue;

      var cat = (e.categories && e.categories[0]) || {};
      var kind = kindOf(cat.id);
      var src = (e.sources && e.sources[0]) || {};

      out.push({
        id: 'eonet:' + e.id,
        source: 'eonet',
        kind: kind,
        kindLabel: kind === 'other' ? (cat.title || KIND_LABELS.other).toLowerCase() : KIND_LABELS[kind],
        title: e.title || cat.title || 'Event',
        lat: latest.lat,
        lon: latest.lon,
        time: latest.time,
        mag: latest.mag,
        magUnit: latest.magUnit,
        url: src.url || e.link || null,
        track: points.length > 1 ? points.map(function (p) { return [p.lon, p.lat]; }) : null,
        firstSeen: points.reduce(function (m, p) { return p.time !== null && (m === null || p.time < m) ? p.time : m; }, null)
      });
    }
    return out;
  }

  // Returns [lon, lat] for a Point, or a rough centroid for a Polygon.
  function pointOf(geom) {
    if (!geom || !geom.coordinates) return null;
    if (geom.type === 'Point') {
      var lon = num(geom.coordinates[0]), lat = num(geom.coordinates[1]);
      return validLatLon(lat, lon) ? [lon, lat] : null;
    }
    if (geom.type === 'Polygon') {
      var ring = geom.coordinates[0] || [];
      var sx = 0, sy = 0, n = 0;
      for (var i = 0; i < ring.length; i++) {
        var x = num(ring[i][0]), y = num(ring[i][1]);
        if (!validLatLon(y, x)) continue;
        sx += x; sy += y; n++;
      }
      return n ? [sx / n, sy / n] : null;
    }
    return null;
  }

  // ---- fetch with timeout ----
  function getJSON(url, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 20000) : null;
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  ERN.sources = {
    usgs: {
      id: 'usgs',
      label: 'USGS',
      url: USGS_URL,
      load: function () { return getJSON(USGS_URL).then(parseUSGS); }
    },
    eonet: {
      id: 'eonet',
      label: 'EONET',
      url: EONET_URL,
      load: function () { return getJSON(EONET_URL, 30000).then(parseEONET); }
    }
  };

  ERN.parse = { usgs: parseUSGS, eonet: parseEONET };
  ERN.KIND_LABELS = KIND_LABELS;
  ERN.KIND_ORDER = ['earthquake', 'wildfires', 'volcanoes', 'severeStorms', 'seaLakeIce', 'floods', 'other'];
})(window.ERN = window.ERN || {});

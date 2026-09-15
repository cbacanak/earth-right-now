/* Earth right now — mobile bottom sheet
   Below the breakpoint the detail panel stops being a column under the map
   and becomes a sheet over it, at one of three detents.

   Where the gesture boundary sits
   -------------------------------
   The map owns pan and zoom; the sheet owns open and close. They never argue,
   because the boundary is the sheet's own rectangle: the sheet sits above the
   map, so a touch that lands on it never reaches the SVG, and a touch anywhere
   else is map. When the sheet is closed that rectangle is a 46px strip along
   the bottom edge and everything above it is map.

   Inside the sheet there is a second boundary, between moving the sheet and
   scrolling its contents. It is resolved by detent rather than mid-gesture
   guesswork, which is what makes it reliable:

     closed / half -> the body cannot scroll (touch-action: none), so every
                      vertical drag moves the sheet. Half is a peek; there is
                      nothing to scroll to yet.
     full          -> the body scrolls natively (touch-action: pan-y) with real
                      momentum, and the handle is what closes the sheet.

   touch-action is only ever changed when a detent settles, never during a
   gesture, so the browser is never asked to change its mind halfway through. */
(function (ERN) {
  'use strict';

  var MQ = '(max-width: 860px)';
  var HANDLE_PX = 46;
  var ORDER = ['closed', 'half', 'full'];
  // Visible height of the sheet at each detent, as a fraction of the layout.
  var SHOW = { closed: 0, half: 0.46, full: 0.90 };
  var FLICK_V = 0.5;   // px per ms; above this the flick direction wins
  var DRAG_SLOP = 4;

  function Drawer() {
    this.panel = document.getElementById('panel');
    this.body = document.getElementById('panel-body');
    this.handle = document.getElementById('drawer-handle');
    this.layout = document.querySelector('.layout');
    if (!this.panel || !this.body || !this.handle || !this.layout) return;

    this.detent = 'half';   // mobile opens on the peek so the controls are found
    this.active = false;
    this.drag = null;

    var self = this;
    this.mq = window.matchMedia(MQ);
    var onChange = function () { self.sync(); };
    if (this.mq.addEventListener) this.mq.addEventListener('change', onChange);
    else if (this.mq.addListener) this.mq.addListener(onChange);

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { self.sync(); }, 150);
    });

    // Keyboard activation is handled on keydown so the button never has to
    // synthesise a click that the pointer path would have to disambiguate.
    this.handle.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      self.cycle();
    });
    // Assistive tech can still activate the button without any pointer events;
    // a click that closely follows a pointer gesture we already handled is the
    // browser echoing that gesture, not a fresh request.
    this.handle.addEventListener('click', function (e) {
      if (Date.now() - self.lastUp < 500) return;
      e.preventDefault();
      self.cycle();
    });
    this.lastUp = 0;

    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(function (t) {
      self.panel.addEventListener(t, function (e) { self['on' + t.slice(7)](e); });
    });

    this.sync();
  }

  // ---------- geometry ----------

  Drawer.prototype.layoutH = function () {
    return this.layout.getBoundingClientRect().height || 1;
  };

  Drawer.prototype.panelH = function () {
    return this.panel.getBoundingClientRect().height || 1;
  };

  // How far down the sheet is pushed for a given detent, in px.
  Drawer.prototype.offsetFor = function (name) {
    var ph = this.panelH();
    if (name === 'closed') return Math.max(0, ph - HANDLE_PX);
    return Math.max(0, ph - SHOW[name] * this.layoutH());
  };

  Drawer.prototype.maxOffset = function () { return this.offsetFor('closed'); };

  // ---------- state ----------

  Drawer.prototype.sync = function () {
    var on = this.mq.matches;
    if (on === this.active) { if (on) this.place(this.detent); return; }
    this.active = on;
    document.body.classList.toggle('has-drawer', on);
    if (on) {
      this.place(this.detent);
    } else {
      // Desktop is a plain column again: no transform, no inert, no handle.
      this.panel.style.transform = '';
      this.panel.classList.remove('dragging');
      this.setInert(false);
      this.body.style.touchAction = '';
      this.handle.setAttribute('aria-expanded', 'false');
    }
  };

  Drawer.prototype.setInert = function (on) {
    // Keeps a closed sheet out of the tab order without trapping focus, so the
    // keyboard pass that comes next has nothing to undo here.
    if ('inert' in HTMLElement.prototype) this.body.inert = on;
    if (on) this.body.setAttribute('aria-hidden', 'true');
    else this.body.removeAttribute('aria-hidden');
  };

  Drawer.prototype.place = function (name, animate) {
    if (!this.active) return;
    this.detent = name;
    this.panel.classList.toggle('animating', animate !== false);
    this.panel.style.transform = 'translateY(' + Math.round(this.offsetFor(name)) + 'px)';
    this.handle.setAttribute('aria-expanded', String(name !== 'closed'));
    this.setInert(name === 'closed');
    // Only the fully open sheet hands vertical scrolling back to the browser.
    this.body.style.touchAction = name === 'full' ? 'pan-y' : 'none';
    if (name !== 'full') this.body.scrollTop = 0;
  };

  Drawer.prototype.cycle = function () {
    if (!this.active) return;
    var i = ORDER.indexOf(this.detent);
    this.place(ORDER[(i + 1) % ORDER.length]);
  };

  // A pick should bring the sheet into view, but never pull it back down on
  // someone who has already opened it fully.
  Drawer.prototype.reveal = function () {
    if (!this.active) return;
    if (this.detent === 'closed') this.place('half');
  };

  Drawer.prototype.close = function () {
    if (this.active) this.place('closed');
  };

  // ---------- drag ----------

  Drawer.prototype.ondown = function (e) {
    if (!this.active) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // At full the body scrolls itself; only the handle still drags the sheet.
    var onHandle = !!(e.target.closest && e.target.closest('.drawer-handle'));
    if (this.detent === 'full' && !onHandle) return;

    this.drag = {
      id: e.pointerId,
      onHandle: onHandle,
      y0: e.clientY,
      from: this.offsetFor(this.detent),
      t: (window.performance && performance.now) ? performance.now() : Date.now(),
      lastY: e.clientY,
      v: 0,
      moved: false
    };
    // A gesture that starts on the handle is the sheet's, full stop, so the
    // pointer is captured at once: dragging the handle upward takes the finger
    // off a 46px strip within the first few pixels, and without capture the
    // sheet would stop following it. Elsewhere in the sheet capture waits for
    // the drag threshold, because taking it on pointerdown would retarget the
    // following pointerup and break clicks on the buttons and the near list.
    if (onHandle) this.capture(e.pointerId);
  };

  Drawer.prototype.capture = function (id) {
    try { this.panel.setPointerCapture(id); } catch (err) { /* not fatal */ }
  };

  Drawer.prototype.onmove = function (e) {
    var d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    var dy = e.clientY - d.y0;
    if (!d.moved) {
      if (Math.abs(dy) < DRAG_SLOP) return;
      d.moved = true;
      this.panel.classList.remove('animating');
      this.panel.classList.add('dragging');
      if (!d.onHandle) this.capture(d.id);
    }
    e.preventDefault();

    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var dt = now - d.t;
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt;
    d.t = now;
    d.lastY = e.clientY;

    var y = Math.max(0, Math.min(this.maxOffset(), d.from + dy));
    this.panel.style.transform = 'translateY(' + Math.round(y) + 'px)';
  };

  Drawer.prototype.onup = function (e) {
    var d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    if (this.panel.hasPointerCapture && this.panel.hasPointerCapture(d.id)) {
      try { this.panel.releasePointerCapture(d.id); } catch (err) { /* not fatal */ }
    }
    this.panel.classList.remove('dragging');
    this.lastUp = Date.now();

    if (!d.moved) {
      if (d.onHandle) this.cycle();   // a tap on the handle steps the detent
      return;
    }
    var y = Math.max(0, Math.min(this.maxOffset(), d.from + (e.clientY - d.y0)));
    this.place(this.settle(y, d.v));
  };
  Drawer.prototype.oncancel = Drawer.prototype.onup;

  // A flick wins over position; otherwise the nearest detent takes it.
  Drawer.prototype.settle = function (y, v) {
    var i = ORDER.indexOf(this.detent), self = this;
    if (Math.abs(v) > FLICK_V) {
      var step = v > 0 ? -1 : 1;   // dragging down (positive v) closes
      return ORDER[Math.max(0, Math.min(ORDER.length - 1, i + step))];
    }
    var best = ORDER[0], bestD = Infinity;
    ORDER.forEach(function (name) {
      var d = Math.abs(self.offsetFor(name) - y);
      if (d < bestD) { bestD = d; best = name; }
    });
    return best;
  };

  function boot() {
    var d = new Drawer();
    if (d.panel) ERN.drawer = d;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.ERN = window.ERN || {});

/* ==========================================================================
   WANDERWILD — interactions
   Vanilla JS only: IntersectionObserver, requestAnimationFrame, Web Animations.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const lerp = (a, b, t) => a + (b - a) * t;

  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = reduceMQ.matches;
  const onReduceChange = (e) => { reduce = e.matches; layoutGallery(); };
  reduceMQ.addEventListener ? reduceMQ.addEventListener('change', onReduceChange) : reduceMQ.addListener(onReduceChange);
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* scroll-lock with multiple owners (menu, search, lightbox, loader) */
  const locks = new Set();
  const lockScroll = (key, on) => {
    on ? locks.add(key) : locks.delete(key);
    document.body.classList.toggle('is-locked', locks.size > 0);
  };

  /* ---------- toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3400);
  };

  /* ---------- image fallback (never show a broken-image icon) ---------- */
  const markBroken = (img) => {
    const p = img.parentElement;
    if (!p || p.classList.contains('img-broken')) return;
    p.classList.add('img-broken');
    p.style.setProperty('--fb', img.dataset.fb || '#0E0E10');
    p.setAttribute('data-fb-label', img.alt || '');
  };
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.dataset.fb) markBroken(t);
  }, true);
  $$('img[data-fb]').forEach((img) => {
    if (img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src)) markBroken(img);
  });

  /* ---------- split-line headings ---------- */
  $$('.split-line').forEach((el) => { el.innerHTML = '<span class="si">' + el.innerHTML + '</span>'; });

  /* ---------- coordinates: scramble in + slow live drift ---------- */
  const coordEls = $$('[data-coords]');
  const coordState = coordEls.map((el) => {
    const m = el.dataset.coords.match(/([\d.]+)°\s*([NS]),\s*([\d.]+)°\s*([EW])/);
    return m ? { el, lat: parseFloat(m[1]), ns: m[2], lon: parseFloat(m[3]), ew: m[4] } : null;
  }).filter(Boolean);
  const fmtCoord = (s, dLat = 0, dLon = 0) =>
    `${(s.lat + dLat).toFixed(4)}° ${s.ns}, ${(s.lon + dLon).toFixed(4)}° ${s.ew}`;

  const scramble = (el, finalText, dur = 1000) => {
    if (reduce) { el.textContent = finalText; return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = clamp((now - t0) / dur, 0, 1);
      let out = '';
      for (let i = 0; i < finalText.length; i++) {
        const ch = finalText[i];
        out += /\d/.test(ch) && i / finalText.length > p ? String((Math.random() * 10) | 0) : ch;
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const startCoords = () => {
    coordState.forEach((s, i) => setTimeout(() => scramble(s.el, fmtCoord(s), 1100), 300 + i * 260));
    if (reduce) return;
    setInterval(() => {
      if (document.hidden || reduce) return;
      coordState.forEach((s) => {
        s.el.textContent = fmtCoord(s, (Math.random() - .5) * .0012, (Math.random() - .5) * .0012);
      });
    }, 2400);
    coordState.forEach((s) => {
      s.el.closest('.hero__tag').addEventListener('pointerenter', () => scramble(s.el, fmtCoord(s), 700));
    });
  };

  /* ---------- reveal on scroll ---------- */
  const revealSel = ['.dest', '.story', '.map__stage', '.mood__row', '.pj__grid', '.ticket', '.newsletter__copy', '.feature__card', '.footer__col', '.gallery__head > *', '.map__lede', '.filters'];
  const initReveals = () => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        // drop stagger delay after the entrance so hover / filter transitions stay snappy
        setTimeout(() => { en.target.style.transitionDelay = ''; }, 1600);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    revealSel.forEach((sel) => {
      $$(sel).forEach((el, i) => {
        el.setAttribute('data-reveal', '');
        el.style.transitionDelay = ((i % 3) * 90) + 'ms';
        io.observe(el);
      });
    });

    const headIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); headIO.unobserve(en.target); } });
    }, { threshold: 0.35 });
    $$('.display-h, .feature__giant').forEach((h) => headIO.observe(h));
  };

  /* ---------- section theme → body background colour ---------- */
  const initThemes = () => {
    const secs = $$('[data-theme]').filter((el) => el !== document.body);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) document.body.dataset.theme = en.target.dataset.theme; });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    secs.forEach((s) => io.observe(s));
  };

  /* ---------- loader / intro ---------- */
  const loader = $('#loader');
  let introStarted = false;
  const introDone = () => {
    if (introStarted) return;
    introStarted = true;
    root.classList.add('is-loaded');
    startCoords();
  };

  const runLoader = () => {
    if (!loader || reduce) {
      loader && loader.classList.add('is-gone');
      introDone();
      return;
    }
    lockScroll('loader', true);
    const countEl = $('#loaderCount'), barEl = $('#loaderBar');
    const heroImgs = $$('.hero img');
    let imgsReady = heroImgs.every((i) => i.complete);
    heroImgs.forEach((i) => {
      if (i.complete) return;
      const done = () => { imgsReady = heroImgs.every((x) => x.complete); };
      i.addEventListener('load', done);
      i.addEventListener('error', done);
    });

    const t0 = performance.now(), DUR = 1900, MAX = 4200;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      countEl.textContent = '100';
      barEl.style.transform = 'scaleX(1)';
      loader.classList.add('is-done');
      setTimeout(introDone, 450);
      setTimeout(() => { loader.classList.add('is-gone'); lockScroll('loader', false); }, 1400);
    };
    const tick = (now) => {
      if (finished) return;
      const el = now - t0;
      const eased = 1 - Math.pow(1 - clamp(el / DUR, 0, 1), 3);
      const hold = !imgsReady && el < MAX;
      const shown = hold ? Math.min(eased * 100, 96) : eased * 100;
      countEl.textContent = String(Math.round(shown)).padStart(3, '0');
      barEl.style.transform = `scaleX(${shown / 100})`;
      if (!hold && el >= DUR) finish(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(finish, 7000); // safety net
  };

  /* ---------- header hide / show ---------- */
  const header = $('#siteHeader');
  let lastY = window.scrollY;
  const updateHeader = () => {
    const y = window.scrollY;
    if (document.body.classList.contains('menu-open')) { header.classList.remove('is-hidden'); lastY = y; return; }
    if (y > 240 && y > lastY + 6) header.classList.add('is-hidden');
    else if (y < lastY - 6 || y < 120) header.classList.remove('is-hidden');
    lastY = y;
  };

  /* ---------- fullscreen menu ---------- */
  const menu = $('#menu'), menuBtn = $('#menuToggle');
  const menuLabel = menuBtn ? $('.menu-btn__label', menuBtn) : null;
  const openMenu = () => {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    lockScroll('menu', true);
    if (menuLabel) menuLabel.textContent = 'Close';
    setTimeout(() => { const a = $('a', menu); a && a.focus({ preventScroll: true }); }, 450);
  };
  const closeMenu = (restore = false) => {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    lockScroll('menu', false);
    if (menuLabel) menuLabel.textContent = 'Menu';
    if (restore) menuBtn.focus();
  };
  menuBtn.addEventListener('click', () => (menu.classList.contains('is-open') ? closeMenu(true) : openMenu()));

  /* ---------- smooth anchors + demo links ---------- */
  const scrollToEl = (el) => el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"], [data-demo-link]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (a.hasAttribute('data-demo-link') || href === '#') {
      e.preventDefault();
      toast('Frontend demo — this story isn’t published yet.');
      return;
    }
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    // wait a tick so the scroll-lock from the menu is released before scrolling
    setTimeout(() => { scrollToEl(target); history.replaceState(null, '', href); }, menu.classList.contains('is-open') ? 0 : 0);
  });

  /* ---------- filters (dimming keeps the editorial composition intact) ---------- */
  const filterConfigs = {
    destinations: { item: '.dest', status: '#destStatus', noun: 'destinations' },
    stories: { item: '.story', status: '#storyStatus', noun: 'stories' }
  };
  $$('.filters').forEach((group) => {
    const cfg = filterConfigs[group.dataset.filterGroup];
    if (!cfg) return;
    const items = $$(cfg.item);
    const status = $(cfg.status);
    const apply = (f, label) => {
      let shown = 0;
      items.forEach((it) => {
        const cats = (it.dataset.cat || '').split(/\s+/);
        const match = f === 'all' || cats.includes(f);
        it.classList.toggle('is-out', !match);
        match ? it.removeAttribute('inert') : it.setAttribute('inert', '');
        if (match) shown++;
      });
      status.textContent = f === 'all'
        ? `Showing all ${items.length} ${cfg.noun}`
        : `Showing ${shown} of ${items.length} ${cfg.noun} — ${label}`;
    };
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      $$('.chip', group).forEach((c) => { c.classList.toggle('is-active', c === btn); c.setAttribute('aria-pressed', String(c === btn)); });
      apply(btn.dataset.filter, btn.textContent.trim());
    });
    group._reset = () => { const all = $('[data-filter="all"]', group); all && all.click(); };
  });

  /* ---------- search overlay ---------- */
  const searchEl = $('#search'), sInput = $('#searchInput'), sList = $('#searchResults'), sCount = $('#searchCount');
  let searchIndex = [], searchFocus = null;
  const buildIndex = () => {
    searchIndex = $$('[data-search]').map((el) => {
      const isDest = el.classList.contains('dest');
      const titleEl = $('.dest__name, .story__title', el);
      const title = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '';
      const meta = $$('.meta span', el).map((s) => s.textContent.trim()).join(' · ');
      const img = $('img', el);
      return {
        el, title, meta, type: isDest ? 'Destination' : 'Story',
        thumb: img ? (img.getAttribute('src') || '').replace(/w=\d+/, 'w=220').replace(/&h=\d+/, '') : '',
        hay: ((el.dataset.search || '') + ' ' + title + ' ' + meta).toLowerCase()
      };
    });
  };
  const renderSearch = (q) => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = searchIndex.filter((r) => terms.every((t) => r.hay.includes(t)));
    sList.textContent = '';
    if (!hits.length) {
      const li = document.createElement('li');
      li.className = 'search__empty';
      li.style.cssText = 'padding:1.4rem 0;border-top:1px solid rgba(255,244,225,.35);font-family:var(--f-serif);font-style:italic;font-size:1.3rem';
      li.textContent = 'Nothing out there yet — try “beach”, “mountain” or “food”.';
      sList.appendChild(li);
      sCount.textContent = 'No results';
      return;
    }
    hits.forEach((r) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      const img = document.createElement('img');
      img.src = r.thumb; img.alt = ''; img.loading = 'lazy'; img.width = 84; img.height = 62;
      const mid = document.createElement('div');
      const b = document.createElement('b'); b.textContent = r.title;
      const s = document.createElement('span'); s.textContent = r.meta;
      mid.append(b, s);
      const tag = document.createElement('span'); tag.textContent = r.type;
      a.append(img, mid, tag);
      a.addEventListener('click', (e) => {
        e.preventDefault();
        closeSearch(false);
        const group = r.el.closest('section').querySelector('.filters');
        if (r.el.classList.contains('is-out') && group && group._reset) group._reset();
        setTimeout(() => {
          r.el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
          if (!reduce && r.el.animate) {
            r.el.animate([
              { outline: '4px solid #FF5A4D', outlineOffset: '14px' },
              { outline: '4px solid rgba(255,90,77,0)', outlineOffset: '14px' }
            ], { duration: 1800, easing: 'ease-out', delay: 500 });
          }
        }, 60);
      });
      li.appendChild(a);
      sList.appendChild(li);
    });
    sCount.textContent = `${hits.length} result${hits.length === 1 ? '' : 's'}`;
  };
  const openSearch = () => {
    if (!searchEl.hidden) return;
    closeMenu();
    if (!searchIndex.length) buildIndex();
    searchFocus = document.activeElement;
    searchEl.hidden = false;
    lockScroll('search', true);
    sInput.value = '';
    renderSearch('');
    requestAnimationFrame(() => sInput.focus());
  };
  const closeSearch = (restore = true) => {
    if (searchEl.hidden) return;
    searchEl.hidden = true;
    lockScroll('search', false);
    if (restore && searchFocus && searchFocus.focus) searchFocus.focus();
  };
  $('#searchOpen').addEventListener('click', openSearch);
  $('#searchClose').addEventListener('click', () => closeSearch());
  sInput.addEventListener('input', () => renderSearch(sInput.value));

  /* ---------- lightbox ---------- */
  const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  const lbItems = $$('[data-lightbox]');
  let lbIndex = 0, lbFocus = null;
  const lbShow = (i) => {
    lbIndex = (i + lbItems.length) % lbItems.length;
    const btn = lbItems[lbIndex];
    const thumb = $('img', btn);
    lbImg.onerror = () => { lbImg.onerror = null; if (thumb) lbImg.src = thumb.currentSrc || thumb.src; };
    lbImg.src = btn.dataset.src;
    lbImg.alt = thumb ? thumb.alt : '';
    lbCap.textContent = btn.dataset.caption || '';
  };
  const openLb = (i) => {
    lbFocus = document.activeElement;
    lb.hidden = false;
    lockScroll('lightbox', true);
    lbShow(i);
    $('#lbClose').focus();
  };
  const closeLb = () => {
    if (lb.hidden) return;
    lb.hidden = true;
    lockScroll('lightbox', false);
    lbImg.removeAttribute('src');
    if (lbFocus && lbFocus.focus) lbFocus.focus({ preventScroll: true });
  };
  lbItems.forEach((btn, i) => btn.addEventListener('click', () => openLb(i)));
  $('#lbClose').addEventListener('click', closeLb);
  $('#lbPrev').addEventListener('click', () => lbShow(lbIndex - 1));
  $('#lbNext').addEventListener('click', () => lbShow(lbIndex + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });

  /* ---------- global keys + focus traps ---------- */
  const trap = (container, e) => {
    const f = $$('button, a[href], input, [tabindex]:not([tabindex="-1"])', container).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === 'Escape') {
      if (!lb.hidden) closeLb();
      else if (!searchEl.hidden) closeSearch();
      else closeMenu(true);
      return;
    }
    if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault(); openSearch(); return;
    }
    if (!lb.hidden) {
      if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
      else if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
      else if (e.key === 'Tab') trap(lb, e);
    } else if (!searchEl.hidden && e.key === 'Tab') trap(searchEl, e);
  });

  /* ---------- gallery: pinned horizontal scroll (desktop) / native swipe (touch) ---------- */
  const gallery = $('#lens'), gTrack = $('#galleryTrack'), gView = $('.gallery__viewport'),
    gPin = $('#galleryPin'), gProg = $('#galleryProgress'), gLabel = $('#galleryProgressLabel');
  const pinMQ = window.matchMedia('(min-width: 900px) and (min-height: 540px)');
  let pinned = false, maxX = 0;

  function layoutGallery() {
    if (!gallery) return;
    const should = pinMQ.matches && !reduce;
    if (should) {
      gallery.classList.add('is-pinned');
      pinned = true;
      gView.scrollLeft = 0;
      gTrack.style.transform = 'none';
      maxX = Math.max(0, gTrack.scrollWidth - window.innerWidth + 40);
      gallery.style.height = (gPin.offsetHeight + maxX) + 'px';
      gLabel.textContent = 'Scroll to drift';
    } else {
      gallery.classList.remove('is-pinned');
      pinned = false;
      gallery.style.height = '';
      gTrack.style.transform = '';
      gLabel.textContent = 'Swipe to drift';
    }
    updateGallery();
  }
  function updateGallery() {
    if (!gallery) return;
    if (pinned) {
      const p = maxX ? clamp(-gallery.getBoundingClientRect().top / maxX, 0, 1) : 0;
      gTrack.style.transform = `translate3d(${(-p * maxX).toFixed(1)}px,0,0)`;
      gProg.style.transform = `scaleX(${p.toFixed(4)})`;
    } else {
      const max = gView.scrollWidth - gView.clientWidth;
      gProg.style.transform = `scaleX(${max > 0 ? (gView.scrollLeft / max).toFixed(4) : 0})`;
    }
  }
  gView.addEventListener('scroll', updateGallery, { passive: true });
  // keyboard users tabbing through pinned shots: translate focus into page scroll
  gallery.addEventListener('focusin', (e) => {
    if (!pinned) return;
    const li = e.target.closest('.shot');
    if (!li) return;
    gPin.scrollLeft = 0; gView.scrollLeft = 0;
    const target = li.offsetLeft - (window.innerWidth / 2 - li.offsetWidth / 2);
    const p = maxX ? clamp(target / maxX, 0, 1) : 0;
    const top = gallery.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + p * maxX, behavior: 'auto' });
  });
  pinMQ.addEventListener ? pinMQ.addEventListener('change', layoutGallery) : pinMQ.addListener(layoutGallery);

  /* ---------- parallax (uses the independent `translate` property) ---------- */
  const parallax = $$('[data-parallax]').map((el) => ({ el, f: parseFloat(el.dataset.parallax) || 0, cur: 0, hero: !!el.closest('.hero') }));
  [['.dest--kyoto', .05], ['.dest--marrakech', -.05], ['.story--italy', -.06], ['.story--bali', .07], ['.pj__tile.t2', -.05], ['.pj__tile.t4', .06], ['.pj__tile.t7', -.07], ['.pj__tile.t8', .04]]
    .forEach(([sel, f]) => { const el = $(sel); if (el) parallax.push({ el, f, cur: 0, hero: false }); });

  const updateParallax = () => {
    if (reduce) return;
    const vh = window.innerHeight, narrow = window.innerWidth < 900;
    parallax.forEach((o) => {
      if (o.hero && narrow) { if (o.cur) { o.el.style.translate = ''; o.cur = 0; } return; }
      const r = o.el.getBoundingClientRect();
      if (r.bottom - o.cur < -300 || r.top - o.cur > vh + 300) return;
      const center = (r.top - o.cur) + r.height / 2 - vh / 2;
      o.cur = -center * o.f;
      o.el.style.translate = `0 ${o.cur.toFixed(1)}px`;
    });
  };

  /* ---------- footer flight path ---------- */
  const flightPath = $('#flightPath'), plane = $('#plane'), flightBox = $('.footer__flight'), footerEl = $('#footer');
  let flightLen = 0;
  const updatePlane = () => {
    if (!flightPath || !plane) return;
    if (!flightLen) flightLen = flightPath.getTotalLength();
    const docH = document.documentElement.scrollHeight;
    const footTop = footerEl.getBoundingClientRect().top + window.scrollY;
    const p = reduce ? 0.5 : clamp((window.scrollY + window.innerHeight - footTop) / Math.max(1, docH - footTop), 0, 1);
    const W = flightBox.clientWidth, H = flightBox.clientHeight;
    const a = flightPath.getPointAtLength(p * flightLen);
    const b = flightPath.getPointAtLength(Math.min(flightLen, p * flightLen + 3));
    const ang = Math.atan2((b.y - a.y) * H / 160, (b.x - a.x) * W / 1200) * 180 / Math.PI;
    plane.style.transform = `translate(${(a.x * W / 1200).toFixed(1)}px, ${(a.y * H / 160).toFixed(1)}px) rotate(${(ang + 41).toFixed(1)}deg)`;
  };
  $('#toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

  /* ---------- unified scroll loop ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateHeader(); updateParallax(); updateGallery(); updatePlane();
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (window.innerWidth > 1020) closeMenu();
      flightLen = 0; layoutGallery(); onScroll();
    }, 120);
  });
  window.addEventListener('load', () => { layoutGallery(); onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layoutGallery(); onScroll(); });

  /* ---------- dot-matrix world map ---------- */
  const POLYS = [
    [[-168,66],[-156,71],[-140,70],[-120,72],[-95,72],[-80,73],[-62,60],[-55,50],[-66,44],[-75,38],[-81,31],[-80,25],[-90,29],[-97,26],[-105,22],[-110,24],[-117,32],[-124,40],[-125,49],[-135,58],[-150,60],[-165,62]],
    [[-105,22],[-97,22],[-90,20],[-87,16],[-83,10],[-77,8],[-80,7],[-86,11],[-92,14],[-98,17]],
    [[-55,60],[-45,60],[-20,70],[-20,82],[-60,82],[-70,76]],
    [[-78,8],[-72,12],[-62,10],[-50,0],[-35,-6],[-40,-20],[-48,-27],[-58,-38],[-65,-42],[-68,-52],[-72,-54],[-74,-45],[-72,-30],[-70,-18],[-76,-14],[-81,-5],[-80,2]],
    [[-10,36],[-9,43],[-2,48],[-5,50],[3,52],[8,57],[10,60],[5,62],[15,70],[28,71],[40,67],[40,55],[30,46],[28,41],[22,37],[12,38],[8,44],[0,38]],
    [[-17,21],[-10,30],[-6,36],[10,37],[20,32],[32,31],[35,28],[43,12],[51,12],[40,-3],[40,-15],[35,-25],[27,-34],[18,-34],[12,-18],[9,-1],[8,4],[-8,4],[-17,14]],
    [[28,41],[40,42],[50,40],[55,37],[60,25],[57,24],[66,25],[73,20],[77,8],[80,15],[88,22],[92,21],[98,10],[100,2],[104,1],[109,12],[106,20],[122,30],[121,40],[128,40],[130,43],[141,52],[160,60],[180,66],[180,70],[140,73],[100,78],[70,73],[60,68],[40,67],[40,55],[30,46]],
    [[35,30],[48,30],[56,26],[59,22],[52,16],[44,12],[39,20]],
    [[130,31],[134,34],[140,35],[142,40],[141,45],[138,40],[132,35]],
    [[95,5],[105,-6],[103,-5],[98,2]],
    [[105,-6],[115,-8],[115,-9],[106,-7]],
    [[109,1],[117,7],[119,1],[116,-4],[110,-3]],
    [[114,-22],[122,-18],[130,-12],[137,-12],[142,-11],[146,-19],[153,-26],[150,-37],[141,-38],[131,-31],[115,-34]],
    [[172,-35],[178,-38],[175,-42],[167,-46],[170,-42]],
    [[-24,64],[-14,64],[-14,66],[-22,66.5]],
    [[-6,50],[2,51],[-1,56],[-5,58],[-6,55]],
    [[44,-25],[49,-15],[50,-13],[47,-25]]
  ];
  const inPoly = (x, y, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const dots = [];
  const buildMap = () => {
    const svg = $('#mapSvg'), ns = 'http://www.w3.org/2000/svg', frag = document.createDocumentFragment();
    for (let lat = 82; lat >= -56; lat -= 3) {
      for (let lon = -178; lon <= 178; lon += 3) {
        if (!POLYS.some((p) => inPoly(lon, lat, p))) continue;
        const x = (lon + 180) * 1000 / 360, y = (84 - lat) * 394 / 142;
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('r', '2.1');
        frag.appendChild(c);
        dots.push({ c, x, y });
      }
    }
    svg.appendChild(frag);
  };

  const places = {
    amalfi: { name: 'Amalfi Coast', country: 'Italy · Best in May & September', coords: '40.63° N · 14.60° E', desc: 'Take the 6 a.m. ferry from Amalfi to Positano and watch the cliffs turn from grey to gold.', img: 'photo-1498307833015-e7b400441eb8', fb: '#FF5A4D', alt: 'Sunlit cliffside village on the Amalfi Coast' },
    kyoto: { name: 'Kyoto', country: 'Japan · Best in November', coords: '35.01° N · 135.77° E', desc: 'Walk the Philosopher’s Path at 7 a.m. and the city is yours alone.', img: 'photo-1492571350019-22de08371fd3', fb: '#FFD23F', alt: 'Glowing lanterns along a Kyoto lane' },
    bali: { name: 'Bali', country: 'Indonesia · Best April to October', coords: '8.40° S · 115.20° E', desc: 'Skip the beach clubs: hire a scooter north and follow the sound of gamelan.', img: 'photo-1555400038-63f5ba517a47', fb: '#12A66A', alt: 'Green rice terraces and palms in Bali' },
    marrakech: { name: 'Marrakech', country: 'Morocco · Best in March', coords: '31.63° N · 8.00° W', desc: 'Climb to any rooftop at sunset and let the call to prayer do the navigating.', img: 'photo-1548018560-c7196548e84d', fb: '#FF8A1F', alt: 'Marrakech rooftops at dusk' },
    patagonia: { name: 'Patagonia', country: 'Argentina · Best November to March', coords: '49.33° S · 72.89° W', desc: 'The Laguna de los Tres hike starts in the dark and ends in a standing ovation.', img: 'photo-1478827536114-da961b7f86d2', fb: '#1F3BFF', alt: 'Granite peaks glowing at sunrise in Patagonia' },
    iceland: { name: 'Iceland', country: 'Iceland · Best September to March', coords: '64.96° N · 19.02° W', desc: 'Chase the aurora in winter, the midnight sun in June, and waterfalls year-round.', img: 'photo-1520769669658-f07657f5a307', fb: '#0E0E10', alt: 'A waterfall and green moss in Iceland' }
  };

  const initMap = () => {
    buildMap();
    const pins = $$('.pin');
    pins.forEach((p) => {
      const lat = parseFloat(p.dataset.lat), lon = parseFloat(p.dataset.lon);
      p.style.left = ((lon + 180) / 360 * 100).toFixed(2) + '%';
      p.style.top = ((84 - lat) / 142 * 100).toFixed(2) + '%';
    });
    const card = $('#postcard'), img = $('#pcImg');
    const fields = { name: $('#pcName'), country: $('#pcCountry'), coords: $('#pcCoords'), desc: $('#pcDesc') };
    let current = 'kyoto';

    const highlightDots = (pin) => {
      const px = ((parseFloat(pin.dataset.lon) + 180) * 1000) / 360, py = ((84 - parseFloat(pin.dataset.lat)) * 394) / 142;
      dots.forEach((d) => d.c.classList.toggle('is-near', Math.hypot(d.x - px, d.y - py) < 26));
    };
    const select = (key, animate = true) => {
      const data = places[key];
      if (!data) return;
      current = key;
      pins.forEach((p) => { const on = p.dataset.pin === key; p.classList.toggle('is-active', on); p.setAttribute('aria-pressed', String(on)); if (on) highlightDots(p); });
      const apply = () => {
        fields.name.textContent = data.name; fields.country.textContent = data.country;
        fields.coords.textContent = data.coords; fields.desc.textContent = data.desc;
        const photo = img.parentElement;
        photo.classList.remove('img-broken');
        img.dataset.fb = data.fb; img.alt = data.alt;
        img.src = `https://images.unsplash.com/${data.img}?auto=format&fit=crop&w=900&q=75`;
        card.classList.remove('is-swap');
      };
      if (animate && !reduce) { card.classList.add('is-swap'); setTimeout(apply, 330); } else apply();
    };
    pins.forEach((p) => {
      p.setAttribute('aria-pressed', 'false');
      p.addEventListener('click', () => select(p.dataset.pin));
    });
    select('kyoto', false);
    // keep the first photo from the markup (already loaded) — only rebuild dots highlight
  };

  /* ---------- mood accordion ---------- */
  const initMood = () => {
    const panels = $$('.mood-panel');
    const open = (p) => panels.forEach((x) => { const on = x === p; x.classList.toggle('is-open', on); x.setAttribute('aria-expanded', String(on)); });
    panels.forEach((p) => {
      p.addEventListener('click', () => open(p));
      p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(p); } });
      p.addEventListener('focus', () => open(p));
      if (finePointer) p.addEventListener('pointerenter', () => open(p));
    });
  };

  /* ---------- featured journal toggle ---------- */
  const initFeature = () => {
    const btn = $('#featureToggle'), list = $('#featureChapters');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      list.hidden = open;
      $('.cta__text', btn).textContent = open ? 'Explore the issue' : 'Close the issue';
    });
  };

  /* ---------- photo journal: tap to reveal caption on touch ---------- */
  const initPJ = () => {
    const tiles = $$('.pj__tile');
    tiles.forEach((t) => t.addEventListener('click', () => {
      if (finePointer) return;
      const on = t.classList.contains('is-tapped');
      tiles.forEach((x) => x.classList.remove('is-tapped'));
      if (!on) t.classList.add('is-tapped');
    }));
  };

  /* ---------- newsletter ---------- */
  const initNewsletter = () => {
    const form = $('#nlForm'), email = $('#nlEmail'), err = $('#nlError'), done = $('#nlDone');
    const valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    const setError = (msg) => {
      err.textContent = msg;
      email.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    const check = () => {
      const v = email.value.trim();
      if (!v) { setError('Please enter your email so we know where to send the postcard.'); return false; }
      if (!valid(v)) { setError('That doesn’t look like an email — check for a missing @ or domain.'); return false; }
      setError(''); return true;
    };
    let touched = false;
    email.addEventListener('blur', () => { if (email.value) { touched = true; check(); } });
    email.addEventListener('input', () => { if (touched) check(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      touched = true;
      if (!check()) { email.focus(); return; }
      const v = email.value.trim();
      let h = 0; for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) >>> 0;
      const seat = (1 + (h % 32)) + 'ABCDEF'[h % 6];
      const picks = $$('input[name="int"]:checked', form).map((i) => i.value);
      $('#nlCode').textContent = 'WW-' + String(100 + (h % 900));
      $('#nlSeat').textContent = seat;
      $('#nlMsg').textContent = picks.length
        ? `Next letter lands soon. We’ll steer you toward: ${picks.join(', ')}.`
        : 'The next letter lands in your inbox soon. Pack light.';
      form.hidden = true; done.hidden = false; done.focus();
    });
    $('#nlReset').addEventListener('click', () => {
      form.reset(); setError(''); touched = false;
      done.hidden = true; form.hidden = false; email.focus();
    });
  };

  /* ---------- magnetic buttons ---------- */
  const initMagnetic = () => {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        if (reduce) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.translate = `${(dx * 0.22).toFixed(1)}px ${(dy * 0.32).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
  };

  /* ---------- custom cursor ---------- */
  const initCursor = () => {
    const cur = $('#cursor'), label = $('#cursorLabel');
    if (!finePointer || !cur) return;
    let x = -100, y = -100, cx = x, cy = y, raf = 0, active = false;
    const loop = () => {
      cx = lerp(cx, x, 0.22); cy = lerp(cy, y, 0.22);
      cur.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      raf = (Math.abs(cx - x) > .1 || Math.abs(cy - y) > .1) ? requestAnimationFrame(loop) : 0;
    };
    window.addEventListener('pointermove', (e) => {
      if (reduce) return;
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
      const t = e.target.closest ? e.target.closest('[data-cursor]') : null;
      if (t && !active) { active = true; label.textContent = t.dataset.cursor; cur.classList.add('is-active'); }
      else if (t && active) { label.textContent = t.dataset.cursor; }
      else if (!t && active) { active = false; cur.classList.remove('is-active'); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { cur.style.opacity = '0'; });
    document.addEventListener('pointerenter', () => { cur.style.opacity = '1'; });
  };

  /* ---------- fit giant type to the viewport (works with any font fallback) ---------- */
  const px = (v) => parseFloat(v) || 0;
  const fitWord = (el, maxPx) => {
    if (!el) return;
    const prevW = el.style.width, prevJ = el.style.justifyContent;
    el.style.fontSize = '100px';
    el.style.width = 'max-content';
    el.style.justifyContent = 'flex-start';
    const natural = el.getBoundingClientRect().width;
    el.style.width = prevW;
    el.style.justifyContent = prevJ;
    const par = el.parentElement, cs = getComputedStyle(par);
    const avail = par.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
    if (natural > 0 && avail > 0) el.style.fontSize = Math.min((100 * avail) / natural, maxPx) + 'px';
  };
  const fitHeadings = () => {
    // display headings: shrink only if a line would be clipped
    $$('.display-h').forEach((h) => {
      h.style.fontSize = '';
      const base = px(getComputedStyle(h).fontSize);
      let worst = 1;
      $$('.split-line', h).forEach((l) => { if (l.clientWidth) worst = Math.max(worst, l.scrollWidth / l.clientWidth); });
      if (worst > 1) h.style.fontSize = (base / worst * 0.96) + 'px';
    });
    // hero title: longest line must clear the viewport (and stay out of the way on desktop)
    const ht = $('.hero__title');
    if (ht) {
      ht.style.fontSize = '';
      const base = px(getComputedStyle(ht).fontSize);
      const words = $$('.word', ht);
      const widest = Math.max(...words.map((w) => w.getBoundingClientRect().width));
      const left = ht.getBoundingClientRect().left;
      const limit = window.innerWidth >= 901 ? window.innerWidth * 0.8 : window.innerWidth - left * 2;
      if (widest > limit) ht.style.fontSize = (base * limit / widest) + 'px';
    }
    fitWord($('.footer__word'), 480);
    fitWord($('.feature__giant'), 608);
  };

  /* ---------- boot ---------- */
  const boot = () => {
    initMap(); initMood(); initFeature(); initPJ(); initNewsletter(); initMagnetic(); initCursor();
    initThemes(); initReveals();
    fitHeadings(); layoutGallery(); onScroll();
    runLoader();
    window.addEventListener('load', fitHeadings);
    window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(() => { fitHeadings(); layoutGallery(); }, 140); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitHeadings(); layoutGallery(); });
  };
  let fitT;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

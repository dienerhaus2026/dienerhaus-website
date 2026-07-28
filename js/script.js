(function () {
  'use strict';

  /* ---------- Mobile nav toggle ---------- */
  var navToggle = document.getElementById('nav-toggle');
  var navLinks = document.getElementById('nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Lazy-load background images ---------- */
  var lazyBgEls = document.querySelectorAll('.lazy-bg');
  function applyBg(el) {
    var url = el.getAttribute('data-bg');
    if (url) el.style.backgroundImage = "url('" + url + "')";
  }
  if ('IntersectionObserver' in window) {
    var bgIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            applyBg(entry.target);
            bgIo.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '200px 0px' }
    );
    lazyBgEls.forEach(function (el) { bgIo.observe(el); });
  } else {
    lazyBgEls.forEach(applyBg);
  }

  /* ---------- Hero video (only render if a real src is supplied) ---------- */
  var heroVideo = document.getElementById('hero-video');
  var heroPlaceholder = document.querySelector('.hero-placeholder-label');
  var HERO_VIDEO_SRC = 'assets/hero-maximilianstrasse-wandel.mp4';
  if (heroVideo && HERO_VIDEO_SRC) {
    heroVideo.src = HERO_VIDEO_SRC;
    heroVideo.style.display = 'block';
    if (heroPlaceholder) heroPlaceholder.style.display = 'none';
  }

  /* ---------- Financing calculator ---------- */
  var fmt = function (n) {
    return Math.round(n).toLocaleString('de-DE');
  };

  var kaufpreisEl = document.getElementById('kaufpreis');
  var eigenkapitalEl = document.getElementById('eigenkapital');
  var zinssatzEl = document.getElementById('zinssatz');
  var tilgungEl = document.getElementById('tilgung');
  var foerdersummeEl = document.getElementById('foerdersumme');
  var foerderzinsEl = document.getElementById('foerderzins');
  var gebaeudeanteilEl = document.getElementById('gebaeudeanteil');

  var outKreditsumme = document.getElementById('out-kreditsumme');
  var outNormalanteil = document.getElementById('out-normalanteil');
  var outFoerderanteil = document.getElementById('out-foerderanteil');
  var outNormalrate = document.getElementById('out-normalrate');
  var outFoerderrate = document.getElementById('out-foerderrate');
  var outMonatsrate = document.getElementById('out-monatsrate');
  var outRestschuld = document.getElementById('out-restschuld');
  var outAfa = document.getElementById('out-afa');

  var afaButtons = document.querySelectorAll('.afa-btn');
  var afaDegressivNote = document.getElementById('afa-degressiv-note');
  var afaModus = 'neubau';

  function num(el, fallback) {
    var v = Number(el.value);
    return isNaN(v) || v < 0 ? fallback : v;
  }

  function recalc() {
    if (!kaufpreisEl) return;

    var kaufpreis = num(kaufpreisEl, 0);
    var eigenkapital = num(eigenkapitalEl, 0);
    var zinssatz = num(zinssatzEl, 0);
    var tilgung = num(tilgungEl, 0);
    var foerdersumme = num(foerdersummeEl, 0);
    var foerderzins = num(foerderzinsEl, 0);
    var gebaeudeanteil = Math.min(100, num(gebaeudeanteilEl, 0));

    var kreditsumme = Math.max(0, kaufpreis - eigenkapital);
    var foerderAnteil = Math.min(foerdersumme, kreditsumme);
    var normalAnteil = kreditsumme - foerderAnteil;

    var normalRate = normalAnteil * (zinssatz + tilgung) / 100 / 12;
    var foerderRate = foerderAnteil * (foerderzins + tilgung) / 100 / 12;
    var monatsrate = normalRate + foerderRate;

    var restNormal = normalAnteil;
    var restFoerder = foerderAnteil;
    var mzNormal = zinssatz / 100 / 12;
    var mzFoerder = foerderzins / 100 / 12;

    for (var i = 0; i < 120 && (restNormal > 0 || restFoerder > 0); i++) {
      var zinsN = restNormal * mzNormal;
      restNormal = Math.max(0, restNormal - (normalRate - zinsN));
      var zinsF = restFoerder * mzFoerder;
      restFoerder = Math.max(0, restFoerder - (foerderRate - zinsF));
    }
    var restschuld = restNormal + restFoerder;

    outKreditsumme.textContent = fmt(kreditsumme) + ' €';
    outNormalanteil.textContent = fmt(normalAnteil) + ' €';
    outFoerderanteil.textContent = fmt(foerderAnteil) + ' €';
    outNormalrate.textContent = fmt(normalRate) + ' €';
    outFoerderrate.textContent = fmt(foerderRate) + ' €';
    outMonatsrate.textContent = fmt(monatsrate) + ' €';
    outRestschuld.textContent = fmt(restschuld) + ' €';

    var afaSatz = afaModus === 'degressiv' ? 5 : (afaModus === 'neubau' ? 3 : 2);
    var gebaeudewert = kaufpreis * (gebaeudeanteil / 100);
    var afa = gebaeudewert * (afaSatz / 100);
    outAfa.textContent = fmt(afa) + ' €';
  }

  [kaufpreisEl, eigenkapitalEl, zinssatzEl, tilgungEl, foerdersummeEl, foerderzinsEl, gebaeudeanteilEl].forEach(function (el) {
    if (el) el.addEventListener('input', recalc);
  });

  afaButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      afaModus = btn.getAttribute('data-mode');
      afaButtons.forEach(function (b) { b.classList.toggle('active', b === btn); });
      afaDegressivNote.hidden = afaModus !== 'degressiv';
      recalc();
    });
  });

  recalc();

  /* ---------- Contact form ---------- */
  var KONTAKT_ENDPOINT = 'https://dienerhaus-contact.crimson-shape-0175.workers.dev';

  var kontaktForm = document.getElementById('kontakt-form');
  var kontaktStatus = document.getElementById('kontakt-form-status');

  function openMailtoFallback() {
    var name = encodeURIComponent(kontaktForm.name.value);
    var email = encodeURIComponent(kontaktForm.email.value);
    var message = encodeURIComponent(kontaktForm.message.value);
    var body = 'Name: ' + name + '%0D%0AE-Mail: ' + email + '%0D%0A%0D%0A' + message;
    window.location.href = 'mailto:info@dienerhaus.de?subject=Kontaktanfrage%20von%20der%20Website&body=' + body;
  }

  function setStatus(text, kind) {
    if (!kontaktStatus) return;
    kontaktStatus.textContent = text;
    kontaktStatus.classList.remove('is-success', 'is-error');
    if (kind) kontaktStatus.classList.add(kind);
  }

  if (kontaktForm) {
    kontaktForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var submitBtn = kontaktForm.querySelector('button[type="submit"]');
      var payload = {
        name: kontaktForm.name.value,
        email: kontaktForm.email.value,
        message: kontaktForm.message.value,
        _hp: kontaktForm._hp.value
      };

      if (submitBtn) submitBtn.disabled = true;
      setStatus('Wird gesendet …', null);

      fetch(KONTAKT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('send_failed');
          return res.json();
        })
        .then(function (data) {
          if (!data || !data.ok) throw new Error('send_failed');
          setStatus('Danke für Ihre Nachricht! Wir melden uns zeitnah bei Ihnen.', 'is-success');
          kontaktForm.reset();
        })
        .catch(function () {
          setStatus('Senden nicht möglich — es öffnet sich stattdessen Ihr E-Mail-Programm.', 'is-error');
          openMailtoFallback();
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ---------- Testimonial "read full review" modal ---------- */
  var testimonialOverlay = document.getElementById('testimonial-modal-overlay');
  var testimonialBody = document.getElementById('testimonial-modal-body');
  var testimonialAuthor = document.getElementById('testimonial-modal-author');
  var testimonialCloseBtn = document.getElementById('testimonial-modal-close');

  var testimonialLastTrigger = null;

  function getFocusableInModal() {
    return Array.prototype.slice.call(
      testimonialOverlay.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) { return !el.hidden && el.offsetParent !== null; });
  }

  function openTestimonialModal(key, triggerEl) {
    var textTemplate = document.getElementById('testimonial-full-' + key);
    var authorTemplate = document.getElementById('testimonial-full-' + key + '-author');
    if (!textTemplate || !testimonialOverlay) return;
    testimonialLastTrigger = triggerEl || document.activeElement;
    testimonialBody.innerHTML = '';
    testimonialBody.appendChild(textTemplate.content.cloneNode(true));
    testimonialAuthor.textContent = authorTemplate ? authorTemplate.content.textContent.trim() : '';
    testimonialOverlay.hidden = false;
    if (testimonialCloseBtn) testimonialCloseBtn.focus();
  }
  function closeTestimonialModal() {
    if (!testimonialOverlay || testimonialOverlay.hidden) return;
    testimonialOverlay.hidden = true;
    if (testimonialLastTrigger && typeof testimonialLastTrigger.focus === 'function') {
      testimonialLastTrigger.focus();
    }
    testimonialLastTrigger = null;
  }

  document.querySelectorAll('.testimonial-more').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openTestimonialModal(btn.getAttribute('data-testimonial'), btn);
    });
  });
  if (testimonialCloseBtn) testimonialCloseBtn.addEventListener('click', closeTestimonialModal);
  if (testimonialOverlay) {
    testimonialOverlay.addEventListener('click', function (e) {
      if (e.target === testimonialOverlay) closeTestimonialModal();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (!testimonialOverlay || testimonialOverlay.hidden) return;
    if (e.key === 'Escape') {
      closeTestimonialModal();
      return;
    }
    if (e.key === 'Tab') {
      var focusable = getFocusableInModal();
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ---------- Map: load only after explicit user click (privacy) ---------- */
  var mapLoadBtn = document.getElementById('map-load-btn');
  var mapPlaceholder = document.getElementById('map-placeholder');
  var mapIframe = document.getElementById('kontakt-map-iframe');
  if (mapLoadBtn && mapIframe) {
    mapLoadBtn.addEventListener('click', function () {
      mapIframe.src = mapIframe.getAttribute('data-src');
      mapIframe.hidden = false;
      if (mapPlaceholder) mapPlaceholder.hidden = true;
    });
  }
})();

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  /* ---------------------------------------------------------
     Header shrink + scroll progress bar
  --------------------------------------------------------- */
  const header = document.getElementById('header');
  const progressBar = document.getElementById('progressBar');

  function updateHeaderAndProgress(scrollY) {
    header.classList.toggle('is-scrolled', scrollY > 40);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = max > 0 ? `${(scrollY / max) * 100}%` : '0%';
  }
  updateHeaderAndProgress(window.scrollY);

  /* ---------------------------------------------------------
     Slow, buttery smooth scrolling (desktop wheel only).
     Mobile/touch keeps native scrolling for responsiveness.
  --------------------------------------------------------- */
  let currentY = window.scrollY;
  let targetY = window.scrollY;
  let rafId = null;
  const EASE = 0.075;          // lower = smoother / slower catch-up
  const WHEEL_DAMP = 0.5;      // lower = slower overall scroll speed

  function clampY(y) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.max(0, Math.min(y, max));
  }

  function animateScroll() {
    currentY += (targetY - currentY) * EASE;
    if (Math.abs(targetY - currentY) < 0.4) {
      currentY = targetY;
      window.scrollTo(0, currentY);
      updateHeaderAndProgress(currentY);
      rafId = null;
      return;
    }
    window.scrollTo(0, currentY);
    updateHeaderAndProgress(currentY);
    rafId = requestAnimationFrame(animateScroll);
  }

  function startAnimating() {
    if (!rafId) rafId = requestAnimationFrame(animateScroll);
  }

  if (!reduceMotion && !isCoarsePointer) {
    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      targetY = clampY(targetY + e.deltaY * WHEEL_DAMP);
      startAnimating();
    }, { passive: false });

    // Keep our internal position in sync if the browser scrolls us
    // outside of the wheel handler (keyboard, scrollbar drag, anchor jumps),
    // and always keep the header/progress bar accurate regardless of source.
    let externalSyncTimer = null;
    window.addEventListener('scroll', () => {
      updateHeaderAndProgress(window.scrollY);
      if (rafId) return; // ignore resync while our own animation is driving the scroll
      clearTimeout(externalSyncTimer);
      externalSyncTimer = setTimeout(() => {
        currentY = window.scrollY;
        targetY = window.scrollY;
      }, 50);
    }, { passive: true });
  } else {
    window.addEventListener('scroll', () => updateHeaderAndProgress(window.scrollY), { passive: true });
  }

  /* Smooth anchor navigation, reusing the same easing loop. */
  function smoothScrollTo(y) {
    targetY = clampY(y);
    if (reduceMotion || isCoarsePointer) {
      window.scrollTo({ top: targetY, behavior: 'smooth' });
      return;
    }
    currentY = window.scrollY;
    startAnimating();
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMobileMenu();
      const headerOffset = 84;
      smoothScrollTo(target.getBoundingClientRect().top + window.scrollY - headerOffset);
      history.pushState(null, '', id);
    });
  });

  /* ---------------------------------------------------------
     Mobile menu
  --------------------------------------------------------- */
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');

  function closeMobileMenu() {
    burger.classList.remove('is-active');
    mobileMenu.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  function toggleMobileMenu() {
    const open = mobileMenu.classList.toggle('is-open');
    burger.classList.toggle('is-active', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', toggleMobileMenu);

  /* ---------------------------------------------------------
     Interactive muscle map — "spotlight" effect. The rest of the
     photo dims; the selected muscle stays lit at full brightness
     inside soft glowing circles (no hand-traced outlines needed).
     Coordinates are in the source photo's own pixel space (512x1024).
  --------------------------------------------------------- */
  const MUSCLES = {
    shoulders: { title: 'Плечи', text: 'Хочешь выглядеть шире в плечах — качай именно их: они создают V-образный силуэт и визуально сужают талию.', view: 'front', points: [[384, 210, 58], [128, 210, 58]] },
    chest:     { title: 'Грудь', text: 'Хочешь мощный торс и силу в жимах — работай над грудью: она держит форму верха тела и отвечает за толкающие движения.', view: 'front', points: [[256, 236, 92]] },
    abs:       { title: 'Пресс', text: 'Хочешь плоский живот и защищённую поясницу — качай пресс: он стабилизирует корпус и включается в каждое силовое движение.', view: 'front', points: [[256, 344, 78]] },
    biceps:    { title: 'Бицепс', text: 'Хочешь объёмные руки — бицепс первым бросается в глаза: он сгибает руку и работает в тягах и подтягиваниях.', view: 'front', points: [[392, 312, 52], [120, 312, 52]] },
    forearms:  { title: 'Предплечья', text: 'Хочешь уверенный хват и жим без срывов штанги — качай предплечья: без них сила рук упирается в потолок.', view: 'front', points: [[418, 472, 46], [94, 472, 46]] },
    legs:      { title: 'Ноги', text: 'Хочешь пропорциональное тело и разгон метаболизма — не пропускай ноги: это самая крупная мышечная группа организма.', view: 'front', points: [[286, 632, 92], [226, 632, 92]] },
    back:      { title: 'Спина', text: 'Хочешь казаться шире и держать правильную осанку — качай спину: это самая крупная мышца верха тела, недооценённая, но заметная.', view: 'back', points: [[256, 270, 128] ] },
    triceps:   { title: 'Трицепс', text: 'Хочешь по-настоящему большие руки — не забывай трицепс: он занимает до 2/3 объёма руки и включается в любом жиме.', view: 'back', points: [[440, 288, 50], [72, 288, 50]] },
  };

  const muscleButtons = Array.from(document.querySelectorAll('.muscle-btn'));
  const pins = Array.from(document.querySelectorAll('.pin'));
  const pinLayers = Array.from(document.querySelectorAll('.body-photo__pins'));
  const bodyImages = Array.from(document.querySelectorAll('.body-photo__img'));
  const spotlights = Array.from(document.querySelectorAll('.body-photo__spotlight'));
  const muscleInfo = document.getElementById('muscleInfo');
  const infoEyebrow = muscleInfo ? muscleInfo.querySelector('.muscle-info__eyebrow') : null;
  const infoTitle = muscleInfo ? muscleInfo.querySelector('.muscle-info__title') : null;
  const infoText = muscleInfo ? muscleInfo.querySelector('.muscle-info__text') : null;
  let activeMuscle = null;

  function setView(view) {
    bodyImages.forEach((img) => img.classList.toggle('is-visible', img.dataset.view === view));
    spotlights.forEach((s) => s.classList.toggle('is-visible', s.dataset.view === view));
    pinLayers.forEach((layer) => layer.classList.toggle('is-visible', layer.dataset.pins === view));
  }

  function clearSpots() {
    document.querySelectorAll('.spot-c').forEach((c) => {
      c.style.cx = '-100px'; c.style.cy = '-100px'; c.style.r = '0px';
    });
  }

  function lightSpots(view, points) {
    const circles = document.querySelectorAll(`.spot-c[data-spot^="${view}-"]`);
    circles.forEach((c, i) => {
      const p = points[i];
      if (!p) { c.style.cx = '-100px'; c.style.cy = '-100px'; c.style.r = '0px'; return; }
      c.style.cx = `${p[0]}px`; c.style.cy = `${p[1]}px`; c.style.r = `${p[2]}px`;
    });
  }

  function selectMuscle(id, fromBody) {
    if (!MUSCLES[id]) return;
    if (activeMuscle === id) {
      activeMuscle = null;
      muscleButtons.forEach((b) => b.classList.remove('is-active'));
      pins.forEach((p) => p.classList.remove('is-active'));
      pinLayers.forEach((layer) => layer.classList.remove('has-active'));
      bodyImages.forEach((img) => img.classList.remove('is-dimmed'));
      clearSpots();
      setView('front');
      if (infoEyebrow) infoEyebrow.textContent = 'Подсказка';
      if (infoTitle) infoTitle.textContent = 'Выбери группу мышц';
      if (infoText) infoText.textContent = 'Нажми на точку или кнопку — мышца останется яркой, а всё тело вокруг неё притемнится.';
      return;
    }
    activeMuscle = id;
    const data = MUSCLES[id];
    muscleButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.group === id));
    pins.forEach((p) => p.classList.toggle('is-active', p.dataset.group === id));
    pinLayers.forEach((layer) => layer.classList.toggle('has-active', layer.dataset.pins === data.view));
    bodyImages.forEach((img) => img.classList.add('is-dimmed'));
    setView(data.view);
    lightSpots(data.view, data.points);
    if (infoEyebrow) infoEyebrow.textContent = fromBody ? 'Выбрано на теле' : 'Группа мышц';
    if (infoTitle) infoTitle.textContent = data.title;
    if (infoText) infoText.textContent = data.text;
  }

  muscleButtons.forEach((btn) => btn.addEventListener('click', () => selectMuscle(btn.dataset.group, false)));
  pins.forEach((pin) => pin.addEventListener('click', () => selectMuscle(pin.dataset.group, true)));

  /* ---------------------------------------------------------
     Scroll-reveal animations
  --------------------------------------------------------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = entry.target.getAttribute('data-reveal-delay') || 0;
          entry.target.style.transitionDelay = `${delay}ms`;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------------------------------------------------------
     FAQ accordion
  --------------------------------------------------------- */
  document.querySelectorAll('.accordion__item').forEach((item) => {
    const head = item.querySelector('.accordion__head');
    const body = item.querySelector('.accordion__body');

    function setOpen(open) {
      item.classList.toggle('is-open', open);
      body.style.maxHeight = open ? `${body.scrollHeight}px` : '0px';
    }
    setOpen(item.classList.contains('is-open'));

    head.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      document.querySelectorAll('.accordion__item.is-open').forEach((openItem) => {
        if (openItem !== item) {
          openItem.classList.remove('is-open');
          openItem.querySelector('.accordion__body').style.maxHeight = '0px';
        }
      });
      setOpen(willOpen);
    });
  });

  /* ---------------------------------------------------------
     Back-to-top button
  --------------------------------------------------------- */
  document.getElementById('toTop').addEventListener('click', () => smoothScrollTo(0));

  /* ---------------------------------------------------------
     CTA form (front-end only demo)
  --------------------------------------------------------- */
  const joinForm = document.getElementById('joinForm');
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = joinForm.querySelector('button');
    const original = btn.textContent;
    btn.textContent = 'Заявка отправлена ✓';
    btn.disabled = true;
    joinForm.reset();
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2600);
  });
})();

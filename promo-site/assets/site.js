(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Mobile nav
  document.querySelectorAll('[data-nav-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(btn.getAttribute('data-nav-toggle'));
      if (target) target.classList.toggle('open');
    });
  });

  /**
   * 2. Stealth compare — physics-based underdamped spring slider.
   * Motion-web specification: replaces monotonic lerp with sprung deceleration & tactile overshoot.
   */
  document.querySelectorAll('[data-compare]').forEach((compare) => {
    const stage = compare.querySelector('.compare-stage');
    if (!stage) return;

    const min = 12;
    const max = 88;
    let target = Number(compare.dataset.split || 50);
    let current = target;
    let vel = 0;
    let dragging = false;
    let raf = 0;
    let lastTime = 0;

    const clamp = (v) => Math.min(max, Math.max(min, v));

    const apply = (value) => {
      const v = clamp(value);
      compare.style.setProperty('--split', `${v}%`);
      const live = compare.querySelector('[data-split-live]');
      if (live) live.textContent = `${Math.round(v)}%`;
    };

    const tick = (now) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;

      if (dragging) {
        // Direct responsive follow with micro-spring coupling
        const delta = target - current;
        current += delta * 0.48;
        vel = delta / Math.max(dt, 0.001);
      } else {
        // Underdamped spring physics (handfeel.md §1)
        const STIFFNESS = 140;
        const DAMPING = 0.86;
        const force = (target - current) * STIFFNESS;
        vel = (vel + force * dt) * DAMPING;
        current += vel * dt;
      }

      if (!dragging && Math.abs(target - current) < 0.05 && Math.abs(vel) < 0.2) {
        current = target;
        vel = 0;
        apply(current);
        raf = 0;
        lastTime = 0;
        return;
      }

      apply(current);
      raf = requestAnimationFrame(tick);
    };

    const goTo = (value, immediate) => {
      target = clamp(value);
      if (immediate || prefersReducedMotion) {
        current = target;
        vel = 0;
        apply(current);
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
          lastTime = 0;
        }
        return;
      }
      if (!raf) {
        lastTime = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const percentFromEvent = (clientX) => {
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0) return target;
      return ((clientX - rect.left) / rect.width) * 100;
    };

    const onPointerDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      stage.classList.add('is-dragging');
      stage.setPointerCapture?.(e.pointerId);
      goTo(percentFromEvent(e.clientX), false);
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      // Spotlight coordinates on stage
      const rect = stage.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * 100;
      const sy = ((e.clientY - rect.top) / rect.height) * 100;
      stage.style.setProperty('--stage-spot-x', `${sx}%`);
      stage.style.setProperty('--stage-spot-y', `${sy}%`);

      if (!dragging) return;
      goTo(percentFromEvent(e.clientX), false);
      e.preventDefault();
    };

    const onPointerUp = (e) => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      try {
        stage.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('lostpointercapture', onPointerUp);

    // Keyboard accessibility
    stage.setAttribute('tabindex', '0');
    stage.setAttribute('role', 'slider');
    stage.setAttribute('aria-valuemin', String(min));
    stage.setAttribute('aria-valuemax', String(max));
    stage.setAttribute('aria-valuenow', String(Math.round(target)));
    stage.setAttribute('aria-label', '拖动查看面试者与面试官视角差异');
    stage.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 8 : 3;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        goTo(target - step);
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        goTo(target + step);
        e.preventDefault();
      } else if (e.key === 'Home') {
        goTo(min, true);
        e.preventDefault();
      } else if (e.key === 'End') {
        goTo(max, true);
        e.preventDefault();
      }
      stage.setAttribute('aria-valuenow', String(Math.round(target)));
    });

    stage.querySelectorAll('img').forEach((img) => {
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', (ev) => ev.preventDefault());
    });

    apply(current);

    // Smooth spring teaser wave on load to prompt interaction
    if (!prefersReducedMotion) {
      setTimeout(() => goTo(38), 500);
      setTimeout(() => goTo(62), 1100);
      setTimeout(() => goTo(50), 1700);
    }
  });

  /**
   * 3. Hero 3D Perspective Tilt with Dynamic Glare
   * Motion-web pattern: interactive card elevation + specular lighting sheen
   */
  const heroMediaCard = document.querySelector('.hero .media-card');
  if (heroMediaCard && !prefersReducedMotion && window.matchMedia('(hover: hover)').matches) {
    let tX = 0, tY = 0;
    let cX = 0, cY = 0;
    let tiltRaf = 0;

    const tickTilt = () => {
      cX += (tX - cX) * 0.12;
      cY += (tY - cY) * 0.12;

      heroMediaCard.style.transform = `perspective(1000px) rotateX(${cX}deg) rotateY(${cY}deg)`;

      if (Math.abs(tX - cX) > 0.01 || Math.abs(tY - cY) > 0.01) {
        tiltRaf = requestAnimationFrame(tickTilt);
      } else {
        tiltRaf = 0;
      }
    };

    heroMediaCard.addEventListener('mousemove', (e) => {
      const rect = heroMediaCard.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // -6 to +6 degrees max
      tY = (x - 0.5) * 12;
      tX = (0.5 - y) * 10;

      heroMediaCard.style.setProperty('--glare-x', `${x * 100}%`);
      heroMediaCard.style.setProperty('--glare-y', `${y * 100}%`);

      if (!tiltRaf) tiltRaf = requestAnimationFrame(tickTilt);
    });

    heroMediaCard.addEventListener('mouseleave', () => {
      tX = 0;
      tY = 0;
      if (!tiltRaf) tiltRaf = requestAnimationFrame(tickTilt);
    });
  }

  /**
   * 4. Card Spotlight Coordinates for Tactile Hover
   * Subtle ambient light tracking on modern cards
   */
  if (window.matchMedia('(hover: hover)').matches) {
    const spotlightCards = document.querySelectorAll(
      '.feature, .price-card, .doc-card, .platform, .chat-phone'
    );
    spotlightCards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  }

  /**
   * 5. Scroll Choreography — Staggered Reveal Observer
   * Motion-web design standard: sections slide in with ease-out-expo rhythm
   */
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const revealGroups = [
      { selector: '.section-title', stagger: false },
      { selector: '.hero h1, .hero .lead, .hero-actions, .trust-row', stagger: true },
      { selector: '.platforms .platform', stagger: true },
      { selector: '.feature-grid .feature', stagger: true },
      { selector: '.price-grid .price-card', stagger: true },
      { selector: '.doc-grid .doc-card', stagger: true },
      { selector: '.chat-grid .chat-phone', stagger: true },
    ];

    revealGroups.forEach(({ selector, stagger }) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el, index) => {
        el.classList.add('motion-reveal');
        if (stagger) {
          el.style.setProperty('--reveal-i', String(index % 6));
        }
      });
    });

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            if (entry.target.classList.contains('chat-phone')) {
              entry.target.classList.add('bubbles-live');
            }
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.motion-reveal').forEach((el) => {
      revealObserver.observe(el);
    });
  }

  // 6. Autoplay short hero loops when visible
  const videos = document.querySelectorAll('video[data-autoplay]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target;
          if (entry.isIntersecting) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: 0.35 }
    );
    videos.forEach((v) => io.observe(v));
  }

  // 7. Story ad: muted autoplay when scrolled into view
  const story = document.getElementById('story-ad');
  if (story) {
    story.muted = true;
    const tryPlay = () => {
      story.muted = true;
      story.play().catch(() => {});
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) tryPlay();
            else story.pause();
          });
        },
        { threshold: 0.35 }
      );
      io.observe(story);
    } else {
      tryPlay();
    }
  }
})();

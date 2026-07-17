(function () {
  // Mobile nav
  document.querySelectorAll('[data-nav-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(btn.getAttribute('data-nav-toggle'));
      if (target) target.classList.toggle('open');
    });
  });

  /**
   * Stealth compare — pointer-driven, rAF-smoothed slider.
   * Uses lerp for silk-smooth motion instead of raw range input jumps.
   */
  document.querySelectorAll('[data-compare]').forEach((compare) => {
    const stage = compare.querySelector('.compare-stage');
    if (!stage) return;

    const min = 12;
    const max = 88;
    let target = Number(compare.dataset.split || 50);
    let current = target;
    let dragging = false;
    let raf = 0;

    const clamp = (v) => Math.min(max, Math.max(min, v));

    const apply = (value) => {
      const v = clamp(value);
      compare.style.setProperty('--split', `${v}%`);
      const live = compare.querySelector('[data-split-live]');
      if (live) live.textContent = `${Math.round(v)}%`;
    };

    const tick = () => {
      // Dragging: snappy follow; release: soft ease-out
      const k = dragging ? 0.62 : 0.2;
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.04) {
        current = target;
        apply(current);
        raf = 0;
        return;
      }
      apply(current);
      raf = requestAnimationFrame(tick);
    };

    const goTo = (value, immediate) => {
      target = clamp(value);
      if (immediate) {
        current = target;
        apply(current);
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        return;
      }
      if (!raf) raf = requestAnimationFrame(tick);
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

    // Pointer events (mouse + touch + pen)
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

    // Prevent image drag ghost
    stage.querySelectorAll('img').forEach((img) => {
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', (ev) => ev.preventDefault());
    });

    apply(current);

    // Soft intro nudge so users notice the handle
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTimeout(() => goTo(42), 600);
      setTimeout(() => goTo(58), 1100);
      setTimeout(() => goTo(50), 1600);
    }
  });

  // Autoplay short hero loops when visible (skip long story ads)
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

  // Story ad: muted autoplay when scrolled into view
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

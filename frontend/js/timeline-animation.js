/**
 * PUVIMA Consultancy — Timeline Blur-Sequence Animation
 * Faithful native implementation of the Framer Motion / motion/react TimelineAnimation component.
 *
 * Motion Specification:
 * - Hidden State:  { filter: 'blur(20px)', y: 0, opacity: 0 }
 * - Visible State: { filter: 'blur(0px)',  y: 0, opacity: 1, duration: 0.5s, delay: i * 0.5s }
 * - Trigger:       useInView(timelineRef, { once: true }) via IntersectionObserver
 */

export function initTimelineAnimation() {
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isReducedMotion) {
    document.querySelectorAll('.timeline-animation, [data-timeline-item]').forEach(el => {
      el.classList.add('is-visible');
    });
    return;
  }

  // 1. Observe timeline containers (useInView on timelineRef)
  const containers = document.querySelectorAll('[data-timeline], .timeline-container');

  const containerObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target;
        const delayStep = parseFloat(container.dataset.delayStep) || 0.5; // 0.5s default matching Motion component
        const items = container.querySelectorAll('.timeline-animation, [data-timeline-item]');

        items.forEach((item, index) => {
          // Resolve sequence index (customVariants i / animationNum)
          const animNum = item.dataset.animationNum !== undefined
            ? parseFloat(item.dataset.animationNum)
            : index;

          item.style.setProperty('--animation-num', animNum);
          item.style.setProperty('--delay-step', `${delayStep}s`);
          item.style.transitionDelay = `${animNum * delayStep}s`;
          item.classList.add('is-visible');
        });

        // Default: once = true (matching default prop)
        const isOnce = container.dataset.once !== 'false';
        if (isOnce) {
          observer.unobserve(container);
        }
      } else {
        // If once === false, reverse to hidden when leaving viewport
        const container = entry.target;
        if (container.dataset.once === 'false') {
          const items = container.querySelectorAll('.timeline-animation, [data-timeline-item]');
          items.forEach(item => {
            item.classList.remove('is-visible');
          });
        }
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px'
  });

  containers.forEach(container => containerObserver.observe(container));

  // 2. Observe standalone timeline items (if not wrapped inside [data-timeline])
  const standaloneItems = document.querySelectorAll(
    '.timeline-animation:not([data-timeline] .timeline-animation):not(.timeline-container .timeline-animation)'
  );

  if (standaloneItems.length) {
    const itemObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const item = entry.target;
          const animNum = parseFloat(item.dataset.animationNum) || 0;
          const delayStep = 0.5;
          item.style.transitionDelay = `${animNum * delayStep}s`;
          item.classList.add('is-visible');
          obs.unobserve(item);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    });

    standaloneItems.forEach(item => itemObserver.observe(item));
  }
}

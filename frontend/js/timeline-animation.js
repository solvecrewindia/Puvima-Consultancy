/**
 * PUVIMA Consultancy — Universal Card Blur-Sequence Animation
 * Faithful native implementation of Framer Motion / motion/react TimelineAnimation component.
 *
 * Motion Specification:
 * - Hidden State:  { filter: 'blur(20px)', opacity: 0, transform: 'translateY(0)' }
 * - Visible State: { filter: 'blur(0px)',  opacity: 1, transform: 'translateY(0)' }
 * - Timing:        duration: 0.55s, delay: index * delayStep (staggered sequence)
 * - Trigger:       IntersectionObserver with once: true (activates on first scroll only, never repeats during session)
 * - Reload:        On refresh, animations prime fresh and trigger on the first scroll down.
 */

export function initTimelineAnimation() {
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Comprehensive selector of all cards across the PUVIMA website
  const CARD_ITEM_SELECTORS = [
    '.timeline-animation',
    '[data-timeline-item]',
    '.blur-card-item',
    '.service-card-compact',
    '.service-card-deep',
    '.principle-editorial-card',
    '.portfolio-card',
    '.team-card',
    '.team-card-compact',
    '.timeline-card',
    '.timeline-process-card',
    '.careers-hub-card',
    '.job-card',
    '.job-card-editorial',
    '.service-column-box',
    '.cross-service-card',
    '.hero-visual-card',
    '.faq-item',
    '.bento-card',
    '.contact-cta-card',
    '.mission-card-box'
  ];

  const CARD_ITEM_SELECTOR = CARD_ITEM_SELECTORS.join(', ');

  // Grid and section containers that hold card sequences
  const GRID_CONTAINER_SELECTORS = [
    '[data-timeline]',
    '.timeline-container',
    '.principles-grid',
    '.services-compact-grid',
    '.services-catalog-grid',
    '.timeline-process-grid',
    '.portfolio-grid',
    '.team-grid',
    '.team-roster-grid',
    '.team-compact-grid',
    '.careers-grid',
    '.service-deep-columns',
    '.cross-services-grid',
    '.faq-list',
    '.mission-vision-grid'
  ];

  const GRID_CONTAINER_SELECTOR = GRID_CONTAINER_SELECTORS.join(', ');

  const allCards = document.querySelectorAll(CARD_ITEM_SELECTOR);

  if (isReducedMotion) {
    allCards.forEach(el => {
      el.classList.add('is-visible', 'reveal-visible');
    });
    return;
  }

  // Track cards that belong to a grouped container
  const groupedCards = new Set();

  // 1. Observe Card Grid Containers (for smooth staggered sequence per row/section)
  const containers = document.querySelectorAll(GRID_CONTAINER_SELECTOR);

  const containerObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target;
        const delayStep = parseFloat(container.dataset.delayStep) || 0.16; // 160ms cascade
        const items = container.querySelectorAll(CARD_ITEM_SELECTOR);

        items.forEach((item, index) => {
          const animNum = item.dataset.animationNum !== undefined
            ? parseFloat(item.dataset.animationNum)
            : index;

          item.style.setProperty('--animation-num', animNum);
          item.style.setProperty('--delay-step', `${delayStep}s`);
          item.style.transitionDelay = `${animNum * delayStep}s`;
          item.classList.add('is-visible', 'reveal-visible');
        });

        // STRICT ONCE: Always unobserve on first intersection.
        // Guarantees the blur animation only runs on first scroll down, never on a second scroll.
        observer.unobserve(container);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  containers.forEach(container => {
    const items = container.querySelectorAll(CARD_ITEM_SELECTOR);
    if (items.length > 0) {
      items.forEach((item, idx) => {
        groupedCards.add(item);
        if (!item.classList.contains('blur-card-item')) {
          item.classList.add('blur-card-item');
        }
        if (item.dataset.animationNum === undefined) {
          item.dataset.animationNum = idx;
        }
      });
      containerObserver.observe(container);
    }
  });

  // 2. Observe Standalone Cards (cards not wrapped in recognized grid containers)
  const standaloneObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const item = entry.target;
        const animNum = parseFloat(item.dataset.animationNum) || 0;
        const delayStep = 0.15;
        item.style.transitionDelay = `${animNum * delayStep}s`;
        item.classList.add('is-visible', 'reveal-visible');

        // STRICT ONCE: unobserve immediately so it only triggers on first scroll
        observer.unobserve(item);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  allCards.forEach(card => {
    if (!groupedCards.has(card)) {
      if (!card.classList.contains('blur-card-item')) {
        card.classList.add('blur-card-item');
      }
      standaloneObserver.observe(card);
    }
  });

  // 3. Initial Viewport Check (Safeguard)
  // If user refreshed while already scrolled down or is on a tall monitor where cards are in view:
  const checkInitialVisibility = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    containers.forEach(container => {
      const rect = container.getBoundingClientRect();
      if (rect.top < vh - 40 && rect.bottom > 40) {
        const delayStep = parseFloat(container.dataset.delayStep) || 0.16;
        const items = container.querySelectorAll(CARD_ITEM_SELECTOR);
        items.forEach((item, index) => {
          const animNum = item.dataset.animationNum !== undefined
            ? parseFloat(item.dataset.animationNum)
            : index;
          item.style.setProperty('--animation-num', animNum);
          item.style.setProperty('--delay-step', `${delayStep}s`);
          item.style.transitionDelay = `${animNum * delayStep}s`;
          item.classList.add('is-visible', 'reveal-visible');
        });
        containerObserver.unobserve(container);
      }
    });

    allCards.forEach(card => {
      if (!groupedCards.has(card)) {
        const rect = card.getBoundingClientRect();
        if (rect.top < vh - 40 && rect.bottom > 40) {
          card.classList.add('is-visible', 'reveal-visible');
          standaloneObserver.unobserve(card);
        }
      }
    });
  };

  requestAnimationFrame(() => {
    checkInitialVisibility();
  });
}

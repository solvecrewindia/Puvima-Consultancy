
export function initNavigation() {
  initHeaderScroll();
  initMobileDrawer();
  initDropdowns();
  initActiveNavHighlight();
  initSmoothScrollLinks();
}

function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 25) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

function initDropdowns() {
  const dropdownItems = document.querySelectorAll('.nav-item.has-dropdown');
  dropdownItems.forEach(item => {
    item.addEventListener('mouseenter', () => item.classList.add('dropdown-open'));
    item.addEventListener('mouseleave', () => item.classList.remove('dropdown-open'));
  });
}

function initMobileDrawer() {
  const toggleBtn = document.querySelector('.mobile-nav-toggle');
  const drawer = document.querySelector('.mobile-drawer');
  const navLinks = document.querySelectorAll('.mobile-nav-link');

  if (!toggleBtn || !drawer) return;

  const toggle = (force) => {
    const isOpen = typeof force === 'boolean' ? force : !drawer.classList.contains('open');
    drawer.classList.toggle('open', isOpen);
    toggleBtn.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';

    const icon = toggleBtn.querySelector('svg');
    if (icon) {
      icon.innerHTML = isOpen
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />';
    }
  };

  toggleBtn.addEventListener('click', () => toggle());

  navLinks.forEach(link => {
    link.addEventListener('click', () => toggle(false));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      toggle(false);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && drawer.classList.contains('open')) {
      toggle(false);
    }
  });
}

function initActiveNavHighlight() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  
  // Highlight grouped parent links based on current page
  const servicePages = ['services.html', 'robotics.html', 'fintech.html', 'ai-ml-research.html'];
  const aboutPages = ['about.html'];
  const insightPages = ['faq.html', 'terms.html', 'privacy-policy.html'];
  const careerPages = ['careers.html'];

  if (servicePages.includes(currentPath)) {
    document.querySelectorAll('[data-nav="what-we-do"]').forEach(el => el.classList.add('active'));
  } else if (aboutPages.includes(currentPath)) {
    document.querySelectorAll('[data-nav="who-we-are"]').forEach(el => el.classList.add('active'));
  } else if (insightPages.includes(currentPath)) {
    document.querySelectorAll('[data-nav="insights"]').forEach(el => el.classList.add('active'));
  } else if (careerPages.includes(currentPath)) {
    document.querySelectorAll('[data-nav="careers"]').forEach(el => el.classList.add('active'));
  }

  // Also highlight matching mobile links
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');
  mobileLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const linkPath = href.split('/').pop().split('#')[0];
    if (linkPath === currentPath) {
      link.classList.add('active');
    }
  });
}

function initSmoothScrollLinks() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

if (typeof window !== 'undefined') {
  window.PUVIMA_NAV = { initNavigation };
}

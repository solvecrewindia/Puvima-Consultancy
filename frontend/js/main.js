

import { initNavigation } from './navigation.js';
import { initForms } from './forms.js';
import { initFAQ } from './faq.js';
import { initPortfolio } from './portfolio.js';

document.addEventListener('DOMContentLoaded', () => {
  
  initNavigation();

  
  initScrollReveals();

  
  initForms();

  
  initFAQ();

  
  initPortfolio();
});


function initScrollReveals() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal-init').forEach(el => el.classList.add('reveal-visible'));
    return;
  }

  const revealElements = document.querySelectorAll('.reveal-init');
  if (!revealElements.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => observer.observe(el));
}

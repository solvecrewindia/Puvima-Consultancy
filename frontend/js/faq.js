

export function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');
  if (!faqItems.length) return;

  const triggers = Array.from(document.querySelectorAll('.faq-trigger'));

  faqItems.forEach((item, index) => {
    const trigger = item.querySelector('.faq-trigger');
    const content = item.querySelector('.faq-content');

    if (!trigger || !content) return;

    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      if (isOpen) {
        item.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        content.style.maxHeight = null;
      } else {
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        content.style.maxHeight = content.scrollHeight + 32 + 'px';
      }
    });

    
    trigger.addEventListener('keydown', (e) => {
      let targetIndex = index;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        targetIndex = (index + 1) % triggers.length;
        triggers[targetIndex].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        targetIndex = (index - 1 + triggers.length) % triggers.length;
        triggers[targetIndex].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        triggers[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        triggers[triggers.length - 1].focus();
      }
    });
  });

  window.addEventListener('resize', () => {
    faqItems.forEach(item => {
      if (item.classList.contains('open')) {
        const content = item.querySelector('.faq-content');
        if (content) {
          content.style.maxHeight = content.scrollHeight + 32 + 'px';
        }
      }
    });
  });
}

if (typeof window !== 'undefined') {
  window.PUVIMA_FAQ = { initFAQ };
}

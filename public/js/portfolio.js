

export function initPortfolio() {
  const filterButtons = document.querySelectorAll('.filter-tab-btn');
  const portfolioItems = document.querySelectorAll('.portfolio-card');

  if (!filterButtons.length || !portfolioItems.length) return;

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const filterCategory = button.getAttribute('data-filter') || 'all';

      portfolioItems.forEach(card => {
        const itemCategories = (card.getAttribute('data-category') || '').toLowerCase().split(' ');

        if (filterCategory === 'all' || itemCategories.includes(filterCategory.toLowerCase())) {
          card.style.display = 'flex';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 30);
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(12px)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 200);
        }
      });
    });
  });
}

if (typeof window !== 'undefined') {
  window.PUVIMA_PORTFOLIO = { initPortfolio };
}

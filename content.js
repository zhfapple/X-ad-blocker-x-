function hideAds() {
  // 策略一：通过官方广告标记
  document.querySelectorAll('[data-testid="placementTracking"]').forEach(el => {
    const cell = el.closest('[data-testid="cellInnerDiv"]');
    if (cell) {
      cell.style.display = 'none';
      return;
    }
    const article = el.closest('article');
    if (article) article.style.display = 'none';
  });

  // 策略二：通过文字特征兜底
  document.querySelectorAll('article').forEach(article => {
    if (article.style.display === 'none') return;
    const text = article.innerText;
    if (text.includes('广告') || text.includes('Ad') || text.includes('Promoted') || text.includes('広告')) {
      const cell = article.closest('[data-testid="cellInnerDiv"]');
      if (cell) cell.style.display = 'none';
      else article.style.display = 'none';
    }
  });
}

hideAds();
new MutationObserver(hideAds).observe(document.body, { childList: true, subtree: true });
(() => {
  const slots = [
    ['home.hero', '.hero-blend-visual img', 'img'],
    ['home.catalog.pens', '.popular-grid .catalog-card:nth-child(1) .popular-media img', 'img'],
    ['home.catalog.notebooks', '.popular-grid .catalog-card:nth-child(2) .popular-media img', 'img'],
    ['home.catalog.canvases', '.popular-grid .catalog-card:nth-child(3) .popular-media img', 'img'],
    ['home.catalog.mugs', '.popular-grid .catalog-card:nth-child(4) .popular-media img', 'img'],
    ['parker.hero', '.parker-v10-visual img', 'img'],
    ['parker.price.box', '.price-map-parker-photo img', 'img'],
    ['parker.price.engraving', '.price-map-engraving-photo img', 'img'],
    ['parker.price.packaging', '.price-map-packing-photo img', 'img'],
    ['parker.gallery.one', '#pen-gallery .gallery-thumbs button:nth-child(1) img', 'gallery'],
    ['parker.gallery.two', '#pen-gallery .gallery-thumbs button:nth-child(2) img', 'gallery'],
    ['parker.gallery.three', '#pen-gallery .gallery-thumbs button:nth-child(3) img', 'gallery'],
    ['parker.gallery.four', '#pen-gallery .gallery-thumbs button:nth-child(4) img', 'gallery'],
    ['categories.notebooks.hero', '.page-notebooks .category-detail-visual', 'background'],
    ['categories.mugs.hero', '.page-mugs .category-detail-visual', 'background'],
    ['categories.textile.hero', '.page-textile .category-detail-visual', 'background'],
    ['categories.canvases.hero', '.page-canvases .category-detail-visual', 'background'],
    ['categories.exlibris.hero', '.page-exlibris .category-detail-visual', 'background'],
    ['categories.giftsets.hero', '.page-gift-sets .category-detail-visual', 'background'],
    ['categories.seals.hero', '.page-seals-stamps .category-detail-visual', 'background'],
    ['categories.logoStamps.hero', '.page-logo-stamps .category-detail-visual', 'background'],
    ['categories.print.hero', '.page-print-materials .category-detail-visual', 'background'],
  ];

  const readPath = (obj, path) => path.split('.').reduce((value, key) => value && value[key], obj);

  const applyImage = (node, slot) => {
    node.src = slot.src;
    node.style.objectPosition = `${Number(slot.x ?? 50)}% ${Number(slot.y ?? 50)}%`;
    node.style.objectFit = slot.fit || 'cover';
    node.style.scale = String(Number(slot.zoom ?? 100) / 100);
  };

  const applyBackground = (node, slot) => {
    const x = Number(slot.x ?? 50);
    const y = Number(slot.y ?? 50);
    const zoom = Number(slot.zoom ?? 100);
    node.style.backgroundImage = `url("${slot.src}")`;
    node.style.backgroundPosition = `${x}% ${y}%`;
    node.style.backgroundRepeat = 'no-repeat';
    if (slot.fit === 'contain') node.style.backgroundSize = 'contain';
    else node.style.backgroundSize = zoom === 100 ? 'cover' : `${zoom}% auto`;
  };

  fetch('/assets/config/media.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(config => {
      slots.forEach(([path, selector, mode], index) => {
        const slot = readPath(config, path);
        if (!slot?.src) return;
        document.querySelectorAll(selector).forEach(node => {
          if (mode === 'background') applyBackground(node, slot);
          else {
            applyImage(node, slot);
            if (mode === 'gallery') {
              const button = node.closest('[data-gallery-thumb]');
              if (button) button.dataset.src = slot.src;
              if (index === 9) {
                const main = document.querySelector('#pen-gallery [data-gallery-main]');
                if (main) applyImage(main, slot);
              }
            }
          }
        });
      });
    })
    .catch(() => {});
})();

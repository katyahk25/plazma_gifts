(() => {
  const applySlot = slot => {
    let nodes = [];
    try { nodes = [...document.querySelectorAll(slot.selector)]; } catch { return; }
    nodes.forEach(node => {
      const x = Number(slot.x ?? 50);
      const y = Number(slot.y ?? 50);
      const zoom = Number(slot.zoom ?? 100);
      if (slot.mode === 'background') {
        node.style.backgroundImage = `url("${slot.src}")`;
        node.style.backgroundPosition = `${x}% ${y}%`;
        node.style.backgroundRepeat = 'no-repeat';
        if (slot.fit === 'contain') node.style.backgroundSize = 'contain';
        else node.style.backgroundSize = zoom === 100 ? 'cover' : `${zoom}% auto`;
        return;
      }
      if (node.tagName === 'IMG') {
        node.src = slot.src;
        node.style.objectPosition = `${x}% ${y}%`;
        node.style.objectFit = slot.fit || 'cover';
        node.style.scale = String(zoom / 100);
      }
    });
  };

  fetch('assets/config/media.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(config => Object.values(config.slots || {}).forEach(applySlot))
    .catch(() => {});
})();

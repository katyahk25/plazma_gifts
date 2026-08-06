(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');

  if (menuButton && nav) {
    const closeMenu = () => {
      nav.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    };

    menuButton.addEventListener('click', () => {
      const open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
    });

    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    window.addEventListener('resize', () => {
      if (window.innerWidth > 820) closeMenu();
    });
  }

  document.querySelectorAll('[data-carousel]').forEach(card => {
    const slides = [...card.querySelectorAll('.work-media img')];
    if (slides.length < 2) return;

    let index = 0;
    let timer = null;

    const show = next => {
      slides[index].classList.remove('is-active');
      index = (next + slides.length) % slides.length;
      slides[index].classList.add('is-active');
    };

    const start = () => {
      if (!timer) timer = window.setInterval(() => show(index + 1), 1400);
    };

    const stop = () => {
      window.clearInterval(timer);
      timer = null;
      show(0);
    };

    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    card.addEventListener('click', event => {
      if (window.matchMedia('(hover: none)').matches) {
        event.preventDefault();
        show(index + 1);
      }
    });
  });

  document.querySelectorAll('#request-form, [data-request-form]').forEach(form => {
    const status = form.querySelector('#form-status, [data-form-status]');

    form.addEventListener('submit', event => {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        if (status) status.textContent = 'Заполните обязательные поля.';
        return;
      }

      if (status) {
        status.textContent = 'Форма пока не отправляет заявки. Подключим её отдельным этапом.';
      }
    });
  });

  document.querySelectorAll('[data-product-gallery]').forEach(gallery => {
    const main = gallery.querySelector('[data-gallery-main]');
    const thumbs = [...gallery.querySelectorAll('[data-gallery-thumb]')];
    if (!main || !thumbs.length) return;

    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        const src = thumb.dataset.src;
        if (!src) return;

        main.src = src;
        main.alt = thumb.dataset.alt || '';
        thumbs.forEach(item => item.classList.toggle('is-active', item === thumb));
      });
    });
  });

  document.querySelectorAll('[data-engraving-builder]').forEach(builder => {
    const mainInput = builder.querySelector('[data-engraving-main-input]');
    const sideInput = builder.querySelector('[data-engraving-side-input]');
    const mainPreviews = [...builder.querySelectorAll('[data-engraving-main-preview]')];
    const sidePreviews = [...builder.querySelectorAll('[data-engraving-side-preview]')];
    const previewCard = builder.querySelector('[data-engraving-preview-card]');
    const fontButtons = [...builder.querySelectorAll('[data-engraving-font]')];
    const kerningInput = builder.querySelector('[data-engraving-kerning]');
    const kerningValue = builder.querySelector('[data-engraving-kerning-value]');
    const mainExampleButtons = [...builder.querySelectorAll('[data-engraving-main-example]')];
    const sideExampleButtons = [...builder.querySelectorAll('[data-engraving-side-example]')];

    if (!mainInput || !previewCard || !mainPreviews.length) return;

    let currentFont = 'gabriela';
    const fontMaxSizes = { gabriela: 31, izax: 40, shafarik: 42 };
    const minSize = 11;

    const setSharedSize = size => {
      [...mainPreviews, ...sidePreviews].forEach(item => {
        item.style.fontSize = `${size}px`;
      });
    };

    const fitsAllZones = () => {
      const allPreviews = [...mainPreviews, ...sidePreviews].filter(item => item.textContent && item.textContent.trim());
      return allPreviews.every(item => {
        const parent = item.parentElement;
        if (!parent) return true;
        return item.scrollWidth <= parent.clientWidth - 10 && item.scrollHeight <= parent.clientHeight - 6;
      });
    };

    const fitAllText = () => {
      let size = fontMaxSizes[currentFont] || 31;
      setSharedSize(size);

      while (size > minSize && !fitsAllZones()) {
        size -= 1;
        setSharedSize(size);
      }
    };

    const update = () => {
      const mainValue = (mainInput.value || '').trim() || 'Ваш текст';
      const sideValue = sideInput ? (sideInput.value || '').trim() : '';

      mainPreviews.forEach(item => {
        item.textContent = mainValue;
      });

      sidePreviews.forEach(item => {
        item.textContent = sideValue;
        item.parentElement.classList.toggle('is-empty', !sideValue);
      });

      fitAllText();
    };

    fontButtons.forEach(button => {
      button.addEventListener('click', () => {
        currentFont = button.dataset.engravingFont || 'gabriela';
        previewCard.classList.remove('engraving-font-gabriela', 'engraving-font-izax', 'engraving-font-shafarik');
        previewCard.classList.add(`engraving-font-${currentFont}`);
        fontButtons.forEach(item => item.classList.toggle('is-active', item === button));
        update();
      });
    });

    mainExampleButtons.forEach(button => {
      button.addEventListener('click', () => {
        const example = button.dataset.engravingMainExample || '';
        mainInput.value = example;
        update();
      });
    });

    sideExampleButtons.forEach(button => {
      button.addEventListener('click', () => {
        const example = button.dataset.engravingSideExample || '';
        if (sideInput) sideInput.value = example;
        update();
      });
    });

    mainInput.addEventListener('input', update);
    if (sideInput) sideInput.addEventListener('input', update);
    if (kerningInput) {
      kerningInput.addEventListener('input', () => {
        const value = Number(kerningInput.value);
        previewCard.style.setProperty('--engraving-letter-spacing', `${value}px`);
        if (kerningValue) kerningValue.textContent = `${value > 0 ? '+' : ''}${value} px`;
        update();
      });
      const initialKerning = Number(kerningInput.value);
      previewCard.style.setProperty('--engraving-letter-spacing', `${initialKerning}px`);
      if (kerningValue) kerningValue.textContent = `${initialKerning > 0 ? '+' : ''}${initialKerning} px`;
    }

    window.addEventListener('resize', update);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
    update();
  });

})();

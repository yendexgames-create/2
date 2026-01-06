document.addEventListener('DOMContentLoaded', () => {
  AOS.init({ duration: 700, once: true, easing: 'ease-out-quart' });

  const avatarDropdown = document.querySelector('.avatar-dropdown');
  if (avatarDropdown) {
    avatarDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      avatarDropdown.classList.remove('open');
    });
  }

  const statNumbers = document.querySelectorAll('.stat-number');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10) || 0;
        let current = 0;
        const step = Math.max(1, Math.round(target / 80));
        const interval = setInterval(() => {
          current += step;
          if (current >= target) {
            current = target;
            clearInterval(interval);
          }
          el.textContent = current;
        }, 20);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.6 });
  statNumbers.forEach((el) => observer.observe(el));

  const swiper = new Swiper('.results-swiper', {
    slidesPerView: 1.2,
    spaceBetween: 18,
    loop: true,
    autoplay: { delay: 2500, disableOnInteraction: false },
    breakpoints: {
      768: { slidesPerView: 2.2 }
    }
  });

  const swiperEl = document.querySelector('.results-swiper');
  if (swiperEl) {
    swiperEl.addEventListener('mouseenter', () => {
      swiper.autoplay.stop();
    });
    swiperEl.addEventListener('mouseleave', () => {
      swiper.autoplay.start();
    });
  }

  const magnifyContainers = document.querySelectorAll('.magnify-container');
  magnifyContainers.forEach((container) => {
    const img = container.querySelector('.magnify-image');
    const lens = container.querySelector('.magnifier-lens');
    const zoom = 1.7;

    const moveLens = (e) => {
      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const lensRadius = lens.offsetWidth / 2;
      let lensX = x - lensRadius;
      let lensY = y - lensRadius;
      if (lensX < 0) lensX = 0;
      if (lensY < 0) lensY = 0;
      if (lensX > rect.width - lens.offsetWidth) lensX = rect.width - lens.offsetWidth;
      if (lensY > rect.height - lens.offsetHeight) lensY = rect.height - lens.offsetHeight;
      lens.style.left = lensX + 'px';
      lens.style.top = lensY + 'px';
      lens.style.backgroundImage = `url(${img.src})`;
      lens.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
      lens.style.backgroundPosition = `-${x * zoom - lensRadius}px -${y * zoom - lensRadius}px`;
    };

    container.addEventListener('mouseenter', () => {
      lens.style.display = 'block';
    });
    container.addEventListener('mouseleave', () => {
      lens.style.display = 'none';
    });
    container.addEventListener('mousemove', moveLens);

    container.addEventListener('click', () => {
      openLightbox(img.src);
    });
  });

  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox hidden';
  lightbox.innerHTML = '<div class="lightbox-backdrop"></div><div class="lightbox-content"><img /><span class="lightbox-close">×</span></div>';
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector('img');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const backdrop = lightbox.querySelector('.lightbox-backdrop');

  function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.classList.remove('hidden');
  }

  function closeLightbox() {
    lightbox.classList.add('hidden');
  }

  closeBtn.addEventListener('click', closeLightbox);
  backdrop.addEventListener('click', closeLightbox);

  const testContainer = document.getElementById('testContainer');
  const progressBar = document.getElementById('progressBar');
  const testResult = document.getElementById('testResult');
  const testTitleEl = document.getElementById('testTitle');
  const testMetaEl = document.getElementById('testMeta');
  const testPdfFrame = document.getElementById('testPdfFrame');
  const testCards = document.querySelectorAll('.test-card-btn');
  const questionBadges = document.getElementById('questionBadges');
  const answerControls = document.getElementById('answerControls');
  const answerButtons = answerControls ? answerControls.querySelectorAll('.answer-btn') : [];
  const answerInfo = document.getElementById('answerInfo');
  const submitBtn = document.getElementById('submitTestBtn');
  const testVideoWrapper = document.getElementById('testVideoWrapper');
  const testVideoFrame = document.getElementById('testVideoFrame');

  const goToTestsBtn = document.getElementById('goToTestsBtn');
  if (goToTestsBtn) {
    goToTestsBtn.addEventListener('click', () => {
      const isLoggedIn = window.IS_LOGGED_IN === true || window.IS_LOGGED_IN === 'true';
      if (isLoggedIn) {
        window.location.href = '/tests';
      } else {
        const proceed = confirm('Test ishlash uchun avval kirish yoki ro‘yxatdan o‘tishingiz kerak. Hozir kirish sahifasiga o‘tasizmi?');
        if (proceed) {
          window.location.href = '/auth/login';
        }
      }
    });
  }

  let currentTestId = null;
  let currentClosedCount = 0;
  let currentAnswers = [];
  let currentIndex = 0;

  if (testCards && testCards.length) {
    testCards.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-test-id');
        const title = btn.getAttribute('data-test-title');
        if (!id) return;
        try {
          const res = await fetch(`/tests/api/${id}`);
          if (res.status === 401) {
            alert('Davom etish uchun login yoki ro‘yxatdan o‘ting');
            window.location.href = '/auth/login';
            return;
          }
          const data = await res.json();
          openTest(id, title, data);
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (!currentTestId) return;
      try {
        const res = await fetch(`/tests/api/${currentTestId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: currentAnswers })
        });
        if (res.status === 401) {
          alert('Davom etish uchun login yoki ro‘yxatdan o‘ting');
          window.location.href = '/auth/login';
          return;
        }
        const data = await res.json();
        testResult.textContent = `Natija: ${data.score}% (${data.correct}/${data.totalClosed} to‘g‘ri yopiq savol)`;
        if (data.passed && data.hasVideo && data.videoLink && testVideoWrapper && testVideoFrame) {
          testVideoWrapper.classList.remove('hidden');
          testVideoFrame.src = data.videoLink;
        } else if (testVideoWrapper && testVideoFrame) {
          testVideoWrapper.classList.add('hidden');
          testVideoFrame.src = '';
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  function openTest(id, title, meta) {
    currentTestId = id;
    const total = Number(meta.totalQuestions || 0);
    const closed = Number(meta.closedCount || 0);
    currentClosedCount = closed;
    currentAnswers = new Array(closed).fill('');
    currentIndex = 0;

    if (testTitleEl) testTitleEl.textContent = title || '';
    if (testMetaEl) {
      const parts = [];
      if (total) parts.push(`${total} ta savol`);
      if (closed) parts.push(`${closed} ta yopiq (A/B/C/D) savol`);
      testMetaEl.textContent = parts.join(' · ');
    }

    if (testPdfFrame && meta.pdfLink) {
      testPdfFrame.src = meta.pdfLink;
    }

    renderBadges(closed);
    updateProgress(0, closed);
    if (testContainer) testContainer.classList.remove('hidden');
    if (testResult) testResult.textContent = '';
    if (testVideoWrapper && testVideoFrame) {
      testVideoWrapper.classList.add('hidden');
      testVideoFrame.src = '';
    }
  }

  function renderBadges(count) {
    if (!questionBadges) return;
    questionBadges.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const btn = document.createElement('button');
      btn.className = 'question-badge';
      btn.textContent = i + 1;
      btn.dataset.index = i;
      btn.addEventListener('click', () => {
        setCurrentIndex(i);
      });
      questionBadges.appendChild(btn);
    }
    if (count > 0) {
      setCurrentIndex(0);
    }
  }

  function setCurrentIndex(idx) {
    currentIndex = idx;
    if (!questionBadges || !answerControls) return;
    const badges = questionBadges.querySelectorAll('.question-badge');
    badges.forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.index) === idx);
      const ans = currentAnswers[Number(b.dataset.index)] || '';
      b.classList.toggle('answered', !!ans);
    });
    answerControls.classList.remove('hidden');
    const currentAns = currentAnswers[idx] || '';
    if (answerButtons && answerButtons.length) {
      answerButtons.forEach((btn) => {
        btn.classList.toggle('selected', btn.getAttribute('data-answer') === currentAns);
      });
    }
    if (answerInfo) {
      answerInfo.textContent = `${idx + 1}-savol uchun A/B/C/D variantidan birini tanlang.`;
    }
  }

  if (answerButtons && answerButtons.length) {
    answerButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-answer');
        if (!val) return;
        currentAnswers[currentIndex] = val;
        setCurrentIndex(currentIndex);
        const answeredCount = currentAnswers.filter((a) => !!a).length;
        updateProgress(answeredCount, currentClosedCount);
      });
    });
  }

  function updateProgress(current, total) {
    if (!progressBar) return;
    const percent = total ? (current / total) * 100 : 0;
    progressBar.style.width = percent + '%';
  }
});


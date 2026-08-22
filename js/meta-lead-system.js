(() => {
  const pixelId = '1580816737123369';
  const quiz = document.querySelector('[data-lead-quiz]');
  const scrollTargets = document.querySelectorAll('[data-scroll-target]');
  const whatsappFloat = document.querySelector('.mls-whatsapp-float');
  const whatsappFallback = document.querySelector('[data-whatsapp-fallback]');
  const whatsappAlternative = document.querySelector('[data-whatsapp-alternative]');
  const copyWhatsappNumber = document.querySelector('[data-copy-whatsapp-number]');
  const copyWhatsappStatus = document.querySelector('[data-copy-whatsapp-status]');
  const whatsappNumber = '77089508019';
  let whatsappFallbackTimer = 0;
  let whatsappNavigationPending = false;
  let whatsappClickedAt = 0;

  const createMetaEventId = () => {
    if (typeof window.crypto?.randomUUID === 'function') return window.crypto.randomUUID();
    return `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const pendingMetaEvents = [];
  let metaRetryTimer = 0;

  const getFbq = () => {
    if (typeof window.fbq === 'function') return window.fbq;
    if (typeof window._fbq === 'function') return window._fbq;
    return null;
  };

  const sendMetaEvent = ({ eventName, params, custom, eventOptions }) => {
    const fbq = getFbq();
    if (!fbq) return false;
    const command = custom ? 'trackCustom' : (eventName === 'Lead' ? 'trackSingle' : 'track');
    if (command === 'trackSingle') fbq(command, pixelId, eventName, params, eventOptions);
    else fbq(command, eventName, params, eventOptions);
    return true;
  };

  const flushMetaQueue = () => {
    const now = Date.now();
    while (pendingMetaEvents[0] && now - pendingMetaEvents[0].queuedAt > 15000) {
      const expired = pendingMetaEvents.shift();
      console.warn(`[Meta Pixel] ${expired.eventName} was not sent: fbq unavailable after 15s.`);
    }
    while (pendingMetaEvents.length && sendMetaEvent(pendingMetaEvents[0])) pendingMetaEvents.shift();
    if (!pendingMetaEvents.length) {
      window.clearInterval(metaRetryTimer);
      metaRetryTimer = 0;
    }
  };

  const trackMeta = (eventName, params = {}, custom = false, eventOptions) => {
    const event = { eventName, params, custom, eventOptions, queuedAt: Date.now() };
    if (sendMetaEvent(event)) return true;
    pendingMetaEvents.push(event);
    if (!metaRetryTimer) metaRetryTimer = window.setInterval(flushMetaQueue, 200);
    return false;
  };

  trackMeta('ViewContent', {
    content_name: 'Meta Lead System',
    content_category: 'Lead generation service',
  });

  const armWhatsappFallback = () => {
    if (!whatsappFallback) return;
    whatsappNavigationPending = true;
    whatsappClickedAt = Date.now();
    whatsappFallback.hidden = true;
    window.clearTimeout(whatsappFallbackTimer);
    scheduleWhatsappFallback();
  };

  const scheduleWhatsappFallback = () => {
    if (!whatsappNavigationPending || !whatsappFallback) return;
    const delay = Math.max(0, 2800 - (Date.now() - whatsappClickedAt));
    whatsappFallbackTimer = window.setTimeout(() => {
      if (!whatsappNavigationPending || document.visibilityState !== 'visible') return;
      whatsappFallback.hidden = false;
    }, delay);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      window.clearTimeout(whatsappFallbackTimer);
      return;
    }
    scheduleWhatsappFallback();
  });

  window.addEventListener('focus', scheduleWhatsappFallback);
  window.addEventListener('pageshow', scheduleWhatsappFallback);

  copyWhatsappNumber?.addEventListener('click', async () => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(whatsappNumber);
      copied = true;
    } catch {
      const input = document.createElement('textarea');
      input.value = whatsappNumber;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.append(input);
      input.select();
      copied = document.execCommand('copy');
      input.remove();
    }
    copyWhatsappStatus.textContent = copied ? 'Номер скопирован: +7 708 950 80 19' : 'Номер: +7 708 950 80 19';
  });

  whatsappFloat?.addEventListener('click', () => {
    const eventId = createMetaEventId();
    trackMeta('Lead', {
      content_name: 'floating_whatsapp_cta',
      contact_method: 'WhatsApp',
      source: 'floating_button',
    }, false, { eventID: eventId });
    const floatMessage = new URL(whatsappFloat.href).searchParams.get('text') || '';
    whatsappAlternative.href = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(floatMessage)}`;
    armWhatsappFallback();
  });

  scrollTargets.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      const target = document.querySelector(trigger.getAttribute('data-scroll-target'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(() => target.querySelector('input')?.focus({ preventScroll: true }), 500);
    });
  });

  if (quiz) {
    const steps = Array.from(quiz.querySelectorAll('[data-quiz-step]'));
    const backButton = quiz.querySelector('[data-quiz-back]');
    const actions = quiz.querySelector('.mls-quiz__actions');
    const result = quiz.querySelector('[data-quiz-result]');
    const whatsappButton = quiz.querySelector('[data-quiz-whatsapp]');
    const progress = quiz.querySelector('[data-quiz-progress]');
    const progressBar = quiz.querySelector('[data-quiz-progress-bar]');
    const resultTitle = quiz.querySelector('[data-quiz-result-title]');
    const resultCopy = quiz.querySelector('[data-quiz-result-copy]');
    const customAnswer = quiz.querySelector('[data-quiz-custom-answer]');
    const customAnswerInput = quiz.elements['product-other'];
    let currentStep = 0;
    let started = false;
    let leadTracked = false;
    let quizLeadEventId = '';
    let advanceTimer = 0;
    let isAdvancing = false;

    const track = (eventName, params = {}) => {
      window.dataLayer?.push({ event: eventName, ...params });
      window.gtag?.('event', eventName, params);
    };

    const selectedValue = (step) => step.querySelector('input:checked')?.value;

    const hasCurrentAnswer = () => {
      const value = selectedValue(steps[currentStep]);
      if (currentStep === 0 && value === 'Другое') return Boolean(customAnswerInput.value.trim());
      return Boolean(value);
    };

    const renderStep = () => {
      steps.forEach((step, index) => {
        const active = index === currentStep;
        step.hidden = !active;
        step.setAttribute('aria-hidden', String(!active));
      });

      progress.textContent = `Шаг ${currentStep + 1} из ${steps.length}`;
      progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
      backButton.hidden = currentStep === 0;
      actions.hidden = currentStep === 0;
      customAnswer.hidden = selectedValue(steps[0]) !== 'Другое';
    };

    const revealResult = () => {
      const leadOwner = quiz.elements['lead-owner'].value;
      const needsOwner = leadOwner === 'Пока некому отвечать';
      const answers = [
        ['Что привлекаем', quiz.elements.product.value === 'Другое' ? customAnswerInput.value.trim() : quiz.elements.product.value],
        ['Ценность нового клиента', quiz.elements['client-value'].value],
        ['Текущий источник заявок', quiz.elements['lead-source'].value],
        ['Кто отвечает', leadOwner],
      ];

      steps.forEach((step) => { step.hidden = true; });
      actions.hidden = true;
      progress.parentElement.hidden = true;
      result.hidden = false;
      whatsappButton.hidden = false;
      whatsappButton.setAttribute('aria-disabled', 'false');

      if (needsOwner) {
        resultTitle.textContent = 'Сначала назначьте ответственного за обращения.';
        resultCopy.textContent = 'Связку можно подготовить, но без быстрого ответа на заявки реклама будет терять часть обращений. Обсудим, как выстроить этот этап до запуска.';
      }

      const message = [
        'Здравствуйте! Хочу обсудить Meta Lead System.',
        '',
        ...answers.map(([label, value]) => `${label}: ${value}`),
        '',
        'Понимаю условия: 149 990 ₸ в месяц, рекламный бюджет оплачивается отдельно.',
        'Хочу обсудить запуск.',
      ].join('\n');

      whatsappButton.href = `https://wa.me/77089508019?text=${encodeURIComponent(message)}`;
      whatsappAlternative.href = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}`;
      result.focus({ preventScroll: true });
      track('mls_quiz_price_viewed', { lead_owner_ready: !needsOwner });
    };

    const advance = () => {
      if (isAdvancing || !hasCurrentAnswer()) return;
      isAdvancing = true;
      window.clearTimeout(advanceTimer);
      track('mls_quiz_step_completed', { step: currentStep + 1 });
      trackMeta('MLSQuizStepCompleted', { step: currentStep + 1 }, true);

      if (currentStep === steps.length - 1) {
        revealResult();
        trackMeta('MLSQuizCompleted', {}, true);
        if (!leadTracked) {
          leadTracked = true;
          quizLeadEventId = createMetaEventId();
          trackMeta('Lead', {
            content_name: 'quiz_completed',
            contact_method: 'WhatsApp',
            source: 'qualification_quiz',
          }, false, { eventID: quizLeadEventId });
        }
        return;
      }

      currentStep += 1;
      renderStep();
      window.setTimeout(() => {
        isAdvancing = false;
        steps[currentStep].querySelector('input')?.focus({ preventScroll: true });
      }, 180);
    };

    const scheduleAdvance = (delay = 260) => {
      window.clearTimeout(advanceTimer);
      advanceTimer = window.setTimeout(advance, delay);
    };

    quiz.addEventListener('focusin', () => {
      if (started) return;
      started = true;
      track('mls_quiz_started');
      trackMeta('MLSQuizStarted', {}, true);
    });

    quiz.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener('change', () => {
        renderStep();
        if (currentStep === 0 && input.value === 'Другое') {
          customAnswerInput.focus({ preventScroll: true });
          return;
        }
        scheduleAdvance();
      });
    });

    customAnswerInput.addEventListener('input', () => {
      renderStep();
      if (customAnswerInput.value.trim().length >= 2) scheduleAdvance(900);
      else window.clearTimeout(advanceTimer);
    });

    backButton.addEventListener('click', () => {
      if (currentStep === 0) return;
      window.clearTimeout(advanceTimer);
      isAdvancing = false;
      currentStep -= 1;
      renderStep();
    });

    whatsappButton.addEventListener('click', () => {
      track('mls_quiz_whatsapp_clicked');
      if (quizLeadEventId) {
        trackMeta('Lead', {
          content_name: 'quiz_completed',
          contact_method: 'WhatsApp',
          source: 'qualification_quiz',
        }, false, { eventID: quizLeadEventId });
        flushMetaQueue();
      }
      armWhatsappFallback();
    });

    renderStep();
  }

  if (!window.gsap || !window.ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  window.gsap.registerPlugin(window.ScrollTrigger);
  document.documentElement.classList.add('gsap-enabled');
  const mm = window.gsap.matchMedia();

  const heroTimeline = window.gsap.timeline({
    defaults: { duration: .72, ease: 'power3.out' },
  });
  heroTimeline
    .fromTo('.mls-hero .mls-label', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0 })
    .fromTo('.mls-hero h1', { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0 }, '<.08')
    .fromTo('.mls-hero__lead', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0 }, '<.18')
    .fromTo('.mls-hero__actions, .mls-hero__tools', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, stagger: .1 }, '<.16');

  window.gsap.utils.toArray('.mls-animate').forEach((element) => {
    window.gsap.fromTo(element, { autoAlpha: 0, y: 26 }, {
      autoAlpha: 1,
      y: 0,
      duration: .72,
      ease: 'power3.out',
      scrollTrigger: { trigger: element, start: 'top 86%', toggleActions: 'play none none reverse' },
    });
  });

  mm.add('(min-width: 821px)', () => {
    const rows = window.gsap.utils.toArray('.mls-flow__row');
    window.gsap.fromTo(rows, { autoAlpha: .28, x: -18 }, {
      autoAlpha: 1,
      x: 0,
      stagger: .12,
      duration: .58,
      ease: 'power2.out',
      scrollTrigger: { trigger: '.mls-flow__rows', start: 'top 72%', toggleActions: 'play none none reverse' },
    });
  });

  window.addEventListener('load', () => window.ScrollTrigger.refresh(), { once: true });
})();

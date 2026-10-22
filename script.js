(() => {
  'use strict';
  document.documentElement.classList.add('js-enabled');
  const menu = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#navigation');
  menu.hidden = false;
  function closeMenu() { menu.setAttribute('aria-expanded', 'false'); navigation.classList.remove('open'); }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open)); navigation.classList.toggle('open', open);
  });
  navigation.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
  window.matchMedia('(min-width:761px)').addEventListener('change', closeMenu);

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const carousels = [...document.querySelectorAll('.platform-grid')].map((row, index) => {
    row.tabIndex = 0;
    row.setAttribute('role', 'region');
    row.setAttribute('aria-label', row.previousElementSibling.textContent + '; scroll horizontally');
    const originals = [...row.children];
    const state = {row, originals, cycle: 0, hover: false, focus: false, touch: false, visible: false, resumeAt: 0};
    const rebuild = () => {
      row.querySelectorAll('[data-carousel-copy]').forEach(copy => copy.remove());
      const addCopies = () => originals.forEach(item => {
        const copy = item.cloneNode(true);
        copy.dataset.carouselCopy = 'true';
        copy.setAttribute('aria-hidden', 'true');
        row.append(copy);
      });
      // Fill wide viewports before duplicating the loop, including the five-tool row.
      for (let copies = 0; row.scrollWidth <= row.clientWidth + 160 && copies < 20; copies++) addCopies();
      const segment = [...row.children];
      segment.forEach(item => {
        const copy = item.cloneNode(true);
        copy.dataset.carouselCopy = 'true'; copy.setAttribute('aria-hidden', 'true'); row.append(copy);
      });
      state.cycle = row.children[segment.length].offsetLeft - row.children[0].offsetLeft;
      row.scrollLeft = 0;
    };
    rebuild();
    let previousWidth = 0;
    new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width !== previousWidth) { previousWidth = width; rebuild(); }
    }).observe(row);
    new IntersectionObserver(([entry]) => { state.visible = entry.isIntersecting; scheduleTools(); }).observe(row);
    row.addEventListener('mouseenter', () => state.hover = true);
    row.addEventListener('mouseleave', () => { state.hover = false; scheduleTools(); });
    row.addEventListener('focusin', () => state.focus = true);
    row.addEventListener('focusout', () => { state.focus = false; scheduleTools(); });
    row.addEventListener('pointerdown', () => state.touch = true);
    const release = () => { state.touch = false; state.resumeAt = performance.now() + 2500; scheduleTools(); };
    window.addEventListener('pointerup', release);
    row.addEventListener('pointercancel', release);
    row.addEventListener('wheel', () => { state.resumeAt = performance.now() + 2500; scheduleTools(); }, {passive:true});
    state.speed = 22 + index * 3;
    return state;
  });
  let lastFrame = 0, toolsFrame = 0, toolsTimer = 0;
  function scheduleTools() {
    if (toolsFrame) cancelAnimationFrame(toolsFrame);
    clearTimeout(toolsTimer); toolsFrame = 0; lastFrame = 0;
    if (document.hidden || motionPreference.matches) return;
    const eligible = carousels.filter(s => s.visible && !s.hover && !s.focus && !s.touch && s.cycle);
    if (!eligible.length) return;
    const delay = Math.max(0, Math.min(...eligible.map(s => s.resumeAt)) - performance.now());
    if (delay) toolsTimer = setTimeout(scheduleTools, delay + 10);
    else toolsFrame = requestAnimationFrame(advanceTools);
  }
  function advanceTools(now) {
    toolsFrame = 0;
    const elapsed = lastFrame ? Math.min(now - lastFrame, 50) / 1000 : 0;
    lastFrame = now;
    let moving = false;
    if (!document.hidden && !motionPreference.matches) carousels.forEach(state => {
      if (!state.visible || state.hover || state.focus || state.touch || now < state.resumeAt || !state.cycle) return;
      moving = true;
      state.row.scrollLeft += elapsed * state.speed;
      if (state.row.scrollLeft >= state.cycle) state.row.scrollLeft -= state.cycle;
    });
    if (moving) toolsFrame = requestAnimationFrame(advanceTools);
    else scheduleTools();
  }
  document.addEventListener('visibilitychange', scheduleTools);
  motionPreference.addEventListener('change', scheduleTools);
  const slider = document.querySelector('#article-slider');
  if (slider) {
    const buttons = [...document.querySelectorAll('[data-article-direction]')];
    const syncButtons = () => buttons.forEach(button => {
      button.disabled = Number(button.dataset.articleDirection) < 0 ? slider.scrollLeft < 2 : slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 2;
    });
    buttons.forEach(button => button.addEventListener('click', () => {
      const step = slider.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(slider).gap);
      slider.scrollBy({left:Number(button.dataset.articleDirection) * step, behavior:motionPreference.matches ? 'instant' : 'smooth'});
    }));
    slider.addEventListener('scroll', syncButtons, {passive:true});
    new ResizeObserver(syncButtons).observe(slider); syncButtons();
  }

  const backTop = document.querySelector('.back-top');
  const about = document.querySelector('#about') || document.querySelector('.library-hero');
  let scrollQueued = false;
  function updateBackTop() { backTop.hidden = about.getBoundingClientRect().bottom >= 0; scrollQueued = false; }
  window.addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateBackTop); } }, {passive:true});
  window.addEventListener('resize', updateBackTop); updateBackTop();

  // Local-only hooks. No analytics request is made here. A consent-aware analytics
  // integration can subscribe to these events later; never include form contents.
  function record(name, detail = {}) { document.dispatchEvent(new CustomEvent('portfolio:interaction', {detail:{name,...detail}})); }
  document.querySelectorAll('.article-link').forEach(link => link.addEventListener('click', () => record('article_click', {articleId:link.href.split('/').pop()})));
  document.querySelectorAll('a[href^="mailto:"]').forEach(link => link.addEventListener('click', () => record('email_click')));
  const search = document.querySelector('#article-search');
  if (search) {
    const cards = [...document.querySelectorAll('[data-topic]')];
    const filters = [...document.querySelectorAll('[data-filter]')];
    const searchable = new Map(cards.map(card => [card, card.textContent.toLowerCase()]));
    let topic = 'all';
    const filterArticles = () => {
      const query = search.value.trim().toLowerCase();
      let total = 0;
      cards.forEach(card => {
        const match = (topic === 'all' || card.dataset.topic === topic) && searchable.get(card).includes(query);
        card.hidden = !match; if (match) total++;
      });
      document.querySelector('#article-count').textContent = `${total} of ${cards.length} articles`;
      document.querySelector('#empty-results').hidden = total > 0;
    };
    search.addEventListener('input', filterArticles);
    filters.forEach(button => button.addEventListener('click', () => {
      topic = button.dataset.filter;
      filters.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      filterArticles();
    }));
  }
  const form = document.querySelector('#contact-form');
  if (!form) return;
  const status = document.querySelector('#form-status');
  const submit = form.querySelector('[type="submit"]');
  const submitLabel = submit.innerHTML;
  let started = false, pending = false;
  const endpoint = (window.PORTFOLIO_CONFIG || {}).contactEndpoint || '';
  form.addEventListener('input', () => {
    if (!started) { started = true; record('contact_start'); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    if (!endpoint) { status.textContent = 'Email delivery is not connected yet. Please email contact@jayisamaliya.in directly.'; return; }
    if (!/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(endpoint)) {
      status.textContent = 'The form is temporarily unavailable. Please email contact@jayisamaliya.in.'; return;
    }
    pending = true;
    const data = new URLSearchParams(new FormData(form));
    if (data.get('website')) { pending = false; return; }
    data.delete('website');
    // Lock editable fields while sending, so a successful response cannot erase new text.
    const fields = [...form.querySelectorAll('input,textarea')]; fields.forEach(field => field.readOnly = true);
    submit.disabled = true; submit.textContent = 'Sending…'; status.textContent = 'Sending your message…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(endpoint, {method:'POST', headers:{Accept:'application/json'}, body:data, signal:controller.signal, redirect:'follow', credentials:'omit'});
      if (!response.ok) throw new Error('request_failed');
      const result = await response.json();
      if (result.errors || result.ok === false) throw new Error('not_accepted');
      status.textContent = 'Thanks—your message has been accepted. I’ll reply by email.';
      record('contact_success'); form.reset(); started = false;
    } catch {
      status.textContent = 'We couldn’t confirm your message was sent. Your text is saved here—please retry or email contact@jayisamaliya.in.';
      record('contact_error');
    } finally {
      clearTimeout(timeout); pending = false; fields.forEach(field => field.readOnly = false);
      submit.disabled = false; submit.innerHTML = submitLabel;
    }
  });
})();

(() => {
  'use strict';
  document.documentElement.classList.add('js-enabled');
  const menu = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#navigation');
  menu.hidden = false;
  menu.setAttribute('aria-label', 'Open menu');
  function closeMenu() { menu.setAttribute('aria-label', 'Open menu'); menu.setAttribute('aria-expanded', 'false'); navigation.classList.remove('open'); }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-expanded', String(open)); navigation.classList.toggle('open', open);
  });
  navigation.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
  window.matchMedia('(min-width:1025px)').addEventListener('change', closeMenu);

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const carousels = [...document.querySelectorAll('.platform-grid')].map((row, index) => {
    row.tabIndex = 0;
    row.setAttribute('role', 'region');
    row.setAttribute('aria-label', row.previousElementSibling.textContent + '; scroll horizontally');
    const originals = [...row.children];
    const state = {row, originals, cycle: 0, position: 0, hover: false, focus: false, touch: false, visible: false, resumeAt: 0};
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
      state.position = 0;
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
      // Keep fractional progress independently: Safari can round scrollLeft writes.
      if (Math.abs(state.row.scrollLeft - state.position) > 2) state.position = state.row.scrollLeft;
      state.position = (state.position + elapsed * state.speed) % state.cycle;
      state.row.scrollLeft = state.position;
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

  // Only event metadata is queued. Never include visitor-entered values.
  function record(event, detail = {}) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({event, page_path: location.pathname, ...detail});
    document.dispatchEvent(new CustomEvent('portfolio:interaction', {detail:{name:event,...detail}}));
  }
  function trackLink(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const link = event.target.closest('a[href]');
    if (!link) return;
    const section = link.closest('section,header,footer');
    record('link_clicks', {
      click_text: (link.getAttribute('aria-label') || link.textContent).trim().replace(/\s+/g, ' '),
      click_url: link.href,
      link_section: section ? (section.id || section.getAttribute('aria-label') || (section.matches('header') ? 'Header' : section.matches('footer') ? 'Footer' : 'Banner')) : 'Page'
    });
  }
  document.addEventListener('click', trackLink);
  document.addEventListener('auxclick', trackLink);
  // Visible time on this page load. Background time is excluded.
  let engagement = {seconds:0, fired:[]};
  let timeMark = performance.now();
  let wasVisible = !document.hidden;
  function updateTime() {
    const now = performance.now();
    if (wasVisible) engagement.seconds += (now - timeMark) / 1000;
    timeMark = now; wasVisible = !document.hidden;
    [60,120,300].forEach(seconds => {
      if (engagement.seconds >= seconds && !engagement.fired.includes(seconds)) {
        engagement.fired.push(seconds);
        record('time_on_site', {time_seconds:seconds, time_minutes:seconds / 60});
      }
    });
  }
  setInterval(updateTime, 1000);
  document.addEventListener('visibilitychange', updateTime);
  window.addEventListener('pagehide', updateTime);
  window.addEventListener('pageshow', () => { timeMark = performance.now(); wasVisible = !document.hidden; });
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
  const formEvent = (event, detail = {}) => record(event, {form_id:form.id, ...detail});
  const seenFields = new Set();
  const isField = field => field.matches('input:not([name="website"]),textarea');
  form.addEventListener('focusin', event => {
    if (isField(event.target) && !started) { started = true; formEvent('form_start', {field_name:event.target.name}); }
  });
  form.addEventListener('input', event => {
    const field = event.target;
    if (!isField(field)) return;
    if (!started) { started = true; formEvent('form_start', {field_name:field.name}); }
    if (field.value.trim() && !seenFields.has(field.name)) {
      seenFields.add(field.name); formEvent('form_field', {field_name:field.name});
    }
  });
  const formObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.intersectionRatio >= .5)) {
      formEvent('form_view'); formObserver.disconnect();
    }
  }, {threshold:.5});
  formObserver.observe(form);
  let validationQueued = false;
  form.addEventListener('invalid', () => {
    if (validationQueued) return;
    validationQueued = true;
    status.textContent = 'Please check the highlighted fields and try again.';
    formEvent('form_failed', {error_type:'validation'});
    setTimeout(() => validationQueued = false, 0);
  }, true);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    if (!endpoint) { status.textContent = 'Email delivery is not connected yet. Please email contact@jayisamaliya.in directly.'; formEvent('form_failed', {error_type:'configuration'}); return; }
    if (!/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(endpoint)) {
      status.textContent = 'The form is temporarily unavailable. Please email contact@jayisamaliya.in.'; formEvent('form_failed', {error_type:'configuration'}); return;
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
      formEvent('form_submit'); form.reset(); started = false; seenFields.clear();
    } catch {
      status.textContent = 'We couldn’t confirm your message was sent. Your text is saved here—please retry or email contact@jayisamaliya.in.';
      formEvent('form_failed', {error_type:'submission'});
    } finally {
      clearTimeout(timeout); pending = false; fields.forEach(field => field.readOnly = false);
      submit.disabled = false; submit.innerHTML = submitLabel;
    }
  });
})();

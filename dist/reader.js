// Fixed-height pages use CSS column fragmentation, never scroll offsets.
(() => {
  const readers = new Map();
  let scheduled = false;
  function layoutSoon() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; layout(); });
  }
  function attach(root) {
    let reader = readers.get(root);
    if (reader && root.contains(reader.viewport)) return reader;
    const previousPage = root.dataset.folioStart === undefined ? (reader?.page || 0) : Number(root.dataset.folioStart);
    delete root.dataset.folioStart;
    const content = document.createElement('div');
    content.className = 'folio-content';
    while (root.firstChild) content.append(root.firstChild);
    const viewport = document.createElement('div');
    viewport.className = 'folio-viewport';
    viewport.append(content);
    const controls = document.createElement('nav');
    controls.className = 'folio-controls';
    controls.setAttribute('aria-label', 'ページ切り替え');
    const previous = document.createElement('button');
    previous.textContent = '前へ';
    previous.setAttribute('aria-label', '前のページ');
    const counter = document.createElement('span');
    counter.setAttribute('aria-live', 'polite');
    const next = document.createElement('button');
    next.textContent = '次へ';
    next.setAttribute('aria-label', '次のページ');
    controls.append(previous, counter, next);
    root.classList.add('folio');
    root.append(viewport, controls);
    reader = {root, content, viewport, previous, next, counter, page: previousPage, count: 1, width: 0};
    readers.set(root, reader);
    previous.onclick = () => show(reader, reader.page - 1);
    next.onclick = () => show(reader, reader.page + 1);
    root.addEventListener('keydown', e => {
      if (e.target.matches('input,textarea,select')) return;
      if (e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault();show(reader, reader.page + (e.key === 'PageDown' ? 1 : -1));
      }
    });
    // A focused control on another page must be revealed without native scrolling.
    root.addEventListener('focusin', e => {
      if (!content.contains(e.target)) return;
      const x = e.target.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
      const page = reader.page + Math.floor((x + 1) / (reader.width + 24));
      show(reader, page);
    });
    return reader;
  }
  function show(r, page) {
    r.page = Math.max(0, Math.min(r.count - 1, page));
    r.root.dataset.folioPage = String(r.page);
    const transform = `translateX(${-r.page * (r.width + 24)}px)`;
    if (r.content.style.transform !== transform) r.content.style.transform = transform;
    const text = `${r.page + 1} / ${r.count}`;
    if (r.counter.textContent !== text) r.counter.textContent = text;
    r.previous.disabled = r.page === 0;
    r.next.disabled = r.page >= r.count - 1;
  }
  function layout() {
    mutation.disconnect();
    // A full-width tutorial leaves enough room for comfortably sized text.
    const guide = document.querySelector('.practice-guide');
    if (guide && guide.parentElement.id === 'play-column') document.querySelector('#app').prepend(guide);
    document.querySelectorAll('#play-column>.wrap').forEach(wrap => {
      const panel = wrap.querySelector('#panel');
      const scene = panel?.querySelector('.selected-scene');
      if (scene) {
        wrap.querySelector(':scope>.selected-scene')?.remove();
        panel.before(scene);
      }
    });
    const roots = document.querySelectorAll('#panel, #reference-panel, #modal[open] #modal-body, .dialogue-box>p, #app>.reading');
    for (const [root] of readers) if (!root.isConnected) readers.delete(root);
    for (const root of roots) {
      const r = attach(root);
      r.width = r.viewport.clientWidth;
      const height = r.viewport.clientHeight;
      if (!r.width || !height) continue;
      r.content.style.width = `${r.width}px`;
      r.content.style.height = `${height}px`;
      r.content.style.columnWidth = `${r.width}px`;
      r.count = Math.max(1, Math.ceil((r.content.scrollWidth + 24 - 1) / (r.width + 24)));
      show(r, r.page);
    }
    mutation.observe(document.body, {childList: true, subtree: true, characterData: true});
  }
  const mutation = new MutationObserver(layoutSoon);
  mutation.observe(document.body, {childList: true, subtree: true, characterData: true});
  new ResizeObserver(layoutSoon).observe(document.querySelector('#app'));
  window.addEventListener('resize', layoutSoon);
  document.addEventListener('click', layoutSoon);
  document.addEventListener('folio:reveal', event => {
    layout();
    const target = document.querySelector(event.detail.selector);
    const root = target?.closest('.folio');
    const r = readers.get(root);
    if (!target || !r || !r.width) return;
    const x = target.getBoundingClientRect().left - r.viewport.getBoundingClientRect().left;
    show(r, r.page + Math.floor((x + 1) / (r.width + 24)));
  });
  document.fonts.ready.then(layoutSoon);
  layoutSoon();
})();

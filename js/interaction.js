/**
 * Canvas 交互系统 — 鼠标/触摸处理 + 面板联动
 *
 * 职责：
 *   - 鼠标追踪（归一化坐标，驱动视差）
 *   - Hit-test（反向 z-order 检测 Canvas 对象点击/悬停）
 *   - Hover 态管理 + tooltip 显示
 *   - 点击分发 → 面板系统
 *   - 触摸事件支持
 *   - 与 RoomEngine 的双向绑定
 */

const Interaction = (() => {
  // ---- 内部状态 ----
  let mouseX = 0;       // 归一化 -1..1
  let mouseY = 0;       // 归一化 -1..1
  let smoothX = 0;      // 缓动后
  let smoothY = 0;
  let hoveredId = null;
  let canvasEl = null;
  let tooltipEl = null;
  let hintEl = null;
  let activePanelId = null;

  // ---- 初始化 ----
  function init() {
    canvasEl = RoomEngine.getCanvas();
    tooltipEl = document.getElementById('tooltip');
    hintEl = document.getElementById('hint');
    if (!canvasEl) return;

    // --- 鼠标事件 ---
    canvasEl.addEventListener('mousemove', onMouseMove, { passive: true });
    canvasEl.addEventListener('mouseleave', onMouseLeave);
    canvasEl.addEventListener('click', onClick);
    canvasEl.addEventListener('dblclick', onDblClick);

    // --- 触摸事件 ---
    canvasEl.addEventListener('touchmove', onTouchMove, { passive: true });
    canvasEl.addEventListener('touchend', onTouchEnd);

    // --- 绑定引擎回调 ---
    RoomEngine.setHoverCallback(onEngineHover);
    RoomEngine.setClickCallback(onEngineClick);

    // --- 面板关闭 ---
    document.querySelectorAll('.panel-close').forEach(btn => {
      btn.addEventListener('click', closeActivePanel);
    });
    document.querySelectorAll('.panel-backdrop').forEach(bd => {
      bd.addEventListener('click', closeActivePanel);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeActivePanel();
    });
    document.querySelectorAll('.panel-card').forEach(card => {
      card.addEventListener('click', e => e.stopPropagation());
    });

    // --- 启动缓动循环 ---
    requestAnimationFrame(smoothLoop);
  }

  // ============================================================
  // 坐标计算
  // ============================================================
  function updateNormCoords(clientX, clientY) {
    const design = RoomEngine.clientToDesign(clientX, clientY);
    const ds = RoomEngine.getDesignSize();
    // 归一化到 -1..1
    mouseX = (design.x / ds.w) * 2 - 1;
    mouseY = (design.y / ds.h) * 2 - 1;
  }

  // ============================================================
  // Hit Test
  // ============================================================
  function hitTest(designX, designY) {
    const objects = RoomEngine.getSceneObjects();
    // 反向 z-order：前景优先
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (!obj.interactive) continue;
      if (designX >= obj.x && designX <= obj.x + obj.w &&
          designY >= obj.y && designY <= obj.y + obj.h) {
        return obj;
      }
    }
    return null;
  }

  // ============================================================
  // Tooltip
  // ============================================================
  function showTooltip(obj, clientX, clientY) {
    if (!tooltipEl || !obj || !obj.label) return;
    tooltipEl.textContent = obj.label;
    tooltipEl.classList.remove('hidden');
    tooltipEl.style.left = clientX + 'px';
    tooltipEl.style.top = (clientY - 36) + 'px';
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.add('hidden');
  }

  // ============================================================
  // 面板管理
  // ============================================================
  function openPanel(panelId) {
    if (activePanelId === panelId) return;
    if (activePanelId) closeActivePanelImmediate();

    const panel = document.getElementById(panelId);
    if (!panel) return;

    activePanelId = panelId;
    panel.classList.add('active');
    RoomEngine.setPanelOpen(true);
    if (hintEl) hintEl.style.opacity = '0';
    hideTooltip();
    RoomEngine.clearAllHovered();

    // 加载内容
    loadPanelContent(panelId);
  }

  function closeActivePanel() {
    if (!activePanelId) return;
    const panel = document.getElementById(activePanelId);
    if (!panel) return;

    panel.classList.remove('active');
    activePanelId = null;
    RoomEngine.setPanelOpen(false);
    if (hintEl) hintEl.style.opacity = '';
  }

  function closeActivePanelImmediate() {
    if (!activePanelId) return;
    const panel = document.getElementById(activePanelId);
    if (panel) panel.classList.remove('active');
    activePanelId = null;
    RoomEngine.setPanelOpen(false);
    if (hintEl) hintEl.style.opacity = '';
  }

  // ============================================================
  // 面板内容加载（复用 DataLoader + Gallery）
  // ============================================================
  async function loadPanelContent(panelId) {
    const target = panelId.replace('-panel', '');
    // 留言板是静态内容，跳过加载
    if (target === 'messages') return;

    const contentEl = document.querySelector(`#${panelId} .panel-inner`);
    if (!contentEl) return;

    contentEl.innerHTML = '<div class="panel-loading">正在翻阅...</div>';

    try {
      let html = '';
      switch (target) {
        case 'about':        html = await renderAbout();        break;
        case 'photography':  html = await renderPhotography();  break;
        case 'design':       html = await renderDesign();       break;
        case 'social':       html = await renderSocial();       break;
        default:             html = '<p class="panel-error">未知的面板类型</p>';
      }
      contentEl.innerHTML = html;

      if (target === 'photography' || target === 'design') {
        bindFilterEvents(contentEl, target);
      }
    } catch (err) {
      console.error(`Failed to load ${target}:`, err);
      contentEl.innerHTML = `<p class="panel-error">加载失败，请检查 data/${target}.json</p>`;
    }
  }

  // ---- 渲染 About ----
  async function renderAbout() {
    const data = await DataLoader.load('about');
    const avatarHtml = data.avatar
      ? `<img src="${data.avatar}" alt="${data.name}" class="about-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
      : '';
    const placeholderHtml = !data.avatar
      ? `<div class="about-avatar-placeholder">${(data.name||'?')[0]}</div>`
      : `<div class="about-avatar-placeholder" style="display:none;">${(data.name||'?')[0]}</div>`;
    const timelineHtml = (data.timeline||[]).map(t =>
      `<div class="timeline-item"><div class="timeline-year">${t.year}</div><div class="timeline-event">${t.event}</div></div>`
    ).join('');
    const detailHtml = (data.detail||'').split('\n').filter(p=>p.trim()).map(p=>`<p style="margin-bottom:12px;">${p}</p>`).join('');
    return `
      <div class="about-header">${avatarHtml}${placeholderHtml}<div><div class="about-name">${data.name}</div><div class="about-bio">${data.bio}</div></div></div>
      <hr class="panel-divider"><div class="about-detail">${detailHtml}</div>
      ${timelineHtml?`<hr class="panel-divider"><h3 style="font-family:var(--font-display);font-size:1.1rem;color:var(--color-wood-dark);margin-bottom:12px;">个人历程</h3><div class="timeline">${timelineHtml}</div>`:''}`;
  }

  // ---- 渲染 Photography ----
  async function renderPhotography() {
    const data = await DataLoader.load('photography');
    const collections = data.collections || [];
    let html = '<h2 class="panel-title">摄影作品</h2><p class="panel-subtitle">Photography Collections</p>';
    html += '<div class="cover-wall" id="photography-grid">';
    collections.forEach((coll, ci) => {
      const coverHtml = coll.cover
        ? `<img src="${coll.cover}" alt="${coll.title}" class="cover-image" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
        : '';
      const placeholderHtml = !coll.cover
        ? `<div class="cover-placeholder"><span>📷</span><span>${coll.title}</span></div>`
        : `<div class="cover-placeholder" style="display:none;"><span>📷</span><span>${coll.title}</span></div>`;
      const photoCount = (coll.photos||[]).length;
      html += `
        <div class="cover-item" data-collection="${ci}">
          ${coverHtml}${placeholderHtml}
          <div class="cover-caption">摄影集《我与我之间》</div>
        </div>`;
    });
    html += '</div>';
    return html;
  }

  // ---- 渲染 Design ----
  async function renderDesign() {
    const data = await DataLoader.load('design');
    const works = data.works || [];
    const cats = data.categories || [];
    let html = '<h2 class="panel-title">设计作品</h2><p class="panel-subtitle">Design Portfolio</p>';
    if (cats.length>1) {
      html += '<div class="gallery-filters"><button class="gallery-filter active" data-filter="all">全部</button>';
      cats.forEach(c=>{html+=`<button class="gallery-filter" data-filter="${c}">${c}</button>`;});
      html += '</div>';
    }
    html += '<div class="gallery-grid" id="design-grid">';
    works.forEach((w,i)=>{
      const t = w.thumbnail?`<img src="${w.thumbnail}" alt="${w.title}" class="gallery-thumb" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`:'';
      const ph = !w.thumbnail?`<div class="gallery-thumb-placeholder">🎨</div>`:`<div class="gallery-thumb-placeholder" style="display:none;">🎨</div>`;
      html+=`<div class="gallery-item" data-category="${w.category||''}" data-index="${i}">${t}${ph}</div>`;
    });
    html += '</div>';
    return html;
  }

  // ---- 渲染留言板（Cusdis） ----
  function renderMessages() {
    return `
      <h2 class="panel-title">留言板</h2><p class="panel-subtitle">Guest Book</p>
      <div id="cusdis_thread"
        data-host="https://cusdis.com"
        data-app-id="669da4e9-7a66-4955-b6dc-c7b749fb6b28"
        data-page-id="loit-room"
        data-page-url="https://loigency.github.io/my-room"
        data-page-title="一间属于自己的房间">
      </div>
      <p class="msg-cusdis-hint">💬 留言由 Cusdis 提供支持，友善发言哦</p>`;
  }

  // ---- 渲染 Social ----
  async function renderSocial() {
    const data = await DataLoader.load('social');
    const platforms = data.platforms || [];
    const articles = data.featuredArticles || [];
    const iconMap = {wechat:'💬',xiaohongshu:'📕',zhihu:'💡',weibo:'📢',bilibili:'📺',douyin:'🎵',twitter:'🐦',instagram:'📷',default:'🔗'};
    let html = '<h2 class="panel-title">自媒体 & 文章</h2><p class="panel-subtitle">Social Media & Writings</p>';
    if (platforms.length) {
      html += '<h3 style="font-family:var(--font-display);font-size:1rem;color:var(--color-wood-dark);margin-bottom:12px;">找到我</h3><div class="platform-grid">';
      platforms.forEach(p=>{
        const icon = iconMap[p.icon]||iconMap['default'];
        if (p.icon === 'douyin' && p.url === '#') {
          html+=`<div class="platform-card" onclick="document.getElementById('qr-modal').classList.add('active')"><div class="platform-icon" style="background:${p.color||'#000'}1a;color:${p.color||'#000'}">${icon}</div><div><div class="platform-name">${p.name}</div><div class="platform-desc">${p.description||''}</div></div></div>`;
        } else {
          html+=`<a href="${p.url}" class="platform-card" target="_blank" rel="noopener"><div class="platform-icon" style="background:${p.color||'#8B6914'}1a;color:${p.color||'#8B6914'}">${icon}</div><div><div class="platform-name">${p.name}</div><div class="platform-desc">${p.description||''}</div></div></a>`;
        }
      });
      html += '</div>';
    }
    if (articles.length) {
      html += '<hr class="panel-divider"><h3 style="font-family:var(--font-display);font-size:1rem;color:var(--color-wood-dark);margin-bottom:12px;">代表文章</h3><div class="article-list">';
      articles.forEach(a=>{
        html+=`<a href="${a.url}" class="article-item" target="_blank" rel="noopener"><div class="article-title">${a.title}</div><div class="article-meta"><span>${a.date||''}</span><span class="article-platform-tag">${a.platform||''}</span></div>${a.summary?`<div class="article-summary">${a.summary}</div>`:''}</a>`;
      });
      html += '</div>';
    }
    if (!platforms.length && !articles.length) html += '<p class="panel-loading">还没有添加内容，在 data/social.json 中编辑吧</p>';
    return html;
  }

  // ---- 筛选事件绑定 ----
  function bindFilterEvents(container, target) {
    if (target === 'photography') {
      // 摄影集封面墙 — 点击封面打开该合集
      const grid = container.querySelector('#photography-grid');
      if (!grid) return;
      grid.querySelectorAll('.cover-item').forEach(item=>{
        item.addEventListener('click', async e=>{
          e.stopPropagation();
          const ci = parseInt(item.dataset.collection);
          if (!isNaN(ci)) {
            const data = await DataLoader.load('photography');
            const photos = (data.collections||[])[ci]?.photos||[];
            if (photos.length) Gallery.openCollection(photos, 0);
          }
        });
      });
      return;
    }

    // 设计作品 — 分类筛选
    const gridId = 'design-grid';
    const grid = container.querySelector(`#${gridId}`);
    if (!grid) return;
    container.querySelectorAll('.gallery-filter').forEach(btn=>{
      btn.addEventListener('click',()=>{
        container.querySelectorAll('.gallery-filter').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.dataset.filter;
        grid.querySelectorAll('.gallery-item').forEach(item=>{
          item.style.display = (f==='all'||item.dataset.category===f)?'':'none';
        });
      });
    });
    grid.querySelectorAll('.gallery-item').forEach(item=>{
      item.addEventListener('click',e=>{
        e.stopPropagation();
        const idx = parseInt(item.dataset.index);
        if (!isNaN(idx)) Gallery.open(target, idx);
      });
    });
  }

  // ============================================================
  // 事件处理
  // ============================================================
  function onMouseMove(e) {
    if (RoomEngine.isPanelOpen()) return;
    updateNormCoords(e.clientX, e.clientY);
    const design = RoomEngine.clientToDesign(e.clientX, e.clientY);
    const obj = hitTest(design.x, design.y);

    if (obj && obj.id !== hoveredId) {
      if (hoveredId) RoomEngine.setHovered(hoveredId, false);
      RoomEngine.setHovered(obj.id, true);
      hoveredId = obj.id;
      canvasEl.style.cursor = 'pointer';
      showTooltip(obj, e.clientX, e.clientY);
    } else if (!obj && hoveredId) {
      RoomEngine.setHovered(hoveredId, false);
      hoveredId = null;
      canvasEl.style.cursor = 'default';
      hideTooltip();
    } else if (obj) {
      showTooltip(obj, e.clientX, e.clientY);
    }
  }

  function onMouseLeave() {
    if (hoveredId) {
      RoomEngine.setHovered(hoveredId, false);
      hoveredId = null;
    }
    canvasEl.style.cursor = 'default';
    hideTooltip();
    smoothX = 0; smoothY = 0;
    mouseX = 0; mouseY = 0;
  }

  function onClick(e) {
    if (RoomEngine.isPanelOpen()) return;
    const design = RoomEngine.clientToDesign(e.clientX, e.clientY);
    const obj = hitTest(design.x, design.y);
    if (obj && obj.interactive && obj.panel) {
      if (obj.panel === 'tree') { TreeDialog.open(); return; }
      openPanel(obj.panel + '-panel');
    }
  }

  function onDblClick(e) {
    // 双击不做特殊处理，避免误触
  }

  function onTouchMove(e) {
    if (RoomEngine.isPanelOpen()) return;
    if (e.touches.length) {
      updateNormCoords(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  function onTouchEnd(e) {
    if (RoomEngine.isPanelOpen()) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch) return;
    const design = RoomEngine.clientToDesign(touch.clientX, touch.clientY);
    const obj = hitTest(design.x, design.y);
    if (obj && obj.interactive && obj.panel) {
      if (obj.panel === 'tree') { TreeDialog.open(); return; }
      openPanel(obj.panel + '-panel');
    }
  }

  // ---- 引擎回调 ----
  function onEngineHover(obj) {
    if (!obj) {
      canvasEl.style.cursor = 'default';
      hideTooltip();
    }
  }

  function onEngineClick(obj) {
    if (obj && obj.panel) {
      if (obj.panel === 'tree') { TreeDialog.open(); return; }
      openPanel(obj.panel + '-panel');
    }
  }

  // ============================================================
  // 缓动循环（驱动视差平滑）
  // ============================================================
  function smoothLoop() {
    smoothX += (mouseX - smoothX) * 0.06;
    smoothY += (mouseY - smoothY) * 0.06;
    const maxOff = 18;
    RoomEngine.setParallaxOffset(smoothX * maxOff, smoothY * maxOff);
    requestAnimationFrame(smoothLoop);
  }

  // ============================================================
  // 公开 API
  // ============================================================
  return {
    init,
    get mouseX() { return smoothX; },
    get mouseY() { return smoothY; },
    openPanel,
    closeActivePanel,
  };
})();

/**
 * Canvas 房间引擎 — 核心渲染系统
 *
 * 职责：
 *   - 管理场景对象图（Scene Graph）
 *   - 精灵加载与缓存（sprite → Image）
 *   - requestAnimationFrame 渲染循环
 *   - 程序化 placeholder 绘制（用户还没提供素材时）
 *   - Canvas 响应式缩放
 *
 * 设计基准分辨率：1600×900（16:9）
 * 所有对象坐标基于此分辨率，运行时按比例缩放。
 */

const RoomEngine = (() => {
  // ============================================================
  // 色彩方案 — 莫奈：轻盈、透气、被光照亮的
  // 暗部不是黑，是蓝紫灰；亮部是暖奶油/淡粉/淡金；绿色偏灰
  // ============================================================
  const C = {
    // 墙壁 — 暖白，被晨光照亮
    wall:          '#F0E8E0',
    wallUpper:     '#F5EFE8',
    wallLower:     '#E2DCD4',   // 墙裙：柔和灰米
    wainscotLine:  '#C8C0B4',
    baseboard:     '#B8AFA0',
    // 地板 — 浅蜂蜜木，有反光感
    floor:          '#C0B0A0',
    floorPlank:     '#B0A090',
    floorHighlight: '#D0C0B0',
    // 木头 — 暖金色蜂蜜木
    woodDark:       '#8B6E50',
    wood:           '#A08068',
    woodMid:        '#B09078',
    woodLight:      '#C4A078',
    woodPale:       '#D0B890',
    // 地毯 — 柔和玫瑰/淡陶土
    rug:            '#C89890',
    rugDark:        '#B08078',
    rugInner:       '#D8B0A8',
    rugPattern:     '#E0C8C0',
    // 窗帘 — 灰蓝，轻盈通透
    curtain:        '#C8CCD8',
    curtainFold:    '#B0B4C0',
    // 窗户 — 白昼
    windowGlass:    '#D8E0E8',
    windowSky:      '#D8E4F0',
    windowCloud:    '#F0F4F8',
    windowFrame:    '#A09078',
    // 台灯 — 柔和灰绿玻璃
    lampShade:      '#8AAC98',
    lampShadeInner: '#A0C0A8',
    lampBrass:      '#C8B898',
    lampBulb:       '#FFF8E8',
    // 金属
    gold:           '#D0B888',
    goldDark:       '#B09868',
    brass:          '#C8B898',
    // 纸品
    paper:          '#F2E8D8',
    paperWarm:      '#F8F0E4',
    // 打字机
    typewriterBody: '#4A3830',
    typewriterDark: '#3A2A22',
    // 绿植 — 灰绿
    plantPot:       '#C0A090',
    plantLeaf:      '#8A9E80',
    plantLeafLight: '#A0B498',
    plantLeafDark:  '#708868',
    // 椅子
    chairWood:      '#A08068',
    chairSeat:      '#B09078',
    // 挂钟
    clockFace:      '#F5EDE0',
    clockRim:       '#C8B080',
    // 照片框
    photoFrame:     '#C8B080',
    photoInner:     '#F0E4D4',
    // 书脊 — 莫奈色：灰紫、灰绿、暖杏、灰蓝、灰粉
    bookSpines: [
      '#B8A0B0','#A0B0A8','#C8A898','#A8B0C0','#C0B0A0',
      '#B0A8B8','#A8C0B0','#C8B8A8','#B8A8C0','#C0A898',
      '#B0B8B0','#C0A8B0','#A8B8A8','#C8B0A0','#B8B0B8'
    ],
    // 画架
    easelWood:      '#A08068',
    easelCanvas:    '#FDF8F0',
  };

  // ============================================================
  // 设计分辨率
  // ============================================================
  const DESIGN_W = 1600;
  const DESIGN_H = 900;

  // ============================================================
  // 内部状态
  // ============================================================
  let canvas, ctx;
  let scale = 1;           // 当前缩放比例
  let offsetX = 0;         // Canvas 在视口中的 X 偏移
  let offsetY = 0;         // Canvas 在视口中的 Y 偏移
  let time = 0;            // 运行时间（秒），驱动动画
  let panelOpen = false;
  let isNight = false;   // 夜晚模式
  let animFrameId = null;

  // 精灵缓存：{ 'painting-1.png': Image }
  const spriteCache = {};

  // 场景图：按 z-index 升序排列
  let sceneObjects = [];

  // 回调
  let onHoverChange = null;  // (obj|null) => void
  let onClickItem = null;    // (obj) => void

  // ============================================================
  // 场景对象定义
  // 坐标基于 1600×900 设计分辨率
  // `sprite`: assets/sprites/ 下的文件名，引擎自动加载
  // `parallax`: 视差深度 0(不动) ~ 1(紧跟鼠标)
  // ============================================================
  const OBJECT_DEFS = [
    // ---- 背景层 ----
    { id:'wall',       sprite:'', x:0,    y:0,   w:1600, h:900, z:0,  parallax:0,    interactive:false },
    // ★ 地板缩小：y:560, h:340
    { id:'floor',      sprite:'', x:0,    y:560, w:1600, h:340, z:1,  parallax:0.01, interactive:false },
    // ★ 窗户居中 4:3：x:600, y:30, w:400, h:300
    { id:'window',     sprite:'window.png',     x:500,  y:20,  w:600,  h:337, z:2,  parallax:0.03, interactive:false },
    // ★ 迪斯科球地毯
    { id:'rug',        sprite:'rug.png',        x:460,  y:570, w:680,  h:155, z:3,  parallax:0.02, interactive:false },
    // ★ 书柜加高
    { id:'bookshelf',  sprite:'bookshelf.png',  x:20,   y:150, w:240,  h:420, z:4,  parallax:0.05, interactive:false,
        },

    // ---- 中层 ----
    { id:'clock',      sprite:'clock.png',      x:230,  y:55,  w:60,   h:60,  z:5,  parallax:0.04, interactive:false },
    // ★ 画框移到地板层靠墙
    { id:'painting-1', sprite:'painting-1.png', x:1130, y:90,  w:160,  h:200, z:5,  parallax:0.06, interactive:true,
      panel:'photography', label:'🖼️ 摄影作品', glowColor:'#D0B890' },
    { id:'painting-2', sprite:'painting-2.png', x:1420, y:100, w:140,  h:180, z:5,  parallax:0.06, interactive:true,
      panel:'photography', label:'🖼️ 摄影作品', glowColor:'#D0B890' },
    // ★ 画架右移
    { id:'easel',      sprite:'easel.png',      x:1130, y:350, w:140,  h:210, z:6,  parallax:0.08, interactive:true,
      panel:'design', label:'🎨 设计作品', glowColor:'#A0B898' },
    { id:'messageboard', sprite:'',            x:1280, y:200, w:140,  h:170, z:5,  parallax:0.06, interactive:true,
      panel:'messages', label:'📋 留言板', glowColor:'#D0C8B0' },
    // ★ 书桌加宽横跨：x:380, w:840
    { id:'desk',       sprite:'desk.png',       x:500,  y:460, w:580,  h:70,  z:7,  parallax:0.10, interactive:false },

    // ---- 前景层（桌上物品）----
    { id:'desk-photos',sprite:'desk-photos.png',x:560,  y:415, w:55,   h:50,  z:8,  parallax:0.14, interactive:true,
      panel:'about', label:'📷 关于我', glowColor:'#D0A8A0' },
    { id:'desk-books', sprite:'desk-books.png', x:860,  y:440, w:65,   h:35,  z:8,  parallax:0.12, interactive:true,
      panel:'social', label:'📚 自媒体 & 文章', glowColor:'#B0B8C0' },
    { id:'typewriter',sprite:'typewriter.png',  x:740,  y:430, w:95,   h:55,  z:8,  parallax:0.14, interactive:true,
      panel:'social', label:'✍️ 自媒体 & 文章', glowColor:'#D0C0A0' },
    { id:'lamp',       sprite:'lamp.png',       x:940,  y:405, w:70,   h:80,  z:9,  parallax:0.12, interactive:false },
    // ★ 盆栽→花树
    { id:'tree',       sprite:'',               x:260,  y:480, w:90,   h:130, z:4,  parallax:0.05, interactive:true,
        panel:'tree', label:'🌸 花树', glowColor:'#F0D0D8' },
  ];

  // ============================================================
  // Canvas 工具函数
  // ============================================================

  /** roundRect polyfill — 兼容所有浏览器 */
  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /** 绘制软阴影 — 用径向渐变模拟 */
  function softShadow(ctx, cx, cy, rx, ry, color, alpha) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, color.replace(')', `,${alpha})`).replace('rgb', 'rgba'));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 木纹渐变 */
  function woodGradient(ctx, x, y, w, h, c1, c2) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, c1);
    grad.addColorStop(0.3, c2);
    grad.addColorStop(0.5, c1);
    grad.addColorStop(0.7, c2);
    grad.addColorStop(1, c1);
    return grad;
  }

  // ============================================================
  // 初始化
  // ============================================================
  async function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');

    // 构建场景图（深拷贝 + 排序）
    sceneObjects = OBJECT_DEFS
      .map(obj => ({ ...obj, _img: null, _hovered: false }))
      .sort((a, b) => a.z - b.z);

    // 加载精灵
    await loadSprites();

    // 响应式处理
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));

    // 启动渲染循环
    render(0);
  }

  // ============================================================
  // 精灵加载
  // ============================================================
  async function loadSprites() {
    const spriteDir = 'assets/sprites/';
    const promises = sceneObjects.map(obj => {
      if (!obj.sprite) return Promise.resolve();
      const path = spriteDir + obj.sprite;
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          spriteCache[obj.sprite] = img;
          obj._img = img;
          resolve();
        };
        img.onerror = () => {
          // 加载失败，使用程序化 placeholder
          resolve();
        };
        img.src = path;
      });
    });
    await Promise.allSettled(promises);
  }

  /**
   * 手动设置某个对象的精灵图片（用户动态替换时调用）
   */
  function setSprite(objectId, imageOrPath) {
    const obj = sceneObjects.find(o => o.id === objectId);
    if (!obj) return;
    if (typeof imageOrPath === 'string') {
      const img = new Image();
      img.onload = () => { obj._img = img; };
      img.src = imageOrPath;
    } else {
      obj._img = imageOrPath;
    }
  }

  // ============================================================
  // 响应式缩放
  // ============================================================
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // 限制像素比，节省性能
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 计算缩放：保持 16:9，contain 模式
    const designRatio = DESIGN_W / DESIGN_H;
    const viewRatio = vw / vh;

    let drawW, drawH;
    if (viewRatio > designRatio) {
      // 视口更宽 → 高度撑满
      drawH = vh;
      drawW = vh * designRatio;
    } else {
      // 视口更高 → 宽度撑满
      drawW = vw;
      drawH = vw / designRatio;
    }

    offsetX = (vw - drawW) / 2;
    offsetY = (vh - drawH) / 2;
    scale = drawW / DESIGN_W;

    // 设置 Canvas 物理像素
    canvas.width = vw * dpr;
    canvas.height = vh * dpr;
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';

    // CSS 变换：将 Canvas 绘制坐标系映射到视口
    // 我们使用 setTransform 在每帧开始设置
  }

  /** 将鼠标事件位置转换为设计坐标 */
  function clientToDesign(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    // CSS 坐标 → Canvas 物理坐标 → 设计坐标
    const physicalX = cssX * (canvas.width / (rect.width || 1));
    const physicalY = cssY * (canvas.height / (rect.height || 1));
    return {
      x: (cssX - offsetX) / scale,
      y: (cssY - offsetY) / scale,
    };
  }

  // ============================================================
  // 渲染循环
  // ============================================================
  function render(timestamp) {
    time = timestamp * 0.001; // 秒
    animFrameId = requestAnimationFrame(render);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // CSS 偏移（Canvas 在视口中居中）
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // -- 按 z 序绘制所有场景对象 --
    for (const obj of sceneObjects) {
      drawObject(obj);
    }

    // -- 后期：台灯光晕 --
    drawLampGlow();

    // -- 夜晚暗色叠加 --
    if (isNight) {
      ctx.fillStyle = 'rgba(15, 10, 20, 0.18)';
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }

    // -- 恢复变换 --
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ============================================================
  // 绘制单个场景对象
  // ============================================================
  function drawObject(obj) {
    const { id, x, y, w, h, _img } = obj;
    if (w <= 0 || h <= 0) return;

    ctx.save();

    // 计算中心点
    const cx = x + w / 2;
    const cy = y + h / 2;

    // 应用视差偏移（外部通过 parallaxOffsetX/Y 控制）
    let px = 0, py = 0;
    if (typeof parallaxOffsetX !== 'undefined') {
      px = parallaxOffsetX * obj.parallax;
      py = parallaxOffsetY * obj.parallax;
    }

    ctx.translate(cx + px, cy + py);

    // hover 缩放
    if (obj._hovered && obj.interactive) {
      ctx.scale(1.04, 1.04);
    }

    // idle 微动
    let idleSway = 0;
    if (obj.interactive) {
      idleSway = Math.sin(time * 1.2 + x * 0.01) * 1.5;
    }

    ctx.translate(idleSway, 0);

    // 如果有精灵图片，直接画
    if (_img && _img.complete && _img.naturalWidth > 0) {
      ctx.drawImage(_img, -w / 2, -h / 2, w, h);
    } else {
      // 否则绘制程序化 placeholder
      drawPlaceholder(obj);
    }

    ctx.restore();
  }

  // ============================================================
  // 程序化 Placeholder 绘制
  // ============================================================
  function drawPlaceholder(obj) {
    const { id } = obj;
    const w = obj.w, h = obj.h;
    const hw = w / 2, hh = h / 2;

    switch (id) {
      case 'wall':       drawWall(w, h); break;
      case 'floor':      drawFloor(w, h); break;
      case 'window':     drawWindow(w, h); break;
      case 'rug':        drawRug(w, h); break;
      case 'bookshelf':  drawBookshelf(w, h); break;
      case 'painting-1': drawPainting(w, h, 1); break;
      case 'painting-2': drawPainting(w, h, 2); break;
      case 'clock':      drawClock(w, h); break;
      case 'easel':      drawEasel(w, h); break;
      case 'desk':       drawDesk(w, h); break;
      case 'sofa':       drawSofa(w, h); break
      case 'desk-photos':drawDeskPhotos(w, h); break;
      case 'desk-books': drawDeskBooks(w, h); break;
      case 'typewriter': drawTypewriter(w, h); break;
      case 'lamp':       drawLamp(w, h); break;
      case 'messageboard': drawMessageBoard(w, h); break;
      case 'tree':      drawFloweringTree(w, h); break;
    }
  }

  // ---- 墙壁 ----
  function drawWall(w, h) {
    // 上半墙
    ctx.fillStyle = C.wallUpper;
    ctx.fillRect(-w/2, -h/2, w, h * 0.58);

    // 下半墙（墙裙）
    ctx.fillStyle = C.wallLower;
    ctx.fillRect(-w/2, -h/2 + h * 0.58, w, h * 0.42);

    // 墙裙装饰线
    const lineY = -h/2 + h * 0.58;
    ctx.strokeStyle = C.wainscotLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w/2, lineY);
    ctx.lineTo(w/2, lineY);
    ctx.stroke();

    // 踢脚线
    ctx.fillStyle = C.baseboard;
    ctx.fillRect(-w/2, h/2 - 14, w, 14);
  }

  // ---- 地板 ----
  function drawFloor(w, h) {
    ctx.fillStyle = C.floor;
    ctx.fillRect(-w/2, -h/2, w, h);

    // 木板线
    const plankCount = 6;
    const plankH = h / plankCount;
    ctx.strokeStyle = C.floorPlank;
    ctx.lineWidth = 1;
    for (let i = 1; i < plankCount; i++) {
      const py = -h/2 + i * plankH;
      ctx.beginPath();
      ctx.moveTo(-w/2, py);
      ctx.lineTo(w/2, py);
      ctx.stroke();
    }

    // 随机木板高光线
    ctx.strokeStyle = C.floorHighlight;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < plankCount; i++) {
      const py = -h/2 + i * plankH + plankH * 0.3;
      ctx.beginPath();
      ctx.moveTo(-w/2 + 30, py);
      ctx.lineTo(w/2 - 30, py);
      ctx.stroke();
    }
  }

  // ---- 窗户（白昼草原大树） ----
  function drawWindow(w, h) {
    const margin = 20;
    const topM = 35;
    const botM = 25;
    const ox = -w/2 + margin;
    const oy = -h/2 + topM;
    const ow = w - margin*2;
    const oh = h - topM - botM;

    // === 窗内风景 ===
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, ox, oy, ow, oh, 16);
    ctx.clip();

    // --- 天空：浅蓝到地平线更亮 ---
    const skyGrad = ctx.createLinearGradient(0, oy, 0, oy + oh*0.5);
    skyGrad.addColorStop(0, '#C8DCF0');
    skyGrad.addColorStop(0.5, '#D8E8F5');
    skyGrad.addColorStop(1, '#E8F0F8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(ox, oy, ow, oh*0.55);

    // --- 太阳：左上角，暖金色光晕 ---
    const sunX = ox + ow*0.22, sunY = oy + oh*0.18;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, ow*0.02, sunX, sunY, ow*0.22);
    sunGrad.addColorStop(0, 'rgba(255,248,220,0.95)');
    sunGrad.addColorStop(0.2, 'rgba(255,240,200,0.6)');
    sunGrad.addColorStop(0.5, 'rgba(255,230,180,0.2)');
    sunGrad.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(ox, oy, ow, oh*0.55);

    // --- 白云 ---
    ctx.fillStyle = '#F8FBFF';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(ox + ow*0.3, oy + oh*0.12, ow*0.1, oh*0.05, 0.1, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ox + ow*0.35, oy + oh*0.09, ow*0.08, oh*0.04, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ox + ow*0.6, oy + oh*0.2, ow*0.12, oh*0.05, -0.1, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ox + ow*0.67, oy + oh*0.17, ow*0.07, oh*0.04, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // --- 远丘：柔和灰绿 ---
    ctx.fillStyle = '#B0C0B0';
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(ox, oy + oh*0.45);
    ctx.quadraticCurveTo(ox + ow*0.2, oy + oh*0.36, ox + ow*0.4, oy + oh*0.42);
    ctx.quadraticCurveTo(ox + ow*0.65, oy + oh*0.34, ox + ow, oy + oh*0.44);
    ctx.lineTo(ox + ow, oy + oh);
    ctx.lineTo(ox, oy + oh);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // --- 中景草原：浅绿到暖黄绿 ---
    const grassGrad = ctx.createLinearGradient(0, oy + oh*0.48, 0, oy + oh);
    grassGrad.addColorStop(0, '#B8C8A0');
    grassGrad.addColorStop(0.3, '#A8C090');
    grassGrad.addColorStop(0.6, '#C0C898');
    grassGrad.addColorStop(1, '#A8B880');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(ox, oy + oh*0.48, ow, oh*0.52);

    // --- 草原纹理：柔和起伏 ---
    ctx.fillStyle = '#B8C898';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy + oh*0.55);
    ctx.quadraticCurveTo(ox + ow*0.3, oy + oh*0.50, ox + ow*0.6, oy + oh*0.56);
    ctx.quadraticCurveTo(ox + ow*0.8, oy + oh*0.52, ox + ow, oy + oh*0.58);
    ctx.lineTo(ox + ow, oy + oh*0.65);
    ctx.quadraticCurveTo(ox + ow*0.7, oy + oh*0.62, ox + ow*0.4, oy + oh*0.63);
    ctx.quadraticCurveTo(ox + ow*0.1, oy + oh*0.60, ox, oy + oh*0.62);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // --- 野花小点 ---
    for (let i = 0; i < 20; i++) {
      const fx = ox + ow*0.05 + i*ow*0.048;
      const fy = oy + oh*(0.62 + Math.sin(i*2.1)*0.15);
      const flowerColors = ['#F0E8D0','#F0D8C8','#E8D8F0','#F8F0C8','#F0D0D0'];
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.2, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- ★ 大树：前景偏右，有枝干和绿叶 ---
    const tx = ox + ow*0.65;
    const ty = oy + oh*0.58;
    const trunkColor = '#8B6E50';
    const leafColor1 = '#8AAA70';
    const leafColor2 = '#A0C080';
    const leafColor3 = '#709858';

    // 树干
    ctx.fillStyle = trunkColor;
    ctx.beginPath();
    ctx.moveTo(tx - ow*0.025, ty + oh*0.12);
    ctx.quadraticCurveTo(tx - ow*0.01, ty - oh*0.02, tx + ow*0.01, ty - oh*0.15);
    ctx.quadraticCurveTo(tx + ow*0.03, ty - oh*0.2, tx + ow*0.02, ty - oh*0.35);
    ctx.lineTo(tx + ow*0.06, ty - oh*0.35);
    ctx.quadraticCurveTo(tx + ow*0.05, ty - oh*0.2, tx + ow*0.04, ty - oh*0.15);
    ctx.quadraticCurveTo(tx + ow*0.05, ty - oh*0.02, tx + ow*0.03, ty + oh*0.12);
    ctx.closePath();
    ctx.fill();

    // 主枝 1 — 右上
    ctx.beginPath();
    ctx.moveTo(tx + ow*0.02, ty - oh*0.22);
    ctx.quadraticCurveTo(tx + ow*0.08, ty - oh*0.32, tx + ow*0.14, ty - oh*0.38);
    ctx.quadraticCurveTo(tx + ow*0.11, ty - oh*0.34, tx + ow*0.04, ty - oh*0.26);
    ctx.closePath();
    ctx.fill();

    // 主枝 2 — 左上
    ctx.beginPath();
    ctx.moveTo(tx + ow*0.01, ty - oh*0.18);
    ctx.quadraticCurveTo(tx - ow*0.06, ty - oh*0.28, tx - ow*0.1, ty - oh*0.36);
    ctx.quadraticCurveTo(tx - ow*0.05, ty - oh*0.32, tx + ow*0.02, ty - oh*0.22);
    ctx.closePath();
    ctx.fill();

    // 细枝
    ctx.strokeStyle = trunkColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx + ow*0.1, ty - oh*0.36);
    ctx.quadraticCurveTo(tx + ow*0.16, ty - oh*0.4, tx + ow*0.18, ty - oh*0.34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx - ow*0.07, ty - oh*0.33);
    ctx.quadraticCurveTo(tx - ow*0.12, ty - oh*0.38, tx - ow*0.13, ty - oh*0.3);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx + ow*0.05, ty - oh*0.33);
    ctx.quadraticCurveTo(tx + ow*0.07, ty - oh*0.4, tx + ow*0.04, ty - oh*0.44);
    ctx.stroke();

    // 树冠：多簇绿叶椭圆
    const leafClusters = [
      { cx: tx + ow*0.02, cy: ty - oh*0.35, rx: ow*0.08, ry: oh*0.08, col: leafColor2 },
      { cx: tx + ow*0.06, cy: ty - oh*0.38, rx: ow*0.07, ry: oh*0.07, col: leafColor1 },
      { cx: tx - ow*0.02, cy: ty - oh*0.36, rx: ow*0.06, ry: oh*0.07, col: leafColor3 },
      { cx: tx + ow*0.12, cy: ty - oh*0.4, rx: ow*0.05, ry: oh*0.05, col: leafColor1 },
      { cx: tx - ow*0.08, cy: ty - oh*0.37, rx: ow*0.05, ry: oh*0.05, col: leafColor2 },
      { cx: tx + ow*0.03, cy: ty - oh*0.42, rx: ow*0.06, ry: oh*0.06, col: leafColor1 },
      { cx: tx - ow*0.04, cy: ty - oh*0.4, rx: ow*0.04, ry: oh*0.05, col: leafColor3 },
      { cx: tx + ow*0.09, cy: ty - oh*0.36, rx: ow*0.04, ry: oh*0.04, col: leafColor2 },
    ];
    leafClusters.forEach(lc => {
      ctx.fillStyle = lc.col;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(lc.cx, lc.cy, lc.rx, lc.ry, 0.2, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 树根草丛
    ctx.fillStyle = '#90A878';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(tx - ow*0.01, ty + oh*0.14, ow*0.07, oh*0.04, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(tx + ow*0.04, ty + oh*0.13, ow*0.05, oh*0.04, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // --- 远处灌木丛 ---
    ctx.fillStyle = '#A0B890';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(ox + ow*0.18, oy + oh*0.56, ow*0.06, oh*0.05, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ox + ow*0.48, oy + oh*0.54, ow*0.05, oh*0.04, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // --- 夜晚模式：深色夜空 + 月亮 + 星光 + 月光洒落 ---
    if (isNight) {
      // 深色天空覆盖（不透明盖住太阳）
      const nightGrad = ctx.createLinearGradient(0, oy, 0, oy + oh*0.58);
      nightGrad.addColorStop(0, 'rgba(6, 4, 18, 0.85)');
      nightGrad.addColorStop(0.4, 'rgba(10, 8, 24, 0.75)');
      nightGrad.addColorStop(0.7, 'rgba(15, 12, 28, 0.5)');
      nightGrad.addColorStop(1, 'rgba(20, 15, 30, 0.15)');
      ctx.fillStyle = nightGrad;
      ctx.fillRect(ox, oy, ow, oh*0.58);

      // 月亮（温柔不刺眼）
      const moonX = ox + ow*0.28, moonY = oy + oh*0.22;
      const moonGrad = ctx.createRadialGradient(moonX, moonY, ow*0.04, moonX, moonY, ow*0.12);
      moonGrad.addColorStop(0, 'rgba(240,235,225,0.6)');
      moonGrad.addColorStop(0.4, 'rgba(220,215,210,0.3)');
      moonGrad.addColorStop(0.8, 'rgba(200,195,190,0.08)');
      moonGrad.addColorStop(1, 'rgba(180,175,170,0)');
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(moonX, moonY, ow*0.1, 0, Math.PI*2);
      ctx.fill();

      // 月光洒落在草原上
      ctx.fillStyle = 'rgba(180,190,210,0.12)';
      ctx.beginPath();
      ctx.moveTo(moonX - ow*0.1, oy + oh*0.5);
      ctx.lineTo(moonX + ow*0.1, oy + oh*0.5);
      ctx.lineTo(moonX + ow*0.3, oy + oh);
      ctx.lineTo(moonX - ow*0.3, oy + oh);
      ctx.closePath();
      ctx.fill();

      // 星星（更多更亮）
      const starPositions = [
        [0.12,0.06],[0.35,0.04],[0.55,0.08],[0.7,0.05],[0.85,0.1],
        [0.28,0.16],[0.48,0.12],[0.72,0.15],[0.18,0.22],[0.58,0.18],
        [0.42,0.06],[0.88,0.07],[0.32,0.2],[0.78,0.22],[0.08,0.18],
        [0.65,0.09],[0.5,0.2],[0.15,0.12]
      ];
      ctx.fillStyle = '#F8F6F0';
      starPositions.forEach(([sx, sy]) => {
        const twinkle = 0.3 + Math.sin(time*2.5 + sx*10) * 0.4;
        ctx.globalAlpha = twinkle;
        ctx.beginPath();
        ctx.arc(ox + ow*sx, oy + oh*sy, 1.3, 0, Math.PI*2);
        ctx.fill();
      });
    }

    ctx.restore();

    // === 窗框 ===
    ctx.strokeStyle = C.windowFrame;
    ctx.lineWidth = 9;
    roundRect(ctx, ox, oy, ow, oh, 16);
    ctx.stroke();

    // 竖窗棂
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(0, oy + oh);
    ctx.stroke();

    // 横窗棂
    ctx.beginPath();
    ctx.moveTo(ox, oy + oh*0.38);
    ctx.lineTo(ox + ow, oy + oh*0.38);
    ctx.stroke();

    // === 窗帘 ===
    ctx.fillStyle = C.curtain;
    ctx.globalAlpha = 0.75;

    // 左窗帘
    ctx.beginPath();
    ctx.moveTo(ox - 4, oy - 8);
    ctx.quadraticCurveTo(ox - 22, oy + oh*0.2, ox + 2, oy + oh*0.45);
    ctx.quadraticCurveTo(ox + 8, oy + oh*0.55, ox + 4, oy + oh + 5);
    ctx.lineTo(ox + 28, oy + oh + 5);
    ctx.quadraticCurveTo(ox + 22, oy + oh*0.4, ox + 20, oy + oh*0.15);
    ctx.quadraticCurveTo(ox + 16, oy - 2, ox + 22, oy - 8);
    ctx.closePath();
    ctx.fill();

    // 右窗帘
    ctx.beginPath();
    ctx.moveTo(ox + ow + 4, oy - 8);
    ctx.quadraticCurveTo(ox + ow + 22, oy + oh*0.2, ox + ow - 2, oy + oh*0.45);
    ctx.quadraticCurveTo(ox + ow - 8, oy + oh*0.55, ox + ow - 4, oy + oh + 5);
    ctx.lineTo(ox + ow - 28, oy + oh + 5);
    ctx.quadraticCurveTo(ox + ow - 22, oy + oh*0.4, ox + ow - 20, oy + oh*0.15);
    ctx.quadraticCurveTo(ox + ow - 16, oy - 2, ox + ow - 22, oy - 8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- 迪斯科球地毯 ----
  function drawRug(w, h) {
    const rx = w/2, ry = h/2;

    // ★ 莫奈淡紫蓝融合底
    const baseGrad = ctx.createRadialGradient(0, 0, rx*0.2, 0, 0, rx);
    baseGrad.addColorStop(0, '#D4D0DC');
    baseGrad.addColorStop(0.7, '#C4C0D0');
    baseGrad.addColorStop(1, '#B0ACBC');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2);
    ctx.fill();

    // 几何切面 — 淡紫蓝、灰白、柔金
    const facetColors = [
      '#DCD8E4','#E4E0E8','#D0CCD8','#E8E4EC',
      '#D8D4DC','#E0DCE0','#D4D0D8','#CCC8D0',
      '#E0D8E0','#D8D0D8','#E4DCE4','#D0C8D0',
      '#DCD4DC','#D4CCD4','#E8E0E4','#CCC4CC',
    ];
    const rows = 5, cols = 10;
    const cellW = (rx*2*0.85) / cols;
    const cellH = (ry*2*0.78) / rows;
    const startX = -rx*0.85;
    const startY = -ry*0.78;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx2 = startX + col*cellW + cellW/2;
        const cy2 = startY + row*cellH + cellH/2;
        // 检查是否在椭圆内
        const ex = cx2 / rx, ey = cy2 / ry;
        if (ex*ex + ey*ey > 0.95) continue;

        const ci = Math.floor(Math.abs(Math.sin(cx2*0.3 + row*1.7) * Math.cos(cy2*0.3 + col*1.3)) * facetColors.length);
        ctx.fillStyle = facetColors[ci % facetColors.length];
        ctx.globalAlpha = 0.55 + Math.random()*0.25;

        // 菱形切面
        ctx.beginPath();
        ctx.moveTo(cx2, cy2 - cellH*0.45);
        ctx.lineTo(cx2 + cellW*0.42, cy2);
        ctx.lineTo(cx2, cy2 + cellH*0.45);
        ctx.lineTo(cx2 - cellW*0.42, cy2);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 无中心光晕，纯切面感
  }

  // ---- 书架 ----
  function drawBookshelf(w, h) {
    // 主体
    ctx.fillStyle = C.wood;
    roundRect(ctx, -w/2, -h/2, w, h, 3);
    ctx.fill();

    // 侧板
    ctx.fillStyle = C.woodDark;
    ctx.fillRect(-w/2, -h/2, 8, h);
    ctx.fillRect(w/2 - 8, -h/2, 8, h);

    // 隔板
    const shelfCount = 3;
    const shelfSpacing = h / shelfCount;
    for (let i = 1; i < shelfCount; i++) {
      const sy = -h/2 + i * shelfSpacing;
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(-w/2 + 6, sy - 3, w - 12, 6);
    }

    // 顶部装饰
    ctx.fillStyle = C.woodLight;
    roundRect(ctx, -w/2 - 2, -h/2 - 6, w + 4, 10, 2);
    ctx.fill();

    // 书本
    const shelfTop = [-h/2 + 6, -h/2 + shelfSpacing + 6, -h/2 + 2*shelfSpacing + 6];
    const shelfH = shelfSpacing - 10;
    for (let s = 0; s < 3; s++) {
      let bx = -w/2 + 14;
      while (bx < w/2 - 14) {
        const bw = 10 + Math.sin(bx * 0.3 + s) * 5;
        const bh = shelfH * (0.85 + Math.sin(bx * 0.7) * 0.15);
        const colorIdx = Math.floor(Math.abs(Math.sin(bx * 0.4 + s * 2)) * C.bookSpines.length);
        ctx.fillStyle = C.bookSpines[colorIdx % C.bookSpines.length];
        roundRect(ctx, bx, shelfTop[s] + shelfH - bh, bw, bh, 1.5);
        ctx.fill();
        // 书脊金线
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(bx + bw * 0.3, shelfTop[s] + shelfH - bh + 3);
        ctx.lineTo(bx + bw * 0.3, shelfTop[s] + shelfH - 3);
        ctx.stroke();
        ctx.globalAlpha = 1;
        bx += bw + 2;
      }
    }
  }

  // ---- 画框 ----
  function drawPainting(w, h, index) {
    // 阴影
    softShadow(ctx, 2, 4, w*0.6, h*0.65, 'rgb(62,39,35)', 0.25);

    // 外框
    const frameColor = index === 1 ? C.woodLight : C.woodDark;
    ctx.fillStyle = frameColor;
    roundRect(ctx, -w/2, -h/2, w, h, 4);
    ctx.fill();

    // 内边
    ctx.fillStyle = C.paper;
    roundRect(ctx, -w/2 + 12, -h/2 + 12, w - 24, h - 24, 2);
    ctx.fill();

    // 内框装饰线
    ctx.strokeStyle = C.woodPale;
    ctx.lineWidth = 1.5;
    roundRect(ctx, -w/2 + 8, -h/2 + 8, w - 16, h - 16, 3);
    ctx.stroke();

    // 画中内容（抽象）
    const iw = w - 32, ih = h - 32;
    const ix = -iw/2, iy = -ih/2;
    ctx.fillStyle = C.paperWarm;
    ctx.fillRect(ix, iy, iw, ih);

    if (index === 1) {
      // 抽象风景
      ctx.fillStyle = '#C4A882';
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(ix+iw*0.3, iy+ih*0.4, iw*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#B8956C';
      ctx.beginPath(); ctx.arc(ix+iw*0.65, iy+ih*0.5, iw*0.14, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = C.plantLeafLight;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(ix, iy+ih*0.7);
      ctx.quadraticCurveTo(ix+iw*0.3, iy+ih*0.45, ix+iw*0.5, iy+ih*0.7);
      ctx.quadraticCurveTo(ix+iw*0.7, iy+ih*0.5, ix+iw, iy+ih*0.7);
      ctx.lineTo(ix+iw, iy+ih);
      ctx.lineTo(ix, iy+ih);
      ctx.fill();
    } else {
      // 抽象静物花卉
      ctx.fillStyle = '#D4A0A0';
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(ix+iw*0.45, iy+ih*0.35, iw*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#E8C0B0';
      ctx.beginPath(); ctx.arc(ix+iw*0.6, iy+ih*0.3, iw*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = C.plantLeaf;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(ix+iw*0.42, iy+ih*0.5, iw*0.04, ih*0.35);
      // 花瓶
      ctx.fillStyle = C.curtain;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(ix+iw*0.38, iy+ih*0.55);
      ctx.quadraticCurveTo(ix+iw*0.45, iy+ih*0.8, ix+iw*0.36, iy+ih*0.9);
      ctx.lineTo(ix+iw*0.52, iy+ih*0.9);
      ctx.quadraticCurveTo(ix+iw*0.47, iy+ih*0.8, ix+iw*0.48, iy+ih*0.55);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 玻璃反光
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.moveTo(ix + 8, iy + 6);
    ctx.lineTo(ix + iw*0.25, iy + ih - 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- 挂钟 ----
  function drawClock(w, h) {
    const r = Math.min(w, h) / 2;
    ctx.fillStyle = C.clockFace;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C.clockRim;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.stroke();

    // 刻度
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 - 90) * Math.PI / 180;
      const inner = r * 0.8, outer = r * 0.92;
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth = i % 3 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle)*inner, Math.sin(angle)*inner);
      ctx.lineTo(Math.cos(angle)*outer, Math.sin(angle)*outer);
      ctx.stroke();
    }

    // 指针
    const now = new Date();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const hAngle = ((hours + minutes/60) * 30 - 90) * Math.PI/180;
    const mAngle = (minutes * 6 - 90) * Math.PI/180;

    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(hAngle)*r*0.5, Math.sin(hAngle)*r*0.5);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(mAngle)*r*0.7, Math.sin(mAngle)*r*0.7);
    ctx.stroke();

    ctx.fillStyle = C.woodDark;
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
  }

  // ---- 画架 ----
  function drawEasel(w, h) {
    // A 型支架
    const legTopX = 0, legTopY = -h/2 + h*0.1;
    ctx.strokeStyle = C.easelWood;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    // 左腿
    ctx.beginPath();
    ctx.moveTo(legTopX, legTopY);
    ctx.lineTo(-w/2 + 10, h/2 - 5);
    ctx.stroke();
    // 右腿
    ctx.beginPath();
    ctx.moveTo(legTopX, legTopY);
    ctx.lineTo(w/2 - 10, h/2 - 5);
    ctx.stroke();
    // 中腿
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(legTopX, legTopY);
    ctx.lineTo(w/6, h/2 - 5);
    ctx.stroke();

    // 横梁
    const crossY = h*0.05;
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-w/2 + 14, crossY);
    ctx.lineTo(w/2 - 14, crossY);
    ctx.stroke();

    // 画布
    const cw = w * 0.72, ch = h * 0.55;
    const cx = -w*0.02, cy = -h/2 + h*0.25;
    ctx.fillStyle = C.easelCanvas;
    ctx.fillRect(cx - cw/2, cy - ch/2, cw, ch);
    ctx.strokeStyle = C.woodPale;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - cw/2, cy - ch/2, cw, ch);

    // 画布上的草图
    ctx.strokeStyle = '#B8956C';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, cw*0.22, 0, Math.PI*2);
    ctx.stroke();
    ctx.strokeStyle = '#C4A882';
    ctx.strokeRect(cx - cw*0.25, cy - ch*0.15, cw*0.5, ch*0.3);
    ctx.globalAlpha = 1;
  }

  // ---- 书桌 ----
  function drawDesk(w, h) {
    // 阴影
    softShadow(ctx, 2, h*0.6, w*0.55, h*0.8, 'rgb(50,30,20)', 0.3);

    // 桌面
    const deskGrad = woodGradient(ctx, -w/2, -h/2, w, h, C.woodMid, C.woodLight);
    ctx.fillStyle = deskGrad;
    roundRect(ctx, -w/2, -h/2, w, h, 4);
    ctx.fill();

    // 桌面纹理线
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(-w/2 + 15, -h/2 + h*0.4);
    ctx.lineTo(w/2 - 15, -h/2 + h*0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w/2 + 15, -h/2 + h*0.7);
    ctx.lineTo(w/2 - 15, -h/2 + h*0.7);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 桌腿
    const legW = 10;
    ctx.fillStyle = C.woodDark;
    roundRect(ctx, -w/2 + 15, h/2 - 4, legW, h*1.3, 2);
    ctx.fill();
    roundRect(ctx, w/2 - 15 - legW, h/2 - 4, legW, h*1.3, 2);
    ctx.fill();
    // 中腿
    roundRect(ctx, -legW/2, h/2 - 4, legW - 2, h*1.3, 2);
    ctx.fill();

    // 侧板
    ctx.fillStyle = C.wood;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(-w/2 + 8, h/2, w - 16, 4);
    ctx.globalAlpha = 1;
  }

  // ---- 沙发 ----
  function drawSofa(w, h) {
    // 沙发底座
    ctx.fillStyle = '#8B7B6B';
    roundRect(ctx, -w/2 + 5, -h*0.2, w - 10, h*0.5, 6);
    ctx.fill();

    // 坐垫
    ctx.fillStyle = '#A09080';
    roundRect(ctx, -w/2 + 10, -h*0.15, w*0.35, h*0.4, 4);
    ctx.fill();
    roundRect(ctx, -w*0.1, -h*0.15, w*0.35, h*0.4, 4);
    ctx.fill();
    roundRect(ctx, w*0.13, -h*0.15, w*0.35, h*0.4, 4);
    ctx.fill();

    // 靠背
    const backGrad = ctx.createLinearGradient(0, -h/2, 0, -h*0.1);
    backGrad.addColorStop(0, '#9B8B7B');
    backGrad.addColorStop(1, '#8B7B6B');
    ctx.fillStyle = backGrad;
    roundRect(ctx, -w/2 + 8, -h/2 + 8, w - 16, h*0.45, 5);
    ctx.fill();

    // 扶手
    ctx.fillStyle = '#7B6B5B';
    roundRect(ctx, -w/2 + 2, -h*0.1, 14, h*0.55, 5);
    ctx.fill();
    roundRect(ctx, w/2 - 16, -h*0.1, 14, h*0.55, 5);
    ctx.fill();

    // 沙发脚
    ctx.fillStyle = C.woodDark;
    roundRect(ctx, -w/2 + 25, h*0.2, 8, h*0.3, 2);
    ctx.fill();
    roundRect(ctx, w/2 - 33, h*0.2, 8, h*0.3, 2);
    ctx.fill();
  }

  // ---- 桌上照片（单张） ----
  function drawDeskPhotos(w, h) {
    // 相框
    ctx.fillStyle = C.photoFrame;
    roundRect(ctx, -w*0.4, -h/2 + 2, w*0.8, h - 5, 2);
    ctx.fill();
    ctx.fillStyle = C.photoInner;
    roundRect(ctx, -w*0.4 + 4, -h/2 + 6, w*0.8 - 8, h - 16, 1);
    ctx.fill();
    // 人像剪影
    ctx.fillStyle = '#C4A882';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(0, -h/2 + h*0.35, w*0.14, h*0.22, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -h/2 + h*0.2, w*0.08, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 支架
    ctx.strokeStyle = C.photoFrame;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h/2 - 6);
    ctx.lineTo(0, h/2 + 8);
    ctx.stroke();
  }

  // ---- 桌上书本 ----
  function drawDeskBooks(w, h) {
    const books = [
      { col: C.plantLeaf, w: w*0.85, h: h*0.22, y: h*0.35 },
      { col: '#C47A4E',   w: w*0.8,  h: h*0.2,  y: h*0.15 },
      { col: C.curtain,   w: w*0.9,  h: h*0.24, y: -h*0.15 },
    ];
    books.forEach(b => {
      ctx.fillStyle = b.col;
      roundRect(ctx, -b.w/2, b.y, b.w, b.h, 1.5);
      ctx.fill();
    });
    // 书脊线
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(-w*0.2, -h*0.15);
    ctx.lineTo(-w*0.2, h*0.35 + h*0.22);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- 打字机 ----
  function drawTypewriter(w, h) {
    // 阴影
    softShadow(ctx, 0, h*0.2, w*0.5, h*0.3, 'rgb(40,30,20)', 0.25);

    // 机身
    ctx.fillStyle = C.typewriterBody;
    roundRect(ctx, -w/2, -h/2, w, h*0.65, 6);
    ctx.fill();
    // 上面板
    ctx.fillStyle = '#4E342E';
    roundRect(ctx, -w/2 + 3, -h/2 + 2, w - 6, h*0.5, 4);
    ctx.fill();

    // 键盘区
    ctx.fillStyle = C.typewriterDark;
    roundRect(ctx, -w*0.4, -h*0.1, w*0.8, h*0.25, 2);
    ctx.fill();

    // 按键
    for (let i = 0; i < 8; i++) {
      const kx = -w*0.35 + i * w*0.095;
      ctx.fillStyle = C.brass;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(kx, h*0.05, w*0.03, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 滚筒
    ctx.fillStyle = C.woodLight;
    roundRect(ctx, -w*0.42, -h/2 - 3, w*0.84, h*0.14, 3);
    ctx.fill();

    // 纸张
    ctx.fillStyle = C.paper;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-w*0.35, -h/2 - h*0.65, w*0.7, h*0.55);
    // 纸上文字线
    ctx.strokeStyle = '#B8956C';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-w*0.3, -h/2 - h*0.55 + i * h*0.1);
      ctx.lineTo(w*0.2 - i*w*0.05, -h/2 - h*0.55 + i * h*0.1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- 台灯 ----
  function drawLamp(w, h) {
    // 底座
    ctx.fillStyle = C.brass;
    ctx.beginPath();
    ctx.ellipse(0, h/2 - 8, w*0.4, h*0.08, 0, 0, Math.PI*2);
    ctx.fill();

    // 灯杆
    ctx.strokeStyle = C.brass;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, h/2 - 8);
    ctx.quadraticCurveTo(w*0.2, h*0.1, 0, -h*0.1);
    ctx.stroke();

    // 灯罩（绿色穹顶）
    const shadeGrad = ctx.createLinearGradient(0, -h/2, 0, h*0.1);
    shadeGrad.addColorStop(0, C.lampShade);
    shadeGrad.addColorStop(0.7, C.lampShadeInner);
    shadeGrad.addColorStop(1, '#1A3A30');
    ctx.fillStyle = shadeGrad;
    ctx.beginPath();
    ctx.moveTo(-w*0.45, h*0.05);
    ctx.quadraticCurveTo(-w*0.5, -h*0.3, -w*0.1, -h*0.4);
    ctx.lineTo(w*0.1, -h*0.4);
    ctx.quadraticCurveTo(w*0.5, -h*0.3, w*0.45, h*0.05);
    ctx.closePath();
    ctx.fill();

    // 灯罩边缘
    ctx.strokeStyle = C.brass;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w*0.45, h*0.05);
    ctx.lineTo(w*0.45, h*0.05);
    ctx.stroke();

    // 灯泡（微光）
    ctx.fillStyle = C.lampBulb;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(0, h*0.12, w*0.1, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** 台灯光晕（后期叠加，在渲染循环中调用） */
  function drawLampGlow() {
    const lampObj = sceneObjects.find(o => o.id === 'lamp');
    if (!lampObj) return;
    const lx = lampObj.x + lampObj.w/2;
    const ly = lampObj.y + lampObj.h/2 + lampObj.h*0.15;

    const pulse = 1 + Math.sin(time * 1.8) * 0.15 + Math.sin(time * 3.3) * 0.08;
    const glowR = isNight ? 240 * pulse : 130 * pulse;
    const alphaMult = isNight ? 2.0 : 1;

    const grad = ctx.createRadialGradient(lx, ly, 10, lx, ly, glowR);
    grad.addColorStop(0, `rgba(255, 215, 0, ${0.35*alphaMult})`);
    grad.addColorStop(0.3, `rgba(255, 180, 50, ${0.18*alphaMult})`);
    grad.addColorStop(0.6, `rgba(255, 140, 0, ${0.05*alphaMult})`);
    grad.addColorStop(1, 'rgba(255, 140, 0, 0)');

    ctx.fillStyle = grad;
    ctx.globalCompositeOperation = 'screen';
    ctx.beginPath();
    ctx.arc(lx, ly, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- 花树 + 蝴蝶 ----
  function drawFloweringTree(w, h) {
    // 花盆
    const potTop = h*0.1, potBottom = h*0.35;
    const potGrad = ctx.createLinearGradient(0, potTop, 0, potBottom);
    potGrad.addColorStop(0, '#C0A090');
    potGrad.addColorStop(1, '#A08070');
    ctx.fillStyle = potGrad;
    ctx.beginPath();
    ctx.moveTo(-w*0.28, potTop);
    ctx.lineTo(-w*0.18, potBottom);
    ctx.lineTo(w*0.18, potBottom);
    ctx.lineTo(w*0.28, potTop);
    ctx.closePath();
    ctx.fill();
    // 盆沿
    ctx.fillStyle = '#D0B8A8';
    roundRect(ctx, -w*0.32, potTop - 3, w*0.64, 8, 2);
    ctx.fill();

    // 树干
    ctx.strokeStyle = '#8B6E50';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, potTop);
    ctx.quadraticCurveTo(w*0.05, -h*0.15, w*0.02, -h*0.35);
    ctx.stroke();
    // 枝干 1
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w*0.02, -h*0.22);
    ctx.quadraticCurveTo(w*0.15, -h*0.3, w*0.2, -h*0.4);
    ctx.stroke();
    // 枝干 2
    ctx.beginPath();
    ctx.moveTo(w*0.01, -h*0.18);
    ctx.quadraticCurveTo(-w*0.12, -h*0.26, -w*0.18, -h*0.38);
    ctx.stroke();
    // 细枝
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w*0.15, -h*0.34);
    ctx.quadraticCurveTo(w*0.22, -h*0.38, w*0.25, -h*0.35);
    ctx.stroke();

    // 花簇（粉白小球）
    const blossomDefs = [
      { x: w*0.02, y: -h*0.38, r: 7, col: '#F0D0D8' },
      { x: -w*0.04, y: -h*0.35, r: 6, col: '#F8E0E8' },
      { x: w*0.08, y: -h*0.36, r: 5, col: '#F0D8E0' },
      { x: w*0.21, y: -h*0.42, r: 6, col: '#F8E0E8' },
      { x: w*0.25, y: -h*0.38, r: 5, col: '#F0D0D8' },
      { x: -w*0.18, y: -h*0.40, r: 6, col: '#F8E0E8' },
      { x: -w*0.15, y: -h*0.36, r: 5, col: '#F0D8E0' },
      { x: w*0.05, y: -h*0.40, r: 5, col: '#F8D8E0' },
    ];
    blossomDefs.forEach(b => {
      ctx.fillStyle = b.col;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
    });

    // 绿叶
    const leafDefs = [
      { x: w*0.03, y: -h*0.28, rx: 8, ry: 4, rot: 0.3 },
      { x: -w*0.06, y: -h*0.3, rx: 7, ry: 3.5, rot: -0.3 },
      { x: w*0.1, y: -h*0.32, rx: 6, ry: 3, rot: 0.5 },
      { x: -w*0.1, y: -h*0.33, rx: 7, ry: 3, rot: -0.4 },
      { x: w*0.18, y: -h*0.35, rx: 6, ry: 3, rot: 0.2 },
      { x: -w*0.12, y: -h*0.38, rx: 5, ry: 3, rot: -0.5 },
    ];
    leafDefs.forEach(lf => {
      ctx.fillStyle = C.plantLeafLight;
      ctx.globalAlpha = 0.8;
      ctx.save();
      ctx.translate(lf.x, lf.y);
      ctx.rotate(lf.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, lf.rx, lf.ry, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    // 蝴蝶
    drawButterflies(w, h, potTop);
  }

  function drawButterflies(w, h, treeTop) {
    const bflyDefs = [
      { bx: -w*0.4, by: -h*0.45, sp: 0.8, ph: 0,    col: '#F0D0E0', col2: '#E8B8D0' }, // 淡粉
      { bx: w*0.35,  by: -h*0.5, sp: 0.7, ph: 1.5,  col: '#D0D8F0', col2: '#B8C8E8' }, // 淡蓝
    ];

    bflyDefs.forEach(bf => {
      const bx = bf.bx + Math.sin(time*bf.sp + bf.ph)*w*0.25;
      const by = bf.by + Math.cos(time*bf.sp*0.6 + bf.ph)*h*0.2;
      const wingFlap = Math.sin(time*4 + bf.ph) * 0.3;

      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(1, 1 - Math.abs(wingFlap)*0.4);

      // 上翅（大）
      ctx.fillStyle = bf.col;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.bezierCurveTo(-6, -8, -8, -3, -2, 0);
      ctx.bezierCurveTo(-8, 2, -5, 5, 0, 2);
      ctx.fill();

      // 右翅（镜像）
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.bezierCurveTo(6, -8, 8, -3, 2, 0);
      ctx.bezierCurveTo(8, 2, 5, 5, 0, 2);
      ctx.fill();

      // 下翅（小）
      ctx.fillStyle = bf.col2;
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.bezierCurveTo(-5, 6, -4, 8, 0, 5);
      ctx.bezierCurveTo(4, 8, 5, 6, 0, 1);
      ctx.fill();

      // 身体
      ctx.fillStyle = '#4A3020';
      ctx.fillRect(-0.6, -5, 1.2, 8);

      // 触角
      ctx.strokeStyle = '#4A3020';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.quadraticCurveTo(-3, -8, -5, -7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.quadraticCurveTo(3, -8, 5, -7);
      ctx.stroke();

      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  // ---- 留言板 ----
  function drawMessageBoard(w, h) {
    // 软木框
    ctx.fillStyle = '#B8A080';
    roundRect(ctx, -w/2 + 4, -h/2 + 4, w - 8, h - 8, 3);
    ctx.fill();
    // 软木纹理
    ctx.fillStyle = '#C8B090';
    roundRect(ctx, -w/2 + 8, -h/2 + 8, w - 16, h - 16, 2);
    ctx.fill();
    // 边框
    ctx.strokeStyle = '#A08868';
    ctx.lineWidth = 3;
    roundRect(ctx, -w/2 + 4, -h/2 + 4, w - 8, h - 8, 3);
    ctx.stroke();
    // 便签纸
    ctx.fillStyle = '#F8F4E8';
    ctx.save();
    ctx.translate(-w*0.1, -h*0.15);
    ctx.rotate(-0.08);
    ctx.fillRect(-w*0.2, -h*0.15, w*0.45, h*0.22);
    ctx.restore();
    ctx.fillStyle = '#F0ECD8';
    ctx.save();
    ctx.translate(w*0.1, h*0.05);
    ctx.rotate(0.06);
    ctx.fillRect(-w*0.18, -h*0.12, w*0.4, h*0.2);
    ctx.restore();
    // 图钉
    ctx.fillStyle = '#D04040';
    ctx.beginPath(); ctx.arc(-w*0.2, -h*0.22, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.15, -h*0.08, 3, 0, Math.PI*2); ctx.fill();
  }

  // ============================================================
  // 公开 API
  // ============================================================
  function getSceneObjects() { return sceneObjects; }
  function getDesignSize() { return { w: DESIGN_W, h: DESIGN_H }; }
  function getScale() { return scale; }
  function getOffset() { return { x: offsetX, y: offsetY }; }
  function getTime() { return time; }
  function getCanvas() { return canvas; }
  function getCtx() { return ctx; }
  function isPanelOpen() { return panelOpen; }
  function isNightMode() { return isNight; }
  function setNightMode(val) { isNight = val; }

  function setPanelOpen(open) {
    panelOpen = open;
    if (canvas) {
      canvas.style.filter = open ? 'brightness(0.4) blur(4px) saturate(0.7)' : 'none';
      canvas.style.transition = 'filter 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  }

  /** 设置 hover 回调：RoomEngine.onHoverChange = (obj|null) => {} */
  function setHoverCallback(fn) { onHoverChange = fn; }
  /** 设置点击回调：RoomEngine.onClickItem = (obj) => {} */
  function setClickCallback(fn) { onClickItem = fn; }

  /** 标记某个对象的 hover 状态 */
  function setHovered(objectId, hovered) {
    const obj = sceneObjects.find(o => o.id === objectId);
    if (obj) {
      obj._hovered = hovered;
      if (onHoverChange) onHoverChange(hovered ? obj : null);
    }
  }

  /** 清除所有 hover */
  function clearAllHovered() {
    sceneObjects.forEach(o => { o._hovered = false; });
    if (onHoverChange) onHoverChange(null);
  }

  /** 触发对象点击 */
  function triggerClick(objectId) {
    const obj = sceneObjects.find(o => o.id === objectId);
    if (obj && obj.interactive && onClickItem) {
      onClickItem(obj);
    }
  }

  /** 销毁引擎 */
  function destroy() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    window.removeEventListener('resize', resize);
  }

  // ============================================================
  // 全局视差变量（interaction.js 每帧更新）
  // ============================================================
  let parallaxOffsetX = 0;
  let parallaxOffsetY = 0;

  function setParallaxOffset(x, y) {
    parallaxOffsetX = x;
    parallaxOffsetY = y;
  }

  return {
    init, resize, destroy,
    loadSprites, setSprite,
    getSceneObjects, getDesignSize, getScale, getOffset, getTime, getCanvas, getCtx,
    isPanelOpen, setPanelOpen, isNightMode, setNightMode,
    setHoverCallback, setClickCallback,
    setHovered, clearAllHovered, triggerClick,
    setParallaxOffset,
    clientToDesign,
    C, // 色彩常量，供 effects.js 使用
  };
})();

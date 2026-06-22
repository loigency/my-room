/**
 * 后期效果系统 — 游戏级氛围增强
 *
 * 职责：
 *   - 浮尘粒子（Disco Elysium 标志性的空气感）
 *   - 噪点纹理（Film grain / canvas texture）
 *   - 暗角（Vignette）
 *   - 窗户光束
 *   - 暖色色彩分级
 *
 * 使用独立 Canvas 叠加层，pointer-events: none 确保不阻挡交互。
 */

const Effects = (() => {
  let canvas, ctx;
  let particles = [];
  let noiseImageData = null;
  let noiseCanvas = null;
  let vignetteCanvas = null;
  let animFrameId = null;
  let time = 0;

  // ---- 可配置参数 ----
  const DUST_COUNT = 25;
  const DUST_MAX_SIZE = 3.5;
  const DUST_SPEED = 0.3;      // 基础速度
  const NOISE_OPACITY = 0.035; // 噪点透明度（微妙）
  const VIGNETTE_STRENGTH = 0.45;

  // ============================================================
  // 初始化
  // ============================================================
  function init() {
    const container = document.getElementById('room-container');
    if (!container) return;

    // 创建叠加 Canvas
    canvas = document.createElement('canvas');
    canvas.id = 'effects-canvas';
    canvas.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 6;
    `;
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');

    // 生成粒子
    createParticles();

    // 预生成纹理（这些每帧不变，缓存到离屏 Canvas）
    generateNoiseTexture();
    generateVignette();

    // 响应式
    resize();
    window.addEventListener('resize', resize);

    // 启动动画循环
    animate(0);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvas.width = vw * dpr;
    canvas.height = vh * dpr;
    // 重新生成分辨率相关的纹理
    generateNoiseTexture();
    generateVignette();
  }

  // ============================================================
  // 浮尘粒子
  // ============================================================
  function createParticles() {
    particles = [];
    for (let i = 0; i < DUST_COUNT; i++) {
      particles.push({
        // 初始位置偏向窗光区域（右侧中上）
        x: 0.35 + Math.random() * 0.30,   // 归一化 x（窗户居中区域）
        y: 0.08 + Math.random() * 0.40,   // 归一化 y
        size: 0.6 + Math.random() * DUST_MAX_SIZE,
        speedX: (Math.random() - 0.5) * DUST_SPEED * 0.3,
        speedY: -Math.random() * DUST_SPEED - 0.1,
        opacity: 0.3 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        life: Math.random(),              // 0-1 生命周期位置
      });
    }
  }

  // ============================================================
  // 噪点纹理（预生成）
  // ============================================================
  function generateNoiseTexture() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // 用小分辨率生成噪点然后拉伸，节省性能
    const nw = Math.ceil(window.innerWidth * dpr / 4);
    const nh = Math.ceil(window.innerHeight * dpr / 4);

    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = nw;
    noiseCanvas.height = nh;
    const nctx = noiseCanvas.getContext('2d');
    const imgData = nctx.createImageData(nw, nh);

    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 255;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
    nctx.putImageData(imgData, 0, 0);
  }

  // ============================================================
  // 暗角（预生成）
  // ============================================================
  function generateVignette() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth * dpr;
    const vh = window.innerHeight * dpr;

    vignetteCanvas = document.createElement('canvas');
    vignetteCanvas.width = vw;
    vignetteCanvas.height = vh;
    const vctx = vignetteCanvas.getContext('2d');

    const cx = vw / 2, cy = vh / 2;
    // 椭圆暗角
    const rx = vw * 0.7, ry = vh * 0.65;
    const grad = vctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.35, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, 'rgba(30, 18, 10, 0)');
    grad.addColorStop(0.5, 'rgba(30, 18, 10, 0.08)');
    grad.addColorStop(0.8, `rgba(25, 12, 6, ${VIGNETTE_STRENGTH * 0.6})`);
    grad.addColorStop(1, `rgba(20, 10, 4, ${VIGNETTE_STRENGTH})`);

    vctx.fillStyle = grad;
    vctx.fillRect(0, 0, vw, vh);
  }

  // ============================================================
  // 主渲染循环
  // ============================================================
  function animate(timestamp) {
    time = timestamp * 0.001;
    animFrameId = requestAnimationFrame(animate);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 绘制噪点纹理
    drawNoise();

    // 2. 绘制浮尘粒子
    drawDust();

    // 3. 绘制暗角
    drawVignette();

    // 4. 绘制窗户光束
    drawLightBeam();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ============================================================
  // 绘制
  // ============================================================
  function drawNoise() {
    if (!noiseCanvas) return;
    ctx.globalAlpha = NOISE_OPACITY;
    // 拉伸小纹理到全屏（有意的像素化）
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(noiseCanvas, 0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
  }

  function drawDust() {
    const vw = canvas.width;
    const vh = canvas.height;

    particles.forEach(p => {
      // 更新位置
      p.life += 0.0004 + Math.random() * 0.0002;
      if (p.life > 1) {
        // 粒子循环：回到起点
        p.life = 0;
        p.x = 0.35 + Math.random() * 0.30;  // 窗户居中区域
        p.y = 0.08 + Math.random() * 0.40;
        p.opacity = 0.3 + Math.random() * 0.5;
        p.size = 0.6 + Math.random() * DUST_MAX_SIZE;
      }

      p.x += p.speedX * 0.0005;
      p.y += p.speedY * 0.0005;

      // 边界回绕
      if (p.x < 0.5) p.x = 0.9;
      if (p.x > 0.95) p.x = 0.5;
      if (p.y < 0.05) p.y = 0.65;
      if (p.y > 0.7) p.y = 0.05;

      // 绘制
      const px = p.x * vw;
      const py = p.y * vh;

      // 光晕（大）
      const outerAlpha = p.opacity * 0.08;
      const outerGrad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3);
      outerGrad.addColorStop(0, `rgba(255,254,245,${outerAlpha})`);
      outerGrad.addColorStop(1, 'rgba(255,254,245,0)');
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
      ctx.fill();

      // 核心亮点
      const coreAlpha = p.opacity * 0.7;
      ctx.fillStyle = `rgba(255,254,245,${coreAlpha})`;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawVignette() {
    if (!vignetteCanvas) return;
    ctx.globalAlpha = 1;
    ctx.drawImage(vignetteCanvas, 0, 0, canvas.width, canvas.height);
  }

  function drawLightBeam() {
    const vw = canvas.width;
    const vh = canvas.height;
    const scale = vw / 1600;
    const wx = 500 * scale;
    const wy = 20 * scale;
    const ww = 600 * scale;
    const wh = 337 * scale;

    const beamTop = wy + wh * 0.5;
    const beamLeft = wx + ww * 0.08;
    const beamRight = wx + ww * 0.92;
    const beamBottom = vh;

    if (typeof RoomEngine !== 'undefined' && RoomEngine.isNightMode && RoomEngine.isNightMode()) {
      // 夜晚：柔和的月光
      const grad = ctx.createLinearGradient(0, beamTop, 0, beamBottom);
      grad.addColorStop(0, 'rgba(180,190,220,0.08)');
      grad.addColorStop(0.5, 'rgba(160,175,210,0.03)');
      grad.addColorStop(1, 'rgba(140,155,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(beamLeft, beamTop);
      ctx.lineTo(beamRight, beamTop);
      ctx.lineTo(beamRight + 120 * scale, beamBottom);
      ctx.lineTo(beamLeft - 40 * scale, beamBottom);
      ctx.closePath();
      ctx.fill();
    } else {
      // 白天：暖金色阳光
      const grad = ctx.createLinearGradient(0, beamTop, 0, beamBottom);
      grad.addColorStop(0, 'rgba(255,242,210,0.15)');
      grad.addColorStop(0.3, 'rgba(255,235,195,0.06)');
      grad.addColorStop(0.7, 'rgba(255,225,175,0.02)');
      grad.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(beamLeft, beamTop);
      ctx.lineTo(beamRight, beamTop);
      ctx.lineTo(beamRight + 200 * scale, beamBottom);
      ctx.lineTo(beamLeft - 100 * scale, beamBottom);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ============================================================
  // 清理
  // ============================================================
  function destroy() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    particles = [];
  }

  return { init, destroy };
})();

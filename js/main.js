/**
 * 主入口 —「一间属于自己的房间」Canvas 版
 *
 * 启动顺序：
 *   0. 引擎在后台静默初始化（引导页覆盖在上面）
 *   1. 用户点击进入 → 引导页淡出，房间露出
 */

(function () {
  'use strict';

  let roomReady = false;

  // ============================================================
  // 初始化房间（页面加载时即启动，隐藏在引导页后方）
  // ============================================================
  async function initRoom() {
    const canvas = document.getElementById('room-canvas');
    if (!canvas) {
      console.error('❌ Canvas element not found');
      return;
    }

    console.log('🏠 一间属于自己的房间 — A Room of One\'s Own');
    console.log('🎨 Canvas 游戏式房间场景');

    await RoomEngine.init(canvas);
    console.log('  ✓ 房间引擎就绪');

    Interaction.init();
    console.log('  ✓ 交互系统就绪');

    Effects.init();
    console.log('  ✓ 后期效果就绪');

    if (typeof Gallery !== 'undefined') {
      Gallery.init();
      console.log('  ✓ 灯箱就绪');
    }

    if (typeof DigitalTwin !== 'undefined') {
      DigitalTwin.init();
      console.log('  ✓ 数字分身就绪');
    }

    // 日夜检测
    const hour = new Date().getHours();
    if (hour >= 18 || hour < 6) {
      RoomEngine.setNightMode(true);
      console.log('  🌙 夜晚模式');
    }

    // 花树判定
    if (typeof TreeDialog !== 'undefined') {
      TreeDialog.init();
      console.log('  ✓ 花树判定就绪');
    }

    roomReady = true;
    console.log('✨ 准备就绪 — 等待你进入');
  }

  // ============================================================
  // 引导页
  // ============================================================
  function initIntro() {
    const overlay = document.getElementById('intro-overlay');
    const enterBtn = document.getElementById('intro-enter');
    if (!overlay) return;

    // 创建引导页粒子
    createIntroParticles();

    function enterRoom() {
      // 如果引擎还没加载完，等一等再淡出
      if (!roomReady) {
        overlay.style.cursor = 'wait';
        const check = setInterval(() => {
          if (roomReady) {
            clearInterval(check);
            doEnter();
          }
        }, 200);
      } else {
        doEnter();
      }
    }

    function doEnter() {
      overlay.classList.add('hidden');
      // 移除引导页 DOM（节省资源，释放粒子动画）
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 1500);
    }

    enterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enterRoom();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.id === 'intro-particles') {
        enterRoom();
      }
    });

    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        document.removeEventListener('keydown', onKey);
        enterRoom();
      }
    });
  }

  function createIntroParticles() {
    const container = document.getElementById('intro-particles');
    if (!container) return;
    const count = 18;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.classList.add('intro-particle');
      const size = 1.5 + Math.random() * 3;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = (10 + Math.random() * 80) + '%';
      p.style.top = (40 + Math.random() * 60) + '%';
      p.style.animationDuration = (6 + Math.random() * 12) + 's';
      p.style.animationDelay = Math.random() * 8 + 's';
      container.appendChild(p);
    }
  }

  // ============================================================
  // BGM 播放器
  // ============================================================
  let bgmPlaying = true;
  window.toggleBGM = function() {
    const audio = document.getElementById('bgm-audio');
    const icon = document.getElementById('bgm-icon');
    if (!audio || !icon) return;
    if (bgmPlaying) {
      audio.pause();
      icon.textContent = '🔇';
    } else {
      audio.play().catch(() => {});
      icon.textContent = '🎵';
    }
    bgmPlaying = !bgmPlaying;
  };

  // ============================================================
  // 启动
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initRoom();  // 后台初始化房间
      initIntro(); // 设置引导页
    });
  } else {
    initRoom();
    initIntro();
  }
})();

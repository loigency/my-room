/**
 * 花树交互 — Disco Elysium 判定系统
 *
 * 点击花树 → 弹出对话框 → 选择「想」→ 掷骰子动画 →
 *   70% 成功 → 内陆帝国 [简单：成功]
 *   30% 失败 → 内陆帝国 [简单：失败]
 */

const TreeDialog = (() => {
  let dialog = null;
  let isOpen = false;

  const SUCCESS_TEXT = '内陆帝国 [简单：成功] — 这是房间主人在云南的一个边陲小镇里的花草小摊买到的，摊主说这是几十年前的一个上海人种下的，神奇的是这棵花树一直保持着这副模样，未曾长大也不曾枯萎，好像生命因某些东西的消逝就此永远停留在了那个瞬间......当你走进它的时候，不知道为什么脑海里浮现起了一首陌生而又熟悉的歌，歌词里唱着「蝴蝶儿飞去，心亦不在......」';

  const FAIL_TEXT = '内陆帝国 [简单：失败] — 你盯着这棵树看了很久，什么也没感应到。';

  function init() {
    dialog = document.getElementById('skill-check-dialog');
    if (!dialog) return;
    // 点击由 interaction.js 路由过来，这里只负责弹出判定
  }

  function open() {
    if (isOpen) return;
    isOpen = true;

    // 显示提示阶段
    dialog.innerHTML = `
      <div class="de-dialog-content">
        <p class="de-question">想要了解这棵花树的来历吗？</p>
        <div class="de-buttons">
          <button class="de-btn de-btn-yes" id="de-btn-yes">想</button>
          <button class="de-btn de-btn-no" id="de-btn-no">算了</button>
        </div>
      </div>
    `;
    dialog.classList.add('active');

    document.getElementById('de-btn-yes').addEventListener('click', () => rollDice());
    document.getElementById('de-btn-no').addEventListener('click', close);
  }

  function rollDice() {
    // 掷骰子动画
    dialog.innerHTML = `
      <div class="de-dialog-content">
        <p class="de-rolling">🎲 掷骰判定中...</p>
        <div class="de-dice-anim"></div>
      </div>
    `;

    // 判定
    setTimeout(() => {
      const success = Math.random() < 0.7;
      const text = success ? SUCCESS_TEXT : FAIL_TEXT;
      const cls = success ? 'de-success' : 'de-fail';
      const title = success ? '内陆帝国 [简单：成功]' : '内陆帝国 [简单：失败]';

      dialog.innerHTML = `
        <div class="de-dialog-content ${cls}">
          <p class="de-skill-title">${title}</p>
          <p class="de-skill-text">${text}</p>
          <button class="de-btn de-btn-close" id="de-btn-close">关闭</button>
        </div>
      `;

      document.getElementById('de-btn-close').addEventListener('click', close);
    }, 1800);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    dialog.classList.remove('active');
    dialog.innerHTML = '';
  }

  return { init, open, close };
})();

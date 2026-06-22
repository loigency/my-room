/**
 * 数字分身 — AI 聊天窗口
 *
 * 纯前端知识库匹配：
 *   1. 加载 data/chat-knowledge.json
 *   2. 用户输入 → 对知识库做关键词匹配 → 返回最合适的回答
 *   3. 无匹配时使用 fallback 回复
 *   4. 打字机效果逐字显示回答
 */

const DigitalTwin = (() => {
  let knowledge = null;
  let panel = null;
  let messagesEl = null;
  let inputEl = null;
  let isOpen = false;
  let isTyping = false;

  // ============================================================
  // 初始化
  // ============================================================
  async function init() {
    // 加载知识库
    try {
      const resp = await fetch('data/chat-knowledge.json');
      knowledge = await resp.json();
    } catch (e) {
      console.warn('Chat knowledge not loaded, using fallback');
      knowledge = { greeting: '你好！', qa: [], fallback: '我还不太会回答这个问题~' };
    }

    // 缓存 DOM
    panel = document.getElementById('chat-panel');
    messagesEl = document.getElementById('chat-messages');
    inputEl = document.getElementById('chat-input');

    if (!panel || !messagesEl || !inputEl) return;

    // 事件绑定
    document.getElementById('chat-toggle').addEventListener('click', togglePanel);
    document.getElementById('chat-close').addEventListener('click', closePanel);
    document.getElementById('chat-send').addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // 快捷问题
    document.querySelectorAll('.chat-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        inputEl.value = btn.textContent;
        handleSend();
      });
    });

    // 初始消息
    addMessage('assistant', knowledge.greeting);
  }

  // ============================================================
  // 面板控制
  // ============================================================
  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    if (isOpen) return;
    panel.classList.add('active');
    isOpen = true;
    setTimeout(() => inputEl.focus(), 400);
  }

  function closePanel() {
    if (!isOpen) return;
    panel.classList.remove('active');
    isOpen = false;
  }

  // ============================================================
  // 消息处理
  // ============================================================
  function handleSend() {
    const text = inputEl.value.trim();
    if (!text || isTyping) return;

    addMessage('user', text);
    inputEl.value = '';

    const answer = findAnswer(text);
    typeAnswer(answer);
  }

  // ============================================================
  // 知识库匹配
  // ============================================================
  function findAnswer(query) {
    if (!knowledge || !knowledge.qa || !knowledge.qa.length) {
      return knowledge.fallback || '...';
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const qa of knowledge.qa) {
      let score = 0;
      for (const kw of qa.keywords) {
        if (query.includes(kw)) {
          score += kw.length; // 关键词越长，匹配越强
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = qa;
      }
    }

    return bestMatch ? bestMatch.answer : knowledge.fallback;
  }

  // ============================================================
  // 打字机效果
  // ============================================================
  function typeAnswer(text) {
    isTyping = true;

    // 添加空消息气泡
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-assistant';
    messagesEl.appendChild(bubble);

    // 快捷问题按钮在打字时隐藏，打完再显示
    const quicks = document.querySelector('.chat-quicks');
    if (quicks) quicks.style.opacity = '0.3';

    let i = 0;
    const speed = 25 + Math.random() * 15; // 模拟打字速度变化

    function type() {
      if (i < text.length) {
        bubble.textContent += text[i];
        i++;
        messagesEl.scrollTop = messagesEl.scrollHeight;
        setTimeout(type, speed);
      } else {
        isTyping = false;
        if (quicks) quicks.style.opacity = '1';
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    setTimeout(type, 200); // 短暂停顿模拟"思考"
  }

  // ============================================================
  // 添加消息
  // ============================================================
  function addMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-${role}`;
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  return { init, openPanel, closePanel, togglePanel };
})();

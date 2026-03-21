/* ============================================================
   RegulatorPulse - Compliance Assistant Chat Stream
   Ported from CounselBrief chat-stream.js with RP-specific changes:
   - Header: "Compliance Assistant"
   - Blue color scheme (--blue, not --gold)
   - RP starter prompts
   - Storage key: rp_chat_history
   v1.0 (2026-03-20)
   ============================================================ */

(function (global) {
  'use strict';

  /* ── Constants ── */
  const MAX_HISTORY = 20;
  const STORAGE_KEY = 'rp_chat_history';

  /* ── State ── */
  let messages = [];
  let isStreaming = false;
  let abortController = null;
  let container = null;

  /* ── Storage ── */

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) messages = JSON.parse(raw);
    } catch (e) { messages = []; }
  }

  function saveHistory() {
    try {
      const trimmed = messages.slice(-MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {}
  }

  function clearHistory() {
    messages = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  /* ── Escape HTML ── */

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Simple Markdown ── */

  function renderMarkdown(text) {
    let html = esc(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  }

  /* ── Source Cards ── */

  function renderSourceCards(sources) {
    if (!sources || sources.length === 0) return '';
    const cards = sources.map(function (s) {
      return '<div class="rp-chat-source">' +
        '<div class="rp-chat-source-icon">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        '</div>' +
        '<div class="rp-chat-source-text">' +
          '<div class="rp-chat-source-title">' + esc(s.title || s.topic) + '</div>' +
          (s.snippet ? '<div class="rp-chat-source-snippet">' + esc(s.snippet) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="rp-chat-sources">' + cards + '</div>';
  }

  /* ── Render Full Chat ── */

  function render() {
    if (!container) return;

    const hasMessages = messages.length > 0;

    const messagesHtml = messages.map(function (m) {
      if (m.role === 'user') {
        return '<div class="rp-chat-msg rp-chat-user"><div class="rp-chat-bubble rp-chat-bubble-user">' + esc(m.content) + '</div></div>';
      } else {
        const sourcesHtml = renderSourceCards(m.sources);
        return '<div class="rp-chat-msg rp-chat-assistant">' +
          '<div class="rp-chat-avatar">RP</div>' +
          '<div class="rp-chat-bubble rp-chat-bubble-assistant">' +
            sourcesHtml +
            '<div class="rp-chat-text">' + renderMarkdown(m.content) + '</div>' +
          '</div>' +
        '</div>';
      }
    }).join('');

    const streamingIndicator = isStreaming
      ? '<div class="rp-chat-msg rp-chat-assistant" id="rp-chat-streaming">' +
          '<div class="rp-chat-avatar">RP</div>' +
          '<div class="rp-chat-bubble rp-chat-bubble-assistant rp-chat-bubble-streaming">' +
            '<div class="rp-chat-text" id="rp-chat-stream-text"></div>' +
            '<div class="rp-chat-typing" id="rp-chat-typing"><span></span><span></span><span></span></div>' +
          '</div>' +
        '</div>'
      : '';

    const emptyState = !hasMessages && !isStreaming
      ? '<div class="rp-chat-empty">' +
          '<div class="rp-chat-empty-title">Ask a compliance question</div>' +
          '<div class="rp-chat-empty-sub">Get instant answers on licensing, employment rules, inspections, and advertising requirements for your business.</div>' +
          '<div class="rp-chat-starters">' +
            '<button class="rp-chat-starter" data-query="What licenses do I need to open a medspa in Texas?">Medspa licensing in Texas</button>' +
            '<button class="rp-chat-starter" data-query="My employee\'s cosmetology license expired. What do I do?">Expired cosmetology license</button>' +
            '<button class="rp-chat-starter" data-query="Are there new gym liability waiver requirements?">Gym liability waivers</button>' +
            '<button class="rp-chat-starter" data-query="What health department inspections should I expect?">Health department inspections</button>' +
          '</div>' +
        '</div>'
      : '';

    container.innerHTML =
      '<div class="rp-chat-card" id="rp-chat-card">' +
        '<div class="rp-chat-header">' +
          '<div class="rp-chat-header-left">' +
            '<span class="rp-chat-header-title">Compliance Assistant</span>' +
          '</div>' +
          '<div class="rp-chat-header-right">' +
            (hasMessages
              ? '<button class="rp-chat-clear-btn" id="rp-chat-clear" title="Clear conversation">' +
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>' +
                  ' New' +
                '</button>'
              : '') +
          '</div>' +
        '</div>' +

        '<div class="rp-chat-messages" id="rp-chat-messages">' +
          emptyState +
          messagesHtml +
          streamingIndicator +
        '</div>' +

        '<div class="rp-chat-input-wrap">' +
          '<textarea id="rp-chat-input" class="rp-chat-input" rows="1" ' +
            'placeholder="Ask about regulations, compliance, licensing..."' +
            (isStreaming ? ' disabled' : '') +
          '></textarea>' +
          '<button class="rp-chat-send" id="rp-chat-send"' + (isStreaming ? ' disabled' : '') + '>' +
            (isStreaming
              ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
              : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
            ) +
          '</button>' +
        '</div>' +
      '</div>';

    wireEvents();
    scrollToBottom();
  }

  /* ── Wire DOM Events ── */

  function wireEvents() {
    const input   = document.getElementById('rp-chat-input');
    const sendBtn = document.getElementById('rp-chat-send');
    const clearBtn = document.getElementById('rp-chat-clear');

    if (input) {
      input.addEventListener('input', autoResize);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
      if (!isStreaming) setTimeout(function () { input.focus(); }, 50);
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        if (isStreaming) handleStop();
        else handleSend();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        clearHistory();
        render();
      });
    }

    container.querySelectorAll('.rp-chat-starter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const query = this.getAttribute('data-query');
        if (query) {
          messages.push({ role: 'user', content: query });
          saveHistory();
          render();
          streamResponse(query);
        }
      });
    });
  }

  /* ── Auto-resize Textarea ── */

  function autoResize() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  }

  /* ── Scroll to Bottom ── */

  function scrollToBottom() {
    const el = document.getElementById('rp-chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  /* ── Handle Send ── */

  function handleSend() {
    const input = document.getElementById('rp-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text || isStreaming) return;
    messages.push({ role: 'user', content: text });
    saveHistory();
    render();
    streamResponse(text);
  }

  /* ── Handle Stop ── */

  function handleStop() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    isStreaming = false;
    render();
  }

  /* ── Stream Response ── */

  async function streamResponse(query) {
    isStreaming = true;
    render();

    abortController = new AbortController();

    let profile = null;
    try {
      const raw = localStorage.getItem('rp_profile');
      if (raw) profile = JSON.parse(raw);
    } catch (e) {}

    const historyForApi = messages.slice(-10).map(function (m) {
      return { role: m.role, content: m.content };
    });

    let fullText = '';
    let sources  = [];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi, profile: profile }),
        signal: abortController.signal
      });

      if (!response.ok) throw new Error('Server error ' + response.status);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'sources') {
              sources = parsed.sources || [];
              updateStreamBubble(fullText, sources);
            } else if (parsed.type === 'delta') {
              fullText += parsed.text;
              updateStreamBubble(fullText, sources);
              scrollToBottom();
            } else if (parsed.type === 'error') {
              throw new Error(parsed.message || 'Stream error');
            }
          } catch (parseErr) {
            if (parseErr.message === 'Stream error' || (parseErr.message || '').startsWith('Server')) {
              throw parseErr;
            }
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        if (fullText) fullText += '\n\n*(Response stopped)*';
      } else {
        console.error('RP Chat error:', e);
        fullText = fullText || 'I was not able to process that request. Please try again.';
      }
    }

    isStreaming = false;
    abortController = null;

    if (fullText) {
      messages.push({
        role: 'assistant',
        content: fullText,
        sources: sources.length > 0 ? sources : undefined
      });
      saveHistory();
    }

    render();
  }

  /* ── Update Streaming Bubble ── */

  function updateStreamBubble(text, sources) {
    const bubble = document.querySelector('.rp-chat-bubble-streaming');
    if (!bubble) return;

    let sourcesContainer = bubble.querySelector('.rp-chat-sources');
    if (sources && sources.length > 0 && !sourcesContainer) {
      const div = document.createElement('div');
      div.innerHTML = renderSourceCards(sources);
      const newSources = div.firstElementChild;
      if (newSources) bubble.insertBefore(newSources, bubble.firstChild);
    }

    const streamText = document.getElementById('rp-chat-stream-text');
    if (streamText && text) streamText.innerHTML = renderMarkdown(text);

    const typing = document.getElementById('rp-chat-typing');
    if (typing && text) typing.style.display = 'none';
  }

  /* ── Styles ── */

  function injectStyles() {
    if (document.getElementById('rp-chat-stream-styles')) return;
    const style = document.createElement('style');
    style.id = 'rp-chat-stream-styles';
    style.textContent = `
      /* ── Chat Card ── */
      .rp-chat-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        margin-bottom: 1rem;
      }

      /* ── Header ── */
      .rp-chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: .45rem 1rem;
        border-bottom: 1px solid var(--border);
        background: var(--bg);
      }

      .rp-chat-header-left {
        display: flex;
        align-items: center;
        gap: .5rem;
      }

      .rp-chat-header-title {
        font-size: .72rem;
        font-weight: 700;
        letter-spacing: .1em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .rp-chat-header-right { display: flex; gap: .5rem; }

      .rp-chat-clear-btn {
        display: inline-flex;
        align-items: center;
        gap: .35rem;
        background: none;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: .3rem .65rem;
        font-family: 'Inter', sans-serif;
        font-size: .72rem;
        font-weight: 600;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 150ms ease;
      }

      .rp-chat-clear-btn:hover {
        border-color: var(--blue);
        color: var(--navy);
      }

      /* ── Messages Area ── */
      .rp-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: .75rem 1rem;
        max-height: 400px;
        min-height: 120px;
        scroll-behavior: smooth;
      }

      /* ── Empty State ── */
      .rp-chat-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1rem 1rem 1.25rem;
        text-align: center;
      }

      .rp-chat-empty-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text);
        margin-bottom: .35rem;
      }

      .rp-chat-empty-sub {
        font-size: .83rem;
        color: var(--text-muted);
        line-height: 1.5;
        max-width: 420px;
        margin-bottom: 1.1rem;
      }

      .rp-chat-starters {
        display: flex;
        flex-wrap: wrap;
        gap: .5rem;
        justify-content: center;
      }

      .rp-chat-starter {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: .4rem .85rem;
        font-family: 'Inter', sans-serif;
        font-size: .78rem;
        color: var(--text);
        cursor: pointer;
        transition: all 150ms ease;
      }

      .rp-chat-starter:hover {
        border-color: var(--blue);
        background: var(--blue-pale);
        color: var(--navy);
      }

      /* ── Message Bubbles ── */
      .rp-chat-msg {
        display: flex;
        gap: .6rem;
        margin-bottom: .85rem;
        animation: rp-chat-fadein 200ms ease;
      }

      @keyframes rp-chat-fadein {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .rp-chat-user { justify-content: flex-end; }
      .rp-chat-assistant { justify-content: flex-start; align-items: flex-start; }

      .rp-chat-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--navy);
        color: #fff;
        font-size: .58rem;
        font-weight: 800;
        letter-spacing: .03em;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .rp-chat-bubble {
        max-width: 85%;
        border-radius: 12px;
        padding: .75rem 1rem;
        line-height: 1.6;
        font-size: .87rem;
      }

      .rp-chat-bubble-user {
        background: var(--blue);
        color: #fff;
        border-bottom-right-radius: 4px;
      }

      .rp-chat-bubble-assistant {
        background: var(--bg);
        color: var(--text);
        border: 1px solid var(--border);
        border-bottom-left-radius: 4px;
      }

      .rp-chat-bubble-assistant p { margin: 0 0 .5rem; }
      .rp-chat-bubble-assistant p:last-child { margin-bottom: 0; }
      .rp-chat-bubble-assistant strong { color: var(--navy); }
      .rp-chat-bubble-assistant code {
        background: rgba(0,0,0,.06);
        padding: .1rem .35rem;
        border-radius: 3px;
        font-size: .82em;
      }

      /* ── Source Cards ── */
      .rp-chat-sources {
        display: flex;
        flex-direction: column;
        gap: .4rem;
        margin-bottom: .75rem;
        padding-bottom: .65rem;
        border-bottom: 1px solid var(--border);
      }

      .rp-chat-source {
        display: flex;
        align-items: flex-start;
        gap: .5rem;
        padding: .45rem .6rem;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 6px;
        transition: border-color 150ms ease;
      }

      .rp-chat-source:hover { border-color: var(--blue); }
      .rp-chat-source-icon { color: var(--blue); flex-shrink: 0; margin-top: 2px; }

      .rp-chat-source-title {
        font-size: .76rem;
        font-weight: 700;
        color: var(--navy);
        margin-bottom: .1rem;
      }

      .rp-chat-source-snippet {
        font-size: .72rem;
        color: var(--text-muted);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* ── Typing Indicator ── */
      .rp-chat-typing {
        display: flex;
        gap: 4px;
        padding: .3rem 0;
      }

      .rp-chat-typing span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--text-muted);
        animation: rp-typing 1.4s infinite ease-in-out;
      }

      .rp-chat-typing span:nth-child(1) { animation-delay: 0s; }
      .rp-chat-typing span:nth-child(2) { animation-delay: .16s; }
      .rp-chat-typing span:nth-child(3) { animation-delay: .32s; }

      @keyframes rp-typing {
        0%, 80%, 100% { transform: scale(0); opacity: .4; }
        40% { transform: scale(1); opacity: 1; }
      }

      /* ── Input Area ── */
      .rp-chat-input-wrap {
        display: flex;
        align-items: flex-end;
        gap: .5rem;
        padding: .5rem .75rem;
        border-top: 1px solid var(--border);
        background: var(--card);
      }

      .rp-chat-input {
        flex: 1;
        border: 1.5px solid var(--border);
        border-radius: 8px;
        padding: .55rem .75rem;
        font-family: 'Inter', sans-serif;
        font-size: .87rem;
        color: var(--text);
        background: var(--bg);
        resize: none;
        line-height: 1.5;
        max-height: 120px;
        transition: border-color 200ms ease, background 200ms ease;
      }

      .rp-chat-input:focus {
        outline: none;
        border-color: var(--blue);
        background: var(--card);
      }

      .rp-chat-input::placeholder { color: var(--text-muted); }
      .rp-chat-input:disabled { opacity: .6; cursor: not-allowed; }

      .rp-chat-send {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        border: none;
        background: var(--blue);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 150ms ease, transform 100ms ease;
      }

      .rp-chat-send:hover { background: var(--blue-light); transform: translateY(-1px); }
      .rp-chat-send:active { transform: translateY(0); }
      .rp-chat-send:disabled { opacity: .5; cursor: not-allowed; transform: none; }

      /* ── Responsive ── */
      @media (max-width: 768px) {
        .rp-chat-messages { max-height: 320px; }
        .rp-chat-bubble { max-width: 92%; }
        .rp-chat-starters { flex-direction: column; }
        .rp-chat-starter { text-align: left; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Init ── */

  function init() {
    injectStyles();

    const dashContent = document.getElementById('rp-dashboard-content');
    if (!dashContent) return;

    const welcomeBanner = dashContent.querySelector('.rp-welcome');
    const wrap = document.createElement('div');
    wrap.id = 'rp-chat-stream-wrap';
    wrap.className = 'rp-chat-wrap';

    if (welcomeBanner && welcomeBanner.nextSibling) {
      dashContent.insertBefore(wrap, welcomeBanner.nextSibling);
    } else {
      dashContent.insertBefore(wrap, dashContent.firstChild);
    }

    container = wrap;
    loadHistory();
    render();
  }

  /* ── Boot ── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.RPChatStream = { init: init, clearHistory: clearHistory };

})(window);

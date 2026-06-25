/* ══════════════════════════════════════════════════════════════════════════
   OLLAMA CHAT — APP LOGIC
   ══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const OLLAMA_BASE = 'http://localhost:11434';

// ── State ───────────────────────────────────────────────────────────────────
let state = {
  messages: [],          // { role: 'user'|'assistant', content: string }[]
  model: '',
  streaming: true,
  systemPrompt: '',
  conversations: [],     // saved conversation snapshots
  activeConvId: null,
  isGenerating: false,
  abortController: null,
};

// ── DOM Refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
  sidebar:            $('sidebar'),
  sidebarToggle:      $('sidebarToggle'),
  sidebarOpen:        $('sidebarOpen'),
  modelSelect:        $('modelSelect'),
  refreshModels:      $('refreshModels'),
  statusDot:          $('statusDot'),
  statusText:         $('statusText'),
  pullModelInput:     $('pullModelInput'),
  pullModelSelect:    $('pullModelSelect'),
  modelInfoBadge:     $('modelInfoBadge'),
  modelInfoName:      $('modelInfoName'),
  modelInfoSize:      $('modelInfoSize'),
  customModelWrapper: $('customModelWrapper'),
  pullModelBtn:       $('pullModelBtn'),
  pullProgress:       $('pullProgress'),
  progressFill:       $('progressFill'),
  progressLabel:      $('progressLabel'),
  streamToggle:       $('streamToggle'),
  systemPromptToggle: $('systemPromptToggle'),
  systemPromptWrapper:$('systemPromptWrapper'),
  systemPrompt:       $('systemPrompt'),
  conversationsList:  $('conversationsList'),
  newChatBtn:         $('newChatBtn'),
  topbarModel:        $('topbarModel'),
  clearChatBtn:       $('clearChatBtn'),
  messagesContainer:  $('messagesContainer'),
  emptyState:         $('emptyState'),
  userInput:          $('userInput'),
  charCounter:        $('charCounter'),
  sendBtn:            $('sendBtn'),
  toastContainer:     $('toastContainer'),
  suggestionChips:    $('suggestionChips'),
};

// ── Toast Notifications ──────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3500) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;

  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };

  el.innerHTML = `<span>${icons[type] ?? 'ℹ'}</span><span>${message}</span>`;
  els.toastContainer.appendChild(el);

  setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ── Ollama API Helpers ────────────────────────────────────────────────────────
async function fetchOllama(path, options = {}) {
  const res = await fetch(`${OLLAMA_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Ollama API error ${res.status}: ${res.statusText}`);
  return res;
}

async function checkOllamaStatus() {
  setStatus('loading', 'Connecting…');
  try {
    await fetchOllama('/api/tags');
    setStatus('online', 'Connected');
    return true;
  } catch {
    setStatus('offline', 'Ollama offline');
    return false;
  }
}

function setStatus(state, text) {
  els.statusDot.className = `status-dot ${state}`;
  els.statusText.textContent = text;
}

async function loadModels() {
  try {
    const res = await fetchOllama('/api/tags');
    const data = await res.json();
    const models = data.models ?? [];

    els.modelSelect.innerHTML = '';

    if (models.length === 0) {
      els.modelSelect.innerHTML = '<option value="" disabled selected>No models found — pull one below</option>';
      return;
    }

    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name;
      els.modelSelect.appendChild(opt);
    });

    // prefer llama3.2 if available, else first
    const preferred = models.find(m => m.name.startsWith('llama3.2'));
    els.modelSelect.value = preferred ? preferred.name : models[0].name;
    state.model = els.modelSelect.value;
    updateTopbarModel();
    setStatus('online', `${models.length} model${models.length !== 1 ? 's' : ''} available`);
  } catch (err) {
    toast('Could not load models. Is Ollama running?', 'error');
    setStatus('offline', 'Ollama offline');
  }
}

// ── Markdown Renderer ─────────────────────────────────────────────────────────
// Lightweight renderer — no external dependencies
function renderMarkdown(text) {
  // Escape HTML entities first for security
  const escapeHtml = s =>
    s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  let html = '';
  const lines = text.split('\n');
  let inCodeBlock = false;
  let codeLang = '';
  let codeContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block fence
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim() || 'text';
        codeContent = [];
      } else {
        // Close code block
        const escaped = escapeHtml(codeContent.join('\n'));
        html += `<pre><div class="code-header"><span class="code-lang">${escapeHtml(codeLang)}</span><button class="copy-code-btn" onclick="copyCode(this)">⎘ Copy</button></div><code>${escaped}</code></pre>`;
        inCodeBlock = false;
        codeLang = '';
        codeContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Headings
    if (line.startsWith('### ')) { html += `<h3>${inlineRender(line.slice(4))}</h3>`; continue; }
    if (line.startsWith('## '))  { html += `<h2>${inlineRender(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('# '))   { html += `<h1>${inlineRender(line.slice(2))}</h1>`; continue; }

    // Horizontal rule
    if (/^(---|\*\*\*|___)$/.test(line.trim())) { html += '<hr>'; continue; }

    // Unordered list
    if (/^[-*+] /.test(line)) { html += `<ul><li>${inlineRender(line.slice(2))}</li></ul>`; continue; }

    // Ordered list
    if (/^\d+\. /.test(line)) { html += `<ol><li>${inlineRender(line.replace(/^\d+\.\s/, ''))}</li></ol>`; continue; }

    // Blank line
    if (line.trim() === '') { html += '<br>'; continue; }

    // Paragraph
    html += `<p>${inlineRender(line)}</p>`;
  }

  // If code block wasn't closed
  if (inCodeBlock) {
    html += `<pre><code>${escapeHtml(codeContent.join('\n'))}</code></pre>`;
  }

  // Merge consecutive list items
  html = html
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/<\/ol>\s*<ol>/g, '');

  return html;
}

function inlineRender(text) {
  const escapeHtml = s =>
    s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return escapeHtml(text)
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

// Copy code to clipboard
window.copyCode = function(btn) {
  const code = btn.closest('pre').querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = '⎘ Copy'; }, 2000);
  });
};

// ── Message Rendering ─────────────────────────────────────────────────────────
function createMessageEl(role, content = '') {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';

  if (role === 'user') {
    avatar.textContent = 'You';
  } else {
    avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.textContent = formatTime(new Date());

  const inner = document.createElement('div');
  inner.className = 'bubble-content';

  if (content) {
    inner.innerHTML = role === 'assistant' ? renderMarkdown(content) : escapeHtmlBasic(content);
  }

  bubble.appendChild(inner);
  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);

  // Store reference for streaming
  wrapper._contentEl = inner;
  wrapper._role = role;

  return wrapper;
}

function escapeHtmlBasic(text) {
  return text
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(role, content = '') {
  hideEmptyState();
  const el = createMessageEl(role, content);
  els.messagesContainer.appendChild(el);
  scrollToBottom();
  return el;
}

function showTypingIndicator() {
  hideTypingIndicator();
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';

  el.appendChild(avatar);
  el.appendChild(dots);
  els.messagesContainer.appendChild(el);
  scrollToBottom();
}

function hideTypingIndicator() {
  $('typingIndicator')?.remove();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
  });
}

function hideEmptyState() {
  els.emptyState.style.display = 'none';
}

function showEmptyState() {
  els.emptyState.style.display = '';
}

// ── Send Message ──────────────────────────────────────────────────────────────
async function sendMessage(text) {
  text = text.trim();
  if (!text || state.isGenerating) return;

  if (!state.model) {
    toast('Please select a model first.', 'error');
    return;
  }

  // Add to state
  state.messages.push({ role: 'user', content: text });
  appendMessage('user', text);

  // Reset input
  els.userInput.value = '';
  els.userInput.style.height = 'auto';
  els.charCounter.textContent = '';
  els.sendBtn.disabled = true;

  setGenerating(true);

  const useStream = state.streaming;

  if (useStream) {
    await sendStreaming(text);
  } else {
    await sendBlocking(text);
  }

  setGenerating(false);
  autoSaveConversation();
}

async function sendStreaming(userText) {
  showTypingIndicator();

  const controller = new AbortController();
  state.abortController = controller;

  try {
    const body = buildRequestBody(true);
    const res = await fetchOllama('/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    hideTypingIndicator();

    const msgEl = appendMessage('assistant', '');
    let fullContent = '';

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            fullContent += json.message.content;
            msgEl._contentEl.innerHTML = renderMarkdown(fullContent);
            scrollToBottom();
          }
          if (json.done) break;
        } catch { /* ignore parse errors in partial chunks */ }
      }
    }

    state.messages.push({ role: 'assistant', content: fullContent });

  } catch (err) {
    hideTypingIndicator();
    if (err.name !== 'AbortError') {
      toast(`Error: ${err.message}`, 'error');
      appendMessage('assistant', `⚠️ Error: ${err.message}`);
    }
  }
}

async function sendBlocking(userText) {
  showTypingIndicator();

  try {
    const body = buildRequestBody(false);
    const res = await fetchOllama('/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await res.json();
    hideTypingIndicator();
    const content = data.message?.content ?? '(empty response)';
    appendMessage('assistant', content);
    state.messages.push({ role: 'assistant', content });
  } catch (err) {
    hideTypingIndicator();
    toast(`Error: ${err.message}`, 'error');
    appendMessage('assistant', `⚠️ Error: ${err.message}`);
  }
}

function buildRequestBody(stream) {
  const messages = [];

  // Include system prompt if set
  const sysPrompt = state.systemPrompt.trim();
  if (sysPrompt) {
    messages.push({ role: 'system', content: sysPrompt });
  }

  messages.push(...state.messages);

  return {
    model: state.model,
    messages,
    stream,
  };
}

function setGenerating(isGenerating) {
  state.isGenerating = isGenerating;
  els.sendBtn.disabled = isGenerating || !els.userInput.value.trim();

  if (isGenerating) {
    els.sendBtn.classList.add('loading');
    els.sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="10"/></svg>`;
    els.sendBtn.title = 'Stop generation';
    els.sendBtn.onclick = stopGeneration;
  } else {
    els.sendBtn.classList.remove('loading');
    els.sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    els.sendBtn.title = 'Send message';
    els.sendBtn.onclick = null;
  }
}

function stopGeneration() {
  state.abortController?.abort();
  hideTypingIndicator();
  setGenerating(false);
  toast('Generation stopped.', 'info');
}

// ── Pull Model ─────────────────────────────────────────────────────────────────
async function pullModel() {
  let modelName = '';
  if (els.pullModelSelect.value === '__custom__') {
    modelName = els.pullModelInput.value.trim();
  } else {
    modelName = els.pullModelSelect.value;
  }

  if (!modelName) {
    toast('Please select or enter a model name.', 'error');
    return;
  }

  els.pullProgress.style.display = 'block';
  els.progressFill.style.width = '0%';
  els.progressLabel.textContent = 'Starting…';
  els.pullModelBtn.disabled = true;

  try {
    const res = await fetchOllama('/api/pull', {
      method: 'POST',
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          const status = json.status ?? '';

          if (json.total && json.completed) {
            const pct = Math.round((json.completed / json.total) * 100);
            els.progressFill.style.width = `${pct}%`;
            els.progressLabel.textContent = `${status} — ${pct}%`;
          } else {
            els.progressLabel.textContent = status;
            // Animate progress bar indeterminately
            els.progressFill.style.width = '60%';
          }

          if (status === 'success') {
            els.progressFill.style.width = '100%';
            els.progressLabel.textContent = '✓ Download complete!';
            toast(`Model "${modelName}" pulled successfully!`, 'success');
            await loadModels();
            els.pullModelInput.value = '';
            els.pullModelSelect.value = '';
            els.customModelWrapper.style.display = 'none';
            els.modelInfoBadge.style.display = 'none';
            setTimeout(() => { els.pullProgress.style.display = 'none'; }, 2000);
          }
        } catch { /* ignore */ }
      }
    }
  } catch (err) {
    toast(`Pull failed: ${err.message}`, 'error');
    els.progressLabel.textContent = `Error: ${err.message}`;
  } finally {
    els.pullModelBtn.disabled = false;
  }
}

// ── Conversations ─────────────────────────────────────────────────────────────
function autoSaveConversation() {
  if (state.messages.length === 0) return;

  const firstUserMsg = state.messages.find(m => m.role === 'user')?.content ?? 'Chat';
  const title = firstUserMsg.length > 40 ? firstUserMsg.slice(0, 40) + '…' : firstUserMsg;

  if (state.activeConvId === null) {
    const id = Date.now();
    state.activeConvId = id;
    const conv = { id, title, messages: [...state.messages], model: state.model, ts: Date.now() };
    state.conversations.unshift(conv);
  } else {
    const conv = state.conversations.find(c => c.id === state.activeConvId);
    if (conv) {
      conv.messages = [...state.messages];
      conv.ts = Date.now();
    }
  }

  renderConversations();
  saveToLocalStorage();
}

function renderConversations() {
  els.conversationsList.innerHTML = '';

  if (state.conversations.length === 0) {
    els.conversationsList.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;padding:8px 0;text-align:center;">No saved chats yet</div>';
    return;
  }

  state.conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = `conv-item ${conv.id === state.activeConvId ? 'active' : ''}`;
    item.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span>${conv.title}</span>
    `;
    item.title = conv.title;
    item.addEventListener('click', () => loadConversation(conv.id));
    els.conversationsList.appendChild(item);
  });
}

function loadConversation(id) {
  const conv = state.conversations.find(c => c.id === id);
  if (!conv) return;

  state.messages = [...conv.messages];
  state.activeConvId = id;
  state.model = conv.model;

  // Update model select
  els.modelSelect.value = conv.model;
  updateTopbarModel();

  // Re-render messages
  clearMessages();
  conv.messages.forEach(m => appendMessage(m.role, m.content));

  renderConversations();
  toast(`Loaded: ${conv.title}`, 'info');
}

function newChat() {
  state.messages = [];
  state.activeConvId = null;
  clearMessages();
  showEmptyState();
  renderConversations();
}

function clearMessages() {
  // Remove all message elements, keep empty state
  const children = [...els.messagesContainer.children];
  children.forEach(c => {
    if (c.id !== 'emptyState') c.remove();
  });
}

// ── Local Storage ─────────────────────────────────────────────────────────────
function saveToLocalStorage() {
  try {
    localStorage.setItem('ollama_chat_conversations', JSON.stringify(state.conversations));
  } catch { /* ignore quota errors */ }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('ollama_chat_conversations');
    if (raw) {
      state.conversations = JSON.parse(raw);
      renderConversations();
    }
  } catch { /* ignore */ }
}

// ── Sidebar Toggle ─────────────────────────────────────────────────────────────
function updateTopbarModel() {
  els.topbarModel.textContent = state.model || 'No model selected';
}

function toggleSidebar() {
  els.sidebar.classList.toggle('collapsed');
  const isCollapsed = els.sidebar.classList.contains('collapsed');
  els.sidebarOpen.style.display = isCollapsed ? 'flex' : 'none';
}

// ── Auto-resize textarea ──────────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

// ── Event Listeners ───────────────────────────────────────────────────────────
function initEventListeners() {
  // Sidebar
  els.sidebarToggle.addEventListener('click', toggleSidebar);
  els.sidebarOpen.addEventListener('click', toggleSidebar);

  // Model
  els.modelSelect.addEventListener('change', () => {
    state.model = els.modelSelect.value;
    updateTopbarModel();
  });
  els.refreshModels.addEventListener('click', loadModels);

  // Pull model
  els.pullModelSelect.addEventListener('change', () => {
    const val = els.pullModelSelect.value;
    if (val === '__custom__') {
      els.customModelWrapper.style.display = 'block';
      els.modelInfoBadge.style.display = 'none';
      els.pullModelInput.focus();
    } else {
      els.customModelWrapper.style.display = 'none';
      
      const opt = els.pullModelSelect.options[els.pullModelSelect.selectedIndex];
      const size = opt.getAttribute('data-size') || '';
      
      els.modelInfoBadge.style.display = 'flex';
      els.modelInfoName.textContent = val;
      els.modelInfoSize.textContent = size;
    }
  });

  els.pullModelBtn.addEventListener('click', pullModel);
  els.pullModelInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') pullModel();
  });

  // Stream toggle
  els.streamToggle.addEventListener('change', () => {
    state.streaming = els.streamToggle.checked;
  });

  // System prompt toggle
  els.systemPromptToggle.addEventListener('change', () => {
    els.systemPromptWrapper.style.display = els.systemPromptToggle.checked ? 'block' : 'none';
  });

  els.systemPrompt.addEventListener('input', () => {
    state.systemPrompt = els.systemPrompt.value;
  });

  // New chat
  els.newChatBtn.addEventListener('click', newChat);

  // Clear chat
  els.clearChatBtn.addEventListener('click', () => {
    if (state.messages.length === 0) return;
    if (confirm('Clear this conversation? This cannot be undone.')) newChat();
  });

  // Input
  els.userInput.addEventListener('input', () => {
    autoResize(els.userInput);
    const len = els.userInput.value.length;
    els.charCounter.textContent = len > 100 ? `${len}` : '';
    els.sendBtn.disabled = !els.userInput.value.trim() || state.isGenerating;
  });

  els.userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(els.userInput.value);
    }
  });

  // Send button
  els.sendBtn.addEventListener('click', () => {
    if (!state.isGenerating) sendMessage(els.userInput.value);
  });

  // Suggestion chips
  els.suggestionChips?.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      els.userInput.value = chip.dataset.prompt;
      autoResize(els.userInput);
      els.sendBtn.disabled = false;
      els.userInput.focus();
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  initEventListeners();
  loadFromLocalStorage();

  const ok = await checkOllamaStatus();
  if (ok) {
    await loadModels();
  } else {
    toast('Cannot reach Ollama at localhost:11434. Make sure Docker is running.', 'error', 6000);
    els.modelSelect.innerHTML = '<option value="" disabled selected>Ollama offline</option>';
  }
}

document.addEventListener('DOMContentLoaded', init);

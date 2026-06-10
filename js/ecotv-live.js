/* =========================================================
   EcoTV Live Module
   HLS init, chat, reactions, Flash Deal, Poll
   ========================================================= */

import { EcoTV } from './ecotv-core.js';

const { utils, state, bus } = EcoTV;

export class EcoTVLive {
  constructor(options = {}) {
    this.liveData = options.liveData || null;
    this.player = null;
    this.container = options.container || document.getElementById('tvLivePlayerContainer');
    this.chatContainer = options.chatContainer || document.getElementById('tvChatMessages');
    this.chatInput = options.chatInput || document.getElementById('tvChatInput');
    this.chatSend = options.chatSend || document.getElementById('tvChatSend');
    this.reactionsContainer = options.reactionsContainer || document.getElementById('tvReactions');
    this.flashDealContainer = options.flashDealContainer || document.getElementById('tvFlashDeal');
    this.pollContainer = options.pollContainer || document.getElementById('tvPoll');

    this.messages = [];
    this.userMessages = [];
    this.reactionQueue = [];
    this.activeReactions = 0;
    this.maxConcurrentReactions = 3;
    this.chatRateLimit = 1500;
    this.lastChatTime = 0;
    this.emojiPickerVisible = false;
    this.mockChatInterval = null;
    this.mockViewerInterval = null;
    this.activeDeal = null;
    this.dealTimer = null;
    this.activePoll = null;
    this.pollVotes = {};
  }

  async init(liveData) {
    if (liveData) this.liveData = liveData;
    if (!this.liveData) return;

    await this.loadVideoJS();
    this.createPlayer();
    this.setupChat();
    this.setupReactions();
    this.setupEmojiPicker();
    this.startMockChatMessages();
    this.startMockViewerCount();
  }

  async loadVideoJS() {
    const needs = [];
    if (!window.videojs) {
      needs.push(new Promise(resolve => {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video-js.min.css';
        document.head.appendChild(l);
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video.min.js';
        s.onload = resolve;
        document.head.appendChild(s);
      }));
    }
    if (!window.Hls) {
      needs.push(new Promise(resolve => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.8/hls.min.js';
        s.onload = resolve;
        document.head.appendChild(s);
      }));
    }
    await Promise.all(needs);
  }

  createPlayer() {
    this.container.innerHTML = `
      <div style="position:relative">
        <video id="tvLiveVideo" class="video-js" controls autoplay playsinline
          data-setup='{"fluid":true,"controls":true,"liveui":true,"sources":[{"src":"${this.liveData.streamUrl}","type":"application/x-mpegURL"}]}'
        ></video>
        <span class="live-badge-big" style="position:absolute;top:12px;left:12px;z-index:10">
          <i class="fas fa-circle"></i> LIVE
        </span>
        <span style="position:absolute;top:12px;right:12px;z-index:10;background:rgba(0,0,0,0.6);color:#fff;padding:4px 10px;border-radius:var(--tv-radius);font-size:0.78rem">
          <i class="fas fa-eye"></i> <span id="liveViewerCount">0</span> đang xem
        </span>
        <span style="position:absolute;bottom:60px;left:12px;z-index:10;background:rgba(0,0,0,0.6);color:#fff;padding:4px 10px;border-radius:var(--tv-radius);font-size:0.72rem">
          Trễ ~3s
        </span>
      </div>
    `;
    this.player = videojs('tvLiveVideo');
    this.player.ready(() => {
      if (this.player.liveTracker) this.player.liveTracker.start();
    });
  }

  // === Chat ===
  setupChat() {
    if (!this.chatInput || !this.chatSend) return;

    this.chatSend.addEventListener('click', () => this.sendChat());
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChat();
      }
      this.handleMention(e);
    });
  }

  sendChat() {
    const text = this.chatInput.value.trim();
    if (!text) return;

    const now = Date.now();
    if (now - this.lastChatTime < this.chatRateLimit) {
      utils.showToast('Vui lòng chờ 1.5s giữa các tin nhắn', 'fa-clock', 2000);
      return;
    }

    this.lastChatTime = now;
    this.addChatMessage({
      id: 'msg-' + Date.now(),
      user: 'Bạn',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=viewer' + Math.floor(Math.random() * 1000),
      text: text,
      timestamp: Date.now(),
    });
    this.chatInput.value = '';
    this.chatInput.focus();
  }

  addChatMessage(msg) {
    const div = document.createElement('div');
    div.className = 'tv-chat-msg' + (msg.pinned ? ' pinned' : '');
    div.innerHTML = `
      <img src="${msg.avatar}" alt="">
      <div>
        <span class="tv-chat-user${msg.isHost ? ' host' : ''}">${utils.escapeHtml(msg.user)}</span>
        <span>${utils.escapeHtml(msg.text)}</span>
      </div>
    `;
    this.chatContainer.appendChild(div);
    this.messages.push(msg);

    // Virtual scroll: remove old messages if > 200
    if (this.messages.length > 200) {
      const remove = this.messages.length - 200;
      for (let i = 0; i < remove; i++) {
        if (this.chatContainer.firstChild) {
          this.chatContainer.firstChild.remove();
        }
      }
      this.messages.splice(0, remove);
    }

    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  handleMention(e) {
    if (e.key === '@') {
      // Simple mention suggestion - in production, show dropdown
    }
  }

  // === Emoji picker ===
  setupEmojiPicker() {
    const emojiBtn = document.getElementById('tvEmojiBtn');
    if (!emojiBtn) return;
    emojiBtn.addEventListener('click', () => {
      let picker = document.querySelector('.tv-emoji-picker');
      if (picker) {
        picker.remove();
        return;
      }
      const emojis = ['😀', '😂', '❤️', '🔥', '👍', '🎉', '😍', '🙏', '💚', '🌿', '🥬', '🍅', '🥕', '🌱', '☀️', '💧', '🌟', '🍃', '🌻', '💯'];
      picker = document.createElement('div');
      picker.className = 'tv-emoji-picker';
      picker.innerHTML = emojis.map(e => `<button data-emoji="${e}">${e}</button>`).join('');
      emojiBtn.parentElement.style.position = 'relative';
      emojiBtn.parentElement.appendChild(picker);
      picker.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-emoji]');
        if (btn) {
          this.chatInput.value += btn.dataset.emoji;
          this.chatInput.focus();
          picker.remove();
        }
      });
    });
  }

  // === Mock chat messages ===
  startMockChatMessages() {
    const names = ['Minh Anh', 'Hoàng Long', 'Thu Thảo', 'Đức Mạnh', 'Kim Ngân', 'Tuấn Kiệt', 'Bảo Trân', 'Anh Khoa', 'Quỳnh Như', 'Minh Quân'];
    const msgs = ['Sản phẩm này có ngon không ạ?', 'Cho em xin thêm thông tin!', 'Đã order rồi ạ!', 'Ưu đãi quá hời!', 'Có ship toàn quốc không?', 'Bao nhiêu tiền vậy ạ?', 'Em ở Hà Nội có mua được không?', 'Cho em hỏi nguồn gốc sản phẩm?', 'Video rất hay!', 'Đã like và theo dõi kênh!', 'Còn hàng không ạ?', 'Mua ở đâu vậy ạ?', 'Giá tốt quá!', 'Sẽ giới thiệu cho bạn bè!', 'Cảm ơn chia sẻ hữu ích!'];

    this.mockChatInterval = setInterval(() => {
      const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
      const randomName = names[Math.floor(Math.random() * names.length)];
      this.addChatMessage({
        id: 'msg-' + Date.now(),
        user: randomName,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + randomName,
        text: randomMsg,
        timestamp: Date.now(),
      });
    }, 3000 + Math.random() * 4000);
  }

  startMockViewerCount() {
    const countEl = document.getElementById('liveViewerCount');
    if (!countEl) return;
    let count = this.liveData.viewerCount || 100;
    this.mockViewerInterval = setInterval(() => {
      count += Math.floor(Math.random() * 5) - 2;
      count = Math.max(0, count);
      countEl.textContent = utils.formatViews(count);
    }, 5000);
  }

  // === Reactions ===
  setupReactions() {
    if (!this.reactionsContainer) return;
    this.reactionsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tv-react-btn');
      if (!btn) return;
      const icon = btn.dataset.icon;
      const countEl = btn.querySelector('.tv-react-count');
      if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1;
      this.fireReaction(icon);
    });
  }

  fireReaction(icon) {
    if (this.activeReactions >= this.maxConcurrentReactions) {
      this.reactionQueue.push(icon);
      return;
    }

    this.activeReactions++;
    const el = document.createElement('div');
    el.className = 'tv-reaction-fly';
    el.textContent = icon;
    const xOffset = Math.floor(Math.random() * 60) - 30;
    el.style.left = (window.innerWidth / 2 + xOffset) + 'px';
    el.style.bottom = '100px';
    document.body.appendChild(el);

    el.addEventListener('animationend', () => {
      el.remove();
      this.activeReactions--;
      if (this.reactionQueue.length > 0) {
        this.fireReaction(this.reactionQueue.shift());
      }
    });
  }

  // === Flash Deal ===
  showFlashDeal(deal) {
    if (!this.flashDealContainer) return;
    this.activeDeal = deal;
    const totalSeconds = deal.duration * 60;
    let remaining = totalSeconds;

    const render = () => {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      this.flashDealContainer.innerHTML = `
        <div class="tv-flash-deal">
          <div class="tv-fd-badge">🔥 LIVE DEAL - ${deal.discountPercent}% OFF</div>
          <h4>${utils.escapeHtml(deal.productName || 'Siêu deal')}</h4>
          <div class="tv-fd-prices">
            <strike>${utils.formatCurrency(deal.originalPrice)}</strike>
            <strong>${utils.formatCurrency(deal.price)}</strong>
          </div>
          <div class="tv-fd-timer">
            <i class="fas fa-clock"></i>
            <span id="fdTimer">${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}</span>
          </div>
          <div class="tv-fd-progress">
            <span style="width:${(remaining / totalSeconds) * 100}%"></span>
          </div>
          <div style="font-size:0.78rem;color:var(--tv-text-muted);margin-bottom:6px">
            Còn <strong>${deal.remainingStock || 10}</strong> sản phẩm
          </div>
          <button class="tv-fd-buy"><i class="fas fa-bolt"></i> Mua ngay</button>
        </div>
      `;
    };

    render();
    this.dealTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.dealTimer);
        this.flashDealContainer.innerHTML = `
          <div class="tv-flash-deal" style="border-color:var(--tv-text-muted)">
            <div style="text-align:center;padding:10px">
              <i class="fas fa-hourglass-end" style="font-size:2rem;color:var(--tv-text-muted)"></i>
              <p style="color:var(--tv-text-muted);font-weight:700">Đã kết thúc</p>
            </div>
          </div>
        `;
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      const timerEl = document.getElementById('fdTimer');
      if (timerEl) timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const progressEl = this.flashDealContainer.querySelector('.tv-fd-progress span');
      if (progressEl) progressEl.style.width = `${(remaining / totalSeconds) * 100}%`;
    }, 1000);

    // Buy handler
    this.flashDealContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tv-fd-buy');
      if (btn) {
        utils.showToast('Đã thêm vào giỏ hàng!', 'fa-cart-plus');
      }
    });
  }

  // === Poll ===
  showPoll(poll) {
    if (!this.pollContainer) return;
    this.activePoll = poll;
    this.pollVotes = {};
    poll.options.forEach(o => { this.pollVotes[o.id] = 0; });

    const render = () => {
      const total = Object.values(this.pollVotes).reduce((a, b) => a + b, 0);
      this.pollContainer.innerHTML = `
        <div class="tv-poll-overlay">
          <h4><i class="fas fa-chart-bar"></i> ${utils.escapeHtml(poll.question)}</h4>
          ${poll.options.map(o => {
            const pct = total > 0 ? Math.round((this.pollVotes[o.id] / total) * 100) : 0;
            return `
              <button class="tv-poll-option" data-option-id="${o.id}">
                <span class="tv-poll-bar" style="width:${pct}%"></span>
                <span class="tv-poll-text">
                  <span>${utils.escapeHtml(o.label)}</span>
                  <span>${pct}%</span>
                </span>
              </button>
            `;
          }).join('')}
          <div style="font-size:0.75rem;color:var(--tv-text-muted);margin-top:8px;text-align:center">
            Tổng: <strong>${total}</strong> lượt bình chọn
          </div>
        </div>
      `;
    };

    render();

    this.pollContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tv-poll-option');
      if (!btn) return;
      const oid = btn.dataset.optionId;
      if (this.pollVotes[oid] !== undefined) {
        this.pollVotes[oid]++;
        render();
      }
    });
  }

  showPollResult(finalData) {
    if (!this.pollContainer) return;
    if (this.activePoll) {
      const total = Object.values(this.pollVotes).reduce((a, b) => a + b, 0) || 1;
      const sorted = [...this.activePoll.options].sort((a, b) => (this.pollVotes[b.id] || 0) - (this.pollVotes[a.id] || 0));
      const winner = sorted[0];
      this.pollContainer.innerHTML = `
        <div class="tv-poll-overlay" style="border-color:var(--tv-primary)">
          <h4><i class="fas fa-trophy" style="color:var(--tv-gold)"></i> Kết quả bình chọn</h4>
          <p style="font-size:0.85rem;font-weight:700;margin:0 0 8px">${utils.escapeHtml(this.activePoll.question)}</p>
          ${sorted.map(o => {
            const pct = Math.round((this.pollVotes[o.id] / total) * 100);
            const isWinner = o.id === winner.id;
            return `
              <div style="margin-bottom:6px">
                <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:2px">
                  <span>${isWinner ? '🏆 ' : ''}${utils.escapeHtml(o.label)}</span>
                  <span style="font-weight:700">${pct}%</span>
                </div>
                <div style="height:6px;background:var(--tv-border);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${isWinner ? 'var(--tv-primary)' : 'var(--tv-text-muted)'};border-radius:3px;transition:width 0.5s"></div>
                </div>
              </div>
            `;
          }).join('')}
          <div style="font-size:0.75rem;color:var(--tv-text-muted);margin-top:8px;text-align:center">
            <strong>${total}</strong> lượt bình chọn
          </div>
        </div>
      `;
    }
  }

  // === Pin message ===
  pinMessage(msgId) {
    const msg = this.messages.find(m => m.id === msgId);
    if (msg) {
      msg.pinned = !msg.pinned;
      // Re-render chat
    }
  }

  destroy() {
    if (this.mockChatInterval) clearInterval(this.mockChatInterval);
    if (this.mockViewerInterval) clearInterval(this.mockViewerInterval);
    if (this.dealTimer) clearInterval(this.dealTimer);
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }
  }
}

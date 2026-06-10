/* =========================================================
   EcoTV Core Module
   EventBus, shared state, utility functions
   ========================================================= */

export const EcoTV = { version: '2.0.0' };

// --- EventBus ---
class EventBus {
  constructor() { this._listeners = {}; }
  on(event, fn) {
    (this._listeners[event] ||= []).push(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }
  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }
}
EcoTV.bus = new EventBus();

// --- Shared State ---
EcoTV.state = {
  currentUser: null,
  subscribedChannels: JSON.parse(localStorage.getItem('tv_subscribed') || '[]'),
  remindedSchedule: JSON.parse(localStorage.getItem('tv_reminded') || '[]'),
  watchLater: JSON.parse(localStorage.getItem('tv_watchlater') || '[]'),
  likedVideos: JSON.parse(localStorage.getItem('tv_liked') || '[]'),
  theme: localStorage.getItem('tv_theme') || 'dark',
};

EcoTV.state.save = function () {
  localStorage.setItem('tv_subscribed', JSON.stringify(this.subscribedChannels));
  localStorage.setItem('tv_reminded', JSON.stringify(this.remindedSchedule));
  localStorage.setItem('tv_watchlater', JSON.stringify(this.watchLater));
  localStorage.setItem('tv_liked', JSON.stringify(this.likedVideos));
};

EcoTV.state.toggleSubscribe = function (channelId) {
  const idx = this.subscribedChannels.indexOf(channelId);
  if (idx >= 0) { this.subscribedChannels.splice(idx, 1); return false; }
  this.subscribedChannels.push(channelId); return true;
};

EcoTV.state.isSubscribed = function (channelId) {
  return this.subscribedChannels.includes(channelId);
};

EcoTV.state.toggleRemind = function (scheduleId) {
  const idx = this.remindedSchedule.indexOf(scheduleId);
  if (idx >= 0) { this.remindedSchedule.splice(idx, 1); return false; }
  this.remindedSchedule.push(scheduleId); return true;
};

EcoTV.state.isReminded = function (scheduleId) {
  return this.remindedSchedule.includes(scheduleId);
};

EcoTV.state.toggleLike = function (videoId) {
  const idx = this.likedVideos.indexOf(videoId);
  if (idx >= 0) { this.likedVideos.splice(idx, 1); return false; }
  this.likedVideos.push(videoId); return true;
};

EcoTV.state.isLiked = function (videoId) {
  return this.likedVideos.includes(videoId);
};

EcoTV.state.toggleWatchLater = function (videoId) {
  const idx = this.watchLater.indexOf(videoId);
  if (idx >= 0) { this.watchLater.splice(idx, 1); return false; }
  this.watchLater.push(videoId); return true;
};

EcoTV.state.isWatchLater = function (videoId) {
  return this.watchLater.includes(videoId);
};

// --- Gamification State ---
EcoTV.state.ecoPoints = parseInt(localStorage.getItem('tv_ecoPoints') || '0');
EcoTV.state.ecoLevel = parseInt(localStorage.getItem('tv_ecoLevel') || '1');
EcoTV.state.ecoChallenges = JSON.parse(localStorage.getItem('tv_ecoChallenges') || '{}');
EcoTV.state.claimedRewards = JSON.parse(localStorage.getItem('tv_claimedRewards') || '[]');

EcoTV.state.addEcoPoints = function (amount) {
  this.ecoPoints += amount;
  const newLevel = Math.floor(this.ecoPoints / 200) + 1;
  if (newLevel > this.ecoLevel) {
    this.ecoLevel = newLevel;
    EcoTV.bus.emit('levelUp', this.ecoLevel);
  }
  localStorage.setItem('tv_ecoPoints', this.ecoPoints.toString());
  localStorage.setItem('tv_ecoLevel', this.ecoLevel.toString());
  EcoTV.bus.emit('pointsChanged', this.ecoPoints);
};

EcoTV.state.updateChallenge = function (challengeId, progress) {
  this.ecoChallenges[challengeId] = progress;
  localStorage.setItem('tv_ecoChallenges', JSON.stringify(this.ecoChallenges));
  EcoTV.bus.emit('challengeUpdated', { id: challengeId, progress });
};

EcoTV.state.getChallengeProgress = function (challengeId) {
  return this.ecoChallenges[challengeId] || 0;
};

EcoTV.state.claimReward = function (rewardId) {
  if (this.claimedRewards.includes(rewardId)) return false;
  this.claimedRewards.push(rewardId);
  localStorage.setItem('tv_claimedRewards', JSON.stringify(this.claimedRewards));
  return true;
};

EcoTV.state.isRewardClaimed = function (rewardId) {
  return this.claimedRewards.includes(rewardId);
};

EcoTV.state.saveGamification = function () {
  localStorage.setItem('tv_ecoChallenges', JSON.stringify(this.ecoChallenges));
  localStorage.setItem('tv_claimedRewards', JSON.stringify(this.claimedRewards));
};

// --- Utility Functions ---
EcoTV.utils = {
  formatViews(num) {
    if (!num) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace('.0', '') + 'K';
    return num.toString();
  },

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  formatTimestamp(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  },

  timeAgo(dateStr) {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)} tháng trước`;
    return `${Math.floor(diff / 31536000)} năm trước`;
  },

  formatCountdown(targetDate) {
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return 'Đang phát sóng';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days} ngày ${hours} giờ`;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  },

  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  throttle(fn, limit = 300) {
    let inThrottle = false;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  },

  setUrlParam(name, value) {
    const url = new URL(window.location);
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
    window.history.replaceState({}, '', url);
  },

  showToast(message, icon = 'fa-check-circle', duration = 3000) {
    const existing = document.querySelector('.tv-toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'tv-toast-notification';
    toast.style.cssText = `
      position: fixed; top: 80px; right: 20px; z-index: 1100;
      background: var(--tv-card); border: 1px solid var(--tv-primary);
      border-radius: var(--tv-radius-lg); padding: 12px 16px;
      display: flex; align-items: center; gap: 10px;
      box-shadow: var(--tv-shadow-lg); font-size: 0.88rem;
      animation: tvToastIn 0.3s ease, tvToastOut 0.3s ease ${duration - 300}ms forwards;
    `;
    toast.innerHTML = `<i class="fas ${icon}" style="color:var(--tv-primary)"></i><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  },

  skeleton(count = 6, columns = 3) {
    const grid = document.createElement('div');
    grid.className = 'tv-video-grid';
    grid.style.cssText = 'grid-template-columns: repeat(' + columns + ', 1fr); gap: 16px;';
    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'tv-video-card';
      card.innerHTML = `
        <div class="tv-skeleton tv-skeleton-thumb"></div>
        <div style="padding:10px 12px">
          <div class="tv-skeleton tv-skeleton-line w75"></div>
          <div class="tv-skeleton tv-skeleton-line w50"></div>
          <div class="tv-skeleton tv-skeleton-line" style="width:40%"></div>
        </div>
      `;
      grid.appendChild(card);
    }
    return grid;
  },
};

EcoTV.utils.scheduleTime = function (isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  if (d.toDateString() === now.toDateString()) return `Hôm nay ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Ngày mai ${time}`;
  if (d.toDateString() === dayAfter.toDateString()) return `Ngày kia ${time}`;
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' }) + ' ' + time;
};

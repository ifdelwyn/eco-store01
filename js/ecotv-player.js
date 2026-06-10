/* =========================================================
   EcoTV Player Module
   Video.js init, chapters, product-timestamp sync, keyboard shortcuts
   ========================================================= */

import { EcoTV } from './ecotv-core.js';

const { utils, state, bus } = EcoTV;

export class EcoTVPlayer {
  constructor(options = {}) {
    this.videoId = options.videoId;
    this.videoData = options.videoData || null;
    this.player = null;
    this.chapterMarkers = [];
    this.productMarkers = [];
    this.currentProductHighlight = null;
    this.isTheaterMode = false;
    this.autoplayTimer = null;
    this.autoplayCountdown = 5;

    this.container = options.container || document.getElementById('tvPlayerContainer');
    this.videoEl = null;
    this.chaptersContainer = options.chaptersContainer || document.getElementById('tvChapters');
    this.productsContainer = options.productsContainer || document.getElementById('tvProducts');
    this.autoplayContainer = options.autoplayContainer || document.getElementById('tvAutoplay');
  }

  async init(videoData) {
    if (videoData) this.videoData = videoData;
    if (!this.videoData) return;

    if (this.videoData.embedUrl) {
      this.createEmbed();
      this.renderChapters();
      this.renderProducts();
      return;
    }

    await this.loadVideoJS();
    this.createVideoElement();
    this.initPlayer();
    this.setupChapterMarkers();
    this.setupProductTimestamps();
    this.setupKeyboardShortcuts();
    this.renderChapters();
    this.renderProducts();
    this.renderAutoplay();
  }

  loadVideoJS() {
    return new Promise((resolve) => {
      if (window.videojs) { resolve(); return; }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video-js.min.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video.min.js';
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }

  createVideoElement() {
    this.container.innerHTML = `
      <video id="tvVideoPlayer"
        class="video-js vjs-big-play-centered"
        controls
        preload="auto"
        playsinline
        data-setup='{"fluid":true,"controls":true,"playbackRates":[0.5,1,1.25,1.5,2],"sources":[{"src":"${this.videoData.videoUrl}","type":"application/x-mpegURL"}]}'
      ></video>
    `;
    this.videoEl = document.getElementById('tvVideoPlayer');
  }

  createEmbed() {
    const url = this.videoData.embedUrl;
    const hasAutoplay = url.includes('autoplay=1');
    this.container.innerHTML = `
      <div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:var(--tv-radius-xl);overflow:hidden">
        <iframe
          src="${url}"
          style="position:absolute;inset:0;width:100%;height:100%;border:none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
          loading="eager"
        ></iframe>
      </div>
    `;
    this.videoEl = this.container.querySelector('iframe');
  }

  initPlayer() {
    this.player = videojs(this.videoEl, {
      html5: {
        hls: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
        }
      }
    });

    this.player.ready(() => {
      this.player.hlsQualitySelector ? this.player.hlsQualitySelector() : null;
      this.setupTimeUpdate();
      this.setupPiP();
    });
  }

  // === Chapter markers on seek bar ===
  setupChapterMarkers() {
    const chapters = this.videoData.chapters || [];
    const progressControl = this.container.querySelector('.vjs-progress-control');
    if (!progressControl || !chapters.length) return;

    chapters.forEach(ch => {
      const marker = document.createElement('div');
      marker.className = 'tv-chapter-marker';
      const pct = (ch.time / this.videoData.duration) * 100;
      marker.style.left = pct + '%';
      marker.dataset.label = ch.label;
      marker.title = ch.label;
      progressControl.appendChild(marker);
    });
  }

  // === Product timestamp markers and sync ===
  setupProductTimestamps() {
    const timestamps = this.videoData.productTimestamps || [];
    const progressControl = this.container.querySelector('.vjs-progress-control');
    if (!progressControl || !timestamps.length) return;

    timestamps.forEach(pt => {
      const marker = document.createElement('div');
      marker.className = 'tv-product-marker';
      const pct = (pt.time / this.videoData.duration) * 100;
      marker.style.left = pct + '%';
      marker.dataset.productId = pt.productId;
      marker.title = pt.note;
      progressControl.appendChild(marker);
    });
  }

  setupTimeUpdate() {
    const timestamps = this.videoData.productTimestamps || [];
    if (!timestamps.length) return;

    const debouncedCheck = utils.debounce(() => {
      if (!this.player) return;
      const cur = this.player.currentTime();
      const match = timestamps.find(p => Math.abs(p.time - cur) < 3);
      if (match) {
        this.highlightProduct(match.productId, match.note);
      }
    }, 500);

    this.player.on('timeupdate', debouncedCheck);
  }

  async highlightProduct(productId, note) {
    if (this.currentProductHighlight === productId) return;
    this.currentProductHighlight = productId;

    // Highlight in sidebar
    const items = this.productsContainer?.querySelectorAll('.tv-product-item');
    items?.forEach(item => {
      item.classList.toggle('highlighted', item.dataset.productId === productId);
    });

    // Show toast
    const product = await this.getProductData(productId);
    if (!product) return;
    this.showProductToast(product, note);
  }

  async getProductData(productId) {
    const { ecoTVData } = await import('./ecotv-data.js');
    return ecoTVData.getProduct(productId);
  }

  showProductToast(product, note) {
    const existing = document.querySelector('.tv-prod-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'tv-prod-toast';
    toast.innerHTML = `
      <img src="${product.image}" alt="${utils.escapeHtml(product.name)}">
      <div class="tv-toast-text">
        <strong>Sản phẩm vừa được đề cập</strong>
        <span>${utils.escapeHtml(product.name)}</span>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // === Chapters panel ===
  renderChapters() {
    const chapters = this.videoData.chapters || [];
    if (!this.chaptersContainer) return;
    if (!chapters.length) {
      this.chaptersContainer.style.display = 'none';
      return;
    }
    const list = this.chaptersContainer.querySelector('.tv-chapter-list') || this.chaptersContainer;
    list.innerHTML = chapters.map(ch => `
      <div class="tv-chapter-item" data-time="${ch.time}">
        <img src="${ch.thumbnail || this.videoData.thumbnail}" alt="" loading="lazy">
        <span class="tv-ch-label">${utils.escapeHtml(ch.label)}</span>
        <span class="tv-ch-time">${utils.formatTimestamp(ch.time)}</span>
      </div>
    `).join('');

    list.addEventListener('click', e => {
      const item = e.target.closest('.tv-chapter-item');
      if (!item || !this.player) return;
      const time = parseFloat(item.dataset.time);
      this.player.currentTime(time);
      this.player.play();
      list.querySelectorAll('.tv-chapter-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
    });
  }

  // === Products sidebar ===
  async renderProducts() {
    if (!this.productsContainer) return;
    const timestamps = this.videoData.productTimestamps || [];
    const container = this.productsContainer.querySelector('.tv-products-list') || this.productsContainer;

    if (!timestamps.length) {
      this.productsContainer.style.display = 'none';
      return;
    }

    let html = '';
    for (const pt of timestamps) {
      const product = await this.getProductData(pt.productId);
      if (!product) continue;
      html += `
        <div class="tv-product-item" data-product-id="${product.id}" data-time="${pt.time}">
          <img src="${product.image}" alt="${utils.escapeHtml(product.name)}" loading="lazy">
          <div class="tv-prod-info">
            <h4>${utils.escapeHtml(product.name)}</h4>
            <div class="tv-prod-price">
              ${utils.formatCurrency(product.price)}
              ${product.originalPrice ? `<strike>${utils.formatCurrency(product.originalPrice)}</strike>` : ''}
            </div>
            <span class="tv-prod-badge"><i class="fas fa-clock"></i> Tại ${utils.formatTimestamp(pt.time)}</span>
          </div>
          <button class="tv-prod-add" data-product='${JSON.stringify(product)}'><i class="fas fa-cart-plus"></i></button>
        </div>
      `;
    }
    container.innerHTML = html;

    // Add to cart handler
    container.addEventListener('click', e => {
      const btn = e.target.closest('.tv-prod-add');
      if (!btn) return;
      try {
        const product = JSON.parse(btn.dataset.product);
        this.addToCart(product);
      } catch (err) {}
    });
  }

  addToCart(product) {
    utils.showToast(`Đã thêm "${product.name}" vào giỏ hàng`, 'fa-cart-plus');
  }

  // === Autoplay ===
  renderAutoplay() {
    if (!this.autoplayContainer) return;
    this.autoplayContainer.style.display = 'none';
  }

  setupAutoplay(nextVideoId, nextVideoTitle) {
    if (!this.autoplayContainer || !nextVideoId) return;
    this.autoplayContainer.style.display = 'flex';
    this.autoplayContainer.querySelector('.tv-auto-info').innerHTML =
      `<strong>${utils.escapeHtml(nextVideoTitle)}</strong> — tự động phát sau <span id="tvAutoCountdown">5</span>s`;

    const countdownEl = this.autoplayContainer.querySelector('#tvAutoCountdown');
    const bar = this.autoplayContainer.querySelector('.tv-autoplay-bar span');

    this.autoplayCountdown = 5;
    bar.style.width = '100%';

    this.autoplayTimer = setInterval(() => {
      this.autoplayCountdown--;
      if (countdownEl) countdownEl.textContent = this.autoplayCountdown;
      bar.style.width = (this.autoplayCountdown / 5 * 100) + '%';
      if (this.autoplayCountdown <= 0) {
        clearInterval(this.autoplayTimer);
        window.location.href = 'ecotv-watch.html?v=' + nextVideoId;
      }
    }, 1000);

    // Cancel button
    const cancelBtn = this.autoplayContainer.querySelector('[data-auto-cancel]');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        clearInterval(this.autoplayTimer);
        this.autoplayContainer.style.display = 'none';
      };
    }

    // Watch now button
    const watchBtn = this.autoplayContainer.querySelector('[data-auto-watch]');
    if (watchBtn) {
      watchBtn.onclick = () => {
        clearInterval(this.autoplayTimer);
        window.location.href = 'ecotv-watch.html?v=' + nextVideoId;
      };
    }
  }

  // === Keyboard shortcuts ===
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!this.player) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (this.player.paused()) this.player.play();
          else this.player.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.player.currentTime(Math.max(0, this.player.currentTime() - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.player.currentTime(Math.min(this.player.duration(), this.player.currentTime() + 5));
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.player.volume(Math.min(1, this.player.volume() + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.player.volume(Math.max(0, this.player.volume() - 0.05));
          break;
        case 'f':
        case 'F':
          if (!document.fullscreenElement) {
            if (this.container.requestFullscreen) this.container.requestFullscreen();
            else if (this.container.webkitRequestFullscreen) this.container.webkitRequestFullscreen();
          } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          }
          break;
        case 'm':
        case 'M':
          this.player.muted(!this.player.muted());
          break;
        case 't':
        case 'T':
          this.toggleTheaterMode();
          break;
      }
    });
  }

  toggleTheaterMode() {
    this.isTheaterMode = !this.isTheaterMode;
    this.container.classList.toggle('theater-mode', this.isTheaterMode);
    const sidebar = document.querySelector('.tv-watch-sidebar');
    if (sidebar) sidebar.style.display = this.isTheaterMode ? 'none' : '';
  }

  // === PiP ===
  setupPiP() {
    if (!document.pictureInPictureEnabled) return;
    const pipBtn = document.getElementById('tvPiPBtn');
    if (!pipBtn) return;
    pipBtn.style.display = 'inline-flex';
    pipBtn.addEventListener('click', async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          const video = this.player.el().querySelector('video');
          if (video) await video.requestPictureInPicture();
        }
      } catch (err) {}
    });
  }

  // === Quality selector via HLS.js ===
  async loadHLS() {
    if (!window.Hls) {
      await new Promise(resolve => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.8/hls.min.js';
        s.onload = resolve;
        document.head.appendChild(s);
      });
    }
  }

  destroy() {
    if (this.autoplayTimer) clearInterval(this.autoplayTimer);
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }
  }
}

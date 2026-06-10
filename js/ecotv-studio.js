/* =========================================================
   EcoTV Studio Module
   Dashboard, upload flow, live management, analytics charts
   ========================================================= */

import { EcoTV } from './ecotv-core.js';

const { utils, state, bus } = EcoTV;

export class EcoTVStudio {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('tvStudioMain');
    this.currentTab = 'dashboard';
    this.chapters = [];
    this.tags = [];
    this.uploadProgress = 0;
    this.uploadInterval = null;
  }

  init() {
    this.setupNavigation();
    this.showTab('dashboard');
  }

  setupNavigation() {
    document.querySelectorAll('.tv-studio-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        if (tab) {
          document.querySelectorAll('.tv-studio-nav-item').forEach(n => n.classList.remove('active'));
          item.classList.add('active');
          this.showTab(tab);
        }
      });
    });
  }

  showTab(tabId) {
    this.currentTab = tabId;
    switch (tabId) {
      case 'dashboard': this.renderDashboard(); break;
      case 'upload': this.renderUpload(); break;
      case 'videos': this.renderVideos(); break;
      case 'livestream': this.renderLivestream(); break;
      case 'analytics': this.renderAnalytics(); break;
      case 'comments': this.renderComments(); break;
      case 'settings': this.renderSettings(); break;
      default: this.renderDashboard();
    }
  }

  // === Dashboard ===
  renderDashboard() {
    this.container.innerHTML = `
      <h1>Dashboard</h1>
      <div class="tv-kpi-grid">
        <div class="tv-kpi-card">
          <div class="tv-kpi-value" id="kpiViews">1.2M</div>
          <div class="tv-kpi-label">Tổng lượt xem</div>
          <div class="tv-kpi-change up"><i class="fas fa-arrow-up"></i> 12.5%</div>
        </div>
        <div class="tv-kpi-card">
          <div class="tv-kpi-value" id="kpiWatchTime">8.4K</div>
          <div class="tv-kpi-label">Watch time TB (giây)</div>
          <div class="tv-kpi-change up"><i class="fas fa-arrow-up"></i> 5.2%</div>
        </div>
        <div class="tv-kpi-card">
          <div class="tv-kpi-value" id="kpiSubs">+284</div>
          <div class="tv-kpi-label">Người theo dõi mới</div>
          <div class="tv-kpi-change up"><i class="fas fa-arrow-up"></i> 18.3%</div>
        </div>
        <div class="tv-kpi-card">
          <div class="tv-kpi-value" id="kpiRevenue">45.2M</div>
          <div class="tv-kpi-label">Doanh thu EcoTV</div>
          <div class="tv-kpi-change up"><i class="fas fa-arrow-up"></i> 8.7%</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="tv-chart-wrap">
          <h3><i class="fas fa-chart-line"></i> Lượt xem 30 ngày</h3>
          <canvas id="viewsChart" style="max-height:250px"></canvas>
        </div>
        <div class="tv-chart-wrap">
          <h3><i class="fas fa-chart-bar"></i> Top 5 video</h3>
          <canvas id="topVideosChart" style="max-height:250px"></canvas>
        </div>
      </div>
      <div class="tv-chart-wrap" style="margin-top:16px">
        <h3><i class="fas fa-filter"></i> Funnel chuyển đổi</h3>
        <canvas id="funnelChart" style="max-height:200px"></canvas>
      </div>
    `;
    this.initCharts();
  }

  initCharts() {
    if (typeof Chart === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js';
      script.onload = () => this.buildCharts();
      document.head.appendChild(script);
    } else {
      this.buildCharts();
    }
  }

  buildCharts() {
    // Views chart
    const ctx1 = document.getElementById('viewsChart');
    if (ctx1) {
      new Chart(ctx1, {
        type: 'line',
        data: {
          labels: Array.from({length: 30}, (_, i) => `T${i+1}`),
          datasets: [{
            label: 'Lượt xem',
            data: Array.from({length: 30}, () => Math.floor(Math.random() * 5000 + 1000)),
            borderColor: '#1D9E75',
            backgroundColor: 'rgba(29,158,117,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#5c7168' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#5c7168' } }
          }
        }
      });
    }

    // Top videos chart
    const ctx2 = document.getElementById('topVideosChart');
    if (ctx2) {
      new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: ['Farm Tour', 'Salad', 'Climate', 'Flash Sale', 'EcoTalk'],
          datasets: [{
            label: 'Lượt xem',
            data: [28400, 12300, 45200, 82300, 6700],
            backgroundColor: ['#1D9E75', '#22c55e', '#16a34a', '#15803d', '#14532d'],
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#5c7168' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#5c7168' } }
          }
        }
      });
    }

    // Funnel chart
    const ctx3 = document.getElementById('funnelChart');
    if (ctx3) {
      new Chart(ctx3, {
        type: 'bar',
        data: {
          labels: ['Người xem', 'Click sản phẩm', 'Thêm giỏ', 'Đặt hàng'],
          datasets: [{
            label: 'Số lượng',
            data: [45200, 12300, 5400, 2100],
            backgroundColor: ['rgba(29,158,117,0.6)', 'rgba(29,158,117,0.45)', 'rgba(29,158,117,0.3)', 'rgba(29,158,117,0.15)'],
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#5c7168' } },
            y: { grid: { display: false }, ticks: { color: '#5c7168' } }
          }
        }
      });
    }
  }

  // === Upload ===
  renderUpload() {
    this.container.innerHTML = `
      <h1><i class="fas fa-upload"></i> Upload video</h1>
      <div class="tv-upload-zone" id="uploadZone">
        <i class="fas fa-cloud-upload-alt"></i>
        <h3>Kéo thả video vào đây</h3>
        <p>hoặc click để chọn file</p>
        <input type="file" id="fileInput" accept="video/*" style="display:none">
      </div>
      <div class="tv-upload-progress" id="uploadProgress" style="display:none">
        <span style="width:0%"></span>
      </div>
      <div id="uploadForm" style="display:none;margin-top:20px">
        <div class="tv-form-group">
          <label>Tiêu đề <span style="color:var(--tv-live)">*</span> <span class="tv-char-count"><span id="titleCount">0</span>/100</span></label>
          <input type="text" class="tv-input" id="videoTitle" maxlength="100" placeholder="Nhập tiêu đề video" required>
        </div>
        <div class="tv-form-group">
          <label>Mô tả</label>
          <textarea class="tv-textarea" id="videoDesc" placeholder="Mô tả video..." rows="4"></textarea>
        </div>
        <div class="tv-form-group">
          <label>Thumbnail</label>
          <input type="file" class="tv-input" accept="image/*">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="tv-form-group">
            <label>Danh mục</label>
            <select class="tv-select" id="videoCategory">
              <option value="FarmTour">FarmTour</option>
              <option value="EcoKitchen">EcoKitchen</option>
              <option value="GreenNews">GreenNews</option>
              <option value="LiveShopping">LiveShopping</option>
              <option value="EcoTalk">EcoTalk</option>
            </select>
          </div>
          <div class="tv-form-group">
            <label>Chế độ hiển thị</label>
            <select class="tv-select" id="videoVisibility">
              <option value="public">Công khai</option>
              <option value="private">Riêng tư</option>
              <option value="schedule">Lên lịch</option>
            </select>
          </div>
        </div>
        <div class="tv-form-group" id="scheduleGroup" style="display:none">
          <label>Lên lịch phát hành</label>
          <input type="datetime-local" class="tv-input" id="scheduleTime">
        </div>
        <div class="tv-form-group">
          <label>Tags (tối đa 10)</label>
          <div class="tv-tags-wrap" id="tagsWrap">
            <input type="text" id="tagInput" placeholder="Nhập tag và Enter" maxlength="20">
          </div>
        </div>

        <h3 style="margin:20px 0 10px"><i class="fas fa-list"></i> Chương (Chapter)</h3>
        <div id="chapterEditor" class="tv-chapter-editor"></div>
        <button class="tv-btn tv-btn-outline tv-btn-sm" id="addChapterBtn"><i class="fas fa-plus"></i> Thêm chương</button>

        <h3 style="margin:20px 0 10px"><i class="fas fa-tag"></i> Tag sản phẩm vào video</h3>
        <div id="productTimestamps"></div>
        <button class="tv-btn tv-btn-outline tv-btn-sm" id="addProductTimestampBtn"><i class="fas fa-plus"></i> Thêm sản phẩm</button>

        <div style="margin-top:24px">
          <button class="tv-btn tv-btn-primary" id="publishBtn"><i class="fas fa-globe"></i> Đăng tải</button>
        </div>
      </div>
    `;
    this.setupUploadForm();
  }

  setupUploadForm() {
    const zone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const progressBar = document.getElementById('uploadProgress');

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) this.handleFile(fileInput.files[0]);
    });

    // Title counter
    document.getElementById('videoTitle').addEventListener('input', function () {
      document.getElementById('titleCount').textContent = this.value.length;
    });

    // Visibility toggle
    document.getElementById('videoVisibility').addEventListener('change', function () {
      document.getElementById('scheduleGroup').style.display = this.value === 'schedule' ? 'block' : 'none';
    });

    // Tags
    const tagInput = document.getElementById('tagInput');
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && tagInput.value.trim()) {
        e.preventDefault();
        this.addTag(tagInput.value.trim());
        tagInput.value = '';
      }
    });

    // Chapters
    this.chapters = [];
    document.getElementById('addChapterBtn').addEventListener('click', () => this.addChapter());

    // Product timestamps
    document.getElementById('addProductTimestampBtn').addEventListener('click', () => this.addProductTimestamp());

    // Publish
    document.getElementById('publishBtn').addEventListener('click', () => {
      utils.showToast('Video đã được đăng tải thành công!', 'fa-check-circle');
    });
  }

  handleFile(file) {
    if (!file.type.startsWith('video/')) {
      utils.showToast('Vui lòng chọn file video', 'fa-exclamation-circle', 2000);
      return;
    }
    const zone = document.getElementById('uploadZone');
    zone.style.display = 'none';
    const progressBar = document.getElementById('uploadProgress');
    progressBar.style.display = 'block';
    const bar = progressBar.querySelector('span');

    // Simulate upload progress
    this.uploadProgress = 0;
    this.uploadInterval = setInterval(() => {
      this.uploadProgress += Math.random() * 8 + 2;
      if (this.uploadProgress >= 100) {
        this.uploadProgress = 100;
        clearInterval(this.uploadInterval);
        bar.style.width = '100%';
        document.getElementById('uploadForm').style.display = 'block';
        progressBar.innerHTML = '<div style="text-align:center;color:var(--tv-primary);font-weight:700;padding:4px 0"><i class="fas fa-check-circle"></i> Upload hoàn tất</div>';
      }
      bar.style.width = this.uploadProgress + '%';
    }, 300);
  }

  addTag(tag) {
    if (this.tags.length >= 10) return;
    if (this.tags.includes(tag)) return;
    this.tags.push(tag);
    const wrap = document.getElementById('tagsWrap');
    const input = wrap.querySelector('input');
    const chip = document.createElement('span');
    chip.className = 'tv-tag-chip';
    chip.innerHTML = `${tag} <i class="fas fa-times" data-tag="${tag}"></i>`;
    chip.querySelector('i').addEventListener('click', () => {
      this.tags = this.tags.filter(t => t !== tag);
      chip.remove();
    });
    wrap.insertBefore(chip, input);
  }

  addChapter() {
    const editor = document.getElementById('chapterEditor');
    const row = document.createElement('div');
    row.className = 'tv-chapter-row';
    const idx = this.chapters.length;
    row.innerHTML = `
      <span class="tv-ch-drag"><i class="fas fa-grip-vertical"></i></span>
      <input type="text" placeholder="MM:SS" class="tv-ch-time-input" style="width:80px">
      <input type="text" placeholder="Tên chương" class="tv-ch-label-input">
      <button class="tv-ch-del"><i class="fas fa-trash"></i></button>
    `;
    row.querySelector('.tv-ch-del').addEventListener('click', () => {
      row.remove();
      this.chapters.splice(idx, 1);
    });
    this.chapters.push(row);
    editor.appendChild(row);
  }

  addProductTimestamp() {
    const container = document.getElementById('productTimestamps');
    const row = document.createElement('div');
    row.className = 'tv-chapter-row';
    row.innerHTML = `
      <span style="color:var(--tv-primary)"><i class="fas fa-tag"></i></span>
      <input type="text" placeholder="MM:SS" style="width:80px">
      <input type="text" placeholder="ID sản phẩm" style="width:120px">
      <input type="text" placeholder="Ghi chú" style="flex:1">
      <button class="tv-ch-del"><i class="fas fa-times"></i></button>
    `;
    row.querySelector('.tv-ch-del').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  // === Videos management ===
  renderVideos() {
    this.container.innerHTML = `
      <h1><i class="fas fa-video"></i> Video của tôi</h1>
      <table class="tv-table">
        <thead>
          <tr>
            <th>Video</th>
            <th>Lượt xem</th>
            <th>Watch time</th>
            <th>Tỉ lệ chuyển đổi</th>
            <th>Doanh thu</th>
            <th>Ngày đăng</th>
          </tr>
        </thead>
        <tbody id="videoTableBody"></tbody>
      </table>
    `;
    const body = document.getElementById('videoTableBody');
    const mockVideos = [
      { title: 'Tham quan trang trại hữu cơ', views: 28400, watchTime: 845, conv: '3.2%', revenue: '12.5M', date: '01/06/2026' },
      { title: 'Salad rau mầm hữu cơ', views: 12300, watchTime: 420, conv: '2.8%', revenue: '5.8M', date: '28/05/2026' },
      { title: 'Biến đổi khí hậu', views: 45200, watchTime: 960, conv: '1.5%', revenue: '8.2M', date: '15/05/2026' },
      { title: 'Flash Sale Rau Sạch', views: 82300, watchTime: 3600, conv: '5.1%', revenue: '45.2M', date: '07/06/2026' },
      { title: 'Kỹ thuật thủy canh', views: 15600, watchTime: 650, conv: '2.1%', revenue: '3.9M', date: '20/05/2026' },
    ];
    body.innerHTML = mockVideos.map(v => `
      <tr>
        <td><strong>${v.title}</strong></td>
        <td>${v.views}</td>
        <td>${utils.formatDuration(v.watchTime)}</td>
        <td style="color:var(--tv-primary)">${v.conv}</td>
        <td>${v.revenue}</td>
        <td style="color:var(--tv-text-muted)">${v.date}</td>
      </tr>
    `).join('');
  }

  // === Livestream management ===
  renderLivestream() {
    this.container.innerHTML = `
      <h1><i class="fas fa-broadcast-tower"></i> Quản lý livestream</h1>
      <div class="tv-live-monitor">
        <div class="tv-lm-header">
          <span style="font-weight:700"><i class="fas fa-circle" style="color:var(--tv-live);font-size:0.7rem"></i> Trạng thái</span>
          <span style="color:var(--tv-text-muted);font-size:0.85rem" id="liveStatusText">Đang offline</span>
        </div>
        <div class="tv-lm-viewer-count" id="liveMonitorCount">0</div>
        <div style="font-size:0.85rem;color:var(--tv-text-muted)">người đang xem</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="tv-chart-wrap">
          <h3><i class="fas fa-key"></i> Stream key</h3>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="password" class="tv-input" id="streamKeyInput" value="live_ch001_abc123xyz" readonly style="flex:1;font-family:monospace">
            <button class="tv-btn tv-btn-sm tv-btn-outline" id="revealKeyBtn"><i class="fas fa-eye"></i></button>
            <button class="tv-btn tv-btn-sm tv-btn-primary" id="copyKeyBtn"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <p style="font-size:0.78rem;color:var(--tv-text-muted);margin-top:8px">Stream URL: rtmp://push.delwyn.id.vn/live</p>
        </div>
        <div class="tv-chart-wrap">
          <h3><i class="fas fa-cog"></i> Điều khiển</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="tv-btn tv-btn-primary" id="startLiveBtn"><i class="fas fa-play"></i> Bắt đầu phát sóng</button>
            <button class="tv-btn tv-btn-outline" id="endLiveBtn" style="display:none"><i class="fas fa-stop" style="color:var(--tv-live)"></i> Kết thúc</button>
          </div>
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="tv-btn tv-btn-sm tv-btn-outline" id="createDealBtn"><i class="fas fa-bolt"></i> Tạo Flash Deal</button>
            <button class="tv-btn tv-btn-sm tv-btn-outline" id="createPollBtn"><i class="fas fa-chart-bar"></i> Tạo Poll</button>
          </div>
        </div>
      </div>

      <div style="margin-top:20px">
        <h3><i class="fas fa-sliders-h"></i> Cài đặt livestream</h3>
        <div class="tv-form-group">
          <label>Tiêu đề</label>
          <input type="text" class="tv-input" id="liveTitle" placeholder="Nhập tiêu đề livestream" value="LIVE: Tham quan vườn rau hữu cơ">
        </div>
        <div class="tv-form-group">
          <label>Mô tả</label>
          <textarea class="tv-textarea" id="liveDesc" rows="3">Cùng dạo quanh vườn rau hữu cơ buổi sáng sớm.</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
          <div class="tv-form-group">
            <label>Danh mục</label>
            <select class="tv-select">
              <option>FarmTour</option>
              <option>EcoKitchen</option>
              <option>GreenNews</option>
              <option>LiveShopping</option>
              <option>EcoTalk</option>
            </select>
          </div>
          <div class="tv-form-group">
            <label>Slow mode</label>
            <select class="tv-select" id="slowMode">
              <option value="0">Tắt</option>
              <option value="5">5 giây</option>
              <option value="10">10 giây</option>
              <option value="30">30 giây</option>
            </select>
          </div>
          <div class="tv-form-group">
            <label>Sản phẩm chuẩn bị</label>
            <select class="tv-select" multiple style="height:80px">
              <option>Rau muống hữu cơ</option>
              <option>Cà chua bi</option>
              <option>Bắp cải</option>
              <option>Mật ong rừng</option>
            </select>
          </div>
        </div>
      </div>
    `;
    this.setupLiveControls();
  }

  setupLiveControls() {
    let isLive = false;
    const startBtn = document.getElementById('startLiveBtn');
    const endBtn = document.getElementById('endLiveBtn');
    const statusText = document.getElementById('liveStatusText');
    const countEl = document.getElementById('liveMonitorCount');

    startBtn?.addEventListener('click', () => {
      isLive = true;
      startBtn.style.display = 'none';
      endBtn.style.display = '';
      statusText.innerHTML = '<span style="color:var(--tv-live)"><i class="fas fa-circle"></i> Đang phát sóng</span>';
      countEl.textContent = '1.2K';
      utils.showToast('Đã bắt đầu phát sóng!', 'fa-check-circle');
    });

    endBtn?.addEventListener('click', () => {
      if (confirm('Kết thúc livestream?')) {
        isLive = false;
        startBtn.style.display = '';
        endBtn.style.display = 'none';
        statusText.textContent = 'Đã kết thúc';
        countEl.textContent = '0';
        utils.showToast('Đã kết thúc livestream', 'fa-stop-circle');
      }
    });

    // Stream key
    document.getElementById('revealKeyBtn')?.addEventListener('click', () => {
      const input = document.getElementById('streamKeyInput');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('copyKeyBtn')?.addEventListener('click', () => {
      const input = document.getElementById('streamKeyInput');
      input.type = 'text';
      input.select();
      navigator.clipboard.writeText(input.value).then(() => {
        utils.showToast('Đã copy stream key', 'fa-copy');
      });
    });

    document.getElementById('createDealBtn')?.addEventListener('click', () => {
      utils.showToast('Tính năng tạo Flash Deal (sẽ mở dialog)', 'fa-bolt');
    });
    document.getElementById('createPollBtn')?.addEventListener('click', () => {
      utils.showToast('Tính năng tạo Poll (sẽ mở dialog)', 'fa-chart-bar');
    });
  }

  // === Comments management ===
  renderComments() {
    this.container.innerHTML = `
      <h1><i class="fas fa-comments"></i> Quản lý bình luận</h1>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="tv-cat-pill active" data-filter="all">Tất cả</button>
        <button class="tv-cat-pill" data-filter="pending">Chờ duyệt</button>
        <button class="tv-cat-pill" data-filter="pinned">Đã ghim</button>
        <button class="tv-cat-pill" data-filter="hidden">Đã ẩn</button>
      </div>
      <div id="commentManageList"></div>
    `;

    const mockComments = [
      { user: 'Nguyễn Văn A', text: 'Video rất hay!', status: 'active', date: '2 ngày trước' },
      { user: 'Trần Thị B', text: 'Cho mình hỏi giá sản phẩm?', status: 'active', date: '1 ngày trước' },
      { user: 'Lê Văn C', text: 'Spam link...', status: 'pending', date: '3 giờ trước' },
      { user: 'Phạm Thị D', text: 'Tuyệt vời!', status: 'pinned', date: '5 ngày trước' },
    ];

    const list = document.getElementById('commentManageList');
    list.innerHTML = mockComments.map(c => `
      <div class="tv-comment" data-status="${c.status}">
        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user}" alt="">
        <div class="tv-cmt-body">
          <div class="tv-cmt-user">${c.user} <span style="font-weight:400;font-size:0.75rem;color:var(--tv-text-muted)">${c.date}</span></div>
          <div class="tv-cmt-text">${c.text}</div>
          <div class="tv-cmt-actions" style="gap:12px;margin-top:6px">
            <span data-action="pin"><i class="fas fa-thumbtack"></i> Ghim</span>
            <span data-action="hide" style="color:var(--tv-gold)"><i class="fas fa-eye-slash"></i> Ẩn</span>
            <span data-action="delete" style="color:var(--tv-live)"><i class="fas fa-trash"></i> Xóa</span>
            <span data-action="reply"><i class="fas fa-reply"></i> Trả lời</span>
          </div>
        </div>
      </div>
    `).join('');

    // Filter
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        list.querySelectorAll('.tv-comment').forEach(el => {
          if (filter === 'all' || el.dataset.status === filter) el.style.display = '';
          else el.style.display = 'none';
        });
      });
    });
  }

  // === Settings ===
  renderSettings() {
    this.container.innerHTML = `
      <h1><i class="fas fa-cog"></i> Cài đặt kênh</h1>
      <div class="tv-form-group">
        <label>Tên kênh</label>
        <input type="text" class="tv-input" value="Trang Trại Xanh">
      </div>
      <div class="tv-form-group">
        <label>Tagline</label>
        <input type="text" class="tv-input" value="Nông nghiệp hữu cơ bền vững">
      </div>
      <div class="tv-form-group">
        <label>Mô tả kênh</label>
        <textarea class="tv-textarea" rows="4">Chia sẻ hành trình canh tác hữu cơ...</textarea>
      </div>
      <div class="tv-form-group">
        <label>Avatar</label>
        <input type="file" class="tv-input" accept="image/*">
      </div>
      <div class="tv-form-group">
        <label>Ảnh bìa</label>
        <input type="file" class="tv-input" accept="image/*">
      </div>
      <button class="tv-btn tv-btn-primary"><i class="fas fa-save"></i> Lưu thay đổi</button>
    `;
  }
}

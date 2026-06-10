/* =========================================================
   EcoTV v3.0 – Premium Media System
   YouTube API + Netflix/YouTube-style UI + Livestream TV
   ========================================================= */

const EcoTVApp = (() => {
  // =========================================================
  // CONFIGURATION
  // =========================================================
  const CONFIG = {
    apiKey: localStorage.getItem('etv_youtube_api_key') || 'YOUR_YOUTUBE_API_KEY',
    channels: [
      { name: 'DW Planet A', channelId: 'UCK3mYg7I5Q3XH3hY7LQc5cA' },
      { name: 'Goodful', channelId: 'UC5nSJ7dE8K9oX9vY0bY0c1A' },
      { name: 'Andrew Millison', channelId: 'UC0pY0kY9Y9y0Y0Y0Y0Y0Y0Y' },
      { name: 'Sustainably Vegan', channelId: 'UC6nSJ7dE8K9oX9vY0bY0c2A' },
      { name: 'EcoShop Live', channelId: 'UC7nSJ7dE8K9oX9vY0bY0c3A' }
    ],
    maxVideosPerChannel: 10,
    totalVideosTarget: 60,
    cacheKey: 'etv_cache',
    cacheTTL: 30 * 60 * 1000,
    retryMax: 3,
    retryDelay: 2000
  };

  // =========================================================
  // CATEGORY DEFINITIONS
  // =========================================================
  const CATEGORIES = [
    { id: 'all', label: 'Tất cả', icon: 'fa-th-large' },
    { id: 'livestream', label: 'Livestream', icon: 'fa-broadcast-tower', live: true },
    { id: 'organic-farming', label: 'Organic Farming', icon: 'fa-seedling' },
    { id: 'healthy-living', label: 'Healthy Living', icon: 'fa-heart' },
    { id: 'eco-lifestyle', label: 'Eco Lifestyle', icon: 'fa-leaf' },
    { id: 'documentary', label: 'Documentary', icon: 'fa-film' },
    { id: 'ecoshop-live', label: 'EcoShop Live', icon: 'fa-shopping-bag' }
  ];

  const SORT_OPTIONS = [
    { value: 'latest', label: 'Mới nhất' },
    { value: 'views', label: 'Nhiều lượt xem' },
    { value: 'live', label: 'Đang phát trực tiếp' }
  ];

  // =========================================================
  // STATE
  // =========================================================
  let state = {
    allVideos: [],
    filteredVideos: [],
    currentCategory: 'all',
    currentSort: 'latest',
    searchQuery: '',
    page: 1,
    perPage: 20,
    loading: false,
    hasMore: true,
    isLiveTV: false,
    currentLiveChannel: null,
    channels: []
  };

  // =========================================================
  // DOM REFS
  // =========================================================
  let els = {};

  function cacheDom() {
    els = {
      hero: document.getElementById('etvHero'),
      heroStats: document.getElementById('etvHeroStats'),
      countdown: document.getElementById('etvCountdown'),
      tabs: document.getElementById('etvTabs'),
      toolbar: document.getElementById('etvToolbar'),
      grid: document.getElementById('etvGrid'),
      resultCount: document.getElementById('etvResultCount'),
      loadMore: document.getElementById('etvLoadMore'),
      loadMoreBtn: document.getElementById('etvLoadMoreBtn'),
      loadMoreText: document.getElementById('etvLoadMoreText'),
      retryBar: document.getElementById('etvRetryBar'),
      retryBtn: document.getElementById('etvRetryBtn'),
      retryMsg: document.getElementById('etvRetryMsg'),
      sidebar: document.getElementById('etvSidebar'),
      schedule: document.getElementById('etvSchedule'),
      search: document.getElementById('etvSearch'),
      sort: document.getElementById('etvSort'),
      nav: document.querySelector('.etv-nav'),
      themeBtn: document.getElementById('etvThemeBtn'),
      liveSection: document.getElementById('etvLiveSection'),
      livePlayer: document.getElementById('etvLivePlayer'),
      liveChannels: document.getElementById('etvLiveChannels'),
      liveTitle: document.getElementById('etvLiveTitle'),
      liveViewers: document.getElementById('etvLiveViewers'),
      liveBadge: document.getElementById('etvLiveBadge'),
      overlay: null,
      modal: null
    };
  }

  // =========================================================
  // UTILITY FUNCTIONS
  // =========================================================
  const Utils = {
    formatViews(num) {
      if (!num && num !== 0) return '0';
      if (num >= 1e6) return (num / 1e6).toFixed(1).replace('.0', '') + 'M';
      if (num >= 1e3) return (num / 1e3).toFixed(1).replace('.0', '') + 'K';
      return String(num);
    },

    formatDuration(iso) {
      if (!iso) return '0:00';
      const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return '0:00';
      const h = parseInt(match[1] || '0');
      const m = parseInt(match[2] || '0');
      const s = parseInt(match[3] || '0');
      if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      return `${m}:${String(s).padStart(2,'0')}`;
    },

    timeAgo(dateStr) {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return 'Vừa xong';
      if (diff < 3600) return `${Math.floor(diff/60)} phút trước`;
      if (diff < 86400) return `${Math.floor(diff/3600)} giờ trước`;
      if (diff < 2592000) return `${Math.floor(diff/86400)} ngày trước`;
      if (diff < 31536000) return `${Math.floor(diff/2592000)} tháng trước`;
      return `${Math.floor(diff/31536000)} năm trước`;
    },

    escapeHtml(str) {
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    },

    debounce(fn, delay = 300) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    },

    truncate(str, len = 80) {
      return str.length > len ? str.slice(0, len) + '...' : str;
    },

    getYouTubeId(url) {
      const reg = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      const m = url.match(reg);
      return m ? m[1] : null;
    },

    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    getThumbnail(video) {
      if (video.snippet) {
        const thumbs = video.snippet.thumbnails;
        return thumbs?.maxres?.url || thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || '';
      }
      if (video.thumbnail) return video.thumbnail;
      return `https://img.youtube.com/vi/${video.id || video.videoId}/hqdefault.jpg`;
    },

    getBestThumbnail(videoId) {
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    },

    categorize(title, description, channelName) {
      const t = (title + ' ' + description + ' ' + channelName).toLowerCase();
      if (/(?:live|livestream|trực tiếp|đang phát)/.test(t)) return 'livestream';
      if (/(?:organic|permaculture|farm|nông trại|nông sản|garden|compost|soil)/.test(t)) return 'organic-farming';
      if (/(?:healthy|health|wellness|nutrition|dinh dưỡng|sức khỏe|workout|yoga|meditation)/.test(t)) return 'healthy-living';
      if (/(?:sustainable|eco|green|xanh|environment|recycle|zero waste|upcycle)/.test(t)) return 'eco-lifestyle';
      if (/(?:documentary|documentary|phim tài liệu|inside|story|journey)/.test(t)) return 'documentary';
      if (/(?:ecoshop|shop|mua sắm|deal|sale|flash sale)/.test(t)) return 'ecoshop-live';
      const cats = ['organic-farming', 'healthy-living', 'eco-lifestyle', 'documentary', 'organic-farming', 'eco-lifestyle', 'healthy-living'];
      return cats[Math.floor(Math.random() * cats.length)];
    }
  };

  // =========================================================
  // THEME
  // =========================================================
  function initTheme() {
    const theme = localStorage.getItem('etv_theme') || 'dark';
    if (theme === 'light') {
      document.body.classList.add('etv-light');
      if (els.themeBtn) els.themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
  }

  function toggleTheme() {
    document.body.classList.toggle('etv-light');
    const isLight = document.body.classList.contains('etv-light');
    localStorage.setItem('etv_theme', isLight ? 'light' : 'dark');
    if (els.themeBtn) els.themeBtn.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  }

  // =========================================================
  // YOUTUBE API
  // =========================================================
  async function fetchFromYouTube() {
    const apiKey = CONFIG.apiKey;
    if (!apiKey || apiKey === 'YOUR_YOUTUBE_API_KEY') {
      console.warn('[EcoTV] No YouTube API key configured. Using demo data.');
      return null;
    }

    let allItems = [];

    for (const ch of CONFIG.channels) {
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${ch.channelId}&part=snippet,id&order=date&maxResults=${CONFIG.maxVideosPerChannel}&type=video`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) {
          console.warn(`[EcoTV] API error for ${ch.name}: ${searchRes.status}`);
          continue;
        }
        const searchData = await searchRes.json();
        const videoIds = searchData.items?.map(item => item.id.videoId).filter(Boolean) || [];
        if (!videoIds.length) continue;

        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${videoIds.join(',')}&part=snippet,contentDetails,statistics,liveStreamingDetails`;
        const detailsRes = await fetch(detailsUrl);
        if (!detailsRes.ok) continue;
        const detailsData = await detailsRes.json();

        const channelUrl = `https://www.googleapis.com/youtube/v3/channels?key=${apiKey}&id=${ch.channelId}&part=snippet`;
        const channelRes = await fetch(channelUrl);
        let channelAvatar = '';
        if (channelRes.ok) {
          const channelData = await channelRes.json();
          channelAvatar = channelData.items?.[0]?.snippet?.thumbnails?.default?.url || '';
        }

        const videos = (detailsData.items || []).map(item => {
          const snippet = item.snippet || {};
          const stats = item.statistics || {};
          const content = item.contentDetails || {};
          const liveDetails = item.liveStreamingDetails || {};
          const videoId = item.id;
          const isLive = snippet.liveBroadcastContent === 'live' || !!liveDetails.actualStartTime;

          return {
            id: videoId,
            videoId: videoId,
            title: snippet.title || 'Untitled',
            description: snippet.description || '',
            thumbnail: Utils.getBestThumbnail(videoId),
            channelId: ch.channelId,
            channelName: ch.name,
            channelAvatar: channelAvatar,
            publishedAt: snippet.publishedAt || new Date().toISOString(),
            duration: content.duration || 'PT0S',
            views: parseInt(stats.viewCount) || 0,
            likes: parseInt(stats.likeCount) || 0,
            isLive: isLive,
            category: Utils.categorize(snippet.title || '', snippet.description || '', ch.name),
            tags: snippet.tags || []
          };
        });

        allItems.push(...videos);
      } catch (err) {
        console.warn(`[EcoTV] Error fetching ${ch.name}:`, err);
      }
    }

    return allItems.length > 0 ? allItems : null;
  }

  // =========================================================
  // DEMO / FALLBACK DATA
  // =========================================================
  function generateDemoData() {
    const demoChannels = [
      { name: 'DW Planet A', avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_lVCNqCSUW6Y0nB5NkXXF3h3XHh7Y7j9K0Y0Y=s176-c-k-c0x00ffffff-no-rj', subscribers: 1250000 },
      { name: 'Goodful', avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_lQ5I7gK9oX9vY0bY0c1A=s176-c-k-c0x00ffffff-no-rj', subscribers: 890000 },
      { name: 'Andrew Millison', avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_lW6Y0nB5NkXXF3h3XHh7Y7j9K0Y0Y=s176-c-k-c0x00ffffff-no-rj', subscribers: 520000 },
      { name: 'Sustainably Vegan', avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_lX7Y7j9K0Y0Y0nB5NkXXF3h3XHh7=s176-c-k-c0x00ffffff-no-rj', subscribers: 340000 },
      { name: 'EcoShop Live', avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_lY8K0Y0Y0nB5NkXXF3h3XHh7Y7j9K=s176-c-k-c0x00ffffff-no-rj', subscribers: 180000 }
    ];

    const demoVideos = [];
    const topics = [
      { title: 'Permaculture Food Forest trong vườn nhà phố', category: 'organic-farming', views: 245000 },
      { title: 'Cách ủ phân compost tại nhà không mùi', category: 'eco-lifestyle', views: 189000 },
      { title: 'Farm Tour: Nông trại hữu cơ 5ha Đà Lạt', category: 'organic-farming', views: 312000 },
      { title: 'Mẹo sống xanh tiết kiệm 10 triệu/tháng', category: 'eco-lifestyle', views: 425000 },
      { title: 'Documentary: Hành trình net zero 2050', category: 'documentary', views: 567000 },
      { title: 'Livestream: Trực tiếp từ nông trại EcoShop', category: 'livestream', views: 12300, isLive: true },
      { title: 'Công thức nấu ăn thuần chay healthy', category: 'healthy-living', views: 178000 },
      { title: 'Tập yoga buổi sáng cùng thiên nhiên', category: 'healthy-living', views: 234000 },
      { title: 'Vườn thẳng đứng cho người không có đất', category: 'eco-lifestyle', views: 187000 },
      { title: 'Flash Sale: Nông sản hữu cơ giảm 50%', category: 'ecoshop-live', views: 45000, isLive: true },
      { title: 'Cách trồng rau sạch trên sân thượng', category: 'organic-farming', views: 298000 },
      { title: 'Review máy sấy thực phẩm năng lượng mặt trời', category: 'eco-lifestyle', views: 145000 },
      { title: 'Documentary: Biến đổi khí hậu và nông nghiệp', category: 'documentary', views: 678000 },
      { title: 'Livestream: Cooking show với đầu bếp organic', category: 'livestream', views: 8700, isLive: true },
      { title: 'Bí quyết chọn nông sản sạch an toàn', category: 'healthy-living', views: 156000 },
      { title: 'Xây dựng khu vườn sinh thái tại nhà', category: 'organic-farming', views: 212000 },
      { title: 'Zero waste: Tái chế chai nhựa thành chậu cây', category: 'eco-lifestyle', views: 198000 },
      { title: 'Dinh dưỡng từ rau củ quả organic', category: 'healthy-living', views: 167000 },
      { title: 'Documentary: Rừng ngập mặn và tương lai xanh', category: 'documentary', views: 445000 },
      { title: 'Livestream: Mua sắm nông sản online cùng EcoShop', category: 'ecoshop-live', views: 12300, isLive: true },
      { title: 'Hướng dẫn làm vườn cho người mới bắt đầu', category: 'organic-farming', views: 334000 },
      { title: 'Tác hại của thuốc trừ sâu đến sức khỏe', category: 'healthy-living', views: 289000 },
      { title: 'Ý tưởng trang trí nhà bằng cây xanh', category: 'eco-lifestyle', views: 176000 },
      { title: 'Livestream: Workshop làm phân hữu cơ tại nhà', category: 'organic-farming', views: 6500, isLive: true },
      { title: 'Du lịch sinh thái - Những điểm đến xanh', category: 'documentary', views: 523000 },
      { title: 'Smoothie bowl healthy cho ngày hè', category: 'healthy-living', views: 145000 },
      { title: 'Cách tiết kiệm nước trong sinh hoạt hằng ngày', category: 'eco-lifestyle', views: 123000 },
      { title: 'Nông trại đô thị: Trồng rau giữa lòng thành phố', category: 'organic-farming', views: 267000 },
      { title: 'Giải pháp năng lượng tái tạo cho gia đình', category: 'eco-lifestyle', views: 198000 },
      { title: 'Livestream: Giao lưu cùng chuyên gia nông nghiệp organic', category: 'organic-farming', views: 9500, isLive: true },
      { title: 'Bảo vệ môi trường từ những hành động nhỏ', category: 'eco-lifestyle', views: 89000 },
      { title: 'Cách phân biệt rau hữu cơ và rau thường', category: 'healthy-living', views: 234000 },
      { title: 'Farm to table - Hành trình từ nông trại đến bàn ăn', category: 'documentary', views: 456000 },
      { title: 'Lợi ích của việc ăn thuần chay', category: 'healthy-living', views: 312000 },
      { title: 'Hướng dẫn làm sữa hạt tại nhà', category: 'healthy-living', views: 189000 },
      { title: 'Biến ban công thành vườn rau xanh', category: 'organic-farming', views: 156000 },
      { title: 'Shopee Live: Deal sốc nông sản sạch', category: 'ecoshop-live', views: 28000, isLive: true },
      { title: 'Tự làm nước tẩy rửa sinh học từ thiên nhiên', category: 'eco-lifestyle', views: 134000 },
      { title: 'Documentary: Tương lai của thực phẩm hữu cơ', category: 'documentary', views: 678000 },
      { title: 'Livestream: Hỏi đáp về sống xanh cùng chuyên gia', category: 'eco-lifestyle', views: 7800, isLive: true },
    ];

    for (let i = 0; i < 60; i++) {
      const topic = topics[i % topics.length];
      const channel = demoChannels[i % demoChannels.length];
      const daysAgo = Utils.randomInt(0, 365);
      const pubDate = new Date(Date.now() - daysAgo * 86400000).toISOString();
      const videoId = 'demo_' + String(i + 1).padStart(3, '0');
      const durationSec = Utils.randomInt(180, 3600);

      demoVideos.push({
        id: videoId,
        videoId: videoId,
        title: topic.title + (i >= topics.length ? ` (P${Math.floor(i/topics.length) + 1})` : ''),
        description: `Khám phá ${topic.title.toLowerCase()} cùng ${channel.name}. Video này mang đến những thông tin hữu ích về sống xanh, nông sản sạch và lối sống bền vững. Hãy cùng EcoTV lan tỏa lối sống xanh mỗi ngày!`,
        thumbnail: `https://picsum.photos/seed/eco${i+1}/1280/720`,
        channelId: 'ch_' + i % 5,
        channelName: channel.name,
        channelAvatar: channel.avatar,
        publishedAt: pubDate,
        duration: `PT${Math.floor(durationSec/60)}M${durationSec%60}S`,
        views: topic.views + Utils.randomInt(-10000, 10000),
        likes: Utils.randomInt(100, 15000),
        isLive: !!topic.isLive,
        category: topic.category,
        tags: ['eco', 'xanh', 'sống xanh', 'organic', 'nông sản sạch']
      });
    }

    // deduplicate by title
    const seen = new Set();
    return demoVideos.filter(v => {
      const key = v.title.slice(0, 20);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // =========================================================
  // CACHE
  // =========================================================
  function getCache() {
    try {
      const raw = localStorage.getItem(CONFIG.cacheKey);
      if (!raw) return null;
      const cache = JSON.parse(raw);
      if (Date.now() - cache.timestamp > CONFIG.cacheTTL) {
        localStorage.removeItem(CONFIG.cacheKey);
        return null;
      }
      return cache.data;
    } catch {
      return null;
    }
  }

  function setCache(data) {
    try {
      localStorage.setItem(CONFIG.cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
    } catch { /* quota exceeded, ignore */ }
  }

  // =========================================================
  // MAIN DATA LOADER
  // =========================================================
  async function loadVideos() {
    const cached = getCache();
    if (cached) {
      console.log('[EcoTV] Loaded from cache:', cached.length, 'videos');
      return cached;
    }

    let videos = null;
    for (let attempt = 1; attempt <= CONFIG.retryMax; attempt++) {
      videos = await fetchFromYouTube();
      if (videos && videos.length > 0) break;
      if (attempt < CONFIG.retryMax) {
        await new Promise(r => setTimeout(r, CONFIG.retryDelay * attempt));
      }
    }

    if (!videos || videos.length === 0) {
      console.log('[EcoTV] YouTube API failed, using demo data.');
      videos = generateDemoData();
    }

    setCache(videos);
    return videos;
  }

  // =========================================================
  // CHANNEL INFO FROM VIDEOS
  // =========================================================
  function extractChannels(videos) {
    const map = new Map();
    videos.forEach(v => {
      if (!map.has(v.channelId)) {
        map.set(v.channelId, {
          id: v.channelId,
          name: v.channelName,
          avatar: v.channelAvatar,
          subscriberCount: Utils.randomInt(10000, 500000)
        });
      }
    });
    return Array.from(map.values());
  }

  // =========================================================
  // RENDER ENGINE
  // =========================================================
  function renderHero(videos) {
    if (!els.heroStats) return;
    const liveCount = videos.filter(v => v.isLive).length;
    const channelCount = new Set(videos.map(v => v.channelId)).size;
    const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);

    els.heroStats.innerHTML = `
      <div class="etv-hero-stat">
        <strong>${Utils.formatViews(totalViews)}+</strong>
        <span>Lượt xem</span>
      </div>
      <div class="etv-hero-stat">
        <strong>${videos.length}+</strong>
        <span>Video</span>
      </div>
      <div class="etv-hero-stat">
        <strong>${channelCount}+</strong>
        <span>Kênh</span>
      </div>
      <div class="etv-hero-stat">
        <strong class="${liveCount > 0 ? '' : ''}" style="${liveCount > 0 ? 'color:var(--etv-live)' : ''}">${liveCount}</strong>
        <span>Đang LIVE</span>
      </div>
    `;
  }

  function renderTabs() {
    if (!els.tabs) return;
    els.tabs.innerHTML = CATEGORIES.map(cat => `
      <button class="etv-tab ${cat.id === 'all' ? 'active' : ''} ${cat.live ? 'etv-tab-live' : ''}"
              data-category="${cat.id}">
        <i class="fas ${cat.icon}"></i> ${cat.label}
      </button>
    `).join('');
  }

  function renderToolbar() {
    if (!els.toolbar) return;
    els.toolbar.innerHTML = `
      <select class="etv-filter-select" id="etvSort">
        ${SORT_OPTIONS.map(s => `<option value="${s.value}" ${s.value === state.currentSort ? 'selected' : ''}>${s.label}</option>`).join('')}
      </select>
      <span class="etv-result-count" id="etvResultCount"></span>
    `;
    els.sort = document.getElementById('etvSort');
    els.resultCount = document.getElementById('etvResultCount');
    if (els.sort) els.sort.addEventListener('change', onSortChange);
  }

  function getSortedVideos(videos) {
    let list = [...videos];
    switch (state.currentSort) {
      case 'latest':
        list.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        break;
      case 'views':
        list.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      case 'live':
        list.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));
        break;
    }
    return list;
  }

  function getFilteredVideos() {
    let list = [...state.allVideos];

    if (state.currentCategory !== 'all') {
      list = list.filter(v => v.category === state.currentCategory);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.channelName.toLowerCase().includes(q) ||
        (v.tags && v.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (state.currentSort === 'live') {
      list = list.filter(v => v.isLive);
    }

    return getSortedVideos(list);
  }

  function showSkeleton() {
    if (!els.grid) return;
    const count = state.currentCategory === 'all' ? 10 : 6;
    els.grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'etv-skeleton-card';
      card.innerHTML = `
        <div class="etv-skeleton-thumb"></div>
        <div style="padding:10px 12px">
          <div class="etv-skeleton-line etv-w80"></div>
          <div class="etv-skeleton-line etv-w60"></div>
          <div class="etv-skeleton-line etv-w40"></div>
        </div>
      `;
      frag.appendChild(card);
    }
    els.grid.style.display = 'grid';
    els.grid.className = 'etv-grid etv-skeleton-grid';
    els.grid.appendChild(frag);
  }

  function renderCard(video) {
    const card = document.createElement('div');
    card.className = 'etv-card';
    card.style.animationDelay = '0s';

    const thumbSrc = video.thumbnail || Utils.getBestThumbnail(video.videoId);
    const duration = Utils.formatDuration(video.duration);
    const views = Utils.formatViews(video.views);
    const timeAgo = Utils.timeAgo(video.publishedAt);
    const catLabel = CATEGORIES.find(c => c.id === video.category);
    const catName = catLabel ? catLabel.label : '';

    card.innerHTML = `
      <div class="etv-card-thumb">
        <img src="${thumbSrc}" alt="${Utils.escapeHtml(video.title)}" loading="lazy">
        ${!video.isLive ? `<span class="etv-card-duration">${duration}</span>` : ''}
        ${video.isLive ? `<span class="etv-card-live"><i class="fas fa-circle"></i> LIVE</span>` : ''}
        ${catName ? `<span class="etv-card-tag">${catName}</span>` : ''}
        <div class="etv-card-play"><i class="fas fa-play"></i></div>
        <span class="etv-card-view-count"><i class="fas fa-eye"></i> ${views}</span>
      </div>
      <div class="etv-card-body">
        <h3 class="etv-card-title">${Utils.escapeHtml(Utils.truncate(video.title, 60))}</h3>
        <div class="etv-card-channel">
          ${video.channelAvatar ? `<img src="${video.channelAvatar}" alt="" loading="lazy">` : ''}
          ${Utils.escapeHtml(video.channelName)}
        </div>
        <div class="etv-card-meta">
          <span>${views} lượt xem</span>
          <span>•</span>
          <span>${timeAgo}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openPlayer(video));
    return card;
  }

  function renderGrid(videos, append = false) {
    if (!els.grid) return;

    if (!append) {
      els.grid.innerHTML = '';
      els.grid.className = 'etv-grid';
      els.grid.style.display = 'grid';
    }

    if (!videos || videos.length === 0) {
      els.grid.innerHTML = `
        <div class="etv-empty">
          <i class="fas fa-film"></i>
          <h3>Không tìm thấy video</h3>
          <p>Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm khác nhé!</p>
        </div>
      `;
      if (els.resultCount) els.resultCount.textContent = '0 video';
      return;
    }

    const frag = document.createDocumentFragment();
    videos.forEach(v => {
      frag.appendChild(renderCard(v));
    });

    if (append) {
      els.grid.appendChild(frag);
    } else {
      els.grid.appendChild(frag);
    }

    if (els.resultCount) {
      els.resultCount.textContent = `${state.filteredVideos.length} video`;
      if (state.searchQuery) {
        els.resultCount.textContent += ` cho "${Utils.escapeHtml(state.searchQuery)}"`;
      }
    }
  }

  function renderSidebar(channels) {
    if (!els.sidebar) return;
    const list = channels.slice(0, 6);
    els.sidebar.innerHTML = `
      <div class="etv-sb-header"><i class="fas fa-users"></i> Kênh nổi bật</div>
      ${list.map(ch => `
        <div class="etv-sb-channel">
          <img src="${ch.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(ch.name) + '&background=2E7D32&color=fff'}" alt="" loading="lazy">
          <div class="etv-sb-ch-info">
            <strong>${Utils.escapeHtml(ch.name)}</strong>
            <span>${Utils.formatViews(ch.subscriberCount)} người theo dõi</span>
          </div>
          <button class="etv-sb-follow">Theo dõi</button>
        </div>
      `).join('')}
    `;

    els.sidebar.addEventListener('click', e => {
      const btn = e.target.closest('.etv-sb-follow');
      if (!btn) return;
      const following = btn.classList.toggle('etv-following');
      btn.textContent = following ? 'Đã theo dõi' : 'Theo dõi';
    });
  }

  function renderSchedule(videos) {
    if (!els.schedule) return;
    const upcoming = getSortedVideos(videos.filter(v => !v.isLive)).slice(0, 6);
    els.schedule.innerHTML = `
      <div class="etv-schedule-header"><i class="fas fa-calendar-alt"></i> Sắp phát sóng</div>
      <div class="etv-schedule-scroll">
        ${upcoming.map(v => `
          <div class="etv-sch-card">
            <div class="etv-sch-thumb">
              <img src="${v.thumbnail || Utils.getBestThumbnail(v.videoId)}" alt="" loading="lazy">
            </div>
            <div class="etv-sch-info">
              <h4>${Utils.escapeHtml(Utils.truncate(v.title, 30))}</h4>
              <div class="etv-sch-channel">${Utils.escapeHtml(v.channelName)}</div>
              <div class="etv-sch-time">${Utils.timeAgo(v.publishedAt)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // =========================================================
  // LIVESTREAM TV
  // =========================================================
  function renderLiveSection(videos) {
    if (!els.liveSection) return;
    const liveVideos = videos.filter(v => v.isLive);

    if (liveVideos.length === 0) {
      els.liveSection.style.display = 'none';
      return;
    }

    els.liveSection.style.display = 'block';

    if (els.liveBadge) {
      els.liveBadge.textContent = `${liveVideos.length} đang phát`;
    }

    const firstLive = liveVideos[0];
    setLivePlayer(firstLive);

    if (els.liveChannels) {
      els.liveChannels.innerHTML = liveVideos.map(v => `
        <button class="etv-live-channel-btn ${v.videoId === state.currentLiveChannel?.videoId ? 'etv-active' : ''}"
                data-video-id="${v.videoId}">
          <div class="etv-lc-icon"><i class="fas fa-broadcast-tower"></i></div>
          <div class="etv-lc-info">
            <strong>${Utils.escapeHtml(v.channelName)}</strong>
            <span>${Utils.escapeHtml(Utils.truncate(v.title, 30))}</span>
          </div>
          <div class="etv-lc-status"><i class="fas fa-circle"></i> LIVE</div>
        </button>
      `).join('');

      els.liveChannels.addEventListener('click', e => {
        const btn = e.target.closest('.etv-live-channel-btn');
        if (!btn) return;
        const id = btn.dataset.videoId;
        const video = liveVideos.find(v => v.videoId === id);
        if (video) {
          state.currentLiveChannel = video;
          setLivePlayer(video);
          els.liveChannels.querySelectorAll('.etv-live-channel-btn').forEach(b => b.classList.remove('etv-active'));
          btn.classList.add('etv-active');
        }
      });
    }

    // Simulate viewers
    if (els.liveViewers) {
      let viewers = Utils.randomInt(50, 500);
      setInterval(() => {
        viewers += Utils.randomInt(-3, 5);
        viewers = Math.max(10, viewers);
        els.liveViewers.textContent = Utils.formatViews(viewers);
      }, 4000);
    }
  }

  function setLivePlayer(video) {
    if (!els.livePlayer) return;
    const embedUrl = video.videoId && video.videoId.startsWith('demo_')
      ? ''
      : `https://www.youtube.com/embed/${video.videoId}?autoplay=1&mute=1&controls=1&modestbranding=1`;

    if (embedUrl) {
      els.livePlayer.innerHTML = `
        <iframe src="${embedUrl}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen loading="lazy"></iframe>
      `;
    } else {
      els.livePlayer.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;background:#000;color:var(--etv-text-muted);flex-direction:column;gap:12px">
          <i class="fas fa-broadcast-tower" style="font-size:2.5rem"></i>
          <p style="margin:0;font-size:0.9rem">${Utils.escapeHtml(video.title)}</p>
          <span style="font-size:0.8rem">Đang phát trực tiếp từ ${Utils.escapeHtml(video.channelName)}</span>
        </div>
      `;
    }

    if (els.liveTitle) els.liveTitle.textContent = video.title;
    if (els.liveBadge) els.liveBadge.style.display = 'inline-flex';
    state.currentLiveChannel = video;
  }

  // =========================================================
  // MODAL PLAYER
  // =========================================================
  function openPlayer(video) {
    const existing = document.querySelector('.etv-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'etv-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const embedUrl = video.videoId && video.videoId.startsWith('demo_')
      ? ''
      : `https://www.youtube.com/embed/${video.videoId}?autoplay=1&rel=0&modestbranding=1`;

    overlay.innerHTML = `
      <div class="etv-modal">
        <button class="etv-modal-close" id="etvModalClose" aria-label="Close"><i class="fas fa-times"></i></button>
        <div class="etv-modal-player">
          ${embedUrl
            ? `<iframe src="${embedUrl}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen loading="lazy"></iframe>`
            : `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#000;color:var(--etv-text-muted);flex-direction:column;gap:16px">
                <i class="fas fa-play-circle" style="font-size:3rem;color:var(--etv-primary)"></i>
                <p style="margin:0;font-size:0.9rem">${Utils.escapeHtml(video.title)}</p>
                <span style="font-size:0.8rem">Demo Video • ${Utils.escapeHtml(video.channelName)}</span>
              </div>`
          }
        </div>
        <div class="etv-modal-body">
          <h2 class="etv-modal-title">${Utils.escapeHtml(video.title)}</h2>
          <div class="etv-modal-actions">
            <span style="font-size:0.85rem;color:var(--etv-text-secondary);margin-right:auto">
              <strong>${Utils.formatViews(video.views)}</strong> lượt xem • ${Utils.timeAgo(video.publishedAt)}
            </span>
            <button class="etv-modal-action etv-like-btn"><i class="fas fa-thumbs-up"></i> <span class="etv-action-label">Thích</span></button>
            <button class="etv-modal-action etv-share-btn"><i class="fas fa-share"></i> <span class="etv-action-label">Chia sẻ</span></button>
            <button class="etv-modal-action etv-save-btn"><i class="fas fa-bookmark"></i> <span class="etv-action-label">Lưu</span></button>
          </div>
          <div class="etv-modal-channel">
            <img src="${video.channelAvatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(video.channelName) + '&background=2E7D32&color=fff'}" alt="">
            <div class="etv-ch-info">
              <strong>${Utils.escapeHtml(video.channelName)}</strong>
              <span>${Utils.formatViews(Utils.randomInt(10000, 500000))} người đăng ký</span>
            </div>
            <button class="etv-modal-action etv-sub-btn">Đăng ký</button>
          </div>
          <div class="etv-modal-desc" id="etvModalDesc">
            ${Utils.escapeHtml(video.description || 'Không có mô tả.')}
          </div>
          <button class="etv-modal-desc-toggle" id="etvModalDescToggle">Xem thêm</button>
          <div class="etv-modal-tabs">
            <button class="etv-modal-tab etv-active" data-tab="description">Mô tả</button>
            <button class="etv-modal-tab" data-tab="related">Video liên quan</button>
            <button class="etv-modal-tab" data-tab="comments">Bình luận</button>
          </div>
          <div class="etv-modal-tab-content etv-active" data-tab-content="description">
            <div style="font-size:0.88rem;color:var(--etv-text-secondary);line-height:1.7;white-space:pre-line">
              ${Utils.escapeHtml(video.description || 'Không có mô tả.')}
            </div>
          </div>
          <div class="etv-modal-tab-content" data-tab-content="related">
            <div class="etv-related-grid" id="etvRelatedGrid">
              <p style="color:var(--etv-text-muted);font-size:0.85rem;grid-column:1/-1">Đang tải video liên quan...</p>
            </div>
          </div>
          <div class="etv-modal-tab-content" data-tab-content="comments">
            <div id="etvComments">
              <p style="color:var(--etv-text-muted);font-size:0.85rem">Chức năng bình luận sẽ sớm ra mắt.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    // Close handlers
    const closeBtn = overlay.querySelector('#etvModalClose');
    closeBtn.addEventListener('click', () => closePlayer(overlay));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePlayer(overlay);
    });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { closePlayer(overlay); document.removeEventListener('keydown', onEsc); }
    });

    // Description toggle
    const desc = overlay.querySelector('#etvModalDesc');
    const descToggle = overlay.querySelector('#etvModalDescToggle');
    if (desc && descToggle) {
      descToggle.addEventListener('click', () => {
        desc.classList.toggle('etv-expanded');
        descToggle.textContent = desc.classList.contains('etv-expanded') ? 'Thu gọn' : 'Xem thêm';
      });
    }

    // Tab switching
    overlay.querySelectorAll('.etv-modal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        overlay.querySelectorAll('.etv-modal-tab').forEach(t => t.classList.remove('etv-active'));
        overlay.querySelectorAll('[data-tab-content]').forEach(c => c.classList.remove('etv-active'));
        tab.classList.add('etv-active');
        const content = overlay.querySelector(`[data-tab-content="${tab.dataset.tab}"]`);
        if (content) content.classList.add('etv-active');

        if (tab.dataset.tab === 'related') loadRelated(video);
      });
    });

    // Like/Share/Save
    const likeBtn = overlay.querySelector('.etv-like-btn');
    const shareBtn = overlay.querySelector('.etv-share-btn');
    const saveBtn = overlay.querySelector('.etv-save-btn');
    const subBtn = overlay.querySelector('.etv-sub-btn');

    likeBtn?.addEventListener('click', () => {
      likeBtn.classList.toggle('etv-active');
      const label = likeBtn.querySelector('.etv-action-label');
      label.textContent = likeBtn.classList.contains('etv-active') ? 'Đã thích' : 'Thích';
    });

    saveBtn?.addEventListener('click', () => {
      saveBtn.classList.toggle('etv-active');
      const label = saveBtn.querySelector('.etv-action-label');
      label.textContent = saveBtn.classList.contains('etv-active') ? 'Đã lưu' : 'Lưu';
    });

    shareBtn?.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({ title: video.title, url: window.location.href }).catch(() => {});
      } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
          showToast('Đã sao chép liên kết!');
        }).catch(() => {});
      }
    });

    subBtn?.addEventListener('click', () => {
      const following = subBtn.classList.toggle('etv-active');
      subBtn.textContent = following ? 'Đã đăng ký' : 'Đăng ký';
    });

    // Load initial related
    setTimeout(() => loadRelated(video), 500);

    els.overlay = overlay;
  }

  function closePlayer(overlay) {
    if (!overlay) overlay = els.overlay;
    if (overlay) {
      overlay.remove();
      document.body.classList.remove('modal-open');
      els.overlay = null;
    }
  }

  function loadRelated(currentVideo) {
    const grid = document.getElementById('etvRelatedGrid');
    if (!grid) return;

    const related = state.allVideos
      .filter(v => v.videoId !== currentVideo.videoId)
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);

    grid.innerHTML = related.map(v => `
      <div class="etv-related-card" data-video-id="${v.videoId}">
        <img src="${v.thumbnail || Utils.getBestThumbnail(v.videoId)}" alt="" loading="lazy">
        <div class="etv-related-info">
          <h4>${Utils.escapeHtml(Utils.truncate(v.title, 50))}</h4>
          <span>${Utils.escapeHtml(v.channelName)}</span>
          <span>${Utils.formatViews(v.views)} lượt xem</span>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.etv-related-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.videoId;
        const video = state.allVideos.find(v => v.videoId === id);
        if (video) {
          closePlayer();
          openPlayer(video);
        }
      });
    });
  }

  // =========================================================
  // SEARCH & SORT
  // =========================================================
  function onSearchInput(e) {
    state.searchQuery = e.target.value.trim();
    state.page = 1;
    state.filteredVideos = getFilteredVideos();
    showSkeleton();
    setTimeout(() => {
      renderGrid(state.filteredVideos.slice(0, state.perPage));
      updateLoadMore();
    }, 300);
  }

  function onSortChange(e) {
    state.currentSort = e.target.value;
    state.page = 1;
    state.filteredVideos = getFilteredVideos();
    showSkeleton();
    setTimeout(() => {
      renderGrid(state.filteredVideos.slice(0, state.perPage));
      updateLoadMore();
    }, 300);
  }

  function onTabClick(e) {
    const tab = e.target.closest('.etv-tab');
    if (!tab) return;
    els.tabs.querySelectorAll('.etv-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.currentCategory = tab.dataset.category;
    state.page = 1;
    state.filteredVideos = getFilteredVideos();
    showSkeleton();
    setTimeout(() => {
      renderGrid(state.filteredVideos.slice(0, state.perPage));
      updateLoadMore();
    }, 300);
  }

  // =========================================================
  // LOAD MORE / INFINITE SCROLL
  // =========================================================
  function updateLoadMore() {
    if (!els.loadMore || !els.loadMoreBtn || !els.loadMoreText) return;
    const remaining = state.filteredVideos.length - (state.page * state.perPage);
    if (remaining <= 0) {
      els.loadMore.style.display = 'none';
      state.hasMore = false;
    } else {
      els.loadMore.style.display = 'block';
      els.loadMoreBtn.disabled = false;
      els.loadMoreText.textContent = `Xem thêm (${Math.min(remaining, state.perPage)} video)`;
      state.hasMore = true;
    }
  }

  function loadMore() {
    if (state.loading || !state.hasMore) return;
    state.loading = true;
    if (els.loadMoreBtn) {
      els.loadMoreBtn.disabled = true;
      els.loadMoreText.innerHTML = '<span class="etv-loading-spinner"></span> Đang tải...';
    }

    setTimeout(() => {
      state.page++;
      const start = 0;
      const end = state.page * state.perPage;
      const batch = state.filteredVideos.slice(start, end);
      renderGrid(batch, false);
      state.loading = false;
      updateLoadMore();
    }, 400);
  }

  function setupInfiniteScroll() {
    const sentinel = document.createElement('div');
    sentinel.id = 'etvSentinel';
    sentinel.style.height = '1px';
    if (els.loadMore?.parentNode) {
      els.loadMore.parentNode.insertBefore(sentinel, els.loadMore.nextSibling);
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && state.hasMore && !state.loading) {
          loadMore();
        }
      }, { rootMargin: '200px' });
      observer.observe(sentinel);
    }
  }

  // =========================================================
  // RETRY
  // =========================================================
  function showRetry(message) {
    if (!els.retryBar) return;
    els.retryBar.style.display = 'block';
    if (els.retryMsg) els.retryMsg.textContent = message || 'Không thể tải video. Vui lòng thử lại.';
    els.retryBtn?.addEventListener('click', async () => {
      els.retryBar.style.display = 'none';
      await init();
    }, { once: true });
  }

  // =========================================================
  // TOAST
  // =========================================================
  function showToast(msg, icon = 'fa-check-circle') {
    const existing = document.querySelector('.etv-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'etv-toast';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // =========================================================
  // COUNTDOWN
  // =========================================================
  function initCountdown() {
    if (!els.countdown) return;
    // Show a demo countdown for next scheduled stream
    const nextLive = new Date(Date.now() + 2 * 3600000 + 30 * 60000); // 2h30m from now
    function tick() {
      const diff = Math.max(0, nextLive.getTime() - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      els.countdown.innerHTML = `
        <div class="etv-cb-label"><i class="fas fa-clock"></i> Livestream tiếp theo</div>
        <div class="etv-cb-timer">
          <div class="etv-cb-unit"><div class="etv-cb-num">${String(h).padStart(2,'0')}</div><div class="etv-cb-text">Giờ</div></div>
          <div class="etv-cb-sep">:</div>
          <div class="etv-cb-unit"><div class="etv-cb-num">${String(m).padStart(2,'0')}</div><div class="etv-cb-text">Phút</div></div>
          <div class="etv-cb-sep">:</div>
          <div class="etv-cb-unit"><div class="etv-cb-num">${String(s).padStart(2,'0')}</div><div class="etv-cb-text">Giây</div></div>
        </div>
      `;
    }
    tick();
    setInterval(tick, 1000);
  }

  // =========================================================
  // NAVBAR SCROLL
  // =========================================================
  function initNavScroll() {
    window.addEventListener('scroll', () => {
      if (!els.nav) return;
      if (window.pageYOffset > 60) {
        els.nav.classList.add('scrolled');
      } else {
        els.nav.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // =========================================================
  // HERO PARTICLES
  // =========================================================
  function initHeroParticles() {
    const container = document.querySelector('.etv-hero-particles');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
      const span = document.createElement('span');
      const size = Math.random() * 4 + 2;
      span.style.cssText = `
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        width: ${size}px;
        height: ${size}px;
        animation-duration: ${Math.random() * 8 + 6}s;
        animation-delay: ${Math.random() * 5}s;
        opacity: ${Math.random() * 0.5 + 0.1};
      `;
      container.appendChild(span);
    }
  }

  // =========================================================
  // INIT
  // =========================================================
  async function init() {
    cacheDom();
    initTheme();
    initNavScroll();
    initHeroParticles();

    // Theme toggle
    if (els.themeBtn) els.themeBtn.addEventListener('click', toggleTheme);

    // Setup tabs
    renderTabs();
    if (els.tabs) els.tabs.addEventListener('click', onTabClick);

    // Setup toolbar
    renderToolbar();

    // Setup search
    if (els.search) {
      els.search.addEventListener('input', Utils.debounce(onSearchInput, 400));
      els.search.addEventListener('search', onSearchInput);
    }

    // Setup load more
    if (els.loadMoreBtn) els.loadMoreBtn.addEventListener('click', loadMore);

    // Show skeleton
    showSkeleton();

    // Load data
    try {
      const videos = await loadVideos();
      state.allVideos = videos;
      state.channels = extractChannels(videos);
      state.filteredVideos = getFilteredVideos();

      // Render
      renderHero(videos);
      renderSidebar(state.channels);
      renderSchedule(videos);
      renderLiveSection(videos);
      initCountdown();

      // Render grid
      renderGrid(state.filteredVideos.slice(0, state.perPage));
      updateLoadMore();
      setupInfiniteScroll();

      console.log(`[EcoTV] Loaded ${videos.length} videos successfully.`);
    } catch (err) {
      console.error('[EcoTV] Fatal error:', err);
      showRetry('Không thể tải video. Đã xảy ra lỗi không mong muốn.');
    }
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return { init, loadVideos, openPlayer, closePlayer, showToast };
})();

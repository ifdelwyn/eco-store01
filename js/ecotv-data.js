/* =========================================================
   EcoTV Data Module
   Firebase adapter with fallback mock data + caching
   TODO: Thay Firebase thật
   ========================================================= */

import { EcoTV } from './ecotv-core.js';

class EcoTVData {
  constructor() {
    this.cache = {};
    this.baseUrl = '/mock/ecotv-data.json';
    this.allData = null;
  }

  // --- Load all data ---
  async loadAll() {
    if (this.allData) return this.allData;
    try {
      const resp = await fetch(this.baseUrl + '?t=' + Date.now());
      this.allData = await resp.json();
    } catch (e) {
      try {
        const resp = await fetch('../' + this.baseUrl + '?t=' + Date.now());
        this.allData = await resp.json();
      } catch (e2) {
        console.warn('Không thể tải mock data, dùng fallback:', e2);
        this.allData = this.getFallback();
      }
    }
    this.cache['all'] = this.allData;
    return this.allData;
  }

  getFallback() {
    return { channels: [], videos: [], livestreams: [], schedule: [] };
  }

  // --- Channels ---
  async getChannels() {
    const data = await this.loadAll();
    return data.channels || [];
  }

  async getChannel(channelId) {
    const channels = await this.getChannels();
    return channels.find(c => c.id === channelId) || null;
  }

  async getChannelBySlug(slug) {
    const channels = await this.getChannels();
    return channels.find(c => c.slug === slug) || null;
  }

  // --- Videos ---
  async getVideos() {
    const data = await this.loadAll();
    return data.videos || [];
  }

  async getVideo(videoId) {
    const videos = await this.getVideos();
    return videos.find(v => v.id === videoId) || null;
  }

  async getVideosByChannel(channelId) {
    const videos = await this.getVideos();
    return videos.filter(v => v.channelId === channelId);
  }

  async getVideosByCategory(category) {
    const videos = await this.getVideos();
    if (!category || category === 'all') return videos;
    return videos.filter(v => v.category === category);
  }

  async getFeaturedVideo() {
    const data = await this.loadAll();
    const featuredId = data.featuredVideoId;
    if (featuredId) return this.getVideo(featuredId);
    const videos = await this.getVideos();
    return videos[0] || null;
  }

  async getTrendingVideos() {
    const data = await this.loadAll();
    const ids = data.trendingVideos || [];
    const videos = await this.getVideos();
    return ids.map(id => videos.find(v => v.id === id)).filter(Boolean);
  }

  // --- Livestreams ---
  async getLivestreams() {
    const data = await this.loadAll();
    return data.livestreams || [];
  }

  async getLiveStreams() {
    const streams = await this.getLivestreams();
    return streams.filter(s => s.status === 'live');
  }

  async getLivestream(liveId) {
    const streams = await this.getLivestreams();
    return streams.find(s => s.id === liveId) || null;
  }

  // --- Schedule ---
  async getSchedule() {
    const data = await this.loadAll();
    return data.schedule || [];
  }

  // --- Products from video ---
  async getProductsByChannel(channelId) {
    const channels = await this.getChannels();
    const channel = channels.find(c => c.id === channelId);
    return channel?.products || [];
  }

  async getProduct(productId) {
    const channels = await this.getChannels();
    for (const ch of channels) {
      const prod = (ch.products || []).find(p => p.id === productId);
      if (prod) return { ...prod, channelId: ch.id, channelName: ch.name };
    }
    return null;
  }

  // --- Comments ---
  async getComments(videoId) {
    const video = await this.getVideo(videoId);
    return video?.comments || [];
  }

  // --- Related videos ---
  async getRelatedVideos(videoId, limit = 10) {
    const video = await this.getVideo(videoId);
    if (!video) return [];
    const videos = await this.getVideos();
    const sameChannel = videos.filter(v => v.channelId === video.channelId && v.id !== videoId);
    const sameCategory = videos.filter(v => v.category === video.category && v.id !== videoId && v.channelId !== video.channelId);
    const related = [...sameChannel, ...sameCategory];
    return related.slice(0, limit);
  }

  // --- Live chat messages (mock) ---
  async getLiveChatMessages(liveId) {
    return [];
  }

  // --- Firebase integration placeholders ---
  /* TODO: Firebase Realtime DB
  initFirebase() {
    const firebaseConfig = {
      apiKey: '...',
      databaseURL: 'https://...firebaseio.com'
    };
    firebase.initializeApp(firebaseConfig);
    this.db = firebase.database();
  }

  listenLiveChat(liveId, callback) {
    const ref = this.db.ref('livestreams/' + liveId + '/chat');
    ref.limitToLast(50).on('child_added', snapshot => {
      callback(snapshot.val());
    });
    return () => ref.off();
  }

  sendChatMessage(liveId, message) {
    return this.db.ref('livestreams/' + liveId + '/chat').push(message);
  }

  updateLiveViewerCount(liveId, count) {
    this.db.ref('livestreams/' + liveId + '/viewerCount').set(count);
  }
  */
}

export const ecoTVData = new EcoTVData();

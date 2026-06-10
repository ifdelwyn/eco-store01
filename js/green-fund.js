/* ===================================================================
   EcoShop Green Fund Module v1.0
   Handles: green tree fund, community fund, counters, Firebase sync
   Uses mock data from /mock/fund-data.json
   =================================================================== */

const FUND_STORAGE_KEY = 'ecoshop_green_fund';
const FUND_STATE_KEY = 'ecoshop_fund_state';

class GreenFund {
  constructor() {
    this.initialized = false;
    this.data = null;
    this.simTimers = [];
  }

  async init() {
    if (this.initialized) return;
    try {
      const resp = await fetch('/mock/fund-data.json');
      this.data = await resp.json();
    } catch (e) {
      try {
        const resp = await fetch('../mock/fund-data.json');
        this.data = await resp.json();
      } catch (e2) {
        this.data = this.getFallbackData();
      }
    }
    this.mergeState();
    this.startSimulation();
    this.initialized = true;
    return this.data;
  }

  getFallbackData() {
    return {
      greenFund: {
        totalTrees: 8300, yearlyGoal: 15000, treesThisMonth: 412,
        donorsThisMonth: 1250, provinces: {}, galleries: [], leaderboard: []
      },
      communityFund: { totalRaised: 48500000, totalBeneficiaries: 12, stories: [] },
      stats: { totalCustomers: 12450, totalTreesCustomer: 8300 }
    };
  }

  mergeState() {
    const saved = localStorage.getItem(FUND_STATE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.greenFund) {
          this.data.greenFund.totalTrees = state.greenFund.totalTrees || this.data.greenFund.totalTrees;
          this.data.greenFund.treesThisMonth = state.greenFund.treesThisMonth || this.data.greenFund.treesThisMonth;
          this.data.greenFund.donorsThisMonth = state.greenFund.donorsThisMonth || this.data.greenFund.donorsThisMonth;
        }
        if (state.communityFund) {
          this.data.communityFund.totalRaised = state.communityFund.totalRaised || this.data.communityFund.totalRaised;
          state.communityFund.stories?.forEach(s => {
            const idx = this.data.communityFund.stories.findIndex(st => st.id === s.id);
            if (idx >= 0) {
              this.data.communityFund.stories[idx].raised = s.raised || this.data.communityFund.stories[idx].raised;
              this.data.communityFund.stories[idx].supporters = s.supporters || this.data.communityFund.stories[idx].supporters;
            }
          });
        }
      } catch (e) {}
    }
  }

  saveState() {
    const state = {
      greenFund: {
        totalTrees: this.data.greenFund.totalTrees,
        treesThisMonth: this.data.greenFund.treesThisMonth,
        donorsThisMonth: this.data.greenFund.donorsThisMonth
      },
      communityFund: {
        totalRaised: this.data.communityFund.totalRaised,
        stories: this.data.communityFund.stories.map(s => ({
          id: s.id, raised: s.raised, supporters: s.supporters
        }))
      }
    };
    localStorage.setItem(FUND_STATE_KEY, JSON.stringify(state));
  }

  startSimulation() {
    this.simTimers.push(setInterval(() => {
      this.data.greenFund.totalTrees += Math.floor(Math.random() * 3);
      this.data.greenFund.treesThisMonth += Math.floor(Math.random() * 2);
      this.data.greenFund.donorsThisMonth += Math.floor(Math.random() * 2);
      this.data.stats.totalTreesCustomer = this.data.greenFund.totalTrees;
      this.saveState();
      document.dispatchEvent(new CustomEvent('fund:update', { detail: this.data }));
    }, 8000));
  }

  stopSimulation() {
    this.simTimers.forEach(t => clearInterval(t));
    this.simTimers = [];
  }

  async donateTreeFund(amount, donorName = 'Ẩn danh') {
    const trees = Math.floor(amount / 50000);
    this.data.greenFund.totalTrees += trees;
    this.data.greenFund.treesThisMonth += trees;
    this.data.greenFund.donorsThisMonth += 1;
    this.data.stats.totalTreesCustomer = this.data.greenFund.totalTrees;
    this.saveState();
    document.dispatchEvent(new CustomEvent('fund:update', { detail: this.data }));
    return { trees, certificateId: `ECOTREE-${Date.now().toString(36).toUpperCase()}-${String(trees).padStart(3,'0')}` };
  }

  async donateCommunity(storyId, amount, donorName = 'Ẩn danh', message = '') {
    const story = this.data.communityFund.stories.find(s => s.id === storyId);
    if (!story) return null;
    story.raised = Math.min(story.raised + amount, story.goal);
    story.supporters += 1;
    story.donations = story.donations || [];
    story.donations.unshift({ name: donorName, amount, date: new Date().toLocaleDateString('vi-VN'), message });
    this.data.communityFund.totalRaised += amount;
    this.saveState();
    document.dispatchEvent(new CustomEvent('fund:update', { detail: this.data }));
    return { storyId, amount, remaining: story.goal - story.raised };
  }

  getProgress(raised, goal) {
    return Math.min(100, Math.round((raised / goal) * 100));
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  formatNumber(num) {
    return new Intl.NumberFormat('vi-VN').format(num);
  }

  animateCounter(el, target, suffix = '', duration = 2000) {
    const start = performance.now();
    const startVal = 0;
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startVal + (target - startVal) * eased);
      el.textContent = this.formatNumber(current) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

const ecoFund = new GreenFund();

/* =========================================================
   Firebase mock sync — replace with real Firebase calls
   ========================================================= */
class FundFirebaseSync {
  constructor(fundInstance) {
    this.fund = fundInstance;
    this.listeners = [];
  }

  async syncTotalTrees() {
    /* TODO: Replace with Firebase Realtime DB
       const db = firebase.database();
       const ref = db.ref('greenFund/totalTrees');
       await ref.set(this.fund.data.greenFund.totalTrees);
    */
  }

  async syncDonation(donation) {
    /* TODO: Replace with Firebase push
       const db = firebase.database();
       const ref = db.ref('greenFund/donations');
       await ref.push(donation);
    */
  }

  async syncStory(storyId) {
    /* TODO: Replace with Firebase update
       const db = firebase.database();
       const ref = db.ref(`communityFund/stories/${storyId}`);
       await ref.update({ raised, supporters });
    */
  }

  onTreeUpdate(callback) {
    /* TODO: Listen to Firebase
       const db = firebase.database();
       db.ref('greenFund/totalTrees').on('value', snap => callback(snap.val()));
    */
    document.addEventListener('fund:update', (e) => {
      callback(e.detail.greenFund.totalTrees);
    });
  }
}

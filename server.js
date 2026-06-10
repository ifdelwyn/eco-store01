const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // [FIX-Bug2]
const nodemailer = require('nodemailer');
const port = 3000;

let transporter = null;
let etherealUser = 'eco-store@ethereal.email';

nodemailer.createTestAccount().then(account => {
  etherealUser = account.user;
  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass }
  });
  console.log('Ethereal email ready: ' + account.user + ' (Xem tại https://ethereal.email/login)');
}).catch(err => {
  console.error('Không thể tạo tài khoản Ethereal, email sẽ được log ra console:', err.message);
});

const otpStore = {};

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, function(c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

async function sendEmail({ to, subject, html }) {
  if (transporter) {
    const info = await transporter.sendMail({
      from: `"EcoStore" <${etherealUser}>`,
      to,
      subject,
      html
    });
    console.log('Email sent: ' + nodemailer.getTestMessageUrl(info));
    return info;
  }
  console.log('=== EMAIL (simulado) ===');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('Body:', html);
  console.log('========================');
  return { messageId: 'simulated-' + Date.now() };
}

const root = path.resolve(__dirname);
const DATA_FILE = path.join(root, 'users.json');
const TICKETS_FILE = path.join(root, 'tickets.json');
const CHAT_FILE = path.join(root, 'chat.json');
const COMMUNITY_CHAT_FILE = path.join(root, 'community-chat.json');
const ORDERS_FILE = path.join(root, 'orders.json'); // [FIX-Bug4]
const WITHDRAWALS_FILE = path.join(root, 'withdrawals.json');
const VIP_TRANSACTIONS_FILE = path.join(root, 'vip_transactions.json');
const BANNERS_FILE = path.join(root, 'banners.json');
const AD_REQUESTS_FILE = path.join(root, 'ad-requests.json'); // [NEW] Still used for backward compat - campaigns stored here
const REPORTS_FILE = path.join(root, 'reports.json');

let orders = loadData(ORDERS_FILE, []); // [FIX-Bug4]
let serverUsers = [];
let tickets = [];
let chatConversations = {};
let communityMessages = loadData(COMMUNITY_CHAT_FILE, []);
let communityCooldown = {};
let withdrawals = loadData(WITHDRAWALS_FILE, []);
let vipTransactions = loadData(VIP_TRANSACTIONS_FILE, []);
let banners = loadData(BANNERS_FILE, []);
let adRequests = loadData(AD_REQUESTS_FILE, []);
let reports = loadData(REPORTS_FILE, []);

// [FIX-Bug4]
function saveOrders() { saveData(ORDERS_FILE, orders); }

// [FIX-Bug3]
const adminSessions = {};

if (!banners.length) {
  banners = [
    {
      id: 'BNR-1',
      title: 'Siêu sale mùa hè giảm 50%',
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80',
      link: '/shop',
      active: true,
      supplierName: 'EcoShop',
      createdAt: Date.now()
    },
    {
      id: 'BNR-2',
      title: 'Hàng mới về - Fresh Organic',
      image: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1200&q=80',
      link: '/shop',
      active: true,
      supplierName: 'GreenValley Farms',
      createdAt: Date.now()
    },
    {
      id: 'BNR-3',
      title: 'Miễn phí vận chuyển cho đơn trên $50',
      image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&q=80',
      link: '/shop',
      active: true,
      supplierName: 'Mediterranean Bio',
      createdAt: Date.now()
    }
  ];
  saveData(BANNERS_FILE, banners);
}

const VIP_PLANS = {
  'eco-sprout': { id: 'eco-sprout', name: 'Gói Mầm Xanh', nameEn: 'Eco-Sprout', price: 5, discount: 0.03, freeShipping: 1 },
  'eco-leaf': { id: 'eco-leaf', name: 'Gói Lá Đơm', nameEn: 'Eco-Leaf', price: 10, discount: 0.05, freeShipping: 3 },
  'eco-forest': { id: 'eco-forest', name: 'Gói Đại Ngàn', nameEn: 'Eco-Forest', price: 20, discount: 0.10, freeShipping: -1 }
};

// [NEW] Ad slot types with pricing
const AD_SLOTS = {
  'hero': { id: 'hero', name: 'Hero Banner', nameVi: 'Banner chính trang chủ', price: 50, dailyCost: 50, description: 'Banner lớn đầu trang chủ, hiển thị luân phiên' },
  'sidebar': { id: 'sidebar', name: 'Sidebar Banner', nameVi: 'Banner cột bên', price: 20, dailyCost: 20, description: 'Banner quảng cáo ở cột bên trang web' },
  'product': { id: 'product', name: 'Product Page Banner', nameVi: 'Banner trang sản phẩm', price: 30, dailyCost: 30, description: 'Banner hiển thị trên các trang sản phẩm' },
  'footer': { id: 'footer', name: 'Footer Banner', nameVi: 'Banner chân trang', price: 10, dailyCost: 10, description: 'Banner nhỏ ở cuối trang web' }
};

function loadData(file, target) {
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading', file, e.message);
  }
  return target;
}

// [UPGRADE-4] atomic write
function saveData(file, data) {
  const tmp = file + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, file);
  } catch(e) {
    console.error('Error saving', file, e.message);
    try { fs.unlinkSync(tmp); } catch(_) {}
  }
}

function saveUsers() {
  saveData(DATA_FILE, serverUsers);
}

function saveVipTransactions() {
  saveData(VIP_TRANSACTIONS_FILE, vipTransactions);
}

// [FIX-Bug2] password hashing
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return 'scrypt:' + salt + ':' + hash;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt:')) {
    return password === stored;
  }
  const parts = stored.split(':');
  const salt = parts[1];
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const expected = 'scrypt:' + salt + ':' + hash;
  const buf1 = Buffer.from(stored);
  const buf2 = Buffer.from(expected);
  if (buf1.length !== buf2.length) return false;
  return crypto.timingSafeEqual(buf1, buf2);
}

// [UPGRADE-1] rate limiting
const rateLimitMap = {};
function rateLimit(ip, maxReq = 30, windowMs = 60000) {
  const now = Date.now();
  if (!rateLimitMap[ip] || rateLimitMap[ip].resetAt < now) {
    rateLimitMap[ip] = { count: 1, resetAt: now + windowMs };
    return false;
  }
  rateLimitMap[ip].count++;
  return rateLimitMap[ip].count > maxReq;
}

setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimitMap).forEach(k => {
    if (rateLimitMap[k].resetAt < now) delete rateLimitMap[k];
  });
}, 300000);

// [UPGRADE-2] input validation & sanitization
function validateUsername(s) { return /^[a-zA-Z0-9_]{3,30}$/.test(s); }
function validateEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 100; }
function validatePassword(s) { return typeof s === 'string' && s.length >= 6 && s.length <= 100; }
function sanitizeString(s, maxLen = 500) { return String(s || '').trim().slice(0, maxLen); }

function getQueryParam(query, key) {
  const match = query.match(new RegExp(key + '=([^&]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

// [UPGRADE-3] structured error responses
function sendError(res, status, code, message) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: true, code, message }));
}

function logRequest(method, url, status, ms) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${method} ${url} → ${status} (${ms}ms)`);
}

// [FIX-Bug3] admin auth middleware
function requireAdmin(req, res) {
  const sessionId = req.headers['x-admin-session'];
  if (!sessionId || !adminSessions[sessionId]) {
    sendError(res, 403, 'FORBIDDEN', 'Yêu cầu quyền quản trị');
    return false;
  }
  const session = adminSessions[sessionId];
  if (Date.now() - session.createdAt > 8 * 3600000) {
    delete adminSessions[sessionId];
    sendError(res, 403, 'SESSION_EXPIRED', 'Phiên làm việc đã hết hạn');
    return false;
  }
  return true;
}

serverUsers = loadData(DATA_FILE, []);
tickets = loadData(TICKETS_FILE, []);
chatConversations = loadData(CHAT_FILE, {});
vipTransactions = loadData(VIP_TRANSACTIONS_FILE, []);

// [FIX-Bug2] migrate old plaintext passwords to scrypt
let needsSave = false;
serverUsers.forEach(u => {
  if (u.password && !u.password.startsWith('scrypt:')) {
    u.password = hashPassword(u.password);
    needsSave = true;
  }
});
if (needsSave) saveUsers();

const UPLOADS_DIR = path.join(root, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const boundary = req.headers['content-type'].split('boundary=')[1]?.split(';')[0]?.trim(); // [FIX-Bug10]
    if (!boundary) { reject(new Error('No boundary')); return; }
    let raw = Buffer.alloc(0);
    req.on('data', chunk => { raw = Buffer.concat([raw, chunk]); });
    req.on('end', () => {
      try {
        const parts = {};
        const boundaryMarker = Buffer.from('--' + boundary);
        const endMarker = Buffer.from('--' + boundary + '--');
        let pos = 0;
        while (pos < raw.length) {
          const startIdx = raw.indexOf(boundaryMarker, pos);
          if (startIdx === -1) break;
          const nextIdx = raw.indexOf(boundaryMarker, startIdx + boundaryMarker.length);
          if (nextIdx === -1) break;
          // [FIX-Bug9] endMarker check
          const nextSection = raw.slice(nextIdx, nextIdx + endMarker.length + 2);
          const isLast = nextSection.indexOf(endMarker) === 0;
          const section = raw.slice(startIdx + boundaryMarker.length + 2, nextIdx);
          const headerEnd = section.indexOf(Buffer.from('\r\n\r\n'));
          if (headerEnd === -1) { pos = nextIdx; continue; }
          const headerStr = section.slice(0, headerEnd).toString();
          const bodyBuf = section.slice(headerEnd + 4, section.length - 2);
          const nameMatch = headerStr.match(/name="([^"]+)"/);
          const filenameMatch = headerStr.match(/filename="([^"]+)"/);
          if (nameMatch) {
            const name = nameMatch[1];
            if (filenameMatch) {
              const ext = path.extname(filenameMatch[1]).toLowerCase();
              const allowed = ['.png','.jpg','.jpeg','.gif','.webp','.mp4','.webm','.mov','.avi'];
              if (!allowed.includes(ext)) { pos = nextIdx; continue; }
              const maxSize = 300 * 1024 * 1024;
              if (bodyBuf.length > maxSize) { pos = nextIdx; continue; }
              const fileName = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
              const filePath = path.join(UPLOADS_DIR, fileName);
              fs.writeFileSync(filePath, bodyBuf);
              parts[name] = { fileName, originalName: filenameMatch[1], size: bodyBuf.length, path: '/uploads/' + fileName };
            } else {
              parts[name] = bodyBuf.toString('utf-8').trim();
            }
          }
          if (isLast) break; // [FIX-Bug9]
          pos = nextIdx;
        }
        resolve(parts);
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// [FIX-Bug1] sseClients + notifySSE moved outside createServer
const sseClients = [];

function notifySSE(event, data) {
  const msg = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
  sseClients.forEach(function(res) {
    res.write(msg);
  });
}

const server = http.createServer((req, res) => {
  const t0 = Date.now(); // [UPGRADE-3]

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  if (url === '/api/orders' && req.method === 'POST') {
    parseBody(req).then(data => {
      data.id = data.id || 'ECO-' + Date.now();
      data.receivedAt = new Date().toISOString();
      orders.push(data);
      saveOrders(); // [FIX-Bug4]
      if (data.customerEmail) {
        (async () => {
          try {
            const itemsHtml = (data.items || []).map(item =>
              '<tr>' +
                '<td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;font-size:14px">' + escapeHtml(item.name) + ' × ' + item.qty + '</td>' +
                '<td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;text-align:right;font-size:14px;font-weight:700">$' + (item.price * item.qty).toFixed(2) + '</td>' +
              '</tr>'
            ).join('');
            await sendEmail({
              to: data.customerEmail,
              subject: '[Website Mô Phỏng] - Hóa Đơn Đặt Hàng Thành Công #' + data.id,
              html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px">' +
                '<div style="text-align:center;margin-bottom:20px">' +
                  '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#16a34a,#22c55e);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:24px">✓</div>' +
                  '<h2 style="color:#16a34a;margin:10px 0 4px">Đặt hàng thành công!</h2>' +
                '</div>' +
                '<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">' +
                  '<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#6b7280">Mã đơn hàng:</span><strong>' + escapeHtml(data.id) + '</strong></div>' +
                  '<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#6b7280">Khách hàng:</span><span>' + escapeHtml(data.customer || '') + '</span></div>' +
                  '<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#6b7280">Số điện thoại:</span><span>' + escapeHtml(data.customerPhone || '') + '</span></div>' +
                  '<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#6b7280">Phương thức:</span><span>' + escapeHtml(data.payment || '') + '</span></div>' +
                '</div>' +
                '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
                  '<thead><tr>' +
                    '<th style="text-align:left;padding:8px 12px;background:#f0fdf4;border-radius:8px 0 0 8px;font-size:13px;color:#14532d">Sản phẩm</th>' +
                    '<th style="text-align:right;padding:8px 12px;background:#f0fdf4;border-radius:0 8px 8px 0;font-size:13px;color:#14532d">Thành tiền</th>' +
                  '</tr></thead>' +
                  '<tbody>' + itemsHtml + '</tbody>' +
                '</table>' +
                '<div style="display:flex;justify-content:space-between;padding:12px 0;border-top:2px solid #14532d;font-size:18px;font-weight:800;color:#14532d">' +
                  '<span>Tổng cộng</span>' +
                  '<span>$' + Number(data.total || 0).toFixed(2) + '</span>' +
                '</div>' +
                '<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">' +
                '<p style="color:#888;font-size:12px;text-align:center">Email này được gửi tự động từ hệ thống Website Mô Phỏng.</p>' +
              '</div>'
            });
          } catch (err) {
            console.error('Invoice email error:', err);
          }
        })();
      }
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id: data.id }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/orders' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(orders));
    return;
  }

  if (url === '/api/users' && req.method === 'GET') {
    const _now = Date.now();
    serverUsers.forEach(u => {
      if (u.banned && u.banType === 'ban' && u.banExpiresAt && u.banExpiresAt <= _now) {
        u.banned = false; u.banType = null; u.banMessage = null; u.banExpiresAt = null; u.bannedAt = null;
      }
    });
    saveUsers();
    const result = serverUsers.map(u => ({
      ...u
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (url === '/api/users/accounts' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    const list = serverUsers.map(u => ({ // [FIX-Bug5]
      id: u.id,
      username: u.username,
      phone: u.phone || '',
      email: u.email,
      createdAt: u.createdAt,
      banned: u.banned || false,
      banType: u.banType || null,
      banMessage: u.banMessage || null
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }

  // [FIX-Bug3] admin login
  if (url === '/api/admin/login' && req.method === 'POST') {
    parseBody(req).then(data => {
      const user = serverUsers.find(u => (u.username === data.username || u.email === data.username) && u.role === 'admin');
      if (!user || !verifyPassword(data.password, user.password)) {
        sendError(res, 401, 'AUTH_FAILED', 'Invalid admin credentials');
        return;
      }
      const sessionId = crypto.randomBytes(32).toString('hex');
      adminSessions[sessionId] = { userId: user.id, username: user.username, createdAt: Date.now() };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, sessionId, username: user.username }));
    }).catch(() => sendError(res, 400, 'INVALID_JSON', 'Invalid JSON'));
    return;
  }

  if (url === '/api/register' && req.method === 'POST') {
    // [UPGRADE-1] rate limit
    if (rateLimit(req.connection.remoteAddress, 5, 60000)) {
      sendError(res, 429, 'RATE_LIMITED', 'Quá nhiều yêu cầu, vui lòng thử lại sau');
      return;
    }
    parseBody(req).then(data => {
      if (!data.username || !data.password || !data.email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields' }));
        return;
      }
      // [UPGRADE-2] validate input
      if (!validateUsername(data.username)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username must be 3-30 chars (a-z, 0-9, _)' }));
        return;
      }
      if (!validateEmail(data.email)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid email' }));
        return;
      }
      if (!validatePassword(data.password)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Password must be 6-100 characters' }));
        return;
      }
      const exists = serverUsers.find(u => u.username === data.username || u.email === data.email);
      if (exists) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Username or email already exists' }));
        return;
      }
      const newUser = {
        id: serverUsers.length ? Math.max(...serverUsers.map(u => u.id)) + 1 : 1,
        username: data.username,
        password: hashPassword(data.password), // [FIX-Bug2]
        phone: data.phone || '',
        email: data.email,
        fullName: data.fullName || data.username,
        createdAt: new Date().toISOString(),
        banned: false,
        banType: null,
        banMessage: null,
        banExpiresAt: null,
        bannedAt: null,
        membershipType: 'Thường',
        membershipPlan: null,
        membershipPlanName: null,
        membershipStartDate: null,
        membershipEndDate: null,
        membershipDiscount: 0,
        membershipFreeShipping: 0
      };
      serverUsers.push(newUser);
      saveUsers();
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user: newUser }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/login' && req.method === 'POST') {
    // [UPGRADE-1] rate limit
    if (rateLimit(req.connection.remoteAddress, 10, 60000)) {
      sendError(res, 429, 'RATE_LIMITED', 'Quá nhiều yêu cầu, vui lòng thử lại sau');
      return;
    }
    parseBody(req).then(data => {
      if (!data.username || !data.password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields' }));
        return;
      }
      let user = serverUsers.find(u => (u.username === data.username || u.email === data.username));
      if (data.wrongAttempts !== undefined && user) {
        user.wrongAttempts = data.wrongAttempts;
        user.lockCount = data.lockCount || 0;
        if (data.banned !== undefined) {
          user.banned = data.banned;
          user.banType = data.banType || null;
          user.banMessage = data.banMessage || null;
          user.banExpiresAt = data.banExpiresAt || null;
          user.bannedAt = data.bannedAt || null;
        }
        saveUsers();
      }
      if (!user || !verifyPassword(data.password, user.password)) { // [FIX-Bug2]
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
        return;
      }
      if (user.banned && user.banType === 'ban' && user.banExpiresAt && user.banExpiresAt <= Date.now()) {
        user.banned = false; user.banType = null; user.banMessage = null; user.banExpiresAt = null; user.bannedAt = null;
        saveUsers();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/forgot-password' && req.method === 'POST') {
    // [UPGRADE-1] rate limit
    if (rateLimit(req.connection.remoteAddress, 3, 60000)) {
      sendError(res, 429, 'RATE_LIMITED', 'Quá nhiều yêu cầu, vui lòng thử lại sau');
      return;
    }
    parseBody(req).then(async data => {
      const { email } = data;
      if (!email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Email is required' }));
        return;
      }
      const user = serverUsers.find(u => u.email === email);
      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Email not found' }));
        return;
      }
      const otp = generateOtp();
      otpStore[email] = { otp, expiresAt: Date.now() + 180000, userId: user.id };
      try {
        await sendEmail({
          to: email,
          subject: '[Website Mô Phỏng] - Mã OTP Đặt Lại Mật Khẩu',
          html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px">' +
            '<h2 style="color:#16a34a;">Xác thực OTP</h2>' +
            '<p>Mã OTP của bạn là:</p>' +
            '<div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:#f0fdf4;border-radius:8px;margin:16px 0;color:#14532d;">' + otp + '</div>' +
            '<p>Mã này có hiệu lực trong vòng <strong>3 phút</strong>.</p>' +
            '<p style="color:#dc2626;font-size:13px;">Vui lòng không cung cấp mã này cho bất kỳ ai.</p>' +
            '<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">' +
            '<p style="color:#888;font-size:12px;">Email này được gửi tự động từ hệ thống Website Mô Phỏng.</p></div>'
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'OTP sent' }));
      } catch (err) {
        console.error('Email error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Không thể gửi email. Vui lòng kiểm tra cấu hình Gmail.' }));
      }
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/verify-otp' && req.method === 'POST') {
    parseBody(req).then(data => {
      const { email, otp, newPassword } = data;
      if (!email || !otp || !newPassword) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields' }));
        return;
      }
      const record = otpStore[email];
      if (!record) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No OTP requested' }));
        return;
      }
      if (Date.now() > record.expiresAt) {
        delete otpStore[email];
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OTP expired' }));
        return;
      }
      if (record.otp !== otp) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Wrong OTP' }));
        return;
      }
      const user = serverUsers.find(u => u.id === record.userId);
      if (user) {
        user.password = hashPassword(newPassword); // [FIX-Bug2]
        saveUsers();
      }
      delete otpStore[email];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Password reset successful' }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/users/ban' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const user = serverUsers.find(u => String(u.id) === String(data.id));
      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }
      const durationHours = parseInt(data.durationHours) || 24;
      user.banned = true;
      user.banType = 'ban';
      user.banMessage = data.message || 'Tài khoản đã bị cấm sẽ mở sau một thời gian';
      user.banExpiresAt = Date.now() + durationHours * 3600000;
      user.bannedAt = Date.now();
      user.banReason = data.banReason || data.message || '';
      saveUsers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/users/unban' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const user = serverUsers.find(u => String(u.id) === String(data.id));
      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }
      user.banned = false;
      user.banType = null;
      user.banMessage = null;
      user.banExpiresAt = null;
      user.bannedAt = null;
      saveUsers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/users/delete' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const user = serverUsers.find(u => String(u.id) === String(data.id));
      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }
      user.banned = true;
      user.banType = 'delete';
      user.banMessage = 'Tài khoản đã bị cấm do vi phạm chính sách';
      user.banExpiresAt = null;
      user.bannedAt = Date.now();
      saveUsers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/users/change-password' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const user = serverUsers.find(u => String(u.id) === String(data.id));
      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }
      user.password = hashPassword(data.password || user.password); // [FIX-Bug2]
      saveUsers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/tickets' && req.method === 'POST') {
    const ct = req.headers['content-type'] || '';
    const handler = ct.includes('multipart/form-data') ? parseMultipart(req) : parseBody(req);
    handler.then(data => {
      const fields = ct.includes('multipart/form-data') ? data : { ...data, files: [] };
      if (!fields.fullName || !fields.contact || !fields.title || !fields.content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields' }));
        return;
      }
      // [UPGRADE-2] sanitize
      const fullName = sanitizeString(fields.fullName, 100);
      const contact = sanitizeString(fields.contact, 200);
      const title = sanitizeString(fields.title, 200);
      const content = sanitizeString(fields.content, 2000);
      const files = [];
      ['file1','file2','file3'].forEach(k => {
        if (fields[k] && fields[k].fileName) files.push(fields[k]);
      });
      if (data.files) {
        if (Array.isArray(data.files)) files.push(...data.files);
        else if (data.files.fileName) files.push(data.files);
      }
      const ticket = {
        id: 'TK-' + Date.now() + Math.floor(Math.random() * 1000),
        fullName: fullName,
        contact: contact,
        title: title,
        content: content,
        urgency: fields.urgency || 'medium',
        files: files,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      tickets.push(ticket);
      saveData(TICKETS_FILE, tickets);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ticket }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    });
    return;
  }

  if (url === '/api/tickets' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tickets));
    return;
  }

  if (url === '/api/tickets/status' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const ticket = tickets.find(t => t.id === data.id);
      if (!ticket) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ticket not found' }));
        return;
      }
      ticket.status = data.status || ticket.status;
      ticket.updatedAt = new Date().toISOString();
      saveData(TICKETS_FILE, tickets);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ticket }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/chat/send' && req.method === 'POST') {
    parseBody(req).then(data => {
      if (!data.message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Message is required' }));
        return;
      }
      const convId = data.convId || 'conv-' + Date.now();
      if (!chatConversations[convId]) {
        chatConversations[convId] = {
          id: convId,
          userName: data.userName || 'Khách',
          userEmail: data.userEmail || '',
          createdAt: new Date().toISOString(),
          status: 'active',
          messages: []
        };
      }
      const conv = chatConversations[convId];
      if (conv.status === 'closed') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Conversation is closed' }));
        return;
      }
      const msg = {
        id: 'msg-' + Date.now() + Math.floor(Math.random() * 1000),
        sender: 'user',
        userName: data.userName || 'Khách',
        message: data.message,
        createdAt: new Date().toISOString()
      };
      conv.messages.push(msg);
      if (conv.status === 'active') {
        conv.status = 'bot_replied';
        const autoReply = {
          id: 'msg-' + Date.now() + Math.floor(Math.random() * 1000),
          sender: 'bot',
          userName: 'EcoBot',
          message: '__SHOW_OPTIONS__',
          createdAt: new Date().toISOString()
        };
        conv.messages.push(autoReply);
      }
      saveData(CHAT_FILE, chatConversations);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, convId, status: conv.status, message: msg }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/chat/messages' && req.method === 'GET') {
    const convId = req.url.split('?')[1] ? req.url.split('=')[1] : null;
    if (convId && chatConversations[convId]) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(chatConversations[convId].messages));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }

  if (url === '/api/chat/conversations' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    const list = Object.values(chatConversations);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const summary = list.map(c => ({
      id: c.id,
      userName: c.userName,
      userEmail: c.userEmail,
      createdAt: c.createdAt,
      status: c.status || 'active',
      messageCount: (c.messages || []).length,
      lastMessage: c.messages && c.messages.length ? c.messages[c.messages.length - 1] : null
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(summary));
    return;
  }

  if (url === '/api/chat/reply' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const conv = chatConversations[data.convId];
      if (!conv) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Conversation not found' }));
        return;
      }
      const msg = {
        id: 'msg-' + Date.now() + Math.floor(Math.random() * 1000),
        sender: 'admin',
        userName: 'Admin',
        message: data.message,
        createdAt: new Date().toISOString()
      };
      conv.messages.push(msg);
      saveData(CHAT_FILE, chatConversations);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: msg }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/chat/connect-admin' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const conv = chatConversations[data.convId];
      if (!conv) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Conversation not found' }));
        return;
      }
      conv.status = 'waiting_admin';
      const notifyMsg = {
        id: 'msg-' + Date.now() + Math.floor(Math.random() * 1000),
        sender: 'bot',
        userName: 'EcoBot',
        message: '__CONNECTED_ADMIN__',
        createdAt: new Date().toISOString()
      };
      conv.messages.push(notifyMsg);
      saveData(CHAT_FILE, chatConversations);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status: 'waiting_admin' }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  function saveWithdrawals() { saveData(WITHDRAWALS_FILE, withdrawals); }

  if (url === '/api/withdrawals' && req.method === 'POST') {
    parseBody(req).then(data => {
      if (!data.id || !data.userId || !data.amount) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields' }));
        return;
      }
      const wd = {
        id: data.id,
        userId: data.userId,
        userName: data.userName || '',
        amount: data.amount,
        method: data.method || 'bank',
        accountDetails: data.accountDetails || {},
        status: data.status || 'Chờ duyệt',
        createdAt: data.createdAt || Date.now()
      };
      withdrawals.push(wd);
      saveWithdrawals();
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, withdrawal: wd }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/withdrawals' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(withdrawals));
    return;
  }

  if (url === '/api/withdrawals/status' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const wd = withdrawals.find(w => w.id === data.id);
      if (!wd) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Withdrawal not found' }));
        return;
      }
      wd.status = data.status || wd.status;
      saveWithdrawals();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, withdrawal: wd }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/vip/plans' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(Object.values(VIP_PLANS)));
    return;
  }

  if (url === '/api/vip/register' && req.method === 'POST') {
    parseBody(req).then(data => {
      if (!data.userId || !data.planId || !data.paymentMethod) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields' }));
        return;
      }
      const plan = VIP_PLANS[data.planId];
      if (!plan) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid plan' }));
        return;
      }
      const user = serverUsers.find(u => String(u.id) === String(data.userId));
      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }
      const now = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      user.membershipType = 'VIP';
      user.membershipPlan = plan.id;
      user.membershipPlanName = plan.name;
      user.membershipStartDate = now;
      user.membershipEndDate = endDate;
      user.membershipDiscount = plan.discount;
      user.membershipFreeShipping = plan.freeShipping;
      saveUsers();
      const tx = {
        id: 'VTX-' + Date.now() + Math.floor(Math.random() * 1000),
        userId: String(data.userId),
        username: user.username,
        planId: plan.id,
        planName: plan.name,
        amount: plan.price,
        paymentMethod: data.paymentMethod,
        status: 'completed',
        createdAt: now
      };
      vipTransactions.push(tx);
      saveVipTransactions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user, transaction: tx }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/vip/status' && req.method === 'POST') {
    parseBody(req).then(data => {
      const user = serverUsers.find(u => String(u.id) === String(data.userId));
      if (!user) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ vip: false }));
        return;
      }
      const isVip = user.membershipType === 'VIP' && user.membershipEndDate && new Date(user.membershipEndDate).getTime() > Date.now();
      if (!isVip && user.membershipType === 'VIP') {
        user.membershipType = 'Thường';
        user.membershipPlan = null;
        user.membershipPlanName = null;
        user.membershipDiscount = 0;
        user.membershipFreeShipping = 0;
        saveUsers();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        vip: isVip,
        membershipType: user.membershipType || 'Thường',
        membershipPlan: user.membershipPlan || null,
        membershipPlanName: user.membershipPlanName || null,
        membershipStartDate: user.membershipStartDate || null,
        membershipEndDate: user.membershipEndDate || null,
        membershipDiscount: user.membershipDiscount || 0,
        membershipFreeShipping: user.membershipFreeShipping || 0
      }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/vip/transactions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(vipTransactions));
    return;
  }

  if (url === '/api/vip/cancel' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const user = serverUsers.find(u => String(u.id) === String(data.userId));
      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }
      user.membershipType = 'Thường';
      user.membershipPlan = null;
      user.membershipPlanName = null;
      user.membershipDiscount = 0;
      user.membershipFreeShipping = 0;
      user.membershipStartDate = null;
      user.membershipEndDate = null;
      saveUsers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/vip/extend' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const user = serverUsers.find(u => String(u.id) === String(data.userId));
      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }
      const currentEnd = user.membershipEndDate ? new Date(user.membershipEndDate).getTime() : Date.now();
      const newEnd = new Date(currentEnd + 30 * 24 * 60 * 60 * 1000).toISOString();
      user.membershipEndDate = newEnd;
      if (!user.membershipType || user.membershipType === 'Thường') {
        user.membershipType = 'VIP';
      }
      saveUsers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/vip/list' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    const vipUsers = serverUsers.filter(u => u.membershipType === 'VIP').map(u => ({
      id: u.id,
      username: u.username,
      membershipType: u.membershipType,
      membershipPlan: u.membershipPlan,
      membershipPlanName: u.membershipPlanName,
      membershipStartDate: u.membershipStartDate,
      membershipEndDate: u.membershipEndDate
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(vipUsers));
    return;
  }

  if (url === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('event: connected\ndata: {}\n\n');
    sseClients.push(res); // [FIX-Bug1] references module-level array
    req.on('close', function() {
      var idx = sseClients.indexOf(res);
      if (idx > -1) sseClients.splice(idx, 1);
    });
    return;
  }

  function saveBanners() { saveData(BANNERS_FILE, banners); }

  if (url === '/api/banners' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(banners));
    return;
  }

  if (url === '/api/banners' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const newBanner = {
        id: 'BNR-' + Date.now() + Math.floor(Math.random() * 1000),
        title: data.title || '',
        image: data.image || '',
        link: data.link || '',
        active: data.active !== undefined ? data.active : true,
        supplierName: data.supplierName || '',
        createdAt: Date.now()
      };
      banners.push(newBanner);
      saveBanners();
      notifySSE('banner_created', newBanner);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, banner: newBanner }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/banners/update' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const banner = banners.find(b => b.id === data.id);
      if (!banner) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Banner not found' }));
        return;
      }
      if (data.title !== undefined) banner.title = data.title;
      if (data.image !== undefined) banner.image = data.image;
      if (data.link !== undefined) banner.link = data.link;
      if (data.active !== undefined) banner.active = data.active;
      if (data.supplierName !== undefined) banner.supplierName = data.supplierName;
      saveBanners();
      notifySSE('banner_updated', banner);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, banner }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url.startsWith('/api/banners/delete/') && req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    const id = url.split('/api/banners/delete/')[1];
    const idx = banners.findIndex(b => b.id === id);
    if (idx === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Banner not found' }));
      return;
    }
    banners.splice(idx, 1);
    saveBanners();
    notifySSE('banner_deleted', { id: id });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (url === '/api/banners/toggle' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const banner = banners.find(b => b.id === data.id);
      if (!banner) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Banner not found' }));
        return;
      }
      banner.active = !banner.active;
      saveBanners();
      notifySSE('banner_updated', banner);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, active: banner.active }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  // [NEW] Ad Campaign System - replaces old ad-requests
  function saveAdRequests() { saveData(AD_REQUESTS_FILE, adRequests); }

  function saveReports() { saveData(REPORTS_FILE, reports); }

  // [NEW] Ad Campaign System - GET available ad slots
  if (url === '/api/ad-slots' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(Object.values(AD_SLOTS)));
    return;
  }

  // [NEW] Ad Campaign System - POST create new ad campaign
  if (url === '/api/ad-campaigns' && req.method === 'POST') {
    const ct = req.headers['content-type'] || '';
    const handler = ct.includes('multipart/form-data') ? parseMultipart(req) : parseBody(req);
    handler.then(data => {
      const fields = ct.includes('multipart/form-data') ? data : data;
      const isFormData = ct.includes('multipart/form-data');
      const campaignName = sanitizeString(isFormData ? fields.campaignName : data.campaignName, 200);
      const businessName = sanitizeString(isFormData ? fields.businessName : data.businessName, 200);
      const contactPerson = sanitizeString(isFormData ? fields.contactPerson : data.contactPerson, 100);
      const phone = sanitizeString(isFormData ? fields.phone : data.phone, 20);
      const email = sanitizeString(isFormData ? fields.email : data.email, 100);
      const headline = sanitizeString(isFormData ? fields.headline : data.headline, 500);
      const ctaLink = sanitizeString(isFormData ? fields.ctaLink : data.ctaLink, 500);
      const slotType = sanitizeString(isFormData ? fields.slotType : data.slotType, 20);
      const dailyBudget = parseFloat(isFormData ? fields.dailyBudget : data.dailyBudget) || 0;
      const totalBudget = parseFloat(isFormData ? fields.totalBudget : data.totalBudget) || 0;
      const startDate = parseInt(isFormData ? fields.startDate : data.startDate) || Date.now();
      const endDate = parseInt(isFormData ? fields.endDate : data.endDate) || 0;
      const userId = isFormData ? (fields.userId || '') : (data.userId || '');

      if (!campaignName || !businessName || !contactPerson || !phone || !slotType || dailyBudget <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: campaignName, businessName, contactPerson, phone, slotType, dailyBudget' }));
        return;
      }
      if (!AD_SLOTS[slotType]) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid slot type' }));
        return;
      }

      let image = null;
      if (isFormData) {
        ['file1','image'].forEach(k => {
          if (fields[k] && fields[k].fileName) image = fields[k];
        });
      } else if (data.image) {
        image = typeof data.image === 'string' ? { path: data.image } : data.image;
      }

      const campaign = {
        id: 'CMP-' + Date.now() + Math.floor(Math.random() * 1000),
        campaignName: campaignName,
        businessName: businessName,
        contactPerson: contactPerson,
        phone: phone,
        email: email,
        headline: headline,
        ctaLink: ctaLink || '/shop',
        slotType: slotType,
        dailyBudget: dailyBudget,
        totalBudget: totalBudget > 0 ? totalBudget : dailyBudget * 30,
        spent: 0,
        startDate: startDate,
        endDate: endDate,
        image: image,
        status: 'pending',
        userId: userId,
        adminNote: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        stats: { impressions: 0, clicks: 0 }
      };
      adRequests.push(campaign);
      saveAdRequests();
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, campaign }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    });
    return;
  }

  // [NEW] Ad Campaign System - GET campaigns (admin: all, user: filtered by userId)
  if (url === '/api/ad-campaigns' && req.method === 'GET') {
    const query = req.url.split('?')[1] || '';
    const userId = getQueryParam(query, 'userId');
    let result = adRequests;
    if (userId) {
      result = adRequests.filter(c => String(c.userId) === String(userId));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // [NEW] Ad Campaign System - POST update campaign status (admin)
  if (url === '/api/ad-campaigns/status' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    parseBody(req).then(data => {
      const campaign = adRequests.find(c => c.id === data.id);
      if (!campaign) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Campaign not found' }));
        return;
      }
      const validStatuses = ['active', 'rejected', 'completed'];
      if (!validStatuses.includes(data.status)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid status' }));
        return;
      }
      campaign.status = data.status;
      if (data.adminNote !== undefined) campaign.adminNote = data.adminNote;
      campaign.updatedAt = Date.now();
      saveAdRequests();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, campaign }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  // [NEW] Ad Campaign System - POST pause/resume campaign (user or admin)
  if (url === '/api/ad-campaigns/toggle' && req.method === 'POST') {
    parseBody(req).then(data => {
      const campaign = adRequests.find(c => c.id === data.id);
      if (!campaign) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Campaign not found' }));
        return;
      }
      if (campaign.status === 'active') {
        campaign.status = 'paused';
      } else if (campaign.status === 'paused') {
        campaign.status = 'active';
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Can only toggle active/paused campaigns' }));
        return;
      }
      campaign.updatedAt = Date.now();
      saveAdRequests();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status: campaign.status, campaign }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  // [NEW] Ad Campaign System - POST track impression/click
  if (url === '/api/ad-campaigns/track' && req.method === 'POST') {
    parseBody(req).then(data => {
      const campaign = adRequests.find(c => c.id === data.id);
      if (!campaign) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Campaign not found' }));
        return;
      }
      if (data.type === 'impression') campaign.stats.impressions = (campaign.stats.impressions || 0) + 1;
      if (data.type === 'click') campaign.stats.clicks = (campaign.stats.clicks || 0) + 1;
      saveAdRequests();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, stats: campaign.stats }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/orders' && req.method === 'DELETE') {
    orders.length = 0;
    saveOrders(); // [FIX-Bug4]
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (url === '/api/reports' && req.method === 'POST') {
    parseBody(req).then(data => {
      if (!data.type || !data.reportedUserId || !data.content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: type, reportedUserId, content' }));
        return;
      }
      if (data.reporterUserId && data.reporterUserId === data.reportedUserId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Không thể tự báo cáo chính mình' }));
        return;
      }
      const report = {
        id: 'RPT-' + Date.now() + Math.floor(Math.random() * 1000),
        reporterUserId: data.reporterUserId || '',
        reporterName: data.reporterName || 'Khách',
        reportedUserId: data.reportedUserId,
        reportedName: data.reportedName || '',
        type: data.type,
        reason: data.reason || '',
        content: data.content,
        createdAt: Date.now(),
        status: 'pending'
      };
      reports.push(report);
      saveReports();
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, report }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/reports' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(reports));
    return;
  }

  if (url === '/api/reports/status' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // [FIX-Bug3]
    parseBody(req).then(data => {
      const report = reports.find(r => r.id === data.id);
      if (!report) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Report not found' }));
        return;
      }
      report.status = data.status || report.status;
      if (data.adminNote !== undefined) report.adminNote = data.adminNote;
      report.resolvedAt = Date.now();
      saveReports();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, report }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  if (url === '/api/community/chat' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(communityMessages));
    return;
  }

  if (url === '/api/community/chat' && req.method === 'POST') {
    parseBody(req).then(data => {
      const userId = data.userId || '';
      const userName = (data.userName || '').trim();
      let text = (data.text || '').trim();
      // [UPGRADE-2] strip HTML tags
      text = text.replace(/<[^>]*>/g, '');
      if (!userId || !userName || !text) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Thiếu thông tin' }));
        return;
      }
      if (text.length > 500) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Tin nhắn quá dài (tối đa 500 ký tự)' }));
        return;
      }
      const now = Date.now();
      const last = communityCooldown[userId] || 0;
      if (now - last < 15000) {
        const remain = Math.ceil((15000 - (now - last)) / 1000);
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Vui lòng đợi ' + remain + ' giây trước khi gửi tin nhắn tiếp theo', cooldown: remain }));
        return;
      }
      communityCooldown[userId] = now;
      const msg = {
        id: 'cl-' + Date.now() + Math.floor(Math.random() * 1000),
        userId: userId,
        userName: userName,
        text: text,
        createdAt: now
      };
      communityMessages.push(msg);
      saveData(COMMUNITY_CHAT_FILE, communityMessages);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: msg }));
    }).catch(() => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
    return;
  }

  // ===== TV Management API (admin) =====
  const TV_DATA_FILE = path.join(root, 'mock', 'ecotv-data.json');

  function loadTvData() {
    try { return JSON.parse(fs.readFileSync(TV_DATA_FILE, 'utf-8')); }
    catch (e) { return { channels: [], videos: [], livestreams: [], schedule: [], ecoChallenges: [], rewards: [] }; }
  }

  function saveTvData(data) {
    const tmp = TV_DATA_FILE + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmp, TV_DATA_FILE);
      return true;
    } catch(e) {
      try { fs.unlinkSync(tmp); } catch(_) {}
      return false;
    }
  }

  if (url === '/api/tv/data' && req.method === 'GET') {
    const data = loadTvData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (url === '/api/tv/data' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    parseBody(req).then(data => {
      if (saveTvData(data)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        sendError(res, 500, 'SAVE_ERROR', 'Không thể lưu dữ liệu');
      }
    }).catch(() => sendError(res, 400, 'INVALID_JSON', 'Invalid JSON'));
    return;
  }

  if (url.startsWith('/uploads/')) {
    const filePath = path.join(root, url);
    if (!filePath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const extMap = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.avi':'video/x-msvideo' };
      res.writeHead(200, { 'Content-Type': extMap[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
    return;
  }

  // Serve /mock/ and /js/ directories (livestream module)
  if (url.startsWith('/mock/') || url.startsWith('/js/')) {
    let filePath = path.resolve(path.join(root, url));
    if (!filePath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
      res.end(data);
    });
    return;
  }

  let requestedPath = req.url === '/' ? 'index.html' : url;
  let filePath = path.resolve(path.join(root, requestedPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    const status = err ? 404 : 200;
    if (err) { res.writeHead(404); res.end('Not found'); logRequest(req.method, url, 404, Date.now() - t0); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'text/plain',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://code.jquery.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; img-src 'self' https://images.unsplash.com https://placehold.co https://cdn.jsdelivr.net https://img.icons8.com https://api.dicebear.com https://icons.duckduckgo.com data: blob:; connect-src 'self' https://test-streams.mux.dev; media-src 'self' https://test-streams.mux.dev blob:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;" // [FIX-Bug7]
    });
    res.end(data);
    logRequest(req.method, url, 200, Date.now() - t0); // [UPGRADE-3]
  });
});

// [UPGRADE-4] graceful shutdown
process.on('SIGTERM', () => { console.log('Shutting down...'); server.close(() => process.exit(0)); });
process.on('SIGINT', () => { console.log('Shutting down...'); server.close(() => process.exit(0)); });

server.listen(port, () => console.log('Server running on http://localhost:' + port));

// ==================== VERCEL SERVERLESS ENTRY ====================

const server = require('../server');

// قائمة الأصول المسموح بها
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://l3bty-frontend-foksenw35-mohamedawees21s-projects.vercel.app',
  'https://l3bty.vercel.app',
  'https://l3bty-frontend.vercel.app'
];

// Wrapper مخصوص لـ Vercel عشان CORS يشتغل صح
module.exports = async (req, res) => {
  const origin = req.headers.origin;

  // 🔥 CORS HEADERS - نحدد الأصل بدقة
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development' && origin?.startsWith('http://localhost:')) {
    // في development، اسمح بكل المنافذ المحلية
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // للأمان، لا نسمح بأصول غير معروفة
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }

  // باقي الهيدرات
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-HTTP-Method-Override');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Authorization');

  // مهم جدًا: الرد على preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // للتشخيص
  console.log('📡 Vercel Function:', {
    method: req.method,
    url: req.url,
    origin: origin,
    allowed: allowedOrigins.includes(origin) ? '✅' : '❌'
  });

  return server(req, res);
};
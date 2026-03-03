const app = require('../server');

module.exports = (req, res) => {

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', 'https://l3bty-frontend-frw34sv0e-l3btystore-projects.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // مهم جدًا للـ preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return app(req, res);
};
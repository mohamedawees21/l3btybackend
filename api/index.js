const app = require('../server');

module.exports = (req, res) => {

  const origin = req.headers.origin;

  // اسمح للفرونت فقط
  if (origin && origin.includes('l3bty-frontend')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return app(req, res);
};
const http = require('http');
const urls = [
  'http://127.0.0.1:3000/_next/static/css/app/layout.css?v=1779144966835',
  'http://127.0.0.1:3000/_next/static/chunks/app/app/layout.js',
  'http://127.0.0.1:3000/_next/static/chunks/app/app/page.js',
  'http://127.0.0.1:3000/_next/static/chunks/webpack.js?v=1779144966835'
];
let i = 0;
const next = () => {
  if (i >= urls.length) return;
  const url = urls[i++];
  const req = http.get(url, { timeout: 5000 }, (res) => {
    let body = '';
    res.on('data', (c) => (body += c.toString()));
    res.on('end', () => {
      console.log(url, 'status', res.statusCode, 'len', body.length, 'type', res.headers['content-type']);
      console.log(body.slice(0, 200).replace(/\n/g, ' '));
      next();
    });
  });
  req.on('error', (e) => {
    console.log(url, 'ERROR', e.message);
    next();
  });
  req.on('timeout', () => {
    req.destroy();
    console.log(url, 'ERROR timeout');
    next();
  });
};
next();

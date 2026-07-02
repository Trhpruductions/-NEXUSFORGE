const urls = [
  'http://127.0.0.1:3000/',
  'http://127.0.0.1:3000/app/notifications',
  'http://127.0.0.1:4001/api/health',
  'http://127.0.0.1:4001/api/health/discord'
];
for (const url of urls) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('URL:', url);
    console.log('Status:', res.status, res.statusText);
    console.log('BodyHead:', text.slice(0, 240).replace(/\n/g, ' '));
    console.log('---');
  } catch (err) {
    console.error('ERROR', url, err.message);
  }
}

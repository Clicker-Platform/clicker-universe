const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrclickeruniverse = onRequest({"region":"us-central1","memory":"512MiB"}, (req, res) => server.then(it => it.handle(req, res)));
  
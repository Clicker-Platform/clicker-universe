const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrclickerapps = onRequest({"region":"us-central1","memory":1024}, (req, res) => server.then(it => it.handle(req, res)));
  
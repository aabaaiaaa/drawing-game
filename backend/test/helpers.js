const { io: ioClient } = require('socket.io-client');

process.env.E2E_TEST = '1';

function startServer() {
  delete require.cache[require.resolve('../server.js')];
  const { server, io, rooms } = require('../server.js');
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      resolve({ url: `http://localhost:${port}`, server, io, rooms });
    });
  });
}

function stopServer(ctx) {
  return new Promise((resolve) => {
    try { ctx.io.disconnectSockets(true); } catch {}
    ctx.io.close(() => {
      ctx.server.close(() => resolve());
      ctx.server.closeAllConnections?.();
    });
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const sock = ioClient(url, { transports: ['websocket'], forceNew: true });
    sock.on('connect', () => resolve(sock));
    sock.on('connect_error', reject);
  });
}

function once(sock, event, { timeout = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    sock.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

function never(sock, event, { wait = 200 } = {}) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => reject(new Error(`Unexpected ${event}: ${JSON.stringify(payload)}`));
    sock.once(event, handler);
    setTimeout(() => {
      sock.off(event, handler);
      resolve();
    }, wait);
  });
}

module.exports = { startServer, stopServer, connect, once, never };

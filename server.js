const express = require('express');
const { createServer } = require('http');
const next = require('next');
const { ExpressPeerServer } = require('peer');
const os = require('os');

const dev = process.env.NODE_ENV !== 'production';
const port = 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

app.prepare().then(() => {
    const expressApp = express();
    const server = createServer(expressApp);

    // Enable CORS for mobile access
    const cors = require('cors');
    expressApp.use(cors());

    // PeerJS Server
    const peerServer = ExpressPeerServer(server, {
        debug: true,
        path: '/myapp'
    });

    expressApp.use('/peerjs', peerServer);

    // Default Next.js handler
    expressApp.all('*', (req, res) => {
        return handle(req, res);
    });

    server.listen(port, (err) => {
        if (err) throw err;
        const localIp = getLocalIp();
        console.log(`> AmanDrop (PeerJS) ready on http://${localIp}:${port}`);
        console.log(`> PeerServer running at http://${localIp}:${port}/peerjs/myapp`);
    });
});

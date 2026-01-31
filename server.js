const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const os = require('os');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = 3000;

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (non-127.0.0.1) and non-ipv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(server);

    io.on('connection', (socket) => {
        // Default room logic: Client should emit 'join'
        // Storing the room in socket.data for convenience, or referencing socket.rooms

        socket.on('join', (roomId) => {
            socket.join(roomId);
            socket.data.room = roomId;
            console.log(`Socket ${socket.id} joined room ${roomId}`);
        });

        // Determine target room: usage of explicit room arg or fallback to stored room
        const getTarget = () => socket.data.room;

        socket.on('offer', (data) => {
            const room = getTarget();
            if (room) socket.to(room).emit('offer', data);
        });

        socket.on('answer', (data) => {
            const room = getTarget();
            if (room) socket.to(room).emit('answer', data);
        });

        socket.on('ice-candidate', (data) => {
            const room = getTarget();
            if (room) socket.to(room).emit('ice-candidate', data);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    server.listen(port, (err) => {
        if (err) throw err;
        const ip = getLocalIp();
        console.log(`> AmanDrop is running! Scan the QR code or go to: http://${ip}:${port}`);
    });
});

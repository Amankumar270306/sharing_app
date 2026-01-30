# AmanDrop

AmanDrop is a local Wi-Fi file sharing application offering high-speed, peer-to-peer file transfer between devices on the same network. It assumes the role of a web-based AirDrop alternative, functioning offline within a local network environment.

## Features

- **Local Network Sharing:** Transfers files directly between devices over Wi-Fi without using internet bandwidth.
- **Cross-Platform:** Works on any device with a modern web browser (iOS, Android, macOS, Windows, Linux).
- **Peer-to-Peer:** Uses WebRTC for direct, high-speed data transfer.
- **QR Code Connection:** Easy pairing by scanning a QR code from the sender device.
- **Real-time Signaling:** Powered by Socket.io for instant device discovery and handshake.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (React)
- **Server:** Node.js (Custom server with `http` and `socket.io`)
- **Real-time Communication:** [Socket.io](https://socket.io/)
- **P2P Transfer:** [Simple-Peer](https://github.com/feross/simple-peer) (WebRTC wrapper)
- **UI:** React with CSS Modules / Global Styles

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- `npm` or `yarn`

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd sharing_app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

To start the development server:

```bash
npm run dev
```

The server will start on port `3000`. 
On startup, the console will display the local IP address of the host machine:

```
> AmanDrop is running! Scan the QR code or go to: http://192.168.1.X:3000
```

Open this URL on any device connected to the same Wi-Fi network to start sharing.

## How it Works

1. **Signaling Server:** The custom `server.js` acts as a signaling server using Socket.io. It helps peers discover each other and exchange WebRTC connection data (offers/answers).
2. **Room Creation:** Devices join specific rooms (or a default room) to pair up.
3. **P2P Connection:** Once connected via signaling, a direct WebRTC DataChannel is established using `simple-peer`.
4. **File Transfer:** Files are chunked and sent directly from peer to peer.

## Project Structure

- `server.js`: Custom Node.js server entry point. Handles HTTP requests (Next.js) and WebSocket connections (Socket.io). Includes logic to detect and display the machine's local IP.
- `src/app`: Next.js application source code.
- `package.json`: Project dependencies and scripts.

## License

[MIT](LICENSE)

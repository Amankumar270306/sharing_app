'use client';

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';

let SimplePeer;
if (typeof window !== 'undefined') {
    SimplePeer = require('simple-peer');
}

export default function Home() {
    const [connectionState, setConnectionState] = useState('disconnected'); // 'disconnected', 'connecting', 'connected'
    const [role, setRole] = useState('unknown'); // 'host' | 'joiner'
    const [localUrl, setLocalUrl] = useState('');
    const [peerName, setPeerName] = useState('Unknown Peer');
    const [status, setStatus] = useState('Initializing...');
    const [transferProgress, setTransferProgress] = useState(0);
    const [isDopping, setIsDragging] = useState(false);

    const socketRef = useRef();
    const peerRef = useRef();
    const fileChunksRef = useRef([]);
    const fileInfoRef = useRef(null);

    useEffect(() => {
        // 1. Determine Role based on URL
        // If accessed via QR code (contains ?join=true), we are Joiner.
        // Otherwise, we are Host.
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const isJoiner = params.get('join') === 'true';
            setRole(isJoiner ? 'joiner' : 'host');
            setLocalUrl(window.location.href); // Host URL for QR
        }

        // 2. Initialize Socket
        socketRef.current = io();

        socketRef.current.on('connect', () => {
            console.log('Socket connected');
            // All peers join the same room for simplicity
            socketRef.current.emit('join', 'AmanDrop');

            // If we are already determined as Joiner, we can start the process
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                if (params.get('join') === 'true') {
                    startPeerConnection(true); // Initiator
                } else {
                    // We are host, waiting for offer
                    setStatus('Waiting for peer to scan QR code...');
                }
            }
        });

        socketRef.current.on('offer', (offer) => {
            // If we are Host (not initiator), we accept the offer
            if (!peerRef.current) {
                setStatus('Connection request received...');
                startPeerConnection(false); // Not initiator
                // We need to defer the signal slightly to ensure peer is created
                // But with `startPeerConnection` it creates it immediately.
                // The issue is `startPeerConnection` sets peerRef.current. 
                // We need to pass the offer to it.
                // Actually, inside startPeerConnection we can't easily pass it *after*.
                // Let's refactor: create peer, then signal.
            }
            setTimeout(() => {
                if (peerRef.current) peerRef.current.signal(offer);
            }, 100);
        });

        socketRef.current.on('answer', (answer) => {
            if (peerRef.current) peerRef.current.signal(answer);
        });

        socketRef.current.on('ice-candidate', (candidate) => {
            if (peerRef.current) peerRef.current.signal(candidate);
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            if (peerRef.current) peerRef.current.destroy();
        };
    }, []);

    const startPeerConnection = (initiator) => {
        if (peerRef.current) return; // Already exists

        const peer = new SimplePeer({ initiator, trickle: false });

        // Wire up events
        peer.on('signal', (data) => {
            if (data.type === 'offer') socketRef.current.emit('offer', data);
            if (data.type === 'answer') socketRef.current.emit('answer', data);
            if (data.candidate) socketRef.current.emit('ice-candidate', data);
        });

        peer.on('connect', () => {
            console.log('Peer connected');
            setConnectionState('connected');
            setStatus('Connected');

            const deviceName = /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile Device' : 'Desktop';
            peer.send(JSON.stringify({ type: 'handshake', device: deviceName }));
        });

        peer.on('data', handleIncomingData);

        peer.on('error', (err) => {
            setStatus('Error: ' + err.message);
            setConnectionState('disconnected');
        });

        peer.on('close', () => {
            setConnectionState('disconnected');
            setStatus('Peer Disconnected');
            // If host, maybe reset?
            if (role === 'host') {
                peerRef.current = null;
                setStatus('Waiting for peer...');
            }
        });

        peerRef.current = peer;
        if (initiator) setStatus('Connecting to Host...');
    };

    const handleIncomingData = (data) => {
        try {
            const decoder = new TextDecoder();
            const text = decoder.decode(data);

            if (text.startsWith('{') && text.includes('"type"')) {
                const msg = JSON.parse(text);
                if (msg.type === 'handshake') {
                    setPeerName(msg.device);
                    return;
                }
                if (msg.type === 'meta') {
                    fileInfoRef.current = msg;
                    fileChunksRef.current = [];
                    setStatus(`Receiving ${msg.name}...`);
                    setTransferProgress(0);
                    return;
                }
            }
        } catch (e) { }

        if (!fileInfoRef.current) return;

        fileChunksRef.current.push(data);
        const currentSize = fileChunksRef.current.reduce((acc, chunk) => acc + chunk.byteLength, 0);
        const totalSize = fileInfoRef.current.size;

        setTransferProgress(Math.min((currentSize / totalSize) * 100, 100));

        if (currentSize >= totalSize) {
            setStatus('Saving file...');
            saveFile();
        }
    };

    const saveFile = () => {
        if (!fileInfoRef.current) return;
        const blob = new Blob(fileChunksRef.current, { type: fileInfoRef.current.mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfoRef.current.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        fileInfoRef.current = null;
        fileChunksRef.current = [];
        setTimeout(() => {
            setStatus('Ready');
            setTransferProgress(0);
        }, 2000);
    };

    const sendFile = (file) => {
        if (!peerRef.current || !peerRef.current.connected) return;

        setStatus(`Sending ${file.name}...`);
        peerRef.current.send(JSON.stringify({
            type: 'meta',
            name: file.name,
            size: file.size,
            mime: file.type
        }));

        const chunkSize = 64 * 1024;
        let offset = 0;

        const readChunk = () => {
            if (offset < file.size) {
                const chunk = file.slice(offset, offset + chunkSize);
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (!peerRef.current.connected) return;
                    peerRef.current.send(e.target.result);
                    offset += chunkSize;
                    setTransferProgress(Math.min((offset / file.size) * 100, 100));
                    setTimeout(readChunk, 5); // Simple flow control
                };
                reader.readAsArrayBuffer(chunk);
            } else {
                setStatus('Sent!');
                setTimeout(() => setTransferProgress(0), 1000);
            }
        };
        readChunk();
    };

    // ----- UI Builders -----
    const qrValue = localUrl ? `${new URL(localUrl).origin}?join=true` : '';

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (connectionState === 'connected' && e.dataTransfer.files[0]) {
            sendFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div
            className={`min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 ${isDopping ? 'ring-4 ring-blue-500/50 bg-slate-800' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            <div className="w-full max-w-lg">
                {/* Header */}
                <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                    AmanDrop
                </h1>

                {/* Status Component */}
                {connectionState === 'connected' ? (
                    <div className="animate-fade-in-up bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl text-center">
                        <div className="text-6xl mb-4">🔗</div>
                        <h2 className="text-2xl font-semibold mb-2">Connected to {peerName}</h2>
                        <p className="text-slate-400 mb-8">{status}</p>

                        {/* Drop Zone */}
                        <label
                            className="block w-full h-40 border-2 border-dashed border-slate-600 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-slate-700/50 transition-all"
                        >
                            <span className="text-3xl mb-2">📄</span>
                            <span className="text-sm font-medium">Click or Drop File</span>
                            <input type="file" className="hidden" onChange={(e) => e.target.files[0] && sendFile(e.target.files[0])} />
                        </label>

                        {/* Progress */}
                        {transferProgress > 0 && (
                            <div className="mt-6 w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                                <div className="bg-blue-500 h-full transition-all duration-100" style={{ width: `${transferProgress}%` }} />
                            </div>
                        )}
                    </div>
                ) : (
                    /* Disconnected State */
                    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl text-center flex flex-col items-center">
                        {role === 'host' ? (
                            <>
                                <div className="bg-white p-4 rounded-xl mb-6">
                                    {qrValue && <QRCodeSVG value={qrValue} size={200} />}
                                </div>
                                <h2 className="text-xl font-semibold mb-2">Scan to Connect</h2>
                                <p className="text-slate-400 text-sm">Open this on your other device</p>
                                <p className="mt-4 font-mono text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">{qrValue}</p>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                                <h2 className="text-xl font-semibold">Connecting...</h2>
                                <p className="text-slate-400 text-sm mt-2">{status}</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

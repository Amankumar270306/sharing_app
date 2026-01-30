"use client";

import { useEffect, useState, useRef, useCallback, ChangeEvent } from "react";
import Peer, { DataConnection } from "peerjs";
import { QRCodeSVG } from "qrcode.react";

export default function Home() {
    const [myId, setMyId] = useState<string>("");
    const [remoteId, setRemoteId] = useState<string>("");
    const [status, setStatus] = useState("Initializing PeerJS...");
    const [isConnected, setIsConnected] = useState(false);
    const [progress, setProgress] = useState(0);

    // Refs
    const peerRef = useRef<Peer | null>(null);
    const connRef = useRef<DataConnection | null>(null);
    const incomingFileRef = useRef<{
        writer: WritableStreamDefaultWriter<any> | null;
        totalSize: number;
        receivedSize: number;
        name: string;
    } | null>(null);

    // Callbacks
    const handleDataReceived = useCallback(async (data: any) => {
        if (data.type === 'METADATA') {
            const { name, size } = data.metadata;
            setStatus(`Receiving ${name}...`);
            setProgress(0);

            try {
                // Initialize StreamSaver
                const streamSaver = (await import('streamsaver')).default;
                const fileStream = streamSaver.createWriteStream(name, {
                    size: size
                });
                const writer = fileStream.getWriter();

                incomingFileRef.current = {
                    writer,
                    totalSize: size,
                    receivedSize: 0,
                    name: name
                };
            } catch (err) {
                console.error("StreamSaver error:", err);
                setStatus("Error initializing download");
            }

        } else if (data.type === 'CHUNK') {
            if (!incomingFileRef.current || !incomingFileRef.current.writer) return;

            const { writer, totalSize, receivedSize, name } = incomingFileRef.current;
            await writer.write(new Uint8Array(data.chunk));

            const newReceived = receivedSize + data.chunk.byteLength;
            incomingFileRef.current.receivedSize = newReceived;

            const percent = Math.floor((newReceived / totalSize) * 100);
            setProgress(percent);
            setStatus(`Receiving ${name}... ${percent}%`);

        } else if (data.type === 'END') {
            if (incomingFileRef.current?.writer) {
                await incomingFileRef.current.writer.close();
                setStatus(`File ${incomingFileRef.current.name} Received!`);
                incomingFileRef.current = null;
                setTimeout(() => setProgress(0), 3000);
            }
        }
    }, []);

    const setupConnection = useCallback((conn: DataConnection) => {
        connRef.current = conn;

        conn.on('open', () => {
            setStatus("Connected via PeerJS (Reliable)!");
            setIsConnected(true);
        });

        conn.on('data', (data: any) => {
            handleDataReceived(data);
        });

        conn.on('close', () => {
            setStatus("Connection Closed");
            setIsConnected(false);
            connRef.current = null;
            incomingFileRef.current = null;
        });

        conn.on('error', (err) => {
            console.error("Connection Error:", err);
            setStatus("Connection Error");
        });
    }, [handleDataReceived]);

    const sendFile = useCallback(async (file: File) => {
        if (!connRef.current) return;

        setStatus(`Preparing to send ${file.name}...`);
        setProgress(0);

        const conn = connRef.current;
        const chunkSize = 16384;
        const MAX_BUFFER_AMOUNT = 65536;

        conn.send({
            type: 'METADATA',
            metadata: {
                name: file.name,
                size: file.size,
                type: file.type
            }
        });

        let offset = 0;

        const sendLoop = async () => {
            while (offset < file.size) {
                if (conn.dataChannel.bufferedAmount > MAX_BUFFER_AMOUNT) {
                    await new Promise(r => setTimeout(r, 10));
                    continue;
                }

                const chunk = file.slice(offset, offset + chunkSize);
                const arrayBuffer = await chunk.arrayBuffer();

                conn.send({
                    type: 'CHUNK',
                    chunk: arrayBuffer
                });

                offset += chunk.size;

                const percent = Math.floor((offset / file.size) * 100);
                setProgress(percent);
                setStatus(`Sending... ${percent}%`);

                if (offset % (chunkSize * 10) === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            conn.send({ type: 'END' });
            setStatus("Sent Successfully!");
            setTimeout(() => setProgress(0), 3000);
        };

        try {
            await sendLoop();
        } catch (err) {
            console.error("Send error:", err);
            setStatus("Error sending file");
        }
    }, []); // Dependencies are refs or stable setters

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let peer: Peer;

        // Dynamic import to avoid SSR issues with PeerJS
        import('peerjs').then((PeerModule) => {
            const PeerClass = PeerModule.default || PeerModule;
            peer = new PeerClass({
                host: window.location.hostname,
                port: 3000,
                path: '/peerjs/myapp',
                debug: 2
            });

            peer.on('open', (id) => {
                setMyId(id);
                setStatus("Ready. Waiting for connection...");
                console.log("My Peer ID:", id);
            });

            peer.on('connection', (conn) => {
                console.log("Incoming connection from:", conn.peer);
                setupConnection(conn);
            });

            peer.on('error', (err: any) => {
                console.error(err);
                setStatus("Error: " + err.type);
            });

            peerRef.current = peer;
        });

        return () => {
            if (peer) peer.destroy();
        };
    }, [setupConnection]);

    const connectToPeer = useCallback(() => {
        if (!peerRef.current || !remoteId) return;
        setStatus(`Connecting to ${remoteId}...`);

        const conn = peerRef.current.connect(remoteId, {
            reliable: true
        });

        if (conn) {
            setupConnection(conn);
        }
    }, [remoteId, setupConnection]);

    const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            sendFile(e.target.files[0]);
        }
    }, [sendFile]);

    return (
        <main>
            <div className="container">
                <h1>AmanDrop (PeerJS)</h1>
                <p className="status">{status}</p>

                {!isConnected && (
                    <div style={{ margin: "2rem auto" }}>
                        {myId ? (
                            <>
                                <div style={{ background: "white", padding: "1rem", display: "inline-block", borderRadius: "8px" }}>
                                    <QRCodeSVG value={myId} size={200} />
                                </div>
                                <p style={{ marginTop: "10px" }}>My ID: {myId}</p>
                            </>
                        ) : (
                            <p>Generating ID...</p>
                        )}

                        <div style={{ marginTop: "2rem" }}>
                            <input
                                type="text"
                                placeholder="Enter Peer ID to Connect"
                                value={remoteId}
                                onChange={e => setRemoteId(e.target.value)}
                                style={{ padding: "10px", color: "black" }}
                            />
                            <button onClick={connectToPeer} style={{ padding: "10px 20px", marginLeft: "10px", background: "#4ade80", color: "#000", border: "none" }}>
                                Connect
                            </button>
                        </div>
                    </div>
                )}

                {isConnected && (
                    <div className="share-zone">
                        <div style={{ fontSize: "4rem", margin: "2rem 0" }}>⚡</div>
                        <p>Relay Connected</p>
                        <label className="file-label">
                            <span>Select File to Send</span>
                            <input type="file" onChange={onFileChange} />
                        </label>
                    </div>
                )}

                {progress > 0 && (
                    <div className="progress-bar">
                        <div className="progress-track" style={{ background: '#eee', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                            <div className="progress-fill" style={{ width: `${progress}%`, height: '100%', background: '#4ade80', transition: 'width 0.2s ease' }}></div>
                        </div>
                        <p>{progress === 100 ? "Transfer Complete" : "Transferring..."}</p>
                    </div>
                )}
            </div>
        </main>
    );
}

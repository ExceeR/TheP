const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');
const http = require('http');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected clients
const clients = new Map();

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server attached to the HTTP server
const wss = new WebSocketServer({ 
    server,
    path: "/ws"  // Explicitly set the WebSocket path
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    let clientId = null;
    console.log('New client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received:', data);
            
            switch (data.type) {
                case 'register':
                    clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    clients.set(clientId, {
                        ws,
                        name: data.data.name,
                        ps4_ip: data.data.ps4_ip,
                        connected: true,
                        lastSeen: new Date()
                    });
                    console.log(`Client registered: ${clientId}`);
                    
                    // Send confirmation back to client
                    ws.send(JSON.stringify({
                        type: 'registered',
                        data: { clientId }
                    }));
                    break;

                case 'status':
                    console.log(`Status from ${clientId}:`, data.data);
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        if (clientId) {
            clients.delete(clientId);
            console.log(`Client disconnected: ${clientId}`);
        }
    });

    // Keepalive ping
    const pingInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on('close', () => clearInterval(pingInterval));
});

// API Routes
app.get('/api/clients', (req, res) => {
    const clientList = Array.from(clients.entries()).map(([id, client]) => ({
        id,
        name: client.name,
        ps4_ip: client.ps4_ip,
        lastSeen: client.lastSeen
    }));
    res.json(clientList);
});

app.post('/api/install', async (req, res) => {
    const { clientId, pkgUrl } = req.body;
    
    if (!clients.has(clientId)) {
        return res.status(404).json({ error: 'Client not found' });
    }

    const client = clients.get(clientId);
    
    try {
        client.ws.send(JSON.stringify({
            type: 'install',
            data: { url: pkgUrl }
        }));
        res.json({ message: 'Installation request sent' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send installation request' });
    }
});

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server running on path /ws`);
});
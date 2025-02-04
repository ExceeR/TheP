// server.js
const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store connected clients
const clients = new Map();

// Create HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// WebSocket connection handling
wss.on('connection', (ws) => {
    let clientId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'register':
                    // Generate client ID using timestamp and random number
                    clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    clients.set(clientId, {
                        ws,
                        name: data.data.name,
                        ps4_ip: data.data.ps4_ip,
                        connected: true,
                        lastSeen: new Date()
                    });
                    console.log(`Client registered: ${clientId}`);
                    break;

                case 'status':
                    // Handle status updates from clients
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

    // Send periodic pings to keep connection alive
    const pingInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on('close', () => clearInterval(pingInterval));
});

// REST API endpoints
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

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// server.js
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const uuid = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Store connected clients
const clients = new Map();

// REST API endpoints
app.post('/api/install-pkg', async (req, res) => {
    const { clientId, pkgUrl } = req.body;
    
    if (!clients.has(clientId)) {
        return res.status(404).json({ error: 'Client not found' });
    }

    const client = clients.get(clientId);
    client.ws.send(JSON.stringify({
        type: 'install',
        data: { pkgUrl }
    }));

    res.json({ message: 'Installation command sent' });
});

app.get('/api/clients', (req, res) => {
    const clientList = Array.from(clients.values()).map(client => ({
        id: client.id,
        name: client.name,
        lastSeen: client.lastSeen
    }));
    res.json(clientList);
});

// WebSocket handling
wss.on('connection', (ws) => {
    const clientId = uuid.v4();
    console.log(`New client connected: ${clientId}`);

    // Store client information
    clients.set(clientId, {
        id: clientId,
        ws,
        name: 'Unknown Client',
        lastSeen: new Date()
    });

    // Send client their ID
    ws.send(JSON.stringify({
        type: 'registration',
        data: { clientId }
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'register':
                    const client = clients.get(clientId);
                    client.name = data.data.name;
                    break;
                case 'status':
                    // Handle installation status updates
                    console.log(`Status update from ${clientId}:`, data.data);
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        clients.delete(clientId);
    });

    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
            const client = clients.get(clientId);
            if (client) {
                client.lastSeen = new Date();
            }
        }
    }, 30000);

    ws.on('close', () => clearInterval(pingInterval));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Package management system
const packages = new Map();

app.post('/api/packages', (req, res) => {
    const { name, url, size, version } = req.body;
    const pkgId = uuid.v4();
    
    packages.set(pkgId, {
        id: pkgId,
        name,
        url,
        size,
        version,
        addedAt: new Date()
    });

    res.json({ id: pkgId });
});

app.get('/api/packages', (req, res) => {
    const pkgList = Array.from(packages.values());
    res.json(pkgList);
});
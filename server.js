// server.js
const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');
const http = require('http');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',  // Allow all origins
    methods: ['GET', 'POST']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected clients
const clients = new Map();

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({
    server,
    path: "/ws",
    // Disable SSL/TLS requirements
    perMessageDeflate: false,
    clientTracking: true,
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    let clientId = null;
    console.log('New client connected');

    // Keep connection alive
    const interval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
            ws.ping();
        }
    }, 30000);

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
                    // Broadcast status to all connected clients if needed
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
        clearInterval(interval);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (clientId) {
            clients.delete(clientId);
        }
    });

    ws.on('pong', () => {
        if (clientId) {
            const client = clients.get(clientId);
            if (client) {
                client.lastSeen = new Date();
            }
        }
    });
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
        res.json({ message: 'Installation request sent', success: true });
    } catch (error) {
        console.error('Failed to send installation request:', error);
        res.status(500).json({ error: 'Failed to send installation request', success: false });
    }
});

// Periodic cleanup of disconnected clients
setInterval(() => {
    const now = new Date();
    for (const [clientId, client] of clients.entries()) {
        if (now - client.lastSeen > 60000) { // Remove after 1 minute of inactivity
            console.log(`Removing inactive client: ${clientId}`);
            clients.delete(clientId);
        }
    }
}, 30000);

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        clients: clients.size,
        uptime: process.uptime()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!', details: err.message });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
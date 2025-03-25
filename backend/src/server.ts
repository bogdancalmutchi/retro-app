import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: Number(PORT) });

server.on('connection', (ws: any) => {
  console.log('New client connected');

  ws.on('message', (message: any) => {
    console.log(`Received: ${message}`);

    // Broadcast to all clients
    server.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log(`WebSocket server running on port ${PORT}`);

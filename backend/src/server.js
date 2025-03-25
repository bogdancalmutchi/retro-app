const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 6666 });

let messages = []; // Array to store messages
let clients = []; // Array to keep track of clients

wss.on('connection', (ws) => {
  console.log('New client connected');

  // Send message history to the new client
  ws.send(JSON.stringify({ type: 'history', messages }));

  // Add client to the list
  clients.push(ws);

  ws.on('message', (message) => {
    console.log('Received:', message);

    // Save the message and broadcast it to all clients
    messages.push(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'message', data: message }));
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Remove client from the list
    clients = clients.filter((client) => client !== ws);
  });
});

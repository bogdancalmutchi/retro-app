import { useEffect, useState } from "react";

const WS_URL = "wss://retro-app-8uhn.onrender.com"; // Replace with your Render WebSocket URL

const RetroBoard = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [note, setNote] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log("Connected to WebSocket");
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const messageData = JSON.parse(event.data);

      if (messageData.type === "history") {
        // When a new client connects, receive message history
        setMessages(messageData.messages);
      } else if (messageData.type === "message") {
        // New message from another user
        setMessages((prev) => [...prev, messageData.data]);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from WebSocket");
      setIsConnected(false);
    };

    setWs(socket);

    return () => socket.close();
  }, []);

  const sendMessage = () => {
    if (ws && isConnected && note.trim()) {
      ws.send(note);
      setNote("");
    }
  };

  return (
    <div>
      <h1>Retro Board</h1>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Write a note..."
      />
      <button onClick={sendMessage} disabled={!isConnected}>
        Send
      </button>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
};

export default RetroBoard;

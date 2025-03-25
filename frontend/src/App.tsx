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

      if (messageData.type === "message") {
        try {
          const parsedData = JSON.parse(messageData.data); // Attempt to parse messageData.data
          if (parsedData.type === "ping") {
            return; // Ignore ping messages
          }
          setMessages((prev) => [...prev, messageData.data]); // Add actual messages
        } catch {
          setMessages((prev) => [...prev, messageData.data]); // If parsing fails, treat as regular text
        }
      } else if (messageData.type === "history") {
        const filteredMessages = messageData.messages.filter((message: any) => message !== '{"type":"ping"}');
        setMessages(filteredMessages);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from WebSocket");
      setIsConnected(false);
    };

    setWs(socket);

    // Set up ping to keep connection alive every 30 seconds
    const pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
        console.log('>>> sent ping');
      }
    }, 30000); // Ping every 30 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(pingInterval); // Clear the interval when the component is unmounted
      socket.close();
    };
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

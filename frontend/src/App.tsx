import { useEffect, useState } from "react";

const WS_URL = "wss://your-app.onrender.com"; // Replace with your Render WebSocket URL

const RetroBoard = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => console.log("Connected to WebSocket");
    socket.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };
    socket.onclose = () => console.log("Disconnected");

    setWs(socket);

    return () => socket.close();
  }, []);

  const sendMessage = () => {
    if (ws && note.trim()) {
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
      <button onClick={sendMessage}>Send</button>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
};

export default RetroBoard;

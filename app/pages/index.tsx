import React, { useState } from "react";
import DrawingBoard from "../components/DrawingBoard";

const HomePage: React.FC = () => {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  const handleJoinRoom = () => {
    if (roomId) {
      setJoined(true);
    }
  };

  return (
    <div>
      <h1>Drawing Board</h1>
      {!joined ? (
        <div>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter room ID"
          />
          <button onClick={handleJoinRoom}>Join Room</button>
        </div>
      ) : (
        <DrawingBoard width={800} height={600} roomId={roomId} />
      )}
    </div>
  );
};

export default HomePage;

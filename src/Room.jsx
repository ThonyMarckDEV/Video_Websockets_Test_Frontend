import React, { useState, useEffect, useRef } from "react";
import io from 'socket.io-client';
import VideoPlayer from "./VideoPlayer";

const Room = () => {
  const [roomCode, setRoomCode] = useState(null);
  const [roomLogs, setRoomLogs] = useState([]);
  const socketRef = useRef(null);
  const [inputRoomCode, setInputRoomCode] = useState('');

  useEffect(() => {
    // Create Socket.io connection
    const socket = io('http://localhost:3001', {
      transports: ['websocket'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      addLog("Socket.io connection established");
      console.log("Socket.io connection established");
    });

    socket.on('connect_error', (error) => {
      addLog(`Connection Error: ${error.message}`);
      console.error("Connection Error:", error);
    });

    socket.on('room_created', ({ roomCode }) => {
      setRoomCode(roomCode);
      addLog(`Room Created: ${roomCode}`);
      console.log(`New Room Created: ${roomCode}`);
    });

    socket.on('room_joined', ({ roomCode, videoState }) => {
      setRoomCode(roomCode);
      addLog(`Joined Room: ${roomCode}`);
      console.log(`Joined Room: ${roomCode}`);
    });

    socket.on('room_error', ({ message }) => {
      addLog(`Room Error: ${message}`);
      console.error("Room Error:", message);
    });

    // Cleanup on component unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []); // Empty array ensures this runs only once

  // Function to add logs
  const addLog = (message) => {
    setRoomLogs((prevLogs) => [...prevLogs, message]);
  };

  // Function to create room
  const createRoom = () => {
    try {
      if (socketRef.current) {
        socketRef.current.emit('create_room');
        addLog("Attempting to create room...");
        console.log("Attempting to create room...");
      } else {
        addLog("Socket is not connected. Cannot create room.");
        console.error("Socket is not connected. Cannot create room.");
      }
    } catch (error) {
      addLog(`Error creating room: ${error.message}`);
      console.error("Error creating room:", error);
    }
  };

  // Function to join room
  const joinRoom = () => {
    try {
      if (socketRef.current && inputRoomCode) {
        socketRef.current.emit('join_room', { roomCode: inputRoomCode });
        addLog(`Attempting to join room: ${inputRoomCode}`);
        console.log(`Attempting to join room: ${inputRoomCode}`);
      } else {
        addLog("Socket is not connected or room code is missing.");
        console.error("Socket is not connected or room code is missing.");
      }
    } catch (error) {
      addLog(`Error joining room: ${error.message}`);
      console.error("Error joining room:", error);
    }
  };

  return (
    <div className="room-container">
      {!roomCode ? (
        <div className="room-setup">
          <button onClick={createRoom}>Create Room</button>
          <div className="join-room-section">
            <input
              type="text"
              placeholder="Enter Room Code"
              value={inputRoomCode}
              onChange={(e) => setInputRoomCode(e.target.value)}
            />
            <button onClick={joinRoom}>Join</button>
          </div>
          
          <div className="room-logs">
            <h3>Room Logs:</h3>
            {roomLogs.map((log, index) => (
              <p key={index}>{log}</p>
            ))}
          </div>
        </div>
      ) : (
        <VideoPlayer 
          roomCode={roomCode} 
          socket={socketRef.current} 
        />
      )}
    </div>
  );
};

export default Room;
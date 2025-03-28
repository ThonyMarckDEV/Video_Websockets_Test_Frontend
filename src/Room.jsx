import React, { useState, useEffect, useRef } from "react";
import io from 'socket.io-client';
import VideoPlayer from "./VideoPlayer";

const Room = () => {
  const [roomCode, setRoomCode] = useState(null);
  const [roomLogs, setRoomLogs] = useState([]);
  const socketRef = useRef(null);
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [backgroundStyle, setBackgroundStyle] = useState({});

  // Dynamic rave-like background effect
  useEffect(() => {
    const updateBackground = () => {
      const hue = Math.floor(Math.random() * 360);
      setBackgroundStyle({
        background: `linear-gradient(45deg, 
          hsl(${hue}, 70%, 20%), 
          hsl(${(hue + 120) % 360}, 70%, 20%)
        )`,
        transition: 'background 3s ease'
      });
    };

    updateBackground();
    const intervalId = setInterval(updateBackground, 5000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const socket = io('http://localhost:3001', {
      transports: ['websocket'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      addLog("Conexión establecida");
    });

    socket.on('room_created', ({ roomCode }) => {
      setRoomCode(roomCode);
      addLog(`Sala Creada: ${roomCode}`);
    });

    socket.on('room_joined', ({ roomCode }) => {
      setRoomCode(roomCode);
      addLog(`Unido a Sala: ${roomCode}`);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const addLog = (message) => {
    setRoomLogs((prevLogs) => [...prevLogs, message]);
  };

  const createRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('create_room');
    }
  };

  const joinRoom = () => {
    if (socketRef.current && inputRoomCode) {
      socketRef.current.emit('join_room', { roomCode: inputRoomCode });
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col justify-center items-center p-4 transition-all duration-1000 ease-in-out"
      style={backgroundStyle}
    >
      {roomCode && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black/60 backdrop-blur-md px-6 py-3 rounded-xl shadow-lg">
          <span className="text-white text-lg font-bold">
            Room ID: <span className="text-purple-300">{roomCode}</span>
          </span>
        </div>
      )}

      {!roomCode ? (
        <div className="bg-black/40 backdrop-blur-md p-8 rounded-2xl shadow-2xl text-white w-96 space-y-6">
          <h1 className="text-3xl font-bold text-center text-white/90 mb-6">
            Sync Cinema
          </h1>
          
          <button 
            onClick={createRoom} 
            className="w-full py-3 bg-purple-600/80 hover:bg-purple-700/90 rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            Crear Sala
          </button>
          
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Código de Sala"
              value={inputRoomCode}
              onChange={(e) => setInputRoomCode(e.target.value)}
              className="flex-grow px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button 
              onClick={joinRoom}
              className="px-4 py-3 bg-green-600/80 hover:bg-green-700/90 rounded-xl text-white transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              Unir
            </button>
          </div>

          {roomLogs.length > 0 && (
            <div className="mt-4 space-y-2 max-h-40 overflow-y-auto text-sm">
              {roomLogs.map((log, index) => (
                <p 
                  key={index} 
                  className="bg-white/10 p-2 rounded-md text-white/80"
                >
                  {log}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-5xl mx-auto">
          <VideoPlayer
            roomCode={roomCode}
            socket={socketRef.current}
          />
        </div>
      )}
    </div>
  );
};

export default Room;
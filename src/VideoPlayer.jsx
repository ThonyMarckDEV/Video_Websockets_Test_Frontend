import React, { useEffect, useState, useRef } from "react";
import YouTube from "react-youtube";
import SearchVideo from "./SearchVideo";

const VideoPlayer = ({ roomCode, socket }) => {
  const [videoId, setVideoId] = useState(null);
  const [videoError, setVideoError] = useState(false);
  const playerRef = useRef(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const lastSyncTimeRef = useRef(0);
  const syncThrottleRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressIntervalRef = useRef(null);

 // Inicializar en 0 en lugar de 1
const [connectedUsers, setConnectedUsers] = useState(0); // <- Cambiar a 0

  // Función para actualizar el progreso del video
  const updateProgress = () => {
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      const progressPercentage = (currentTime / duration) * 100;
      setProgress(progressPercentage);
    }
  };

    // Modificar el efecto que maneja room_joined
  useEffect(() => {
    if (!socket) return;
    
    const handleRoomJoined = ({ videoState, usersCount }) => {
      if (videoState?.videoId) {
        setVideoId(videoState.videoId);
        // Actualizar el contador de usuarios
        setConnectedUsers(usersCount);
      }
    };

    socket.on("room_joined", handleRoomJoined);
    return () => socket.off("room_joined", handleRoomJoined);
  }, [socket]);

  // Efecto para rastrear el progreso
  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    if (isPlaying) {
      progressIntervalRef.current = setInterval(updateProgress, 1000);
    }
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, duration]);

  // Sincronización de video vía socket
  useEffect(() => {
    if (!socket) return;

    const handleVideoSync = ({ videoId, time, state, initiator }) => {
      if (syncThrottleRef.current) return;
      syncThrottleRef.current = true;
      setTimeout(() => {
        syncThrottleRef.current = false;
      }, 500);

      console.log("Received sync event:", { videoId, time, state, initiator });
      
      if (!isPlayerReady || !playerRef.current) {
        console.log("Player not ready, queuing video");
        setVideoId(videoId);
        return;
      }

      const currentPlayer = playerRef.current;
      const currentVideoId = currentPlayer.getVideoData().video_id;
      const currentTime = currentPlayer.getCurrentTime();
      const timeDifference = Math.abs(currentTime - time);
      
      if (currentVideoId !== videoId) {
        console.log("Loading new video:", videoId);
        currentPlayer.loadVideoById(videoId, time);
      } else if (timeDifference > 1) {
        console.log(`Syncing time: current ${currentTime}, sync ${time}`);
        currentPlayer.seekTo(time);
      }

      if (state === "play") {
        if (currentPlayer.getPlayerState() !== YouTube.PlayerState.PLAYING) {
          currentPlayer.playVideo();
        }
      } else if (state === "pause") {
        if (currentPlayer.getPlayerState() !== YouTube.PlayerState.PAUSED) {
          currentPlayer.pauseVideo();
        }
      }
      lastSyncTimeRef.current = Date.now();
    };

    socket.on("sync_video", handleVideoSync);
    return () => {
      socket.off("sync_video", handleVideoSync);
    };
  }, [socket, isPlayerReady]);

  // Manejo de cambios de estado del reproductor usando la API Iframe
  const handleStateChange = (event) => {
    if (!socket || isInitiator) return;
    const player = event.target;
    const playerCurrentTime = player.getCurrentTime();
    const videoData = player.getVideoData();

    let state;
    switch (event.data) {
      case YouTube.PlayerState.PLAYING:
        state = "play";
        setIsPlaying(true);
        break;
      case YouTube.PlayerState.PAUSED:
        state = "pause";
        setIsPlaying(false);
        break;
      case YouTube.PlayerState.ENDED:
        state = "pause";
        setIsPlaying(false);
        setProgress(100);
        break;
      default:
        return;
    }
    const currentTime = Date.now();
    if (currentTime - lastSyncTimeRef.current < 500) return;
    socket.emit("update_video", {
      roomCode,
      videoId: videoData.video_id,
      time: playerCurrentTime,
      state,
    });
  };

  // // Cuando el reproductor está listo, se guarda la referencia y se obtiene la duración
  const handlePlayerReady = (event) => {
    console.log("Player is ready");
    playerRef.current = event.target;
    setIsPlayerReady(true);
    const totalDuration = event.target.getDuration();
    setDuration(totalDuration);
  };

  // Selección de video mediante búsqueda
  const handleVideoSelect = (newVideoId) => {
    if (!socket) return;
    setIsInitiator(true);
    setVideoId(newVideoId);
    socket.emit("change_video", {
      roomCode,
      videoId: newVideoId,
    });
    setTimeout(() => setIsInitiator(false), 1000);
  };

  // Función para buscar en el progreso
  const handleProgressSeek = (e) => {
    if (!playerRef.current) return;
    const seekPercentage = parseFloat(e.target.value);
    const seekTime = (seekPercentage / 100) * duration;
    playerRef.current.seekTo(seekTime);
    setProgress(seekPercentage);
    if (!isInitiator && socket) {
      socket.emit("update_video", {
        roomCode,
        videoId: playerRef.current.getVideoData().video_id,
        time: seekTime,
        state: isPlaying ? "play" : "pause",
      });
    }
  };

  // Parámetros del reproductor usando la API Iframe de YouTube
  const playerOptions = {
    height: "100%",
    width: "100%",
    playerVars: {
      loop: 1,
      autoplay: 1,
      controls: 0,
      playsinline: 1, // Reproducción en línea en móviles
      mute: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      enablejsapi: 1, // Habilita la API de JavaScript de YouTube
    },
  };

  return (
    <div className="video-player-container w-full min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 p-4 md:p-6">

      <div className="p-4 md:p-6 bg-purple-600 text-white">
        <div className="max-w-full mx-auto flex justify-between items-center">
          <SearchVideo onVideoSelect={handleVideoSelect} />
          <div className="ml-4 flex items-center bg-purple-500 px-3 py-1 rounded-full">
            <span className="mr-2">👥</span>
            <span className="font-semibold">{connectedUsers}</span>
          </div>
        </div>

        
        {videoId && (
          <div className="video-controls-wrapper flex flex-col items-center space-y-4 md:space-y-6 p-4 md:p-6">
            <div className="video-wrapper w-full aspect-video shadow-2xl rounded-xl overflow-hidden">
              <YouTube
                videoId={videoId}
                opts={playerOptions}
                onReady={handlePlayerReady}
                onStateChange={handleStateChange}
                className="w-full h-full"
              />
            </div>

            <div className="custom-controls w-full flex items-center space-x-2 md:space-x-4 bg-purple-50 p-3 md:p-4 rounded-lg">

              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleProgressSeek}
                className="flex-grow h-2 md:h-3 bg-purple-200 rounded-full appearance-none cursor-pointer 
                  [&::-webkit-slider-thumb]:appearance-none 
                  [&::-webkit-slider-thumb]:w-4 md:w-6 
                  [&::-webkit-slider-thumb]:h-4 md:h-6 
                  [&::-webkit-slider-thumb]:bg-purple-600 
                  [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;

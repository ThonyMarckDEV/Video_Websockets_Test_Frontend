// import React, { useEffect, useState, useRef } from "react";
// import YouTube from "react-youtube";
// import SearchVideo from "./SearchVideo";

// const VideoPlayer = ({ roomCode, socket }) => {
//   const [videoId, setVideoId] = useState(null);
//   const playerRef = useRef(null);
//   const [isInitiator, setIsInitiator] = useState(false);
//   const [isPlayerReady, setIsPlayerReady] = useState(false);
//   const lastSyncTimeRef = useRef(0);
//   const syncThrottleRef = useRef(false);

//   useEffect(() => {
//     if (!socket) return;

//     // Improved video sync event handler
//     const handleVideoSync = ({ videoId, time, state, initiator }) => {
//       // Throttle sync events to prevent rapid, unnecessary updates
//       if (syncThrottleRef.current) return;
//       syncThrottleRef.current = true;
//       setTimeout(() => {
//         syncThrottleRef.current = false;
//       }, 500); // Adjust this value as needed

//       console.log('Received sync event:', { videoId, time, state, initiator });
      
//       if (!isPlayerReady || !playerRef.current) {
//         console.log('Player not ready, queuing video');
//         setVideoId(videoId);
//         return;
//       }

//       const currentPlayer = playerRef.current;
//       const currentVideoId = currentPlayer.getVideoData().video_id;
//       const currentTime = currentPlayer.getCurrentTime();

//       // Only update if the difference is significant
//       const timeDifference = Math.abs(currentTime - time);
      
//       if (currentVideoId !== videoId) {
//         console.log('Loading new video:', videoId);
//         currentPlayer.loadVideoById(videoId, time);
//       } else if (timeDifference > 1) { // Only seek if time differs by more than 1 second
//         console.log(`Syncing time: current ${currentTime}, sync ${time}`);
//         currentPlayer.seekTo(time);
//       }

//       // Manage play/pause state
//       if (state === "play") {
//         if (currentPlayer.getPlayerState() !== YouTube.PlayerState.PLAYING) {
//           currentPlayer.playVideo();
//         }
//       } else if (state === "pause") {
//         if (currentPlayer.getPlayerState() !== YouTube.PlayerState.PAUSED) {
//           currentPlayer.pauseVideo();
//         }
//       }

//       // Update last sync time
//       lastSyncTimeRef.current = Date.now();
//     };

//     socket.on('sync_video', handleVideoSync);

//     return () => {
//       socket.off('sync_video', handleVideoSync);
//     };
//   }, [socket, isPlayerReady]);

//   const handleStateChange = (event) => {
//     if (!socket || isInitiator) return;

//     const player = event.target;
//     const playerCurrentTime = player.getCurrentTime(); // Renamed to avoid collision
//     const videoData = player.getVideoData();

//     let state;
//     switch(event.data) {
//       case YouTube.PlayerState.PLAYING:
//         state = 'play';
//         break;
//       case YouTube.PlayerState.PAUSED:
//         state = 'pause';
//         break;
//       default:
//         return;
//     }

//     // Throttle rapid state changes
//     const currentTime = Date.now();
//     if (currentTime - lastSyncTimeRef.current < 500) return;

//     // Emit video state update
//     socket.emit('update_video', {
//       roomCode,
//       videoId: videoData.video_id,
//       time: playerCurrentTime, // Use the player's current time, not the current timestamp
//       state
//     });
//   };

//   const handleVideoSelect = (newVideoId) => {
//     if (!socket) return;

//     setIsInitiator(true);
//     setVideoId(newVideoId);

//     // Emit video change to room
//     socket.emit('change_video', {
//       roomCode,
//       videoId: newVideoId
//     });

//     // Reset initiator after a short delay
//     setTimeout(() => setIsInitiator(false), 1000);
//   };

//   const handlePlayerReady = (event) => {
//     console.log('Player is ready');
//     playerRef.current = event.target;
//     setIsPlayerReady(true);
//   };

//   const playerOptions = {
//     height: '390',
//     width: '640',
//     playerVars: { 
//       autoplay: 0,
//       // Add these to help with synchronization
//       controls: 1,
//       //enablejsapi: 1,
//       modestbranding: 1, // Reduce la marca de YouTube
//       rel: 0 // Evita mostrar videos relacionados al final
//     }
//   };


//   return (
//     <div className="video-player-container">
//       <div className="search-video-section">
//         <SearchVideo onVideoSelect={handleVideoSelect} />
//       </div>
      
//       {videoId && (
//         <YouTube
//           videoId={videoId}
//           opts={playerOptions}
//           onReady={handlePlayerReady}
//           onStateChange={handleStateChange}
//         />
//       )}
//     </div>
//   );
// };

// export default VideoPlayer;


import React, { useEffect, useState, useRef } from "react";
import YouTube from "react-youtube";
import SearchVideo from "./SearchVideo";

const VideoPlayer = ({ roomCode, socket }) => {
  const [videoId, setVideoId] = useState(null);
  const playerRef = useRef(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const lastSyncTimeRef = useRef(0);
  const syncThrottleRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressIntervalRef = useRef(null);

    // Función para actualizar el progreso
    const updateProgress = () => {
        if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        const progressPercentage = (currentTime / duration) * 100;
        setProgress(progressPercentage);
        }
    };

// Efecto para manejar el seguimiento del progreso
  useEffect(() => {
    // Limpiar cualquier intervalo existente
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    // Configurar nuevo intervalo si está reproduciendo
    if (isPlaying) {
      progressIntervalRef.current = setInterval(updateProgress, 1000);
    }

    // Limpiar intervalo al desmontar o cambiar estado
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, duration]);

  useEffect(() => {
    if (!socket) return;

    // Recuperamos el manejador de sincronización original
    const handleVideoSync = ({ videoId, time, state, initiator }) => {
      if (syncThrottleRef.current) return;
      syncThrottleRef.current = true;
      setTimeout(() => {
        syncThrottleRef.current = false;
      }, 500);

      console.log('Received sync event:', { videoId, time, state, initiator });
      
      if (!isPlayerReady || !playerRef.current) {
        console.log('Player not ready, queuing video');
        setVideoId(videoId);
        return;
      }

      const currentPlayer = playerRef.current;
      const currentVideoId = currentPlayer.getVideoData().video_id;
      const currentTime = currentPlayer.getCurrentTime();

      const timeDifference = Math.abs(currentTime - time);
      
      if (currentVideoId !== videoId) {
        console.log('Loading new video:', videoId);
        currentPlayer.loadVideoById(videoId, time);
      } else if (timeDifference > 1) {
        console.log(`Syncing time: current ${currentTime}, sync ${time}`);
        currentPlayer.seekTo(time);
      }

      // Gestionar estado de reproducción
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

    socket.on('sync_video', handleVideoSync);

    return () => {
      socket.off('sync_video', handleVideoSync);
    };
  }, [socket, isPlayerReady]);

  // Controles personalizados de reproducción
  const togglePlayPause = () => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };


  const handleStateChange = (event) => {
    if (!socket || isInitiator) return;

    const player = event.target;
    const playerCurrentTime = player.getCurrentTime();
    const videoData = player.getVideoData();

    let state;
    switch(event.data) {
      case YouTube.PlayerState.PLAYING:
        state = 'play';
        setIsPlaying(true);
        break;
      case YouTube.PlayerState.PAUSED:
        state = 'pause';
        setIsPlaying(false);
        break;
      case YouTube.PlayerState.ENDED:
        state = 'pause';
        setIsPlaying(false);
        setProgress(100);
        break;
      default:
        return;
    }

    const currentTime = Date.now();
    if (currentTime - lastSyncTimeRef.current < 500) return;

    socket.emit('update_video', {
      roomCode,
      videoId: videoData.video_id,
      time: playerCurrentTime,
      state
    });
  };

  const handlePlayerReady = (event) => {
    console.log('Player is ready');
    playerRef.current = event.target;
    setIsPlayerReady(true);
    
    // Obtener duración del video
    const totalDuration = event.target.getDuration();
    setDuration(totalDuration);
  };

  const handleVideoSelect = (newVideoId) => {
    if (!socket) return;

    setIsInitiator(true);
    setVideoId(newVideoId);

    socket.emit('change_video', {
      roomCode,
      videoId: newVideoId
    });

    setTimeout(() => setIsInitiator(false), 1000);
  };


    // Modificar método de búsqueda para actualizar progreso
    const handleProgressSeek = (e) => {
        if (!playerRef.current) return;

        const seekPercentage = parseFloat(e.target.value);
        const seekTime = (seekPercentage / 100) * duration;
        
        playerRef.current.seekTo(seekTime);
        setProgress(seekPercentage);
        
        // Emitir evento de sincronización al buscar
        if (!isInitiator && socket) {
            socket.emit('update_video', {
            roomCode,
            videoId: playerRef.current.getVideoData().video_id,
            time: seekTime,
            state: isPlaying ? 'play' : 'pause'
            });
        }
    };
        
  const playerOptions = {
    height: '390',
    width: '640',
    playerVars: { 
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0, // Oculta la información del video
      iv_load_policy: 3 // Desactiva las anotaciones
    }
  };

  return (
    <div className="video-player-container">
      <div className="search-video-section">
        <SearchVideo onVideoSelect={handleVideoSelect} />
      </div>
      
      {videoId && (
        <div className="video-controls-wrapper">
          <YouTube
            videoId={videoId}
            opts={playerOptions}
            onReady={handlePlayerReady}
            onStateChange={handleStateChange}
          />

          <div className="custom-controls">
            <button 
              onClick={togglePlayPause} 
              className="play-pause-btn"
            >
              {isPlaying ? 'Pausar' : 'Reproducir'}
            </button>

            <input 
              type="range" 
              min="0" 
              max="100" 
              value={progress} 
              onChange={handleProgressSeek}
              className="progress-bar"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
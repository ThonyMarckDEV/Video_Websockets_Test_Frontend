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

  // Función para actualizar el progreso del video
  const updateProgress = () => {
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      const progressPercentage = (currentTime / duration) * 100;
      setProgress(progressPercentage);
    }
  };

  useEffect(() => {
    if (!socket) return;
    const handleRoomJoined = ({ roomCode, videoState }) => {
      if (videoState && videoState.videoId) {
        // Cargar el video y sincronizar la reproducción
        setVideoId(videoState.videoId);
        // Puedes esperar a que el reproductor esté listo para buscar el tiempo correcto
        setTimeout(() => {
          if (playerRef.current) {
            playerRef.current.seekTo(videoState.time);
            if (videoState.state === "play") {
              playerRef.current.playVideo();
            } else {
              playerRef.current.pauseVideo();
            }
          }
        }, 1000);
      }
    };
  
    socket.on("room_joined", handleRoomJoined);
    return () => {
      socket.off("room_joined", handleRoomJoined);
    };
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

  // Controles de reproducción personalizados
  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

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

  // Cuando el reproductor está listo, se guarda la referencia y se obtiene la duración
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
      <div className="bg-white shadow-2xl rounded-2xl overflow-hidden max-w-full">
        <div className="p-4 md:p-6 bg-purple-600 text-white">
          <div className="max-w-full mx-auto">
            <SearchVideo onVideoSelect={handleVideoSelect} />
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
              <button
                onClick={togglePlayPause}
                className="px-4 py-2 md:px-6 md:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors transform hover:scale-105 text-sm md:text-base"
              >
                {isPlaying ? "Pausar" : "Reproducir"}
              </button>

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


// import React, { useEffect, useState, useRef } from "react";
// import SearchVideo from "./SearchVideo";

// const VideoPlayer = ({ roomCode, socket }) => {
//   const [videoId, setVideoId] = useState(null);
//   const [isInitiator, setIsInitiator] = useState(false);
//   const [isPlayerReady, setIsPlayerReady] = useState(false);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [progress, setProgress] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const lastSyncTimeRef = useRef(0);
//   const syncThrottleRef = useRef(false);
//   const progressIntervalRef = useRef(null);
//   const playerRef = useRef(null);
//   const isSeeking = useRef(false);

//   // Cuando carga la metadata del video (duración, etc.)
//   const handleLoadedMetadata = () => {
//     if (playerRef.current) {
//       setDuration(playerRef.current.duration);
//       setIsPlayerReady(true);
//     }
//   };

//   // Actualiza el progreso del video
//   const updateProgress = () => {
//     if (playerRef.current && duration > 0) {
//       const currentTime = playerRef.current.currentTime;
//       const progressPercentage = (currentTime / duration) * 100;
//       setProgress(progressPercentage);
//     }
//   };

//   // Configurar el intervalo para actualizar la barra de progreso
//   useEffect(() => {
//     if (isPlayerReady && playerRef.current) {
//       progressIntervalRef.current = setInterval(updateProgress, 100);
//     }
    
//     return () => {
//       if (progressIntervalRef.current) {
//         clearInterval(progressIntervalRef.current);
//       }
//     };
//   }, [isPlayerReady, duration]);

//   useEffect(() => {
//     if (!socket) return;
  
//     const handleVideoSync = ({ videoId: syncVideoId, time, state, initiator }) => {
//       if (syncThrottleRef.current || isSeeking.current) return;
      
//       syncThrottleRef.current = true;
//       setTimeout(() => {
//         syncThrottleRef.current = false;
//       }, 500);
  
//       console.log("Evento de sincronización recibido:", { syncVideoId, time, state, initiator });
      
//       // Si el reproductor aún no está listo y no hay video cargado, establece el videoId
//       if (!isPlayerReady || !playerRef.current) {
//         if (!videoId) {
//           setVideoId(syncVideoId);
//         }
//         return;
//       }
  
//       // Si se seleccionó otro video y ya se tenía uno, evita recargarlo automáticamente
//       if (syncVideoId !== videoId) {
//         console.warn("Se recibió un cambio de video, pero ya hay un video cargado.");
//         // Aquí podrías emitir algún aviso o manejar el cambio de video de forma controlada
//         return;
//       }
  
//       // Sincroniza el tiempo si hay diferencia mayor a 1 segundo
//       const currentTime = playerRef.current.currentTime;
//       if (Math.abs(currentTime - time) > 1) {
//         console.log(`Sincronizando tiempo de ${currentTime} a ${time}`);
//         playerRef.current.currentTime = time;
        
//         if (duration > 0) {
//           const progressPercentage = (time / duration) * 100;
//           setProgress(progressPercentage);
//         }
//       }
  
//       // Reproduce o pausa según corresponda
//       if (state === "play" && playerRef.current.paused) {
//         playerRef.current.play()
//           .then(() => setIsPlaying(true))
//           .catch(err => console.error("Error al reproducir:", err));
//       } else if (state === "pause" && !playerRef.current.paused) {
//         playerRef.current.pause();
//         setIsPlaying(false);
//       }
      
//       lastSyncTimeRef.current = Date.now();
//     };
  
//     socket.on("sync_video", handleVideoSync);
//     return () => {
//       socket.off("sync_video", handleVideoSync);
//     };
//   }, [socket, isPlayerReady, videoId, duration]);

//   const handlePlay = () => {
//     setIsPlaying(true);
//     if (!socket || isInitiator) return;
//     socket.emit("update_video", {
//       roomCode,
//       videoId,
//       time: playerRef.current.currentTime,
//       state: "play",
//     });
//   };

//   const handlePause = () => {
//     setIsPlaying(false);
//     if (!socket || isInitiator) return;
//     socket.emit("update_video", {
//       roomCode,
//       videoId,
//       time: playerRef.current.currentTime,
//       state: "pause",
//     });
//   };

//   const handleVideoSelect = (newVideoId) => {
//     if (!socket) return;
//     setIsInitiator(true);
//     setVideoId(newVideoId);
//     socket.emit("change_video", {
//       roomCode,
//       videoId: newVideoId,
//     });
//     setTimeout(() => setIsInitiator(false), 1000);
//   };

//   const handleSeekStart = () => {
//     isSeeking.current = true;
//   };

//   const handleSeekEnd = (e) => {
//     isSeeking.current = false;
//     if (!playerRef.current) return;
    
//     const seekPercentage = parseFloat(e.target.value);
//     const seekTime = (seekPercentage / 100) * duration;
    
//     // Establecer el tiempo del video
//     playerRef.current.currentTime = seekTime;
    
//     // Actualizamos la barra de progreso
//     setProgress(seekPercentage);
    
//     // Enviar la actualización a los demás usuarios
//     setIsInitiator(true);
//     if (socket) {
//       socket.emit("update_video", {
//         roomCode,
//         videoId,
//         time: seekTime,
//         state: isPlaying ? "play" : "pause",
//       });
//     }
//     setTimeout(() => setIsInitiator(false), 500);
//   };

//   const handleProgressChange = (e) => {
//     // Solo actualiza la UI durante el arrastre, sin cambiar el tiempo del video
//     if (isSeeking.current) {
//       setProgress(parseFloat(e.target.value));
//     }
//   };

//   const togglePlayPause = () => {
//     if (!playerRef.current) return;
//     if (isPlaying) {
//       playerRef.current.pause();
//     } else {
//       playerRef.current.play();
//     }
//   };

//   return (
//     <div className="video-player-container w-full min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 p-4 md:p-6">
//       <div className="bg-white shadow-2xl rounded-2xl overflow-hidden max-w-full">
//         <div className="p-4 md:p-6 bg-purple-600 text-white">
//           <div className="max-w-full mx-auto">
//             <SearchVideo onVideoSelect={handleVideoSelect} />
//           </div>
//         </div>
        
//         {videoId && (
//           <div className="video-controls-wrapper flex flex-col items-center space-y-4 md:space-y-6 p-4 md:p-6">
//             <div className="video-wrapper w-full aspect-video shadow-2xl rounded-xl overflow-hidden">
//               <video
//                 ref={playerRef}
//                 src={`http://192.168.18.9:3001/proxy?videoId=${videoId}`}
//                 onLoadedMetadata={handleLoadedMetadata}
//                 onPlay={handlePlay}
//                 onPause={handlePause}
//                 onTimeUpdate={updateProgress}
//                 controls={false}
//                 playsInline
//                 autoPlay
//                 style={{ width: "100%", height: "100%" }}
//               />
//             </div>

//             <div className="custom-controls w-full flex items-center space-x-2 md:space-x-4 bg-purple-50 p-3 md:p-4 rounded-lg">
//               <button
//                 onClick={togglePlayPause}
//                 className="px-4 py-2 md:px-6 md:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors transform hover:scale-105 text-sm md:text-base"
//               >
//                 {isPlaying ? "Pausar" : "Reproducir"}
//               </button>

//               <input
//                 type="range"
//                 min="0"
//                 max="100"
//                 value={progress}
//                 onMouseDown={handleSeekStart}
//                 onTouchStart={handleSeekStart}
//                 onMouseUp={handleSeekEnd}
//                 onTouchEnd={handleSeekEnd}
//                 onChange={handleProgressChange}
//                 className="flex-grow h-2 md:h-3 bg-purple-200 rounded-full appearance-none cursor-pointer 
//                   [&::-webkit-slider-thumb]:appearance-none 
//                   [&::-webkit-slider-thumb]:w-4 md:w-6 
//                   [&::-webkit-slider-thumb]:h-4 md:h-6 
//                   [&::-webkit-slider-thumb]:bg-purple-600 
//                   [&::-webkit-slider-thumb]:rounded-full"
//               />
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default VideoPlayer;


// import React, { useEffect, useState, useRef } from "react";
// import YouTube from "react-youtube";
// import SearchVideo from "./SearchVideo";

// const VideoPlayer = ({ roomCode, socket }) => {
//   const [videoId, setVideoId] = useState(null);
//   const [isPlayerReady, setIsPlayerReady] = useState(false);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [progress, setProgress] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const playerRef = useRef(null);
//   const lastSyncTimeRef = useRef(0);
//   const syncThrottleRef = useRef(false);
//   const progressIntervalRef = useRef(null);

//   useEffect(() => {
//     if (!socket) return;

//     const handleVideoSync = ({ videoId, time, state }) => {
//       if (syncThrottleRef.current) return;
//       syncThrottleRef.current = true;
//       setTimeout(() => (syncThrottleRef.current = false), 500);

//       if (!isPlayerReady || !playerRef.current) {
//         setVideoId(videoId);
//         return;
//       }

//       const player = playerRef.current;
//       const currentVideoId = player.getVideoData().video_id;
//       const currentTime = player.getCurrentTime();
      
//       if (currentVideoId !== videoId) {
//         player.loadVideoById(videoId, time);
//       } else if (Math.abs(currentTime - time) > 1) {
//         player.seekTo(time);
//       }

//       if (state === "play") {
//         player.playVideo();
//       } else if (state === "pause") {
//         player.pauseVideo();
//       }
//     };

//     socket.on("sync_video", handleVideoSync);
//     return () => socket.off("sync_video", handleVideoSync);
//   }, [socket, isPlayerReady]);

//   useEffect(() => {
//     if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
//     if (isPlaying) progressIntervalRef.current = setInterval(() => {
//       if (playerRef.current) {
//         setProgress((playerRef.current.getCurrentTime() / duration) * 100);
//       }
//     }, 1000);
//     return () => clearInterval(progressIntervalRef.current);
//   }, [isPlaying, duration]);

//   const togglePlayPause = () => {
//     if (playerRef.current) {
//       isPlaying ? playerRef.current.pauseVideo() : playerRef.current.playVideo();
//     }
//   };

//   const handleStateChange = (event) => {
//     if (!socket) return;
//     const player = event.target;
//     const playerCurrentTime = player.getCurrentTime();
//     const state = event.data === YouTube.PlayerState.PLAYING ? "play" : "pause";
//     setIsPlaying(state === "play");
//     socket.emit("update_video", { roomCode, videoId: player.getVideoData().video_id, time: playerCurrentTime, state });
//   };

//   const handlePlayerReady = (event) => {
//     playerRef.current = event.target;
//     setIsPlayerReady(true);
//     setDuration(event.target.getDuration());
//   };

//   const handleVideoSelect = (newVideoId) => {
//     if (!socket) return;
//     setVideoId(newVideoId);
//     socket.emit("change_video", { roomCode, videoId: newVideoId });
//   };

//   const handleProgressSeek = (e) => {
//     if (!playerRef.current) return;
//     const seekTime = (parseFloat(e.target.value) / 100) * duration;
//     playerRef.current.seekTo(seekTime);
//     setProgress(parseFloat(e.target.value));
//     socket.emit("update_video", { roomCode, videoId: playerRef.current.getVideoData().video_id, time: seekTime, state: isPlaying ? "play" : "pause" });
//   };

//   const playerOptions = {
//     height: "100%",
//     width: "100%",
//     playerVars: {
//       loop: 1,
//       autoplay: 1,
//       controls: 0,
//       playsinline: 1,
//       mute: 0,
//       modestbranding: 1,
//       rel: 0,
//       showinfo: 0,
//       iv_load_policy: 3,
//       enablejsapi: 1,
//       origin: window.location.origin,
//     },
//   };

//   return (
//     <div className="video-player-container w-full min-h-screen bg-gradient-to-br from-purple-50 to-purple-100 p-4 md:p-6">
//       <div className="bg-white shadow-2xl rounded-2xl overflow-hidden max-w-full">
//         <div className="p-4 md:p-6 bg-purple-600 text-white">
//           <SearchVideo onVideoSelect={handleVideoSelect} />
//         </div>
//         {videoId && (
//           <div className="video-controls-wrapper flex flex-col items-center space-y-4 md:space-y-6 p-4 md:p-6">
//             <div className="video-wrapper w-full aspect-video shadow-2xl rounded-xl overflow-hidden">
//               <YouTube
//                 videoId={videoId}
//                 opts={playerOptions}
//                 onReady={handlePlayerReady}
//                 onStateChange={handleStateChange}
//                 className="w-full h-full"
//               />
//             </div>
//             <div className="custom-controls w-full flex items-center space-x-2 md:space-x-4 bg-purple-50 p-3 md:p-4 rounded-lg">
//               <button onClick={togglePlayPause} className="px-4 py-2 md:px-6 md:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors transform hover:scale-105 text-sm md:text-base">
//                 {isPlaying ? "Pausar" : "Reproducir"}
//               </button>
//               <input type="range" min="0" max="100" value={progress} onChange={handleProgressSeek} className="flex-grow h-2 md:h-3 bg-purple-200 rounded-full appearance-none cursor-pointer" />
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default VideoPlayer;
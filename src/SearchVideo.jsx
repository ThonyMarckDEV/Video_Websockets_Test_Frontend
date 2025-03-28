// import React, { useState } from "react";

// const SearchVideo = ({ onVideoSelect }) => {
//   const [query, setQuery] = useState("");
//   const [videos, setVideos] = useState([]);
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(false);

//   const searchVideos = async () => {
//     if (!query.trim()) {
//       setError("Please enter a search term");
//       return;
//     }

//     setLoading(true);
//     setError(null);

//     try {
//       const response = await fetch(
//         `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=AIzaSyCh7WRq3ab1KNEWBkGFg_fi3zB8iyB8eF4&maxResults=5`
//       );

//       if (!response.ok) {
//         throw new Error('Error searching videos');
//       }

//       const data = await response.json();

//       if (!data.items || data.items.length === 0) {
//         setError("No videos found");
//         setVideos([]);
//         return;
//       }

//       setVideos(data.items);
//     } catch (err) {
//       console.error("Error searching videos:", err);
//       setError(err.message || "An error occurred while searching videos");
//       setVideos([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="search-container">
//       <input
//         type="text"
//         value={query}
//         onChange={(e) => setQuery(e.target.value)}
//         onKeyPress={(e) => e.key === 'Enter' && searchVideos()}
//         placeholder="Search for videos"
//         className="search-input"
//       />
//       <button onClick={searchVideos} disabled={loading}>
//         {loading ? 'Searching...' : 'Search'}
//       </button>

//       {error && (
//         <div className="error-message">
//           {error}
//         </div>
//       )}

//       {videos.length > 0 && (
//         <div className="video-results">
//           {videos.map((video) => (
//             <div key={video.id.videoId} className="video-item">
//               <button
//                 onClick={() => onVideoSelect(video.id.videoId)}
//                 className="select-video-button"
//               >
//                 {video.snippet.title}
//               </button>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };

// export default SearchVideo;


import React, { useState } from "react";

const SearchVideo = ({ onVideoSelect }) => {
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const searchVideos = async () => {
    if (!query.trim()) {
      setError("Please enter a search term");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use environment variable for API key in production
      const apiKey = 'AIzaSyCh7WRq3ab1KNEWBkGFg_fi3zB8iyB8eF4';
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=5`
      );

      if (!response.ok) {
        throw new Error('Error searching videos');
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        setError("No videos found");
        setVideos([]);
        return;
      }

      setVideos(data.items);
    } catch (err) {
      console.error("Error searching videos:", err);
      setError(err.message || "An error occurred while searching videos");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-lg shadow-md">
      <div className="flex mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchVideos()}
          placeholder="Search for videos"
          className="flex-grow px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
        />
        <button 
          onClick={searchVideos} 
          disabled={loading}
          className="bg-blue-500 text-black px-4 py-2 rounded-r-md hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="text-red-500 mb-4 text-center">
          {error}
        </div>
      )}

      {videos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold mb-2">Search Results:</h3>
          {videos.map((video) => (
            <div 
              key={video.id.videoId} 
              className="bg-gray-100 p-3 rounded-md flex items-center hover:bg-gray-200 transition-colors cursor-pointer text-black"
              onClick={() => {
                console.log('Selected Video ID:', video.id.videoId);
                onVideoSelect(video.id.videoId);
              }}
            >
              <img 
                src={video.snippet.thumbnails.default.url} 
                alt={video.snippet.title}
                className="w-16 h-12 mr-4 rounded"
              />
              <div>
                <p className="font-medium text-sm">
                  {video.snippet.title.length > 50 
                    ? video.snippet.title.substring(0, 50) + '...' 
                    : video.snippet.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchVideo;
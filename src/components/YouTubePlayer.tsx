'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

declare namespace YT {
  class Player {
    constructor(elementId: string, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
    loadVideoById(options: { videoId: string; startSeconds?: number }): void;
    destroy(): void;
    getPlayerState(): number;
    getIframe(): HTMLIFrameElement;
  }
  interface PlayerOptions {
    height?: string;
    width?: string;
    videoId?: string;
    playerVars?: Record<string, number | string>;
    events?: {
      onReady?: (event: { target: Player }) => void;
      onStateChange?: (event: { data: number }) => void;
      onError?: (event: { data: number }) => void;
    };
  }
}

export function YouTubePlayer() {
  const {
    currentTrack,
    next,
    setIsPlaying,
    setProgress,
    setDuration,
    registerPlayerControls,
  } = usePlayer();

  const playerRef = useRef<YT.Player | null>(null);
  const playerReadyRef = useRef<boolean>(false);
  const pendingVideoRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [apiLoaded, setApiLoaded] = useState(false);
  const containerId = 'moodradio-yt-player';

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      setApiLoaded(true);
    };

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Init player
  useEffect(() => {
    if (!apiLoaded || playerRef.current) return;
    if (!document.getElementById(containerId)) return;

    playerRef.current = new window.YT.Player(containerId, {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 1,
        controls: 1,       // Enable controls so user can tap play
        playsinline: 1,
        modestbranding: 1,
        rel: 0,
        fs: 0,
        iv_load_policy: 3,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          playerReadyRef.current = true;

          registerPlayerControls({
            playVideo: () => playerRef.current?.playVideo(),
            pauseVideo: () => playerRef.current?.pauseVideo(),
            seekTo: (s) => playerRef.current?.seekTo(s, true),
            getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
            getDuration: () => playerRef.current?.getDuration() ?? 0,
          });

          if (pendingVideoRef.current && typeof playerRef.current?.loadVideoById === 'function') {
            playerRef.current.loadVideoById({ videoId: pendingVideoRef.current });
            pendingVideoRef.current = null;
          }
        },
        onStateChange: (event) => {
          switch (event.data) {
            case 0: // ENDED
              next();
              break;
            case 1: // PLAYING
              setIsPlaying(true);
              setDuration(playerRef.current?.getDuration() ?? 0);
              startProgressTracking();
              break;
            case 2: // PAUSED
              setIsPlaying(false);
              stopProgressTracking();
              break;
          }
        },
        onError: () => {
          next();
        },
      },
    });
  }, [apiLoaded, next, setIsPlaying, setDuration, setProgress, registerPlayerControls]);

  // Load video on track change
  useEffect(() => {
    if (!currentTrack) return;
    if (playerRef.current && playerReadyRef.current && typeof playerRef.current.loadVideoById === 'function') {
      playerRef.current.loadVideoById({ videoId: currentTrack.videoId });
    } else {
      pendingVideoRef.current = currentTrack.videoId;
      // Retry after a short delay in case player is almost ready
      const retryTimeout = setTimeout(() => {
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function' && pendingVideoRef.current) {
          playerRef.current.loadVideoById({ videoId: pendingVideoRef.current });
          pendingVideoRef.current = null;
        }
      }, 1500);
      return () => clearTimeout(retryTimeout);
    }
  }, [currentTrack]);

  const startProgressTracking = useCallback(() => {
    stopProgressTracking();
    intervalRef.current = setInterval(() => {
      if (playerRef.current && playerReadyRef.current) {
        setProgress(playerRef.current.getCurrentTime());
      }
    }, 3000); // Update every 3s to reduce re-renders
  }, [setProgress]);

  const stopProgressTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Render: HIDDEN YouTube player (audio only)
  // The iframe must exist in DOM for playback but is not shown to user
  return (
    <div
      className="fixed -bottom-[300px] left-0 z-[-1] overflow-hidden"
      style={{ width: '200px', height: '200px', opacity: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <div id={containerId} className="w-full h-full" />
    </div>
  );
}

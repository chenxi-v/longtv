'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Settings, ChevronDown, Maximize2, Volume2, Film, Clock, Calendar, User, Star, FileText, List, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ParticleBackground from '@/components/ParticleBackground';
import PageTransition from '@/components/PageTransition';
import Artplayer from 'artplayer';
import artplayerPluginLiquidGlass from '@/lib/artplayer-plugin-liquid-glass';
import Hls, {
  type LoaderContext,
  type LoaderCallbacks,
  type LoaderResponse,
  type LoaderStats,
  type HlsConfig,
  type LoaderConfiguration,
  ErrorTypes,
  ErrorDetails,
} from 'hls.js';
import { getVideoDetail, parsePlayUrl, Episode } from '@/lib/api';

interface VideoSource {
  id: string;
  name: string;
  key: string;
  apiUrl: string;
  enabled?: boolean;
  proxyEnabled?: boolean;
  type?: 'normal' | 'tvbox';
}

const getBackendUrl = (): string => {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL.replace(/localhost/g, '127.0.0.1');
  }
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000';
  const stored = localStorage.getItem('backend_url');
  if (stored) {
    return stored.replace(/localhost/g, '127.0.0.1');
  }
  return 'http://127.0.0.1:8000';
};

const loadSourcesFromBackend = async (): Promise<VideoSource[]> => {
  const backendUrl = getBackendUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${backendUrl}/api/spiders`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((spider: any) => ({
          id: spider.key,
          name: spider.name || spider.key,
          key: spider.key,
          apiUrl: `${backendUrl}/api/spider/${spider.key}`,
          enabled: spider.enabled !== false,
          type: 'tvbox'
        }));
      }
    }
    return [];
  } catch (error) {
    console.error('从后端加载爬虫失败:', error);
    return [];
  }
};

interface VideoItem {
  vod_id: number;
  vod_name: string;
  vod_en: string;
  vod_time: string;
  vod_remarks: string;
  vod_play_from: string;
  vod_pic?: string;
  vod_play_url?: string;
  vod_pic_thumb?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_writer?: string;
  vod_blurb?: string;
  vod_pubdate?: string;
  vod_area?: string;
  vod_lang?: string;
  vod_year?: string;
  vod_duration?: string;
  vod_score?: string;
  vod_content?: string;
  type_id: number;
  type_name: string;
}

function filterAdsFromM3U8(m3u8Content: string) {
  if (!m3u8Content) return '';

  const discontinuityRegex = /#EXT-X-DISCONTINUITY/g;
  return m3u8Content.replace(discontinuityRegex, '');
}

const getHlsBufferConfig = () => {
  const mode = typeof window !== 'undefined' ? localStorage.getItem('playerBufferMode') || 'standard' : 'standard';

  switch (mode) {
    case 'enhanced':
      return {
        maxBufferLength: 45,
        backBufferLength: 45,
        maxBufferSize: 90 * 1000 * 1000,
      };
    case 'max':
      return {
        maxBufferLength: 90,
        backBufferLength: 60,
        maxBufferSize: 180 * 1000 * 1000,
      };
    case 'standard':
    default:
      return {
        maxBufferLength: 30,
        backBufferLength: 30,
        maxBufferSize: 60 * 1000 * 1000,
      };
  }
};

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);
const isMobile = isIOS || isAndroid || (typeof window !== 'undefined' && window.innerWidth < 768);
const isIOS13 = isIOS && typeof window !== 'undefined' && (window as any).webkit?.presentationMode !== undefined;

interface ExtendedLoaderContext extends LoaderContext {
  type: string;
}

interface ArtplayerWithHls extends Artplayer {
  hls?: Hls;
}

class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
  constructor(config: HlsConfig) {
    super(config);
    const load = this.load.bind(this);
    this.load = function (
      context: LoaderContext,
      config: LoaderConfiguration,
      callbacks: LoaderCallbacks<LoaderContext>,
    ) {
      const ctx = context as ExtendedLoaderContext;
      if (ctx.type === 'manifest' || ctx.type === 'level') {
        const onSuccess = callbacks.onSuccess;
        callbacks.onSuccess = function (
          response: LoaderResponse,
          stats: LoaderStats,
          context: LoaderContext,
          networkDetails: unknown,
        ) {
          if (response.data && typeof response.data === 'string') {
            response.data = filterAdsFromM3U8(response.data);
          }
          return onSuccess(response, stats, context, networkDetails);
        };
      }
      load(context, config, callbacks);
    };
  }
}

function PlayerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sourceId = searchParams.get('sourceId');
  const videoId = searchParams.get('videoId');
  const returnUrl = searchParams.get('returnUrl');
  const urlParam = searchParams.get('url');  // 直接播放URL参数
  const coverPicParam = searchParams.get('coverPic');  // 从TVBox页面传递的封面图片
  const videoNameParam = searchParams.get('videoName');  // 从TVBox页面传递的视频标题
  
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<VideoSource | null>(null);
  const [videoDetail, setVideoDetail] = useState<VideoItem | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showEpisodeList, setShowEpisodeList] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [directUrl, setDirectUrl] = useState('');
  const [directPlayTrigger, setDirectPlayTrigger] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const episodesPerPage = 20;
  const artRef = useRef<Artplayer | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 如果有直接播放URL参数，直接播放
    if (urlParam) {
      setLoading(false);
      setDirectUrl(urlParam);
      setDirectPlayTrigger(prev => !prev);
      return;
    }

    const loadSources = async () => {
      const backendSources = await loadSourcesFromBackend();
      const stored = localStorage.getItem('videoSources');
      let localSources: VideoSource[] = [];
      
      if (stored) {
        const sources = JSON.parse(stored);
        localSources = sources.filter((s: VideoSource) => s.enabled !== false && s.type !== 'tvbox');
      }
      
      const allSources = [...backendSources, ...localSources];
      
      if (allSources.length > 0) {
        setVideoSources(allSources);
        
        if (sourceId) {
          const source = allSources.find((s: VideoSource) => s.id === sourceId);
          if (source) {
            setSelectedSource(source);
            loadVideoDetail(source, videoId);
          } else {
            setError('未找到指定的视频源');
            setLoading(false);
          }
        } else if (allSources.length > 0) {
          setSelectedSource(allSources[0]);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    
    loadSources();
  }, [sourceId, videoId, urlParam]);

  const loadVideoDetail = async (source: VideoSource, id: string | null) => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // TVBox类型的视频源需要通过代理API获取
      if (source.type === 'tvbox') {
        const detailProxyUrl = new URL('/api/proxy', window.location.origin);
        detailProxyUrl.searchParams.set('apiUrl', source.apiUrl);
        detailProxyUrl.searchParams.set('act', 'detail');
        detailProxyUrl.searchParams.set('t', id);

        const response = await fetch(detailProxyUrl.toString());
        if (!response.ok) {
          throw new Error('获取视频详情失败');
        }

        const data = await response.json();
        if (!data.list || data.list.length === 0) {
          throw new Error('视频详情为空');
        }

        const detail = data.list[0];
        
        // 如果API返回的封面图片为空，使用从TVBox页面传递的封面图片
        if (!detail.vod_pic && coverPicParam) {
          detail.vod_pic = decodeURIComponent(coverPicParam);
        }
        
        // 如果从TVBox页面传递了视频标题，优先使用传递的标题（因为API返回的标题可能不准确）
        if (videoNameParam) {
          detail.vod_name = decodeURIComponent(videoNameParam);
        }
        
        setVideoDetail(detail);

        // 解析播放链接到选集
        if (detail.vod_play_url) {
          const playItems = detail.vod_play_url.split('#');
          const parsedEpisodes = playItems.map((item: string, index: number) => {
            const parts = item.split('$');
            const label = parts.length > 1 ? parts[0] : `第${index + 1}集`;
            const url = parts.length > 1 ? parts[1] : item;
            return { label, url, index };
          }).filter((ep: { label: string; url: string; index: number }) => ep.url);

          setEpisodes(parsedEpisodes);
          if (parsedEpisodes.length > 0) {
            setSelectedEpisode(parsedEpisodes[0]);
            // 使用 requestAnimationFrame 确保 DOM 已经渲染完成
            requestAnimationFrame(() => {
              loadTVBoxPlayUrl(source, parsedEpisodes[0].url);
            });
          } else {
            setError('未找到可播放的集数');
          }
        } else {
          throw new Error('视频没有播放链接');
        }
      } else {
        // 普通API视频源
        const detail = await getVideoDetail(source, parseInt(id));
        setVideoDetail(detail);
        
        const parsedEpisodes = parsePlayUrl(detail.vod_play_url || '');
        
        setEpisodes(parsedEpisodes);
        if (parsedEpisodes.length > 0) {
          setSelectedEpisode(parsedEpisodes[0]);
        } else {
          setError('未找到可播放的集数');
        }
      }
    } catch (err) {
      console.error('加载视频详情失败:', err);
      setError(err instanceof Error ? err.message : '获取视频详情失败');
    } finally {
      setLoading(false);
    }
  };

  const initIframePlayer = (url: string) => {
    console.log('初始化iframe播放器，URL:', url);
    
    if (!videoRef.current) {
      console.error('videoRef.current不存在，无法初始化iframe播放器');
      setPlaybackStatus('播放器初始化失败');
      return;
    }

    // 设置播放状态
    setPlaybackStatus('正在加载视频...');

    // 清理之前的播放器
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (artRef.current) {
      artRef.current.destroy();
      artRef.current = null;
    }

    // 创建iframe
    videoRef.current.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.allowFullscreen = true;
    iframe.allow = 'autoplay; fullscreen; encrypted-media';
    videoRef.current.appendChild(iframe);

    setPlaybackStatus(null);
  };

  const loadTVBoxPlayUrl = async (source: VideoSource, playId: string) => {
    if (!source || !playId) return;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setPlaybackStatus('正在获取播放地址...');

    try {
      const playProxyUrl = new URL('/api/proxy', window.location.origin);
      playProxyUrl.searchParams.set('apiUrl', source.apiUrl);
      playProxyUrl.searchParams.set('act', 'play');
      playProxyUrl.searchParams.set('t', playId);

      const response = await fetch(playProxyUrl.toString(), {
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error('获取播放地址失败');
      }

      const data = await response.json();
      if (data.url) {
        // 检查是否需要使用iframe播放
        if (data.parse === 1) {
          // 使用iframe播放
          initIframePlayer(data.url);
        } else {
          // 直接播放URL
          initPlayer(data.url);
        }
      } else {
        throw new Error('播放地址为空');
      }
    } catch (err) {
      // 如果是主动取消的请求，不显示错误
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('请求已取消');
        return;
      }
      console.error('获取播放地址失败:', err);
      setPlaybackStatus('获取播放地址失败');
    } finally {
      // 清理 controller
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const initPlayer = (url: string) => {
    console.log('尝试初始化播放器，URL:', url);
    console.log('videoRef.current存在:', !!videoRef.current);
    
    if (!videoRef.current) {
      console.error('videoRef.current不存在，无法初始化播放器');
      setPlaybackStatus('播放器初始化失败');
      return;
    }

    // 设置播放状态
    setPlaybackStatus('正在加载视频...');

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (artRef.current) {
      artRef.current.destroy();
      artRef.current = null;
    }

    const isM3U8 = url.includes('.m3u8');

    console.log('创建Artplayer实例，容器:', videoRef.current);
    
    const art = new Artplayer({
      container: videoRef.current,
      url: url,
      volume: 0.7,
      isLive: false,
      muted: false,
      autoplay: false,
      pip: true,
      autoSize: false,
      autoMini: false,
      screenshot: true,
      setting: true,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: true,
      miniProgressBar: false,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoOrientation: true,
      airplay: isIOS || isAndroid,
      theme: '#0ea5e9',
      lang: 'zh-cn',
      moreVideoAttr: {
        crossOrigin: 'anonymous',
      },
      plugins: [
        artplayerPluginLiquidGlass(),
      ],
      customType: {
        m3u8: (video: HTMLVideoElement, url: string, player: any) => {
          const artWithHls = player as ArtplayerWithHls;
          if (Hls.isSupported()) {
            if (artWithHls.hls) artWithHls.hls.destroy();
            
            const bufferConfig = getHlsBufferConfig();
            
            const hlsConfig: Partial<HlsConfig> = {
              debug: false,
              enableWorker: true,
              lowLatencyMode: !isMobile,
              maxBufferLength: isMobile
                ? (isIOS13 ? 8 : isIOS ? 10 : 15)
                : bufferConfig.maxBufferLength,
              backBufferLength: isMobile
                ? (isIOS13 ? 5 : isIOS ? 8 : 10)
                : bufferConfig.backBufferLength,
              maxBufferSize: isMobile
                ? (isIOS13 ? 20 * 1000 * 1000 : isIOS ? 30 * 1000 * 1000 : 40 * 1000 * 1000)
                : bufferConfig.maxBufferSize,
              maxLoadingDelay: isMobile ? (isIOS13 ? 1 : 2) : 2,
              maxBufferHole: isMobile ? (isIOS13 ? 0.05 : 0.1) : 0.1,
              liveDurationInfinity: false,
              liveBackBufferLength: isMobile ? (isIOS13 ? 3 : 5) : null,
              maxMaxBufferLength: isMobile ? (isIOS13 ? 60 : 120) : 600,
              maxFragLookUpTolerance: isMobile ? 0.1 : 0.25,
              abrEwmaFastLive: isMobile ? 2 : 3,
              abrEwmaSlowLive: isMobile ? 6 : 9,
              abrBandWidthFactor: isMobile ? 0.8 : 0.95,
              startFragPrefetch: !isMobile,
              testBandwidth: !isIOS13,
              fragLoadPolicy: {
                default: {
                  maxTimeToFirstByteMs: isMobile ? 3000 : 5000,
                  maxLoadTimeMs: isMobile ? 30000 : 60000,
                  timeoutRetry: {
                    maxNumRetry: isMobile ? 2 : 4,
                    retryDelayMs: 0,
                    maxRetryDelayMs: 0,
                  },
                  errorRetry: {
                    maxNumRetry: isMobile ? 3 : 6,
                    retryDelayMs: 1000,
                    maxRetryDelayMs: isMobile ? 4000 : 8000,
                  },
                },
              },
              loader: CustomHlsJsLoader as unknown as typeof Hls.DefaultConfig.loader,
            };
            
            const hls = new Hls(hlsConfig);
            hls.loadSource(url);
            hls.attachMedia(video);
            hlsRef.current = hls;
            artWithHls.hls = hls;
            player.on('destroy', () => hls.destroy());

            hls.on(Hls.Events.ERROR, (event: any, data: any) => {
              console.error('HLS Error:', event, data);

              if (data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR) {
                console.log('片段解析错误，尝试重新加载...');
                hls.startLoad();
                return;
              }

              if (data.details === Hls.ErrorDetails.BUFFER_APPEND_ERROR &&
                  data.err && data.err.message &&
                  data.err.message.includes('timestamp')) {
                console.log('时间戳错误，清理缓冲区并重新加载...');
                try {
                  const currentTime = video.currentTime;
                  hls.trigger(Hls.Events.BUFFER_RESET, undefined);
                  hls.startLoad(currentTime);
                } catch (e) {
                  console.warn('缓冲区重置失败:', e);
                  hls.startLoad();
                }
                return;
              }

              if (data.details === Hls.ErrorDetails.INTERNAL_ABORTED) {
                console.log('内部中止，忽略此错误');
                return;
              }

              if (data.fatal) {
                switch (data.type) {
                  case ErrorTypes.NETWORK_ERROR:
                    console.log('网络错误，尝试恢复...');
                    // 显示网络错误提示
                    if (artRef.current) {
                      artRef.current.notice.show = '网络错误，请检查链接是否有效';
                    }
                    setPlaybackStatus('网络错误，请检查链接');
                    hls.startLoad();
                    break;
                  case ErrorTypes.MEDIA_ERROR:
                    console.log('媒体错误，尝试恢复...');
                    hls.recoverMediaError();
                    break;
                  default:
                    console.log('无法恢复的错误');
                    hls.destroy();
                    // 显示错误提示
                    if (artRef.current) {
                      artRef.current.notice.show = '播放器错误，请检查链接格式';
                    }
                    setPlaybackStatus('播放错误');
                    break;
                }
              }
            });
            
            // 监听加载成功事件
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              setPlaybackStatus('视频加载成功，正在播放...');
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            setPlaybackStatus('视频加载成功，正在播放...');
          }
        },
      },
    });

    art.on('ready', () => {
      setPlaybackStatus('播放器已就绪');
    });
    
    art.on('fullscreen', () => setIsFullscreen(true));
    art.on('fullscreenExit', () => setIsFullscreen(false));

    artRef.current = art;
  };

  useEffect(() => {
    // 只有普通API视频源才自动初始化播放器
    // TVBox爬虫API视频源由 loadTVBoxPlayUrl 函数处理
    if (selectedEpisode?.url && selectedSource?.type !== 'tvbox') {
      initPlayer(selectedEpisode.url);
    }

    return () => {
      // 只有普通API视频源才清理播放器
      // TVBox爬虫API视频源由 loadTVBoxPlayUrl 函数管理
      if (selectedSource?.type !== 'tvbox') {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        if (artRef.current) {
          artRef.current.destroy();
          artRef.current = null;
        }
      }
    };
  }, [selectedEpisode, selectedSource]);

  const handleSourceSelect = (source: VideoSource) => {
    setSelectedSource(source);
    setShowSourceDropdown(false);
    if (videoId) {
      loadVideoDetail(source, videoId);
    }
  };

  const handleEpisodeSelect = async (episode: Episode) => {
    console.log('选择集数:', episode);
    
    // 如果选择的是当前正在播放的集数，不执行任何操作
    if (selectedEpisode?.index === episode.index) {
      console.log('已选择当前集数，忽略');
      return;
    }
    
    setSelectedEpisode(episode);
    
    // TVBox类型需要先获取播放地址
    if (selectedSource?.type === 'tvbox') {
      await loadTVBoxPlayUrl(selectedSource, episode.url);
    } else if (artRef.current && episode.url) {
      console.log('切换播放URL:', episode.url);
      initPlayer(episode.url);
      artRef.current.play();
    }
  };

  const handleDirectPlay = () => {
    if (!directUrl.trim()) {
      alert('请输入有效的视频链接');
      return;
    }

    // 检查URL是否为有效链接
    try {
      new URL(directUrl);
      
      // 清空之前的视频详情和选集信息
      setVideoDetail(null);
      setEpisodes([]);
      setSelectedEpisode(null);
      
      // 触发直接播放
      setDirectPlayTrigger(prev => !prev);
    } catch (err) {
      alert('请输入有效的视频链接');
    }
  };

  // 处理直接播放触发
  useEffect(() => {
    if (directPlayTrigger && directUrl.trim()) {
      initPlayer(directUrl);
    }
  }, [directPlayTrigger, directUrl]);

  const handleFullscreen = () => {
    if (artRef.current) {
      artRef.current.fullscreen = true;
    }
  };

  const handlePreviousEpisode = () => {
    if (selectedEpisode && selectedEpisode.index > 0) {
      handleEpisodeSelect(episodes[selectedEpisode.index - 1]);
    }
  };

  const handleNextEpisode = () => {
    if (selectedEpisode && selectedEpisode.index < episodes.length - 1) {
      handleEpisodeSelect(episodes[selectedEpisode.index + 1]);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  const totalPages = Math.ceil(episodes.length / episodesPerPage);
  const startIndex = (currentPage - 1) * episodesPerPage;
  const endIndex = startIndex + episodesPerPage;
  const currentEpisodes = episodes.slice(startIndex, endIndex);

  return (
    <PageTransition>
      <div className="min-h-screen relative">
        <div className="absolute inset-0" style={{background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', zIndex: 0}}></div>
        <div className="absolute inset-0" style={{zIndex: 1}}>
          <ParticleBackground />
        </div>
        
        <div className="relative" style={{zIndex: 10}}>
          <div className="max-w-7xl mx-auto px-4 py-20 sm:py-24">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between mb-8 gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                视频播放器
              </h1>
              <button
                onClick={() => router.push(returnUrl || '/')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                <ChevronDown className="w-5 h-5 rotate-180" />
                {returnUrl ? '返回' : '返回首页'}
              </button>
            </div>
            
            <div className="space-y-6">
              {loading ? (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 border border-gray-700/50">
                  <div className="flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-gray-400">加载中...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-red-500/50">
                  <p className="text-red-400 text-center">{error}</p>
                </div>
              ) : (videoDetail || directUrl || urlParam) ? (
                <>
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700/50">
                    <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
                      <div className="flex flex-col flex-1 text-center">
                        <h2 className="text-xl font-semibold text-white">{videoDetail?.vod_name || '播放器'}</h2>
                        {selectedSource && (
                          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                            <span>源：</span>
                            <span className="text-white font-medium">{selectedSource.name}</span>
                            {episodes.length > 0 && selectedEpisode?.label && (
                              <>
                                <span>·</span>
                                <span>{selectedEpisode.label}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="aspect-video bg-black">
                      <div ref={videoRef} className="w-full h-full"></div>
                    </div>
                  </div>

                  {videoDetail && episodes.length > 0 && (
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-gray-700/50">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                        <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
                          <List className="w-5 h-5" />
                          选集
                          <span className="text-sm text-gray-400">({episodes.length}集)</span>
                        </h2>
                        <button
                          onClick={() => setShowEpisodeList(!showEpisodeList)}
                          className="text-gray-400 hover:text-white transition-colors text-sm"
                        >
                          {showEpisodeList ? '收起' : '展开'}
                        </button>
                      </div>
                      
                      {showEpisodeList && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                            {currentEpisodes.map((episode) => (
                              <button
                                key={episode.index}
                                onClick={() => handleEpisodeSelect(episode)}
                                className={`px-2 sm:px-3 py-2 text-xs sm:text-sm rounded-lg transition-all ${
                                  selectedEpisode?.index === episode.index
                                    ? 'bg-blue-600 text-white font-medium'
                                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}
                              >
                                {episode.label}
                              </button>
                            ))}
                          </div>
                          
                          {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="p-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <span className="text-gray-300 text-xs sm:text-sm">
                                第 {currentPage} / {totalPages} 页
                              </span>
                              <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {selectedEpisode && (
                        <div className="mt-4 p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Play className="w-4 h-4 text-blue-400" />
                              <span className="text-white font-medium text-sm sm:text-base">当前播放：</span>
                              <span className="text-blue-400 text-sm sm:text-base">{selectedEpisode.label}</span>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                onClick={handlePreviousEpisode}
                                disabled={selectedEpisode.index === 0}
                                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1 text-sm sm:text-base"
                              >
                                <ChevronLeft className="w-4 h-4" />
                                上一集
                              </button>
                              <button
                                onClick={handleNextEpisode}
                                disabled={selectedEpisode.index === episodes.length - 1}
                                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1 text-sm sm:text-base"
                              >
                                下一集
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-gray-700/50">
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                      {videoDetail?.vod_pic && !imageLoadFailed ? (
                        <div className="w-full sm:w-48 flex-shrink-0 mx-auto sm:mx-0">
                          <img
                            src={videoDetail.vod_pic}
                            alt={videoDetail?.vod_name || ''}
                            className="w-full rounded-lg shadow-lg"
                            onError={() => setImageLoadFailed(true)}
                          />
                        </div>
                      ) : (
                        <div className="w-full sm:w-48 flex-shrink-0 mx-auto sm:mx-0">
                          <div className="w-full aspect-[2/3] bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg flex items-center justify-center">
                            <Film className="w-12 h-12 text-gray-400" />
                          </div>
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">{videoDetail?.vod_name}</h2>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-gray-300">
                            <Film className="w-4 h-4" />
                            <span>{videoDetail?.type_name}</span>
                          </div>
                          {videoDetail?.vod_area && (
                            <div className="flex items-center gap-2 text-gray-300">
                              <span className="text-gray-400">地区：</span>
                              <span>{videoDetail.vod_area}</span>
                            </div>
                          )}
                          {videoDetail?.vod_year && (
                            <div className="flex items-center gap-2 text-gray-300">
                              <Calendar className="w-4 h-4" />
                              <span>{videoDetail.vod_year}</span>
                            </div>
                          )}
                          {videoDetail?.vod_score && (
                            <div className="flex items-center gap-2 text-yellow-400">
                              <Star className="w-4 h-4" />
                              <span>{videoDetail.vod_score}</span>
                            </div>
                          )}
                          {videoDetail?.vod_remarks && (
                            <div className="flex items-center gap-2 text-blue-400">
                              <Clock className="w-4 h-4" />
                              <span>{videoDetail.vod_remarks}</span>
                            </div>
                          )}
                          {videoDetail?.vod_actor && (
                            <div className="flex items-start gap-2 text-gray-300">
                              <User className="w-4 h-4 mt-0.5" />
                              <span className="text-sm">{videoDetail.vod_actor}</span>
                            </div>
                          )}
                          {videoDetail?.vod_director && (
                            <div className="flex items-center gap-2 text-gray-300">
                              <span className="text-gray-400">导演：</span>
                              <span>{videoDetail.vod_director}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {(videoDetail?.vod_blurb || videoDetail?.vod_content) && (
                      <div className="mt-6 pt-6 border-t border-gray-700/50">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                          <p className="text-gray-300 text-sm leading-relaxed">{videoDetail?.vod_blurb || videoDetail?.vod_content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 sm:p-8 border border-gray-700/50">
                    <h2 className="text-xl font-semibold text-white mb-4 text-center">直接播放</h2>
                    <p className="text-gray-400 text-center mb-6">输入视频链接直接播放</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={directUrl}
                        onChange={(e) => setDirectUrl(e.target.value)}
                        placeholder="请输入 m3u8 或 mp4 播放链接..."
                        className="flex-1 px-4 py-3 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleDirectPlay}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                      >
                        播放
                      </button>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-gray-700/50">
                      <p className="text-sm text-gray-400 text-center">
                        支持 m3u8、mp4 等常见视频格式
                      </p>
                    </div>
                  </div>
                  
                  {/* 视频播放器容器 */}
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700/50">
                    <div className="aspect-video bg-black">
                      <div ref={videoRef} className="w-full h-full"></div>
                    </div>
                    {playbackStatus && (
                      <div className="p-3 bg-gray-900/50 border-t border-gray-700/50">
                        <p className="text-sm text-center text-gray-300">{playbackStatus}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen relative">
        <div className="absolute inset-0" style={{background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', zIndex: 0}}></div>
        <div className="absolute inset-0" style={{zIndex: 1}}>
          <ParticleBackground />
        </div>
        <div className="relative" style={{zIndex: 10}}>
          <div className="max-w-7xl mx-auto px-4 py-20 sm:py-24">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 border border-gray-700/50">
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-400">加载中...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <PlayerContent />
    </Suspense>
  );
}

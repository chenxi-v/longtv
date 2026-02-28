'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import ParticleBackground from '@/components/ParticleBackground';
import { Play, Clock, Calendar, Film, Settings, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { aggregatedSearch, batchGetVideoCovers, VideoSource } from '@/lib/api';
import PageTransition from '@/components/PageTransition';

interface VideoItem {
  vod_id: number;
  vod_name: string;
  vod_en: string;
  vod_time: string;
  vod_remarks: string;
  vod_play_from: string;
  vod_pic?: string;
  type_id: number;
  type_name: string;
  sourceId?: string;
  sourceName?: string;
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  
  const [searchResults, setSearchResults] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [videoSources, setVideoSources] = useState<VideoSource[] | undefined>(undefined);
  const [covers, setCovers] = useState<Record<number, string>>({});
  const abortCtrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('videoSources');
    if (stored) {
      const sources = JSON.parse(stored);
      const enabledSources = sources.filter((s: VideoSource) => s.enabled !== false);
      setVideoSources(enabledSources);
    } else {
      setVideoSources([]);
    }
  }, []);

  const performSearch = useCallback(async (keyword: string, sources: VideoSource[]) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      setCovers({});
      setLoading(false);
      return;
    }

    if (sources.length === 0) {
      setError('请先在设置中配置并启用视频源');
      setLoading(false);
      return;
    }

    abortCtrlRef.current?.abort();
    const controller = new AbortController();
    abortCtrlRef.current = controller;

    setLoading(true);
    setError('');
    setSearchResults([]);
    setCovers({});

    try {
      const results = await aggregatedSearch(
        sources,
        keyword,
        (newResults) => {
          if (controller.signal.aborted) return;
          
          setSearchResults(prev => {
            const merged = [...prev, ...newResults];
            setTotal(merged.length);
            return merged;
          });

          batchGetVideoCovers(newResults, sources).then(newCovers => {
            if (controller.signal.aborted) return;
            setCovers(prev => ({ ...prev, ...newCovers }));
          });
        },
        controller.signal,
        1
      );

      if (!controller.signal.aborted) {
        setSearchResults(results);
        setTotal(results.length);
        
        const allCovers = await batchGetVideoCovers(results, sources);
        if (!controller.signal.aborted) {
          setCovers(allCovers);
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('搜索已取消');
        return;
      }
      console.error('搜索失败:', err);
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (videoSources === undefined) return;
    performSearch(query, videoSources);

    return () => {
      abortCtrlRef.current?.abort();
    };
  }, [query, videoSources, performSearch]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

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
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 text-white rounded-lg hover:bg-gray-700/70 transition-colors"
                  title="返回"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  搜索结果: <span className="text-blue-400">{query}</span>
                </h1>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                返回首页
              </Link>
            </div>

            {error && (
              <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-center">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-400">搜索中...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                未找到相关视频
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-400">
                    共找到 <span className="text-white font-medium">{total}</span> 条结果
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {searchResults.map((video) => (
                    <Link
                      key={video.vod_id}
                      href={`/player?sourceId=${video.sourceId}&videoId=${video.vod_id}`}
                      className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/50 hover:scale-105 transition-all cursor-pointer group relative"
                    >
                      <div className="aspect-[3/4] bg-gray-700 overflow-hidden">
                        {covers[video.vod_id] && covers[video.vod_id].trim() !== '' ? (
                          <img
                            src={covers[video.vod_id]}
                            alt={video.vod_name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-600 to-gray-800">
                            <Film className="w-16 h-16 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-white font-medium mb-2 text-sm line-clamp-2 group-hover:text-blue-400 transition-colors">
                          {video.vod_name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                          <Film className="w-3 h-3" />
                          <span className="truncate">{video.type_name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                          {video.sourceName && (
                            <span className="flex items-center gap-1 text-blue-400 truncate">
                              <Settings className="w-3 h-3" />
                              {video.sourceName}
                            </span>
                          )}
                          {video.vod_remarks && (
                            <span className="flex items-center gap-1 text-blue-400 truncate">
                              <Clock className="w-3 h-3" />
                              {video.vod_remarks}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-12 h-12 text-white" />
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={null}>
      <SearchResultsContent />
    </Suspense>
  );
}

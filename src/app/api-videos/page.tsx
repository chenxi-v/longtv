'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Film, Clock, Calendar, Star, Play, Search, X } from 'lucide-react';
import Link from 'next/link';
import ParticleBackground from '@/components/ParticleBackground';
import PageTransition from '@/components/PageTransition';
import { getVideoDetail, searchVideos, searchVideosAll, batchGetVideoCovers, VideoSource } from '@/lib/api';

interface ProxySettings {
  enabled: boolean;
  proxyUrl: string;
}

interface VideoItem {
  vod_id: number;
  vod_name: string;
  vod_en: string;
  vod_time: string;
  vod_remarks: string;
  vod_play_from: string;
  vod_pic?: string;
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
  sourceId?: string;
  sourceName?: string;
}

interface CategoryItem {
  type_id: number;
  type_name: string;
}

interface ApiResponse {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: number;
  total: number;
  list: VideoItem[];
}

// 获取全局代理设置
function getGlobalProxySettings(): ProxySettings | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('proxySettings');
  if (stored) {
    return JSON.parse(stored);
  }
  return null;
}

// 构建代理URL
function buildProxyUrl(source: VideoSource): string | undefined {
  // 如果视频源单独关闭了代理，则不使用代理
  if (source.proxyEnabled === false) {
    return undefined;
  }
  
  // 使用全局代理设置
  const globalProxy = getGlobalProxySettings();
  if (globalProxy?.enabled && globalProxy?.proxyUrl) {
    return globalProxy.proxyUrl;
  }
  
  return undefined;
}

function ApiVideosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<VideoSource | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [covers, setCovers] = useState<Record<number, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [enableAggregateSearch, setEnableAggregateSearch] = useState(false);

  const loadCategories = async (source: VideoSource) => {
    if (!source.apiUrl) {
      return;
    }

    try {
      const proxyUrl = new URL('/api/proxy', window.location.origin);
      proxyUrl.searchParams.set('apiUrl', source.apiUrl);
      proxyUrl.searchParams.set('ac', 'list');
      
      // 添加Cloudflare Worker代理地址
      const workerProxyUrl = buildProxyUrl(source);
      if (workerProxyUrl) {
        proxyUrl.searchParams.set('proxyUrl', workerProxyUrl);
      }

      const response = await fetch(proxyUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.code === 1 && data.class && data.class.length > 0) {
        setCategories(data.class);
      }
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  };

  const loadVideos = async (source: VideoSource, page: number = 1, categoryId: number | null = null, keyword: string | null = null) => {
    if (!source.apiUrl) {
      setError('视频源API地址为空');
      return;
    }

    setLoading(true);
    setError('');
    setCovers({});

    try {
      const proxyUrl = new URL('/api/proxy', window.location.origin);
      proxyUrl.searchParams.set('apiUrl', source.apiUrl);
      proxyUrl.searchParams.set('pg', page.toString());

      if (keyword) {
        proxyUrl.searchParams.set('wd', keyword);
      } else if (categoryId) {
        proxyUrl.searchParams.set('t', categoryId.toString());
      }
      
      // 添加Cloudflare Worker代理地址
      const workerProxyUrl = buildProxyUrl(source);
      if (workerProxyUrl) {
        proxyUrl.searchParams.set('proxyUrl', workerProxyUrl);
      }

      const response = await fetch(proxyUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data: ApiResponse = await response.json();

      if (data.code === 1) {
        const listWithSource = data.list.map(item => ({ ...item, sourceId: source.id }));
        setVideos(listWithSource);
        setTotalPages(data.pagecount);
        setTotal(data.total);

        if (listWithSource.length > 0) {
          const newCovers = await batchGetVideoCovers(listWithSource, [source]);
          setCovers(newCovers);
        }
      } else {
        setError(data.msg || '获取视频列表失败');
      }
    } catch (err) {
      console.error('加载视频列表失败:', err);
      setError(err instanceof Error ? err.message : '加载视频列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSource = (source: VideoSource) => {
    setSelectedSource(source);
    setSelectedCategory(null);
    setCurrentPage(1);
    loadCategories(source);
    loadVideos(source, 1, null);
    updateUrl(source.id, null, 1);
  };

  const handleSelectCategory = (categoryId: number | null) => {
    if (!selectedSource) return;
    
    setSelectedCategory(categoryId);
    setIsSearching(false);
    setSearchKeyword('');
    setCurrentPage(1);
    loadVideos(selectedSource, 1, categoryId);
    updateUrl(selectedSource.id, categoryId, 1);
  };

  const handlePageChange = (page: number) => {
    if (!selectedSource) return;
    
    setCurrentPage(page);
    loadVideos(selectedSource, page, selectedCategory);
    updateUrl(selectedSource.id, selectedCategory, page);
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      return;
    }
    
    setIsSearching(true);
    setSelectedCategory(null);
    setCurrentPage(1);
    setLoading(true);
    setError('');
    setCovers({});
    
    try {
      if (enableAggregateSearch) {
        const result = await searchVideosAll(videoSources, searchKeyword.trim(), 1);
        setVideos(result.list);
        setTotal(result.total);
        setTotalPages(1);

        if (result.list.length > 0) {
          const newCovers = await batchGetVideoCovers(result.list, videoSources);
          setCovers(newCovers);
        }
      } else if (selectedSource) {
        loadVideos(selectedSource, 1, null, searchKeyword.trim());
        updateUrl(selectedSource.id, null, 1);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchKeyword('');
    setIsSearching(false);
    if (selectedSource) {
      setCurrentPage(1);
      loadVideos(selectedSource, 1, selectedCategory);
      updateUrl(selectedSource.id, selectedCategory, 1);
    }
  };

  const updateUrl = (sourceId: string, category: number | null, page: number) => {
    const newParams = new URLSearchParams();
    newParams.set('sourceId', sourceId);
    
    if (category !== null) {
      newParams.set('category', category.toString());
    }
    
    newParams.set('page', page.toString());
    
    router.push(`/api-videos?${newParams.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const stored = localStorage.getItem('videoSources');
    if (stored) {
      const sources = JSON.parse(stored);
      // 只过滤非TVBox类型的视频源
      const enabledSources = sources.filter((s: VideoSource) => s.enabled !== false && s.type !== 'tvbox');
      setVideoSources(enabledSources);

      const sourceIdParam = searchParams.get('sourceId');
      const categoryParam = searchParams.get('category');
      const pageParam = searchParams.get('page');
      
      if (sourceIdParam) {
        const source = enabledSources.find((s: VideoSource) => s.id === sourceIdParam);
        if (source) {
          setSelectedSource(source);
          const categoryId = categoryParam ? parseInt(categoryParam) : null;
          const pageNum = pageParam ? parseInt(pageParam) : 1;
          
          setSelectedCategory(categoryId);
          setCurrentPage(pageNum);
          
          loadCategories(source);
          loadVideos(source, pageNum, categoryId);
        } else if (enabledSources.length > 0) {
          setSelectedSource(enabledSources[0]);
          loadCategories(enabledSources[0]);
          loadVideos(enabledSources[0], 1, null);
        }
      } else if (enabledSources.length > 0) {
        setSelectedSource(enabledSources[0]);
        loadCategories(enabledSources[0]);
        loadVideos(enabledSources[0], 1, null);
      }
    }
    setIsInitialized(true);
  }, []);

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
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                API视频
              </h1>
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
                返回首页
              </Link>
            </div>

            {videoSources.length === 0 ? (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 border border-gray-700/50">
                <p className="text-gray-400 text-center">暂无已启用的视频源，请先在设置中配置并启用视频源</p>
              </div>
            ) : (
              <>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-gray-700/50 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base sm:text-lg font-semibold text-white">选择视频源</h2>
                  </div>
                  
                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                    {videoSources.map((source) => (
                      <button
                        key={source.id}
                        onClick={() => handleSelectSource(source)}
                        className={`w-full sm:w-24 h-10 rounded-full border transition-all text-sm font-medium flex items-center justify-center ${
                          selectedSource?.id === source.id
                            ? 'bg-blue-500/20 border-blue-400 text-white'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        {source.name}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedSource && (
                  <>
                    <div className="mb-6">
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="flex-1 w-full relative">
                          <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="搜索视频..."
                            className="w-full px-4 py-3 sm:px-6 sm:py-4 pl-10 sm:pl-12 pr-12 sm:pr-14 text-sm sm:text-lg bg-gray-800/80 backdrop-blur-sm text-white placeholder-gray-400 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          />
                          <svg
                            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                          <button
                            onClick={handleSearch}
                            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                            title="搜索"
                          >
                            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                          {isSearching && (
                            <button
                              onClick={clearSearch}
                              className="px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-full transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-full">
                            <span className="text-sm text-gray-300">聚合搜索</span>
                            <button
                              onClick={() => setEnableAggregateSearch(!enableAggregateSearch)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                enableAggregateSearch ? 'bg-blue-600' : 'bg-gray-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  enableAggregateSearch ? 'translate-x-5' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {!isSearching && categories.length > 0 && (
                      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-gray-700/50 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg sm:text-xl font-semibold text-white">分类筛选</h2>
                          {categories.length > 8 && (
                            <button
                              onClick={() => setShowAllCategories(!showAllCategories)}
                              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              {showAllCategories ? '收起' : '展开'}
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                          <button
                            onClick={() => handleSelectCategory(null)}
                            className={`w-full sm:w-24 h-10 rounded-full border transition-all text-sm font-medium flex items-center justify-center ${
                              selectedCategory === null && !isSearching
                                ? 'bg-blue-500/20 border-blue-400 text-white'
                                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                            }`}
                          >
                            全部
                          </button>
                          {(showAllCategories ? categories : categories.slice(0, 8)).map((category) => (
                            <button
                              key={category.type_id}
                              onClick={() => handleSelectCategory(category.type_id)}
                              className={`w-full sm:w-24 h-10 rounded-full border transition-all text-sm font-medium flex items-center justify-center ${
                                selectedCategory === category.type_id
                                  ? 'bg-blue-500/20 border-blue-400 text-white'
                                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                              }`}
                            >
                              {category.type_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-4">
                      <p className="text-gray-400">
                        共找到 <span className="text-white font-medium">{total}</span> 个视频
                      </p>
                      {!isSearching && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-sm">第 {currentPage} / {totalPages} 页</span>
                        </div>
                      )}
                    </div>

                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="ml-3 text-gray-400">加载中...</span>
                      </div>
                    ) : error ? (
                      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-red-500/50">
                        <p className="text-red-400 text-center">{error}</p>
                      </div>
                    ) : videos.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        {isSearching ? '未找到相关视频' : '该视频源暂无视频'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {videos.map((video) => (
                          <Link
                            key={`${video.sourceId}-${video.vod_id}`}
                            href={`/player?sourceId=${video.sourceId || selectedSource?.id}&videoId=${video.vod_id}&returnUrl=${encodeURIComponent(`/api-videos?${searchParams.toString()}`)}`}
                            className="bg-white/5 backdrop-blur-md rounded-xl overflow-hidden border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all cursor-pointer group relative shadow-lg"
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
                              {video.sourceName && (
                                <div className="flex items-center gap-1 text-xs text-blue-400 mb-2">
                                  <span className="truncate">{video.sourceName}</span>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                {video.vod_area && (
                                  <span className="flex items-center gap-1 text-blue-400 truncate">
                                    <span>{video.vod_area}</span>
                                  </span>
                                )}
                                {video.vod_year && (
                                  <span className="flex items-center gap-1 text-blue-400 truncate">
                                    <Calendar className="w-3 h-3" />
                                    {video.vod_year}
                                  </span>
                                )}
                                {video.vod_score && (
                                  <span className="flex items-center gap-1 text-yellow-400 truncate">
                                    <Star className="w-3 h-3" />
                                    {video.vod_score}
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
                    )}

                    {totalPages > 1 && !isSearching && (
                      <div className="flex items-center justify-center gap-2 mt-8">
                        <button
                          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="p-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-white/10"
                        >
                          <ChevronRight className="w-4 h-4 rotate-180" />
                        </button>
                        <span className="text-gray-300 text-sm">
                          第 {currentPage} / {totalPages} 页
                        </span>
                        <button
                          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-white/10"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default function ApiVideosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-white">加载中...</div></div>}>
      <ApiVideosContent />
    </Suspense>
  );
}

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Search, Play, X, Film, Clock, Calendar, Star } from 'lucide-react';
import Link from 'next/link';
import ParticleBackground from '@/components/ParticleBackground';
import PageTransition from '@/components/PageTransition';
import { buildProxyUrl } from '@/lib/api';

interface VideoSource {
  id: string;
  name: string;
  key: string;
  apiUrl: string;
  enabled: boolean;
  proxyEnabled?: boolean;
  type?: 'normal' | 'tvbox';
}

interface CategoryItem {
  type_id: string;
  type_name: string;
}

interface VideoItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_year?: string;
  vod_play_from?: string;
  vod_play_url?: string;
  style?: {
    type: string;
    ratio: number;
  };
}

interface DetailResponse {
  code?: number;
  msg?: string;
  list?: VideoDetailItem[];
  error?: string;
}

interface VideoDetailItem extends VideoItem {
  vod_content?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_area?: string;
}

interface PlayResponse {
  parse?: number;
  url?: string;
  header?: Record<string, string>;
  error?: string;
}

interface ApiResponse {
  code?: number;
  msg?: string;
  class?: CategoryItem[];
  list?: VideoItem[];
  page?: number;
  pagecount?: number;
  limit?: number;
  total?: number;
  filters?: Record<string, FilterItem[]>;
  error?: string; // 添加错误字段
}

interface FilterItem {
  key: string;
  name: string;
  value: Array<{
    n: string; // 显示名称
    v: string; // 实际值
  }>;
}

const getBackendUrl = (): string => {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000';
  const stored = localStorage.getItem('backend_url');
  if (stored) {
    return stored.replace(/localhost/g, '127.0.0.1');
  }
  return 'http://127.0.0.1:8000';
};

function TVBoxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<VideoSource | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [filters, setFilters] = useState<Record<string, FilterItem[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);

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
        setBackendConnected(true);
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
      setBackendConnected(false);
      return [];
    } catch (error) {
      console.error('从后端加载爬虫失败:', error);
      setBackendConnected(false);
      return [];
    }
  };

  const loadSources = async () => {
    const backendSources = await loadSourcesFromBackend();
    
    if (backendSources.length > 0) {
      setVideoSources(backendSources);
      
      const sourceIdParam = searchParams.get('sourceId');
      const categoryParam = searchParams.get('category');
      const pageParam = searchParams.get('page');
      const keywordParam = searchParams.get('keyword');
      
      if (sourceIdParam) {
        const source = backendSources.find((s: VideoSource) => s.id === sourceIdParam);
        if (source) {
          setSelectedSource(source);
          
          if (categoryParam) {
            setSelectedCategory(categoryParam);
          }
          if (pageParam) {
            setCurrentPage(parseInt(pageParam));
          }
          if (keywordParam) {
            setSearchKeyword(decodeURIComponent(keywordParam));
            setIsSearching(true);
          }
          
          loadCategories(source);
          
          if (keywordParam) {
            loadVideos(source, parseInt(pageParam || '1') || 1, null, decodeURIComponent(keywordParam));
          } else if (categoryParam) {
            loadVideos(source, parseInt(pageParam || '1') || 1, categoryParam);
          }
        }
      } else if (backendSources.length > 0) {
        setSelectedSource(backendSources[0]);
        loadCategories(backendSources[0]);
      }
    } else {
      const stored = localStorage.getItem('videoSources');
      if (stored) {
        const sources: VideoSource[] = JSON.parse(stored);
        const enabledSources = sources.filter((s: VideoSource) => s.enabled !== false && s.type === 'tvbox');
        setVideoSources(enabledSources);
        
        if (enabledSources.length > 0) {
          setSelectedSource(enabledSources[0]);
          loadCategories(enabledSources[0]);
        }
      }
    }
    setIsInitialized(true);
  };

  const loadCategories = async (source: VideoSource) => {
    if (!source.apiUrl) {
      return;
    }

    try {
      const proxyUrl = new URL('/api/proxy', window.location.origin);
      proxyUrl.searchParams.set('apiUrl', source.apiUrl);
      proxyUrl.searchParams.set('act', 'home'); // TVBox协议获取分类
      
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

      // 检查是否有错误
      if (data.hasOwnProperty('error')) {
        throw new Error(data.error || 'API返回错误');
      }
      
      // 检查是否是TVBox格式的数据
      if (data.class && data.class.length > 0) {
        setCategories(data.class);
        // 如果有筛选器数据，也保存下来
        if (data.filters) {
          setFilters(data.filters);
        }
        // 如果首页响应也包含视频列表和分页信息，也处理这些数据
        if (data.list !== undefined) {
          setVideos(data.list);
          setTotalPages(data.pagecount || 0);
          setTotal(data.total || 0);
        }
      } else if (Array.isArray(data) && data.length > 0) {
        // 直接返回数组的情况
        setCategories(data);
      }
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  };

  const loadVideos = async (source: VideoSource, page: number = 1, categoryId: string | null = null, keyword: string | null = null, selectedFilters: Record<string, string> = {}) => {
    if (!source.apiUrl) {
      setError('视频源API地址为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const proxyUrl = new URL('/api/proxy', window.location.origin);
      proxyUrl.searchParams.set('apiUrl', source.apiUrl);
      proxyUrl.searchParams.set('pg', page.toString());

      if (keyword) {
        // 搜索模式
        proxyUrl.searchParams.set('act', 'search');
        proxyUrl.searchParams.set('wd', keyword);
      } else if (categoryId) {
        // 分类模式
        proxyUrl.searchParams.set('act', 'category');
        proxyUrl.searchParams.set('t', categoryId);
        
        // 添加筛选参数 (TVBox协议使用extend参数)
        if (Object.keys(selectedFilters).length > 0) {
          proxyUrl.searchParams.set('extend', JSON.stringify(selectedFilters));
        }
      } else {
        // 首页模式
        proxyUrl.searchParams.set('act', 'home');
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

      // 检查是否有错误
      if (data.hasOwnProperty('error')) {
        throw new Error(data.error || 'API返回错误');
      }
      
      // 检查是否是TVBox格式的数据
      if (data.list !== undefined) {
        // TVBox格式
        setVideos(data.list);
        setTotalPages(data.pagecount || 0);
        setTotal(data.total || 0);
      } else if (Array.isArray(data)) {
        // 直接返回数组的情况
        setVideos(data);
        setTotalPages(1);
        setTotal(data.length);
      } else {
        setVideos([]);
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
    setSearchKeyword('');
    setIsSearching(false);
    loadCategories(source);
    loadVideos(source, 1, null, null);
    updateUrl(source.id, null, 1, null);
  };

  const handleSelectCategory = (categoryId: string | null) => {
    if (!selectedSource) return;

    setSelectedCategory(categoryId);
    // 切换分类时，清空之前分类的筛选器，保留其他分类的筛选器
    const newSelectedFilters = {...selectedFilters};
    if (selectedCategory && filters[selectedCategory]) {
      // 移除之前分类的筛选器
      filters[selectedCategory].forEach(filter => {
        delete newSelectedFilters[filter.key];
      });
    }
    setSelectedFilters(newSelectedFilters);
    setCurrentPage(1);
    setIsSearching(false);
    loadVideos(selectedSource, 1, categoryId, null, newSelectedFilters);
    updateUrl(selectedSource.id, categoryId, 1, null);
  };

  const handleFilterChange = (filterKey: string, filterValue: string) => {
    if (!selectedSource || !selectedCategory) return;

    const newSelectedFilters = { ...selectedFilters, [filterKey]: filterValue };
    setSelectedFilters(newSelectedFilters);
    setCurrentPage(1);
    loadVideos(selectedSource, 1, selectedCategory, null, newSelectedFilters);
  };

  const handlePageChange = (page: number) => {
    if (!selectedSource) return;

    setCurrentPage(page);
    if (isSearching && searchKeyword) {
      loadVideos(selectedSource, page, null, searchKeyword);
      updateUrl(selectedSource.id, null, page, searchKeyword);
    } else {
      loadVideos(selectedSource, page, selectedCategory, null, selectedFilters);
      updateUrl(selectedSource.id, selectedCategory, page, null);
    }
  };

  const handleSearch = () => {
    if (!selectedSource || !searchKeyword.trim()) return;

    setIsSearching(true);
    setSelectedCategory(null);
    setCurrentPage(1);
    // 搜索时忽略筛选器
    loadVideos(selectedSource, 1, null, searchKeyword);
    updateUrl(selectedSource.id, null, 1, searchKeyword);
  };

  const updateUrl = (sourceId: string, category: string | null, page: number, keyword: string | null) => {
    const newParams = new URLSearchParams();
    newParams.set('sourceId', sourceId);

    if (category) {
      newParams.set('category', category);
    }

    if (keyword) {
      newParams.set('keyword', keyword);
    }

    newParams.set('page', page.toString());

    router.push(`/tvbox?${newParams.toString()}`, { scroll: false });
  };

  const clearSearch = () => {
    setSearchKeyword('');
    setIsSearching(false);
    setSelectedCategory(null);
    setCurrentPage(1);
    // 清空搜索时也清空筛选器
    setSelectedFilters({});
    if (selectedSource) {
      loadCategories(selectedSource);
      loadVideos(selectedSource, 1, null, null);
      updateUrl(selectedSource.id, null, 1, null);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            i === currentPage
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="flex items-center gap-1">
        {currentPage > 1 && (
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            className="px-3 py-1 rounded-md text-sm font-medium bg-white/10 text-gray-300 hover:bg-white/20"
          >
            上一页
          </button>
        )}
        {pages}
        {currentPage < totalPages && (
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            className="px-3 py-1 rounded-md text-sm font-medium bg-white/10 text-gray-300 hover:bg-white/20"
          >
            下一页
          </button>
        )}
      </div>
    );
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
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  TVBox爬虫
                </h1>
                <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} 
                     title={backendConnected ? '后端已连接' : '后端未连接'}></div>
              </div>
              <button 
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
                返回首页
              </button>
            </div>

            {!backendConnected && videoSources.length === 0 ? (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 border border-gray-700/50">
                <p className="text-gray-400 text-center mb-4">无法连接后端服务，请确保后端服务正在运行</p>
                <p className="text-gray-500 text-center text-sm">后端地址: {getBackendUrl()}</p>
              </div>
            ) : videoSources.length === 0 ? (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 border border-gray-700/50">
                <p className="text-gray-400 text-center">暂无已加载的爬虫，请在后台管理中添加爬虫</p>
              </div>
            ) : (
              <>
                {/* 搜索框 */}
                <div className="mb-6">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex-1 w-full relative">
                      <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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
                      {searchKeyword && (
                        <button
                          onClick={clearSearch}
                          className="px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-full transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 视频源选择 */}
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

                {/* 分类导航 */}
                {selectedSource && categories.length > 0 && (
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
                        首页
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

                {/* 筛选器 */}
                {selectedSource && selectedCategory && filters[selectedCategory] && (
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-gray-700/50 mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base sm:text-lg font-semibold text-white">筛选</h2>
                    </div>

                    <div className="space-y-3">
                      {filters[selectedCategory]?.map((filter) => (
                        <div key={filter.key} className="flex flex-col">
                          <div className="text-sm text-gray-300 mb-2">{filter.name}:</div>
                          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                            {filter.value.map((option) => (
                              <button
                                key={option.v}
                                onClick={() => handleFilterChange(filter.key, option.v)}
                                className={`w-full sm:w-24 h-10 rounded-full border transition-all text-sm font-medium flex items-center justify-center ${
                                  selectedFilters[filter.key] === option.v
                                    ? 'bg-blue-500/20 border-blue-400 text-white'
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                                }`}
                              >
                                {option.n}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 搜索结果或分类标题 */}
                {(isSearching || selectedCategory) && (
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-white">
                      {isSearching ? `搜索: "${searchKeyword}"` : categories.find(c => c.type_id === selectedCategory)?.type_name}
                    </h2>
                    <p className="text-gray-400 mt-1">共 {Math.min(totalPages, currentPage + 4)} 页</p>
                  </div>
                )}

                {/* 加载状态 */}
                {loading && (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                  </div>
                )}

                {/* 错误信息 */}
                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 mb-6">
                    <p className="text-red-300">{error}</p>
                  </div>
                )}

                {/* 视频列表 */}
                {!loading && videos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
                    {videos.map((video, index) => (
                      <Link
                        key={index}
                        href={`/player?sourceId=${selectedSource?.id}&videoId=${video.vod_id}&returnUrl=${encodeURIComponent(`/tvbox?${searchParams.toString()}`)}&coverPic=${encodeURIComponent(video.vod_pic || '')}&videoName=${encodeURIComponent(video.vod_name || '')}`}
                        className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/50 transition-all cursor-pointer group relative shadow-lg"
                      >
                        <div className="aspect-[2/3] relative overflow-hidden">
                          {video.vod_pic && !failedImages.has(video.vod_id) ? (
                            <img
                              src={video.vod_pic}
                              alt={video.vod_name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              onError={() => {
                                setFailedImages(prev => new Set(prev).add(video.vod_id));
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                              <Film className="w-12 h-12 text-gray-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-12 h-12 text-white" />
                          </div>
                          {video.vod_remarks && (
                            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                              {video.vod_remarks}
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="text-white text-sm font-medium line-clamp-2 group-hover:text-blue-300 transition-colors">
                            {video.vod_name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                            {video.vod_year && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {video.vod_year}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* 空状态 */}
                {!loading && videos.length === 0 && !error && (
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 border border-gray-700/50 text-center">
                    <p className="text-gray-400">暂无视频数据</p>
                  </div>
                )}

                {/* 分页 */}
                {!loading && totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 mb-8">
                    {renderPagination()}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default function TVBoxPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-white">加载中...</div></div>}>
      <TVBoxContent />
    </Suspense>
  );
}
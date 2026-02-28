'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ParticleBackground from '@/components/ParticleBackground';
import { Search } from 'lucide-react';
import PageTransition from '@/components/PageTransition';

interface VideoSource {
  id: string;
  name: string;
  key: string;
  apiUrl: string;
  enabled?: boolean;
}

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [videoSources, setVideoSources] = useState<VideoSource[] | undefined>(undefined);

  useEffect(() => {
    const stored = localStorage.getItem('videoSources');
    console.log('加载视频源:', stored);
    if (stored) {
      const sources = JSON.parse(stored);
      const enabledSources = sources.filter((s: VideoSource) => s.enabled !== false);
      console.log('解析后的视频源:', sources);
      console.log('已启用的视频源:', enabledSources);
      setVideoSources(enabledSources);
    } else {
      setVideoSources([]);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen relative">
        <div className="absolute inset-0" style={{background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', zIndex: 0}}></div>
        <div className="absolute inset-0" style={{zIndex: 1}}>
          <ParticleBackground />
        </div>
        
        <div className="relative" style={{zIndex: 10}}>
          <header className="min-h-[calc(25vh+3.5rem)] flex items-center justify-center px-4 sm:px-6 pt-14 sm:pt-16">
            <div className="w-full max-w-2xl px-2 sm:px-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索视频..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyDown}
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
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-6 pb-8">
            {videoSources !== undefined && videoSources.length === 0 && (
              <div className="max-w-2xl mx-auto mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                <p className="text-yellow-400 text-center">请先在设置中配置并启用视频源</p>
              </div>
            )}
            
            {videoSources !== undefined && videoSources.length > 0 && (
              <div className="max-w-2xl mx-auto">
                {/* 主页上不显示任何视频源按钮 */}
              </div>
            )}
          </main>
        </div>
      </div>
    </PageTransition>
  );
}

'use client';

import Link from 'next/link';
import { Settings, Play, Film } from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-bold text-white">
              Long<span className="text-blue-400">TV</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Link 
              href="/player" 
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-700/50 transition-colors group"
              title="播放器"
            >
              <Play className="w-5 h-5 text-gray-300 group-hover:text-white transition-colors" />
            </Link>
            <Link 
              href="/api-videos" 
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-700/50 transition-colors group"
              title="API视频"
            >
              <Film className="w-5 h-5 text-gray-300 group-hover:text-white transition-colors" />
            </Link>
            <Link 
              href="/tvbox" 
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-700/50 transition-colors group"
              title="TVBox爬虫"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-300 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z"/>
              </svg>
            </Link>
          </div>
          
          <Link 
            href="/settings" 
            className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors group"
          >
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300 group-hover:text-white transition-colors" />
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

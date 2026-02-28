'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Plus, Trash2, Edit, X, Power, Server, Video, Globe } from 'lucide-react';
import Link from 'next/link';
import ParticleBackground from '@/components/ParticleBackground';
import PageTransition from '@/components/PageTransition';
import BackendManagement from '@/components/BackendManagement';

interface VideoSource {
  id: string;
  name: string;
  key: string;
  apiUrl: string;
  enabled?: boolean;
  proxyEnabled?: boolean;
  type?: 'normal' | 'tvbox';
}

interface ProxySettings {
  enabled: boolean;
  proxyUrl: string;
}

export default function SettingsPage() {
  const [selectedTab, setSelectedTab] = useState('video-sources');
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [proxySettings, setProxySettings] = useState<ProxySettings>({
    enabled: false,
    proxyUrl: ''
  });
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'success' | 'error' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<VideoSource | null>(null);
  const [formData, setFormData] = useState({ name: '', key: '', apiUrl: '', type: 'normal' as 'normal' | 'tvbox' });
  
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('videoSources');
    if (stored) {
      setVideoSources(JSON.parse(stored));
    }
    
    const proxyStored = localStorage.getItem('proxySettings');
    if (proxyStored) {
      setProxySettings(JSON.parse(proxyStored));
    }
    
    const tabStored = localStorage.getItem('settings_selectedTab');
    if (tabStored) {
      setSelectedTab(tabStored);
    }
  }, []);

  useEffect(() => {
    const updateIndicator = () => {
      const button = buttonRefs.current[selectedTab];
      const nav = navRef.current;
      if (button && nav) {
        const navRect = nav.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        setIndicatorStyle({
          left: buttonRect.left - navRect.left,
          width: buttonRect.width
        });
      }
    };
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [selectedTab]);

  useEffect(() => {
    localStorage.setItem('settings_selectedTab', selectedTab);
  }, [selectedTab]);

  const saveToLocalStorage = (sources: VideoSource[]) => {
    localStorage.setItem('videoSources', JSON.stringify(sources));
  };

  const saveProxySettings = (settings: ProxySettings) => {
    localStorage.setItem('proxySettings', JSON.stringify(settings));
    setProxySettings(settings);
  };

  // 检测代理状态
  const handleCheckProxyStatus = async () => {
    if (!proxySettings.enabled || !proxySettings.proxyUrl) {
      alert('请先启用代理并配置 Worker 地址');
      return;
    }

    setIsChecking(true);
    setCheckResult(null);

    try {
      // 测试 Worker 连通性
      const testUrl = `${proxySettings.proxyUrl.replace(/\/$/, '')}/https://httpbin.org/get`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setCheckResult('success');
        alert('Cloudflare Worker 代理连接正常');
      } else {
        setCheckResult('error');
        alert(`代理连接失败: HTTP ${response.status}`);
      }
    } catch (error) {
      setCheckResult('error');
      const message = error instanceof Error ? error.message : '未知错误';
      alert(`代理连接失败: ${message}`);
    } finally {
      setIsChecking(false);
    }
  };

  // 保存代理配置
  const handleSaveProxySettings = () => {
    if (proxySettings.enabled && !proxySettings.proxyUrl) {
      alert('请配置 Worker 地址');
      return;
    }

    if (proxySettings.enabled && proxySettings.proxyUrl) {
      try {
        new URL(proxySettings.proxyUrl);
      } catch {
        alert('Worker 地址格式不正确');
        return;
      }
    }

    saveProxySettings({
      enabled: proxySettings.enabled,
      proxyUrl: proxySettings.proxyUrl?.trim() || '',
    });

    alert('代理配置已保存');
  };

  const handleAddClick = () => {
    setEditingSource(null);
    setFormData({ name: '', key: '', apiUrl: '', type: 'normal' });
    setShowModal(true);
  };

  const handleEditClick = (source: VideoSource) => {
    setEditingSource(source);
    setFormData({ 
      name: source.name, 
      key: source.key, 
      apiUrl: source.apiUrl,
      type: source.type || 'normal'
    });
    setShowModal(true);
  };

  const handleDeleteClick = (id: string) => {
    const newSources = videoSources.filter(s => s.id !== id);
    setVideoSources(newSources);
    saveToLocalStorage(newSources);
  };

  const handleToggleEnabled = (id: string) => {
    const newSources = videoSources.map(s => 
      s.id === id 
        ? { ...s, enabled: s.enabled === undefined ? false : !s.enabled }
        : s
    );
    setVideoSources(newSources);
    saveToLocalStorage(newSources);
  };

  const handleToggleAllEnabled = (enabled: boolean) => {
    const newSources = videoSources.map(s => ({ ...s, enabled }));
    setVideoSources(newSources);
    saveToLocalStorage(newSources);
  };

  const handleToggleProxy = (id: string) => {
    const newSources = videoSources.map(s => 
      s.id === id 
        ? { ...s, proxyEnabled: s.proxyEnabled === false ? undefined : false }
        : s
    );
    setVideoSources(newSources);
    saveToLocalStorage(newSources);
  };

  const allEnabled = videoSources.filter(source => !source.type || source.type === 'normal').every(s => s.enabled !== false);
  const hasSources = videoSources.filter(source => !source.type || source.type === 'normal').length > 0;

  const handleSave = () => {
    if (!formData.name || !formData.key || !formData.apiUrl) {
      alert('请填写所有字段');
      return;
    }

    if (editingSource) {
      const newSources = videoSources.map(s => 
        s.id === editingSource.id 
          ? { ...s, name: formData.name, key: formData.key, apiUrl: formData.apiUrl, type: formData.type }
          : s
      );
      setVideoSources(newSources);
      saveToLocalStorage(newSources);
    } else {
      const newSource: VideoSource = {
        id: Date.now().toString(),
        name: formData.name,
        key: formData.key,
        apiUrl: formData.apiUrl,
        type: formData.type
      };
      const newSources = [...videoSources, newSource];
      setVideoSources(newSources);
      saveToLocalStorage(newSources);
    }

    setShowModal(false);
    setFormData({ name: '', key: '', apiUrl: '', type: 'normal' });
    setEditingSource(null);
  };

  const navItems = [
    { id: 'video-sources', label: '视频源配置', icon: Video },
    { id: 'proxy-settings', label: '代理设置', icon: Globe },
    { id: 'backend-management', label: '后台管理', icon: Server },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen relative">
        <div className="absolute inset-0" style={{background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', zIndex: 0}}></div>
        <div className="absolute inset-0" style={{zIndex: 1}}>
          <ParticleBackground />
        </div>
        
        <div className="relative" style={{zIndex: 10}}>
          <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between mb-8 gap-4">
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                设置
              </h1>
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
                返回首页
              </Link>
            </div>
            
            <div className="flex flex-col gap-6">
              <nav 
                ref={navRef}
                className="relative flex justify-center p-1.5 bg-gray-800/50 backdrop-blur-sm rounded-full border border-gray-700/50"
              >
                <div 
                  className="absolute top-1.5 h-[calc(100%-12px)] bg-blue-500 rounded-full shadow-lg shadow-blue-500/30 transition-all duration-300 ease-out"
                  style={{
                    left: `${indicatorStyle.left}px`,
                    width: `${indicatorStyle.width}px`
                  }}
                />
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    ref={(el) => { buttonRefs.current[item.id] = el; }}
                    onClick={() => setSelectedTab(item.id)}
                    className={`relative z-10 flex-1 sm:flex-none px-3 sm:px-6 py-2.5 rounded-full flex items-center justify-center sm:justify-start gap-2 transition-colors duration-200 ${
                      selectedTab === item.id 
                        ? 'text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-5 h-5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>
              
              <main className="flex-1">
                {selectedTab === 'video-sources' && (
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <h2 className="text-xl font-semibold text-white mb-6">视频源配置</h2>
                    
                    {/* 普通API部分 */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          普通API
                        </h3>
                        <div className="flex items-center gap-3">
                          {hasSources && (
                            <button
                              onClick={() => handleToggleAllEnabled(!allEnabled)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                allEnabled
                                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                              {allEnabled ? '全部禁用' : '全部启用'}
                            </button>
                          )}
                          <button 
                            onClick={handleAddClick}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            添加源
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {videoSources
                          .filter(source => !source.type || source.type === 'normal')
                          .map((source) => (
                            <div 
                              key={source.id}
                              className={`flex items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all shadow-lg ${
                                source.enabled === false ? 'opacity-50' : ''
                              }`}
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-white font-medium truncate">{source.name}</h3>
                                  <p className="text-gray-400 text-sm truncate">Key: {source.key}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <button
                                  onClick={() => handleToggleProxy(source.id)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    source.proxyEnabled === false
                                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                      : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                  }`}
                                  title={source.proxyEnabled === false ? '代理已关闭' : '代理已开启'}
                                >
                                  <Globe className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleEnabled(source.id)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    source.enabled === false
                                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                  }`}
                                  title={source.enabled === false ? '已禁用' : '已启用'}
                                >
                                  <Power className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleEditClick(source)}
                                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/50 rounded-lg transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteClick(source.id)}
                                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                      
                      {videoSources.filter(source => !source.type || source.type === 'normal').length === 0 && (
                        <div className="text-center py-6 text-gray-400 text-sm">
                          暂无普通API源
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-blue-400 text-sm">
                        💡 TVBox爬虫已改为自动从后端加载，无需手动配置。请在「后台管理」中添加爬虫。
                      </p>
                    </div>
                  </div>
                )}

                {selectedTab === 'proxy-settings' && (
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <h2 className="text-xl font-semibold text-white mb-6">Cloudflare Worker 代理加速</h2>
                    
                    <div className="space-y-6">
                      {/* 启用代理开关 */}
                      <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
                        <div className="flex-1">
                          <h3 className="text-white font-medium mb-1">启用代理</h3>
                          <p className="text-gray-400 text-sm">开启后所有API请求将通过Cloudflare Worker转发</p>
                        </div>
                        <button
                          onClick={() => saveProxySettings({ ...proxySettings, enabled: !proxySettings.enabled })}
                          className={`relative w-14 h-8 rounded-full transition-colors duration-300 focus:outline-none ${
                            proxySettings.enabled
                              ? 'bg-green-500'
                              : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                              proxySettings.enabled
                                ? 'translate-x-6'
                                : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Worker地址配置 */}
                      {proxySettings.enabled && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Cloudflare Worker 地址</label>
                            <input
                              type="text"
                              value={proxySettings.proxyUrl}
                              onChange={(e) => setProxySettings({ ...proxySettings, proxyUrl: e.target.value })}
                              placeholder="https://your-worker.workers.dev"
                              className="w-full px-4 py-3 bg-gray-700/50 text-white placeholder-gray-500 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>

                          {/* 检测状态 */}
                          {checkResult && (
                            <div className={`flex items-center gap-2 rounded-lg p-3 ${
                              checkResult === 'success'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {checkResult === 'success' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              <span className="text-sm">
                                {checkResult === 'success' ? '代理连接正常' : '代理连接失败'}
                              </span>
                            </div>
                          )}

                          {/* 操作按钮 */}
                          <div className="flex gap-3">
                            <button
                              onClick={handleCheckProxyStatus}
                              disabled={isChecking}
                              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                              </svg>
                              {isChecking ? '检测中...' : '检测代理状态'}
                            </button>
                            <button
                              onClick={handleSaveProxySettings}
                              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              保存配置
                            </button>
                          </div>

                          {/* 功能说明 */}
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <h4 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              功能说明
                            </h4>
                            <ul className="text-gray-300 text-sm space-y-1">
                              <li>• 通过 Cloudflare 全球 CDN 加速视频源 API 访问</li>
                              <li>• 全局模式：为所有视频源统一使用此 Worker 代理</li>
                              <li>• 单独控制：可在视频源卡片中单独关闭某个源的代理</li>
                              <li>• 优先级：视频源单独开关 {'>'} 全局配置</li>
                            </ul>
                          </div>

                          {/* 自定义部署说明 */}
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                            <h4 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              自定义部署
                            </h4>
                            <p className="text-gray-300 text-sm">
                              如需自定义部署 Worker 服务，请参考：
                              <a
                                href="https://github.com/SzeMeng76/CORSAPI"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline ml-1 inline-flex items-center gap-1"
                              >
                                CORSAPI 项目
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </p>
                          </div>
                        </>
                      )}

                      {/* 未启用提示 */}
                      {!proxySettings.enabled && (
                        <div className="text-center py-8 text-gray-400">
                          <svg className="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                          </svg>
                          <p className="text-sm">全局代理加速未启用</p>
                          <p className="text-xs mt-1 text-gray-500">开启后将为所有视频源使用 Cloudflare Worker 加速</p>
                          <p className="text-xs mt-1 text-gray-500">也可在视频源管理中为单个源配置代理</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedTab === 'backend-management' && (
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <BackendManagement />
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
            <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl font-semibold text-white mb-6">
                {editingSource ? '编辑视频源' : '添加视频源'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">名称</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="输入视频源名称"
                    className="w-full px-4 py-3 bg-gray-700/50 text-white placeholder-gray-500 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Key （普通API和爬虫API唯一标识）</label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({...formData, key: e.target.value})}
                    placeholder="输入API唯一标识"
                    className="w-full px-4 py-3 bg-gray-700/50 text-white placeholder-gray-500 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">API地址</label>
                  <input
                    type="text"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData({...formData, apiUrl: e.target.value})}
                    placeholder="输入远程视频源API地址"
                    className="w-full px-4 py-3 bg-gray-700/50 text-white placeholder-gray-500 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Copy, Trash2, Server, Link, ExternalLink, Edit2, X } from 'lucide-react';

interface SpiderInfo {
  key: string;
  name?: string;
  script_url?: string;
  type: 'local' | 'remote';
}

const DEFAULT_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

const getBackendUrl = (): string => {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  if (typeof window !== 'undefined') {
    const savedUrl = localStorage.getItem('backend_url');
    if (savedUrl) {
      return savedUrl;
    }
  }
  return DEFAULT_BACKEND_URL;
};

export default function BackendManagement() {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [spiders, setSpiders] = useState<SpiderInfo[]>([]);
  const [newSpiderKey, setNewSpiderKey] = useState('');
  const [newSpiderName, setNewSpiderName] = useState('');
  const [newSpiderUrl, setNewSpiderUrl] = useState('');
  const [uploadSpiderKey, setUploadSpiderKey] = useState('');
  const [uploadSpiderName, setUploadSpiderName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [editingSpider, setEditingSpider] = useState<SpiderInfo | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editName, setEditName] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  const normalizeUrl = (url: string): string => {
    return url.replace(/localhost/g, '127.0.0.1');
  };

  useEffect(() => {
    const envBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (envBackendUrl) {
      const normalizedUrl = normalizeUrl(envBackendUrl);
      setBackendUrl(normalizedUrl);
      checkConnection(normalizedUrl);
    } else {
      const savedUrl = localStorage.getItem('backend_url');
      if (savedUrl) {
        const normalizedUrl = normalizeUrl(savedUrl);
        setBackendUrl(normalizedUrl);
        checkConnection(normalizedUrl);
      }
    }
    fetchSpiders();
  }, []);

  const checkConnection = async (url: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${url}/health`, { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setBackendConnected(response.ok);
    } catch (error) {
      setBackendConnected(false);
    }
  };

  const saveBackendUrl = () => {
    const normalizedUrl = normalizeUrl(backendUrl);
    localStorage.setItem('backend_url', normalizedUrl);
    setBackendUrl(normalizedUrl);
    alert('后台地址已保存');
    checkConnection(normalizedUrl);
    fetchSpiders();
  };

  const fetchSpiders = async () => {
    const envBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const url = normalizeUrl(getBackendUrl());
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${url}/api/spiders`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log('后端返回数据:', data);
        // 转换后端返回的数据格式以匹配组件期望的格式
        const convertedSpiders = data.data?.map((spider: any) => ({
          key: spider.key,
          name: spider.name,
          type: spider.type || 'remote'
        })) || [];
        setSpiders(convertedSpiders);
      } else {
        console.error('获取爬虫列表失败:', response.status, response.statusText);
        alert(`获取爬虫列表失败: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('获取爬虫列表失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      alert(`获取爬虫列表失败: ${errorMsg}`);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    const normalizedUrl = normalizeUrl(backendUrl);
    setBackendUrl(normalizedUrl);
    try {
      console.log('测试连接到:', normalizedUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${normalizedUrl}/health`, { 
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('连接响应:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('健康检查响应:', data);
        setBackendConnected(true);
        alert('连接成功');
        localStorage.setItem('backend_url', normalizedUrl);
        await fetchSpidersWithUrl(normalizedUrl);
      } else {
        setBackendConnected(false);
        alert('连接失败: ' + response.status + ' ' + response.statusText);
      }
    } catch (error) {
      console.error('连接测试失败:', error);
      setBackendConnected(false);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      alert('连接失败: ' + errorMsg);
    } finally {
      setTestingConnection(false);
    }
  };

  const fetchSpidersWithUrl = async (url: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${url}/api/spiders`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log('后端返回数据:', data);
        // 转换后端返回的数据格式以匹配组件期望的格式
        const convertedSpiders = data.data?.map((spider: any) => ({
          key: spider.key,
          name: spider.name,
          type: spider.type || 'remote'
        })) || [];
        setSpiders(convertedSpiders);
      } else {
        console.error('获取爬虫列表失败:', response.status, response.statusText);
        alert(`获取爬虫列表失败: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('获取爬虫列表失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      alert(`获取爬虫列表失败: ${errorMsg}`);
    }
  };

  const addSpider = async () => {
    if (!newSpiderKey || !newSpiderUrl) {
      alert('请填写爬虫ID和脚本URL');
      return;
    }

    setLoading(true);
    const url = normalizeUrl(getBackendUrl());
    try {
      const response = await fetch(`${url}/api/add-python-spider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: newSpiderKey, 
          script_url: newSpiderUrl,
          name: newSpiderName || null
        }),
        signal: AbortSignal.timeout(120000)
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`爬虫 ${newSpiderName || newSpiderKey} 添加成功`);
        setNewSpiderKey('');
        setNewSpiderName('');
        setNewSpiderUrl('');
        fetchSpiders();
      } else {
        alert(result.detail || '添加失败');
      }
    } catch (error) {
      alert('添加失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const removeSpider = async (key: string) => {
    const url = normalizeUrl(getBackendUrl());
    try {
      const response = await fetch(`${url}/api/spiders/${key}`, { method: 'DELETE' });
      if (response.ok) {
        alert(`爬虫 ${key} 已移除`);
        fetchSpiders();
      } else {
        alert('移除失败');
      }
    } catch (error) {
      alert('移除失败');
    }
  };

  const uploadSpider = async () => {
    if (!uploadSpiderKey || !uploadFile) {
      alert('请填写爬虫ID并选择文件');
      return;
    }

    if (!uploadFile.name.endsWith('.py')) {
      alert('请选择 Python 脚本文件 (.py)');
      return;
    }

    setUploading(true);
    const url = normalizeUrl(getBackendUrl());
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      
      let uploadUrl = `${url}/api/spiders/upload?key=${uploadSpiderKey}`;
      if (uploadSpiderName) {
        uploadUrl += `&name=${encodeURIComponent(uploadSpiderName)}`;
      }
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`爬虫 ${uploadSpiderName || uploadSpiderKey} 上传并加载成功`);
        setUploadSpiderKey('');
        setUploadSpiderName('');
        setUploadFile(null);
        fetchSpiders();
      } else {
        alert(result.detail || '上传失败');
      }
    } catch (error) {
      alert('上传失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = (key: string) => {
    const url = normalizeUrl(getBackendUrl());
    const spiderUrl = `${url}/api/spider/${key}`;
    navigator.clipboard.writeText(spiderUrl);
    alert('URL已复制');
  };

  const getSpiderUrl = (key: string) => {
    const url = normalizeUrl(getBackendUrl());
    return `${url}/api/spider/${key}`;
  };

  const openEditModal = (spider: SpiderInfo) => {
    setEditingSpider(spider);
    setEditKey(spider.key);
    setEditName(spider.name || '');
    setShowEditModal(true);
  };

  const updateSpider = async () => {
    if (!editingSpider) return;
    
    const url = normalizeUrl(getBackendUrl());
    try {
      const response = await fetch(`${url}/api/spiders/${editingSpider.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_key: editKey !== editingSpider.key ? editKey : null,
          new_name: editName || null
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        alert('爬虫信息已更新');
        setShowEditModal(false);
        setEditingSpider(null);
        fetchSpiders();
      } else {
        alert(result.detail || '更新失败');
      }
    } catch (error) {
      alert('更新失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-blue-400" />
          后台服务配置
        </h3>
        
        <div className={`rounded-lg p-4 border ${
          backendConnected 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              backendConnected 
                ? 'bg-green-500 animate-pulse' 
                : 'bg-red-500'
            }`}></div>
            <div>
              <p className={`font-medium ${
                backendConnected 
                  ? 'text-green-400' 
                  : 'text-red-400'
              }`}>
                {backendConnected ? '✓ 成功连接后端' : '✗ 未连接后端'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {backendConnected 
                  ? `当前连接: ${backendUrl}` 
                  : '后端服务不可用，请检查网络或联系管理员'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-5 h-5 text-orange-500">📁</span>
          上传本地Python脚本
        </h3>
        
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                爬虫Key
              </label>
              <input
                value={uploadSpiderKey}
                onChange={(e) => setUploadSpiderKey(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="例如: wawa, xiaohong"
                className="w-full px-4 py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                显示名称
              </label>
              <input
                value={uploadSpiderName}
                onChange={(e) => setUploadSpiderName(e.target.value)}
                placeholder="例如: 哇哇影视, 小红资源"
                className="w-full px-4 py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Python脚本文件
              </label>
              <input
                type="file"
                accept=".py"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFile(file);
                  }
                }}
                className="w-full px-4 py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              {uploadFile && (
                <p className="mt-1 text-xs text-gray-400">
                  已选择: {uploadFile.name}
                </p>
              )}
            </div>
          </div>
          
          <button 
            onClick={uploadSpider} 
            disabled={uploading || !uploadSpiderKey || !uploadFile}
            className="w-full md:w-auto px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <>
                <RefreshCw size={16} className="animate-spin mr-2" />
                上传中...
              </>
            ) : '上传脚本'}
          </button>
        </div>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-5 h-5 text-green-500">+</span>
          添加远程爬虫脚本
        </h3>
        
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                爬虫Key
              </label>
              <input
                value={newSpiderKey}
                onChange={(e) => setNewSpiderKey(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="例如: wawa, xiaohong"
                className="w-full px-4 py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                显示名称
              </label>
              <input
                value={newSpiderName}
                onChange={(e) => setNewSpiderName(e.target.value)}
                placeholder="例如: 哇哇影视, 小红资源"
                className="w-full px-4 py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                脚本URL
              </label>
              <input
                value={newSpiderUrl}
                onChange={(e) => setNewSpiderUrl(e.target.value)}
                placeholder="https://example.com/spider.py"
                className="w-full px-4 py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <button 
            onClick={addSpider} 
            disabled={loading || !newSpiderKey || !newSpiderUrl}
            className="w-full md:w-auto px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin mr-2" />
                加载中...
              </>
            ) : '加载脚本'}
          </button>
        </div>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="w-5 h-5 text-purple-500">⚙️</span>
            已加载爬虫 ({spiders.length})
          </h3>
          <button 
            onClick={fetchSpiders} 
            className="text-gray-400 hover:text-white p-2"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {spiders.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            暂无爬虫，请先添加
          </p>
        ) : (
          <div className="space-y-3">
            {spiders.map((spider) => (
              <div
                key={spider.key}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-gray-700/30 p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      spider.type === 'local' 
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {spider.type === 'local' ? '本地' : '远程'}
                    </span>
                    <span className="text-white font-medium">{spider.name || spider.key}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Link size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500 flex-shrink-0">API：</span>
                    <code className="truncate text-xs text-gray-400">
                      {getSpiderUrl(spider.key)}
                    </code>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => openEditModal(spider)}
                    className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
                    title="编辑"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => copyUrl(spider.key)}
                    className="p-2 rounded-lg bg-gray-600/50 hover:bg-gray-600 text-gray-300"
                    title="复制URL"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => removeSpider(spider.key)}
                    className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400"
                    title="删除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-5 h-5 text-orange-500">ℹ️</span>
          使用说明
        </h3>
        
        <div className="space-y-3 text-sm text-gray-300">
          <p>1. 配置后台服务地址并保存</p>
          <p>2. 添加远程Python爬虫脚本（支持TVBox Spider格式）</p>
          <p>3. 爬虫会自动加载到TVBox页面，无需手动配置</p>
          
          <div className="mt-4 rounded-lg bg-orange-500/10 p-3">
            <p className="font-medium text-orange-400">注意事项：</p>
            <ul className="mt-2 space-y-1 text-orange-300">
              <li>• 脚本必须符合 TVBox Spider 格式规范</li>
              <li>• 必须实现所有抽象方法：init, homeContent, homeVideoContent, categoryContent, detailContent, searchContent, playerContent</li>
              <li>• 正确的导入语句：from app.base.spider import Spider</li>
              <li>• 上传后会自动加载并测试脚本</li>
            </ul>
          </div>
        </div>
      </div>

      {showEditModal && editingSpider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">编辑爬虫</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  爬虫Key
                </label>
                <input
                  value={editKey}
                  onChange={(e) => setEditKey(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="例如: wawa, xiaohong"
                  className="w-full px-4 py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  显示名称
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="例如: 哇哇影视, 小红资源"
                  className="w-full px-4 py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={updateSpider}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
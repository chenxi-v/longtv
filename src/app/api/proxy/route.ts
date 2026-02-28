import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const apiUrl = searchParams.get('apiUrl');
  const wd = searchParams.get('wd');
  const pg = searchParams.get('pg');
  const ac = searchParams.get('ac');
  const ids = searchParams.get('ids');
  const t = searchParams.get('t');
  const act = searchParams.get('act');
  const extend = searchParams.get('extend');
  const flag = searchParams.get('flag');
  const proxyUrl = searchParams.get('proxyUrl');

  if (!apiUrl) {
    return NextResponse.json({ error: '缺少API地址' }, { status: 400 });
  }

  try {
    const url = new URL(apiUrl);
    
    if (wd) url.searchParams.set('wd', wd);
    if (pg) url.searchParams.set('pg', pg);
    if (ac) url.searchParams.set('ac', ac);
    if (ids) url.searchParams.set('ids', ids);
    if (t) url.searchParams.set('t', t);
    if (act) url.searchParams.set('act', act);
    if (extend) url.searchParams.set('extend', extend);
    if (flag) url.searchParams.set('flag', flag);
    
    let targetUrl = url.toString();

    // 如果提供了Cloudflare Worker代理地址，则通过代理访问
    if (proxyUrl) {
      const workerUrl = proxyUrl.replace(/\/$/, '');
      targetUrl = `${workerUrl}/?url=${encodeURIComponent(targetUrl)}`;
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API代理错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '请求失败' },
      { status: 500 }
    );
  }
}

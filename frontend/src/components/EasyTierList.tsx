import { useEffect, useState, useCallback } from 'react';
import { Text } from '@radix-ui/themes';
import { AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';

// EasyTier peer list (透传 us.bwg 中心节点 et-wrap 服务)
export type EtPeer = {
  cidr?: string;
  ipv4?: string;
  hostname?: string;
  cost?: string;
  lat_ms?: string;
  loss_rate?: string;
  rx_bytes?: string;
  tx_bytes?: string;
  tunnel_proto?: string;
  nat_type?: string;
  id?: string;
  version?: string;
};

type EtNodesResponse = { peers?: EtPeer[] };

const REFRESH_MS = 15_000;

function isLocal(p: EtPeer): boolean {
  return p.cost === 'Local';
}

function fmtNum(v?: string): string {
  if (v === undefined || v === null || v === '-' || v === '') return '-';
  return v;
}

// 字节数转 MB(参考站风格: 显示 0.00 MB)
function fmtBytes(v?: string): string {
  const raw = fmtNum(v);
  if (raw === '-') return '0.00';
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  if (n >= 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(2);
  return (n / 1024 / 1024).toFixed(2);
}

// 状态: 本机=primary, 直连=success, 高延迟/丢包=warn/loss
function statusOf(p: EtPeer): { label: string; cls: string } {
  if (isLocal(p)) return { label: '本机', cls: 'et-badge-primary' };
  const loss = parseFloat(p.loss_rate || '0');
  const lat = parseFloat(p.lat_ms || '0');
  if (loss > 0) return { label: '丢包', cls: 'et-badge-loss' };
  if (lat > 0 && lat < 200) return { label: '直连', cls: 'et-badge-good' };
  if (lat >= 200) return { label: '高延迟', cls: 'et-badge-warn' };
  return { label: '在线', cls: 'et-badge-good' };
}

// 延迟颜色阈值(参考站: >=200 红色)
function latCls(lat?: string): string {
  const n = parseFloat(lat || '0');
  if (!n || n <= 0) return 'et-lat-muted';
  if (n >= 200) return 'et-lat-bad';
  if (n >= 100) return 'et-lat-warn';
  return 'et-lat-good';
}

export default function EasyTierList() {
  const [peers, setPeers] = useState<EtPeer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/et/nodes', { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${txt ? `: ${txt.slice(0, 120)}` : ''}`);
      }
      const data = (await res.json()) as EtNodesResponse;
      const list = Array.isArray(data?.peers) ? data.peers : [];
      // 本机节点置顶
      list.sort((a, b) => {
        const la = isLocal(a) ? 0 : 1;
        const lb = isLocal(b) ? 0 : 1;
        if (la !== lb) return la - lb;
        return (a.hostname || '').localeCompare(b.hostname || '');
      });
      setPeers(list);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const updatedText = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('zh-CN', { hour12: false })
    : '-';

  const COLS = 6;

  return (
    <section className="et-monitor-shell">
      <header className="et-monitor-head">
        <Text size="4" weight="bold">EasyTier 节点列表</Text>
        <Text size="1" color="gray">
          自动刷新 {REFRESH_MS / 1000}s · 更新于 {updatedText} · 在线 {peers.length} 个节点
        </Text>
      </header>

      {error && (
        <div className="et-monitor-error">
          <AlertTriangle size={16} />
          <Text size="2">数据加载失败：{error}</Text>
        </div>
      )}

      <div className="et-table-wrap">
        <table className="et-table">
          <thead>
            <tr>
              <th>状态</th>
              <th>主机名</th>
              <th>虚拟 IP</th>
              <th className="et-cell-num">延迟 (ms)</th>
              <th className="et-cell-num">接收 / 发送 (MB)</th>
              <th>隧道协议</th>
            </tr>
          </thead>
          <tbody>
            {peers.map((p, idx) => {
              const st = statusOf(p);
              const lat = fmtNum(p.lat_ms);
              return (
                <tr key={p.id || p.ipv4 || idx} className={isLocal(p) ? 'et-row-local' : ''}>
                  <td><span className={`et-badge ${st.cls}`}>{st.label}</span></td>
                  <td className="et-cell-host">{fmtNum(p.hostname)}</td>
                  <td><code className="et-ip">{fmtNum(p.ipv4)}</code></td>
                  <td className="et-cell-num"><span className={`et-lat ${latCls(p.lat_ms)}`}>{lat}</span></td>
                  <td className="et-cell-num">
                    <div className="et-traffic">
                      <span className="et-traffic-rx"><ArrowDown size={12} />{fmtBytes(p.rx_bytes)}</span>
                      <span className="et-traffic-tx"><ArrowUp size={12} />{fmtBytes(p.tx_bytes)}</span>
                    </div>
                  </td>
                  <td><span className="et-tunnel">{fmtNum(p.tunnel_proto)}</span></td>
                </tr>
              );
            })}
            {peers.length === 0 && !loading && (
              <tr>
                <td colSpan={COLS} className="et-empty">暂无节点数据</td>
              </tr>
            )}
            {loading && peers.length === 0 && (
              <tr>
                <td colSpan={COLS} className="et-empty">加载中…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

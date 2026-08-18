import { useEffect, useState, useCallback } from 'react';
import { Text } from '@radix-ui/themes';
import { AlertTriangle } from 'lucide-react';

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

function statusOf(p: EtPeer): { label: string; cls: string } {
  if (isLocal(p)) return { label: '本机', cls: 'et-status-local' };
  const loss = parseFloat(p.loss_rate || '0');
  const lat = parseFloat(p.lat_ms || '0');
  if (loss > 0) return { label: '丢包', cls: 'et-status-loss' };
  if (lat > 0 && lat < 200) return { label: '良好', cls: 'et-status-good' };
  if (lat >= 200) return { label: '高延迟', cls: 'et-status-warn' };
  return { label: '在线', cls: 'et-status-ok' };
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

  return (
    <section className="website-monitor-shell et-monitor-shell">
      <header className="et-monitor-head">
        <Text size="4" weight="bold">EasyTier 节点列表</Text>
        <Text size="1" color="gray">自动刷新 {REFRESH_MS / 1000}s · 更新于 {updatedText} · 共 {peers.length} 个节点</Text>
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
              <th>IPv4</th>
              <th>CIDR</th>
              <th>成本</th>
              <th>延迟</th>
              <th>丢包率</th>
              <th>下行</th>
              <th>上行</th>
              <th>隧道</th>
              <th>NAT</th>
              <th>版本</th>
            </tr>
          </thead>
          <tbody>
            {peers.map((p, idx) => {
              const st = statusOf(p);
              return (
                <tr key={p.id || p.ipv4 || idx} className={isLocal(p) ? 'et-row-local' : ''}>
                  <td><span className={`et-status ${st.cls}`}>{st.label}</span></td>
                  <td className="et-cell-host">{fmtNum(p.hostname)}</td>
                  <td><code>{fmtNum(p.ipv4)}</code></td>
                  <td className="et-cell-muted">{fmtNum(p.cidr)}</td>
                  <td>{fmtNum(p.cost)}</td>
                  <td className="et-cell-num">{fmtNum(p.lat_ms)}</td>
                  <td className="et-cell-num">{fmtNum(p.loss_rate)}</td>
                  <td className="et-cell-num">{fmtNum(p.rx_bytes)}</td>
                  <td className="et-cell-num">{fmtNum(p.tx_bytes)}</td>
                  <td className="et-cell-muted">{fmtNum(p.tunnel_proto)}</td>
                  <td className="et-cell-muted">{fmtNum(p.nat_type)}</td>
                  <td className="et-cell-muted">{fmtNum(p.version)}</td>
                </tr>
              );
            })}
            {peers.length === 0 && !loading && (
              <tr>
                <td colSpan={12} className="et-empty">暂无节点数据</td>
              </tr>
            )}
            {loading && peers.length === 0 && (
              <tr>
                <td colSpan={12} className="et-empty">加载中…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

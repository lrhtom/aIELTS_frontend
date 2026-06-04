import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { apiClient as api } from '../../api/client';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Coins, Banknote, ArrowRightLeft, ArrowUpRight, ArrowDownRight, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface FinanceStats {
  total_at_used: number;
  total_cny_used: number;
  daily_usage: Array<{
    date: string;
    at_used: number;
    cny_used: number;
  }>;
}

interface Transaction {
  id: number;
  currency: 'AT_COIN' | 'CNY';
  amount: string;
  balance_after: string;
  description: string;
  created_at: string;
}

export default function UserFinance() {
  const { translations: t } = useLang();
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [currencyType, setCurrencyType] = useState<'AT_COIN' | 'CNY'>('AT_COIN');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchTransactions(page);
  }, [page]);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await api.get('/finance/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch finance stats', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchTransactions = async (p: number) => {
    try {
      setLoadingTxns(true);
      const res = await api.get(`/finance/transactions?page=${p}`);
      setTransactions(res.data.results);
      setTotalPages(Math.ceil(res.data.count / 20) || 1);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    } finally {
      setLoadingTxns(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  return (
    <div className="profile-tab-pane">
      <div className="profile-tab-header">
        <h2 className="profile-tab-title">财政分析 (Financial Analysis)</h2>
        <p className="profile-tab-subtitle">查看你的代币与现金消费流水及统计图表</p>
      </div>

      {loadingStats ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : stats ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div style={{ 
              background: 'var(--color-bg-elevated)', borderRadius: '12px', padding: '24px',
              border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '16px'
            }}>
              <div style={{ padding: '16px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '50%', color: '#eab308' }}>
                <Coins size={32} />
              </div>
              <div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>累计消耗 AT 币</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text)' }}>
                  {stats.total_at_used.toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ 
              background: 'var(--color-bg-elevated)', borderRadius: '12px', padding: '24px',
              border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '16px'
            }}>
              <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', color: '#22c55e' }}>
                <Banknote size={32} />
              </div>
              <div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>累计消耗现金 (CNY)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text)' }}>
                  ¥{stats.total_cny_used.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div style={{ 
            background: 'var(--color-bg-elevated)', borderRadius: '12px', padding: '24px',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--color-text)' }}>每日消费趋势</h3>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: '8px', padding: '4px', border: '1px solid var(--color-border)' }}>
                  <button 
                    onClick={() => setCurrencyType('AT_COIN')}
                    style={{ 
                      padding: '6px 12px', borderRadius: '4px', fontSize: '14px',
                      background: currencyType === 'AT_COIN' ? 'var(--color-primary)' : 'transparent',
                      color: currencyType === 'AT_COIN' ? 'white' : 'var(--color-text)',
                      border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    AT 币
                  </button>
                  <button 
                    onClick={() => setCurrencyType('CNY')}
                    style={{ 
                      padding: '6px 12px', borderRadius: '4px', fontSize: '14px',
                      background: currencyType === 'CNY' ? 'var(--color-primary)' : 'transparent',
                      color: currencyType === 'CNY' ? 'white' : 'var(--color-text)',
                      border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    现金 (CNY)
                  </button>
                </div>
                
                <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: '8px', padding: '4px', border: '1px solid var(--color-border)' }}>
                  <button 
                    onClick={() => setChartType('bar')}
                    style={{ 
                      padding: '6px 12px', borderRadius: '4px', fontSize: '14px',
                      background: chartType === 'bar' ? 'var(--color-text)' : 'transparent',
                      color: chartType === 'bar' ? 'var(--color-bg)' : 'var(--color-text)',
                      border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    柱状图
                  </button>
                  <button 
                    onClick={() => setChartType('line')}
                    style={{ 
                      padding: '6px 12px', borderRadius: '4px', fontSize: '14px',
                      background: chartType === 'line' ? 'var(--color-text)' : 'transparent',
                      color: chartType === 'line' ? 'var(--color-bg)' : 'var(--color-text)',
                      border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    折线图
                  </button>
                </div>
              </div>
            </div>

            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={stats.daily_usage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value.toLocaleString()} />
                    <Tooltip 
                      contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--color-text)' }}
                      formatter={(value: number) => [value.toLocaleString(), currencyType === 'AT_COIN' ? '消耗 AT 币' : '消耗现金']}
                      labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '8px' }}
                    />
                    <Bar dataKey={currencyType === 'AT_COIN' ? 'at_used' : 'cny_used'} fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                ) : (
                  <LineChart data={stats.daily_usage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value.toLocaleString()} />
                    <Tooltip 
                      contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--color-text)' }}
                      formatter={(value: number) => [value.toLocaleString(), currencyType === 'AT_COIN' ? '消耗 AT 币' : '消耗现金']}
                      labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '8px' }}
                    />
                    <Line type="monotone" dataKey={currencyType === 'AT_COIN' ? 'at_used' : 'cny_used'} stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-primary)' }} activeDot={{ r: 6 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px' }}>暂无数据</div>
      )}

      {/* Transactions Table */}
      <div style={{ 
        marginTop: '24px', background: 'var(--color-bg-elevated)', borderRadius: '12px',
        border: '1px solid var(--color-border)', overflow: 'hidden'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--color-text)' }}>
            <ArrowRightLeft size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
            交易流水明细
          </h3>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', fontSize: '13px', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px 24px', fontWeight: '600' }}>时间</th>
                <th style={{ padding: '16px 24px', fontWeight: '600' }}>描述</th>
                <th style={{ padding: '16px 24px', fontWeight: '600' }}>金额变动</th>
                <th style={{ padding: '16px 24px', fontWeight: '600' }}>变动后余额</th>
              </tr>
            </thead>
            <tbody>
              {loadingTxns ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>
                    <Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-text-secondary)', margin: '0 auto' }} />
                  </td>
                </tr>
              ) : transactions.length > 0 ? (
                transactions.map((txn) => {
                  const amountNum = parseFloat(txn.amount);
                  const isPositive = amountNum > 0;
                  return (
                    <tr key={txn.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '16px 24px', color: 'var(--color-text-secondary)', fontSize: '14px', whiteSpace: 'nowrap' }}>
                        {formatDate(txn.created_at)}
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--color-text)', fontSize: '14px' }}>
                        {txn.description}
                        <span style={{ 
                          marginLeft: '8px', fontSize: '12px', padding: '2px 6px', borderRadius: '4px',
                          background: txn.currency === 'AT_COIN' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                          color: txn.currency === 'AT_COIN' ? '#eab308' : '#22c55e'
                        }}>
                          {txn.currency === 'AT_COIN' ? 'AT币' : 'CNY'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isPositive ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)' }}>
                          {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                          {isPositive ? '+' : ''}{amountNum.toLocaleString()}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--color-text-secondary)', fontSize: '14px', whiteSpace: 'nowrap' }}>
                        {parseFloat(txn.balance_after).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
                    暂无流水记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--color-border)', gap: '16px' }}>
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px',
                background: page === 1 ? 'transparent' : 'var(--color-bg)',
                color: page === 1 ? 'var(--color-text-muted)' : 'var(--color-text)',
                border: '1px solid', borderColor: page === 1 ? 'transparent' : 'var(--color-border)',
                cursor: page === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
              }}
            >
              <ChevronLeft size={16} /> 上一页
            </button>
            
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              第 {page} / {totalPages} 页
            </span>
            
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px',
                background: page === totalPages ? 'transparent' : 'var(--color-bg)',
                color: page === totalPages ? 'var(--color-text-muted)' : 'var(--color-text)',
                border: '1px solid', borderColor: page === totalPages ? 'transparent' : 'var(--color-border)',
                cursor: page === totalPages ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
              }}
            >
              下一页 <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

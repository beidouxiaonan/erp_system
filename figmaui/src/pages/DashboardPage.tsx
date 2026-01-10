import { useState, useEffect } from 'react';
import { Download, RefreshCw, BarChart3 } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface DashboardData {
  total_orders: number;
  total_qa_entries: number;
  total_pkg_entries: number;
  qa_data: any[];
  pkg_data: any[];
}

interface BatchStats {
  批次号: string;
  合格数量: number;
  不合格数量: number;
  总产量: number;
  合格率: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'qa' | 'pkg' | 'analysis'>('qa');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.DASHBOARD_OVERVIEW);
      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 导出CSV
  const handleExport = (type: 'qa' | 'pkg') => {
    if (!data) return;
    
    const exportData = type === 'qa' ? data.qa_data : data.pkg_data;
    const filename = type === 'qa' ? '生产结算' : '包装绩效';
    
    if (exportData.length === 0) {
      alert('暂无数据可导出');
      return;
    }

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(h => {
          const value = row[h];
          if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
          return value ?? '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 计算质检统计
  const calculateQAStats = () => {
    if (!data || data.qa_data.length === 0) {
      return { totalQty: 0, settledAmount: 0, pendingAmount: 0 };
    }

    const totalQty = data.qa_data.reduce((sum, r) => sum + (r.合格数量 || 0), 0);
    const settledAmount = data.qa_data
      .filter(r => r.产品批次状态 === '已完结')
      .reduce((sum, r) => sum + (r.结算金额 || 0), 0);
    const pendingAmount = data.qa_data
      .filter(r => r.产品批次状态 !== '已完结')
      .reduce((sum, r) => sum + (r.结算金额 || 0), 0);

    return { totalQty, settledAmount, pendingAmount };
  };

  // 计算包装统计
  const calculatePKGStats = () => {
    if (!data || data.pkg_data.length === 0) {
      return { totalQty: 0, totalAmount: 0 };
    }

    const totalQty = data.pkg_data.reduce((sum, r) => sum + (r.数量 || 0), 0);
    const totalAmount = data.pkg_data.reduce((sum, r) => sum + (r.结算金额 || 0), 0);

    return { totalQty, totalAmount };
  };

  // 计算批次合格率统计
  const calculateBatchStats = (): BatchStats[] => {
    if (!data || data.qa_data.length === 0) return [];

    const batchMap = new Map<string, { 合格数量: number; 不合格数量: number }>();
    
    data.qa_data.forEach(r => {
      const batchNo = r.产品批次号 || 'unknown';
      const existing = batchMap.get(batchNo) || { 合格数量: 0, 不合格数量: 0 };
      batchMap.set(batchNo, {
        合格数量: existing.合格数量 + (r.合格数量 || 0),
        不合格数量: existing.不合格数量 + (r.不合格数量 || 0),
      });
    });

    return Array.from(batchMap.entries()).map(([batchNo, stats]) => {
      const total = stats.合格数量 + stats.不合格数量;
      return {
        批次号: batchNo,
        合格数量: stats.合格数量,
        不合格数量: stats.不合格数量,
        总产量: total,
        合格率: total > 0 ? (stats.合格数量 / total) * 100 : 0,
      };
    });
  };

  const qaStats = calculateQAStats();
  const pkgStats = calculatePKGStats();
  const batchStats = calculateBatchStats();

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">无法加载数据</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">📊 数据综合看板</h1>
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            刷新数据
          </button>
        </div>

        {/* 统计概览卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">总订单数</div>
            <div className="text-3xl font-bold text-gray-900">{data.total_orders}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">质检记录数</div>
            <div className="text-3xl font-bold text-blue-600">{data.total_qa_entries}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">包装记录数</div>
            <div className="text-3xl font-bold text-green-600">{data.total_pkg_entries}</div>
          </div>
        </div>

        {/* Tab 导航 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="flex border-b">
            {[
              { key: 'qa', label: '✨ 质检绩效 (结算)' },
              { key: 'pkg', label: '📦 包装绩效 (结算)' },
              { key: 'analysis', label: '📈 数据分析' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key as any)}
                className={`flex-1 px-6 py-4 font-medium transition-colors ${
                  selectedTab === tab.key
                    ? 'bg-red-500 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 质检绩效 Tab */}
          {selectedTab === 'qa' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">生产质检结算看板</h2>
                <button
                  onClick={() => handleExport('qa')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <Download className="w-4 h-4" />
                  导出对账单
                </button>
              </div>

              {data.qa_data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">💡 暂无质检绩效录入数据</div>
              ) : (
                <>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">操作时间</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">产品批次号</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">批次状态</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">生产单号</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">单据状态</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">生产商</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">合格数量</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">工价</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">可结算金额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.qa_data.slice(0, 50).map((record, idx) => {
                          const isSettled = record.产品批次状态 === '已完结';
                          const settlementAmount = isSettled ? record.结算金额 : 0;
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm">{record.操作时间}</td>
                              <td className="px-4 py-3 text-sm font-medium">{record.产品批次号}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  isSettled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {record.产品批次状态 || '进行中'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">{record.生产单号}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  record.生产单状态 === '已完结' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {record.生产单状态 || '进行中'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">{record.生产商}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-green-600">{record.合格数量}</td>
                              <td className="px-4 py-3 text-sm">¥{record.加工点工价?.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm font-semibold">
                                <span className={isSettled ? 'text-green-600' : 'text-gray-400'}>
                                  ¥{settlementAmount?.toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 统计汇总 */}
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-gray-500">累计合格总数</div>
                        <div className="text-xl font-bold text-gray-900">{qaStats.totalQty} 件</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-gray-500">已结算金额</div>
                        <div className="text-xl font-bold text-green-600">¥ {qaStats.settledAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-gray-500">待结算(批次锁定)</div>
                        <div className="text-xl font-bold text-yellow-600">¥ {qaStats.pendingAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 包装绩效 Tab */}
          {selectedTab === 'pkg' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">包装生产绩效结算清单</h2>
                <button
                  onClick={() => handleExport('pkg')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <Download className="w-4 h-4" />
                  导出包装单
                </button>
              </div>

              {data.pkg_data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">💡 暂无包装录入数据</div>
              ) : (
                <>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">操作时间</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">包装工</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">类型</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">商家编码</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">货品名称</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">规格名称</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">数量</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">执行单价</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">结算金额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.pkg_data.slice(0, 50).map((record, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">{record.操作时间}</td>
                            <td className="px-4 py-3 text-sm font-medium">{record.包装工}</td>
                            <td className="px-4 py-3 text-sm">{record.类型}</td>
                            <td className="px-4 py-3 text-sm">{record.商家编码}</td>
                            <td className="px-4 py-3 text-sm">{record.货品名称}</td>
                            <td className="px-4 py-3 text-sm">{record.规格名称}</td>
                            <td className="px-4 py-3 text-sm">{record.数量} 件</td>
                            <td className="px-4 py-3 text-sm">¥{record.执行单价?.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-green-600">¥{record.结算金额?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 统计汇总 */}
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-gray-500">累计包装总数</div>
                        <div className="text-xl font-bold text-gray-900">{pkgStats.totalQty} 件</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-gray-500">累计应付总额</div>
                        <div className="text-xl font-bold text-green-600">¥ {pkgStats.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 数据分析 Tab */}
          {selectedTab === 'analysis' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                生产批次深度分析
              </h2>

              {batchStats.length === 0 ? (
                <div className="text-center py-8 text-gray-500">暂无数据可分析</div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  {/* 批次合格率统计 */}
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-4">🏆 批次合格率统计</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">产品批次号</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">合格</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">不合格</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">总数</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">合格率</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {batchStats.map((batch, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm font-medium">{batch.批次号}</td>
                              <td className="px-4 py-2 text-sm text-green-600">{batch.合格数量}</td>
                              <td className="px-4 py-2 text-sm text-red-600">{batch.不合格数量}</td>
                              <td className="px-4 py-2 text-sm">{batch.总产量}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        batch.合格率 >= 90 ? 'bg-green-500' :
                                        batch.合格率 >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${batch.合格率}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-medium">{batch.合格率.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 整体数据概览 */}
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-4">📊 整体数据概览</h3>
                    <div className="space-y-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600">总批次数</div>
                        <div className="text-2xl font-bold text-blue-600">{batchStats.length}</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600">平均合格率</div>
                        <div className="text-2xl font-bold text-green-600">
                          {(batchStats.reduce((sum, b) => sum + b.合格率, 0) / batchStats.length || 0).toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600">总质检数量</div>
                        <div className="text-2xl font-bold text-purple-600">
                          {batchStats.reduce((sum, b) => sum + b.总产量, 0)} 件
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



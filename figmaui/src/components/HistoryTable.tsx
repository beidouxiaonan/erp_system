import { useState, useEffect } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface HistoryRecord {
  [key: string]: any;
}

interface HistoryTableProps {
  pageType?: 'qa' | 'pkg';
  refreshTrigger?: number;
  limit?: number;
}

export function HistoryTable({ pageType = 'qa', refreshTrigger, limit }: HistoryTableProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [pageType, refreshTrigger]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const url = pageType === 'qa' ? API_ENDPOINTS.QA_HISTORY : API_ENDPOINTS.PKG_HISTORY;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-center text-gray-500">暂无记录</p>
      </div>
    );
  }

  // 根据页面类型定义列
  const qaColumns = [
    { key: '操作时间', label: '操作时间' },
    { key: '生产单号', label: '生产单号' },
    { key: '产品批次号', label: '产品批次号' },
    { key: '产品批次状态', label: '批次状态' },
    { key: '生产单状态', label: '单据状态' },
    { key: '商家编码', label: '商家编码' },
    { key: '规格名称', label: '规格名称' },
    { key: '生产商', label: '生产商' },
    { key: '合格数量', label: '合格数量', type: 'success' },
    { key: '不合格数量', label: '不合格数量', type: 'danger' },
    { key: '加工点工价', label: '工价', type: 'money' },
    { key: '结算金额', label: '结算金额', type: 'money' },
  ];

  const pkgColumns = [
    { key: '操作时间', label: '操作时间' },
    { key: '包装工', label: '包装工' },
    { key: '类型', label: '类型' },
    { key: '商家编码', label: '商家编码' },
    { key: '货品名称', label: '货品名称' },
    { key: '规格名称', label: '规格名称' },
    { key: '数量', label: '数量' },
    { key: '执行单价', label: '执行单价', type: 'money' },
    { key: '结算金额', label: '结算金额', type: 'money' },
  ];

  const columns = pageType === 'qa' ? qaColumns : pkgColumns;

  const getStatusBadge = (status: string) => {
    const isFinished = status === '已完结';
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          isFinished
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}
      >
        {status || '进行中'}
      </span>
    );
  };

  const handleExport = () => {
    if (records.length === 0) {
      alert('暂无数据可导出');
      return;
    }

    const columns = pageType === 'qa' ? [
      '\u64cd作时间', '\u751f\u4ea7\u5355\u53f7', '\u4ea7\u54c1\u6279\u6b21\u53f7', '\u4ea7\u54c1\u6279\u6b21\u72b6\u6001',
      '\u751f\u4ea7\u5355\u72b6\u6001', '\u5546\u5bb6\u7f16\u7801', '\u89c4\u683c\u540d\u79f0', '\u751f\u4ea7\u5546',
      '\u5408\u683c\u6570\u91cf', '\u4e0d\u5408\u683c\u6570\u91cf', '\u52a0\u5de5\u70b9\u5de5\u4ef7', '\u7ed3\u7b97\u91d1\u989d'
    ] : [
      '\u64cd\u4f5c\u65f6\u95f4', '\u5305\u88c5\u5de5', '\u7c7b\u578b', '\u5546\u5bb6\u7f16\u7801',
      '\u8d27\u54c1\u540d\u79f0', '\u89c4\u683c\u540d\u79f0', '\u6570\u91cf', '\u6267\u884c\u5355\u4ef7', '\u7ed3\u7b97\u91d1\u989d'
    ];

    const csvContent = [
      columns.join(','),
      ...records.map(r =>
        columns.map(col => {
          const value = r[col];
          if (value === undefined || value === null) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = pageType === 'qa' ? `QA_HISTORY_${date}.csv` : `PKG_HISTORY_${date}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const displayRecords = limit ? records.slice(0, limit) : records.slice(0, 50);

  const renderCell = (record: HistoryRecord, column: { key: string; type?: string }) => {
    const value = record[column.key];
    
    if (value === undefined || value === null) {
      return <span className="text-gray-400">-</span>;
    }

    // 安全检查：如果值是对象（且不是null），无法直接渲染，转换为字符串
    if (typeof value === 'object') {
      console.warn('HistoryTable: Received object value for cell:', column.key, value);
      return <span className="text-red-400">Error</span>;
    }

    // 状态列
    if (column.key === '产品批次状态' || column.key === '生产单状态') {
      return getStatusBadge(value);
    }

    // 金额列
    if (column.type === 'money') {
      const num = Number(value);
      return (
        <span className="font-medium text-gray-900">
          ¥{isNaN(num) ? '0.00' : num.toFixed(2)}
        </span>
      );
    }

    // 成功数字（绿色）
    if (column.type === 'success') {
      return <span className="font-semibold text-green-600">{value}</span>;
    }

    // 危险数字（红色）
    if (column.type === 'danger') {
      return <span className="font-semibold text-red-600">{value}</span>;
    }

    return value;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {pageType === 'qa' ? '质检历史记录' : '包装历史记录'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={fetchHistory}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          {pageType === 'pkg' && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出记录
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayRecords.map((record, idx) => (
              <tr key={record.ID || idx} className="hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td
                    key={`${idx}-${col.key}`}
                    className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap"
                  >
                    {renderCell(record, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {displayRecords.length > 0 && records.length > displayRecords.length && (
        <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500 text-center">
          显示前 {displayRecords.length} 条记录，共 {records.length} 条
        </div>
      )}
    </div>
  );
}

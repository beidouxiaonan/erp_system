import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface HistoryRecord {
  [key: string]: any;
}

interface HistoryTableProps {
  pageType?: 'qa' | 'pkg';
  refreshTrigger?: number;
}

export function HistoryTable({ pageType = 'qa', refreshTrigger }: HistoryTableProps) {
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
        <button
          onClick={fetchHistory}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
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
            {records.slice(0, 50).map((record, idx) => (
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
      {records.length > 50 && (
        <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500 text-center">
          显示前 50 条记录，共 {records.length} 条
        </div>
      )}
    </div>
  );
}

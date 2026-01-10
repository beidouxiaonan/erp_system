import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';

interface OverviewData {
  total_orders: number;
  total_qa_entries: number;
  total_pkg_entries: number;
  qa_data: any[];
  pkg_data: any[];
}

export function OverviewCard() {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.DASHBOARD_OVERVIEW);
      if (response.ok) {
        const data = await response.json();
        setOverviewData(data);
      } else {
        console.error('Failed to fetch overview');
      }
    } catch (error) {
      console.error('Error fetching overview:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="text-center text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!overviewData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="text-center text-gray-500">无法加载数据</div>
      </div>
    );
  }

  const stats = [
    { label: '总订单数', value: overviewData.total_orders.toString(), unit: '个' },
    { label: '质检记录', value: overviewData.total_qa_entries.toString(), unit: '条' },
    { label: '包装记录', value: overviewData.total_pkg_entries.toString(), unit: '条' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-900">
            数据概览
          </span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
          >
            <div className="text-sm text-gray-600 mb-1">{stat.label}</div>
            <div className="text-2xl font-semibold text-gray-900">
              {stat.value}
              <span className="text-sm text-gray-500 ml-1">{stat.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

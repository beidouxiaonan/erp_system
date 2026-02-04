import { useState, useEffect } from 'react';
import { Plus, Minus, RefreshCw, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_ENDPOINTS } from '../config/api';
import { HistoryTable } from '../components/HistoryTable';

interface Worker {
  工号?: string;
  姓名: string;
  手机号?: string;
}

interface Price {
  商家编码: string;
  货品编号: string;
  货品名称: string;
  规格名称: string;
  加工点工价: number;
  只包装工价: number;
  剪包工价: number;
}

interface PKGRecord {
  操作时间: string;
  包装工: string;
  类型: string;
  商家编码: string;
  货品名称: string;
  规格名称: string;
  数量: number;
  执行单价: number;
  结算金额: number;
}

export default function PackagingEntryPage() {
  const { user } = useAuth();
  // 基础数据
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [todayRecords, setTodayRecords] = useState<PKGRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 表单状态
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedProductCode, setSelectedProductCode] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [feeType, setFeeType] = useState<'只包装工价' | '剪包工价'>('只包装工价');
  const [quantity, setQuantity] = useState(1);
  const [productCodeSearch, setProductCodeSearch] = useState('');
  const [showProductCodeDropdown, setShowProductCodeDropdown] = useState(false);

  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 刷新触发器
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 加载基础数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [workersRes, pricesRes, historyRes] = await Promise.all([
        fetch(API_ENDPOINTS.WORKERS),
        fetch(API_ENDPOINTS.PRICES),
        fetch(API_ENDPOINTS.PKG_HISTORY),
      ]);

      if (workersRes.ok) {
        const data = await workersRes.json();
        setWorkers(data);
      }
      if (pricesRes.ok) {
        const data = await pricesRes.json();
        setPrices(data);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        // 只显示今天的记录，按时间倒排只取前10条
        const today = new Date().toISOString().split('T')[0];
        const todayData = data.filter((r: PKGRecord) =>
          r.操作时间?.startsWith(today)
        );
        // 按操作时间值倒排，仅保留前10条
        todayData.sort((a: PKGRecord, b: PKGRecord) => 
          new Date(b.操作时间).getTime() - new Date(a.操作时间).getTime()
        );
        setTodayRecords(todayData.slice(0, 10));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取可选的货品编号列表
  const productCodes = [...new Set(prices.map((p: Price) => p.货品编号))];

  // 过滤后的货品编号
  const filteredProductCodes = productCodes.filter(code =>
    code.toLowerCase().includes(productCodeSearch.toLowerCase())
  );

  // 根据货品编号获取对应的规格列表
  const getAvailableSpecs = () => {
    if (!selectedProductCode) return [];
    return prices
      .filter((p: Price) => p.货品编号 === selectedProductCode)
      .map((p: Price) => p.规格名称)
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
  };

  // 获取当前选中的价格信息
  const getCurrentPrice = () => {
    if (!selectedProductCode || !selectedSpec) return null;
    return prices.find(
      (p: Price) => p.货品编号 === selectedProductCode && p.规格名称 === selectedSpec
    );
  };

  const currentPrice = getCurrentPrice();
  const unitPrice = currentPrice ? (currentPrice[feeType] ?? 0) : 0;
  const settlementAmount = quantity * unitPrice;

  // 调整数量
  const adjustQuantity = (delta: number) => {
    setQuantity(prev => Math.max(1, prev + delta));
  };

  // 提交包装记录
  const handleSubmit = async () => {
    if (!selectedWorker) {
      setSubmitMessage({ type: 'error', text: '请选择包装工' });
      return;
    }
    if (!selectedProductCode || !selectedSpec) {
      setSubmitMessage({ type: 'error', text: '请选择货品和规格' });
      return;
    }
    if (quantity <= 0) {
      setSubmitMessage({ type: 'error', text: '数量必须大于0' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const response = await fetch(API_ENDPOINTS.PKG_ENTRY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker: selectedWorker,
          type: feeType,
          quantity: quantity,
          merchant_code: currentPrice?.商家编码 || '',
          product_name: currentPrice?.货品名称 || '',
          operator: user?.username || 'unknown',
          spec_name: selectedSpec,
          unit_price: unitPrice,
          settlement_amount: settlementAmount,
        }),
      });

      if (response.ok) {
        setSubmitMessage({ type: 'success', text: `✅ 已成功录入: ${currentPrice?.货品名称}` });
        // 重置部分表单
        setQuantity(1);
        // 刷新数据
        loadData();
        setRefreshTrigger(prev => prev + 1);
      } else {
        const error = await response.json();
        let errorMessage = '提交失败';
        if (typeof error.detail === 'string') {
          errorMessage = error.detail;
        } else if (Array.isArray(error.detail)) {
          // 处理 Pydantic 验证错误
          errorMessage = error.detail.map((e: any) => `${e.loc[e.loc.length-1]}: ${e.msg}`).join(', ');
        } else if (typeof error.detail === 'object') {
          errorMessage = JSON.stringify(error.detail);
        }
        setSubmitMessage({ type: 'error', text: errorMessage });
      }
    } catch (error) {
      setSubmitMessage({ type: 'error', text: '网络错误，请重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 导出记录
  const handleExport = () => {
    if (todayRecords.length === 0) {
      alert('暂无数据可导出');
      return;
    }

    const headers = ['操作时间', '包装工', '类型', '货品名称', '商家编码', '规格名称', '数量', '执行单价', '结算金额'];
    const csvContent = [
      headers.join(','),
      ...todayRecords.map(r =>
        headers.map(h => {
          const value = r[h as keyof PKGRecord];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');

    link.setAttribute('href', url);
    link.setAttribute('download', `PKG_DETAIL_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  if (workers.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800 font-semibold">⚠️ 暂无工人信息</p>
            <p className="text-yellow-600 text-sm mt-2">请先在"数据导入"页面添加工人档案</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">📦 包装录入管理</h1>

        {/* 录入表单 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📝 新增包装记录</h2>

          {submitMessage && (
            <div className={`mb-4 p-4 rounded-lg ${
              submitMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {submitMessage.text}
            </div>
          )}

          {/* 1. 选择包装工 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              1. 选择包装工 *
            </label>
            <select
              value={selectedWorker}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedWorker(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">请选择包装工</option>
              {workers.map((w: Worker, idx: number) => (
                <option key={w.工号 || idx} value={w.姓名}>
                  {w.姓名}
                </option>
              ))}
            </select>
          </div>

          {/* 2. 选择货品编号 */}
          <div className="mb-4 relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              2. 选择【货品编号】 *
            </label>
            <div className="relative">
              <input
                type="text"
                value={selectedProductCode || productCodeSearch}
                onChange={(e) => {
                  setProductCodeSearch(e.target.value);
                  setSelectedProductCode('');
                  setSelectedSpec('');
                  setShowProductCodeDropdown(true);
                }}
                onFocus={() => setShowProductCodeDropdown(true)}
                onBlur={() => setTimeout(() => setShowProductCodeDropdown(false), 200)}
                placeholder="输入编号搜索..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {showProductCodeDropdown && filteredProductCodes.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredProductCodes.map(code => (
                    <div
                      key={code}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setSelectedProductCode(code);
                        setProductCodeSearch(code);
                        setSelectedSpec('');
                        setShowProductCodeDropdown(false);
                      }}
                    >
                      {code}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. 选择规格名称 */}
          {selectedProductCode && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                3. 选择【规格名称】 *
              </label>
              <select
                value={selectedSpec}
                onChange={(e) => setSelectedSpec(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">请选择规格</option>
                {getAvailableSpecs().map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>
          )}

          {/* 确认货品信息 */}
          {currentPrice && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800">
                ✅ <strong>确认货品：</strong> {currentPrice.货品名称} | 规格：{selectedSpec}
              </p>
            </div>
          )}

          {/* 4. 计费类型 和 5. 数量 */}
          {currentPrice && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    4. 计费类型
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="feeType"
                        value="只包装工价"
                        checked={feeType === '只包装工价'}
                        onChange={() => setFeeType('只包装工价')}
                        className="mr-2"
                      />
                      只包装工价 (¥{(currentPrice.只包装工价 ?? 0).toFixed(2)})
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="feeType"
                        value="剪包工价"
                        checked={feeType === '剪包工价'}
                        onChange={() => setFeeType('剪包工价')}
                        className="mr-2"
                      />
                      剪包工价 (¥{(currentPrice.剪包工价 ?? 0).toFixed(2)})
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    5. 包装数量
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustQuantity(-1)}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 px-4 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button
                      onClick={() => adjustQuantity(1)}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 结算预览 */}
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">预计结算金额：</span>
                  <span className="text-2xl font-bold text-green-600">
                    ¥ {settlementAmount.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {feeType}: ¥{unitPrice.toFixed(2)} × {quantity} 件
                </p>
              </div>

              {/* 提交按钮 */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
              >
                {isSubmitting ? '提交中...' : '📤 提交本次包装记录'}
              </button>
            </>
          )}
        </div>

        {/* 今日录入明细 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">📋 今日包装录入明细</h2>
            <div className="flex gap-2">
              <button
                onClick={loadData}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <Download className="w-4 h-4" />
                导出记录
              </button>
            </div>
          </div>

          {todayRecords.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              💡 暂无历史录入数据
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">操作时间</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">包装工</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">类型</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">货品名称</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">规格名称</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">数量</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">执行单价</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">结算金额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {todayRecords.map((record, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700">{record.操作时间}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{record.包装工}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{record.类型}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{record.货品名称}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{record.规格名称}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{record.数量} 件</td>
                      <td className="px-4 py-3 text-sm text-gray-700">¥{record.执行单价?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">
                        ¥{record.结算金额?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 全部历史记录 */}
        <HistoryTable pageType="pkg" refreshTrigger={refreshTrigger} limit={10} />
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_ENDPOINTS } from '../config/api';
import { HistoryTable } from '../components/HistoryTable';

interface Order {
  生产单号: string;
  产品批次号: string;
  商家编码: string;
  规格名称: string;
  生产商: string;
  计划生产次数: number;
  状态: string;
}

interface Price {
  商家编码: string;
  加工点工价: number;
  规格名称: string;
  货品名称: string;
}

interface QAHistory {
  生产单号: string;
  商家编码: string;
  合格数量: number;
  不合格数量: number;
  生产单状态: string;
  产品批次状态: string;
}

export default function QAEntryPage() {
  const { user } = useAuth();
  // 搜索状态
  const [searchKey, setSearchKey] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [matchedOrders, setMatchedOrders] = useState<Order[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [qaHistory, setQaHistory] = useState<QAHistory[]>([]);

  // 选择状态
  const [selectedOrderNo, setSelectedOrderNo] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');

  // 当前选中项数据
  const [currentBatchNo, setCurrentBatchNo] = useState('');
  const [currentManufacturer, setCurrentManufacturer] = useState('');
  const [plannedQty, setPlannedQty] = useState(0);
  const [pastQty, setPastQty] = useState(0);
  const [processingFee, setProcessingFee] = useState(0);

  // 批次状态
  const [batchStatus, setBatchStatus] = useState('进行中');
  const [isBatchAllDone, setIsBatchAllDone] = useState(false);

  // 表单状态
  const [qualifiedQty, setQualifiedQty] = useState(0);
  const [unqualifiedQty, setUnqualifiedQty] = useState(0);
  const [orderStatus, setOrderStatus] = useState('进行中');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 刷新触发器
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 加载基础数据
  useEffect(() => {
    loadBaseData();
  }, []);

  const loadBaseData = async () => {
    setIsLoading(true);
    try {
      const baseURL = API_ENDPOINTS.ORDERS.split('/orders')[0];
      console.log('Loading from base URL:', baseURL);
      
      const [ordersRes, pricesRes, historyRes] = await Promise.all([
        fetch(API_ENDPOINTS.ORDERS).catch(e => { console.error('Orders fetch error:', e); throw e; }),
        fetch(API_ENDPOINTS.PRICES).catch(e => { console.error('Prices fetch error:', e); throw e; }),
        fetch(API_ENDPOINTS.QA_HISTORY).catch(e => { console.error('History fetch error:', e); throw e; }),
      ]);

      console.log('Orders response:', ordersRes.status);
      console.log('Prices response:', pricesRes.status);
      console.log('History response:', historyRes.status);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        console.log('✓ Orders loaded:', data.length, 'records');
        setOrders(data || []);
      } else {
        console.error('Orders API error:', ordersRes.status, ordersRes.statusText);
        const error = await ordersRes.text();
        console.error('Response:', error);
      }
      
      if (pricesRes.ok) {
        const data = await pricesRes.json();
        console.log('✓ Prices loaded:', data.length, 'records');
        setPrices(data || []);
      }
      
      if (historyRes.ok) {
        const data = await historyRes.json();
        console.log('✓ History loaded:', data.length, 'records');
        setQaHistory(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert(`加载数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 搜索处理
  const handleSearch = useCallback(() => {
    if (!searchKey.trim()) {
      setMatchedOrders([]);
      alert('请输入产品批次号');
      return;
    }

    if (orders.length === 0) {
      alert('暂无订单数据，请先导入数据');
      return;
    }

    console.log('Searching for:', searchKey);
    console.log('Available orders:', orders);

    // 使用更宽松的搜索条件，支持多种列名格式
    const matched = orders.filter(order => {
      const batchNo = order.产品批次号 || order['产品批次号'];
      if (!batchNo) return false;
      return batchNo.toString().toLowerCase().includes(searchKey.toLowerCase());
    });

    console.log('Matched orders:', matched);

    if (matched.length === 0) {
      alert(`未找到包含 "${searchKey}" 的批次号数据`);
    }

    setMatchedOrders(matched);

    // 重置选择
    setSelectedOrderNo('');
    setSelectedSku('');
    setSelectedSpec('');
  }, [searchKey, orders]);

  // 当选择生产单号时更新可选的商家编码
  const getAvailableSkus = useCallback(() => {
    if (!selectedOrderNo) return [];
    const skus = matchedOrders
      .filter(o => o.生产单号 === selectedOrderNo)
      .map(o => o.商家编码)
      .filter((v, i, a) => a.indexOf(v) === i);
    return skus;
  }, [selectedOrderNo, matchedOrders]);

  // 当选择商家编码时更新可选的规格
  const getAvailableSpecs = useCallback(() => {
    if (!selectedOrderNo || !selectedSku) return [];
    const specs = matchedOrders
      .filter(o => o.生产单号 === selectedOrderNo && o.商家编码 === selectedSku)
      .map(o => o.规格名称)
      .filter((v, i, a) => a.indexOf(v) === i);
    return specs;
  }, [selectedOrderNo, selectedSku, matchedOrders]);

  // 计算当前选中项的详细信息
  useEffect(() => {
    if (!selectedOrderNo || !selectedSku || !selectedSpec) {
      setCurrentBatchNo('');
      setCurrentManufacturer('');
      setPlannedQty(0);
      setPastQty(0);
      setProcessingFee(0);
      return;
    }

    // 获取当前订单数据
    const currentOrder = matchedOrders.find(
      o => o.生产单号 === selectedOrderNo && o.商家编码 === selectedSku && o.规格名称 === selectedSpec
    );

    if (currentOrder) {
      setCurrentBatchNo(currentOrder.产品批次号);
      setCurrentManufacturer(currentOrder.生产商 || '');
      setPlannedQty(currentOrder.计划生产次数 || 0);
    }

    // 获取价格信息
    const priceInfo = prices.find(p => p.商家编码 === selectedSku);
    setProcessingFee(priceInfo?.加工点工价 || 0);

    // 计算已入库数量
    const historyForCurrent = Array.isArray(qaHistory) ? qaHistory.filter(
      h => h?.生产单号 === selectedOrderNo && h?.商家编码 === selectedSku
    ) : [];
    const totalPast = historyForCurrent.reduce((sum, h) => sum + (Number(h?.合格数量) || 0), 0);
    setPastQty(totalPast);

    // 计算批次状态
    calculateBatchStatus(currentOrder?.产品批次号 || '');
  }, [selectedOrderNo, selectedSku, selectedSpec, matchedOrders, prices, qaHistory]);

  // 计算批次状态
  const calculateBatchStatus = (batchNo: string) => {
    if (!batchNo || !Array.isArray(orders) || !Array.isArray(qaHistory)) {
      setIsBatchAllDone(false);
      setBatchStatus('进行中');
      return;
    }

    // 获取该批次下所有任务
    const allTasksInBatch = orders.filter(o => o.产品批次号 === batchNo);

    if (allTasksInBatch.length === 0) {
      setIsBatchAllDone(false);
      setBatchStatus('进行中');
      return;
    }

    // 检查每个任务的状态
    let allDone = true;
    for (const task of allTasksInBatch) {
      const taskHistory = Array.isArray(qaHistory) ? qaHistory.filter(
        h => h?.生产单号 === task?.生产单号 && h?.商家编码 === task?.商家编码
      ) : [];

      if (taskHistory.length === 0) {
        allDone = false;
        break;
      }

      // 取最新记录的状态
      const latestStatus = taskHistory[0]?.生产单状态;
      if (latestStatus !== '已完结') {
        allDone = false;
        break;
      }
    }

    setIsBatchAllDone(allDone);
    setBatchStatus(allDone ? '已完结' : '进行中');
  };

  // 计算进度百分比
  const progressPercent = plannedQty > 0 ? Math.min(100, Math.round((pastQty / plannedQty) * 100)) : 0;

  // 计算结算金额
  const settlementAmount = qualifiedQty * processingFee;

  // 提交质检数据
  const handleSubmit = async () => {
    if (!selectedOrderNo || !selectedSku) {
      setSubmitMessage({ type: 'error', text: '请先选择生产单号和商家编码' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const response = await fetch(API_ENDPOINTS.QA_ENTRY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_order: String(selectedOrderNo),
          batch_number: String(currentBatchNo),
          qualified_qty: Number(qualifiedQty),
          unqualified_qty: Number(unqualifiedQty),
          merchant_code: String(selectedSku),
          spec_name: String(selectedSpec),
          manufacturer: String(currentManufacturer || ''),
          operator: user?.username || 'unknown',
          order_status: String(orderStatus), // 传递用户选择的状态
        }),
      });

      if (response.ok) {
        setSubmitMessage({ type: 'success', text: '数据已录入成功！' });
        // 重置表单
        setQualifiedQty(0);
        setUnqualifiedQty(0);
        // 刷新数据
        loadBaseData();
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

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">🔍 质检入库记录</h1>

        {/* 加载状态提示 */}
        {isLoading && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-blue-800">正在加载订单数据...</span>
          </div>
        )}

        {/* 数据加载完成提示 */}
        {!isLoading && orders.length > 0 && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-green-800">✓ 已加载 {orders.length} 条订单数据，可开始搜索</span>
          </div>
        )}

        {/* 数据为空提示 */}
        {!isLoading && orders.length === 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <span className="text-yellow-800">⚠️ 暂无订单数据，请先在"数据导入"页面导入Excel文件</span>
          </div>
        )}

        {/* 搜索控制台 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🛠️ 搜索与筛选控制台</h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                请输入产品批次号进行搜索
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="输入批次号..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <button
              onClick={handleSearch}
              className="self-end px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              🔍 执行搜索
            </button>
          </div>
        </div>

        {/* 搜索结果和级联选择 */}
        {matchedOrders.length > 0 && (
          <>
            {/* 级联选择 */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📌 选择关联生产单号
                  </label>
                  <select
                    value={selectedOrderNo}
                    onChange={(e) => {
                      setSelectedOrderNo(e.target.value);
                      setSelectedSku('');
                      setSelectedSpec('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">请选择</option>
                    {[...new Set(matchedOrders.map(o => o.生产单号))].map(orderNo => (
                      <option key={orderNo} value={orderNo}>{orderNo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📦 选择关联商家编码
                  </label>
                  <select
                    value={selectedSku}
                    onChange={(e) => {
                      setSelectedSku(e.target.value);
                      setSelectedSpec('');
                    }}
                    disabled={!selectedOrderNo}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100"
                  >
                    <option value="">请选择</option>
                    {getAvailableSkus().map(sku => (
                      <option key={sku} value={sku}>{sku}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📋 选择关联规格名称
                  </label>
                  <select
                    value={selectedSpec}
                    onChange={(e) => setSelectedSpec(e.target.value)}
                    disabled={!selectedSku}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100"
                  >
                    <option value="">请选择</option>
                    {getAvailableSpecs().map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 批次信息卡片 */}
            {currentBatchNo && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-l-4 border-blue-500">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <span className="text-lg">产品批次号：<b>{currentBatchNo}</b></span>
                    <p className="text-sm text-gray-500">
                      (该批次共包含 {orders.filter(o => o.产品批次号 === currentBatchNo).length} 个具体生产任务)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-500">产品批次全局状态</span>
                    <div className="mt-1">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        isBatchAllDone
                          ? 'bg-green-500 text-white'
                          : 'bg-yellow-500 text-white'
                      }`}>
                        {batchStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 进度条 */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">📈 单个单号生产进度</h3>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-green-500 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    完成率: {progressPercent}% (计划: {plannedQty} / 已入库: {pastQty})
                  </p>
                </div>

                {/* 统计卡片 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 text-center">
                    <div className="text-sm text-gray-500">单号已合格</div>
                    <div className="text-xl font-bold text-green-600">{pastQty}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 text-center">
                    <div className="text-sm text-gray-500">单号待产余量</div>
                    <div className="text-xl font-bold text-red-600">{Math.max(0, plannedQty - pastQty)}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 text-center">
                    <div className="text-sm text-gray-500">规格名称</div>
                    <div className="text-lg font-semibold text-gray-900">{selectedSpec || '-'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 质检录入表单 */}
            {selectedOrderNo && selectedSku && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">📝 本次质检录入</h2>

                {submitMessage && (
                  <div className={`mb-4 p-4 rounded-lg ${
                    submitMessage.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    {submitMessage.text}
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">合格数量</label>
                    <input
                      type="number"
                      min={0}
                      value={qualifiedQty}
                      onChange={(e) => setQualifiedQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">不合格数量</label>
                    <input
                      type="number"
                      min={0}
                      value={unqualifiedQty}
                      onChange={(e) => setUnqualifiedQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">更新生产单据状态</label>
                    <select
                      value={orderStatus}
                      onChange={(e) => setOrderStatus(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="进行中">进行中</option>
                      <option value="已完结">已完结</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">批次状态预览</label>
                    <div className={`px-4 py-2 rounded-lg text-center font-semibold ${
                      isBatchAllDone
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {batchStatus}
                    </div>
                  </div>
                </div>

                {/* 结算预览 */}
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-600">预计结算金额</span>
                      <div className="text-2xl font-bold text-blue-600">¥ {settlementAmount.toFixed(2)}</div>
                    </div>
                    <div className="text-sm text-gray-500">
                      工价: ¥{processingFee.toFixed(2)} × {qualifiedQty} 件
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
                >
                  {isSubmitting ? '提交中...' : '📤 提交数据并写入审计日志'}
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  (合格与不合格数量同时为0时，提交不会改变批次状态)
                </p>
              </div>
            )}
          </>
        )}

        {/* 历史记录 */}
        <HistoryTable pageType="qa" refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}

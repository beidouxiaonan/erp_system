import { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import {
  getPrices,
  getPriceByMerchantCode,
  calculateQASettlementAmount,
  submitQAEntry,
  validateQAEntry,
  type PriceInfo,
} from '../services/businessService';

export function OperationCard() {
  const [qualifiedQty, setQualifiedQty] = useState(0);
  const [unqualifiedQty, setUnqualifiedQty] = useState(0);
  const [documentStatus, setDocumentStatus] = useState('待处理');
  const [productionOrder, setProductionOrder] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [merchantCode, setMerchantCode] = useState('');
  const [specName, setSpecName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prices, setPrices] = useState<PriceInfo[]>([]);
  const [settlementAmount, setSettlementAmount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    loadPrices();
  }, []);

  useEffect(() => {
    calculateSettlement();
  }, [qualifiedQty, merchantCode, prices]);

  const loadPrices = async () => {
    const priceData = await getPrices();
    setPrices(priceData);
  };

  const calculateSettlement = () => {
    if (!merchantCode || prices.length === 0) {
      setSettlementAmount(0);
      return;
    }
    const priceInfo = getPriceByMerchantCode(prices, merchantCode);
    if (priceInfo) {
      const amount = calculateQASettlementAmount(qualifiedQty, priceInfo.加工点工价);
      setSettlementAmount(amount);
    }
  };

  const handleSubmit = async () => {
    // 前端业务逻辑验证
    const validationErrors = validateQAEntry({
      production_order: productionOrder,
      batch_number: batchNumber,
      qualified_qty: qualifiedQty,
      unqualified_qty: unqualifiedQty,
      merchant_code: merchantCode,
      spec_name: specName,
      manufacturer: manufacturer,
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsSubmitting(true);
    try {
      const success = await submitQAEntry({
        production_order: productionOrder,
        batch_number: batchNumber,
        qualified_qty: qualifiedQty,
        unqualified_qty: unqualifiedQty,
        merchant_code: merchantCode,
        spec_name: specName,
        manufacturer: manufacturer,
      });

      if (success) {
        alert('数据已提交并写入日志');
        // Reset form
        setQualifiedQty(0);
        setUnqualifiedQty(0);
        setProductionOrder('');
        setBatchNumber('');
        setMerchantCode('');
        setSpecName('');
        setManufacturer('');
        setSettlementAmount(0);
      } else {
        setErrors(['提交失败，请重试']);
      }
    } catch (error) {
      setErrors([`提交失败: ${error instanceof Error ? error.message : '未知错误'}`]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const adjustQuantity = (
    type: 'qualified' | 'unqualified',
    action: 'increase' | 'decrease'
  ) => {
    if (type === 'qualified') {
      setQualifiedQty((prev) => Math.max(0, action === 'increase' ? prev + 1 : prev - 1));
    } else {
      setUnqualifiedQty((prev) => Math.max(0, action === 'increase' ? prev + 1 : prev - 1));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">质检操作</h2>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          {errors.map((error, idx) => (
            <p key={idx} className="text-sm text-red-700">{error}</p>
          ))}
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            生产单号 *
          </label>
          <input
            type="text"
            value={productionOrder}
            onChange={(e) => setProductionOrder(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="输入生产单号"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            产品批次号 *
          </label>
          <input
            type="text"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="输入批次号"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            商家编码 *
          </label>
          <input
            type="text"
            value={merchantCode}
            onChange={(e) => setMerchantCode(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="输入商家编码"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            规格名称
          </label>
          <input
            type="text"
            value={specName}
            onChange={(e) => setSpecName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="输入规格名称"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            生产商
          </label>
          <input
            type="text"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="输入生产商"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Qualified Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            合格数量
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustQuantity('qualified', 'decrease')}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Minus className="w-4 h-4 text-gray-600" />
            </button>
            <input
              type="number"
              value={qualifiedQty}
              onChange={(e) => setQualifiedQty(Math.max(0, parseInt(e.target.value) || 0))}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <button
              onClick={() => adjustQuantity('qualified', 'increase')}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Unqualified Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            不合格数量
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustQuantity('unqualified', 'decrease')}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Minus className="w-4 h-4 text-gray-600" />
            </button>
            <input
              type="number"
              value={unqualifiedQty}
              onChange={(e) => setUnqualifiedQty(Math.max(0, parseInt(e.target.value) || 0))}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <button
              onClick={() => adjustQuantity('unqualified', 'increase')}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Document Status Dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          更新单据状态
        </label>
        <select
          value={documentStatus}
          onChange={(e) => setDocumentStatus(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option>待处理</option>
          <option>处理中</option>
          <option>已完结</option>
          <option>已取消</option>
        </select>
      </div>

      {/* Settlement Amount */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm text-gray-600 mb-2">预计结算金额</div>
        <div className="text-2xl font-bold text-blue-600">
          ¥ {settlementAmount.toFixed(2)}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {merchantCode && prices.find(p => p.商家编码 === merchantCode) ? (
            <span>
              基于商家编码 {merchantCode} 的加工点工价: ¥ {
                prices.find(p => p.商家编码 === merchantCode)?.加工点工价.toFixed(2)
              } × {qualifiedQty} 件 = ¥ {settlementAmount.toFixed(2)}
            </span>
          ) : (
            <span>请填写商家编码以计算结算金额</span>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? '提交中...' : '提交数据并写入日志'}
      </button>
    </div>
  );
}

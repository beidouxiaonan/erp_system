import { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import {
  getPrices,
  getPKGUnitPrice,
  calculatePKGSettlementAmount,
  submitPKGEntry,
  validatePKGEntry,
  getWorkers,
  type PriceInfo,
} from '../services/businessService';

export function PackagingOperationCard() {
  const [worker, setWorker] = useState('');
  const [packageType, setPackageType] = useState('只包装');
  const [quantity, setQuantity] = useState(0);
  const [merchantCode, setMerchantCode] = useState('');
  const [productName, setProductName] = useState('');
  const [specName, setSpecName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prices, setPrices] = useState<PriceInfo[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [settlementAmount, setSettlementAmount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateSettlement();
  }, [quantity, packageType, merchantCode, prices]);

  const loadData = async () => {
    const [priceData, workerData] = await Promise.all([
      getPrices(),
      getWorkers(),
    ]);
    setPrices(priceData);
    setWorkers(workerData);
  };

  const calculateSettlement = () => {
    if (!merchantCode || prices.length === 0) {
      setSettlementAmount(0);
      return;
    }
    const unitPrice = getPKGUnitPrice(packageType, prices, merchantCode);
    const amount = calculatePKGSettlementAmount(quantity, unitPrice);
    setSettlementAmount(amount);
  };

  const adjustQuantity = (action: 'increase' | 'decrease') => {
    setQuantity((prev) => Math.max(0, action === 'increase' ? prev + 1 : prev - 1));
  };

  const handleSubmit = async () => {
    // 前端业务逻辑验证
    const validationErrors = validatePKGEntry({
      worker,
      type: packageType,
      quantity,
      merchant_code: merchantCode,
      product_name: productName,
      spec_name: specName,
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsSubmitting(true);
    try {
      const success = await submitPKGEntry({
        worker,
        type: packageType,
        quantity,
        merchant_code: merchantCode,
        product_name: productName,
        spec_name: specName,
      });

      if (success) {
        alert('数据已提交');
        // Reset form
        setWorker('');
        setPackageType('只包装');
        setQuantity(0);
        setMerchantCode('');
        setProductName('');
        setSpecName('');
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

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">包装操作</h2>

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
            包装工 *
          </label>
          <select
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="">选择包装工</option>
            {workers.map((w: any) => (
              <option key={w.id || w.name} value={w.name || w}>
                {w.name || w}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            包装类型 *
          </label>
          <select
            value={packageType}
            onChange={(e) => setPackageType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option>只包装</option>
            <option>剪包</option>
          </select>
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
            货品名称
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="输入货品名称"
          />
        </div>
        <div className="col-span-2">
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
      </div>

      {/* Quantity */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          数量
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustQuantity('decrease')}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Minus className="w-4 h-4 text-gray-600" />
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <button
            onClick={() => adjustQuantity('increase')}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>
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
              基于商家编码 {merchantCode} 的{packageType}工价: ¥ {
                getPKGUnitPrice(packageType, prices, merchantCode).toFixed(2)
              } × {quantity} 件 = ¥ {settlementAmount.toFixed(2)}
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
        {isSubmitting ? '提交中...' : '提交数据'}
      </button>
    </div>
  );
}

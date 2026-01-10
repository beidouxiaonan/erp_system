// Service for handling business logic
import { API_ENDPOINTS } from '../config/api';

export interface QAEntryData {
  production_order: string;
  batch_number: string;
  qualified_qty: number;
  unqualified_qty: number;
  merchant_code: string;
  spec_name: string;
  manufacturer: string;
}

export interface PKGEntryData {
  worker: string;
  type: string;
  quantity: number;
  merchant_code: string;
  product_name: string;
  spec_name: string;
}

export interface PriceInfo {
  商家编码: string;
  货品编号?: string;
  货品名称?: string;
  规格名称?: string;
  加工点工价: number;
  只包装工价: number;
  剪包工价: number;
}

export interface OrderInfo {
  生产单号: string;
  产品批次号: string;
  商家编码: string;
  规格名称: string;
  生产商: string;
  计划生产次数: number;
  状态: string;
}

// 获取价格信息
export async function getPrices(): Promise<PriceInfo[]> {
  try {
    const response = await fetch(API_ENDPOINTS.PRICES);
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error fetching prices:', error);
    return [];
  }
}

// 根据商家编码获取价格信息
export function getPriceByMerchantCode(
  prices: PriceInfo[],
  merchantCode: string
): PriceInfo | null {
  return prices.find(p => p.商家编码 === merchantCode) || null;
}

// 计算质检结算金额
export function calculateQASettlementAmount(
  qualifiedQty: number,
  processingFee: number
): number {
  return qualifiedQty * processingFee;
}

// 计算包装结算金额
export function calculatePKGSettlementAmount(
  quantity: number,
  unitPrice: number
): number {
  return quantity * unitPrice;
}

// 根据包装类型获取单价
export function getPKGUnitPrice(
  packageType: string,
  prices: PriceInfo[],
  merchantCode: string
): number {
  const price = getPriceByMerchantCode(prices, merchantCode);
  if (!price) return 0;

  if (packageType === '只包装') {
    return price.只包装工价;
  } else if (packageType === '剪包') {
    return price.剪包工价;
  }
  return 0;
}

// 提交质检数据到后端
export async function submitQAEntry(data: QAEntryData): Promise<boolean> {
  try {
    const response = await fetch(API_ENDPOINTS.QA_ENTRY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error('Error submitting QA entry:', error);
    return false;
  }
}

// 提交包装数据到后端
export async function submitPKGEntry(data: PKGEntryData): Promise<boolean> {
  try {
    const response = await fetch(API_ENDPOINTS.PKG_ENTRY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error('Error submitting PKG entry:', error);
    return false;
  }
}

// 获取质检历史记录
export async function getQAHistory(): Promise<any[]> {
  try {
    const response = await fetch(API_ENDPOINTS.QA_HISTORY);
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error fetching QA history:', error);
    return [];
  }
}

// 获取包装历史记录
export async function getPKGHistory(): Promise<any[]> {
  try {
    const response = await fetch(API_ENDPOINTS.PKG_HISTORY);
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error fetching PKG history:', error);
    return [];
  }
}

// 获取仪表板概览数据
export async function getDashboardOverview(): Promise<any> {
  try {
    const response = await fetch(API_ENDPOINTS.DASHBOARD_OVERVIEW);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return null;
  }
}

// 获取工人列表
export async function getWorkers(): Promise<any[]> {
  try {
    const response = await fetch(API_ENDPOINTS.WORKERS);
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error fetching workers:', error);
    return [];
  }
}

// 验证质检数据
export function validateQAEntry(data: QAEntryData): string[] {
  const errors: string[] = [];

  if (!data.production_order?.trim()) {
    errors.push('生产单号不能为空');
  }
  if (!data.batch_number?.trim()) {
    errors.push('产品批次号不能为空');
  }
  if (data.qualified_qty < 0) {
    errors.push('合格数量不能为负数');
  }
  if (data.unqualified_qty < 0) {
    errors.push('不合格数量不能为负数');
  }
  if (!data.merchant_code?.trim()) {
    errors.push('商家编码不能为空');
  }

  return errors;
}

// 验证包装数据
export function validatePKGEntry(data: PKGEntryData): string[] {
  const errors: string[] = [];

  if (!data.worker?.trim()) {
    errors.push('包装工不能为空');
  }
  if (!data.type?.trim()) {
    errors.push('包装类型不能为空');
  }
  if (data.quantity <= 0) {
    errors.push('数量必须大于0');
  }
  if (!data.merchant_code?.trim()) {
    errors.push('商家编码不能为空');
  }

  return errors;
}

// 获取订单列表
export async function getOrders(): Promise<OrderInfo[]> {
  try {
    const response = await fetch(API_ENDPOINTS.ORDERS);
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

// 按批次号搜索订单
export async function searchOrders(batchNumber: string): Promise<OrderInfo[]> {
  try {
    const response = await fetch(`${API_ENDPOINTS.ORDERS_SEARCH}?batch_number=${encodeURIComponent(batchNumber)}`);
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error searching orders:', error);
    return [];
  }
}

// 上传Excel文件
export async function uploadExcel(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(API_ENDPOINTS.IMPORT_EXCEL, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, message: result.message };
    } else {
      const error = await response.json();
      return { success: false, message: error.detail || '导入失败' };
    }
  } catch (error) {
    return { success: false, message: '网络错误，请重试' };
  }
}

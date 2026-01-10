// Analytics Service - 前端数据分析逻辑

export interface QARecord {
  ID: number;
  生产单号: string;
  录入时间: string;
  操作时间: string;
  产品批次号: string;
  合格数量: number;
  不合格数量: number;
  生产单状态: string;
  商家编码: string;
  规格名称: string;
  生产商: string;
  加工点工价: number;
  结算金额: number;
}

export interface PKGRecord {
  ID: number;
  包装工: string;
  类型: string;
  数量: number;
  录入时间: string;
  操作时间: string;
  只包装工价: number;
  剪包工价: number;
  商家编码: string;
  货品名称: string;
  规格名称: string;
  执行单价: number;
  结算金额: number;
}

// 计算质检统计数据
export function calculateQAStats(records: QARecord[]) {
  return {
    totalRecords: records.length,
    totalQualified: records.reduce((sum, r) => sum + r.合格数量, 0),
    totalUnqualified: records.reduce((sum, r) => sum + r.不合格数量, 0),
    totalSettlement: records.reduce((sum, r) => sum + r.结算金额, 0),
    qualityRate: records.length > 0
      ? ((records.reduce((sum, r) => sum + r.合格数量, 0) /
        (records.reduce((sum, r) => sum + r.合格数量, 0) +
         records.reduce((sum, r) => sum + r.不合格数量, 0))) * 100).toFixed(2)
      : '0.00',
  };
}

// 计算包装统计数据
export function calculatePKGStats(records: PKGRecord[]) {
  return {
    totalRecords: records.length,
    totalQuantity: records.reduce((sum, r) => sum + r.数量, 0),
    totalSettlement: records.reduce((sum, r) => sum + r.结算金额, 0),
    byType: {
      只包装: records
        .filter(r => r.类型 === '只包装')
        .reduce((sum, r) => sum + r.数量, 0),
      剪包: records
        .filter(r => r.类型 === '剪包')
        .reduce((sum, r) => sum + r.数量, 0),
    },
  };
}

// 按商家分组统计
export function groupByMerchantCode(records: QARecord[] | PKGRecord[]) {
  const grouped: { [key: string]: any } = {};

  records.forEach((record) => {
    const merchantCode = (record as any).商家编码;
    if (!grouped[merchantCode]) {
      grouped[merchantCode] = {
        merchantCode,
        count: 0,
        totalSettlement: 0,
        records: [],
      };
    }
    grouped[merchantCode].count++;
    grouped[merchantCode].totalSettlement += (record as any).结算金额;
    grouped[merchantCode].records.push(record);
  });

  return Object.values(grouped).sort((a, b) => b.totalSettlement - a.totalSettlement);
}

// 按日期分组统计
export function groupByDate(records: QARecord[] | PKGRecord[]) {
  const grouped: { [key: string]: any } = {};

  records.forEach((record) => {
    const date = new Date((record as any).录入时间).toLocaleDateString('zh-CN');
    if (!grouped[date]) {
      grouped[date] = {
        date,
        count: 0,
        totalSettlement: 0,
        records: [],
      };
    }
    grouped[date].count++;
    grouped[date].totalSettlement += (record as any).结算金额;
    grouped[date].records.push(record);
  });

  return Object.values(grouped).sort((a: any, b: any) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

// 计算排行榜（按结算金额）
export function getTopRecords(records: QARecord[] | PKGRecord[], limit = 10) {
  return records
    .sort((a, b) => b.结算金额 - a.结算金额)
    .slice(0, limit);
}

// 计算周期统计（本周、本月、本年）
export function getPeriodStats(records: QARecord[] | PKGRecord[], period: 'week' | 'month' | 'year') {
  const now = new Date();
  let startDate = new Date();

  if (period === 'week') {
    startDate.setDate(now.getDate() - now.getDay());
  } else if (period === 'month') {
    startDate.setDate(1);
  } else if (period === 'year') {
    startDate.setMonth(0);
    startDate.setDate(1);
  }

  const filtered = records.filter((record) => {
    const recordDate = new Date((record as any).录入时间);
    return recordDate >= startDate && recordDate <= now;
  });

  return {
    period,
    count: filtered.length,
    totalSettlement: filtered.reduce((sum, r) => sum + r.结算金额, 0),
    records: filtered,
  };
}

// 数据验证和清洗
export function validateAndCleanRecords(records: any[]): QARecord[] | PKGRecord[] {
  return records.filter((record) => {
    // 检查必需字段
    if (!record.录入时间 || !record.商家编码) {
      return false;
    }
    // 检查数值字段
    if (isNaN(record.结算金额) || record.结算金额 < 0) {
      return false;
    }
    return true;
  });
}

// 导出数据为 CSV
export function exportToCSV(records: any[], filename: string) {
  if (records.length === 0) {
    alert('没有数据可导出');
    return;
  }

  const headers = Object.keys(records[0]);
  const csvContent = [
    headers.join(','),
    ...records.map((record) =>
      headers.map((header) => {
        const value = record[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

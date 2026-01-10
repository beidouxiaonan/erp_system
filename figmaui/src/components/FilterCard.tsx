import { useState } from 'react';
import { Search } from 'lucide-react';

interface FilterCardProps {
  pageType: 'qa' | 'pkg';
  onSearch?: (type: string, value: string) => void;
}

export function FilterCard({ pageType, onSearch }: FilterCardProps) {
  const [searchType, setSearchType] = useState(pageType === 'qa' ? '生产单号' : '包装工');
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = () => {
    if (onSearch) {
      onSearch(searchType, searchValue);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-end gap-4">
        {/* Search Type Dropdown */}
        <div className="flex-shrink-0">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            搜索类型
          </label>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            {pageType === 'qa' ? (
              <>
                <option>生产单号</option>
                <option>商家编码</option>
                <option>产品批次号</option>
              </>
            ) : (
              <>
                <option>包装工</option>
                <option>货品名称</option>
              </>
            )}
          </select>
        </div>

        {/* Search Input */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            搜索内容
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={`请输入${searchType}`}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
        >
          执行搜索
        </button>
      </div>
    </div>
  );
}

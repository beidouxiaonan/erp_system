import { Bell, User } from 'lucide-react';

interface TopNavProps {
  user: {
    username: string;
    role: string;
  } | null;
}

export function TopNav({ user }: TopNavProps) {
  const roleNames: Record<string, string> = {
    'admin': '系统管理员',
    'qa': '质检员',
    'pkg': '包装员'
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-gray-800">
           生产管理系统
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* User Info */}
        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200">
            <User className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-gray-900 leading-none mb-1">
                {user?.username || '未登录'}
            </span>
            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                {roleNames[user?.role || ''] || user?.role || '未知角色'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

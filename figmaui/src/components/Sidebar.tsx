import { Upload, ClipboardCheck, Package, BarChart3, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  role?: string;
}

const ALL_MENU_ITEMS = [
  { name: '数据导入', icon: Upload, roles: ['admin'] },
  { name: '质检录入', icon: ClipboardCheck, roles: ['admin', 'qa'] },
  { name: '包装录入', icon: Package, roles: ['admin', 'pkg'] },
  { name: '看板分析', icon: BarChart3, roles: ['admin', 'qa', 'pkg'] },
];

export function Sidebar({ activeMenu, setActiveMenu, role }: SidebarProps) {
  const { logout } = useAuth();

  const filteredItems = ALL_MENU_ITEMS.filter(item => {
    if (!role) return false;
    if (role === 'admin') return true;
    return item.roles.includes(role);
  });

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen">
      <div className="p-4 border-b border-gray-800">
         <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">E</div>
            ERP System
         </h1>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.name;
          
          return (
            <button
              key={item.name}
              onClick={() => setActiveMenu(item.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-red-600 text-white' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-gray-800 transition-colors"
        >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">退出登录</span>
        </button>
      </div>
    </aside>
  );
}

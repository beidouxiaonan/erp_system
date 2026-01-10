import { useState, useEffect } from 'react';
import { Upload, Trash2, UserPlus, RefreshCw, AlertCircle, CheckCircle, Users, Database } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import { useAuth } from '../context/AuthContext';

interface ImportFile {
  file: File;
  name: string;
  type: string;
  size: number;
  status: 'pending' | 'importing' | 'success' | 'error';
  message?: string;
}

interface Worker {
  工号: string;
  姓名: string;
  手机号?: string;
}

export default function DataImportPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'excel' | 'worker' | 'users' | 'database'>('excel');
  
  // 用户表单
  const [users, setUsers] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('qa');
  
  // SQL Console State
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState<{type: string, data?: any[], rows_affected?: number} | null>(null);
  const [executingSql, setExecutingSql] = useState(false);
  const [newName, setNewName] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    setLoadingWorkers(true);
    try {
      const response = await fetch(API_ENDPOINTS.WORKERS);
      if (response.ok) {
        const data = await response.json();
        setWorkers(data);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoadingWorkers(false);
    }
  };

  const fetchUsers = async () => {
    if (user?.role !== 'admin') return;
    setLoadingUsers(true);
    try {
      const response = await fetch(API_ENDPOINTS.USERS);
      if (response.ok) {
        setUsers(await response.json());
      }
    } catch (error) {
       console.error(error);
    } finally {
        setLoadingUsers(false);
    }
  };

  useEffect(() => {
      if (activeTab === 'users') {
          fetchUsers();
      }
  }, [activeTab]);

  const handleAddUser = async () => {
      if (!newUsername || !newPassword || !newName) return;
      try {
          const res = await fetch(API_ENDPOINTS.USERS, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({username: newUsername, password: newPassword, role: newRole, name: newName})
          });
          if (res.ok) {
              setSubmitMessage({type: 'success', text: '用户创建成功'});
              setNewUsername(''); setNewPassword(''); setNewName('');
              fetchUsers();
          } else {
             const err = await res.json(); 
             setSubmitMessage({type: 'error', text: err.detail || '创建失败'});
          }
      } catch (e) {
          setSubmitMessage({type: 'error', text: '请求失败'});
      }
  };

  const handleDeleteUser = async (username: string) => {
      if (!confirm('确定删除该用户吗？')) return;
      try {
          const res = await fetch(`${API_ENDPOINTS.USERS}/${username}`, { method: 'DELETE' });
           if (res.ok) {
              setSubmitMessage({type: 'success', text: '用户删除成功'});
              fetchUsers();
          } else {
             const err = await res.json(); 
             setSubmitMessage({type: 'error', text: err.detail || '删除失败'});
          }
      } catch (e) {
         setSubmitMessage({type: 'error', text: '请求失败'});
      }
  };

  const handleExecuteSQL = async () => {
    if (!sqlQuery.trim()) return;
    setExecutingSql(true);
    setSqlResult(null);
    setSubmitMessage(null);
    try {
      const res = await fetch(API_ENDPOINTS.ADMIN_SQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlQuery })
      });
      if (res.ok) {
        const data = await res.json();
        setSqlResult(data);
        setSubmitMessage({ type: 'success', text: 'SQL执行成功' });
      } else {
        const err = await res.json();
        setSubmitMessage({ type: 'error', text: err.detail || 'SQL执行失败' });
      }
    } catch (e) {
      setSubmitMessage({ type: 'error', text: '请求错误' });
    } finally {
      setExecutingSql(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const newFiles: ImportFile[] = Array.from(selectedFiles).map((file) => ({
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      status: 'pending',
    }));

    setFiles([...files, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (files.length === 0) {
      alert('请先选择要导入的文件');
      return;
    }

    setIsImporting(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 更新状态为导入中
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'importing' as const } : f
      ));

      try {
        const formData = new FormData();
        formData.append('file', file.file);

        const response = await fetch(API_ENDPOINTS.IMPORT_EXCEL, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { 
              ...f, 
              status: 'success' as const, 
              message: result.message 
            } : f
          ));
        } else {
          const error = await response.json();
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { 
              ...f, 
              status: 'error' as const, 
              message: error.detail || '导入失败' 
            } : f
          ));
        }
      } catch (error) {
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { 
            ...f, 
            status: 'error' as const, 
            message: '网络错误，请重试' 
          } : f
        ));
      }
    }

    setIsImporting(false);
  };

  const handleAddWorker = async () => {
    if (!workerId.trim() || !workerName.trim()) {
      setSubmitMessage({ type: 'error', text: '工号和姓名不能为空' });
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.WORKERS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          worker_id: workerId,
          name: workerName,
          phone: workerPhone,
        }),
      });

      if (response.ok) {
        setSubmitMessage({ type: 'success', text: `工人 ${workerName} 档案保存成功！` });
        setWorkerId('');
        setWorkerName('');
        setWorkerPhone('');
        fetchWorkers();
      } else {
        const error = await response.json();
        setSubmitMessage({ type: 'error', text: error.detail || '保存失败' });
      }
    } catch (error) {
      setSubmitMessage({ type: 'error', text: '网络错误，请重试' });
    }

    // 3秒后清除消息
    setTimeout(() => setSubmitMessage(null), 3000);
  };

  const handleDeleteWorker = async (id: string) => {
    if (!confirm('确定要删除该工人吗？')) return;

    try {
      const response = await fetch(`${API_ENDPOINTS.WORKERS}/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchWorkers();
      }
    } catch (error) {
      console.error('Error deleting worker:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">基础数据录入与导入</h1>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('excel')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'excel'
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            📊 Excel数据同步
          </button>
          <button
            onClick={() => setActiveTab('worker')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'worker'
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            👤 工人档案录入
          </button>

          {user?.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'users'
                    ? 'bg-red-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                🛡️ 系统账号管理
              </button>
              <button
                onClick={() => setActiveTab('database')}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'database'
                    ? 'bg-red-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <Database className="inline-block w-4 h-4 mr-2" />
                数据库管理
              </button>
            </>
          )}
        </div>

        {/* Excel Import Tab */}
        {activeTab === 'excel' && (
          <div className="space-y-6">
            {/* 文件上传区域 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">上传 Excel 文件</h2>
              <p className="text-sm text-gray-600 mb-4">
                上传包含订单和价格表的 Excel 文件。第一个工作表为订单数据，第二个工作表为价格表。
              </p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors">
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-gray-900 mb-2">拖拽文件到此处或点击选择</p>
                <p className="text-sm text-gray-500 mb-4">支持 .xlsx、.xls 格式</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  id="fileUpload"
                  onChange={handleFileSelect}
                  multiple
                />
                <label
                  htmlFor="fileUpload"
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium cursor-pointer inline-block"
                >
                  选择文件
                </label>
              </div>

              {/* 已选择的文件列表 */}
              {files.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    已选择 {files.length} 个文件
                  </h3>
                  <div className="space-y-3">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(file.size)}
                            {file.message && (
                              <span className="ml-2">- {file.message}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {file.status === 'pending' && (
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                              待导入
                            </span>
                          )}
                          {file.status === 'importing' && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              导入中...
                            </span>
                          )}
                          {file.status === 'success' && (
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              成功
                            </span>
                          )}
                          {file.status === 'error' && (
                            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              失败
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoveFile(index)}
                            disabled={isImporting}
                            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={handleImport}
                      disabled={isImporting || files.every(f => f.status === 'success')}
                      className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isImporting ? '导入中...' : '🚀 确认同步Excel数据'}
                    </button>
                    <button
                      onClick={() => setFiles([])}
                      disabled={isImporting}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                    >
                      清空
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 导入说明 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Excel格式说明</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">📋 Sheet1: 订单数据</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• 生产单号</li>
                    <li>• 产品批次号</li>
                    <li>• 商家编码</li>
                    <li>• 规格名称</li>
                    <li>• 生产商</li>
                    <li>• 计划生产次数</li>
                    <li>• 状态</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">💰 Sheet2: 价格表</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• 商家编码</li>
                    <li>• 货品编号</li>
                    <li>• 货品名称</li>
                    <li>• 规格名称</li>
                    <li>• 加工点工价</li>
                    <li>• 只包装工价</li>
                    <li>• 剪包工价</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>提示:</strong> 导入将会替换现有数据，请确保备份重要数据。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Worker Tab */}
        {activeTab === 'worker' && (
          <div className="space-y-6">
            {/* 新增工人表单 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">新增工人信息</h2>
              
              {submitMessage && (
                <div className={`mb-4 p-4 rounded-lg ${
                  submitMessage.type === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {submitMessage.text}
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">工号 *</label>
                  <input
                    type="text"
                    value={workerId}
                    onChange={(e) => setWorkerId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="输入工号"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">姓名 *</label>
                  <input
                    type="text"
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="输入姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">手机号</label>
                  <input
                    type="text"
                    value={workerPhone}
                    onChange={(e) => setWorkerPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="输入手机号"
                  />
                </div>
              </div>
              <button
                onClick={handleAddWorker}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                保存工人档案
              </button>
            </div>

            {/* 工人列表 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">当前工人名单</h2>
                <button
                  onClick={fetchWorkers}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingWorkers ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              </div>

              {loadingWorkers ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : workers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">暂无工人数据</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">工号</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">姓名</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">手机号</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {workers.map((worker, idx) => (
                        <tr key={worker.工号 || idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{worker.工号}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{worker.姓名}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{worker.手机号 || '-'}</td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => handleDeleteWorker(worker.工号)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Users Tab */}
        {activeTab === 'users' && user?.role === 'admin' && (
          <div className="space-y-6">
             <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">创建新用户</h2>
              {submitMessage && (
                <div className={`mb-4 p-4 rounded-lg ${
                  submitMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {submitMessage.text}
                </div>
              )}
              <div className="grid grid-cols-4 gap-4 mb-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">账号 *</label>
                  <input type="text" value={newUsername} onChange={e=>setNewUsername(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                 </div>
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">密码 *</label>
                  <input type="text" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                 </div>
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                  <input type="text" value={newName} onChange={e=>setNewName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                 </div>
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                  <select value={newRole} onChange={e=>setNewRole(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                      <option value="admin">管理员</option>
                      <option value="qa">质检员</option>
                      <option value="pkg">包装员</option>
                  </select>
                 </div>
              </div>
              <button onClick={handleAddUser} className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> 创建用户
              </button>
             </div>

             <div className="bg-white rounded-lg shadow-sm p-6">
               <h2 className="text-lg font-semibold text-gray-900 mb-4">系统账号列表</h2>
               <table className="w-full">
                 <thead>
                   <tr className="border-b bg-gray-50">
                     <th className="px-6 py-3 text-left">账号</th>
                     <th className="px-6 py-3 text-left">姓名</th>
                     <th className="px-6 py-3 text-left">角色</th>
                     <th className="px-6 py-3 text-left">操作</th>
                   </tr>
                 </thead>
                 <tbody>
                   {users.map(u => (
                     <tr key={u.username} className="border-b">
                       <td className="px-6 py-3">{u.username}</td>
                       <td className="px-6 py-3">{u.name}</td>
                       <td className="px-6 py-3">
                         <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                           {u.role === 'admin' ? '管理员' : u.role === 'qa' ? '质检员' : '包装员'}
                         </span>
                       </td>
                       <td className="px-6 py-3">
                         {u.username !== 'admin' && (
                           <button onClick={() => handleDeleteUser(u.username)} className="text-red-500 hover:text-red-700">
                             <Trash2 className="w-4 h-4"/>
                           </button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}

        {/* Database Management Tab */}
        {activeTab === 'database' && user?.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">SQL 执行控制台</h2>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4 text-sm text-yellow-800">
                ⚠️ 警告：直接操作数据库风险极大。支持 SELECT, INSERT, UPDATE, DELETE, ALTER TABLE 等指令。
                <br/>
                如果不确定，请先使用 SELECT 语句查询。
              </div>

              {submitMessage && (
                <div className={`mb-4 p-4 rounded-lg ${
                  submitMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {submitMessage.text}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">SQL 语句</label>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full h-32 px-3 py-2 border rounded-lg font-mono text-sm"
                  placeholder="SELECT * FROM qa_log LIMIT 10;"
                />
              </div>
              
              <button
                onClick={handleExecuteSQL}
                disabled={executingSql || !sqlQuery.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {executingSql ? <RefreshCw className="w-4 h-4 animate-spin"/> : '执行 SQL'}
              </button>
            </div>

            {/* SQL Result */}
            {sqlResult && (
              <div className="bg-white rounded-lg shadow-sm p-6 overflow-x-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">执行结果</h3>
                
                {sqlResult.type === 'execute' && (
                  <p className="text-green-600">操作成功，影响行数: {sqlResult.rows_affected}</p>
                )}

                {sqlResult.type === 'select' && sqlResult.data && (
                  <>
                    <p className="text-gray-500 mb-2">查询到 {sqlResult.data.length} 条记录</p>
                    {sqlResult.data.length > 0 ? (
                      <table className="w-full whitespace-nowrap text-sm text-left">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            {Object.keys(sqlResult.data[0]).map(key => (
                              <th key={key} className="px-4 py-2 font-medium text-gray-700 border-r last:border-r-0">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sqlResult.data.map((row, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              {Object.values(row).map((val: any, i) => (
                                <td key={i} className="px-4 py-2 border-r last:border-r-0 max-w-xs truncate" title={String(val)}>
                                  {val === null ? <span className="text-gray-400">NULL</span> : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-gray-400 italic">无数据返回</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

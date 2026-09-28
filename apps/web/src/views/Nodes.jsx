import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Server, 
  Activity, 
  Eye, 
  Settings,
  X,
  Lock,
  Key
} from 'lucide-react';

const Nodes = () => {
  const { 
    user, 
    nodes, 
    addNode, 
    updateNode, 
    deleteNode, 
    toggleNodeActive 
  } = useContext(AppContext);
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ROLE_ADMIN';

  // --- Modal States ---
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState(null);

  // --- Form States ---
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [authMethod, setAuthMethod] = useState('password'); // password | sshKey
  const [description, setDescription] = useState('');
  const [monitorCpu, setMonitorCpu] = useState(true);
  const [monitorDisk, setMonitorDisk] = useState(true);
  const [monitorRam, setMonitorRam] = useState(true);
  const [errors, setErrors] = useState({});

  // Reset form helper
  const resetForm = () => {
    setName('');
    setHost('');
    setPort(22);
    setUsername('');
    setPassword('');
    setSshKey('');
    setAuthMethod('password');
    setDescription('');
    setMonitorCpu(true);
    setMonitorDisk(true);
    setMonitorRam(true);
    setErrors({});
  };

  // Mở modal thêm mới
  const handleOpenAddModal = () => {
    if (!isAdmin) return;
    setIsEditMode(false);
    resetForm();
    setModalOpen(true);
  };

  // Mở modal sửa
  const handleOpenEditModal = (node) => {
    if (!isAdmin) return;
    setIsEditMode(true);
    setCurrentNodeId(node.id);
    setName(node.name);
    setHost(node.host);
    setPort(node.port);
    setUsername(node.username);
    setPassword(''); // Đăng mật khẩu mới nếu nhập
    setSshKey(node.sshKey || '');
    setAuthMethod(node.sshKey ? 'sshKey' : 'password');
    setDescription(node.description || '');
    setMonitorCpu(node.monitorCpu);
    setMonitorDisk(node.monitorDisk);
    setMonitorRam(node.monitorRam);
    setErrors({});
    setModalOpen(true);
  };

  // Validate form
  const validate = () => {
    const tempErrors = {};
    if (!name.trim()) tempErrors.name = 'Tên máy chủ không được trống.';
    if (!host.trim()) {
      tempErrors.host = 'IP hoặc Hostname không được trống.';
    } else {
      // Regex đơn giản cho hostname hoặc IP
      const hostRegex = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$|^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      if (!hostRegex.test(host)) {
        tempErrors.host = 'Sai định dạng Hostname hoặc địa chỉ IP.';
      }
    }
    if (!port || port < 1 || port > 65535) tempErrors.port = 'Cổng kết nối phải từ 1 đến 65535.';
    if (!username.trim()) tempErrors.username = 'Tên đăng nhập SSH không được trống.';
    
    if (authMethod === 'password' && !isEditMode && !password) {
      tempErrors.password = 'Vui lòng nhập mật khẩu SSH.';
    }
    if (authMethod === 'sshKey' && !isEditMode && !sshKey.trim()) {
      tempErrors.sshKey = 'Vui lòng điền nội dung SSH Private Key.';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  // Submit Modal Form
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const nodeData = {
      name,
      host,
      port: parseInt(port),
      username,
      description,
      monitorCpu,
      monitorDisk,
      monitorRam,
      sshKey: authMethod === 'sshKey' ? sshKey : ''
    };
    
    // Nếu nhập mật khẩu mới
    if (authMethod === 'password' && password) {
      nodeData.password = password;
    }

    if (isEditMode) {
      updateNode(currentNodeId, nodeData);
    } else {
      addNode(nodeData);
    }
    setModalOpen(false);
  };

  // Mở modal xác nhận xóa
  const handleOpenDelete = (node) => {
    if (!isAdmin) return;
    setNodeToDelete(node);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (nodeToDelete) {
      deleteNode(nodeToDelete.id);
      setDeleteConfirmOpen(false);
      setNodeToDelete(null);
    }
  };

  // Xác định màu sắc theo ngưỡng tài nguyên
  const getResourceColorClass = (val, enabled) => {
    if (!enabled) return 'text-slate-600 font-mono';
    if (val >= 90) return 'text-red-400 font-bold font-mono';
    if (val >= 80) return 'text-yellow-400 font-bold font-mono';
    return 'text-emerald-400 font-semibold font-mono';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Header and Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs text-slate-400 mt-0.5 leading-normal">
            Danh sách toàn bộ các máy chủ đang được hệ thống theo dõi và kết nối SSH.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/10 active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm máy chủ</span>
          </button>
        )}
      </div>

      {/* Nodes Table Grid */}
      <div className="glass rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/30 text-slate-400 font-medium">
                <th className="py-3.5 px-4">Tên máy chủ</th>
                <th className="py-3.5 px-4">IP / Host</th>
                <th className="py-3.5 px-4">Cổng</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4 text-center">CPU %</th>
                <th className="py-3.5 px-4 text-center">Disk %</th>
                <th className="py-3.5 px-4 text-center">RAM %</th>
                <th className="py-3.5 px-4">Mô tả</th>
                <th className="py-3.5 px-4 text-center">Giám sát</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {nodes.map((node) => (
                <tr key={node.id} className="hover:bg-slate-900/15 text-slate-300 transition-colors">
                  {/* Name Link to detail */}
                  <td className="py-3.5 px-4 font-semibold text-slate-100">
                    <button
                      onClick={() => navigate(`/app/nodes/${node.id}`)}
                      className="text-indigo-400 hover:text-indigo-300 transition-colors hover:underline text-left cursor-pointer flex items-center gap-1.5"
                    >
                      <Server className="w-3.5 h-3.5 text-slate-400" />
                      <span>{node.name}</span>
                    </button>
                  </td>
                  <td className="py-3.5 px-4 font-mono">{node.host}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{node.port}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{node.username}</td>
                  
                  {/* CPU Usage */}
                  <td className="py-3.5 px-4 text-center font-semibold">
                    <span className={getResourceColorClass(node.cpu, node.active && node.monitorCpu)}>
                      {node.active && node.monitorCpu ? `${node.cpu}%` : '-'}
                    </span>
                  </td>

                  {/* Disk Usage */}
                  <td className="py-3.5 px-4 text-center font-semibold">
                    <span className={getResourceColorClass(node.disk, node.active && node.monitorDisk)}>
                      {node.active && node.monitorDisk ? `${node.disk}%` : '-'}
                    </span>
                  </td>

                  {/* RAM Usage */}
                  <td className="py-3.5 px-4 text-center font-semibold">
                    <span className={getResourceColorClass(node.ram, node.active && node.monitorRam)}>
                      {node.active && node.monitorRam ? `${node.ram}%` : '-'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-400" title={node.description}>
                    {node.description || 'Chưa có mô tả.'}
                  </td>

                  {/* Active Toggle Switch */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => isAdmin && toggleNodeActive(node.id)}
                      disabled={!isAdmin}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500/20 ${
                        node.active ? 'bg-indigo-600' : 'bg-slate-800'
                      } ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                      title={!isAdmin ? "Bạn không có quyền thực hiện thao tác này." : ""}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          node.active ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Action buttons */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/app/nodes/${node.id}`)}
                        className="p-1 rounded hover:bg-slate-800/80 text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer"
                        title="Xem chi tiết metrics"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(node)}
                            className="p-1 rounded hover:bg-slate-800/80 text-yellow-500 hover:text-yellow-400 transition-all cursor-pointer"
                            title="Sửa cấu hình"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(node)}
                            className="p-1 rounded hover:bg-slate-800/80 text-red-500 hover:text-red-400 transition-all cursor-pointer"
                            title="Xóa máy chủ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD / EDIT MODAL --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg glass border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-800/80 bg-slate-950/20">
              <h3 className="text-sm font-heading font-semibold text-white">
                {isEditMode ? 'Cập nhật cấu hình máy chủ' : 'Thêm máy chủ giám sát mới'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Tên hiển thị *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="prod-web-01"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-700 transition-colors"
                  />
                  {errors.name && <span className="text-[10px] text-red-400 font-semibold">{errors.name}</span>}
                </div>

                {/* Host */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">IP / Domain *</label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="192.168.1.10"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-700 transition-colors"
                  />
                  {errors.host && <span className="text-[10px] text-red-400 font-semibold">{errors.host}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Port */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Cổng SSH *</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                  {errors.port && <span className="text-[10px] text-red-400 font-semibold">{errors.port}</span>}
                </div>

                {/* Username */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">SSH Username *</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="root"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-700 transition-colors"
                  />
                  {errors.username && <span className="text-[10px] text-red-400 font-semibold">{errors.username}</span>}
                </div>
              </div>

              {/* Authentication Type Tabs */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Phương thức SSH</label>
                <div className="flex gap-2 p-1 bg-slate-950/40 border border-slate-800/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('password')}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      authMethod === 'password' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Mật khẩu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod('sshKey')}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      authMethod === 'sshKey' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Private Key</span>
                  </button>
                </div>
              </div>

              {/* Auth Details */}
              {authMethod === 'password' ? (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                    SSH Password {isEditMode && '(Để trống nếu giữ nguyên)'} *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEditMode ? '••••••••' : 'Nhập mật khẩu SSH...'}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-700 transition-colors"
                  />
                  {errors.password && <span className="text-[10px] text-red-400 font-semibold">{errors.password}</span>}
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                    SSH Private Key {isEditMode && '(Để trống nếu giữ nguyên)'} *
                  </label>
                  <textarea
                    rows={3}
                    value={sshKey}
                    onChange={(e) => setSshKey(e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 focus:border-indigo-500 focus:outline-none placeholder-slate-700 transition-colors"
                  />
                  {errors.sshKey && <span className="text-[10px] text-red-400 font-semibold">{errors.sshKey}</span>}
                </div>
              )}

              {/* Resource Monitoring Checkboxes */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Giám sát các tài nguyên</label>
                <div className="flex gap-4 p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl text-slate-300">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monitorCpu}
                      onChange={(e) => setMonitorCpu(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-900 border-slate-800 focus:ring-0 cursor-pointer"
                    />
                    <span>Monitor CPU</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monitorDisk}
                      onChange={(e) => setMonitorDisk(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-900 border-slate-800 focus:ring-0 cursor-pointer"
                    />
                    <span>Monitor Disk</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monitorRam}
                      onChange={(e) => setMonitorRam(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-900 border-slate-800 focus:ring-0 cursor-pointer"
                    />
                    <span>Monitor RAM</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Mô tả máy chủ</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi chú vai trò máy chủ..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-700 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  {isEditMode ? 'Lưu cấu hình' : 'Thêm mới'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION DIALOG --- */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass border border-red-500/20 rounded-2xl shadow-2xl p-6 space-y-4">
            <h4 className="text-sm font-heading font-bold text-red-400 flex items-center gap-1.5">
              <span>⚠ Cảnh báo xóa máy chủ</span>
            </h4>
            <p className="text-xs text-slate-300 leading-normal">
              Bạn có chắc chắn muốn xóa máy chủ <strong>{nodeToDelete?.name}</strong> ({nodeToDelete?.host})? 
              Hành động này sẽ xóa vĩnh viễn cấu hình kết nối SSH và lịch sử sự cố liên quan.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors shadow-md shadow-red-600/10 cursor-pointer animate-pulse"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Nodes;

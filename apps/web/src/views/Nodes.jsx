import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import { resourceLevel, RESOURCE_TEXT } from '../constants/incidentMeta';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Server, 
  Activity,
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
  const { t } = usePreferences();
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
    if (!name.trim()) tempErrors.name = t('nodes.errors.name');
    if (!host.trim()) {
      tempErrors.host = t('nodes.errors.hostRequired');
    } else {
      // Regex đơn giản cho hostname hoặc IP
      const hostRegex = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$|^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      if (!hostRegex.test(host)) {
        tempErrors.host = t('nodes.errors.hostInvalid');
      }
    }
    if (!port || port < 1 || port > 65535) tempErrors.port = t('nodes.errors.port');
    if (!username.trim()) tempErrors.username = t('nodes.errors.username');
    
    if (authMethod === 'password' && !isEditMode && !password) {
      tempErrors.password = t('nodes.errors.password');
    }
    if (authMethod === 'sshKey' && !isEditMode && !sshKey.trim()) {
      tempErrors.sshKey = t('nodes.errors.sshKey');
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  // Submit Modal Form
  const handleSubmit = async (e) => {
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

    const ok = isEditMode
      ? await updateNode(currentNodeId, nodeData)
      : await addNode(nodeData);
    if (ok) setModalOpen(false);
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
  const getResourceColorClass = (val, enabled) =>
    `font-mono font-semibold ${enabled ? RESOURCE_TEXT[resourceLevel(val)] : RESOURCE_TEXT.off}`;

  const totalMonitored = nodes.filter(n => n.active).length;
  const totalPaused = nodes.length - totalMonitored;

  return (
    <div className="p-6 space-y-6">
      
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-300 mt-0.5 leading-normal">
            {t('nodes.intro')}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/10 active:scale-95 transition-transform cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('nodes.add')}</span>
          </button>
        )}
      </div>

      {/* Top Quick Stats Grid to Balance Layout on Widescreen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tổng máy chủ</span>
            <span className="text-2xl font-extrabold text-slate-100 font-heading tabular-nums">{nodes.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center font-bold">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Đang giám sát</span>
            <span className="text-2xl font-extrabold text-emerald-500 font-heading tabular-nums">{totalMonitored}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center font-bold">
            <span className="w-3 h-3 rounded-full bg-emerald-500 pulse-active" />
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tạm dừng</span>
            <span className="text-2xl font-extrabold text-slate-400 font-heading tabular-nums">{totalPaused}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-900/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-500 flex items-center justify-center font-bold shadow-2xs">
            <span className="w-3 h-3 rounded-full bg-slate-400" />
          </div>
        </div>
      </div>

      {/* Nodes Table Grid */}
      <div className="glass rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-900/60 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">{t('nodes.table.name')}</th>
                <th className="py-3.5 px-4">{t('nodes.table.host')}</th>
                <th className="py-3.5 px-4">{t('nodes.table.port')}</th>
                <th className="py-3.5 px-4">{t('nodes.table.username')}</th>
                <th className="py-3.5 px-4 text-center">CPU %</th>
                <th className="py-3.5 px-4 text-center">Disk %</th>
                <th className="py-3.5 px-4 text-center">RAM %</th>
                <th className="py-3.5 px-4">{t('nodes.table.description')}</th>
                <th className="py-3.5 px-4 text-center">{t('nodes.table.monitoring')}</th>
                <th className="py-3.5 px-4 text-right">{t('nodes.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-slate-800/80 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 shadow-xs">
                        <Server className="w-7 h-7" />
                      </div>
                      <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
                        Chưa có máy chủ nào được giám sát
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                        Thêm máy chủ Linux hoặc Windows qua SSH để tự động thu thập CPU, RAM, Disk và nhận cảnh báo sự cố thời gian thực.
                      </p>
                      {isAdmin && (
                        <button
                          onClick={handleOpenAddModal}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer active:scale-95 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Thêm máy chủ đầu tiên</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                nodes.map((node) => (
                  <tr key={node.id} className="hover:bg-slate-900/80 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 transition-colors">
                    {/* Name Link to detail */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 text-sm">
                      <button
                        onClick={() => navigate(`/app/nodes/${node.id}`)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline transition-colors text-left cursor-pointer flex items-center gap-1.5 font-bold"
                      >
                        <Server className="w-4 h-4 text-slate-400" />
                        <span>{node.name}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 font-semibold">{node.host}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">{node.port}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">{node.username}</td>
                    
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

                    <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-500 dark:text-slate-400" title={node.description}>
                      {node.description || t('nodes.table.noDescription')}
                    </td>

                    {/* Active Toggle Switch */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => isAdmin && toggleNodeActive(node.id)}
                        disabled={!isAdmin}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500/20 ${
                          node.active ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800'
                        } ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                        title={!isAdmin ? t('nodes.noPermission') : ''}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-xs ${
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
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/80 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer"
                          title={t('nodes.viewMetrics')}
                        >
                          <Activity className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(node)}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/80 text-amber-600 dark:text-yellow-500 transition-all cursor-pointer"
                              title={t('nodes.edit')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDelete(node)}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/80 text-rose-600 dark:text-red-500 transition-all cursor-pointer"
                              title={t('nodes.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD / EDIT MODAL --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--soe-overlay)] backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg glass rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-800/80 bg-slate-950/20">
              <h3 className="text-sm font-heading font-semibold text-slate-50">
                {isEditMode ? t('nodes.modal.editTitle') : t('nodes.modal.addTitle')}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-50 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">{t('nodes.modal.name')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="prod-web-01"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-600 transition-colors"
                  />
                  {errors.name && <span className="text-[11px] text-red-400 font-semibold">{errors.name}</span>}
                </div>

                {/* Host */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">{t('nodes.modal.host')}</label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="192.168.1.10"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-600 transition-colors"
                  />
                  {errors.host && <span className="text-[11px] text-red-400 font-semibold">{errors.host}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Port */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">{t('nodes.modal.port')}</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                  {errors.port && <span className="text-[11px] text-red-400 font-semibold">{errors.port}</span>}
                </div>

                {/* Username */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">{t('nodes.modal.username')}</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="root"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-600 transition-colors"
                  />
                  {errors.username && <span className="text-[11px] text-red-400 font-semibold">{errors.username}</span>}
                </div>
              </div>

              {/* Authentication Type Tabs */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1.5">{t('nodes.modal.authMethod')}</label>
                <div className="flex gap-2 p-1 bg-slate-950/40 border border-slate-800/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('password')}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      authMethod === 'password' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t('nodes.modal.password')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod('sshKey')}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      authMethod === 'sshKey' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{t('nodes.modal.privateKey')}</span>
                  </button>
                </div>
              </div>

              {/* Auth Details */}
              {authMethod === 'password' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    {t('nodes.modal.sshPassword')} {isEditMode && t('nodes.modal.keepBlank')} *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEditMode ? '••••••••' : t('nodes.modal.passwordPlaceholder')}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-600 transition-colors"
                  />
                  {errors.password && <span className="text-[11px] text-red-400 font-semibold">{errors.password}</span>}
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    {t('nodes.modal.sshKey')} {isEditMode && t('nodes.modal.keepBlank')} *
                  </label>
                  <textarea
                    rows={3}
                    value={sshKey}
                    onChange={(e) => setSshKey(e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 focus:border-indigo-500 focus:outline-none placeholder-slate-600 transition-colors"
                  />
                  {errors.sshKey && <span className="text-[11px] text-red-400 font-semibold">{errors.sshKey}</span>}
                </div>
              )}

              {/* Resource Monitoring Checkboxes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1.5">{t('nodes.modal.monitorResources')}</label>
                <div className="flex gap-4 p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl text-slate-300">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monitorCpu}
                      onChange={(e) => setMonitorCpu(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-900 border-slate-800 focus:ring-0 cursor-pointer"
                    />
                    <span>{t('nodes.modal.monitor', { resource: 'CPU' })}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monitorDisk}
                      onChange={(e) => setMonitorDisk(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-900 border-slate-800 focus:ring-0 cursor-pointer"
                    />
                    <span>{t('nodes.modal.monitor', { resource: 'Disk' })}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monitorRam}
                      onChange={(e) => setMonitorRam(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-900 border-slate-800 focus:ring-0 cursor-pointer"
                    />
                    <span>{t('nodes.modal.monitor', { resource: 'RAM' })}</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">{t('nodes.modal.description')}</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('nodes.modal.descriptionPlaceholder')}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-600 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  {isEditMode ? t('nodes.modal.submitEdit') : t('nodes.modal.submitAdd')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION DIALOG --- */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--soe-overlay)] backdrop-blur-sm">
          <div className="w-full max-w-sm glass border border-red-500/20 rounded-2xl shadow-2xl p-6 space-y-4">
            <h4 className="text-sm font-heading font-bold text-red-400 flex items-center gap-1.5">
              <span>⚠ {t('nodes.deleteDialog.title')}</span>
            </h4>
            <p className="text-xs text-slate-300 leading-normal">
              {t('nodes.deleteDialog.body', { name: nodeToDelete?.name, host: nodeToDelete?.host })}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors shadow-md shadow-red-600/10 cursor-pointer "
              >
                {t('nodes.deleteDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Nodes;

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Search, ChevronLeft, ChevronRight, ArrowUpDown, Edit, Trash2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';

const JobVacancy = () => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    post: '',
    gender: '',
    department: '',
    prefer: '',
    numberOfPost: '',
    competitionDate: '',
    indentNumber: '',
    timestamp: '',
    experience: '',
    skills: [],
    status: '',
  });
  const [currentSkill, setCurrentSkill] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [indentData, setIndentData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search, Sort, Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('open');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  // Filter and Sort Logic
  const filteredAndSortedData = useMemo(() => {
    let data = indentData.filter(item => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = ['post', 'indentNumber', 'department', 'prefer'].some(key =>
        (item[key]?.toLowerCase() || '').includes(term)
      );
      const matchesTab = activeTab === 'open' ? item.status !== 'Completed' : item.status === 'Completed';
      return matchesSearch && matchesTab;
    });

    if (sortConfig.key) {
      data.sort((a, b) => {
        const valA = (a[sortConfig.key] || '').toString().toLowerCase();
        const valB = (b[sortConfig.key] || '').toString().toLowerCase();
        return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }
    return data;
  }, [indentData, searchTerm, sortConfig, activeTab]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredAndSortedData.slice(indexOfFirstItem, indexOfLastItem);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  useEffect(() => {
    const loadData = async () => {
      setTableLoading(true);
      await fetchIndentDataFromSupabase();
      setTableLoading(false);
    };
    loadData();
  }, []);

  const generateIndentNumber = async () => {
    try {
      const { data } = await supabase.from('job_vacancy').select('indent_number').order('id', { ascending: false }).limit(1).single();
      const lastNum = data?.indent_number ? (parseInt(data.indent_number.match(/\d+/)?.[0]) || 0) : 0;
      return `REC-${String(lastNum + 1).padStart(2, '0')}`;
    } catch (e) { console.error(e); return 'REC-01'; }
  };

  const fetchIndentDataFromSupabase = async () => {
    try {
      const { data, error } = await supabase.from('job_vacancy').select('*').order('id', { ascending: false });
      if (error) throw error;

      const processedData = data.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        indentNumber: item.indent_number,
        post: item.post,
        gender: item.gender,
        department: item.department,
        prefer: item.prefer,
        noOfPost: item.number_of_posts,
        completionDate: item.completion_date,
        experience: item.experience,
        status: item.status,
        createdAt: item.created_at || item.timestamp,
        skills: item.skill_required ? item.skill_required.split(',').map(s => s.trim()).filter(Boolean) : []
      }));
      setIndentData(processedData);
      return { success: true, data: processedData };
    } catch (error) {
      console.error('Error fetching data:', error);
      return { success: false, error: error.message };
    }
  };

  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddSkill = () => {
    if (currentSkill.trim() && !formData.skills.includes(currentSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, currentSkill.trim()]
      }));
      setCurrentSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      post: item.post,
      gender: item.gender,
      department: item.department,
      prefer: item.prefer,
      numberOfPost: item.noOfPost,
      competitionDate: item.completionDate,
      indentNumber: item.indentNumber,
      timestamp: item.timestamp,
      experience: item.experience || '',
      skills: item.skills || [],
      status: item.status || 'NeedMore',
    });
    setCurrentSkill('');
    setShowModal(true);
  };

  const handleComplete = async (id) => {
    if (!window.confirm('Are you sure you want to mark this requirement as completed?')) return;

    try {
      setLoading(true);
      const { error } = await supabase.from('job_vacancy').update({ status: 'Completed' }).eq('id', id);

      if (error) {
        toast.error('Failed to complete: ' + error.message);
      } else {
        toast.success('Requirement marked as completed!');
        await fetchIndentDataFromSupabase();
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this job vacancy?')) return;

    try {
      setLoading(true);
      const { error } = await supabase.from('job_vacancy').delete().eq('id', id);

      if (error) {
        toast.error('Failed to delete: ' + error.message);
      } else {
        toast.success('Job vacancy deleted successfully');
        await fetchIndentDataFromSupabase();
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.post || !formData.gender || !formData.numberOfPost || !formData.competitionDate ||
      (formData.prefer === 'Experience' && !formData.experience)) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        post: formData.post, gender: formData.gender, prefer: formData.prefer,
        number_of_posts: parseInt(formData.numberOfPost), completion_date: formData.competitionDate,
        department: formData.department, status: 'NeedMore',
        experience: formData.prefer === 'Experience' ? formData.experience : null,
        skill_required: formData.skills.length > 0 ? formData.skills.join(', ') : null,
      };

      const query = editingId
        ? supabase.from('job_vacancy').update(payload).eq('id', editingId)
        : supabase.from('job_vacancy').insert([{ ...payload, timestamp: new Date().toISOString(), indent_number: await generateIndentNumber() }]);

      const { error } = await query;
      if (error) throw error;

      toast.success(`Job vacancy ${editingId ? 'updated' : 'created'} successfully!`);

      setFormData({
        post: '', gender: '', department: '', prefer: '', numberOfPost: '',
        competitionDate: '', indentNumber: '', timestamp: '',
        experience: '', skills: [], status: '',
      });
      setCurrentSkill('');
      setShowModal(false);
      setEditingId(null);
      setTableLoading(true);
      await fetchIndentDataFromSupabase();
      setTableLoading(false);
    } catch (error) {
      toast.error('Operation failed: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({ post: '', gender: '', department: '', prefer: '', numberOfPost: '', competitionDate: '', indentNumber: '', timestamp: '', experience: '', skills: [], status: '' });
    setCurrentSkill('');
    setShowModal(false); setEditingId(null);
  };

  const openCount = useMemo(() => indentData.filter(item => item.status !== 'Completed').length, [indentData]);
  const closedCount = useMemo(() => indentData.filter(item => item.status === 'Completed').length, [indentData]);

  return (
    <div className="h-[calc(100vh-11rem)] sm:h-full flex flex-col gap-4 sm:gap-6 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight truncate">Job Vacancy</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage open positions and recruitment needs</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center px-3 py-2 sm:px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200 shrink-0"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Loading...
            </div>
          ) : (
            <div className="flex items-center">
              <Plus size={18} className="mr-2" />
              Create Job
            </div>
          )}
        </button>
      </div>

      {/* Filter and Search */}
      <div className="shrink-0 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-1 w-full sm:max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-600 transition-all font-medium text-sm"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          </div>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg self-start md:self-auto shrink-0">
          <button
            onClick={() => { setActiveTab('open'); setCurrentPage(1); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${activeTab === 'open' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Open Jobs
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'open' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{openCount}</span>
          </button>
          <button
            onClick={() => { setActiveTab('closed'); setCurrentPage(1); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${activeTab === 'closed' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Closed Jobs
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'closed' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{closedCount}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px] max-w-full">
        {/* Table Area */}
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
          <div className="hidden md:block">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 sm:px-6 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Complete
                  </th>
                  {[
                    { key: 'post', label: 'Post' },
                    { key: 'gender', label: 'Gender' },
                    { key: 'department', label: 'Department' },
                    { key: 'prefer', label: 'Prefer' },
                    { key: 'experience', label: 'Experience' },
                    { key: 'noOfPost', label: 'No. of Post' },
                    { key: 'createdAt', label: 'Posted Date' },
                    { key: 'completionDate', label: 'Completion Date' },
                    { key: 'status', label: 'Status' },
                  ].map((header) => (
                    <th
                      key={header.key}
                      onClick={() => handleSort(header.key)}
                      className="px-4 py-3 sm:px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center gap-1">
                        {header.label}
                        <ArrowUpDown size={12} className={`text-slate-400 group-hover:text-indigo-600 ${sortConfig.key === header.key ? 'text-indigo-600' : ''}`} />
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 sm:px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Skills Required
                  </th>
                  <th className="px-4 py-3 sm:px-6 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider sticky right-0 bg-slate-50 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.05)] z-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {tableLoading ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-12 text-center">
                      <div className="flex justify-center flex-col items-center">
                        <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                        <span className="text-slate-500 text-sm">Loading indent data...</span>
                      </div>
                    </td>
                  </tr>
                ) : indentData.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-12 text-center">
                      <p className="text-slate-500">No indent data found.</p>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-center text-sm">
                        {item.status !== 'Completed' ? (
                          <button
                            onClick={() => handleComplete(item.id)}
                            className="text-red-700 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors font-medium flex items-center gap-1.5 mx-auto"
                          >
                            <CheckCircle size={16} />
                            Close Position
                          </button>
                        ) : (
                          <span className="text-green-600 bg-green-50 px-3 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 opacity-80 mx-auto cursor-default">
                            <CheckCircle size={16} />
                            Completed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.post}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.gender}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.department}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.prefer || "Any"}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.experience || "-"}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.noOfPost}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="break-words">
                          {(() => {
                            const d = item.createdAt ? new Date(item.createdAt) : null;
                            if (!d || isNaN(d.getTime())) return "—";
                            return (
                              <div>
                                <div className="font-medium">{d.toLocaleDateString('en-GB')}</div>
                                <div className="text-xs text-slate-400">{d.toLocaleTimeString('en-GB')}</div>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="break-words">
                          {(() => {
                            const d = item.completionDate ? new Date(item.completionDate) : null;
                            if (!d || isNaN(d.getTime())) return "—";
                            return (
                              <div>
                                <div className="font-medium">{d.toLocaleDateString('en-GB')}</div>
                                <div className="text-xs text-slate-400">{d.toLocaleTimeString('en-GB')}</div>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.status === 'Completed' ? 'bg-slate-100 text-slate-800' : 'bg-amber-100 text-amber-800'}`}>
                          {item.status === 'Completed' ? 'Closed' : 'Open'}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-sm text-slate-600">
                        <div className="flex flex-wrap gap-1">
                          {item.skills?.length > 0 ? (
                            item.skills.map((skill, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                {skill}
                              </span>
                            ))
                          ) : (
                            "-"
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.05)] z-10 transition-colors">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            disabled={item.status === 'Completed'}
                            className={`p-2 rounded-lg transition-colors ${item.status === 'Completed' ? 'text-slate-400 bg-slate-100 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100'}`}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={item.status === 'Completed'}
                            className={`p-2 rounded-lg transition-colors ${item.status === 'Completed' ? 'text-slate-400 bg-slate-100 cursor-not-allowed' : 'text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100'}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col p-3 gap-3 bg-slate-50/50">
            {tableLoading ? (
              <div className="py-12 flex justify-center flex-col items-center">
                <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                <span className="text-slate-500 text-sm">Loading indent data...</span>
              </div>
            ) : indentData.length === 0 ? (
              <div className="py-12 text-center text-slate-500 bg-white rounded-xl border border-slate-100">
                <p>No indent data found.</p>
              </div>
            ) : (
              currentItems.map((item, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-slate-800">{item.post}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Posted: {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB') : "—"}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${item.status === 'Completed' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                      {item.status === 'Completed' ? 'Closed' : 'Open'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Dept</span>
                      <span className="font-medium text-slate-800 text-xs mt-0.5">{item.department || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Posts</span>
                      <span className="font-medium text-slate-800 text-xs mt-0.5">{item.noOfPost} ({item.gender})</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Experience</span>
                      <span className="font-medium text-slate-800 text-xs mt-0.5">{item.experience || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Completion</span>
                      <span className="font-medium text-slate-800 text-xs mt-0.5">{item.completionDate ? new Date(item.completionDate).toLocaleDateString('en-GB') : '-'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-100">
                    {item.status !== 'Completed' ? (
                      <button
                        onClick={() => handleComplete(item.id)}
                        className="text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center"
                      >
                        <CheckCircle size={14} className="mr-1.5" /> Close Position
                      </button>
                    ) : (
                      <span className="text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center opacity-80 cursor-default">
                        <CheckCircle size={14} className="mr-1.5" /> Completed
                      </span>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(item)} disabled={item.status === 'Completed'} className={`p-1.5 rounded-lg transition-colors ${item.status === 'Completed' ? 'text-slate-400 bg-slate-100' : 'text-indigo-600 hover:bg-indigo-50'}`}>
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} disabled={item.status === 'Completed'} className={`p-1.5 rounded-lg transition-colors ${item.status === 'Completed' ? 'text-slate-400 bg-slate-100' : 'text-red-600 hover:bg-red-50'}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>



        {/* Pagination */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
          <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                Showing <span className="font-bold text-slate-800">{filteredAndSortedData.length > 0 ? indexOfFirstItem + 1 : 0}</span> to <span className="font-bold text-slate-800">{Math.min(indexOfLastItem, filteredAndSortedData.length)}</span> of{' '}
                <span className="font-bold text-slate-800">{filteredAndSortedData.length}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-3 py-2 rounded-l-xl border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center bg-white border-t border-b border-slate-300 px-4 text-sm font-bold text-indigo-600">
                  {currentPage} <span className="text-slate-300 mx-1">/</span> {totalPages || 1}
                </div>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="relative inline-flex items-center px-3 py-2 rounded-r-xl border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={handleCancel}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-fade-in-up border border-gray-100 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-[#800000] p-4 sm:p-6 text-white shrink-0">
              <div className="flex justify-between items-start">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mb-1">
                  {editingId ? 'Edit Job Vacancy' : 'Create New Job'}
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6 flex-1 custom-scrollbar">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Post (पद) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="post"
                    value={formData.post}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 text-sm"
                    placeholder="Enter post title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Department (विभाग)
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 text-sm"
                  >
                    <option value="">Select Department</option>
                    <option value="Hr">Hr</option>
                    <option value="Admin">Admin</option>
                    <option value="Sms">Sms</option>
                    <option value="Rolling mill">Rolling mill</option>
                    <option value="Sms Lab">Sms Lab</option>
                    <option value="Dispatch">Dispatch</option>
                    <option value="R/M Purchase">R/M Purchase</option>
                    <option value="Store Purchase">Store Purchase</option>
                    <option value="Store">Store</option>
                    <option value="WB (Weightment Bridge)">WB (Weightment Bridge)</option>
                    <option value="HouseKeeping">HouseKeeping</option>
                    <option value="Health & Safety">Health & Safety</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Sales">Sales</option>
                    <option value="AUTOMOBILE">Automobile</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Gender (लिंग) <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 text-sm"
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Any">Any</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Number Of Post (पद की संख्या) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="numberOfPost"
                    value={formData.numberOfPost}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 text-sm"
                    placeholder="Enter number of posts"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Prefer (प्राथमिकता)
                  </label>
                  <select
                    name="prefer"
                    value={formData.prefer}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 text-sm"
                  >
                    <option value="">Any</option>
                    <option value="Experience">Experience</option>
                    <option value="Fresher">Fresher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Competition Date (समापन तिथि) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="competitionDate"
                    value={formData.competitionDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 text-sm"
                    required
                  />
                </div>

                {/* Experience input field */}
                {formData.prefer === "Experience" && (
                  <div className="md:col-span-2 animate-fade-in-up">
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                      Experience (अनुभव) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="experience"
                      value={formData.experience}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 text-sm"
                      placeholder="Enter experience details"
                      required={formData.prefer === "Experience"}
                    />
                  </div>
                )}

                <div className="md:col-span-2 animate-fade-in-up">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                    Skills Required (आवश्यक कौशल)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentSkill}
                      onChange={(e) => setCurrentSkill(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                      className="flex-1 px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 text-sm"
                      placeholder="Enter a skill (e.g. React, Python)"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-medium hover:bg-indigo-200 transition-colors flex items-center justify-center shrink-0"
                    >
                      <Plus size={18} className="mr-1" /> Add
                    </button>
                  </div>
                  {formData.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      {formData.skills.map((skill, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-sm font-medium"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(skill)}
                            className="hover:bg-indigo-200 p-0.5 rounded-full transition-colors text-indigo-500 hover:text-indigo-800"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="border-t border-slate-100 p-4 sm:p-6 bg-slate-50 shrink-0">
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 transition-all duration-200"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  className="w-full sm:w-auto px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-md hover:shadow-lg flex items-center justify-center min-w-[120px] transition-all"
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center">
                      <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </div>
                  ) : (
                    editingId ? "Update Job" : "Submit Vacancy"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default JobVacancy;
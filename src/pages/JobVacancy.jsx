import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Search, ChevronLeft, ChevronRight, ArrowUpDown, Edit, Trash2 } from 'lucide-react';
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
    socialSite: '',
    indentNumber: '',
    timestamp: '',
    experience: '',
    socialSiteTypes: [],
  });
  const [editingId, setEditingId] = useState(null);
  const [indentData, setIndentData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search, Sort, Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  // Filter and Sort Logic
  const filteredAndSortedData = useMemo(() => {
    let data = indentData.filter(item => {
      const term = searchTerm.toLowerCase();
      return ['post', 'indentNumber', 'department', 'prefer'].some(key =>
        (item[key]?.toLowerCase() || '').includes(term)
      );
    });

    if (sortConfig.key) {
      data.sort((a, b) => {
        const valA = (a[sortConfig.key] || '').toString().toLowerCase();
        const valB = (b[sortConfig.key] || '').toString().toLowerCase();
        return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }
    return data;
  }, [indentData, searchTerm, sortConfig]);

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

  // Social site options
  const socialSiteOptions = ['Instagram', 'Facebook', 'LinkedIn', 'Referral', 'Job Consultancy'];

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
        socialSite: item.social_site,
        experience: item.experience,
        socialSiteTypes: item.social_site_types
      }));
      setIndentData(processedData);
      return { success: true, data: processedData };
    } catch (error) {
      console.error('Error fetching data:', error);
      return { success: false, error: error.message };
    }
  };

  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSocialSiteTypeChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      socialSiteTypes: checked ? [...prev.socialSiteTypes, value] : prev.socialSiteTypes.filter(type => type !== value)
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
      socialSite: item.socialSite,
      indentNumber: item.indentNumber,
      timestamp: item.timestamp,
      experience: item.experience || '',
      socialSiteTypes: item.socialSiteTypes ? item.socialSiteTypes.split(', ').map(s => s.trim()) : [],
    });
    setShowModal(true);
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
    if (!formData.post || !formData.gender || !formData.numberOfPost || !formData.competitionDate || !formData.socialSite ||
      (formData.prefer === 'Experience' && !formData.experience) ||
      (formData.socialSite === 'Yes' && formData.socialSiteTypes.length === 0)) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        post: formData.post, gender: formData.gender, prefer: formData.prefer,
        number_of_posts: parseInt(formData.numberOfPost), completion_date: formData.competitionDate,
        social_site: formData.socialSite, department: formData.department, status: 'NeedMore',
        experience: formData.prefer === 'Experience' ? formData.experience : null,
        social_site_types: formData.socialSite === 'Yes' ? formData.socialSiteTypes.join(', ') : null,
      };

      const query = editingId
        ? supabase.from('job_vacancy').update(payload).eq('id', editingId)
        : supabase.from('job_vacancy').insert([{ ...payload, timestamp: new Date().toISOString(), indent_number: await generateIndentNumber() }]);

      const { error } = await query;
      if (error) throw error;

      toast.success(`Job vacancy ${editingId ? 'updated' : 'created'} successfully!`);

      setFormData({
        post: '', gender: '', department: '', prefer: '', numberOfPost: '',
        competitionDate: '', socialSite: '', indentNumber: '', timestamp: '',
        experience: '', socialSiteTypes: [],
      });
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
    setFormData({ post: '', gender: '', department: '', prefer: '', numberOfPost: '', competitionDate: '', socialSite: '', indentNumber: '', timestamp: '', experience: '', socialSiteTypes: [] });
    setShowModal(false); setEditingId(null);
  };

  return (
    <div className="h-full flex flex-col gap-4 sm:gap-6 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Job Vacancy</h1>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Loading...
            </>
          ) : (
            <>
              <Plus size={16} className="mr-2" />
              Create Job
            </>
          )}
        </button>
      </div>

      {/* Filter and Search */}
      <div className="shrink-0 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-600 transition-all font-medium"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Table Area */}
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                {[
                  { key: 'indentNumber', label: 'Indent Number' },
                  { key: 'post', label: 'Post' },
                  { key: 'gender', label: 'Gender' },
                  { key: 'department', label: 'Department' },
                  { key: 'prefer', label: 'Prefer' },
                  { key: 'experience', label: 'Experience' },
                  { key: 'noOfPost', label: 'No. of Post' },
                  { key: 'completionDate', label: 'Completion Date' },
                  { key: 'socialSite', label: 'Social Site' },
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
                  Social Types
                </th>
                <th className="px-4 py-3 sm:px-6 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
                    <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {item.indentNumber}
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
                    <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                      {item.socialSite}
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                      {item.socialSiteTypes}
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition-colors"
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

        {/* Pagination */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-700">
                Showing <span className="font-medium">{filteredAndSortedData.length > 0 ? indexOfFirstItem + 1 : 0}</span> to <span className="font-medium">{Math.min(indexOfLastItem, filteredAndSortedData.length)}</span> of{' '}
                <span className="font-medium">{filteredAndSortedData.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => paginate(i + 1)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === i + 1
                      ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                      : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                      }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-all"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancel();
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-white shrink-0">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                {editingId ? 'Edit Job Vacancy' : 'Create New Job'}
              </h3>
              <button
                onClick={handleCancel}
                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6 flex-1">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Post (पद) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="post"
                    value={formData.post}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    placeholder="Enter post title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Department (विभाग)
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Gender (लिंग) <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Any">Any</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Number Of Post (पद की संख्या) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="numberOfPost"
                    value={formData.numberOfPost}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    placeholder="Enter number of posts"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Prefer (प्राथमिकता)
                  </label>
                  <select
                    name="prefer"
                    value={formData.prefer}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                  >
                    <option value="">Any</option>
                    <option value="Experience">Experience</option>
                    <option value="Fresher">Fresher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Competition Date (समापन तिथि) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="competitionDate"
                    value={formData.competitionDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    required
                  />
                </div>

                {/* Experience input field */}
                {formData.prefer === "Experience" && (
                  <div className="md:col-span-2 animate-fade-in-up">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Experience (अनुभव) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="experience"
                      value={formData.experience}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                      placeholder="Enter experience details"
                      required={formData.prefer === "Experience"}
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Social Site (सोशल साइट) <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="socialSite"
                    value={formData.socialSite}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {/* Social Site Types checklist */}
                {formData.socialSite === "Yes" && (
                  <div className="md:col-span-2 animate-fade-in-up">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Social Site Types (सोशल साइट प्रकार) <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
                      {socialSiteOptions.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={option}
                            value={option}
                            checked={formData.socialSiteTypes.includes(option)}
                            onChange={handleSocialSiteTypeChange}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                          />
                          <label
                            htmlFor={option}
                            className="text-sm text-slate-700 cursor-pointer select-none font-medium"
                          >
                            {option}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="border-t border-slate-100 p-4 sm:p-6 bg-white shrink-0">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 transition-all duration-200"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center min-w-[100px]"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Wait...
                    </>
                  ) : (
                    editingId ? "Update" : "Submit"
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
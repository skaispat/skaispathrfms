import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import useAuthStore from '../store/authStore';
import { Search, Image as ImageIcon, CheckCircle, XCircle, Clock, Calendar, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const Visitors = () => {
  const { user } = useAuthStore();
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');

  const isAdmin = user?.role === 'admin' || user?.role === 'Admin' || user?.Admin === 'Yes' || user?.role === 'hr' || user?.role === 'HR';

  useEffect(() => {
    if (user) {
      fetchVisitors();
      fetchEmployees();
    }
  }, [user]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('emp_id, full_name');
      if (error) throw error;
      if (data) {
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('visitors')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        // If not admin, get only records matching logged in employee's emp_id
        query = query.eq('person_to_meet', user?.emp_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setVisitors(data || []);
    } catch (error) {
      console.error('Error fetching visitors:', error);
      toast.error('Failed to load visitors data');
    } finally {
      setLoading(false);
    }
  };

  const getISTTimestamp = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    return dayjs(ist).format('YYYY-MM-DD HH:mm:ss.SSS');
  };

  const handleApprovalAction = async (id, isApprove) => {
    try {
      const { error } = await supabase
        .from('visitors')
        .update({
          approval_status: isApprove,
          approved_by: user?.full_name || user?.Name || 'System',
          approved_at: getISTTimestamp()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(isApprove ? 'Visitor Approved' : 'Visitor Rejected');
      fetchVisitors();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const filteredVisitors = visitors.filter(v => {
    const searchLower = searchTerm.toLowerCase();
    const employeeName = employees.find(emp => String(emp.emp_id) === String(v.person_to_meet))?.full_name || v.person_to_meet;

    return (
      v.visitor_name?.toLowerCase().includes(searchLower) ||
      v.mobile_number?.includes(searchTerm) ||
      employeeName?.toLowerCase().includes(searchLower) ||
      v.purpose_of_visit?.toLowerCase().includes(searchLower) ||
      v.visitor_address?.toLowerCase().includes(searchLower) ||
      v.approved_by?.toLowerCase().includes(searchLower) ||
      v.in_time?.toLowerCase().includes(searchLower) ||
      v.out_time?.toLowerCase().includes(searchLower)
    );
  });

  const displayVisitors = filteredVisitors.filter(v => {
    if (activeTab === 'pending') return v.approval_status === null || v.approval_status === undefined;
    if (activeTab === 'approved') return v.approval_status === true;
    return true;
  });

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return dayjs(dateString).format('DD MMM YYYY, hh:mm A');
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0 px-4 sm:px-6 pt-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">Visitors Log</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage and track visitor records</p>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col mx-4 sm:mx-6 mb-4 sm:mb-6">
        {/* Toolbar: Tabs & Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-lg border border-slate-200/50 w-max">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === "pending"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              onClick={() => setActiveTab("pending")}
            >
              <Clock size={16} className="inline mr-2" />
              Pending
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === "pending" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                }`}>
                {visitors.filter(v => v.approval_status === null || v.approval_status === undefined).length}
              </span>
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === "approved"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              onClick={() => setActiveTab("approved")}
            >
              <CheckCircle size={16} className="inline mr-2" />
              Approved
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === "approved" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                }`}>
                {visitors.filter(v => v.approval_status === true).length}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm w-full">
            <input
              type="text"
              placeholder="Search by name or contact..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-slate-50/30">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar">

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">Visitor Details</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">To Meet</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">Purpose</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">Approved By</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">Timing</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">Photo</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan="9" className="px-6 py-4 text-center text-slate-500">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                            <span>Loading...</span>
                          </div>
                        </td>
                      </tr>
                    ) : displayVisitors.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                          No visitors found in this tab.
                        </td>
                      </tr>
                    ) : (
                      displayVisitors.map((visitor) => (
                        <tr key={visitor.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-slate-900">{visitor.visitor_name}</div>
                            <div className="text-sm text-slate-500 max-w-xs truncate" title={visitor.visitor_address}>
                              {visitor.visitor_address}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                            {employees.find(emp => String(emp.emp_id) === String(visitor.person_to_meet))?.full_name || visitor.person_to_meet}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate" title={visitor.purpose_of_visit}>
                            {visitor.purpose_of_visit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {visitor.approved_by || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            <div className="flex flex-col gap-1">
                              <span className="flex items-center gap-1">
                                <span className="text-green-600 text-xs font-medium w-8">IN:</span>
                                {formatDate(visitor.in_time)}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="text-red-500 text-xs font-medium w-8">OUT:</span>
                                {formatDate(visitor.out_time)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-max ${visitor.approval_status === true ? 'bg-green-100 text-green-800' :
                                visitor.approval_status === false ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                {visitor.approval_status === true ? 'Approved' : visitor.approval_status === false ? 'Rejected' : 'Pending'}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-max ${visitor.status ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                                }`}>
                                {/* {visitor.status ? 'IN' : 'OUT'} */}
                              </span>
                              {visitor.approved_at && (
                                <span className="text-[10px] text-slate-400">
                                  At: {dayjs(visitor.approved_at).format('DD MMM YYYY, hh:mm A')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {visitor.visitor_photo ? (
                              <button
                                onClick={() => setSelectedPhoto(visitor.visitor_photo)}
                                className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                              >
                                <ImageIcon size={16} />
                                <span>View Photo</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs italic">No Photo</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {(visitor.approval_status === null || visitor.approval_status === undefined) ? (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleApprovalAction(visitor.id, true)}
                                  className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleApprovalAction(visitor.id, false)}
                                  className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className={`text-xs font-medium ${visitor.approval_status ? 'text-green-600' : 'text-red-600'}`}>
                                {visitor.approval_status ? 'Approved' : 'Rejected'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {loading ? (
                <div className="text-center py-8 text-slate-500">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    <span>Loading...</span>
                  </div>
                </div>
              ) : displayVisitors.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200">
                  No visitors found in this tab.
                </div>
              ) : (
                displayVisitors.map((visitor) => (
                  <div key={visitor.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start gap-3">
                        {visitor.visitor_photo ? (
                          <img
                            src={visitor.visitor_photo}
                            alt={visitor.visitor_name}
                            onClick={() => setSelectedPhoto(visitor.visitor_photo)}
                            className="w-14 h-14 rounded-lg object-cover border border-slate-200 shadow-sm cursor-pointer"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                            <ImageIcon size={20} />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-slate-900 leading-tight">{visitor.visitor_name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            To meet: {employees.find(emp => String(emp.emp_id) === String(visitor.person_to_meet))?.full_name || visitor.person_to_meet}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">Purpose: {visitor.purpose_of_visit}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${visitor.approval_status === true ? 'bg-green-100 text-green-700' :
                        visitor.approval_status === false ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                        {visitor.approval_status === true ? 'Approved' : visitor.approval_status === false ? 'Rejected' : 'Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-medium mb-0.5">In Time</span>
                        <span className="font-medium text-slate-700">{formatDate(visitor.in_time)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-medium mb-0.5">Out Time</span>
                        <span className="font-medium text-slate-700">{formatDate(visitor.out_time)}</span>
                      </div>
                    </div>

                    {visitor.approval_status !== null && visitor.approval_status !== undefined && (
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-2 px-1">
                        <span>By: {visitor.approved_by || 'System'}</span>
                        {visitor.approved_at && <span>{dayjs(visitor.approved_at).format('DD MMM YYYY, hh:mm A')}</span>}
                      </div>
                    )}

                    {(visitor.approval_status === null || visitor.approval_status === undefined) && (
                      <div className="flex gap-2 mt-2 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => handleApprovalAction(visitor.id, true)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 text-green-700 hover:bg-green-100 py-2.5 rounded-lg text-xs font-semibold transition-colors border border-green-100"
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          onClick={() => handleApprovalAction(visitor.id, false)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100 py-2.5 rounded-lg text-xs font-semibold transition-colors border border-red-100"
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-lg w-full max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full"
              onClick={() => setSelectedPhoto(null)}
            >
              <X size={24} />
            </button>
            <img
              src={selectedPhoto}
              alt="Visitor"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Visitors;


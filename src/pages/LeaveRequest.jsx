import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Calendar, Plus, User, FileText, CheckCircle, AlertCircle, X, History, Briefcase, Users, Search, ChevronDown, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import useAuthStore from '../store/authStore';

const LeaveRequest = () => {
  const { user } = useAuthStore();

  // State
  const [loading, setLoading] = useState(true);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({
    casual: { total: 12, used: 0, remaining: 12 },
    earned: { total: 24, used: 0, remaining: 24 },
    unpaid: { used: 0 }
  });
  const [hasAppliedThisMonth, setHasAppliedThisMonth] = useState(false);
  const [hodDetails, setHodDetails] = useState({ name: 'Not Assigned', id: null });
  const [hrDetails, setHrDetails] = useState({ name: 'HR Department', id: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: '',
    fromDate: '',
    toDate: '',
    reason: ''
  });

  // Fetch Data on component mount
  useEffect(() => {
    if (user) {
      fetchUserDataAndHistory();
    }
  }, [user]);

  const fetchUserDataAndHistory = async () => {
    setLoading(true);
    try {
      // 1. Fetch HOD Details
      // First get hod_id from team_members
      const { data: teamData, error: teamError } = await supabase
        .from('team_members')
        .select('hod_id')
        .eq('emp_id', user.emp_id)
        .maybeSingle();

      if (teamData?.hod_id) {
        // Then get HOD name from users
        const { data: hodUser, error: hodUserError } = await supabase
          .from('users')
          .select('full_name')
          .eq('emp_id', teamData.hod_id)
          .single();

        if (hodUser) {
          setHodDetails({ name: hodUser.full_name, id: teamData.hod_id });
        } else {
          setHodDetails({ name: 'HR', id: null });
        }
      } else {
        setHodDetails({ name: 'HR', id: null });
      }

      // 2. Fetch HR Details
      const { data: hrData } = await supabase
        .from('users')
        .select('full_name, emp_id')
        .eq('department', 'HR')
        .order('is_hod', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (hrData) {
        setHrDetails({ name: hrData.full_name, id: hrData.emp_id });
      }
      // 2. Fetch Leave History for this user
      const { data: historyData, error: historyError } = await supabase
        .from('leave_management')
        .select('*')
        .eq('emp_id', user.emp_id)
        .order('timestamp', { ascending: false });

      if (historyError) throw historyError;

      setLeaveHistory(historyData);

      // 3. Calculate Balances & Check This Month's application
      calculateBalancesAndStatus(historyData);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load your leave data.');
    } finally {
      setLoading(false);
    }
  };

  const calculateBalancesAndStatus = (history) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    let casualUsed = 0;
    let earnedUsed = 0;
    let unpaidUsed = 0;
    let appliedThisMonth = false;

    history.forEach(leave => {
      const leaveDate = new Date(leave.timestamp); // Use submission date for "applied this month" check
      const leaveYear = new Date(leave.leave_date_start).getFullYear();

      // Check if applied in current month (based on submission timestamp)
      if (leaveDate.getMonth() === currentMonth && leaveDate.getFullYear() === currentYear) {
        appliedThisMonth = true;
      }

      // Calculate Usage for Approved leaves in current year
      if (leave.status === 'Approved' && leaveYear === currentYear) {
        const days = calculateDays(leave.leave_date_start, leave.leave_date_end);

        switch (leave.leave_type) {
          case 'Casual Leave':
            casualUsed += days;
            break;
          case 'Earned Leave':
            earnedUsed += days;
            break;
          case 'UnPaid Leave':
            unpaidUsed += days;
            break;
          default:
            break;
        }
      }
    });

    setLeaveBalances({
      casual: { total: 12, used: casualUsed, remaining: 12 - casualUsed },
      earned: { total: 24, used: earnedUsed, remaining: 24 - earnedUsed },
      unpaid: { used: unpaidUsed }
    });

    setHasAppliedThisMonth(appliedThisMonth);
  };

  const calculateDays = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leaveType || !formData.fromDate || !formData.toDate || !formData.reason) {
      toast.error('Please fill all required fields');
      return;
    }

    if (hasAppliedThisMonth) {
      toast.error('You have already applied for leave this month.');
      return;
    }

    setSubmitting(true);
    try {
      const insertData = {
        timestamp: new Date().toISOString(),
        emp_id: user.emp_id,
        employee_name: user.full_name || user.Name, // Handle generic user object field variations
        leave_date_start: formData.fromDate,
        leave_date_end: formData.toDate,
        remarks: formData.reason,
        status: hodDetails.name === 'HR' ? 'Pending HR' : 'Pending',
        leave_type: formData.leaveType,
        hod_name: hodDetails.name,
        designation: user.designation || user.role, // Fallback if designation missing
        hod_id: hodDetails.id,
        hr_id: hrDetails.id
      };

      const { data, error } = await supabase
        .from('leave_management')
        .insert([insertData])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        await supabase.from('logs').insert({
          request_id: data[0].id,
          request_type: 'Leave',
          emp_id: user.emp_id,
          emp_name: user.full_name || user.Name,
          status: insertData.status,
          hod_id: hodDetails.id,
          hod_name: hodDetails.name,
          hr_id: hrDetails.id,
          hr_name: hrDetails.name
        });
      }

      if (error) throw error;

      toast.success('Leave Request Submitted Successfully');
      setShowModal(false);
      setFormData({ leaveType: '', fromDate: '', toDate: '', reason: '' });
      fetchUserDataAndHistory(); // Refresh data

    } catch (error) {
      console.error('Submission Error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors = {
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    default: 'bg-slate-100 text-slate-800'
  };

  const getStatusColor = (status) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('approved')) return statusColors.approved;
    if (s.includes('rejected')) return statusColors.rejected;
    if (s.includes('pending')) return statusColors.pending;
    return statusColors.default;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredHistory = leaveHistory.filter(item => {
    const matchesSearch =
      item.leave_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.remarks?.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'pending') return matchesSearch && (item.status === 'Pending' || item.status === 'Pending HR');
    if (activeTab === 'approved') return matchesSearch && item.status?.toLowerCase() === 'approved';
    if (activeTab === 'rejected') return matchesSearch && item.status?.toLowerCase().includes('rejected');
    return matchesSearch;
  });

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">My Leave Request</h1>
          <p className="text-slate-500 mt-1 text-sm">View your leave balance and history</p>
        </div>
        <button
          onClick={() => !hasAppliedThisMonth && setShowModal(true)}
          disabled={hasAppliedThisMonth}
          className={`inline-flex items-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 
            ${hasAppliedThisMonth
              ? 'bg-slate-400 cursor-not-allowed shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          <Plus size={18} className="mr-2" />
          {hasAppliedThisMonth ? 'Monthly Limit Reached' : 'New Leave Request'}
        </button>
      </div>

      {hasAppliedThisMonth && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center gap-4 shrink-0">
          <div className="p-2 bg-orange-100 rounded-full text-orange-600">
            <AlertCircle size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-orange-900">Monthly Application Limit</h4>
            <p className="text-sm text-orange-700 mt-0.5">
              You've already submitted a request this month. Only one request is allowed per month.
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {[
          {
            label: 'Casual Leave',
            code: 'CL',
            balance: leaveBalances.casual,
            color: 'indigo',
            icon: Calendar
          },
          {
            label: 'Earned Leave',
            code: 'EL',
            balance: leaveBalances.earned,
            color: 'emerald',
            icon: Briefcase
          },
          {
            label: 'Unpaid Leave',
            code: 'LOP',
            balance: leaveBalances.unpaid,
            isUsageOnly: true,
            color: 'rose',
            icon: AlertCircle
          }
        ].map((stat) => (
          <div
            key={stat.label}
            className="group bg-white rounded-xl p-4 border border-slate-200 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md"
          >
            <div className={`absolute top-0 right-0 p-5 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity text-${stat.color}-600 transform scale-150 rotate-12`}>
              <stat.icon size={80} />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-${stat.color}-50 text-${stat.color}-600 ring-1 ring-${stat.color}-100`}>
                    <stat.icon size={16} />
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 uppercase tracking-wider`}>
                    {stat.code}
                  </span>
                </div>
                <h3 className="text-slate-500 font-medium text-xs uppercase tracking-wide">{stat.label}</h3>
              </div>

              <div className="mt-2">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold text-slate-900 tracking-tight`}>
                    {stat.isUsageOnly ? stat.balance.used : stat.balance.remaining}
                  </span>
                  {!stat.isUsageOnly && <span className="text-slate-400 font-medium text-xs">/ {stat.balance.total}</span>}
                  {stat.isUsageOnly && <span className="text-slate-400 font-medium text-xs">Taken</span>}
                </div>

                {!stat.isUsageOnly ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] font-medium text-slate-400 mb-1.5">
                      <span>Remaining</span>
                      <span>{Math.round((stat.balance.remaining / stat.balance.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`bg-${stat.color}-500 h-full rounded-full transition-all duration-1000 ease-out`}
                        style={{ width: `${(stat.balance.remaining / stat.balance.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-[10px] text-slate-400 font-medium">Recorded as Loss of Pay</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {/* Toolbar: Tabs + Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-lg border border-slate-200/50">
            {['all', 'pending', 'approved', 'rejected'].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${isActive
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              );
            })}
          </div>

          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Search leaves..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type & Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Leave Period</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => {
                  // Combined status Logic for cleaner UI like LeaveManagement
                  const getCombinedStatus = (status) => {
                    const s = status?.toLowerCase() || '';
                    if (s === 'pending') return { label: 'Pending HOD', classes: 'bg-yellow-100 text-yellow-800' };
                    if (s === 'pending hr') return { label: 'Pending HR', classes: 'bg-blue-100 text-blue-800' };
                    if (s === 'approved') return { label: 'Approved', classes: 'bg-green-100 text-green-800' };
                    if (s.includes('rejected')) return { label: 'Rejected', classes: 'bg-red-100 text-red-800' };
                    return { label: status, classes: 'bg-slate-100 text-slate-800' };
                  };

                  const statusObj = getCombinedStatus(item.status);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 text-sm">{item.leave_type}</span>
                          <span className="text-xs text-slate-400 mt-0.5">{formatDate(item.timestamp)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">
                          {formatDate(item.leave_date_start)} - {formatDate(item.leave_date_end)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {calculateDays(item.leave_date_start, item.leave_date_end)} Days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusObj.classes}`}>
                          {statusObj.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-500 truncate max-w-[200px]" title={item.remarks}>
                          {item.remarks}
                        </p>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <FileText size={48} className="mb-4 text-slate-200" />
                      <p className="text-lg font-medium text-slate-900">No requests found</p>
                      <p className="text-sm mt-1 text-slate-500">Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Aligned styled with LeaveManagement */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-all duration-300">
          <div
            className="absolute inset-0 bg-transparent"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all border border-slate-100 animate-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <h3 className="text-xl font-semibold text-slate-800 tracking-tight">New Leave Request</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 scrollbar-thin">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Employee & HOD & HR Info Banner */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Logged In User */}
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-500 border border-slate-100 shadow-sm shrink-0">
                      <User size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Employee</p>
                      <p className="font-semibold text-sm text-slate-900 break-words leading-tight">{user?.full_name || user?.Name || 'User'}</p>
                    </div>
                  </div>

                  {/* Approving Authority (HOD) */}
                  <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm shrink-0">
                      <Users size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-0.5">HOD</p>
                      <p className="font-semibold text-sm text-slate-900 break-words leading-tight">
                        {hodDetails.name === 'Not Assigned' ? 'HR' : hodDetails.name}
                      </p>
                    </div>
                  </div>

                  {/* HR Authority */}
                  <div className="flex items-center gap-3 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-purple-600 border border-purple-100 shadow-sm shrink-0">
                      <Shield size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-0.5">HR</p>
                      <p className="font-semibold text-sm text-slate-900 break-words leading-tight">{hrDetails.name}</p>
                    </div>
                  </div>
                </div>

                {/* Leave Type */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Leave Type <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FileText size={18} className="text-slate-400 group-focus-within:text-indigo-500" />
                    </div>
                    <select
                      name="leaveType"
                      value={formData.leaveType}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 pl-10 pr-10 py-3 text-slate-700 bg-white hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                      required
                    >
                      <option value="">Select Type...</option>
                      <option value="Casual Leave">Casual Leave</option>
                      <option value="Earned Leave">Earned Leave</option>
                      <option value="UnPaid Leave">UnPaid Leave</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <ChevronDown size={16} className="text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Date Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Start Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      name="fromDate"
                      value={formData.fromDate}
                      onChange={(e) => {
                        const newFrom = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          fromDate: newFrom,
                          toDate: (prev.toDate && new Date(newFrom) > new Date(prev.toDate)) ? '' : prev.toDate
                        }));
                      }}
                      className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-3 px-3 bg-white"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">End Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      name="toDate"
                      value={formData.toDate}
                      min={formData.fromDate}
                      onChange={(e) => {
                        const newTo = e.target.value;
                        if (!formData.fromDate || new Date(newTo) >= new Date(formData.fromDate)) {
                          setFormData(prev => ({ ...prev, toDate: newTo }));
                        }
                      }}
                      className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-3 px-3 bg-white"
                      required
                    />
                  </div>
                </div>

                {/* Duration Display - Matching style */}
                {formData.fromDate && formData.toDate && (
                  <div className="bg-indigo-50 rounded-lg p-3 flex items-center justify-between border border-indigo-100">
                    <span className="text-sm font-medium text-indigo-900">Total Duration:</span>
                    <span className="text-sm font-bold text-indigo-700">
                      {calculateDays(formData.fromDate, formData.toDate)} Days
                    </span>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Reason <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <FileText size={18} className="text-slate-400 group-focus-within:text-indigo-500" />
                    </div>
                    <textarea
                      name="reason"
                      rows={3}
                      value={formData.reason}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 pl-10 py-3 text-slate-700 bg-white focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                      placeholder="Briefly describe why you are requesting this leave..."
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 mt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-8 py-2.5 rounded-xl shadow-lg shadow-indigo-200 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:-translate-y-0.5 ${submitting ? 'opacity-70 cursor-not-allowed transform-none' : ''}`}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </span>
                    ) : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LeaveRequest;
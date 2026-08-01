import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Calendar, Plus, User, FileText, CheckCircle, AlertCircle, X, History, Briefcase, Users, Search, ChevronDown, Shield, Send, CloudFog } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLeaveRequestInitialData, createLeaveRequestWithLog } from '../api/leaveRequestApi';
import useAuthStore from '../store/authStore';
import { sendWhatsappMessageToHod } from "../whatsappMessageSender/whatsappMessageSender.js";
import { calculateLeaveSplitsDayByDay } from "../utils/leaveCalculations.js";

// Fiscal year helper: April–March
const getFiscalYear = (date = new Date()) => {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
};

const LeaveRequest = () => {
  const { user } = useAuthStore();

  // State
  const [loading, setLoading] = useState(true);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [currentMonthlyCount, setCurrentMonthlyCount] = useState(0);
  const [leaveBalances, setLeaveBalances] = useState({
    casual: { total: 12, used: 0, remaining: 12 },
    earned: { total: 24, used: 0, remaining: 24 },
    unpaid: { used: 0 }
  });
  const [isLeaveAllowedByAdmin, setIsLeaveAllowedByAdmin] = useState(true);
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
  const [dateError, setDateError] = useState(null);

  // Fetch Data on component mount
  useEffect(() => {
    if (user) {
      fetchUserDataAndHistory();
    }
  }, [user]);

  const fetchUserDataAndHistory = async () => {
    setLoading(true);
    try {
      const {
        teamData,
        hodUser,
        hrData,
        userData,
        historyData,
        balanceData,
        quotaData
      } = await getLeaveRequestInitialData(user.emp_id, getFiscalYear());

      if (teamData?.hod_id && hodUser) {
        setHodDetails({ name: hodUser.full_name, id: teamData.hod_id, department: hodUser.department, phone_number: hodUser.phone_number });
      } else {
        setHodDetails({ name: 'Not Assigned', id: null });
      }

      if (hrData) {
        setHrDetails({ name: hrData.full_name, id: hrData.emp_id });
      } else {
        setHrDetails({ name: 'Pawan Tiwari', id: 1 });
      }

      if (userData) {
        setIsLeaveAllowedByAdmin(userData.is_leave_allowed !== false);
      }

      setLeaveHistory(historyData);

      const carriedForwardEL = quotaData?.carried_forward_el || 0;

      if (balanceData) {
        setLeaveBalances({
          casual: {
            total: 12,
            used: 12 - (balanceData.casual_leave_remaining ?? 12),
            remaining: balanceData.casual_leave_remaining ?? 12
          },
          earned: {
            total: 24,
            used: 24 - (balanceData.earned_leave_remaining ?? 24),
            remaining: (balanceData.earned_leave_remaining ?? 24) + carriedForwardEL,
            actualRemaining: balanceData.earned_leave_remaining ?? 24,
            carriedForward: carriedForwardEL
          },
          unpaid: { used: balanceData.unpaid_leave_total_taken ?? 0 }
        });
      }

      // 6. Calculate monthly count and daily status
      calculateBalancesAndStatus(historyData, !!balanceData, carriedForwardEL);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load your leave data.');
    } finally {
      setLoading(false);
    }
  };

  const calculateBalancesAndStatus = (history, hasViewData = false, carriedForwardEL = 0) => {
    const currentYear = getFiscalYear();
    const currentMonth = new Date().getMonth();
    const currentDate = new Date().getDate();

    let casualUsed = 0;
    let earnedUsed = 0;
    let unpaidUsed = 0;
    let monthlyCount = 0;

    history.forEach(leave => {
      const leaveDate = new Date(leave.timestamp);
      const leaveYear = getFiscalYear(new Date(leave.leave_date_start));

      if (leaveDate.getMonth() === currentMonth && leaveDate.getFullYear() === currentYear) {
        monthlyCount++;
      }

      if (!hasViewData && leave.status?.toLowerCase().includes('approved') && leaveYear === currentYear) {
        const days = calculateDays(leave.leave_date_start, leave.leave_date_end);
        if (leave.leave_type === 'Casual Leave') casualUsed += days;
        else if (leave.leave_type === 'Earned Leave') earnedUsed += days;
        else if (leave.leave_type === 'UnPaid Leave') unpaidUsed += days;
      }
    });

    if (!hasViewData) {
      setLeaveBalances({
        casual: { total: 12, used: casualUsed, remaining: 12 - casualUsed },
        earned: {
          total: 24,
          used: earnedUsed,
          remaining: 24 + carriedForwardEL - earnedUsed,
          actualRemaining: 24 - earnedUsed,
          carriedForward: carriedForwardEL
        },
        unpaid: { used: unpaidUsed }
      });
    }

    setCurrentMonthlyCount(monthlyCount);
  };

  const calculateDays = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const checkOverlap = (startDateStr, endDateStr) => {
    if (!startDateStr) return null;
    const start = new Date(startDateStr);
    const end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return leaveHistory.find(leave => {
      if (leave.status?.toLowerCase().includes('rejected')) return false;
      const lStart = new Date(leave.leave_date_start);
      const lEnd = new Date(leave.leave_date_end);
      lStart.setHours(0, 0, 0, 0);
      lEnd.setHours(0, 0, 0, 0);
      return start <= lEnd && end >= lStart;
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };

      if (name === 'fromDate' && newData.toDate && new Date(value) > new Date(newData.toDate)) {
        newData.toDate = value;
      }
      if (name === 'toDate' && newData.fromDate && new Date(value) < new Date(newData.fromDate)) {
        newData.toDate = newData.fromDate;
      }

      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leaveType || !formData.fromDate || !formData.toDate || !formData.reason) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!isLeaveAllowedByAdmin) {
      toast.error('Your leave access has been disabled by the admin.');
      return;
    }

    const overlappingLeave = checkOverlap(formData.fromDate, formData.toDate);
    if (overlappingLeave) {
      toast.error('You have already applied for leave during these dates.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const istOffsetMs = 330 * 60000; // IST offset in milliseconds
      const istDate = new Date(now.getTime() + istOffsetMs);
      const istTimestamp = istDate.toISOString().slice(0, 19).replace('T', ' ');

      const insertData = {
        timestamp: istTimestamp,
        created_at: istTimestamp,
        emp_id: user.emp_id,
        employee_name: user.full_name || user.Name,
        leave_date_start: formData.fromDate,
        leave_date_end: formData.toDate,
        remarks: formData.reason,
        status: (hodDetails.id === null) ? 'Pending HR' : 'Pending HOD',
        leave_type: formData.leaveType,
        hod_name: hodDetails.name === 'Not Assigned' ? null : hodDetails.name,
        designation: user.designation || user.role,
        hod_id: hodDetails.id,
        hr_id: hrDetails.id,
        hr_name: hrDetails.name
      };

      const logData = {
        request_type: 'Leave',
        emp_id: user.emp_id,
        emp_name: user.full_name || user.Name,
        status: insertData.status,
        hod_id: hodDetails.id,
        hod_name: hodDetails.name,
        hr_id: hrDetails.id,
        hr_name: hrDetails.name
      };

      const data = await createLeaveRequestWithLog(insertData, logData);

        if (data && data[0]) {
          if (hodDetails.id && hodDetails.phone_number) {
            const totalDays = calculateDays(formData.fromDate, formData.toDate);
            await sendWhatsappMessageToHod({
              employeId: hodDetails.id,
              tableid: data[0].id,
              hodPhoneNumber: hodDetails.phone_number,
              employeeName: user.full_name || user.Name,
              empId: user.emp_id,
              department: user.department || user.designation || user.role,
              leaveType: formData.leaveType,
              fromDate: formData.fromDate,
              toDate: formData.toDate,
              totalDays: totalDays,
              reason: formData.reason,
              who: "hod",
            });
          }
        }

      toast.success('Leave Request Submitted Successfully');
      setShowModal(false);
      setFormData({ leaveType: '', fromDate: '', toDate: '', reason: '' });
      setDateError(null);
      fetchUserDataAndHistory();

    } catch (error) {
      console.error('Submission Error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col gap-6 overflow-hidden bg-slate-50/30 px-4 sm:px-0">

        {/* Header Skeleton */}
        <div className="flex flex-row items-center justify-between gap-3 shrink-0 pt-1 lg:pt-0 animate-pulse">
          <div className="space-y-1">
            <div className="h-6 sm:h-8 w-[140px] sm:w-[250px] bg-slate-200 rounded-md"></div>
            <div className="h-3 sm:h-4 w-[100px] sm:w-[200px] bg-slate-200 rounded-md hidden sm:block"></div>
          </div>
          <div className="h-9 sm:h-12 w-28 sm:w-48 bg-slate-200 rounded-xl sm:rounded-2xl shadow-sm border border-slate-100 shrink-0"></div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-3 md:grid-cols-3 gap-3 sm:gap-6 shrink-0 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1 sm:gap-2">
              <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-2xl bg-slate-100 shadow-sm border border-white"></div>
              <div className="space-y-2 w-full flex flex-col items-center mt-1">
                <div className="h-2 sm:h-3 w-12 sm:w-16 bg-slate-100 rounded"></div>
                <div className="h-6 sm:h-8 w-16 sm:w-20 bg-slate-100 rounded mt-0.5"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Area Skeleton */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col mb-4 min-h-0 animate-pulse">
          <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
            <div className="h-10 w-full md:w-64 bg-slate-100 rounded-xl"></div>
            <div className="h-10 w-full md:w-80 bg-slate-100 rounded-xl"></div>
          </div>
          <div className="flex-1 p-4 space-y-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-24 sm:h-16 w-full bg-slate-50 rounded-2xl border border-slate-100 border-dashed"></div>
            ))}
          </div>
        </div>

      </div>
    );
  }

  const filteredHistory = leaveHistory.filter(item => {
    const matchesSearch = item.leave_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.remarks?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'pending') return matchesSearch && (item.status === 'Pending' || item.status === 'Pending HOD' || item.status === 'Pending HR');
    if (activeTab === 'approved') return matchesSearch && item.status?.toLowerCase().includes('approved');
    if (activeTab === 'rejected') return matchesSearch && item.status?.toLowerCase().includes('rejected');
    return matchesSearch;
  });

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden bg-slate-50/30 px-4 sm:px-0">
      {/* Header Section */}
      <div className="flex flex-row items-center justify-between gap-3 shrink-0 pt-1 lg:pt-0">
        <div className="min-w-0 pr-2 space-y-0.5">
          <h1 className="text-lg sm:text-2xl font-extrabold text-[#800000] tracking-tight drop-shadow-sm truncate">My Leave Requests</h1>
          <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">View your leave balance and application status</p>
        </div>
        <button
          onClick={() => isLeaveAllowedByAdmin && setShowModal(true)}
          disabled={!isLeaveAllowedByAdmin}
          className={`inline-flex items-center justify-center px-3 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl shadow-md border border-transparent text-xs sm:text-sm font-bold text-white transition-all transform active:scale-95 shrink-0 whitespace-nowrap focus:outline-none focus:ring-4 focus:ring-offset-2
            ${!isLeaveAllowedByAdmin
              ? 'bg-slate-400 cursor-not-allowed shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200 ring-indigo-500'}`}
        >
          <Plus size={16} className="mr-1 sm:mr-2" />
          <span>{!isLeaveAllowedByAdmin ? 'Access Disabled' : <><span className="sm:hidden">New Leave</span><span className="hidden sm:inline">New Leave Request</span></>}</span>
        </button>
      </div>

      {!isLeaveAllowedByAdmin && (
        <div className="bg-white border border-orange-100 rounded-2xl p-4 flex items-center gap-4 shrink-0 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-2.5 bg-orange-50 rounded-xl text-orange-600 border border-orange-100/50">
            <AlertCircle size={22} />
          </div>
          <div>
            <h4 className="text-sm font-black text-orange-900 uppercase tracking-wide">
              Access Revoked
            </h4>
            <p className="text-xs text-orange-700/80 mt-1 font-medium leading-relaxed">
              Your ability to apply for new leaves has been disabled by the administrator.
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid - 3 Columns on Mobile! */}
      <div className="grid grid-cols-3 md:grid-cols-3 gap-3 sm:gap-6 shrink-0">
        {['Casual Leave', 'Earned Leave', 'Unpaid Leave'].map((label, idx) => {
          const type = label.toLowerCase().split(' ')[0];
          const balance = leaveBalances[type === 'unpaid' ? 'unpaid' : type];
          const colors = [
            { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
            { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
            { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' }
          ][idx];
          const Icon = [Calendar, Briefcase, AlertCircle][idx];
          const val = type === 'unpaid' ? balance.used : (type === 'earned' ? balance.actualRemaining : balance.remaining);
          const total = type !== 'unpaid' ? balance.total : null;

          return (
            <div key={label} className="bg-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center gap-1 sm:gap-2 hover:shadow-md transition-all duration-300 group min-w-0 overflow-hidden">
              <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-2xl ${colors.bg} ${colors.text} transition-transform group-hover:scale-110 shadow-sm border border-white`}>
                <Icon size={12} className="sm:w-5 sm:h-5" />
              </div>
              <div className="space-y-0 w-full overflow-hidden">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter sm:tracking-widest truncate leading-tight">
                  {label.split(' ')[0]}
                </p>
                <div className="flex flex-col items-center justify-center w-full">
                  {type === 'earned' && balance.carriedForward > 0 ? (
                    <>
                      <h3 className="text-[11px] sm:text-xl font-black text-slate-900 tracking-tighter sm:tracking-tight whitespace-nowrap">
                        {balance.actualRemaining} <span className="text-slate-400 font-bold">+</span> {balance.carriedForward} <span className="text-slate-400 font-bold">=</span> <span className="text-xs sm:text-2xl">{balance.remaining}</span>
                      </h3>
                      <p className="text-[7.5px] sm:text-[11px] font-bold text-indigo-600 uppercase mt-0.5 tracking-tighter sm:tracking-wide whitespace-nowrap">
                        ({balance.carriedForward} Prev Year)
                      </p>
                    </>
                  ) : (
                    <div className="flex items-baseline justify-center gap-0.5 sm:gap-1">
                      <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">{val}</h3>
                      {total && <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase">/{total}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col mb-4 min-h-0">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/60 rounded-xl overflow-x-auto no-scrollbar">
            {['all', 'pending', 'approved', 'rejected'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap
                  ${activeTab === tab
                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative max-w-full md:max-w-xs w-full group">
            <input
              type="text"
              placeholder="Filter leave history..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
        </div>

        {/* Data Container */}
        <div className="overflow-auto flex-1 custom-scrollbar min-h-0">
          {/* Desktop View */}
          <table className="hidden lg:table min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 font-bold text-slate-400 uppercase tracking-widest text-[11px]">Type & Applied</th>
                <th className="px-6 py-5 font-bold text-slate-400 uppercase tracking-widest text-[11px]">Leave Period</th>
                <th className="px-6 py-5 font-bold text-slate-400 uppercase tracking-widest text-[11px]">Duration</th>
                <th className="px-6 py-5 font-bold text-slate-400 uppercase tracking-widest text-[11px]">Status</th>
                <th className="px-8 py-5 font-bold text-slate-400 uppercase tracking-widest text-[11px]">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredHistory.length > 0 ? filteredHistory.map((item) => {
                const s = item.status?.toLowerCase() || '';
                const { label, colorClass } = getStatusConfig(s);
                return (
                  <tr key={item.id} className="group hover:bg-slate-50/80 transition-all duration-200">
                    <td className="px-8 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{item.leave_type}</span>
                        <span className="text-[11px] text-slate-400 font-medium tracking-wide">Applied: {formatDate(item.timestamp)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100/80 group-hover:bg-white group-hover:border-indigo-100 transition-colors">
                        <span className="text-xs">{formatDate(item.leave_date_start)}</span>
                        <span className="text-slate-300">→</span>
                        <span className="text-xs">{formatDate(item.leave_date_end)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="font-bold text-slate-700 bg-slate-100/50 px-2.5 py-1 rounded-lg w-max">
                          {calculateDays(item.leave_date_start, item.leave_date_end)} Days
                        </span>
                        {(Number(item.casual) > 0 || Number(item.earned) > 0 || Number(item.unpaid) > 0) && (
                          <div className="flex gap-1.5">
                            {Number(item.casual) > 0 && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold border border-indigo-100/50">CL: {item.casual}</span>}
                            {Number(item.earned) > 0 && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold border border-emerald-100/50">EL: {item.earned}</span>}
                            {Number(item.unpaid) > 0 && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold border border-rose-100/50">LOP: {item.unpaid}</span>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${colorClass}`}>
                        <span className="w-1.5 h-1.5 mr-2 rounded-full bg-current opacity-80"></span>
                        {label}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      <p className="text-xs text-slate-500 font-medium line-clamp-2 max-w-[280px]" title={item.remarks}>
                        {item.remarks}
                      </p>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="5" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center opacity-40">
                      <FileText size={48} className="text-slate-300 mb-4" />
                      <p className="text-slate-500 font-bold uppercase tracking-widest">No matching records</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="lg:hidden p-4 space-y-4">
            {filteredHistory.length > 0 ? filteredHistory.map((item, idx) => {
              const s = item.status?.toLowerCase() || '';
              const { label, colorClass } = getStatusConfig(s);
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-indigo-200 transition-all animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="flex justify-between items-start bg-slate-50 -m-5 mb-0 px-5 py-3 border-b border-slate-100 rounded-t-2xl">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Request ID: #{item.id.toString().slice(-4)}</span>
                      <span className="text-sm font-bold text-slate-900">{item.leave_type}</span>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${colorClass}`}>
                      {label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Start Date</p>
                      <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <Calendar size={14} className="text-indigo-500" />
                        {formatDate(item.leave_date_start)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">End Date</p>
                      <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <Calendar size={14} className="text-indigo-500 opacity-60" />
                        {formatDate(item.leave_date_end)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-3 rounded-xl border border-dotted border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1.5">Reason / Remarks</p>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed italic line-clamp-3">{item.remarks}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Applied:</span>
                      <span className="text-[10px] text-slate-600 font-medium">{formatDate(item.timestamp)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        {calculateDays(item.leave_date_start, item.leave_date_end)} Days
                      </div>
                      {(Number(item.casual) > 0 || Number(item.earned) > 0 || Number(item.unpaid) > 0) && (
                        <div className="flex gap-1">
                          {Number(item.casual) > 0 && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100/50">CL: {item.casual}</span>}
                          {Number(item.earned) > 0 && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold border border-emerald-100/50">EL: {item.earned}</span>}
                          {Number(item.unpaid) > 0 && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-bold border border-rose-100/50">LOP: {item.unpaid}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="py-12 text-center opacity-40">
                <FileText size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest">No leaves found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-all duration-300">
          <div className="absolute inset-0" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">New Leave Request</h3>
                <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mt-0.5">Please fill details accurately</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2.5 rounded-2xl transition-all"
              >
                <X size={22} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 scrollbar-hide">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Approvers Feedback Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-50">
                      <Users size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Assigned HOD</p>
                      <p className="font-bold text-sm text-slate-900 truncate">{hodDetails.name || 'Not Found'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-purple-50/50 rounded-2xl border border-purple-100/50">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-purple-600 shadow-sm border border-purple-50">
                      <Shield size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider">Assigned HR</p>
                      <p className="font-bold text-sm text-slate-900 truncate">{hrDetails.name}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Leave Type</label>
                    <select
                      name="leaveType"
                      value={formData.leaveType}
                      onChange={handleInputChange}
                      className="block w-full rounded-2xl border-slate-200 py-4 px-4 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-sm"
                      required
                    >
                      <option value="">Select Category...</option>
                      <option value="Casual Leave" disabled={leaveBalances.casual.remaining <= 0}>Casual Leave ({leaveBalances.casual.remaining} Left)</option>
                      <option value="Earned Leave" disabled={leaveBalances.earned.remaining <= 0}>Earned Leave ({leaveBalances.earned.remaining} Left)</option>
                      <option value="UnPaid Leave">UnPaid Leave (LWP)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">From Date</label>
                      <input type="date" name="fromDate" value={formData.fromDate} onChange={handleInputChange} className="block w-full rounded-2xl border-slate-200 py-4 px-4 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-sm" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">To Date</label>
                      <input type="date" name="toDate" value={formData.toDate} min={formData.fromDate} onChange={handleInputChange} className="block w-full rounded-2xl border-slate-200 py-4 px-4 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-sm" required />
                    </div>
                  </div>

                  {(() => {
                    let leaveWarning = null;
                    let leaveNote = null;

                    if (formData.fromDate && formData.toDate && formData.leaveType) {
                      const usedEL = leaveBalances.earned.used || 0;
                      const usedCL = leaveBalances.casual.used || 0;
                      const carriedForwardEL = leaveBalances.earned.carriedForward || 0;

                      const splits = calculateLeaveSplitsDayByDay(
                        formData.leaveType,
                        formData.fromDate,
                        formData.toDate,
                        usedEL,
                        usedCL,
                        carriedForwardEL
                      );

                      leaveWarning = splits.warning;
                      leaveNote = splits.note;
                    }

                    if (leaveWarning) {
                      return (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-3 items-start animate-in fade-in zoom-in duration-300">
                          <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={20} />
                          <div>
                            <p className="text-sm font-bold text-rose-900 leading-snug">छुट्टी अलर्ट (Leave Alert)</p>
                            <p className="text-xs text-rose-700 mt-1 font-medium leading-relaxed">{leaveWarning}</p>
                          </div>
                        </div>
                      );
                    } else if (leaveNote) {
                      return (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 items-start animate-in fade-in zoom-in duration-300">
                          <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                          <div>
                            <p className="text-sm font-bold text-emerald-900 leading-snug">छुट्टी विवरण (Leave Details)</p>
                            <p className="text-xs text-emerald-700 mt-1 font-medium leading-relaxed">{leaveNote}</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Detailed Reason</label>
                    <textarea
                      name="reason"
                      rows={4}
                      value={formData.reason}
                      onChange={handleInputChange}
                      className="block w-full rounded-2xl border-slate-200 py-4 px-4 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium text-slate-700 shadow-sm resize-none"
                      placeholder="Explain the purpose of your leave..."
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-8 py-4 rounded-2xl text-sm font-black text-slate-500 uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-10 py-4 rounded-2xl text-sm font-black text-white uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-70 transform active:scale-95 transition-all"
                  >
                    {submitting ? 'Sending Request...' : 'Final Submit'}
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

// Helper for status styling
const getStatusConfig = (s) => {
  if (s.includes('approved')) return { label: 'Approved', colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm shadow-emerald-50' };
  if (s.includes('rejected')) return { label: 'Rejected', colorClass: 'bg-rose-50 text-rose-700 border-rose-100 shadow-sm shadow-rose-50' };
  if (s.includes('hr')) return { label: 'Pending HR', colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm shadow-indigo-50' };
  return { label: 'Pending HOD', colorClass: 'bg-amber-50 text-amber-700 border-amber-100 shadow-sm shadow-amber-50' };
};

export default LeaveRequest;
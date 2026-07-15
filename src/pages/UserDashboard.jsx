import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { supabase } from '../supabaseClient';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  FileText,
  Calendar,
  Briefcase,
  Activity,
  Layers,
  MapPin,
  Clock3,
  Search,
  Cake,
  Gift,
  Image as ImageIcon,
  PartyPopper,
  Loader2
} from 'lucide-react';
import dayjs from 'dayjs';

import { Link } from 'react-router-dom';

// Fiscal year helper
const getFiscalYear = (date = new Date()) => {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
};

const UserDashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [requestDropdownOpen, setRequestDropdownOpen] = useState(false);

  // Leave Balance State
  const [leaveBalances, setLeaveBalances] = useState({
    casual: { total: 12, used: 0, remaining: 12 },
    earned: { total: 24, used: 0, remaining: 24, carriedForward: 0 },
    unpaid: { used: 0 }
  });

  // Operational widget state
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [recentGatepasses, setRecentGatepasses] = useState([]);
  const [recentApplicants, setRecentApplicants] = useState([]);

  // Birthday & Anniversary state
  const [usersData, setUsersData] = useState([]);
  const [birthdayRecords, setBirthdayRecords] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentTodaySlide, setCurrentTodaySlide] = useState(0);
  const [wishingRecordId, setWishingRecordId] = useState(null);

  // Attendance state
  const [presentList, setPresentList] = useState([]);
  const [lateList, setLateList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [searchQuery, setSearchQuery] = useState('');
  const [presentLimit, setPresentLimit] = useState(10);
  const [lateLimit, setLateLimit] = useState(10);

  useEffect(() => {
    setPresentLimit(10);
    setLateLimit(10);
  }, [searchQuery, selectedDepartment]);
  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (requestDropdownOpen && !e.target.closest('.request-dropdown-container')) {
        setRequestDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [requestDropdownOpen]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString();

        // 1. Fetch Users Data for events
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('emp_id, is_active, department, designation, joining_date, full_name, profile_picture');

        if (usersError) throw usersError;

        setUsersData(usersData || []);

        // Fetch Biometric API for today
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        const response = await fetch(`${import.meta.env.VITE_BIOMETRIC_API_URL}&FromDate=${todayStr}&ToDate=${todayStr}`);
        const apiData = await response.json();

        const groupedApiData = {};
        if (Array.isArray(apiData)) {
          apiData.forEach((log) => {
            if (!groupedApiData[log.UserId]) groupedApiData[log.UserId] = [];
            groupedApiData[log.UserId].push(log.LogDate);
          });
        }

        const presentArr = [];
        const lateArr = [];
        const uniqueDepts = new Set();

        usersData.filter(u => u.is_active).forEach(u => {
          if (user && String(u.emp_id) !== String(user.emp_id)) return;
          const logs = groupedApiData[u.emp_id] || [];
          if (logs.length > 0) {
            logs.sort();
            const firstLog = logs[0];
            const inTime = firstLog.split('T')[1].substring(0, 5); // HH:MM

            const [hr, min] = inTime.split(':').map(Number);
            const isLate = (hr > 10) || (hr === 10 && min > 5);

            if (isLate) {
              const lateMins = (hr * 60 + min) - (10 * 60 + 5);
              let lateStr = `${lateMins} Min`;
              if (lateMins >= 60) lateStr = `${Math.floor(lateMins / 60)}h ${lateMins % 60}m`;
              lateArr.push({ ...u, inTime, lateStr });
            } else {
              presentArr.push({ ...u, inTime });
            }
          }
        });

        presentArr.sort((a, b) => a.inTime.localeCompare(b.inTime));
        lateArr.sort((a, b) => b.inTime.localeCompare(a.inTime));

        setPresentList(presentArr);
        setLateList(lateArr);
        setDepartments([...uniqueDepts].sort());


        // 2. Fetch Leave Balances
        if (user) {
          const { data: balanceData } = await supabase
            .from('employee_leave_balances')
            .select('*')
            .eq('emp_id', user.emp_id)
            .maybeSingle();

          const { data: quotaData } = await supabase
            .from('yearly_quota')
            .select('carried_forward_el')
            .eq('emp_id', user.emp_id)
            .eq('year', getFiscalYear())
            .maybeSingle();

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
        }

        // 3. Fetch Recent Operational Data (Current Month Only)
        let leavesQuery = supabase.from('leave_management')
          .select('id, employee_name, leave_type, status, leave_date_start, created_at')
          .order('created_at', { ascending: false });
        if (user) {
          leavesQuery = leavesQuery.eq('employee_name', user.full_name)
            .gte('leave_date_start', firstDayOfMonth);
        }

        let gatepassQuery = supabase.from('gate_pass')
          .select('id, emp_name, place_reason_to_visit, status, timestamp')
          .order('timestamp', { ascending: false });
        if (user) {
          gatepassQuery = gatepassQuery.eq('emp_name', user.full_name)
            .gte('timestamp', firstDayOfMonth);
        }

        const [leavesRes, gatepassRes, birthdaysRes] = await Promise.all([
          leavesQuery.limit(5),
          gatepassQuery.limit(5),
          supabase.from('birthday')
            .select('*')
            .order('created_at', { ascending: false })
        ]);

        if (leavesRes.error) console.error(leavesRes.error);
        else setRecentLeaves(leavesRes.data || []);

        if (gatepassRes.error) console.error(gatepassRes.error);
        else setRecentGatepasses(gatepassRes.data || []);

        if (birthdaysRes.error) console.error(birthdaysRes.error);
        else setBirthdayRecords(birthdaysRes.data || []);

      } catch (error) {
        // console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Birthday logic
  const getUpcomingEvents = () => {
    const today = dayjs().startOf('day');
    const upcoming = [];

    birthdayRecords.forEach(record => {
      const userObj = usersData.find(emp => String(emp.emp_id) === String(record.emp_id));
      const empName = userObj?.full_name || 'Unknown Employee';

      if (record.date_of_birth) {
        const dobMonth = dayjs(record.date_of_birth).month();
        const dobDate = dayjs(record.date_of_birth).date();
        let thisYearDob = dayjs().month(dobMonth).date(dobDate).startOf('day');

        if (thisYearDob.isBefore(today)) {
          thisYearDob = thisYearDob.add(1, 'year');
        }

        const diffDays = thisYearDob.diff(today, 'day');
        if (diffDays >= 0 && diffDays <= 7) {
          upcoming.push({ ...record, type: 'Birthday', targetDate: thisYearDob, diffDays, empName });
        }
      }

      if (record.aniversary) {
        const annMonth = dayjs(record.aniversary).month();
        const annDate = dayjs(record.aniversary).date();
        let thisYearAnn = dayjs().month(annMonth).date(annDate).startOf('day');

        if (thisYearAnn.isBefore(today)) {
          thisYearAnn = thisYearAnn.add(1, 'year');
        }

        const diffDays = thisYearAnn.diff(today, 'day');
        if (diffDays >= 0 && diffDays <= 7) {
          upcoming.push({ ...record, type: 'Anniversary', targetDate: thisYearAnn, diffDays, empName });
        }
      }
    });

    return upcoming.sort((a, b) => a.diffDays - b.diffDays);
  };

  const upcomingEvents = getUpcomingEvents();
  const futureEventsCount = upcomingEvents.filter(e => e.diffDays > 0).length;
  const todaysEventsCount = upcomingEvents.filter(e => e.diffDays === 0).length;

  useEffect(() => {
    if (futureEventsCount > 1) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % futureEventsCount);
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [futureEventsCount]);

  useEffect(() => {
    if (todaysEventsCount > 1) {
      const timer = setInterval(() => {
        setCurrentTodaySlide((prev) => (prev + 1) % todaysEventsCount);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [todaysEventsCount]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return dayjs(dateStr).format('D MMMM YYYY');
  };

  const handleWish = async (record) => {
    if (!user || !user.full_name) return;
    setWishingRecordId(record.id);
    try {
      const column = record.type === 'Anniversary' ? 'anni_sent_by' : 'sent_by';
      let currentSentBy = record[column] || '';
      
      let sentByArray = [];
      if (typeof currentSentBy === 'string') {
        sentByArray = currentSentBy.split(',').map(s => s.trim()).filter(Boolean);
      } else if (Array.isArray(currentSentBy)) {
        sentByArray = currentSentBy;
      }
      
      if (sentByArray.includes(user.full_name.trim())) {
        return; // Already wished
      }

      const newSentBy = sentByArray.length > 0 
        ? `${sentByArray.join(', ')}, ${user.full_name.trim()}`
        : user.full_name.trim();

      const { error } = await supabase
        .from('birthday')
        .update({ [column]: newSentBy })
        .eq('id', record.id);

      if (error) throw error;



      // Update local state
      setBirthdayRecords(prev => prev.map(r =>
        r.id === record.id ? { ...r, [column]: newSentBy } : r
      ));
    } catch (error) {
      console.error(`Error updating ${record.type === 'Anniversary' ? 'anni_sent_by' : 'sent_by'}:`, error);
      alert("Failed to send wishes.");
    } finally {
      setWishingRecordId(null);
    }
  };

  const hasWished = (record) => {
    if (!user || !user.full_name) return false;
    const column = record.type === 'Anniversary' ? 'anni_sent_by' : 'sent_by';
    const sentBy = record[column];
    if (!sentBy) return false;
    
    let sentByArray = [];
    if (typeof sentBy === 'string') {
      sentByArray = sentBy.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(sentBy)) {
      sentByArray = sentBy;
    }
    
    return sentByArray.includes(user.full_name.trim());
  };

  // Colors
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#3b82f6', '#f59e0b', '#06b6d4'];
  const STATUS_COLORS = {
    'Approved': '#10B981',
    'Pending': '#FACC15',
    'Pending HOD': '#FACC15',
    'Pending HR': '#FACC15',
    'Rejected': '#EF4444',
    'Reject': '#EF4444',
    'Cancelled': '#6B7280',
    'Unknown': '#9CA3AF'
  };

  const filteredPresent = presentList.filter(u => {
    const matchDept = selectedDepartment === 'All Departments' || u.department === selectedDepartment;
    const matchSearch = u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.emp_id?.toString().toLowerCase().includes(searchQuery.toLowerCase());
    return matchDept && matchSearch;
  });

  const filteredLate = lateList.filter(u => {
    const matchDept = selectedDepartment === 'All Departments' || u.department === selectedDepartment;
    const matchSearch = u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.emp_id?.toString().toLowerCase().includes(searchQuery.toLowerCase());
    return matchDept && matchSearch;
  });

  const handlePresentScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setPresentLimit(prev => Math.min(prev + 10, filteredPresent.length));
    }
  };

  const handleLateScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setLateLimit(prev => Math.min(prev + 10, filteredLate.length));
    }
  };

  const todaysEvents = upcomingEvents.filter(e => e.diffDays === 0);
  const futureEvents = upcomingEvents.filter(e => e.diffDays > 0);

  if (loading) {
    return (
      <div className="py-4 w-full space-y-3 sm:space-y-5 min-h-screen font-sans bg-transparent">
        
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-1 sm:px-0 relative animate-pulse">
          <div className="text-left space-y-2">
            <div className="h-6 sm:h-8 w-[150px] sm:w-[200px] bg-slate-200 rounded-md"></div>
            <div className="h-3 sm:h-4 w-[120px] sm:w-[150px] bg-slate-200 rounded-md"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-7 sm:h-9 w-40 sm:w-48 bg-white rounded-full shadow-sm border border-slate-200/60"></div>
            <div className="h-7 sm:h-9 w-24 sm:w-28 bg-[#800000]/20 rounded-full shadow-sm"></div>
          </div>
        </div>

        {/* Grid 1: Recent Leaves & Gate Passes Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 flex flex-col animate-pulse">
               <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-2">
                   <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-lg bg-slate-100"></div>
                   <div className="space-y-1.5 w-full max-w-[200px]">
                      <div className="w-3/4 h-4 sm:h-5 bg-slate-200 rounded-md"></div>
                      <div className="w-1/2 h-2 sm:h-3 bg-slate-100 rounded-md"></div>
                   </div>
                 </div>
               </div>
               <div className="space-y-3 mt-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                       <div className="space-y-2 w-full max-w-[150px]">
                          <div className="w-full h-3 sm:h-4 bg-slate-200 rounded-md"></div>
                          <div className="w-2/3 h-2 sm:h-3 bg-slate-200 rounded-md"></div>
                       </div>
                       <div className="w-16 h-4 sm:h-5 rounded-full bg-slate-200"></div>
                    </div>
                  ))}
               </div>
               <div className="w-full h-10 mt-4 rounded-xl bg-slate-50 border border-slate-100"></div>
            </div>
          ))}
        </div>

        {/* Grid 3: Birthdays & Anniversaries Skeleton */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 mt-6 flex flex-col xl:flex-row gap-6 xl:gap-8 animate-pulse">
           
           {/* Today's Events Skeleton */}
           <div className="w-full xl:flex-[6]">
             <div className="h-5 sm:h-6 w-32 sm:w-40 bg-slate-200 rounded-md mb-4 px-1"></div>
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col sm:flex-row h-auto sm:h-[240px]">
                <div className="w-full sm:w-[35%] bg-slate-100 h-40 sm:h-full"></div>
                <div className="p-4 sm:p-6 flex-1 flex flex-col justify-center space-y-3">
                   <div className="h-6 sm:h-8 w-3/4 bg-slate-200 rounded-md"></div>
                   <div className="h-5 sm:h-6 w-1/2 bg-slate-200 rounded-md"></div>
                   <div className="h-8 sm:h-10 w-32 bg-slate-200 rounded-lg mt-4"></div>
                </div>
             </div>
           </div>

           {/* Upcoming Events Skeleton */}
           <div className="w-full xl:flex-[4] border-t xl:border-t-0 xl:border-l border-slate-200/60 pt-4 sm:pt-6 xl:pt-0 xl:pl-8">
             <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <div className="w-5 h-5 rounded bg-slate-200"></div>
                <div className="h-5 sm:h-6 w-32 bg-slate-200 rounded-md"></div>
             </div>
             <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0"></div>
                <div className="flex-1 space-y-2 w-full max-w-[150px]">
                   <div className="w-1/2 h-2 sm:h-3 bg-slate-200 rounded-md"></div>
                   <div className="w-3/4 h-3 sm:h-4 bg-slate-200 rounded-md"></div>
                   <div className="w-2/3 h-2 sm:h-3 bg-slate-100 rounded-md"></div>
                </div>
             </div>
           </div>

        </div>

      </div>
    );
  }

  return (
    <div className="py-4 w-full space-y-3 sm:space-y-5 min-h-screen font-sans bg-transparent">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-1 sm:px-0 relative">
        <div className="text-left">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">My Dashboard</h1>
          <p className="text-slate-600 text-xs sm:text-base mt-0.5 font-semibold">Welcome back! SKA HR System</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Inline Leave Balances */}
          <div className="px-3 py-1.5 bg-white rounded-full shadow-sm border border-slate-200/60 flex-shrink-0 text-xs sm:text-sm font-bold text-slate-700">
            Remaining Leaves <span className="text-indigo-600 ml-1">EL : {leaveBalances.earned.remaining}</span> , <span className="text-emerald-600">CL : {leaveBalances.casual.remaining}</span>
          </div>

          {/* Request Button */}
          <div className="request-dropdown-container relative">
            <button
              onClick={() => setRequestDropdownOpen(!requestDropdownOpen)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#800000] text-white rounded-full shadow-sm font-bold text-xs sm:text-sm hover:bg-[#600000] transition-colors"
            >
              <Briefcase size={14} />
              Request
            </button>

            {requestDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 overflow-hidden">
                <Link to="/leave-request" className="block px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-[#800000] transition-colors">
                  Leave Request
                </Link>
                <Link to="/gate-pass-request" className="block px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-[#800000] transition-colors">
                  Gatepass Request
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Grid 1: Recent Leaves & Gate Passes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
        {/* Recent Leaves Card */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-indigo-50 rounded-lg">
                <Calendar size={18} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">My Recent Leaves</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-semibold">Leaves taken this month</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 mt-4">
            {recentLeaves.length > 0 ? (
              recentLeaves.map((leave, index) => (
                <div key={index} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div className="min-w-0 pr-2">
                    <h4 className="text-sm font-bold text-slate-800 truncate">{leave.employee_name}</h4>
                    <p className="text-xs text-slate-500 font-medium truncate">{leave.leave_type} • {leave.leave_date_start ? new Date(leave.leave_date_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}</p>
                  </div>
                  <span className={`px-2 py-1 flex-shrink-0 text-[10px] font-bold rounded-full ${leave.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                    leave.status?.includes('Reject') ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                    {leave.status === 'Pending' || leave.status === 'Pending HOD' ? 'Pending HOD' : leave.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No recent leaves</p>
            )}
          </div>
          {recentLeaves.length > 0 && (
            <button onClick={() => navigate('/leave-request')} className="w-full mt-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors">
              View My Leave Requests
            </button>
          )}
        </div>

        {/* Recent Gate Passes Card */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-emerald-50 rounded-lg">
                <MapPin size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">My Gate Passes</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-semibold">Gate passes this month</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 mt-4">
            {recentGatepasses.length > 0 ? (
              recentGatepasses.map((gp, index) => (
                <div key={index} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div className="min-w-0 pr-2">
                    <h4 className="text-sm font-bold text-slate-800 truncate">{gp.emp_name}</h4>
                    <p className="text-xs text-slate-500 font-medium truncate">{gp.place_reason_to_visit} • {gp.timestamp ? new Date(gp.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}</p>
                  </div>
                  <span className={`px-2 py-1 flex-shrink-0 text-[10px] font-bold rounded-full ${gp.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                    gp.status?.includes('Reject') ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                    {gp.status === 'Pending' || gp.status === 'Pending HOD' ? 'Pending HOD' : gp.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No recent gate passes</p>
            )}
          </div>
          {recentGatepasses.length > 0 && (
            <button onClick={() => navigate('/gate-pass-request')} className="w-full mt-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors">
              View My Gate Passes
            </button>
          )}
        </div>
      </div>



      {/* Grid 3: Birthdays & Anniversaries */}
      {(todaysEvents.length > 0 || futureEvents.length > 0) && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 mt-6 flex flex-col xl:flex-row gap-6 xl:gap-8">

          {/* Today's Events */}
          <div className={`w-full ${futureEvents.length > 0 ? 'xl:flex-[6]' : ''}`}>
            {todaysEvents.length > 0 ? (
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Today's Events</h3>
                <div className="flex flex-col gap-4 sm:gap-6 relative">
                  {(() => {
                    const record = todaysEvents[currentTodaySlide] || todaysEvents[0];
                    const isBirthday = record.type === 'Birthday';
                    return (
                      <React.Fragment key={currentTodaySlide}>
                        <style>{`@keyframes fadeSlideInToday { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
                        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 overflow-hidden flex flex-col sm:flex-row group relative" style={{ animation: 'fadeSlideInToday 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                          {/* LEFT SIDE: Photo */}
                          <div className="w-full sm:w-[35%] shrink-0 bg-slate-50 relative flex items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-100 min-h-[160px] sm:min-h-[200px]">
                            {record.photo ? (
                              <img
                                src={record.photo}
                                alt={record.empName}
                                className="w-full h-32 sm:h-full sm:absolute sm:inset-0 object-cover cursor-default transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
                                  <ImageIcon size={28} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* RIGHT SIDE: Details */}
                          <div className="p-4 sm:p-6 flex-1 flex flex-col justify-center">
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-600 mb-1 sm:mb-2 tracking-tight">
                              {isBirthday ? "Happy Birthday!" : "Happy Anniversary!"}
                            </h2>
                            <h3 className="font-bold text-slate-800 text-xl sm:text-2xl leading-tight">{record.empName}</h3>
                            <button 
                              onClick={() => !hasWished(record) && handleWish(record)}
                              disabled={hasWished(record) || wishingRecordId === record.id}
                              className={`mt-4 px-4 py-2 text-sm font-semibold rounded-lg shadow border flex items-center gap-2 transition-colors w-max cursor-pointer ${
                                hasWished(record) 
                                  ? 'bg-slate-200 text-slate-500 border-slate-200 cursor-not-allowed' 
                                  : wishingRecordId === record.id
                                    ? 'bg-indigo-400 text-white border-indigo-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700'
                              }`}>
                              {wishingRecordId === record.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <PartyPopper size={16} />
                              )}
                              {wishingRecordId === record.id ? "Sending..." : hasWished(record) ? "Wishes Sent!" : `Wish ${isBirthday ? "Happy Birthday" : "Happy Anniversary"}`}
                            </button>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })()}

                  {todaysEvents.length > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-1 mb-2">
                      {todaysEvents.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentTodaySlide(idx)}
                          className={`h-2 rounded-full transition-all duration-300 ${currentTodaySlide === idx ? 'bg-pink-500 w-6' : 'bg-slate-200 w-2 hover:bg-slate-300'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col justify-center items-center">
                <PartyPopper size={40} className="text-slate-300 mb-3" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">No Events Today</h3>
                <p className="text-sm font-medium">There are no birthdays or anniversaries today.</p>
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          {futureEvents.length > 0 && (
            <div className="w-full xl:flex-[4] border-t xl:border-t-0 xl:border-l border-slate-200/60 pt-4 sm:pt-6 xl:pt-0 xl:pl-8">
              <h3 className="text-lg font-bold text-slate-800 mb-4 sm:mb-6 px-1 flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                Upcoming Events
              </h3>

              {/* Auto-Slider Card */}
              <div className="w-full sm:max-w-md xl:max-w-none">
                {(() => {
                  const record = futureEvents[currentSlide] || futureEvents[0];

                  return (
                    <React.Fragment key={currentSlide}>
                      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }`}</style>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 relative overflow-hidden transition-all duration-300" style={{ animation: 'fadeSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        {record.photo ? (
                          <img src={record.photo} alt={record.empName} className="w-12 h-12 rounded-lg border border-slate-100 shadow-sm object-cover shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 bg-white">
                          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">{record.type === 'Birthday' ? 'Upcoming Birthday' : 'Upcoming Anniversary'}</p>
                          <h4 className="font-bold text-slate-900 text-sm truncate">{record.empName}</h4>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 xl:w-4 xl:h-4 text-slate-400" />
                            {dayjs(record.targetDate).format('DD MMM YYYY')} • In {record.diffDays} Days
                          </p>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })()}

                {futureEvents.length > 1 && (
                  <div className="flex items-center gap-1.5 mt-4 px-1">
                    {futureEvents.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === idx ? 'bg-indigo-600 w-4' : 'bg-slate-200 w-1.5 hover:bg-slate-300'}`}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
};

// Sub-component for Top Stats
const StatCard = ({ title, value, icon: Icon, trend, trendUp, color }) => {
  const colorMap = {
    indigo: { text: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'shadow-indigo-100' },
    emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'shadow-emerald-100' },
    amber: { text: 'text-amber-600', bg: 'bg-amber-50', ring: 'shadow-amber-100' },
    rose: { text: 'text-rose-600', bg: 'bg-rose-50', ring: 'shadow-rose-100' },
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div className="bg-white p-2.5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <div className={`p-2 sm:p-3.5 rounded-xl sm:rounded-2xl ${scheme.bg} ${scheme.text} shadow-sm`}>
          <Icon size={18} className="sm:w-[22px] sm:h-[22px] stroke-[2.5px]" />
        </div>
        {trend && (
          <span className={`text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex items-center gap-0.5 sm:gap-1 ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {trendUp ? <TrendingUp size={10} className="sm:w-[10px] sm:h-[10px]" /> : <TrendingUp size={10} className="sm:w-[10px] sm:h-[10px] rotate-180" />}
            {trend}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-xl sm:text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
        <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-0.5 sm:mt-1">{title}</p>
      </div>
    </div>
  );
};

export default UserDashboard;
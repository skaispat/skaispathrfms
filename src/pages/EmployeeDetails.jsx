import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  User,
  Calendar,
  Clock,
  Briefcase,
  Building2,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  DoorOpen,
  Laptop,
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
  Award,
  ChevronRight,
  LogOut,
  LogIn,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAllEmployeesListForSearch, getComprehensiveEmployeeDetails } from '../api/employeeDetailsApi';

const getFiscalYear = () => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const EmployeeDetails = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [employeesList, setEmployeesList] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [loading, setLoading] = useState(false);
  const [employeeData, setEmployeeData] = useState(null);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const searchRef = useRef(null);

  // Fetch employee list for search autocomplete
  useEffect(() => {
    const fetchList = async () => {
      try {
        const list = await getAllEmployeesListForSearch();
        setEmployeesList(list);
      } catch (err) {
        console.error('Failed to load employee list:', err);
      }
    };
    fetchList();
  }, []);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.trim().length > 0) {
      const q = value.toLowerCase().trim();
      const matches = employeesList.filter(emp =>
        (emp.full_name && emp.full_name.toLowerCase().includes(q)) ||
        (emp.emp_id && String(emp.emp_id).toLowerCase().includes(q)) ||
        (emp.username && emp.username.toLowerCase().includes(q)) ||
        (emp.department && emp.department.toLowerCase().includes(q))
      ).slice(0, 8);
      setFilteredSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSearch = async (termToSearch) => {
    const query = (termToSearch || searchTerm).trim();
    if (!query) {
      toast.error('Please enter an Employee Name or EMP ID');
      return;
    }

    setLoading(true);
    setShowSuggestions(false);
    try {
      const data = await getComprehensiveEmployeeDetails(query, getFiscalYear());
      setEmployeeData(data);
      setSearchedQuery(query);
      setSearchTerm(data.user.full_name || data.user.emp_id);
      setActiveTab('overview');
      toast.success(`Loaded details for ${data.user.full_name || data.user.emp_id}`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to fetch employee details');
      setEmployeeData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSuggestion = (emp) => {
    setSearchTerm(emp.full_name || emp.emp_id);
    handleSearch(emp.emp_id || emp.full_name);
  };

  const handleClear = () => {
    setSearchTerm('');
    setEmployeeData(null);
    setSearchedQuery('');
    setFilteredSuggestions([]);
    setShowSuggestions(false);
  };

  // Calculations for metrics and attendance
  const calculateMetrics = () => {
    if (!employeeData) return {};

    const { leaves, gatePasses, attendance } = employeeData;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Total leaves all time & approved
    const totalLeaves = leaves.filter(l => l.status === 'Approved' || l.status === 'Approved HOD' || l.status === 'Approved HR').length;

    // Current month leaves
    const currentMonthLeaves = leaves.filter(l => {
      if (!l.leave_date_start) return false;
      const d = new Date(l.leave_date_start);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && (l.status === 'Approved' || l.status === 'Approved HOD' || l.status === 'Approved HR');
    }).length;

    // Total gate passes & current month
    const totalGatePasses = gatePasses.length;
    const currentMonthGatePasses = gatePasses.filter(g => {
      if (!g.timestamp) return false;
      const d = new Date(g.timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    // Biometric Today Status
    let todayInTime = '-';
    let todayOutTime = '-';
    let todayStatus = 'Not Punched Today';
    let todayStatusColor = 'bg-slate-100 text-slate-600 border-slate-200';

    if (attendance?.todayLogs && attendance.todayLogs.length > 0) {
      const logs = [...attendance.todayLogs].sort((a, b) => new Date(a.LogDate) - new Date(b.LogDate));
      const firstLog = logs[0].LogDate;
      const lastLog = logs[logs.length - 1].LogDate;

      if (firstLog) {
        const timePart = firstLog.split('T')[1]?.substring(0, 5) || '';
        todayInTime = timePart;
        const [hr, min] = timePart.split(':').map(Number);
        const isLate = (hr > 10) || (hr === 10 && min > 5);

        if (isLate) {
          todayStatus = `Present (Late: ${timePart})`;
          todayStatusColor = 'bg-amber-50 text-amber-700 border-amber-200';
        } else {
          todayStatus = `Present (${timePart})`;
          todayStatusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        }
      }

      if (logs.length > 1 && lastLog) {
        todayOutTime = lastLog.split('T')[1]?.substring(0, 5) || '-';
      }
    } else {
      // Check if on leave today
      const todayDateStr = now.toISOString().split('T')[0];
      const onLeaveToday = leaves.some(l => {
        if (!l.leave_date_start || !l.leave_date_end) return false;
        return (
          todayDateStr >= l.leave_date_start &&
          todayDateStr <= l.leave_date_end &&
          (l.status === 'Approved' || l.status === 'Approved HOD' || l.status === 'Approved HR')
        );
      });

      if (onLeaveToday) {
        todayStatus = 'On Leave Today';
        todayStatusColor = 'bg-blue-50 text-blue-700 border-blue-200';
      }
    }

    // Total Lates of this Month calculation from biometric monthLogs
    const monthLogsMap = {};
    if (attendance?.monthLogs && Array.isArray(attendance.monthLogs)) {
      attendance.monthLogs.forEach(log => {
        if (log.LogDate) {
          const logDateOnly = log.LogDate.split('T')[0];
          if (!monthLogsMap[logDateOnly]) monthLogsMap[logDateOnly] = [];
          monthLogsMap[logDateOnly].push(log.LogDate);
        }
      });
    }

    let totalMonthLates = 0;
    Object.keys(monthLogsMap).forEach(dateStr => {
      const logs = monthLogsMap[dateStr];
      logs.sort();
      const firstLog = logs[0];
      const timePart = firstLog.split('T')[1]?.substring(0, 5) || '';
      if (timePart) {
        const [hr, min] = timePart.split(':').map(Number);
        const isLate = (hr > 10) || (hr === 10 && min > 5);
        if (isLate) totalMonthLates++;
      }
    });

    return {
      totalLeaves,
      currentMonthLeaves,
      totalGatePasses,
      currentMonthGatePasses,
      todayInTime,
      todayOutTime,
      todayStatus,
      todayStatusColor,
      totalMonthLates
    };
  };

  const metrics = calculateMetrics();

  // Extract phone number dynamically
  const userPhone = employeeData?.user?.phone_number || employeeData?.user?.mobile_no || employeeData?.user?.whatsapp_number || '-';
  const hodPhone = employeeData?.hod?.phone_number || employeeData?.hod?.mobile_no || '-';

  return (
    <div className="h-full flex flex-col gap-6 overflow-y-auto">
      {/* Header - Styled matching Employee.jsx */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">Employee Details</h1>
          <p className="text-slate-500 mt-1 text-sm">View complete profile, leaves, attendance, HOD, and assets for any employee</p>
        </div>

        {employeeData && (
          <button
            onClick={handleClear}
            className="self-start md:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-lg transition flex items-center gap-2 border border-slate-200 shadow-sm"
          >
            <X size={16} />
            Clear & Search Another
          </button>
        )}
      </div>

      {/* Main Search Toolbar Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 shrink-0">
        <div className="relative max-w-2xl w-full" ref={searchRef}>
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              onFocus={() => searchTerm.trim().length > 0 && setShowSuggestions(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by Employee Name, EMP ID (e.g. EMP001), Username..."
              className="w-full pl-10 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 transition-all text-sm font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-20 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            )}
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md text-xs sm:text-sm transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Search size={14} />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>

          {/* Autocomplete Dropdown Suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {filteredSuggestions.map((emp) => (
                <div
                  key={emp.emp_id || emp.username}
                  onClick={() => handleSelectSuggestion(emp)}
                  className="p-3 hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between transition group text-sm"
                >
                  <div className="flex items-center gap-3">
                    {emp.profile_picture ? (
                      <img src={emp.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        {(emp.full_name || 'E').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition">
                        {emp.full_name || 'Unnamed Employee'}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        ID: <span className="font-semibold text-slate-700">{emp.emp_id || '-'}</span> • {emp.designation || 'Staff'} ({emp.department || 'General'})
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* State 1: No Employee Searched Yet */}
      {!employeeData && !loading && (
        <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-slate-200 flex flex-col items-center justify-center flex-1 space-y-4">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100">
            <UserSearchIcon size={32} />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-lg font-bold text-slate-800">Search to View Employee Profile</h3>
          </div>

          {/* Quick List Suggestion Pills */}
          {employeesList.length > 0 && (
            <div className="pt-4 space-y-2 w-full max-w-xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quick Select Employees</span>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {employeesList.slice(0, 6).map((emp) => (
                  <button
                    key={emp.emp_id || emp.username}
                    onClick={() => handleSelectSuggestion(emp)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 transition flex items-center gap-1.5"
                  >
                    <User size={13} />
                    <span>{emp.full_name || emp.emp_id}</span>
                    <span className="text-slate-400 font-normal">({emp.emp_id})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* State 2: Loading State */}
      {loading && (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-slate-200 flex flex-col items-center justify-center flex-1 space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-600 font-semibold text-sm animate-pulse">Fetching employee records & biometric attendance...</p>
        </div>
      )}

      {/* State 3: Employee Details Displayed */}
      {employeeData && !loading && (
        <div className="space-y-6 flex-1">

          {/* Main Profile Header Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

              {/* Avatar + Basic Identity Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="relative">
                  {employeeData.user.profile_picture ? (
                    <img
                      src={employeeData.user.profile_picture}
                      alt={employeeData.user.full_name}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-slate-200 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-extrabold text-2xl flex items-center justify-center shadow-md border-2 border-white">
                      {(employeeData.user.full_name || 'E').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${employeeData.user.is_active !== false ? 'bg-emerald-500' : 'bg-rose-500'
                    }`} title={employeeData.user.is_active !== false ? 'Active Employee' : 'Inactive Employee'}></span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                      {employeeData.user.full_name || employeeData.user.Name || 'N/A'}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-md border border-indigo-100">
                      EMP ID: {employeeData.user.emp_id || '-'}
                    </span>
                  </div>

                  <p className="text-slate-600 font-semibold text-sm flex items-center gap-2">
                    <Briefcase size={15} className="text-indigo-500" />
                    <span>{employeeData.user.designation || 'Staff'}</span>
                    <span className="text-slate-300">•</span>
                    <Building2 size={15} className="text-indigo-500" />
                    <span>{employeeData.user.department || 'General'}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs border ${employeeData.user.is_active !== false
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                      {employeeData.user.is_active !== false ? '● Active' : '○ Inactive'}
                    </span>

                    {employeeData.user.is_hod && (
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <Award size={13} />
                        HOD
                      </span>
                    )}

                    {employeeData.user.Admin === 'Yes' || employeeData.user.role === 'admin' ? (
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                        <ShieldCheck size={13} />
                        Admin Access
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full font-semibold text-xs bg-slate-100 text-slate-600 border border-slate-200">
                        {employeeData.user.role || 'Employee'}
                      </span>
                    )}

                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs border ${metrics.todayStatusColor}`}>
                      Today: {metrics.todayStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Personal Contact Details Box */}
              <div className="w-full lg:w-auto bg-slate-50/80 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Phone Number</span>
                  <span className="font-extrabold text-indigo-600 flex items-center gap-1.5 mt-0.5">
                    <Phone size={13} />
                    {userPhone}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Email</span>
                  <span className="font-bold text-slate-800 break-all mt-0.5">{employeeData.user.email_id || employeeData.user.username || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Joining Date</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{formatDate(employeeData.user.joining_date)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Date of Birth</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{formatDate(employeeData.user.date_of_birth)}</span>
                </div>
              </div>

            </div>
          </div>

          {/* 4 Summary Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Card 1: Today's Biometric Attendance & Month Lates */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Biometric Attendance</span>
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Clock size={16} />
                </span>
              </div>
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${metrics.todayStatusColor}`}>
                    {metrics.todayStatus}
                  </span>
                </div>

                <div className="space-y-1 text-xs pt-1">
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span className="flex items-center gap-1"><LogIn size={13} className="text-emerald-500" /> In Time:</span>
                    <span className="font-bold text-slate-800">{metrics.todayInTime}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span className="flex items-center gap-1"><LogOut size={13} className="text-rose-500" /> Out Time:</span>
                    <span className="font-bold text-slate-800">{metrics.todayOutTime}</span>
                  </div>
                </div>
              </div>

              {/* Total Lates of this Month Badge */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold flex items-center gap-1">
                  <AlertTriangle size={13} className="text-amber-500" /> Month Lates:
                </span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-extrabold text-xs border border-amber-200">
                  {metrics.totalMonthLates} Days
                </span>
              </div>
            </div>

            {/* Card 2: Leave Balances with COLORED CL and EL & Current Month Leaves */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Leave Balances</span>
                {/* Total Leave Small Pill */}
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold border border-slate-200">
                  Total Leaves: {metrics.totalLeaves}
                </span>
              </div>

              {/* Colored CL & EL Pills */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl bg-blue-50/90 border border-blue-200 flex flex-col items-center text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Casual (CL)</span>
                  <span className="text-base font-black text-blue-700 mt-0.5">
                    {employeeData.balances?.casual_leave_remaining ?? 12}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-500">Remaining</span>
                </div>

                <div className="p-2 rounded-xl bg-emerald-50/90 border border-emerald-200 flex flex-col items-center text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Earned (EL)</span>
                  <span className="text-base font-black text-emerald-700 mt-0.5">
                    {employeeData.balances?.earned_leave_remaining ?? 24}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-500">Remaining</span>
                </div>
              </div>

              {/* Current Month Leaves Prominently Shown */}
              <div className="pt-1 flex items-center justify-between text-[11px] font-semibold text-slate-600 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <FileText size={12} className="text-indigo-500" /> Current Month Leaves:
                </span>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold border border-indigo-100">
                  {metrics.currentMonthLeaves} Days
                </span>
              </div>
            </div>

            {/* Card 3: Gate Pass Summary with SMALL total */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Gate Passes</span>
                {/* Total Gate Pass Small Pill */}
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold border border-slate-200">
                  Total: {metrics.totalGatePasses}
                </span>
              </div>

              <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-700 block">This Month</span>
                  <span className="text-lg font-black text-amber-800">{metrics.currentMonthGatePasses}</span>
                </div>
                <DoorOpen size={20} className="text-amber-500 opacity-80" />
              </div>

              <div className="text-[11px] font-semibold text-slate-500">
                Latest Pass: <strong className="text-slate-700">{employeeData.gatePasses[0]?.timestamp ? formatDate(employeeData.gatePasses[0].timestamp) : 'None'}</strong>
              </div>
            </div>

            {/* Card 4: Assigned HOD Verification */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned HOD</span>
                <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                  <Users size={16} />
                </span>
              </div>

              <div>
                {employeeData.hod ? (
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                      <UserCheck size={14} className="text-purple-600" />
                      {employeeData.hod.full_name}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      ID: <span className="font-semibold text-slate-700">{employeeData.hod.emp_id}</span> ({employeeData.hod.department || 'HOD'})
                    </p>
                    {hodPhone !== '-' && (
                      <p className="text-xs font-bold text-indigo-600 flex items-center gap-1 pt-0.5">
                        <Phone size={11} />
                        {hodPhone}
                      </p>
                    )}
                  </div>
                ) : employeeData.user.is_hod ? (
                  <div>
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">Head of Department</span>
                    <h4 className="font-extrabold text-slate-800 text-sm">Supervises Team</h4>
                    <p className="text-xs text-slate-500 font-medium">{employeeData.teamMembers.length} Team Members</p>
                  </div>
                ) : (
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-400 font-medium text-xs">
                    No HOD assigned in team_members table
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-500">
                Department: <strong className="text-slate-800">{employeeData.user.department || 'N/A'}</strong>
              </div>
            </div>

          </div>

          {/* Navigation Tabs for Detailed Breakdown */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <FileText size={15} />
                <span>Leave History ({employeeData.leaves.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('gatepasses')}
                className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'gatepasses'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <DoorOpen size={15} />
                <span>Gate Passes ({employeeData.gatePasses.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('hierarchy')}
                className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'hierarchy'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <Users size={15} />
                <span>HOD & Team Hierarchy</span>
              </button>

              <button
                onClick={() => setActiveTab('assets')}
                className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'assets'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <Laptop size={15} />
                <span>Issued Assets</span>
              </button>
            </div>

            {/* TAB 1: LEAVE HISTORY */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center justify-between">
                  <span>Leave Requests History</span>
                  <span className="text-xs font-semibold text-slate-400">{employeeData.leaves.length} Total Records</span>
                </h3>

                {employeeData.leaves.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-lg text-slate-400 font-medium text-sm">
                    No leave records found for this employee.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                          <th className="p-3">Type</th>
                          <th className="p-3">From Date</th>
                          <th className="p-3">To Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">HOD Approver</th>
                          <th className="p-3">HR Approver</th>
                          <th className="p-3">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employeeData.leaves.map((leave) => (
                          <tr key={leave.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-bold">
                              <LeaveTypeBadge type={leave.leave_type} />
                            </td>
                            <td className="p-3 font-semibold text-slate-700">{formatDate(leave.leave_date_start)}</td>
                            <td className="p-3 font-semibold text-slate-700">{formatDate(leave.leave_date_end)}</td>
                            <td className="p-3">
                              <StatusBadge status={leave.status} />
                            </td>
                            <td className="p-3 font-medium text-slate-600">{leave.hod_name || leave.hod_id || '-'}</td>
                            <td className="p-3 font-medium text-slate-600">{leave.hr_name || leave.hr_id || '-'}</td>
                            <td className="p-3 text-slate-500 max-w-xs truncate">{leave.remarks || leave.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: GATE PASS HISTORY */}
            {activeTab === 'gatepasses' && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center justify-between">
                  <span>Gate Pass Log Records</span>
                  <span className="text-xs font-semibold text-slate-400">{employeeData.gatePasses.length} Total Records</span>
                </h3>

                {employeeData.gatePasses.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-lg text-slate-400 font-medium text-sm">
                    No gate pass records found for this employee.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                          <th className="p-3">Visit Place</th>
                          <th className="p-3">Reason</th>
                          <th className="p-3">Departure Time</th>
                          <th className="p-3">Arrival Time</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employeeData.gatePasses.map((pass) => (
                          <tr key={pass.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-bold text-slate-800">{pass.place_reason_to_visit || pass.visit_place || '-'}</td>
                            <td className="p-3 text-slate-600 font-medium max-w-xs truncate">{pass.reason || '-'}</td>
                            <td className="p-3 font-medium text-slate-700">{formatDateTime(pass.out_time || pass.departure_time)}</td>
                            <td className="p-3 font-medium text-slate-700">{formatDateTime(pass.in_time || pass.arrival_time)}</td>
                            <td className="p-3">
                              <StatusBadge status={pass.status || pass.approval_status} />
                            </td>
                            <td className="p-3 text-slate-400 text-xs">{formatDateTime(pass.timestamp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: HOD & TEAM HIERARCHY */}
            {activeTab === 'hierarchy' && (
              <div className="space-y-6">

                {/* HOD Details */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm uppercase tracking-wider">Assigned Head of Department (HOD)</h4>
                  {employeeData.hod ? (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {employeeData.hod.profile_picture ? (
                          <img src={employeeData.hod.profile_picture} alt="" className="w-12 h-12 rounded-full object-cover border border-slate-300" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm">
                            {(employeeData.hod.full_name || 'H').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h5 className="font-extrabold text-slate-800 text-base">{employeeData.hod.full_name}</h5>
                          <p className="text-xs text-slate-500 font-medium">
                            EMP ID: <span className="font-semibold text-slate-700">{employeeData.hod.emp_id}</span> • {employeeData.hod.designation || 'HOD'} ({employeeData.hod.department || 'Dept'})
                          </p>
                        </div>
                      </div>

                      {hodPhone !== '-' && (
                        <div className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-100 flex items-center gap-1.5">
                          <Phone size={14} />
                          {hodPhone}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl text-slate-400 font-medium text-xs">
                      No specific HOD assigned in team_members table for this employee.
                    </div>
                  )}
                </div>

                {/* Team Members Managed (if HOD) */}
                {employeeData.user.is_hod && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between">
                      <span>Team Members Supervised</span>
                      <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        {employeeData.teamMembers.length} Members
                      </span>
                    </h4>

                    {employeeData.teamMembers.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl text-slate-400 font-medium text-xs">
                        No team members currently assigned under this HOD.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {employeeData.teamMembers.map((member) => (
                          <div key={member.emp_id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-3 transition">
                            {member.profile_picture ? (
                              <img src={member.profile_picture} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                                {(member.full_name || 'E').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <h5 className="font-bold text-slate-800 text-sm">{member.full_name}</h5>
                              <p className="text-xs text-slate-500">ID: {member.emp_id} • {member.phone_number || member.mobile_no || '-'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* TAB 4: ISSUED ASSETS */}
            {activeTab === 'assets' && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">Company Assets & Equipment Issued</h3>

                {employeeData.assets ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AssetItem label="Laptop / System" value={employeeData.assets.laptop} icon={<Laptop size={16} />} />
                    <AssetItem label="Mobile Device" value={employeeData.assets.mobile} icon={<Phone size={16} />} />
                    <AssetItem label="SIM / Connection" value={employeeData.assets.sim} icon={<Phone size={16} />} />
                    <AssetItem label="Vehicle" value={employeeData.assets.vehicle} icon={<Briefcase size={16} />} />
                    <AssetItem label="Company Email" value={employeeData.assets.email_id} icon={<Mail size={16} />} />
                    <AssetItem label="Punch Code" value={employeeData.assets.punch_code} icon={<UserCheck size={16} />} />
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-lg text-slate-400 font-medium text-sm">
                    No company assets records found for this employee in the assets table.
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};

// Helper Components
const UserSearchIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <circle cx="19" cy="11" r="3" />
    <path d="m21 13-1.5-1.5" />
  </svg>
);

const AssetItem = ({ label, value, icon }) => (
  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
    <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">{icon}</span>
    <div>
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
      <span className="font-extrabold text-slate-800 text-sm block mt-0.5">{value || 'Not Issued'}</span>
    </div>
  </div>
);

const LeaveTypeBadge = ({ type }) => {
  if (!type) return <span className="whitespace-nowrap inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">Leave</span>;
  const t = String(type).toLowerCase();

  let label = type;
  if (t.includes('casual') || t === 'cl') label = 'CL (Casual Leave)';
  else if (t.includes('earned') || t === 'el') label = 'EL (Earned Leave)';
  else if (t.includes('unpaid') || t === 'lwp') label = 'Unpaid Leave';

  if (t.includes('casual') || t.includes('cl')) {
    return <span className="whitespace-nowrap inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">{label}</span>;
  }
  if (t.includes('earned') || t.includes('el')) {
    return <span className="whitespace-nowrap inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">{label}</span>;
  }
  if (t.includes('unpaid') || t.includes('lwp')) {
    return <span className="whitespace-nowrap inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">{label}</span>;
  }
  return <span className="whitespace-nowrap inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">{label}</span>;
};

const StatusBadge = ({ status }) => {
  if (!status) return <span className="text-slate-400 font-medium">-</span>;
  const s = String(status).toLowerCase();

  if (s.includes('approved') || s === 'true') {
    return <span className="whitespace-nowrap inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Approved</span>;
  }
  if (s.includes('reject') || s === 'false') {
    return <span className="whitespace-nowrap inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">Rejected</span>;
  }
  return <span className="whitespace-nowrap inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">{status}</span>;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB');
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default EmployeeDetails;

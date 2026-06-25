import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { supabase } from '../supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
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
  PartyPopper
} from 'lucide-react';
import dayjs from 'dayjs';

const Dashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Admin check
    if (user && user.Admin !== 'Yes') {
      navigate('/my-profile');
    }
  }, [user, navigate]);

  const [totalEmployee, setTotalEmployee] = useState(0);
  const [activeEmployee, setActiveEmployee] = useState(0);
  const [resignedEmployee, setResignedEmployee] = useState(0);
  const [leftEmployee, setLeftEmployee] = useState(0);
  const [leftThisMonth, setLeftThisMonth] = useState(0);
  const [monthlyHiringData, setMonthlyHiringData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [vacancies, setVacancies] = useState([]);

  // Operational widget state
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [recentGatepasses, setRecentGatepasses] = useState([]);
  const [recentApplicants, setRecentApplicants] = useState([]);

  // Birthday & Anniversary state
  const [usersData, setUsersData] = useState([]);
  const [birthdayRecords, setBirthdayRecords] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);

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

  // Helper to process distribution data
  const getDistribution = (data, key) => {
    const counts = {};
    data.forEach(item => {
      let val = item[key] ? item[key].trim() : 'Unknown';
      // Grouping logic
      if (val.toLowerCase().includes('approve')) val = 'Approved';
      else if (val.toLowerCase().includes('reject')) val = 'Rejected';
      else if (val.toLowerCase().includes('pending')) val = 'Pending HOD';

      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString();

        // 1. Fetch Users Data (Active & Total)
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('emp_id, is_active, department, designation, joining_date, full_name, profile_picture');

        if (usersError) throw usersError;

        setUsersData(usersData || []);

        const total = usersData.length;
        const active = usersData.filter(u => u.is_active).length;
        const inactive = total - active;

        setTotalEmployee(total);
        setActiveEmployee(active);

        // Department Distribution
        const depts = getDistribution(usersData.filter(u => u.is_active), 'department');
        setDepartmentData(depts);

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
          if (u.department) uniqueDepts.add(u.department.trim());
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


        // 2. Fetch Employee Leaving Data
        const { data: leavingData, error: leavingError } = await supabase
          .from('employee_leaving')
          .select('date_of_leaving, actual_date');

        if (leavingError) throw leavingError;

        const currentMonthLeaves = leavingData.filter(l => {
          const d = l.actual_date || l.date_of_leaving;
          if (!d) return false;
          const date = new Date(d);
          return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        }).length;

        setLeftThisMonth(currentMonthLeaves);
        setResignedEmployee(inactive);

        // 3. Hiring vs Attrition Trends (Last 6 Months)
        const months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          months.push({
            name: d.toLocaleString('default', { month: 'short' }),
            monthIndex: d.getMonth(),
            year: d.getFullYear(),
            hired: 0,
            left: 0
          });
        }

        usersData.forEach(user => {
          if (user.joining_date) {
            const jd = new Date(user.joining_date);
            const month = months.find(m => m.monthIndex === jd.getMonth() && m.year === jd.getFullYear());
            if (month) month.hired++;
          }
        });

        leavingData.forEach(l => {
          const dStr = l.actual_date || l.date_of_leaving;
          if (dStr) {
            const ld = new Date(dStr);
            const month = months.find(m => m.monthIndex === ld.getMonth() && m.year === ld.getFullYear());
            if (month) month.left++;
          }
        });

        setMonthlyHiringData(months);


        // 4. Fetch Recent Operational Data
        const [leavesRes, gatepassRes, applicantsRes, birthdaysRes] = await Promise.all([
          supabase.from('leave_management')
            .select('id, employee_name, leave_type, status, leave_date_start, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('gate_pass')
            .select('id, emp_name, place_reason_to_visit, status, timestamp')
            .order('timestamp', { ascending: false })
            .limit(5),
          supabase.from('job_leads')
            .select('id, candidate_name, post, candidate_experience, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('birthday')
            .select('*')
            .order('created_at', { ascending: false })
        ]);

        if (leavesRes.error) console.error(leavesRes.error);
        else setRecentLeaves(leavesRes.data || []);

        if (gatepassRes.error) console.error(gatepassRes.error);
        else setRecentGatepasses(gatepassRes.data || []);

        if (applicantsRes.error) console.error(applicantsRes.error);
        else setRecentApplicants(applicantsRes.data || []);

        if (birthdaysRes.error) console.error(birthdaysRes.error);
        else setBirthdayRecords(birthdaysRes.data || []);        // 6. Fetch Recent Job Vacancies
        const { data: jobs, error: jobsError } = await supabase
          .from('job_vacancy')
          .select('*')
          .order('id', { ascending: false })
          .limit(3);

        if (!jobsError && jobs) {
          const jobsWithCounts = await Promise.all(jobs.map(async (job) => {
            const { count } = await supabase
              .from('job_leads')
              .select('*', { count: 'exact', head: true })
              .eq('post', job.post);
            return { ...job, applied_count: count || 0 };
          }));
          setVacancies(jobsWithCounts);
        }

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

  useEffect(() => {
    if (futureEventsCount > 1) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % futureEventsCount);
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [futureEventsCount]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return dayjs(dateStr).format('D MMMM YYYY');
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-[1600px] mx-auto space-y-3 sm:space-y-5 min-h-screen font-sans bg-slate-50/30">
      {/* Header */}
      <div className="flex items-center justify-between gap-1.5 mb-1 sm:mb-4 px-1 sm:px-0">
        <div className="text-left">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-600 text-xs sm:text-base mt-0.5 font-semibold">Welcome back! SKA HR System</p>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 sm:px-4 sm:py-2 bg-white rounded-full shadow-sm border border-slate-200/60 flex-shrink-0">
          <Calendar size={12} className="text-slate-400 sm:w-4 sm:h-4" />
          <span className="text-[10px] sm:text-sm font-bold text-slate-700">
            {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-6">
        <StatCard
          title="Total Employees"
          value={totalEmployee}
          icon={Users}
          trend="+2.5%"
          trendUp={true}
          color="indigo"
        />
        <StatCard
          title="Active Employees"
          value={activeEmployee}
          icon={UserCheck}
          trend="Stable"
          trendUp={true}
          color="emerald"
        />
        <StatCard
          title="Inactive / Resigned"
          value={resignedEmployee}
          icon={UserX}
          trend="Total"
          trendUp={false}
          color="amber"
        />
        <StatCard
          title="Left This Month"
          value={leftThisMonth}
          icon={Activity}
          trend="Current Month"
          trendUp={false}
          color="rose"
        />
      </div>

      {/* Main Grid: Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5 sm:gap-6">

        {/* Today's In UI - 1 Col */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 flex flex-col">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight">Today's In</h3>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="text-xs font-semibold bg-white border border-slate-200 text-slate-700 py-1.5 px-2 sm:px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-sm hover:bg-slate-50 transition-colors"
              >
                <option value="All Departments">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="relative mt-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search ID or Name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-9 pr-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3"
            style={{ maxHeight: '420px' }}
            onScroll={handlePresentScroll}
          >
            {/* On Time Present List */}
            {filteredPresent.slice(0, presentLimit).map(emp => (
              <div key={emp.emp_id} className="p-3 bg-white border border-slate-100 border-dashed rounded-xl flex items-center justify-between hover:shadow-sm transition-shadow gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {emp.profile_picture ? (
                    <img src={emp.profile_picture} alt={emp.full_name} className="w-10 h-10 rounded-full object-cover shadow-sm flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shadow-sm flex-shrink-0">
                      {emp.full_name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 truncate">{emp.full_name}</h4>
                    <p className="text-xs text-slate-500 font-medium truncate">{emp.designation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <Clock3 size={14} className="text-slate-400 hidden sm:block" />
                  <span className="px-2 py-1 bg-emerald-500 text-white text-[11px] font-bold rounded flex items-center gap-1 shadow-sm whitespace-nowrap">
                    <span className="w-1 h-1 bg-white rounded-full flex-shrink-0"></span>
                    {emp.inTime}
                  </span>
                </div>
              </div>
            ))}

            {filteredPresent.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm font-medium">
                <Clock3 size={32} className="mx-auto mb-2 opacity-30" />
                No punctual logs found
              </div>
            )}
          </div>
        </div>

        {/* Late UI - 1 Col */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 flex flex-col">
          <div className="mb-4">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight">Late Today</h3>
          </div>

          <div
            className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3"
            style={{ maxHeight: '420px' }}
            onScroll={handleLateScroll}
          >
            {/* Late Section */}
            {filteredLate.slice(0, lateLimit).map(emp => (
              <div key={emp.emp_id} className="p-3 bg-white border border-slate-100 border-dashed rounded-xl flex items-center justify-between hover:shadow-sm transition-shadow gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {emp.profile_picture ? (
                    <img src={emp.profile_picture} alt={emp.full_name} className="w-10 h-10 rounded-full object-cover shadow-sm flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shadow-sm flex-shrink-0">
                      {emp.full_name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{emp.full_name}</h4>
                      <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-bold rounded flex items-center gap-0.5 shadow-sm whitespace-nowrap flex-shrink-0">
                        <Clock size={10} className="flex-shrink-0" /> {emp.lateStr}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{emp.designation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <Clock3 size={14} className="text-slate-400 hidden sm:block" />
                  <span className="px-2 py-1 bg-emerald-500 text-white text-[11px] font-bold rounded flex items-center gap-1 shadow-sm whitespace-nowrap">
                    <span className="w-1 h-1 bg-white rounded-full flex-shrink-0"></span>
                    {emp.inTime}
                  </span>
                </div>
              </div>
            ))}

            {filteredLate.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm font-medium">
                <Clock3 size={32} className="mx-auto mb-2 opacity-30" />
                No late logs found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Department Chart - Full Width */}
      <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200">
        <div className="mb-6 flex items-center gap-2">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Layers size={18} className="text-purple-600" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">Department Overview</h3>
            <p className="text-xs sm:text-sm text-slate-600 font-semibold">Employee distribution by department</p>
          </div>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc', opacity: 0.5 }}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" name="Employees" radius={[6, 6, 0, 0]} barSize={45}>
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Recent Leaves</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-semibold">Latest leave requests</p>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-3">
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
          <button onClick={() => navigate('/leave-management')} className="w-full mt-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors">
            View All Leaves
          </button>
        </div>

        {/* Recent Gate Passes Card */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-emerald-50 rounded-lg">
                <MapPin size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Recent Gate Passes</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-semibold">Latest out-of-office logs</p>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-3">
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
          <button onClick={() => navigate('/gate-pass')} className="w-full mt-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors">
            View All Gate Passes
          </button>
        </div>
      </div>

      {/* Grid 2: Job Vacancies & Applicants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">

        {/* Job Vacancies Widget */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg">
                <Briefcase size={18} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Job Openings</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-semibold">Recent vacancies</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {vacancies.length > 0 ? (
              vacancies.map((job, index) => (
                <div key={index} className="p-4 rounded-2xl border border-slate-100/50 bg-slate-50/50 flex justify-between items-center hover:bg-white hover:shadow-md hover:shadow-slate-200/50 hover:border-slate-100 transition-all cursor-default">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{job.post}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-100">{job.department}</span>
                      <span className="text-[10px] font-medium text-slate-400">{job.number_of_posts} posts</span>
                      <span className="text-[10px] font-medium text-slate-400">• {job.timestamp ? new Date(job.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{job.applied_count} Applied</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-300">
                <Briefcase size={40} className="mb-2 opacity-50" />
                <p className="text-sm font-medium">No open vacancies</p>
              </div>
            )}
          </div>
          {vacancies.length > 0 && (
            <button
              onClick={() => navigate('/job-vacancy')}
              className="w-full mt-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
            >
              View All Jobs
            </button>
          )}
        </div>

        {/* Recent Applicants Card */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-purple-50 rounded-lg">
                <Users size={18} className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Recent Applicants</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-semibold">Latest job inquiries</p>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            {recentApplicants.length > 0 ? (
              recentApplicants.map((applicant, index) => (
                <div key={index} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div className="min-w-0 pr-2">
                    <h4 className="text-sm font-bold text-slate-800 truncate">{applicant.candidate_name}</h4>
                    <p className="text-xs text-slate-500 font-medium truncate">{applicant.post} • {applicant.candidate_experience || 'Fresher'} • {applicant.created_at ? new Date(applicant.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}</p>
                  </div>
                  <span className={`px-2 py-1 flex-shrink-0 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700`}>
                    Pending
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No recent applicants</p>
            )}
          </div>
          <button onClick={() => navigate('/employee-enquiry')} className="w-full mt-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors">
            View All Applicants
          </button>
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
                <div className="flex flex-col gap-4 sm:gap-6">
                  {todaysEvents.map((record, index) => {
                    const isBirthday = record.type === 'Birthday';
                    return (
                      <div key={index} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 overflow-hidden flex flex-col sm:flex-row group relative">
                        {/* LEFT SIDE: Photo */}
                        <div className="w-full sm:w-[35%] shrink-0 bg-slate-50 relative flex items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-100 min-h-[160px] sm:min-h-[200px]">
                          {record.photo ? (
                            <img
                              src={record.photo}
                              alt={record.empName}
                              className="w-full h-48 sm:h-full sm:absolute sm:inset-0 object-contain p-4 cursor-default transition-transform"
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
                            {isBirthday ? "Today's Birthday!" : "Today's Anniversary!"}
                          </h2>
                          <h3 className="font-bold text-slate-800 text-xl sm:text-2xl leading-tight">{record.empName}</h3>

                          <div className="w-full mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-100 flex flex-col gap-2 sm:gap-3">
                            {record.date_of_birth && (
                              <div className="flex justify-between items-center text-sm sm:text-base">
                                <span className="text-slate-500 flex items-center gap-2"><Cake size={16} className="text-purple-400" /> Date of Birth</span>
                                <span className="font-medium text-slate-900">{formatDate(record.date_of_birth)}</span>
                              </div>
                            )}
                            {record.aniversary && (
                              <div className="flex justify-between items-center text-sm sm:text-base">
                                <span className="text-slate-500 flex items-center gap-2"><Gift size={16} className="text-pink-400" /> Anniversary</span>
                                <span className="font-medium text-slate-900">{formatDate(record.aniversary)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 xl:p-0 flex items-center xl:flex-col xl:items-stretch gap-4 xl:gap-0 relative overflow-hidden transition-all duration-300" style={{ animation: 'fadeSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        {record.photo ? (
                          <img src={record.photo} alt={record.empName} className="w-12 h-12 xl:w-full xl:h-56 xl:rounded-none xl:border-0 rounded-lg border border-slate-100 shadow-sm object-cover shrink-0" />
                        ) : (
                          <div className="w-12 h-12 xl:w-full xl:h-56 xl:rounded-none xl:border-0 rounded-lg border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-5 h-5 xl:w-12 xl:h-12 text-slate-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 xl:p-6 bg-white xl:border-t border-slate-100">
                          <p className="text-[10px] xl:text-xs font-bold text-indigo-600 uppercase tracking-wider mb-0.5 xl:mb-1.5">{record.type === 'Birthday' ? 'Upcoming Birthday' : 'Upcoming Anniversary'}</p>
                          <h4 className="font-bold text-slate-900 text-sm xl:text-xl truncate">{record.empName}</h4>
                          <p className="text-xs xl:text-sm text-slate-500 mt-0.5 xl:mt-2 flex items-center gap-1.5">
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
              <button onClick={() => navigate('/birthdays')} className="w-full mt-6 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors">
                View All Events
              </button>
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

export default Dashboard;
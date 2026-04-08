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
  Clock3
} from 'lucide-react';

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
  const [designationData, setDesignationData] = useState([]);
  const [leaveStatusData, setLeaveStatusData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [vacancies, setVacancies] = useState([]);

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
          .select('emp_id, is_active, department, designation, joining_date');

        if (usersError) throw usersError;

        const total = usersData.length;
        const active = usersData.filter(u => u.is_active).length;
        const inactive = total - active;

        setTotalEmployee(total);
        setActiveEmployee(active);

        // Department Distribution
        const depts = getDistribution(usersData.filter(u => u.is_active), 'department');
        setDepartmentData(depts);

        // Designation Distribution
        const desigs = getDistribution(usersData.filter(u => u.is_active), 'designation');
        setDesignationData(desigs.sort((a, b) => b.value - a.value).slice(0, 8));


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


        // 4. Leave Management Stats
        const { data: leaveData, error: leaveError } = await supabase
          .from('leave_management')
          .select('status');

        if (leaveError) throw leaveError;

        const leaveStats = getDistribution(leaveData, 'status');
        setLeaveStatusData(leaveStats);



        // 6. Fetch Recent Job Vacancies
        const { data: jobs, error: jobsError } = await supabase
          .from('job_vacancy')
          .select('*')
          .order('id', { ascending: false })
          .limit(3);

        if (!jobsError && jobs) setVacancies(jobs);

      } catch (error) {
        // console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-1 sm:p-8 max-w-[1600px] mx-auto space-y-4 sm:space-y-8 min-h-screen font-sans">
      {/* Header */}
      <div className="flex items-center justify-between gap-1.5 mb-1 sm:mb-4 px-1 sm:px-0">
        <div className="text-left">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-800 tracking-tight">Dashboard Overview</h1>
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

      {/* Main Grid: Hiring Trend, Leave Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5 sm:gap-6">

        {/* Hiring Trend - 2 Cols */}
        <div className="bg-white p-3 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">Recruitment Analytics</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-1">Hiring vs Attrition</p>
            </div>
            <div className="flex items-center gap-6 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow shadow-emerald-200"></span>
                <span className="text-xs font-semibold text-slate-600">Hired</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 shadow shadow-rose-200"></span>
                <span className="text-xs font-semibold text-slate-600">Left</span>
              </div>
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyHiringData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHired" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLeft" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '16px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(10px)',
                    padding: '12px 16px'
                  }}
                  itemStyle={{ fontSize: '13px', fontWeight: 600, padding: '2px 0' }}
                  labelStyle={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '8px' }}
                />
                <Area
                  type="monotone"
                  dataKey="hired"
                  stroke="#10b981"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorHired)"
                />
                <Area
                  type="monotone"
                  dataKey="left"
                  stroke="#f43f5e"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorLeft)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leave Status - 1 Col */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] border border-slate-100 flex flex-col">
          <div className="mb-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-800">Leave Requests</h3>
            <p className="text-xs sm:text-sm text-slate-600 font-semibold">Current status distribution</p>
          </div>
          <div className="flex-1 min-h-[200px] sm:min-h-[220px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leaveStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {leaveStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#CBD5E1'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl sm:text-3xl font-bold text-slate-800">{leaveStatusData.reduce((a, b) => a + b.value, 0)}</span>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Requests</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {leaveStatusData.map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-slate-600 bg-slate-50 px-2 sm:px-2.5 py-1 rounded-md border border-slate-100">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.name] || '#CBD5E1' }}></span>
                {entry.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department Chart - Full Width */}
      <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] border border-slate-100">
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

      {/* Secondary Grid: Top Designations, Job Vacancies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-1.5 sm:gap-6">

        {/* Designations Chart - Converted to Pie */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] border border-slate-100 flex flex-col">
          <div className="mb-4 flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-teal-50 rounded-lg">
              <Briefcase size={16} className="text-teal-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">Top Designations</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-semibold">Headcount by role</p>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={designationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                >
                  {designationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2 max-h-[100px] overflow-y-auto custom-scrollbar">
            {designationData.map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100 hover:bg-slate-100 transition-colors">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span className="truncate max-w-[100px]" title={entry.name}>{entry.name}</span>
                <span className="text-slate-400">({entry.value})</span>
              </div>
            ))}
          </div>
        </div>



        {/* Job Vacancies Widget */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] border border-slate-100">
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

          <div className="space-y-3">
            {vacancies.length > 0 ? (
              vacancies.map((job, index) => (
                <div key={index} className="p-4 rounded-2xl border border-slate-100/50 bg-slate-50/50 flex justify-between items-center hover:bg-white hover:shadow-md hover:shadow-slate-200/50 hover:border-slate-100 transition-all cursor-default">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{job.post}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-100">{job.department}</span>
                      <span className="text-[10px] font-medium text-slate-400">{job.number_of_posts} posts</span>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"></div>
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

      </div>
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
    <div className="bg-white p-2.5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
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
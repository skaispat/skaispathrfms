import React, { useEffect, useState } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, ChevronDown, Activity, AlertCircle } from 'lucide-react';

const MyAttendance = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [stats, setStats] = useState({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    workingHours: 0,
    overtimeHours: 0
  });

  // Get user from localStorage
  const getUser = () => {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing user data from localStorage:', error);
      return null;
    }
  };

  const fetchAttendanceData = async () => {
    const user = getUser();
    if (!user || !user.emp_id) {
      setError("User information not found. Please log in.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("https://sohcm.com/SmartApp_ess/api/SwipeDetails/GetDeviceLogs?APIKey=341813122509&AccountName=SKAISPAT&FromDate=2025-12-01&ToDate=2026-12-01");

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();

      // Filter logs for the current user
      const userLogs = data.filter(log => String(log.UserId) === String(user.emp_id));

      const groupedData = {};

      userLogs.forEach(log => {
        const dateStr = log.LogDate.split('T')[0];
        if (!groupedData[dateStr]) {
          groupedData[dateStr] = {
            date: dateStr,
            logs: []
          };
        }
        groupedData[dateStr].logs.push(log.LogDate);
      });

      const processedData = Object.values(groupedData).map(item => {
        item.logs.sort();
        const firstLog = item.logs[0];
        const lastLog = item.logs[item.logs.length - 1];

        const inTime = firstLog.split('T')[1].substring(0, 5); // HH:MM
        const outTime = item.logs.length > 1 ? lastLog.split('T')[1].substring(0, 5) : null;

        let workingHoursDisplay = '0h 0m';
        let workingHoursVal = 0;
        let overtimeVal = 0;
        let overtimeDisplay = '0h 0m';

        if (outTime) {
          const start = new Date(firstLog);
          const end = new Date(lastLog);
          const diffMs = end - start;

          workingHoursVal = diffMs / 3600000;

          const hours = Math.floor(diffMs / 3600000);
          const minutes = Math.floor((diffMs % 3600000) / 60000);
          workingHoursDisplay = `${hours}h ${minutes}m`;

          // Overtime Calculation (Threshold: 9 hours)
          const nineHoursMs = 9 * 60 * 60 * 1000;
          if (diffMs > nineHoursMs) {
            const extraMs = diffMs - nineHoursMs;
            overtimeVal = extraMs / 3600000;
            const otHours = Math.floor(extraMs / 3600000);
            const otMinutes = Math.floor((extraMs % 3600000) / 60000);
            overtimeDisplay = `${otHours}h ${otMinutes}m`;
          }
        }

        return {
          date: item.date,
          day: new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' }),
          inTime: inTime,
          outTime: outTime || '-',
          workingHoursDisplay: workingHoursDisplay,
          workingHoursVal: workingHoursVal,
          overtimeDisplay: overtimeDisplay,
          overtimeVal: overtimeVal,
          status: 'Present',
        };
      });

      // Sort by Date DESC
      processedData.sort((a, b) => new Date(b.date) - new Date(a.date));

      setAttendanceData(processedData);

    } catch (error) {
      console.error('Error fetching attendance data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  useEffect(() => {
    let currentMonthData = [];

    if (attendanceData.length > 0) {
      currentMonthData = attendanceData.filter(record => {
        const d = new Date(record.date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
    }

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    const now = new Date();
    let effectiveDays = daysInMonth;
    if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth()) {
      effectiveDays = now.getDate();
    } else if (new Date(selectedYear, selectedMonth, 1) > now) {
      effectiveDays = 0; // Future month
    }

    const presentCount = currentMonthData.length;
    const absentCount = Math.max(0, effectiveDays - presentCount);

    const totalWorkHrs = currentMonthData.reduce((acc, curr) => acc + curr.workingHoursVal, 0);
    const totalOtHrs = currentMonthData.reduce((acc, curr) => acc + curr.overtimeVal, 0);

    setStats({
      totalDays: effectiveDays,
      presentDays: presentCount,
      absentDays: absentCount,
      workingHours: totalWorkHrs,
      overtimeHours: totalOtHrs
    });

  }, [attendanceData, selectedMonth, selectedYear]);

  const filteredRecords = attendanceData.filter(record => {
    const d = new Date(record.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [2023, 2024, 2025, 2026];

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Overview of your daily check-ins and performance.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="appearance-none bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 block w-40 py-2.5 pl-4 pr-10 cursor-pointer shadow-sm transition-all hover:border-slate-300"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="appearance-none bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 block w-32 py-2.5 pl-4 pr-10 cursor-pointer shadow-sm transition-all hover:border-slate-300"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 shrink-0">
        <StatCard
          label="Total Days"
          value={stats.totalDays}
          icon={Calendar}
          color="text-blue-600"
          bg="bg-blue-50/50"
        />
        <StatCard
          label="Present"
          value={stats.presentDays}
          icon={CheckCircle}
          color="text-emerald-600"
          bg="bg-emerald-50/50"
        />
        <StatCard
          label="Absent"
          value={stats.absentDays}
          icon={XCircle}
          color="text-rose-600"
          bg="bg-rose-50/50"
        />
        <StatCard
          label="Working Hrs"
          value={stats.workingHours.toFixed(1)}
          icon={Activity}
          color="text-indigo-600"
          bg="bg-indigo-50/50"
          subValue="hrs"
        />
        <StatCard
          label="Overtime"
          value={stats.overtimeHours.toFixed(1)}
          icon={Clock}
          color="text-amber-600"
          bg="bg-amber-50/50"
          subValue="hrs"
        />
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 flex-1">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 text-sm font-medium">Retrieving logs...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 flex-1">
            <div className="bg-red-50 p-3 rounded-full mb-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-slate-900 font-medium">Unable to load attendance</p>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">{error}</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 pl-8 font-semibold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Day</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Check In</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Check Out</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Working Hrs</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Overtime</th>
                  <th className="px-6 py-4 pr-8 font-semibold text-slate-500 uppercase tracking-wider text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((record, index) => {
                    return (
                      <tr key={index} className="group hover:bg-slate-50 transition-colors duration-150">
                        <td className="px-6 py-4 pl-8 font-medium text-slate-900">
                          {record.date.split('-').reverse().join('/')}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {record.day}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                            {record.inTime || '--:--'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                            {record.outTime !== '-' ? record.outTime : '--:--'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">
                          {record.workingHoursDisplay}
                        </td>
                        <td className="px-6 py-4">
                          {record.overtimeVal > 0 ? (
                            <span className="text-amber-600 font-medium inline-flex items-center gap-1">
                              {record.overtimeDisplay}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 pr-8">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500"></span>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="bg-slate-50 rounded-full p-4 mb-4">
                          <Calendar className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-slate-900 font-medium">No Records Found</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          No attendance data available for {months[selectedMonth]} {selectedYear}.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color, bg, subValue }) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between hover:shadow-md transition-shadow duration-200">
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        {subValue && <span className="text-xs text-slate-400 font-medium">{subValue}</span>}
      </div>
    </div>
    <div className={`p-2.5 rounded-lg ${bg}`}>
      <Icon size={20} className={color} />
    </div>
  </div>
);

export default MyAttendance;
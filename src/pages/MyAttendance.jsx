import React, { useEffect, useState } from 'react';
import { getMyAttendanceInitialData, markMyAttendancePunch } from '../api/myAttendanceApi';
import { Calendar, Clock, CheckCircle, XCircle, ChevronDown, Activity, AlertCircle, FileText, MapPin, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const TARGET_LAT = 21.237836;
const TARGET_LNG = 81.714938;
const RADIUS_METERS = 50;

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const getISTDateDetails = () => {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find(p => p.type === type).value;

  const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  let hour = getPart('hour');
  if (hour === '24') hour = '00';
  const timeStr = `${hour}:${getPart('minute')}:${getPart('second')}`;

  const monthNameFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'long' });
  const dayNameFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' });

  return {
    year: parseInt(getPart('year')),
    dateStr,
    timeStr,
    monthName: monthNameFormatter.format(date),
    dayName: dayNameFormatter.format(date)
  };
};

const MyAttendance = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [stats, setStats] = useState({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    workingHours: 0,
    overtimeHours: 0
  });
  const [weekOff, setWeekOff] = useState('');
  const [userLeaves, setUserLeaves] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');

  // Geolocation State
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Checking location...');
  const [isPunching, setIsPunching] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const dist = calculateDistance(latitude, longitude, TARGET_LAT, TARGET_LNG);

        if (dist <= RADIUS_METERS) {
          setIsWithinRange(true);
          setLocationStatus('In range (ready)');
        } else {
          setIsWithinRange(false);
          setLocationStatus(`Out of range (${Math.round(dist)}m away)`);
        }
      },
      (error) => {
        setIsWithinRange(false);
        setLocationStatus('Location access denied');
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);


  const weekDayMap = {
    'SUNDAY': 0,
    'MONDAY': 1,
    'TUESDAY': 2,
    'WEDNESDAY': 3,
    'THURSDAY': 4,
    'FRIDAY': 5,
    'SATURDAY': 6
  };

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
      const currentYear = new Date().getFullYear();
      const { weekOff, userLeaves, dailyRecords } = await getMyAttendanceInitialData(user.emp_id, currentYear);

      if (weekOff) {
        setWeekOff(weekOff);
      }
      // 1. Fetch Biometric API logs
      let groupedData = {};
      const biometricApiUrl = import.meta.env.VITE_BIOMETRIC_API_URL;
      if (biometricApiUrl) {
        try {
          const response = await fetch(`${biometricApiUrl}&FromDate=${currentYear}-01-01&ToDate=${currentYear}-12-31`);
          if (response.ok) {
            const bioData = await response.json();
            if (Array.isArray(bioData)) {
              const userLogs = bioData.filter(log => String(log.UserId) === String(user.emp_id));
              userLogs.forEach(log => {
                const dateStr = log.LogDate ? log.LogDate.split('T')[0] : null;
                if (dateStr) {
                  if (!groupedData[dateStr]) {
                    groupedData[dateStr] = { logs: [] };
                  }
                  groupedData[dateStr].logs.push(log.LogDate);
                }
              });
            }
          }
        } catch (bioErr) {
          console.warn('Biometric API fetch error:', bioErr);
        }
      }

      // 2. Process Manual / Daily Records from database
      const manualDataMap = {};
      if (dailyRecords) {
        dailyRecords.forEach(record => {
          manualDataMap[record.date] = record;
        });
      }

      // 3. Process and Merge
      const allDates = new Set([...Object.keys(groupedData), ...Object.keys(manualDataMap)]);

      const processedData = Array.from(allDates).map(dateStr => {
        const apiItem = groupedData[dateStr];
        const manualItem = manualDataMap[dateStr];

        let inTime = null;
        let outTime = null;

        const formatWithSeconds = (t) => {
          if (!t || t === '-') return null;
          const clean = t.includes('T') ? t.split('T')[1] : t;
          const parts = clean.split(':');
          if (parts.length >= 3) {
            return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].substring(0, 2).padStart(2, '0')}`;
          } else if (parts.length === 2) {
            return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
          }
          return t;
        };

        if (apiItem) {
          apiItem.logs.sort();
          inTime = formatWithSeconds(apiItem.logs[0]);
          if (apiItem.logs.length > 1) {
            outTime = formatWithSeconds(apiItem.logs[apiItem.logs.length - 1]);
          }
        }

        if (manualItem) {
          const manualIn = formatWithSeconds(manualItem.in_time);
          const manualOut = formatWithSeconds(manualItem.out_time);

          if (manualIn && (!inTime || manualIn < inTime)) {
            inTime = manualIn;
          }
          if (manualOut && (!outTime || manualOut > outTime)) {
            outTime = manualOut;
          }
        }

        let workingHoursDisplay = '0h 0m';
        let workingHoursVal = 0;
        let overtimeVal = 0;
        let overtimeDisplay = '0h 0m';

        if (inTime && outTime && outTime !== '-') {
          const start = new Date(`${dateStr}T${inTime}`);
          const end = new Date(`${dateStr}T${outTime}`);
          const diffMs = end - start;

          if (diffMs > 0) {
            workingHoursVal = diffMs / 3600000;
            const hours = Math.floor(diffMs / 3600000);
            const minutes = Math.floor((diffMs % 3600000) / 60000);
            workingHoursDisplay = `${hours}h ${minutes}m`;

            const nineHoursMs = 9 * 60 * 60 * 1000;
            if (diffMs > nineHoursMs) {
              const extraMs = diffMs - nineHoursMs;
              overtimeVal = extraMs / 3600000;
              const otHours = Math.floor(extraMs / 3600000);
              const otMinutes = Math.floor((extraMs % 3600000) / 60000);
              overtimeDisplay = `${otHours}h ${otMinutes}m`;
            }
          }
        }

        return {
          date: dateStr,
          day: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }),
          inTime: inTime || '-',
          outTime: outTime || '-',
          workingHoursDisplay: workingHoursDisplay,
          workingHoursVal: workingHoursVal,
          overtimeDisplay: overtimeDisplay,
          overtimeVal: overtimeVal,
          status: 'Present',
          isMobile: !apiItem && !!manualItem,
        };
      });

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

  const handleMarkAttendance = async () => {
    if (!isWithinRange || isPunching) return;

    setIsPunching(true);
    const userObj = getUser();
    if (!userObj || !userObj.emp_id) {
      toast.error("User not found!");
      setIsPunching(false);
      return;
    }

    try {
      const { year, dateStr, timeStr, monthName, dayName } = getISTDateDetails();

      await markMyAttendancePunch(userObj.emp_id, dateStr, year, monthName, dayName, timeStr, userObj.Name);

      toast.success("Attendance Marked Successfully!");
      fetchAttendanceData();
    } catch (error) {
      console.error("Error marking attendance:", error);
      toast.error("Failed to mark attendance.");
    } finally {
      setIsPunching(false);
    }
  };

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

    let presentCount = currentMonthData.length;
    const weekOffDayIndex = weekDayMap[weekOff];

    // Helper for Sandwich Rule
    const isDayAbsentOrOnLeave = (dateObj) => {
      const dStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

      // Check Swipe
      const hasSwipe = attendanceData.some(r => r.date === dStr);
      if (hasSwipe) return false;

      // Check Leaves
      const onLeave = userLeaves.some(l => {
        const start = l.leave_date_start;
        const end = l.leave_date_end;
        return dStr >= start && dStr <= end;
      });
      if (onLeave) return true;

      // If no swipe and not a week off, it's Absent
      if (dateObj.getDay() !== weekOffDayIndex) return true;

      return false; // Default for week off
    };

    // Check for days that are week off but not swiped
    if (weekOff) {
      for (let d = 1; d <= effectiveDays; d++) {
        const date = new Date(selectedYear, selectedMonth, d);
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSwiped = currentMonthData.some(r => r.date === dateStr);

        if (!isSwiped && date.getDay() === weekOffDayIndex) {
          // Sandwich Rule Logic: Check d-1 and d+1
          const prevDay = new Date(selectedYear, selectedMonth, d - 1);
          const nextDay = new Date(selectedYear, selectedMonth, d + 1);

          const isPrevAbsent = isDayAbsentOrOnLeave(prevDay);
          const isNextAbsent = isDayAbsentOrOnLeave(nextDay);

          if (isPrevAbsent && isNextAbsent) {
            // Sandwich triggered - Week Off counts as ABSENT
          } else {
            presentCount++;
          }
        }
      }
    }

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

  }, [attendanceData, selectedMonth, selectedYear, weekOff, userLeaves]);

  const filteredRecords = (() => {
    // 1. Get real swipe records for this month
    const swipes = attendanceData.filter(record => {
      const d = new Date(record.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    // 2. Add virtual week-off records for this month
    const enrichedRecords = [...swipes];
    const weekOffDayIndex = weekDayMap[weekOff];

    if (weekOff) {
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const now = new Date();
      let limit = daysInMonth;
      if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth()) {
        limit = now.getDate();
      } else if (new Date(selectedYear, selectedMonth, 1) > now) {
        limit = 0;
      }

      // Helper for Sandwich Rule in rendering
      const isDayAbsentOrOnLeave = (dateObj) => {
        const dStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        const hasSwipe = swipes.some(r => r.date === dStr);
        if (hasSwipe) return false;

        const onLeave = userLeaves.some(l => {
          const start = l.leave_date_start;
          const end = l.leave_date_end;
          return dStr >= start && dStr <= end;
        });
        if (onLeave) return true;

        if (dateObj.getDay() !== weekOffDayIndex) return true;
        return false;
      };

      for (let d = 1; d <= limit; d++) {
        const date = new Date(selectedYear, selectedMonth, d);
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSwiped = enrichedRecords.some(r => r.date === dateStr);

        if (!isSwiped && date.getDay() === weekOffDayIndex) {
          const prevDay = new Date(selectedYear, selectedMonth, d - 1);
          const nextDay = new Date(selectedYear, selectedMonth, d + 1);
          const isSandwich = isDayAbsentOrOnLeave(prevDay) && isDayAbsentOrOnLeave(nextDay);

          enrichedRecords.push({
            date: dateStr,
            day: date.toLocaleDateString('en-US', { weekday: 'long' }),
            inTime: '-',
            outTime: '-',
            workingHoursDisplay: '0h 0m',
            workingHoursVal: 0,
            overtimeDisplay: '0h 0m',
            overtimeVal: 0,
            status: isSandwich ? 'Absent (Sandwich)' : 'Week Off',
            isWeekOff: true,
            isSandwich: isSandwich
          });
        }
      }
    }

    const baseRecords = enrichedRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (activeFilter === 'All' || activeFilter === 'Total Days') return baseRecords;

    return baseRecords.filter(record => {
      const status = record.status.toLowerCase();
      const filter = activeFilter.toLowerCase();

      if (filter === 'present') return status === 'present';
      if (filter === 'absent') return status.includes('absent');
      if (filter === 'week off') return status === 'week off';
      if (filter === 'overtime') return record.overtimeVal > 0;
      if (filter === 'work hours') return status === 'present';
      return true;
    });
  })();

  if (loading) {
    return (
      <div className="h-full flex flex-col gap-6 overflow-hidden bg-slate-50/30 px-4 sm:px-0">

        {/* Header Skeleton */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0 pt-2 lg:pt-0 animate-pulse">
          <div className="space-y-2">
            <div className="h-6 sm:h-8 w-[200px] sm:w-[250px] bg-slate-200 rounded-md"></div>
            <div className="h-3 sm:h-4 w-[150px] sm:w-[200px] bg-slate-200 rounded-md"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-full sm:w-44 bg-slate-200 rounded-2xl shadow-sm border border-slate-100"></div>
            <div className="h-12 w-full sm:w-32 bg-slate-200 rounded-2xl shadow-sm border border-slate-100"></div>
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 shrink-0 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-full bg-white p-2 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-1 sm:gap-2 min-w-0">
              <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-2xl bg-slate-100 shadow-sm border border-white"></div>
              <div className="space-y-2 w-full flex flex-col items-center mt-1">
                <div className="h-2 sm:h-3 w-12 sm:w-16 bg-slate-100 rounded"></div>
                <div className="h-5 sm:h-7 w-16 sm:w-20 bg-slate-100 rounded mt-0.5"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Area Skeleton */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col mb-4 min-h-0 animate-pulse">
          <div className="flex-1 p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-24 sm:h-16 w-full bg-slate-50 rounded-2xl border border-slate-100 border-dashed"></div>
            ))}
          </div>
        </div>

      </div>
    );
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [2023, 2024, 2025, 2026];

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden bg-slate-50/30 px-4 sm:px-0">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0 pt-2 lg:pt-0">
        <div className="flex flex-row items-center justify-between w-full lg:w-auto gap-2 sm:gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight drop-shadow-sm truncate">My Attendance</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 truncate">Track your daily swipes</p>
          </div>

          <div className="flex flex-col items-end sm:items-start sm:border-l sm:pl-6 border-slate-200 shrink-0">
            {(() => {
              const { dateStr: localTodayStr } = getISTDateDetails();
              const todayRecord = attendanceData.find(r => r.date === localTodayStr);
              const hasPunchedInToday = todayRecord && todayRecord.inTime && todayRecord.inTime !== '-';

              return (
                <>
                  <button
                    disabled={!isWithinRange || isPunching}
                    onClick={handleMarkAttendance}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all
                        ${!isWithinRange || isPunching
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : hasPunchedInToday
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 cursor-pointer transform active:scale-95'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 cursor-pointer transform active:scale-95'}`}
                  >
                    {isPunching ? (
                      <Loader2 size={14} className="sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <MapPin size={14} className={`sm:w-4 sm:h-4 ${isWithinRange ? 'animate-bounce' : ''}`} />
                    )}
                    <span className="hidden sm:inline">{isPunching ? 'Processing...' : (hasPunchedInToday ? 'Mark Out' : 'Mark In')}</span>
                    <span className="sm:hidden">{isPunching ? '...' : (hasPunchedInToday ? 'Out' : 'In')}</span>
                  </button>
                  <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 mt-1 sm:mt-1.5 uppercase tracking-wider text-right sm:text-left">{locationStatus}</span>
                </>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group flex-1 sm:flex-none">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="appearance-none bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 block w-full sm:w-44 py-3 pl-11 pr-10 cursor-pointer shadow-sm transition-all hover:border-indigo-300"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative group flex-1 sm:flex-none">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="appearance-none bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 block w-full sm:w-32 py-3 pl-11 pr-10 cursor-pointer shadow-sm transition-all hover:border-indigo-300"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 shrink-0">
        <StatCard
          label="Total Days"
          value={stats.totalDays}
          icon={Calendar}
          color="text-indigo-600"
          bg="bg-indigo-50"
          active={activeFilter === 'All' || activeFilter === 'Total Days'}
          onClick={() => setActiveFilter('All')}
        />
        <StatCard
          label="Present"
          value={stats.presentDays}
          icon={CheckCircle}
          color="text-emerald-600"
          bg="bg-emerald-50"
          active={activeFilter === 'Present'}
          onClick={() => setActiveFilter('Present')}
        />
        <StatCard
          label="Absent"
          value={stats.absentDays}
          icon={XCircle}
          color="text-rose-600"
          bg="bg-rose-50"
          active={activeFilter === 'Absent'}
          onClick={() => setActiveFilter('Absent')}
        />
        <StatCard
          label="Work Hours"
          value={stats.workingHours.toFixed(1)}
          icon={Clock}
          color="text-indigo-600"
          bg="bg-indigo-50"
          subValue="hrs"
          active={activeFilter === 'Work Hours'}
          onClick={() => setActiveFilter('Work Hours')}
        />
        <StatCard
          label="Overtime"
          value={stats.overtimeHours.toFixed(1)}
          icon={Activity}
          color="text-amber-600"
          bg="bg-amber-50"
          subValue="hrs"
          active={activeFilter === 'Overtime'}
          onClick={() => setActiveFilter('Overtime')}
        />
      </div>

      {/* Data Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col mb-4">
        {error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 flex-1">
            <div className="bg-rose-50 p-4 rounded-3xl mb-4 border border-rose-100">
              <AlertCircle className="w-8 h-8 text-rose-600" />
            </div>
            <h3 className="text-slate-900 font-bold text-lg">Connection Issue</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">{error}</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1 custom-scrollbar">
            {/* Desktop Table - Hidden on smaller screens */}
            <table className="hidden lg:table min-w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md border-b border-slate-200">
                <tr>
                  <th className="px-8 py-5 font-bold text-slate-400 uppercase tracking-widest text-[11px]">Date & Day</th>
                  <th className="px-6 py-5 font-bold text-slate-400 uppercase tracking-widest text-[11px]">Check-In</th>
                  <th className="px-6 py-5 font-bold text-slate-400 uppercase tracking-widest text-[11px]">Check-Out</th>
                  <th className="px-6 py-5 font-bold text-slate-400 uppercase tracking-widest text-[11px]">Total Hours</th>
                  <th className="px-6 py-5 font-bold text-slate-400 uppercase tracking-widest text-[11px]">Overtime</th>
                  <th className="px-8 py-5 text-right font-bold text-slate-400 uppercase tracking-widest text-[11px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((record, index) => (
                    <tr key={index} className="group hover:bg-slate-50 transition-all duration-200">
                      <td className="px-8 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">{record.date.split('-').reverse().join('/')}</span>
                          <span className="text-xs text-slate-400 font-medium">{record.day}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-[13px] font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/60 transition-colors group-hover:bg-white group-hover:border-indigo-100 group-hover:text-indigo-600">
                          {record.inTime || '--:--'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-[13px] font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/60 transition-colors group-hover:bg-white group-hover:border-indigo-100 group-hover:text-indigo-600">
                          {record.outTime !== '-' ? record.outTime : '--:--'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {record.workingHoursDisplay}
                      </td>
                      <td className="px-6 py-4">
                        {record.overtimeVal > 0 ? (
                          <span className="text-amber-600 font-bold text-sm bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                            +{record.overtimeDisplay}
                          </span>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {record.isMobile && (
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm">
                              Mobile
                            </span>
                          )}
                          <StatusBadge status={record.status} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6">
                      <EmptyState selectedMonth={selectedMonth} selectedYear={selectedYear} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile Card View - Visible on smaller screens */}
            <div className="lg:hidden p-4 space-y-4">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record, index) => (
                  <div key={index} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-indigo-200 transition-all group animate-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-center bg-slate-50 -m-5 mb-0 px-5 py-3 border-b border-slate-100 rounded-t-2xl">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{record.day}</span>
                        <span className="text-sm font-bold text-slate-900">{record.date.split('-').reverse().join('/')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.isMobile && (
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm">
                            Mobile
                          </span>
                        )}
                        <StatusBadge status={record.status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Punch In</p>
                        <p className="text-sm font-bold text-slate-700 font-mono flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-500" />
                          {record.inTime || '--:--'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Punch Out</p>
                        <p className="text-sm font-bold text-slate-700 font-mono flex items-center gap-1.5">
                          <XCircle size={14} className="text-rose-500" />
                          {record.outTime !== '-' ? record.outTime : '--:--'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                          <Clock size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Work Hours</p>
                          <p className="text-sm font-bold text-slate-900">{record.workingHoursDisplay}</p>
                        </div>
                      </div>
                      {record.overtimeVal > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Overtime</p>
                          <p className="text-sm font-bold text-amber-600">+{record.overtimeDisplay}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState selectedMonth={selectedMonth} selectedYear={selectedYear} mobile />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color, bg, subValue, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full bg-white p-2 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border ${active ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200'} flex flex-col items-center justify-center text-center gap-1 sm:gap-2 hover:shadow-md transition-all duration-300 group min-w-0 overflow-hidden cursor-pointer active:scale-95`}
  >
    <div className={`p-1 sm:p-2.5 rounded-lg sm:rounded-2xl ${bg} ${color} transition-transform group-hover:scale-110 shadow-sm border border-white ${active ? 'scale-110' : ''}`}>
      <Icon size={12} className="sm:w-5 sm:h-5" />
    </div>
    <div className="space-y-0 w-full">
      <p className={`text-[10px] sm:text-[10px] font-bold ${active ? 'text-indigo-600' : 'text-slate-400'} uppercase tracking-tighter sm:tracking-widest truncate leading-tight`}>{label}</p>
      <div className="flex items-baseline justify-center gap-0.5 sm:gap-1">
        <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">{value}</h3>
        {subValue && <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase">{subValue}</span>}
      </div>
    </div>
  </button>
);

const StatusBadge = ({ status }) => {
  const s = status?.toLowerCase() || '';
  let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';

  if (s.includes('present')) colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm shadow-emerald-50';
  else if (s.includes('absent')) colorClass = 'bg-rose-50 text-rose-700 border-rose-100 shadow-sm shadow-rose-50';
  else if (s.includes('week off')) colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm shadow-indigo-50';
  else if (s.includes('leave')) colorClass = 'bg-amber-50 text-amber-700 border-amber-100 shadow-sm shadow-amber-50';

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${colorClass}`}>
      <span className="w-1.5 h-1.5 mr-2 rounded-full bg-current opacity-80"></span>
      {status}
    </span>
  );
};

const EmptyState = ({ selectedMonth, selectedYear, mobile }) => (
  <div className={`${mobile ? 'py-12' : 'py-24'} text-center w-full`}>
    <div className="flex flex-col items-center justify-center">
      <div className="bg-slate-50 rounded-3xl p-6 mb-4 border border-slate-100 shadow-inner">
        <Calendar className="h-10 w-10 text-slate-200" />
      </div>
      <h3 className="text-slate-900 font-bold text-lg">No Attendance Logs</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-[240px] mx-auto font-medium">
        We couldn't find any swipe records for this period.
      </p>
    </div>
  </div>
);

export default MyAttendance;
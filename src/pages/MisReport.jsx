import React, { useState, useEffect } from 'react';
import { getMisReports, getMisLeaveReportData } from '../api/misReportApi';
import { RefreshCw, Download, FileText, BarChart2 } from 'lucide-react';
import dayjs from 'dayjs';

const MisReport = () => {
  const [activeTab, setActiveTab] = useState('performance'); // 'performance' | 'leave'
  
  // Performance Report State
  const [peopleData, setPeopleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Leave Report State
  const [leaveData, setLeaveData] = useState([]);
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState(null);

  useEffect(() => {
    if (activeTab === 'performance') {
      fetchData();
    } else {
      fetchLeaveReport();
    }
  }, [activeTab, startDate, endDate]);

  // --- Performance Report Logic ---
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch data from API
      const data = await getMisReports();

      // Process the data
      const processedData = processSupabaseData(data);
      setPeopleData(processedData);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const processSupabaseData = (data) => {
    if (!data || data.length === 0) return [];

    return data.map((row) => {
      // Generate avatar based on name
      const name = row.name || '';
      const avatar = name && name.trim() !== '' ?
        (name.split(' ').length > 1 ?
          `${name.split(' ')[0][0]}${name.split(' ')[1][0]}`.toUpperCase() :
          name[0].toUpperCase()) :
        '👤';

      return {
        id: row.id,
        name: row.name,
        dateStart: row.date_start ? new Date(row.date_start).toLocaleDateString() : '',
        dateEnd: row.date_end ? new Date(row.date_end).toLocaleDateString() : '',
        target: row.target || '',
        actualWorkDone: row.actual_work_done || '',
        weeklyWorkDone: row.weekly_work_done_percent || '',
        weeklyWorkDoneOnTime: row.weekly_work_done_on_time_percent || '',
        totalWorkDone: row.total_work_done || 0,
        weekPending: row.week_pending || '',
        allPendingTillDate: row.all_pending_till_date || '',
        avatar
      };
    });
  };

  const TotalDoneWork = ({ weeks }) => {
    const getColor = (weeks) => {
      if (weeks === 1) return 'bg-green-100 text-green-800 border-green-200';
      if (weeks === 2) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      if (weeks === 3) return 'bg-orange-100 text-orange-800 border-orange-200';
      return 'bg-red-100 text-red-800 border-red-200';
    };

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getColor(weeks)}`}>
        {weeks}
      </span>
    );
  };

  // --- Leave Report Logic ---
  const fetchLeaveReport = async () => {
    try {
      setLeaveLoading(true);
      setLeaveError(null);

      const { employees, leaves } = await getMisLeaveReportData(startDate, endDate);

      // 4. Process data per employee
      const processedLeaves = employees.map(emp => {
        // Filter leaves for this employee
        const empLeaves = leaves.filter(l => l.emp_id === emp.emp_id);
        
        let casual = 0;
        let earned = 0;
        let unpaid = 0;
        let total = 0;

        empLeaves.forEach(leave => {
          // Calculate overlap days
          const leaveStart = dayjs(leave.leave_date_start);
          const leaveEnd = dayjs(leave.leave_date_end);
          
          // Clip leave dates to Selected Range boundaries
          const effectiveStart = leaveStart.isBefore(startRange) ? startRange : leaveStart;
          const effectiveEnd = leaveEnd.isAfter(endRange) ? endRange : leaveEnd;
          
          if (!effectiveStart.isAfter(effectiveEnd)) {
            const days = effectiveEnd.diff(effectiveStart, 'day') + 1;
            
            total += days;
            
            // Categorize
            if (leave.leave_type?.toLowerCase().includes('casual')) casual += days;
            else if (leave.leave_type?.toLowerCase().includes('earned')) earned += days;
            else if (leave.leave_type?.toLowerCase().includes('unpaid')) unpaid += days;
            // Add other types to total but maybe categorise generically if needed
          }
        });

        // Generate avatar
        const name = emp.full_name || '';
        const avatar = name && name.trim() !== '' ?
          (name.split(' ').length > 1 ?
            `${name.split(' ')[0][0]}${name.split(' ')[1][0]}`.toUpperCase() :
            name[0].toUpperCase()) :
          '👤';

        return {
          id: emp.emp_id, // Use emp_id as unique key
          empNo: emp.emp_id,
          name: emp.full_name,
          avatar,
          from: startRange.format('MMM D, YYYY'),
          to: endRange.format('MMM D, YYYY'),
          total,
          casual,
          earned,
          unpaid,
          // Store raw leaves for CSV generation if needed, though we fetch/filter again for download usually or just use this list
          rawLeaves: empLeaves 
        };
      });

      setLeaveData(processedLeaves);

    } catch (err) {
      setLeaveError(err.message);
      console.error('Error fetching leave report:', err);
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    // 1. Prepare CSV Data
    const displayDate = `${dayjs(startDate).format('MMM_D')}_to_${dayjs(endDate).format('MMM_D_YYYY')}`;
    
    // Headers matching the UI table
    const headers = ['Emp No', 'Name', 'From', 'To', 'Casual', 'Earned', 'Unpaid', 'Total Leaves'];
    const rows = [];
    
    // Process all employees
    if (leaveData && leaveData.length > 0) {
      leaveData.forEach(emp => {
        rows.push([
          emp.empNo,
          emp.name,
          emp.from,
          emp.to,
          emp.casual,
          emp.earned,
          emp.unpaid,
          emp.total
        ]);
      });
    } else {
        // Handle empty data case (headers only)
    }

    // 2. Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')) // Quote cells
    ].join('\n');

    // 3. Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `Leave_Report_${displayDate}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // --- Render Helpers ---
  const renderPagination = () => {
    // Implementing simple "view all" for now as per requirements logic ("Reload table data" implied fetching all for month)
    return null; 
  };
  

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">MIS Report</h1>
          <p className="text-slate-500 mt-1 text-sm">Overview of work performance and leave statistics.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
           <button
             onClick={() => setActiveTab('performance')}
             className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
               activeTab === 'performance' 
                 ? 'bg-white text-indigo-600 shadow-sm' 
                 : 'text-slate-500 hover:text-slate-700'
             }`}
           >
             <BarChart2 size={16} />
             Performance Report
           </button>
           <button
             onClick={() => setActiveTab('leave')}
             className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
               activeTab === 'leave' 
                 ? 'bg-white text-indigo-600 shadow-sm' 
                 : 'text-slate-500 hover:text-slate-700'
             }`}
           >
             <FileText size={16} />
             Leave Report
           </button>
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'performance' ? (
        // === Performance Report Tab ===
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-end">
                <button
                    onClick={fetchData}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm flex items-center text-sm font-medium"
                >
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    Refresh
                </button>
            </div>
            
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : error ? (
                <div className="flex-1 flex items-center justify-center text-red-500">
                    Error: {error}
                </div>
            ) : (
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">DATE START</th>
                            <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">DATE END</th>
                            <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">NAME</th>
                            <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">TARGET</th>
                            <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">ACTUAL WORK</th>
                            <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">WEEKLY DONE %</th>
                            <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">ON TIME %</th>
                            <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">TOTAL WORK</th>
                            <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">WEEK PENDING</th>
                            <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">ALL PENDING</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                        {peopleData.length > 0 ? (
                            peopleData.map((person) => (
                            <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-slate-500">{person.dateStart}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-500">{person.dateEnd}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-9 w-9">
                                    <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold border border-indigo-200">
                                        {person.avatar}
                                    </div>
                                    </div>
                                    <div className="ml-3">
                                    <div className="text-sm font-medium text-slate-900">{person.name}</div>
                                    </div>
                                </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-500">{person.target}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                {person.actualWorkDone}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                {person.weeklyWorkDone}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                {person.weeklyWorkDoneOnTime}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                <TotalDoneWork weeks={person.totalWorkDone} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                {person.weekPending}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                {person.allPendingTillDate}
                                </td>
                            </tr>
                            ))
                        ) : (
                            <tr>
                            <td colSpan="10" className="px-6 py-12 text-center text-slate-400">
                                No data available
                            </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      ) : (
        // === Leave Report Tab ===
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            {/* Filters */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-700">From:</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="block w-auto px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                            focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-700">To:</label>
                         <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="block w-auto px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                            focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownloadCSV}
                        disabled={leaveLoading || leaveData.length === 0}
                        className={`px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm flex items-center text-sm font-medium ${
                            (leaveLoading || leaveData.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                        <Download className="w-3.5 h-3.5 mr-2" />
                        Download Report
                    </button>
                    <button
                        onClick={fetchLeaveReport}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm flex items-center text-sm font-medium"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-2" />
                        Refresh Data
                    </button>
                </div>
            </div>

            {leaveLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : leaveError ? (
                <div className="flex-1 flex items-center justify-center text-red-500">
                    Error: {leaveError}
                </div>
            ) : (
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">EMP NO</th>
                                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">NAME</th>
                                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">FROM</th>
                                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">TO</th>
                                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap text-center">CASUAL</th>
                                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap text-center">EARNED</th>
                                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap text-center">UNPAID</th>
                                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap text-center">TOTAL LEAVES</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {leaveData.length > 0 ? (
                                leaveData.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500">{emp.empNo}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-9 w-9">
                                                    <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold border border-indigo-200">
                                                        {emp.avatar}
                                                    </div>
                                                </div>
                                                <div className="ml-3">
                                                    <div className="text-sm font-medium text-slate-900">{emp.name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500">{emp.from}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500">{emp.to}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-center font-medium bg-slate-50/50">{emp.casual}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-center font-medium">{emp.earned}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-center font-medium bg-slate-50/50">{emp.unpaid}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                emp.total > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {emp.total}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                                        No employees found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default MisReport;
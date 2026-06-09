import React, { useEffect, useState } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, Filter, ChevronDown, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../supabaseClient';

const Attendance = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState({}); // Track individual download states
  const [syncing, setSyncing] = useState(false); // Track sync state

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchAttendanceData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      // Fetch users for name mapping
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('emp_id, full_name, designation');

      if (userError) throw userError;

      setAllUsers(users);

      const userMap = {};
      users.forEach(user => {
        userMap[user.emp_id] = user;
      });

      const response = await fetch("https://sohcm.com/SmartApp_ess/api/SwipeDetails/GetDeviceLogs?APIKey=341813122509&AccountName=SKAISPAT&FromDate=2025-12-01&ToDate=2026-12-01");

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();

      // Process the raw logs to aggregate by user and month
      const userMonthStats = {};

      data.forEach(log => {
        const dateObj = new Date(log.LogDate);
        const year = dateObj.getFullYear();
        const month = dateObj.toLocaleString('default', { month: 'short' });
        const monthIndex = dateObj.getMonth();
        const dateStr = log.LogDate.split('T')[0];
        const userId = log.UserId;
        const key = `${userId}-${year}-${month}`;

        if (!userMonthStats[key]) {
          userMonthStats[key] = {
            year: year,
            month: month,
            monthIndex: monthIndex,
            empId: userId,
            dates: new Set(),
            logDates: []
          };
        }
        userMonthStats[key].dates.add(dateStr);
        userMonthStats[key].logDates.push(new Date(log.LogDate));
      });

      const processedData = Object.values(userMonthStats).map(stat => {
        const totalDaysInMonth = new Date(stat.year, stat.monthIndex + 1, 0).getDate();
        const punchDays = stat.dates.size;

        const userInfo = userMap[stat.empId] || {};

        return {
          year: stat.year,
          month: stat.month,
          empId: userInfo.emp_id || stat.empId,
          name: userInfo.full_name || `User ${stat.empId}`,
          designation: userInfo.designation || '-',
          company: 'SKAISPAT',
          punchDays: punchDays,
          totalOnTime: punchDays, // Simplification
          lateDays: 0,
          lateNotAllowed: 0,
          lateAllowed: 0,
          punchMiss: 0,
          holidays: 0,
          absents: totalDaysInMonth - punchDays,
          totalWorking: punchDays,
          mgmtAdjustment: 0,
          grandTotalDays: punchDays,
        };
      });

      // Sort by Year then Month then EmpId
      processedData.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        // Month sort is tricky with names, skipping or using simplified sort
        return a.empId.localeCompare(b.empId);
      });

      console.log('Processed attendance data:', processedData);
      setAttendanceData(processedData);

      // Auto-sync after fetching
      syncToSupabase(processedData);
    } catch (error) {
      console.error('Error fetching REPORT data from API:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  const syncToSupabase = async (dataToSync = attendanceData) => {
    if (!dataToSync || dataToSync.length === 0) return;

    // Silent background sync
    setSyncing(true);
    try {
      // Format data for Supabase
      const recordsToUpsert = dataToSync.map(item => ({
        year: item.year,
        month: item.month,
        emp_id: item.empId,
        name: item.name,
        designation: item.designation,
        company_name: item.company || 'SKAISPAT',
        punch_days: item.punchDays,
        total_on_time: item.totalOnTime,
        late_days: item.lateDays,
        late_not_allowed: item.lateNotAllowed,
        late_allowed: item.lateAllowed,
        absent: item.absents,
        punch_miss: item.punchMiss,
        sunday_national_holiday: item.holidays,
        total_days: item.totalWorking + item.absents,
        mgmt_adjustment: item.mgmtAdjustment,
        grand_total_days: item.grandTotalDays
      }));

      // Upsert data in batches
      const batchSize = 100;
      for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
        const batch = recordsToUpsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from('attendance_summary')
          .upsert(batch, { onConflict: 'emp_id, year, month' });

        if (error) throw error;
      }

      console.log("Auto-sync completed successfully");
      // Optional: toast.success("Attendance synced successfully"); 
    } catch (error) {
      console.error("Error auto-syncing data:", error);
      toast.error(`Auto-sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Schedule daily sync at 12:00 PM if app is open
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      if (now.getHours() === 12 && now.getMinutes() === 0 && now.getSeconds() === 0) {
        fetchAttendanceData();
      }
    };

    const timer = setInterval(checkTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  const [selectedMonth, setSelectedMonth] = useState('');
  const [exportMonth, setExportMonth] = useState(''); // Format: YYYY-MM

  // Filter data based on search term (name, empId, month, designation, year) AND selectedMonth
  const filteredData = attendanceData.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.empId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.month.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.year.toString().includes(searchTerm);

    const matchesMonth = selectedMonth ? item.month === selectedMonth : true;

    return matchesSearch && matchesMonth;
  });

  // Download data as PDF
  const downloadPDF = () => {
    const targetEmpIds = [
      '3', '219', '53', '1', '321', '200', '10', '11', '175', '16',
      '245', '233', '217', '152', '294', '261', '339', '283', '281', '363',
      '176', '238', '112', '170', '122', '104', '86', '235', '341', '246',
      '227', '242', '356', '172', '501', '504', '180', '199', '522', '519',
      '145', '78', '117', '191', '134', '275', '253'
    ];

    let dataToExport = filteredData;

    if (exportMonth) {
      const [year, monthIndex] = exportMonth.split('-');
      const date = new Date(parseInt(year), parseInt(monthIndex) - 1);
      const monthShort = date.toLocaleString('default', { month: 'short' });

      // If exportMonth is selected, we perform a fresh filter on the full dataset
      dataToExport = attendanceData.filter(item =>
        item.year === parseInt(year) && item.month === monthShort
      );
    }

    // Apply Target API Filter
    dataToExport = dataToExport.filter(item =>
      targetEmpIds.includes(String(item.empId))
    );

    if (dataToExport.length === 0 && !exportMonth) {
      toast.error("No data available to export for the selected criteria");
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFontSize(16);
    doc.text('Monthly Attendance Overview', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 20);

    if (exportMonth) {
      doc.text(`Month: ${exportMonth}`, 14, 25);
    }

    doc.text(`Total Records: ${dataToExport.length}`, 14, exportMonth ? 30 : 25);

    const tableHeaders = [
      'Year', 'Month', 'Emp ID', 'Name',
      'Punch Days', 'Absent', 'Total',
      'Late', 'Lat(NA)', 'Lat(A)',
      'Punch Miss', 'Holidays'
    ];

    const tableData = dataToExport.map(item => [
      item.year,
      item.month,
      item.empId,
      item.name,
      item.punchDays,
      item.absents,
      item.totalWorking,
      item.lateDays,
      item.lateNotAllowed,
      item.lateAllowed,
      item.punchMiss,
      item.holidays
    ]);

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: exportMonth ? 35 : 30,
      styles: { fontSize: 9, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' },
      columnStyles: {
        3: { halign: 'left', cellWidth: 35 }, // Name left aligned
      }
    });

    // --- Absent / No Record Employees Table ---
    if (allUsers.length > 0) {
      // Get IDs present in the current export
      const presentEmpIds = new Set(dataToExport.map(item => String(item.empId)));

      // Filter users who are in the target list BUT NOT in the export data
      const absentEmployees = allUsers.filter(user =>
        targetEmpIds.includes(String(user.emp_id)) &&
        !presentEmpIds.has(String(user.emp_id))
      );

      if (absentEmployees.length > 0) {
        let currentY = doc.lastAutoTable.finalY + 20;

        // Check if we need a new page
        if (currentY > 180) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(220, 38, 38); // Red
        doc.text('Employees with No Records (Absent/Inactive)', 14, currentY);

        doc.setFontSize(10);
        doc.setTextColor(100);
        currentY += 6;
        doc.text(`Count: ${absentEmployees.length}`, 14, currentY);

        const absentTableData = absentEmployees.map(user => [
          user.emp_id,
          user.full_name,
          user.designation || '-',
          'No Record Found'
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [['Emp ID', 'Name', 'Designation', 'Status']],
          body: absentTableData,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 2,
            overflow: 'linebreak'
          },
          headStyles: {
            fillColor: [220, 38, 38], // Red Header
            textColor: 255,
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [254, 242, 242]
          }
        });
      }
    }

    doc.save(`monthly_attendance_overview_${exportMonth || 'current'}.pdf`);
  };

  const downloadDailyData = async (empId, name, month) => {
    // Check if we have valid parameters
    if (!empId || !month) {
      console.error('Missing parameters - empId:', empId, 'month:', month);
      alert('Cannot download: Missing employee ID or month information');
      return;
    }

    setDownloading(prev => ({ ...prev, [`${name}-${month}`]: true }));

    try {
      // Fetch raw logs from API (same as main fetch)
      const response = await fetch("https://sohcm.com/SmartApp_ess/api/SwipeDetails/GetDeviceLogs?APIKey=341813122509&AccountName=SKAISPAT&FromDate=2025-12-01&ToDate=2026-12-01");

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const resData = await response.json();

      // Filter and Process data for the specific user and month
      const groupedData = {};

      resData.forEach(log => {
        if (String(log.UserId) !== String(empId)) return;

        const dateObj = new Date(log.LogDate);
        const logMonth = dateObj.toLocaleString('default', { month: 'short' }); // "Dec"

        // Check if month matches. Note: 'month' param might be "Dec" or "December". 
        // My main fetch uses "short", so assuming "short" here.
        if (logMonth !== month) return;

        const dateStr = log.LogDate.split('T')[0];
        const key = `${dateStr}`;

        if (!groupedData[key]) {
          groupedData[key] = {
            date: dateStr,
            logs: []
          };
        }
        groupedData[key].logs.push(log.LogDate);
      });

      const processedRows = Object.values(groupedData).map(item => {
        item.logs.sort();
        const firstLog = item.logs[0];
        const lastLog = item.logs[item.logs.length - 1];

        const inTime = firstLog.split('T')[1];
        const outTime = item.logs.length > 1 ? lastLog.split('T')[1] : null;

        let workingHours = '';
        let overtimeHours = '0h 0m';

        if (outTime) {
          const start = new Date(firstLog);
          const end = new Date(lastLog);
          const diffMs = end - start;

          const hours = Math.floor(diffMs / 3600000);
          const minutes = Math.floor((diffMs % 3600000) / 60000);
          workingHours = `${hours}h ${minutes}m`;

          // Overtime Logic
          const nineHoursMs = 9 * 60 * 60 * 1000;
          if (diffMs > nineHoursMs) {
            const extraMs = diffMs - nineHoursMs;
            const otHours = Math.floor(extraMs / 3600000);
            const otMinutes = Math.floor((extraMs % 3600000) / 60000);
            overtimeHours = `${otHours}h ${otMinutes}m`;
          }
        }

        return {
          date: item.date,
          day: new Date(item.date).toLocaleString('default', { weekday: 'long' }),
          inTime: inTime,
          outTime: outTime || '',
          workingHours: workingHours,
          overtimeHours: overtimeHours,
          status: 'P',
          emp_id_code: empId,
          name: name,
          month: month
        };
      });

      if (processedRows.length === 0) {
        throw new Error(`No daily data found for Employee ID: ${empId} and Month: ${month}`);
      }

      processedRows.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Create PDF document
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Add title
      doc.setFontSize(16);
      doc.text(`Daily Attendance - ${name} (${empId}) - ${month}`, 14, 15);

      // Prepare headers and data for the table
      // We'll create a simple table structure based on what we have
      const tableHeaders = ['Date', 'Day', 'In Time', 'Out Time', 'Working Hrs', 'Overtime', 'Status'];
      const tableData = processedRows.map(row => [
        row.date.split('-').reverse().join('/'),
        row.day,
        row.inTime,
        row.outTime,
        row.workingHours,
        row.overtimeHours,
        row.status
      ]);

      // Add table to PDF
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: 20,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185] }
      });

      // Save the PDF
      doc.save(`${empId}_${name}_${month}_daily_attendance.pdf`);

    } catch (error) {
      console.error('Error downloading daily data:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setDownloading(prev => ({ ...prev, [`${name}-${month}`]: false }));
    }
  };

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Reset to first page when search/filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth]);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">Attendance Overview</h1>
          <p className="text-slate-500 mt-1 text-sm">Monthly aggregate records and performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="month"
              onClick={(e) => e.target.showPicker?.()}
              placeholder="Month / Year"
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all hover:bg-slate-50 cursor-pointer w-40 no-calendar-icon"
            />
          </div>
          <button
            onClick={downloadPDF}
            disabled={!exportMonth}
            className="group inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 active:scale-95"
          >
            <Download size={16} className="mr-2 group-hover:-translate-y-0.5 transition-transform" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Search & Filter Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 shrink-0">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 sm:text-sm transition-all"
              placeholder="Search by employee name, ID, month, or year..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Month Select */}
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 text-sm appearance-none cursor-pointer transition-all"
            >
              <option value="">All Months</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* content area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="min-w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                {[
                  "Year", "Emp ID", "Name", "Designation", "Month",
                  "Punch Days", "Absent", "Total Days", "Late Days",
                  "Late Not Allowed", "Late Allowed", "Punch Miss",
                  "Holidays", "Actions"
                ].map((header) => (
                  <th key={header} className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs first:pl-8 last:pr-8">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tableLoading ? (
                <tr>
                  <td colSpan="14" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-500 font-medium">Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="14" className="px-6 py-12 text-center">
                    <div className="inline-flex items-center px-4 py-2 rounded-lg bg-red-50 text-red-600 mb-4">
                      <span className="font-medium">Error loading data: {error}</span>
                    </div>
                    <br />
                    <button
                      onClick={fetchAttendanceData}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Try Again
                    </button>
                  </td>
                </tr>
              ) : currentItems.length > 0 ? (
                currentItems.map((item, index) => (
                  <tr key={index} className="group hover:bg-slate-50 transition-colors duration-150">
                    <td className="px-6 py-4 pl-8 text-slate-500">{item.year}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {item.empId}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{item.designation}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {item.month}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-emerald-600">{item.punchDays}</td>
                    <td className="px-6 py-4 font-medium text-red-600">{item.absents}</td>
                    <td className="px-6 py-4 text-slate-600">{item.totalWorking}</td>
                    <td className="px-6 py-4 text-orange-600">{item.lateDays}</td>
                    <td className="px-6 py-4 text-slate-500">{item.lateNotAllowed}</td>
                    <td className="px-6 py-4 text-slate-500">{item.lateAllowed}</td>
                    <td className="px-6 py-4 text-slate-500">{item.punchMiss}</td>
                    <td className="px-6 py-4 text-slate-500">{item.holidays}</td>
                    <td className="px-6 py-4 pr-8">
                      <button
                        onClick={() => downloadDailyData(item.empId, item.name, item.month)}
                        disabled={downloading[`${item.name}-${item.month}`]}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:hover:bg-transparent"
                        title="Download Detail Report"
                      >
                        {downloading[`${item.name}-${item.month}`] ? (
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Download size={18} strokeWidth={2} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="14" className="px-6 py-24 text-center">
                    <p className="text-slate-400 text-lg">No attendance records found matching your search.</p>
                    <button
                      onClick={() => setSearchTerm('')}
                      className="mt-4 text-indigo-600 font-medium hover:underline"
                    >
                      Clear search
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredData.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-900">{indexOfFirstItem + 1}</span> to <span className="font-medium text-slate-900">{Math.min(indexOfLastItem, filteredData.length)}</span> of <span className="font-medium text-slate-900">{filteredData.length}</span> results
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                        ? 'bg-indigo-600 text-white border border-indigo-600'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;
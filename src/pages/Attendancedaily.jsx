import React, { useEffect, useState, useRef } from "react";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../supabaseClient";

const Attendancedaily = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportDate, setExportDate] = useState("");
  const [attendanceData, setAttendanceData] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // console.log(allUsers, "user ");
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchAttendanceData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    let resultData = [];

    try {
      // Fetch users for name mapping
      const { data: users, error: userError } = await supabase
        .from("users")
        .select("emp_id, full_name, designation ,users(full_name)");

      ////////console.log(users,"userdata")

      console.log(users);

      if (userError) throw userError;

      setAllUsers(users);

      const userMap = {};
      users.forEach((user) => {
        userMap[user.emp_id] = user;
      });

      const year = new Date().getFullYear();
      const response = await fetch(
        `https://sohcm.com/SmartApp_ess/api/SwipeDetails/GetDeviceLogs?APIKey=341813122509&AccountName=SKAISPAT&FromDate=${year}-01-01&ToDate=${year}-12-31`,
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();

      // Process raw logs into daily attendance
      const groupedData = {};

      data.forEach((log) => {
        const dateStr = log.LogDate.split("T")[0];
        const userId = log.UserId;
        const key = `${userId}-${dateStr}`;

        if (!groupedData[key]) {
          groupedData[key] = {
            userId: userId,
            date: dateStr,
            logs: [],
          };
        }
        groupedData[key].logs.push(log.LogDate);
      });

      const processedData = Object.values(groupedData).map((item) => {
        item.logs.sort(); // Ensure chronological order
        const firstLog = item.logs[0];
        const lastLog = item.logs[item.logs.length - 1];

        const inTime = firstLog.split("T")[1];
        const outTime = item.logs.length > 1 ? lastLog.split("T")[1] : null;

        let workingHours = "";
        let hours = 0;
        let minutes = 0;

        let overtimeHours = "0h 0m";

        if (outTime) {
          const start = new Date(firstLog);
          const end = new Date(lastLog);
          const diffMs = end - start;
          hours = Math.floor(diffMs / 3600000);
          minutes = Math.floor((diffMs % 3600000) / 60000);
          workingHours = `${hours}h ${minutes}m`;

          // Overtime Calculation (Threshold: 9 hours)
          const nineHoursMs = 9 * 60 * 60 * 1000;
          if (diffMs > nineHoursMs) {
            const extraMs = diffMs - nineHoursMs;
            const otHours = Math.floor(extraMs / 3600000);
            const otMinutes = Math.floor((extraMs % 3600000) / 60000);
            overtimeHours = `${otHours}h ${otMinutes}m`;
          }
        }

        const dateObj = new Date(item.date);
        const userInfo = userMap[item.userId] || {};

        return {
          year: dateObj.getFullYear(),
          monthName: dateObj.toLocaleString("default", { month: "long" }),
          date: item.date,
          day: dateObj.toLocaleString("default", { weekday: "long" }),
          companyName: "SKAISPAT",
          empIdCode: userInfo.emp_id || item.userId,
          name: userInfo.full_name || `User ${item.userId}`,
          designation: userInfo.designation || "-", // Not available in API, taking from DB
          holiday: "No",
          workingDay: "Yes",
          nHoliday: "",
          status: "P",
          inTime: inTime,
          outTime: outTime || "",
          workingHours: workingHours,
          lateMinutes: 0,
          earlyOut: 0,
          overtimeHours: overtimeHours,
          punchMiss: outTime ? "No" : "Yes",
          remarks: item.logs.length === 1 ? "Single Punch" : "",
        };
      });

      // Sort API data temporarily
      processedData.sort((a, b) => new Date(b.date) - new Date(a.date));

      // --- NEW: Fetch and Merge Database Data ---
      const { data: dbData, error: dbError } = await supabase
        .from("attendance_daily")
        .select("*");

      if (dbError) {
        console.error("Error fetching DB data:", dbError);
      }

      const mappedDbData = (dbData || []).map((record) => ({
        year: record.year,
        monthName: record.month_name,
        date: record.date,
        day: record.day,
        companyName: record.company_name,
        empIdCode: record.emp_id,
        name: record.name,
        designation: record.designation,
        holiday: record.holiday,
        workingDay: record.working_day,
        nHoliday: record.n_holiday,
        status: record.status,
        inTime: record.in_time,
        outTime: record.out_time,
        workingHours: record.working_hours,
        lateMinutes: 0,
        earlyOut: record.early_out,
        overtimeHours: record.overtime_hours,
        punchMiss: record.punch_miss,
        remarks: record.remarks,
      }));

      // Merge: API data overwrites DB data for the same keys
      const dataMap = new Map();

      // 1. Add DB data
      mappedDbData.forEach((item) => {
        const key = `${item.empIdCode}-${item.date}`;
        dataMap.set(key, item);
      });

      // 2. Add/Overlay processed API data
      processedData.forEach((item) => {
        const key = `${item.empIdCode}-${item.date}`;
        dataMap.set(key, item);
      });

      const finalData = Array.from(dataMap.values());

      // Sort by Date DESC
      finalData.sort((a, b) => new Date(b.date) - new Date(a.date));

      console.log("Processed total attendance data (API + DB):", finalData);
      setAttendanceData(finalData);
      resultData = finalData;

      // Auto-sync after fetching
      syncToSupabase(processedData);
    } catch (error) {
      console.error("Error fetching Report Daily data from API:", error);
      setError(error.message);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
    return resultData;
  };

  const syncToSupabase = async (dataToSync = attendanceData) => {
    if (!dataToSync || dataToSync.length === 0) return;

    // Silent background sync
    setSyncing(true);
    try {
      // Helper to parse "Xh Ym" to minutes
      const parseDuration = (str) => {
        if (!str) return 0;
        const match = str.match(/(\d+)h (\d+)m/);
        if (match) {
          return parseInt(match[1]) * 60 + parseInt(match[2]);
        }
        return 0;
      };

      // Format data for Supabase
      const recordsToUpsert = dataToSync.map((item) => ({
        emp_id: item.empIdCode,
        date: item.date,
        year: item.year,
        month_name: item.monthName,
        day: item.day,
        company_name: item.companyName,
        name: item.name,
        designation: item.designation,
        holiday: item.holiday,
        working_day: item.workingDay,
        n_holiday: item.nHoliday || "",
        status: item.status,
        in_time: item.inTime,
        out_time: item.outTime,
        working_hours: item.workingHours,
        present_minutes: parseDuration(item.workingHours),
        early_out: item.earlyOut || "0",
        overtime_hours: item.overtimeHours,
        punch_miss: item.punchMiss,
        remarks: item.remarks,
      }));

      // Upsert data in batches
      const batchSize = 50;
      for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
        const batch = recordsToUpsert.slice(i, i + batchSize);
        // Using upsert with conflict on emp_id and date
        const { error } = await supabase
          .from("attendance_daily")
          .upsert(batch, { onConflict: "emp_id, date" });

        if (error) throw error;
      }

      ////////console.log("Auto-sync daily logs completed successfully");
      // Optional: toast.success("Daily attendance synced automatically");
    } catch (error) {
      console.error("Error auto-syncing daily data:", error);
      toast.error(`Auto-sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const uploadDailyReport = async (data, isManual = false) => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const todaysData = data.filter((item) => item.date === todayStr);

      if (todaysData.length === 0) {
        ////////console.log("No data for today to generate report.");
        if (isManual)
          toast.error(`No attendance data found for today (${todayStr})`);
        return;
      }

      const doc = generatePDFDoc(todaysData, todayStr);
      const pdfBlob = doc.output("blob");
      const now = new Date();

      // Format current time for DB and Filename
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const timeStr = `${hours}:${minutes} ${ampm}`;

      // Format Date for filename (DD-MM-YYYY)
      const [y, m, d] = todayStr.split("-");
      const dateForFilename = `${d}-${m}-${y}`;

      // Filename: AttendanceData_DD-MM-YYYY_Time_HH-MM-SS_AM/PM.pdf
      const fileName = `AttendanceData_${dateForFilename}_Time_${hours}-${minutes}-${seconds}_${ampm}.pdf`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("attendance_docs")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("attendance_docs").getPublicUrl(fileName);

      const { error: funcError } = await supabase.functions.invoke(
        "save-daily-report",
        {
          body: {
            date: todayStr,
            pdf_link: publicUrl,
            time: timeStr,
          },
        },
      );

      if (funcError) throw funcError;

      toast.success("Daily attendance report auto-saved!");
    } catch (error) {
      console.error("Error uploading daily report:", error);
      toast.error("Failed to auto-save daily report");
    }
  };

  // Schedule daily sync and report upload
  const lastRunRef = useRef(null);
  const lastSyncRef = useRef(null); // New ref for 6 AM sync

  // 🕕 6 AM Daily Sync - External API to Database
  useEffect(() => {
    const checkSyncTime = async () => {
      const now = new Date();
      // Check for 6:00 AM
      if (now.getHours() === 6 && now.getMinutes() === 0) {
        const todayStr = now.toDateString();
        const lastSynced = localStorage.getItem("last_6am_sync_date");

        // Only run once per day
        if (lastSyncRef.current !== todayStr && lastSynced !== todayStr) {
          console.log(
            "🕕 Triggering scheduled 6:00 AM attendance data sync...",
          );
          lastSyncRef.current = todayStr; // Block immediate re-entry

          try {
            const freshData = await fetchAttendanceData();

            if (freshData && freshData.length > 0) {
              console.log(
                `✅ 6 AM Sync completed: ${freshData.length} records synced to database`,
              );
              // Persist success to prevent re-run on reload
              localStorage.setItem("last_6am_sync_date", todayStr);
              toast.success("6 AM: Attendance data synced successfully!");
            }
          } catch (error) {
            console.error("❌ 6 AM Sync failed:", error);
            toast.error("6 AM sync failed: " + error.message);
          }
        }
      }
    };

    checkSyncTime(); // Check immediately on mount
    const syncTimer = setInterval(checkSyncTime, 10000); // Check every 10s
    return () => clearInterval(syncTimer);
  }, []);

  // 🕚 11:50 AM Daily Report Upload
  useEffect(() => {
    const checkTime = async () => {
      const now = new Date();
      // Check for 11:50 AM
      if (now.getHours() === 11 && now.getMinutes() === 50) {
        const todayStr = now.toDateString();
        const lastSaved = localStorage.getItem("last_daily_report_date");

        // Check if explicitly run this session OR saved in local storage
        if (lastRunRef.current !== todayStr && lastSaved !== todayStr) {
          ////////console.log("Triggering scheduled 11:50 AM attendance report...");
          lastRunRef.current = todayStr; // Block immediate re-entry

          const freshData = await fetchAttendanceData();

          if (freshData && freshData.length > 0) {
            await uploadDailyReport(freshData, false);
            // Persist success to prevent re-run on reload
            localStorage.setItem("last_daily_report_date", todayStr);
          }
        }
      }
    };

    checkTime(); // Check immediately on mount
    const timer = setInterval(checkTime, 10000); // Check every 10s
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  // Filter data based on search term and date range
  const filteredData = attendanceData.filter((item) => {
    // Text search filter - now includes additional columns
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.empIdCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.year.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.monthName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.day.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.companyName.toLowerCase().includes(searchTerm.toLowerCase());

    // Date range filter
    let matchesDateRange = true;
    if (startDate || endDate) {
      const itemDate = new Date(item.date);

      if (startDate) {
        const start = new Date(startDate);
        if (itemDate < start) matchesDateRange = false;
      }

      if (endDate && matchesDateRange) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        if (itemDate > end) matchesDateRange = false;
      }
    }

    return matchesSearch && matchesDateRange;
  });

  const generatePDFDoc = (originalDataToExport, dateExp) => {
    // Target Employee IDs filtered specifically for this report
    const targetEmpIds = [
      "3",
      "219",
      "1",
      "321",
      "200",
      "10",
      "11",
      "175",
      "16",
      "245",
      "233",
      "217",
      "152",
      "294",
      "261",
      "281",
      "363",
      "238",
      "112",
      "170",
      "122",
      "104",
      "86",
      "235",
      "341",
      "227",
      "242",
      "356",
      "501",
      "504",
      "180",
      "199",
      "522",
      "519",
      "78",
      "117",
      "191",
      "275",
      "253",
    ];

    // Filter data to only include target employees
    const dataToExport = originalDataToExport.filter((item) =>
      targetEmpIds.includes(String(item.empIdCode)),
    );

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    // Helper to format date (YYYY-MM-DD -> DD/MM/YYYY)
    const formatDate = (dateStr) => {
      if (!dateStr) return "";
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
      }
      return dateStr;
    };

    // Title
    doc.setFontSize(16);
    doc.text("Daily Attendance Logs", 14, 15);

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100);

    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();

    // Format time (HH:MM AM/PM)
    let hours = today.getHours();
    const minutes = String(today.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const timeStr = `${hours}:${minutes} ${ampm}`;

    const generatedDateStr = `${day}/${month}/${year} at ${timeStr}`;

    doc.text(`Generated on: ${generatedDateStr}`, 14, 20);

    if (dateExp) {
      doc.text(`Date: ${formatDate(dateExp)}`, 14, 25);
    } else if (startDate || endDate) {
      doc.text(
        `Range: ${formatDate(startDate) || "Start"} to ${formatDate(endDate) || "End"}`,
        14,
        25,
      );
    }

    doc.text(`Total Entries: ${dataToExport.length}`, 14, 30);

    // Prepare table data
    const tableHeaders = [
      "Date",
      "Emp ID",
      "Name",
      "Day",
      "In",
      "Out",
      "Hrs",
      "OT",
      "Status",
      "Holiday",
      "Remarks",
    ];

    const tableData = dataToExport.map((item) => [
      formatDate(item.date),
      item.empIdCode,
      item.name,
      item.day,
      item.inTime || "-",
      item.outTime || "-",
      item.workingHours || "-",
      item.overtimeHours || "-",
      item.status,
      item.holiday === "Yes" ? "Yes" : "No",
      item.remarks || "",
    ]);

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: 35,
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [79, 70, 229], // Indigo-600 to match UI
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251], // Gray-50
      },
      columnStyles: {
        2: { cellWidth: 30 }, // Name
        10: { cellWidth: 40 }, // Remarks
      },
    });

    // --- Absent Employees Table ---
    if (allUsers.length > 0) {
      // Get IDs of employees present in the current export data
      const presentEmpIds = new Set(
        dataToExport.map((item) => String(item.empIdCode)),
      );

      // Filter all users to find those not present AND in target list
      const absentEmployees = allUsers.filter(
        (user) =>
          !presentEmpIds.has(String(user.emp_id)) &&
          targetEmpIds.includes(String(user.emp_id)),
      );

      if (absentEmployees.length > 0) {
        // Space between tables
        let currentY = doc.lastAutoTable.finalY + 20;

        doc.setFontSize(14);
        doc.setTextColor(220, 38, 38); // Red color for title
        doc.text("Absent Employees", 14, currentY);

        // Metadata for Absent Section
        doc.setFontSize(10);
        doc.setTextColor(100);

        currentY += 6;
        doc.text(`Generated on: ${generatedDateStr}`, 14, currentY);

        currentY += 5;
        doc.text(`Date: ${formatDate(dateExp)}`, 14, currentY);

        currentY += 5;
        doc.text(`Total Entries: ${absentEmployees.length}`, 14, currentY);

        const absentTableData = absentEmployees.map((user) => [
          formatDate(dateExp),
          user.emp_id,
          user.full_name,
          user.designation || "-",
          "Absent",
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [["Date", "Emp ID", "Name", "Designation", "Status"]],
          body: absentTableData,
          theme: "grid",
          styles: {
            fontSize: 9,
            cellPadding: 2,
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [220, 38, 38], // Red Header
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [254, 242, 242], // Light red background for rows
          },
        });
      }
    }

    return doc;
  };

  // Download PDF function
  const downloadPDF = () => {
    if (!exportDate) {
      toast.error("Please select a date to export");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    let finalDate = exportDate;

    // Removed the auto-shift to yesterday so it exports the exact selected date

    const dataToExport = attendanceData.filter(
      (item) => item.date === finalDate,
    );

    if (dataToExport.length === 0) {
      toast.error(`No attendance data found for ${finalDate}`);
      return;
    }

    const doc = generatePDFDoc(dataToExport, finalDate);
    doc.save(`attendance_report_${finalDate}.pdf`);
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
  }, [searchTerm, startDate, endDate]);

  return (
    <div className="flex flex-col h-full gap-6 overflow-hidden">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">
            Daily Attendance Logs
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Detailed daily punch records and status for all employees
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="date"
              onClick={(e) => e.target.showPicker?.()}
              placeholder="DD/MM/YYYY"
              value={exportDate}
              onChange={(e) => setExportDate(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all w-48 cursor-pointer hover:bg-slate-50 no-calendar-icon"
            />
          </div>
          <button
            onClick={downloadPDF}
            disabled={!exportDate || loading}
            className="group inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 active:scale-95"
          >
            <Download
              size={16}
              className="mr-2 group-hover:-translate-y-0.5 transition-transform"
            />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="p-4 bg-white border shadow-sm rounded-xl border-slate-200 shrink-0">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Search */}
          <div className="relative md:col-span-5">
            <label className="block mb-2 text-xs font-semibold tracking-wider uppercase text-slate-500">
              Search
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all sm:text-sm"
                placeholder="Search employee, ID, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Date Ranges */}
          <div className="grid grid-cols-2 gap-4 md:col-span-7">
            <div>
              <label className="block mb-2 text-xs font-semibold tracking-wider uppercase text-slate-500">
                Start Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="date"
                  onClick={(e) => e.target.showPicker?.()}
                  placeholder="DD/MM/YYYY"
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all sm:text-sm cursor-pointer hover:bg-white no-calendar-icon"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block mb-2 text-xs font-semibold tracking-wider uppercase text-slate-500">
                End Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="date"
                  onClick={(e) => e.target.showPicker?.()}
                  placeholder="DD/MM/YYYY"
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all sm:text-sm cursor-pointer hover:bg-white no-calendar-icon"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex flex-col flex-1 overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="min-w-full text-sm text-left whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b bg-slate-50 border-slate-200">
              <tr>
                {[
                  "Date",
                  "Day",
                  "Emp ID",
                  "Name",
                  "In Time",
                  "Out Time",
                  "Working Hrs",
                  "Status",
                  "Holiday",
                  "Remarks",
                  "Designation",
                  "Company",
                  "Overtime",
                  "Punch Miss",
                ].map((header) => (
                  <th
                    key={header}
                    className="px-6 py-4 text-xs font-semibold tracking-wider uppercase first:pl-8 last:pr-8 text-slate-500"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {tableLoading ? (
                <tr>
                  <td colSpan="14" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-8 h-8 border-2 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                      <span className="font-medium text-slate-500">
                        Loading daily records...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="14" className="px-6 py-12 text-center">
                    <div className="inline-flex items-center px-4 py-2 mb-4 text-red-600 rounded-lg bg-red-50">
                      <span className="font-medium">
                        Error loading data: {error}
                      </span>
                    </div>
                    <br />
                    <button
                      onClick={fetchAttendanceData}
                      className="px-4 py-2 font-medium transition-colors rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Try Again
                    </button>
                  </td>
                </tr>
              ) : currentItems.length > 0 ? (
                currentItems.map((item, index) => (
                  <tr
                    key={index}
                    className="transition-colors duration-150 group hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 pl-8 font-medium text-slate-900">
                      {item.date
                        ? item.date.split("-").reverse().join("/")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{item.day}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        {item.empIdCode}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold transition-colors text-slate-900 group-hover:text-indigo-700">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 font-medium text-emerald-600">
                      {item.inTime || "-"}
                    </td>
                    <td className="px-6 py-4 font-medium text-red-600">
                      {item.outTime || "-"}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">
                      {item.workingHours || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === "P"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                          }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{item.holiday}</td>
                    <td
                      className="px-6 py-4 text-slate-500 max-w-[200px] truncate"
                      title={item.remarks}
                    >
                      {item.remarks}
                    </td>

                    {/* Secondary Info */}
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {item.designation}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {item.companyName}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {item.overtimeHours}
                    </td>
                    <td className="px-6 py-4 pr-8 text-slate-500">
                      {item.punchMiss}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="14" className="px-6 py-24 text-center">
                    <p className="text-lg text-slate-400">
                      No daily records found.
                    </p>
                    {searchTerm || startDate || endDate ? (
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setStartDate("");
                          setEndDate("");
                        }}
                        className="mt-4 font-medium text-indigo-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredData.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t bg-slate-50 border-slate-200 shrink-0">
            <div className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-medium text-slate-900">
                {indexOfFirstItem + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-slate-900">
                {Math.min(indexOfLastItem, filteredData.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-900">
                {filteredData.length}
              </span>{" "}
              results
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 transition-colors bg-white border rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        ? "bg-indigo-600 text-white border border-indigo-600"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
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
                className="p-2 transition-colors bg-white border rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default Attendancedaily;

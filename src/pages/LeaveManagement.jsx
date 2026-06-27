import React, { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import {
  Search,
  X,
  Check,
  CheckCircle,
  Clock,
  Calendar,
  Plus,
  User,
  Briefcase,
  FileText,
  Users,
  ChevronDown,
  Shield,
  AlertCircle,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from 'xlsx';
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import useAuthStore from "../store/authStore";

// Fiscal year helper: April–March
// Apr 2025 – Mar 2026 → returns 2025
const getFiscalYear = (date = new Date()) => {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
};
import { sendWhatsappMessageToHod } from "../whatsappMessageSender/whatsappMessageSender";
import { sendWhatsappMessageToHr } from "../whatsappMessageSender/sendWhatsappMessageToHr";
import { sendApprovedMessageToEmployee, sendRejectedMessageToEmployee } from "../whatsappMessageSender/sendWhatsappMessageToEmployee";

const LeaveManagement = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isHr =
    user?.role === "hr" ||
    user?.role === "HR" ||
    user?.role === "admin" ||
    user?.role === "Admin" ||
    user?.Admin === "Yes";
  const isHod = user?.is_hod;
  const isAdmin =
    user?.role === "admin" ||
    user?.role === "Admin" ||
    user?.Admin === "Yes";

  const showHrColumn = isHr || (!isHod && !isHr);
  const showHodColumn = (isHod && !isHr) || (!isHod && !isHr);

  const [searchTerm, setSearchTerm] = useState("");
  // State removed (replaced by React Query)
  // pendingLeaves, approvedLeaves, rejectedLeaves are now derived from useInfiniteQuery
  // tableLoading is now derived from query status
  // error is now derived from queryError
  const [loading, setLoading] = useState(false); // kept for action button loading
  const [selectedRow, setSelectedRow] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [actionInProgress, setActionInProgress] = useState(null);
  const [editableDates, setEditableDates] = useState({});
  const [leaveCounts, setLeaveCounts] = useState({});
  const [remarksInputs, setRemarksInputs] = useState({});
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exportFromDate, setExportFromDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [exportToDate, setExportToDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));

  const [editingApprovedId, setEditingApprovedId] = useState(null);
  const [tempApprovedData, setTempApprovedData] = useState({});
  const [rowQuotas, setRowQuotas] = useState({});


  // Pagination state removed in favor of infinite scroll
  // const [currentPage, setCurrentPage] = useState(1);
  // const [itemsPerPage, setItemsPerPage] = useState(10);

  const { ref, inView } = useInView();

  const handleRemarkChange = (id, field, value) => {
    setRemarksInputs((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  // New state for leave request modal
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsEmployeeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const [activePopupId, setActivePopupId] = useState(null);
  const [formData, setFormData] = useState({
    employeeId: "",
    employeeName: "",
    designation: "",
    department: "",
    hodId: "",
    hodName: "",
    hodPhoneNumber: "",
    hrId: "",
    hrName: "",
    leaveType: "",
    fromDate: "",
    toDate: "",
    reason: "",
  });

  useEffect(() => {
    fetchEmployees();
    // fetchLeaveData is now handled by useInfiniteQuery
  }, [user]);

  const getAutoLeaveSplits = (leaveType, startDate, endDate, empId) => {
    const appliedDays = calculateDays(startDate, endDate);
    if (!startDate || !endDate) return { casual: 0, earned: 0, unpaid: appliedDays };

    const targetDate = new Date(startDate);
    const fyMonthIndex = targetDate.getMonth() >= 3 ? targetDate.getMonth() - 2 : targetDate.getMonth() + 10;

    const maxAccEL = fyMonthIndex * 2;
    const maxAccCL = fyMonthIndex * 1;

    const quota = rowQuotas[empId] || {};
    const usedEL = quota.earned_leave_used || 0;
    const usedCL = quota.casual_leave_used || 0;
    const carriedForwardEL = quota.carried_forward_el || 0;

    const availableAccEL = Math.max(0, maxAccEL + carriedForwardEL - usedEL);
    const availableAccCL = Math.max(0, maxAccCL - usedCL);

    if (leaveType === 'UnPaid Leave') {
      return { casual: 0, earned: 0, unpaid: appliedDays };
    } else {
      const effectiveCL = Math.min(3, availableAccCL);
      const maxPaidPossible = Math.min(10, effectiveCL + availableAccEL);

      if (appliedDays > maxPaidPossible) {
        const lwpDays = appliedDays - maxPaidPossible;
        const paidDays = maxPaidPossible;

        let clToUse = Math.min(paidDays, effectiveCL);
        let elToUse = paidDays - clToUse;

        return { casual: clToUse, earned: elToUse, unpaid: lwpDays };
      } else {
        const paidDays = appliedDays;
        let clToUse = Math.min(paidDays, effectiveCL);
        let elToUse = paidDays - clToUse;

        return { casual: clToUse, earned: elToUse, unpaid: 0 };
      }
    }
  };

  const handleCheckboxChange = (leaveId, rowData) => {
    // Single selection for editing (keep existing behavior)
    if (selectedRow?.id === leaveId) {
      setSelectedRow(null);
    } else {
      // Convert DD/MM/YYYY to YYYY-MM-DD for date input
      const formatForInput = (dateStr) => {
        if (!dateStr) return "";
        if (dateStr.includes("-")) return dateStr;
        const [day, month, year] = dateStr.split("/");
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      };

      setSelectedRow(rowData);

      // Initialize row state if not already present
      if (!editableDates[leaveId]) {
        const from = formatForInput(rowData.startDate);
        const to = formatForInput(rowData.endDate);
        const initialCounts = getAutoLeaveSplits(rowData.leaveType, from, to, rowData.employeeId);

        setEditableDates(prev => ({ ...prev, [leaveId]: { from, to } }));
        setLeaveCounts(prev => ({ ...prev, [leaveId]: initialCounts }));
      }
    }

    // Multiple selection for bulk actions
    setSelectedIds(prev => {
      const isSelecting = !prev.includes(leaveId);
      if (isSelecting) {
        // Initialize state for the row being selected if not already there
        if (!editableDates[leaveId]) {
          const formatForInput = (dateStr) => {
            if (!dateStr) return "";
            if (dateStr.includes("-")) return dateStr;
            const [day, month, year] = dateStr.split("/");
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          };
          const from = formatForInput(rowData.startDate);
          const to = formatForInput(rowData.endDate);
          const initialCounts = getAutoLeaveSplits(rowData.leaveType, from, to, rowData.employeeId);

          setEditableDates(prevDates => ({ ...prevDates, [leaveId]: { from, to } }));
          setLeaveCounts(prevCounts => ({ ...prevCounts, [leaveId]: initialCounts }));
        }
        return [...prev, leaveId];
      } else {
        return prev.filter(id => id !== leaveId);
      }
    });
  };

  const handleSelectAll = (isSelectingAll) => {
    if (isSelectingAll) {
      const allPendingIds = leaves.map(leave => leave.id);
      setSelectedIds(allPendingIds);

      // Initialize state for all selected rows
      const newDates = { ...editableDates };
      const newCounts = { ...leaveCounts };

      leaves.forEach(leaf => {
        if (!newDates[leaf.id]) {
          const formatForInput = (dateStr) => {
            if (!dateStr) return "";
            if (dateStr.includes("-")) return dateStr;
            const [day, month, year] = dateStr.split("/");
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          };
          const from = formatForInput(leaf.startDate);
          const to = formatForInput(leaf.endDate);
          const initialCounts = getAutoLeaveSplits(leaf.leaveType, from, to, leaf.employeeId);

          newDates[leaf.id] = { from, to };
          newCounts[leaf.id] = initialCounts;
        }
      });

      setEditableDates(newDates);
      setLeaveCounts(newCounts);
    } else {
      setSelectedIds([]);
    }
  };

  const handleDateChange = (id, field, value) => {
    setEditableDates((prev) => {
      const rowDates = prev[id] || { from: "", to: "" };
      const newDates = {
        ...rowDates,
        [field]: value,
      };

      // Recalculate and reset counts for this specific row when dates change
      const row = leaves.find(l => l.id === id);
      const initialCounts = getAutoLeaveSplits(row?.leaveType, newDates.from, newDates.to, row?.employeeId);

      setLeaveCounts(prevCounts => ({
        ...prevCounts,
        [id]: initialCounts
      }));

      return {
        ...prev,
        [id]: newDates
      };
    });
  };

  const handleCountChange = (id, field, value) => {
    const numValue = parseFloat(value) || 0;
    setLeaveCounts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { casual: 0, earned: 0, unpaid: 0 }),
        [field]: numValue
      }
    }));
  };

  // Fetch employees from Users table
  const fetchEmployees = async () => {
    try {
      // Fetch data from Supabase users table
      const { data, error } = await supabase
        .from("users")
        .select("emp_id, full_name, designation, department");

      if (error) {
        throw new Error(error.message);
      }

      // Process data to match existing structure
      const employeeData = data
        .map((row, index) => ({
          id: row.emp_id || "",
          name: row.full_name || "",
          designation: row.designation || "",
          department: row.department || "",
          rowIndex: index + 1,
        }))
        .filter((emp) => emp.name && emp.id);

      setEmployees(employeeData);
    } catch (error) {
      console.error("Error fetching employee data:", error);
      toast.error(`Failed to load employee data: ${error.message}`);
    }
  };

  // State for selected employee's leave balance
  const [leaveBalances, setLeaveBalances] = useState({
    casual: { total: 12, used: 0, remaining: 12 },
    earned: { total: 24, used: 0, remaining: 24 },
    carriedForward: 0,
    unpaid: { used: 0 }
  });

  // Fetch leave balance for a specific employee
  const fetchEmployeeBalance = async (employeeId) => {
    if (!employeeId) return;

    try {
      console.log('Fetching balance for employee:', employeeId);
      const { data: balanceData, error: balanceError } = await supabase
        .from('employee_leave_balances')
        .select('*')
        .eq('emp_id', employeeId)
        .maybeSingle();

      if (balanceError) {
        console.error('Error fetching employee balance:', balanceError);
        return;
      }

      if (balanceData) {
        console.log('Balance data found:', balanceData);

        // Also fetch carry forward from yearly_quota
        const currentYear = getFiscalYear();
        const { data: quotaData } = await supabase
          .from('yearly_quota')
          .select('carried_forward_el')
          .eq('emp_id', employeeId)
          .eq('year', currentYear)
          .maybeSingle();

        setLeaveBalances({
          casual: {
            total: 12,
            used: 12 - (balanceData.casual_leave_remaining ?? 12),
            remaining: balanceData.casual_leave_remaining ?? 12
          },
          earned: {
            total: 24,
            used: 24 - (balanceData.earned_leave_remaining ?? 24),
            remaining: balanceData.earned_leave_remaining ?? 24
          },
          carriedForward: quotaData?.carried_forward_el || 0,
          unpaid: { used: balanceData.unpaid_leave_total_taken ?? 0 }
        });
      } else {
        // Reset to defaults if no data found (or handle as 0 used)
        setLeaveBalances({
          casual: { total: 12, used: 0, remaining: 12 },
          earned: { total: 24, used: 0, remaining: 24 },
          carriedForward: 0,
          unpaid: { used: 0 }
        });
      }
    } catch (error) {
      console.error('Error in fetchEmployeeBalance:', error);
    }
  };

  // Handle employee selection
  const handleEmployeeChange = async (selectedName) => {
    const selectedEmployee = employees.find((emp) => emp.name === selectedName);

    // Update basic info immediately
    setFormData((prev) => ({
      ...prev,
      employeeName: selectedName,
      employeeId: selectedEmployee ? selectedEmployee.id : "",
      designation: selectedEmployee ? selectedEmployee.designation : "",
      department: selectedEmployee ? selectedEmployee.department : "",
      hodName: "", // Reset HOD name while fetching
      hodId: "", // Reset HOD ID
    }));

    // Fetch leave balances for the selected employee
    if (selectedEmployee && selectedEmployee.id) {
      fetchEmployeeBalance(selectedEmployee.id);
    } else {
      // Reset balances if no employee selected
      setLeaveBalances({
        casual: { total: 12, used: 0, remaining: 12 },
        earned: { total: 24, used: 0, remaining: 24 },
        unpaid: { used: 0 }
      });
    }

    // Fetch HOD from team_members
    if (selectedEmployee && selectedEmployee.id) {
      try {
        const { data: teamMember, error: teamError } = await supabase
          .from("team_members")
          .select("hod_id")
          .eq("emp_id", selectedEmployee.id)
          .maybeSingle();

        if (teamError) throw teamError;

        if (teamMember && teamMember.hod_id) {
          // Now fetch HOD name and phone number from users
          const { data: hodUser, error: hodError } = await supabase
            .from("users")
            .select("full_name, phone_number") // Fetch full_name and phone_number
            .eq("emp_id", teamMember.hod_id)
            .single();

          if (hodError) throw hodError;

          if (hodUser) {
            setFormData((prev) => ({
              ...prev,
              hodName: hodUser.full_name,
              hodId: teamMember.hod_id,
              hodPhoneNumber: hodUser.phone_number || "",
            }));
            toast.success(`HOD found: ${hodUser.full_name}`);
          }
        } else {
          // Default HOD logic if none assigned
          setFormData((prev) => ({
            ...prev,
            hodName: "",
            hodId: null,
            hodPhoneNumber: "",
          }));
          // toast.success('Default HOD assigned: Pawan Tiwari');
        }

        // Fetch HR Details
        const { data: hrData } = await supabase
          .from("users")
          .select("full_name, emp_id")
          .eq("department", "HR")
          .order("is_hod", { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log(hrData, "data is coming formt eh ");
        console.log(formData, "formdata");
        if (hrData) {
          setFormData((prev) => ({
            ...prev,
            hrName: hrData.full_name,
            hrId: hrData.emp_id,
          }));
        } else {
          setFormData((prev) => ({ ...prev, hrName: "Pawan Tiwari", hrId: 1 }));
        }
      } catch (error) {
        console.error("Error fetching HOD/HR:", error);
      }
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "employeeName") {
      handleEmployeeChange(value);
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Calculate days between dates
  const calculateDays = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return 0;

    let startDate, endDate;

    // Handle different date formats
    if (startDateStr.includes("/")) {
      const [startDay, startMonth, startYear] = startDateStr
        .split("/")
        .map(Number);
      startDate = new Date(startYear, startMonth - 1, startDay);
    } else {
      startDate = new Date(startDateStr);
    }

    if (endDateStr.includes("/")) {
      const [endDay, endMonth, endYear] = endDateStr.split("/").map(Number);
      endDate = new Date(endYear, endMonth - 1, endDay);
    } else {
      endDate = new Date(endDateStr);
    }

    const diffTime = endDate - startDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const formatDOB = (dateString) => {
    if (!dateString) return "";

    // If it's already in DD/MM/YYYY format, return as-is
    if (dateString.includes("/")) {
      return dateString;
    }

    // Convert from YYYY-MM-DD to DD/MM/YYYY
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return as-is if not a valid date
    }

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  // Helper for month split calculation
  const calculateMonthSplit = (startStr, endStr) => {
    const start = dayjs(startStr);
    const end = dayjs(endStr);
    const split = [];

    let current = start.clone().startOf('month');
    const endMonth = end.clone().startOf('month');

    while (current.isBefore(endMonth) || current.isSame(endMonth, 'month')) {
      const monthStart = current;
      const monthEnd = current.clone().endOf('month');

      const overlapStart = start.isAfter(monthStart) ? start : monthStart;
      const overlapEnd = end.isBefore(monthEnd) ? end : monthEnd;

      if (!overlapStart.isAfter(overlapEnd)) {
        const days = overlapEnd.diff(overlapStart, 'day') + 1;
        if (days > 0) {
          split.push(`${days} days in ${current.format('MMM')}`);
        }
      }
      current = current.add(1, 'month');
    }
    return split.join(" | ");
  };

  // Transform data helper
  const transformLeaveData = (data) => {
    const today = dayjs();
    return data.map((leave) => {
      const start = dayjs(leave.leave_date_start);
      const end = dayjs(leave.leave_date_end);
      const totalDays = calculateDays(leave.leave_date_start, leave.leave_date_end);
      const monthSplit = calculateMonthSplit(leave.leave_date_start, leave.leave_date_end);

      const isExpired = end.isBefore(today, "day");
      const isActive = !isExpired;

      return {
        id: leave.id,
        employeeId: leave.emp_id,
        employeeName: leave.employee_name,
        days: totalDays,
        monthSplit,
        isActive,
        isExpired,
        startDate: leave.leave_date_start,
        endDate: leave.leave_date_end,
        reason: leave.remarks,
        leaveType: leave.leave_type,
        status: leave.status,
        hodId: leave.hod_id,
        hodName: leave.hod_name,
        hodRemarks: leave.hod_remarks,
        hrId: leave.hr_id,
        hrName: leave.hr_name,
        hrRemarks: leave.hr_remarks,
        timestamp: leave.timestamp,
        employeePhone: leave.employee?.phone_number,
        casual: leave.casual || 0,
        earned: leave.earned || 0,
        unpaid: leave.unpaid || 0,
      };
    });
  };


  const fetchLeaves = async ({ pageParam = 0 }) => {
    if (!user) return { data: [], nextPage: undefined };

    const ITEMS_PER_PAGE = 10;

    let query = supabase
      .from("leave_management")
      .select(`
        *,
        employee:users!leave_management_emp_id_fkey(phone_number)
      `, { count: "exact" });

    // 1. Role-based filtering
    if (isHr) {
      // HR/Admin sees all
    } else if (isHod) {
      // HOD sees their own requests AND requests where they are the HOD
      query = query.or(`hod_id.eq.${user.emp_id},emp_id.eq.${user.emp_id}`);
    } else {
      // Regular user sees only their own
      query = query.eq("emp_id", user.emp_id);
    }

    // 2. Tab-based filtering
    if (activeTab === "pending") {
      query = query.in("status", ["Pending", "Pending HOD", "Pending HR"]);
    } else if (activeTab === "approved") {
      query = query.ilike("status", "%Approved%");
      // Apply date range filter for approved leaves
      if (exportFromDate && exportToDate) {
        query = query.gte("leave_date_start", exportFromDate).lte("leave_date_start", exportToDate);
      }
    } else if (activeTab === "rejected") {
      query = query.ilike("status", "%Reject%");
    }

    // 3. Search
    if (searchTerm) {
      query = query.or(`employee_name.ilike.%${searchTerm}%,emp_id.ilike.%${searchTerm}%`);
    }

    // 4. Sorting & Pagination
    const from = pageParam * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error } = await query
      .order("timestamp", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);

    return {
      data: transformLeaveData(data),
      nextPage: data.length === ITEMS_PER_PAGE ? pageParam + 1 : undefined,
    };
  };

  const fetchTabCounts = async () => {
    if (!user) return { pending: 0, approved: 0, rejected: 0 };

    const getBaseQuery = () => {
      let q = supabase.from("leave_management").select("*", { count: "exact", head: true });
      if (isHr) {
        // HR sees all
      } else if (isHod) {
        q = q.or(`hod_id.eq.${user.emp_id},emp_id.eq.${user.emp_id}`);
      } else {
        q = q.eq("emp_id", user.emp_id);
      }
      if (searchTerm) {
        q = q.or(`employee_name.ilike.%${searchTerm}%,emp_id.ilike.%${searchTerm}%`);
      }
      return q;
    };

    const getApprovedQuery = () => {
      let q = getBaseQuery().ilike("status", "%Approved%");
      if (exportFromDate && exportToDate) {
        q = q.gte("leave_date_start", exportFromDate).lte("leave_date_start", exportToDate);
      }
      return q;
    };

    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      getBaseQuery().in("status", ["Pending", "Pending HOD", "Pending HR"]),
      getApprovedQuery(),
      getBaseQuery().ilike("status", "%Reject%"),
    ]);

    return {
      pending: pendingRes.count || 0,
      approved: approvedRes.count || 0,
      rejected: rejectedRes.count || 0,
    };
  };

  const { data: countsData } = useQuery({
    queryKey: ["leaveCounts", user?.emp_id, searchTerm, exportFromDate, exportToDate],
    queryFn: fetchTabCounts,
    enabled: !!user,
  });


  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error: queryError,
    refetch
  } = useInfiniteQuery({
    queryKey: ["leaves", user?.emp_id, activeTab, searchTerm, exportFromDate, exportToDate],
    queryFn: fetchLeaves,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!user,
  });

  // Trigger fetch next page when scrolling to bottom
  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, fetchNextPage, hasNextPage]);

  // Refetch when row selection changes (if needed for updates, etc)
  useEffect(() => {
    if (!selectedRow) {
      refetch();
    }
  }, [selectedRow, refetch]);

  // Helper function to manually trigger fetchLeaveData (kept for compatibility with submit/update handlers)
  const fetchLeaveData = () => {
    queryClient.invalidateQueries({ queryKey: ["leaves"] });
    queryClient.invalidateQueries({ queryKey: ["leaveCounts"] });
  };

  const leaves = data?.pages.flatMap((page) => page.data) || [];

  useEffect(() => {
    const fetchQuotas = async () => {
      const empIds = [...new Set(leaves.map((l) => l.employeeId))];
      if (empIds.length === 0) return;

      const currentYear = getFiscalYear();
      try {
        const { data, error } = await supabase
          .from("yearly_quota")
          .select("*")
          .in("emp_id", empIds)
          .eq("year", currentYear);

        if (!error && data) {
          const quotaMap = {};
          data.forEach((q) => {
            quotaMap[q.emp_id] = q;
          });
          setRowQuotas((prev) => ({ ...prev, ...quotaMap }));
        }
      } catch (err) {
        console.error("Error fetching row quotas:", err);
      }
    };

    if (leaves.length > 0) {
      fetchQuotas();
    }
  }, [leaves]);

  // No need for separate state variables anymore, but keeping render logic intact
  // We can derive "filtered" lists directly from `leaves` 
  // (though strict server filtering means `leaves` ONLY contains current tab data)
  const filteredPendingLeaves = activeTab === "pending" ? leaves : [];
  const filteredApprovedLeaves = activeTab === "approved" ? leaves : [];
  const filteredRejectedLeaves = activeTab === "rejected" ? leaves : [];

  const tableLoading = status === "pending";
  const errorMessage = queryError?.message;

  const handleSubmit = async (e) => {
    console.log("the trigger has been run ");
    e.preventDefault();

    console.log("=== handleSubmit called ===");
    console.log("formData:", formData);

    if (
      !formData.employeeName ||
      !formData.leaveType ||
      !formData.fromDate ||
      !formData.toDate ||
      !formData.reason ||
      !formData.hodName ||
      !formData.hodPhoneNumber
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      // 🔴 Check if user already requested leave today
      const today = new Date().toISOString().split("T")[0];

      const { data: existingLeave, error: checkError } = await supabase
        .from("leave_management")
        .select("id")
        .eq("emp_id", formData.employeeId)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .limit(1);



      if (checkError) {
        console.error(checkError);
        toast.error("Unable to verify previous leave requests");
        return;
      }

      if (existingLeave.length > 0) {
        toast.error("Only 1 leave request allowed per day");
        return;
      }

      setSubmitting(true);
      console.log("Starting Supabase insert...");

      // Prepare data for Supabase insertion
      const insertData = {
        timestamp: new Date().toISOString(),
        serial_no: null,
        emp_id: formData.employeeId,
        employee_name: formData.employeeName,
        leave_date_start: formData.fromDate,
        leave_date_end: formData.toDate,
        remarks: formData.reason,
        status: formData.hodId === null ? "Pending HR" : "Pending HOD",
        leave_type: formData.leaveType,
        hod_name: formData.hodName,
        designation: formData.designation,
        hod_id: formData.hodId,
        hr_id: formData.hrId,
        hr_name: formData.hrName,
      };

      // Insert data into Supabase leave_management table
      const { data, error } = await supabase
        .from("leave_management")
        .insert([insertData])
        .select();

      if (error) throw new Error(error.message);

      // Log creation
      if (data && data[0]) {
        await supabase.from("logs").insert({
          request_id: data[0].id,
          request_type: "Leave",
          emp_id: formData.employeeId,
          emp_name: formData.employeeName,
          status: "Pending",
          hod_id: formData.hodId,
          hod_name: formData.hodName,
          hr_id: formData.hrId,
          hr_name: formData.hrName,
        });

        // Send WhatsApp message to HOD if HOD is assigned and has phone number
        console.log(
          "WhatsApp Debug - hodId:",
          formData.hodId,
          "hodPhoneNumber:",
          formData.hodPhoneNumber,
        );
        if (formData.hodId && formData.hodPhoneNumber) {
          console.log("Sending WhatsApp message to HOD...");
          const totalDays = calculateDays(formData.fromDate, formData.toDate);
          const whatsappResult = await sendWhatsappMessageToHod({
            employeId: formData.hodId,
            tableid: data[0].id,
            hodPhoneNumber: formData.hodPhoneNumber,
            employeeName: formData.employeeName,
            empId: formData.employeeId,
            department: formData.department,
            leaveType: formData.leaveType,
            fromDate: formData.fromDate,
            toDate: formData.toDate,
            totalDays: totalDays,
            reason: formData.reason,
            who: "hod",
          });

          console.log(whatsappResult, "whatsapp result");

          if (whatsappResult.success) {
            toast.success("WhatsApp notification sent to HOD!");
          } else {
            console.error(
              "WhatsApp notification failed:",
              whatsappResult.error,
            );
            // Don't show error toast as leave request was successful
          }
        }
      }

      if (error) {
        throw new Error(error.message);
      }

      toast.success("Leave Request submitted successfully!");
      setFormData({
        employeeId: "",
        employeeName: "",
        designation: "",
        department: "",
        hodId: "",
        hodName: "",
        hodPhoneNumber: "",
        hrId: "",
        hrName: "",
        leaveType: "",
        fromDate: "",
        toDate: "",
        reason: "",
      });
      setShowModal(false);
      // Refresh the data
      fetchLeaveData();
    } catch (error) {
      console.error("Insert error:", error);
      toast.error(`Failed to submit leave request: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveAction = async (action, item) => {
    const targetRow = item || selectedRow;
    if (!targetRow) {
      toast.error("Please select a leave request");
      return;
    }

    setActionInProgress(action);
    setLoading(true);

    try {
      // Determine new status and notification message
      let newStatus = "";
      let notificationMessage = "";
      const currentStatus = targetRow.status;

      const isHod = user?.is_hod || false;
      const isHr =
        user?.role === "hr" ||
        user?.role === "HR" ||
        user?.role === "admin" ||
        user?.role === "Admin" ||
        user?.Admin === "Yes";

      // Flow Logic
      if (currentStatus === "Pending" || currentStatus === "Pending HOD") {
        if (isHod || isHr) {
          if (action === "accept") {
            newStatus = "Pending HR";
            notificationMessage = "Approved by HOD and sent to HR";
          } else {
            newStatus = "Rejected";
            notificationMessage = "Rejected by HOD";
          }
        } else {
          throw new Error("You are not authorized to perform HOD action.");
        }
      } else if (currentStatus === "Pending HR") {
        if (isHr) {
          if (action === "accept") {
            newStatus = "Approved";
            notificationMessage = "Approved by HR";
          } else {
            newStatus = "Rejected";
            notificationMessage = "Rejected by HR";
          }
        } else {
          throw new Error("You are not authorized to perform HR action.");
        }
      } else {
        throw new Error("Invalid status transition.");
      }

      const rowRemarks = remarksInputs[targetRow.id] || {};
      const rowDates = editableDates[targetRow.id] || {};
      const rowCounts = leaveCounts[targetRow.id] || { casual: 0, earned: 0, unpaid: 0 };

      const updateData = {
        timestamp: new Date().toISOString(),
        leave_date_start:
          rowDates.from && rowDates.from !== targetRow.startDate
            ? rowDates.from
            : targetRow.startDate,
        leave_date_end:
          rowDates.to && rowDates.to !== targetRow.endDate
            ? rowDates.to
            : targetRow.endDate,
        status: newStatus,
        casual: newStatus === "Rejected" ? 0 : rowCounts.casual,
        earned: newStatus === "Rejected" ? 0 : rowCounts.earned,
        unpaid: newStatus === "Rejected" ? 0 : rowCounts.unpaid,
        ...(newStatus === "Rejected" && { rejected_by: String(user.emp_id) }),
        ...(isHod && {
          hod_remarks: rowRemarks.hod || "",
          hod_id: user.emp_id,
          hod_name: user.full_name || user.Name,
        }),
        ...(isHr && {
          hr_remarks: rowRemarks.hr || "",
          hr_id: user.emp_id,
          hr_name: user.full_name || user.Name,
        }),
      };

      // Update the leave request in Supabase
      const { error: updateError } = await supabase
        .from("leave_management")
        .update(updateData)
        .eq("id", targetRow.id);

      if (updateError) throw new Error(updateError.message);

      // Update Log
      const logUpdate = {
        status: newStatus,
        ...(isHod && {
          hod_name: user.full_name || user.Name,
          hod_id: user.emp_id,
          hod_action: action === "accept" ? "Approved" : "Rejected",
          hod_approval_time: new Date().toISOString(),
          hod_remarks: rowRemarks.hod || "",
        }),
        ...(isHr && {
          hr_name: user.full_name || user.Name,
          hr_id: user.emp_id,
          hr_action: action === "accept" ? "Approved" : "Rejected",
          hr_approval_time: new Date().toISOString(),
          hr_remarks: rowRemarks.hr || "",
        }),
      };
      await supabase
        .from("logs")
        .update(logUpdate)
        .eq("request_id", targetRow.id)
        .eq("request_type", "Leave");

      // Update yearly_quota when leave is approved
      if (newStatus === "Approved") {
        const currentYear = getFiscalYear();
        const employeeId = targetRow.employeeId;
        const updates = [
          { type: "Casual", count: rowCounts.casual, column: "casual_leave_used" },
          { type: "Earned", count: rowCounts.earned, column: "earned_leave_used" },
          { type: "UnPaid", count: rowCounts.unpaid, column: "unpaid_leave_used" }
        ].filter(u => u.count > 0);

        for (const update of updates) {
          const { count, column } = update;
          try {
            const { data: existingQuota } = await supabase
              .from("yearly_quota")
              .select("*")
              .eq("emp_id", employeeId)
              .eq("year", currentYear)
              .maybeSingle();

            if (existingQuota) {
              let updatePayload = {};
              if (update.type === "Earned") {
                const carriedForward = existingQuota.carried_forward_el || 0;
                let cfUsed = 0;
                if (carriedForward >= count) {
                  updatePayload.carried_forward_el = carriedForward - count;
                  cfUsed = count;
                } else {
                  updatePayload.carried_forward_el = 0;
                  updatePayload.earned_leave_used = (existingQuota.earned_leave_used || 0) + (count - carriedForward);
                  cfUsed = carriedForward;
                }
                // Save consumption to the request record
                await supabase.from("leave_management").update({ cf_el_used: cfUsed }).eq("id", targetRow.id);
              } else {
                updatePayload[column] = (existingQuota[column] || 0) + count;
              }

              await supabase
                .from("yearly_quota")
                .update(updatePayload)
                .eq("id", existingQuota.id);
            } else {
              const insertPayload = {
                emp_id: employeeId,
                year: currentYear,
                casual_leave_used: update.type === "Casual" ? count : 0,
                earned_leave_used: update.type === "Earned" ? count : 0,
                unpaid_leave_used: update.type === "UnPaid" ? count : 0,
                casual_leave_limit: 12,
                earned_leave_limit: 24,
                carried_forward_el: 0
              };
              await supabase.from("yearly_quota").insert(insertPayload);
            }
          } catch (err) { console.error("Quota error:", err); }
        }
      }

      toast.success(`Leave ${notificationMessage} for ${targetRow.employeeName || "employee"}`);

      // WhatsApp
      (async () => {
        try {
          const leaveDays = calculateDays(editableDates.from || targetRow.startDate, editableDates.to || targetRow.endDate);
          const mdNumber = import.meta.env.VITE_MD_MOBILE_NUMBER;
          const specialEmpIds = ["1", "175", "53", "219", "3", "233", "245", "341", "16", "294", "217", "152", "527", "501", "235", "504", "180", "321", "519", "242", "246", "518"];

          if (newStatus === "Pending HR") {
            await sendWhatsappMessageToHr({
              employeId: targetRow.employeeId, empId: targetRow.employeeId, tableid: targetRow.id,
              employeeName: targetRow.employeeName, leaveType: targetRow.leaveType,
              fromDate: formatDate(editableDates.from || targetRow.startDate),
              toDate: formatDate(editableDates.to || targetRow.endDate),
              totalDays: leaveDays, reason: targetRow.reason,
            });
          } else if (newStatus === "Approved") {
            await sendApprovedMessageToEmployee({
              employeePhone: targetRow.employeePhone, employeeName: targetRow.employeeName, leaveType: targetRow.leaveType,
              fromDate: formatDate(editableDates.from || targetRow.startDate),
              toDate: formatDate(editableDates.to || targetRow.endDate),
              totalDays: leaveDays, reason: targetRow.reason,
            });
            if (specialEmpIds.includes(String(targetRow.employeeId))) {
              await sendApprovedMessageToEmployee({
                employeePhone: mdNumber, employeeName: `${targetRow.employeeName} (ID: ${targetRow.employeeId})`,
                leaveType: targetRow.leaveType, fromDate: formatDate(editableDates.from || targetRow.startDate),
                toDate: formatDate(editableDates.to || targetRow.endDate),
                totalDays: leaveDays, reason: targetRow.reason,
              });
            }
          } else if (newStatus === "Rejected") {
            await sendRejectedMessageToEmployee({
              employeePhone: targetRow.employeePhone, employeeName: targetRow.employeeName, leaveType: targetRow.leaveType,
              fromDate: formatDate(editableDates.from || targetRow.startDate),
              toDate: formatDate(editableDates.to || targetRow.endDate),
              totalDays: leaveDays, hrRemarks: rowRemarks.hr || rowRemarks.hod || "Decision by management",
            });
          }
        } catch (waError) { console.error("WA error:", waError); }
      })();

      fetchLeaveData();
      if (!item) setSelectedRow(null); // only clear selectedRow if we were using it
      setEditableDates({ from: "", to: "" });
    } catch (error) {
      console.error("Update error:", error);
      toast.error(`Failed to update leave: ${error.message}`);
    } finally {
      setLoading(false);
      setActionInProgress(null);
    }
  };

  const handleAcceptAll = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one leave request");
      return;
    }

    const pendingLeavesToAccept = leaves.filter(leaf =>
      selectedIds.includes(leaf.id) &&
      (leaf.status === "Pending" || leaf.status === "Pending HOD" || leaf.status === "Pending HR")
    );

    if (pendingLeavesToAccept.length === 0) {
      toast.error("No valid pending leaves selected for approval");
      return;
    }

    setBulkLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of pendingLeavesToAccept) {
      try {
        let newStatus = "";
        let notificationMessage = "";
        const currentStatus = row.status;

        const isHodUser = user?.is_hod || false;
        const isHrUser =
          user?.role === "hr" ||
          user?.role === "HR" ||
          user?.role === "admin" ||
          user?.role === "Admin" ||
          user?.Admin === "Yes";

        // Determine transition
        if (currentStatus === "Pending" || currentStatus === "Pending HOD") {
          if (isHodUser || isHrUser) {
            newStatus = "Pending HR";
            notificationMessage = "Approved by HOD and sent to HR";
          } else continue;
        } else if (currentStatus === "Pending HR") {
          if (isHrUser) {
            newStatus = "Approved";
            notificationMessage = "Approved by HR";
          } else continue;
        } else continue;

        // Use edited values if available, otherwise original values
        const rowRemarks = remarksInputs[row.id] || {};
        const rowDates = editableDates[row.id] || {};
        const rowCounts = leaveCounts[row.id] || { casual: row.casual, earned: row.earned, unpaid: row.unpaid };

        const updateData = {
          timestamp: new Date().toISOString(),
          leave_date_start: rowDates.from || row.startDate,
          leave_date_end: rowDates.to || row.endDate,
          status: newStatus,
          casual: rowCounts.casual,
          earned: rowCounts.earned,
          unpaid: rowCounts.unpaid,
          hod_id: isHodUser ? user.emp_id : row.hodId,
          hod_name: isHodUser ? (user.full_name || user.Name) : row.hodName,
          ...(isHrUser && {
            hr_id: user.emp_id,
            hr_name: user.full_name || user.Name,
            hr_remarks: rowRemarks.hr || "",
          }),
        };

        const { error: updateError } = await supabase
          .from("leave_management")
          .update(updateData)
          .eq("id", row.id);

        if (updateError) throw updateError;

        // Log
        const logUpdate = {
          status: newStatus,
          ...(isHodUser && {
            hod_name: user.full_name || user.Name,
            hod_id: user.emp_id,
            hod_action: "Approved",
            hod_approval_time: new Date().toISOString(),
          }),
          ...(isHrUser && {
            hr_name: user.full_name || user.Name,
            hr_id: user.emp_id,
            hr_action: "Approved",
            hr_approval_time: new Date().toISOString(),
          }),
        };
        await supabase
          .from("logs")
          .update(logUpdate)
          .eq("request_id", row.id)
          .eq("request_type", "Leave");

        // Quota fix
        if (newStatus === "Approved") {
          const currentYear = getFiscalYear();
          const employeeId = row.employeeId;
          const updates = [
            { type: "Casual", count: rowCounts.casual, column: "casual_leave_used" },
            { type: "Earned", count: rowCounts.earned, column: "earned_leave_used" },
            { type: "UnPaid", count: rowCounts.unpaid, column: "unpaid_leave_used" }
          ].filter(u => u.count > 0);

          for (const update of updates) {
            const { count, column } = update;
            const { data: q } = await supabase.from("yearly_quota").select("*").eq("emp_id", employeeId).eq("year", currentYear).maybeSingle();
            if (q) {
              let updatePayload = {};
              if (update.type === "Earned") {
                const carriedForward = q.carried_forward_el || 0;
                let cfUsed = 0;
                if (carriedForward >= count) {
                  updatePayload.carried_forward_el = carriedForward - count;
                  cfUsed = count;
                } else {
                  updatePayload.carried_forward_el = 0;
                  updatePayload.earned_leave_used = (q.earned_leave_used || 0) + (count - carriedForward);
                  cfUsed = carriedForward;
                }
                await supabase.from("leave_management").update({ cf_el_used: cfUsed }).eq("id", row.id);
              } else {
                updatePayload[column] = (q[column] || 0) + count;
              }
              await supabase.from("yearly_quota").update(updatePayload).eq("id", q.id);
            } else {
              await supabase.from("yearly_quota").insert({
                emp_id: employeeId, year: currentYear,
                casual_leave_limit: 12, earned_leave_limit: 24,
                carried_forward_el: 0,
                [column]: count
              });
            }
          }
        }

        // WhatsApp
        try {
          if (newStatus === "Pending HR") {
            await sendWhatsappMessageToHr({
              employeId: row.employeeId, empId: row.employeeId, tableid: row.id,
              employeeName: row.employeeName, leaveType: row.leaveType,
              fromDate: formatDate(row.startDate), toDate: formatDate(row.endDate),
              totalDays: row.days, reason: row.reason,
            });
          } else if (newStatus === "Approved") {
            await sendApprovedMessageToEmployee({
              employeePhone: row.employeePhone, employeeName: row.employeeName,
              leaveType: row.leaveType, fromDate: formatDate(row.startDate),
              toDate: formatDate(row.endDate), totalDays: row.days, reason: row.reason,
            });
          }
        } catch (waE) { console.error("WA Error:", waE); }

        successCount++;
      } catch (err) {
        console.error("Bulk Item Error:", err);
        failCount++;
      }
    }

    setBulkLoading(false);
    setSelectedIds([]);
    fetchLeaveData();

    if (failCount === 0) {
      toast.success(`Successfully approved ${successCount} leave requests`);
    } else {
      toast.error(`Approved ${successCount} requests, but ${failCount} failed`);
    }
  };

  const handleRejectAll = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one leave request");
      return;
    }

    const pendingLeavesToReject = leaves.filter(leaf =>
      selectedIds.includes(leaf.id) &&
      (leaf.status === "Pending" || leaf.status === "Pending HOD" || leaf.status === "Pending HR")
    );

    if (pendingLeavesToReject.length === 0) {
      toast.error("No valid pending leaves selected for rejection");
      return;
    }

    setBulkLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of pendingLeavesToReject) {
      try {
        let newStatus = "Rejected";
        let notificationMessage = "";
        const currentStatus = row.status;

        const isHodUser = user?.is_hod || false;
        const isHrUser =
          user?.role === "hr" ||
          user?.role === "HR" ||
          user?.role === "admin" ||
          user?.role === "Admin" ||
          user?.Admin === "Yes";

        // Determine transition
        if (currentStatus === "Pending" || currentStatus === "Pending HOD") {
          if (isHodUser || isHrUser) {
            notificationMessage = "Rejected by HOD";
          } else continue;
        } else if (currentStatus === "Pending HR") {
          if (isHrUser) {
            notificationMessage = "Rejected by HR";
          } else continue;
        } else continue;

        // Use edited values if available, otherwise original values
        const rowRemarks = remarksInputs[row.id] || {};
        const rowDates = editableDates[row.id] || {};

        const updateData = {
          timestamp: new Date().toISOString(),
          leave_date_start: rowDates.from || row.startDate,
          leave_date_end: rowDates.to || row.endDate,
          status: newStatus,
          casual: 0,
          earned: 0,
          unpaid: 0,
          rejected_by: String(user.emp_id),
          hod_id: isHodUser ? user.emp_id : row.hodId,
          hod_name: isHodUser ? (user.full_name || user.Name) : row.hodName,
          ...(isHodUser && {
            hod_remarks: rowRemarks.hod || "",
          }),
          ...(isHrUser && {
            hr_id: user.emp_id,
            hr_name: user.full_name || user.Name,
            hr_remarks: rowRemarks.hr || "",
          }),
        };

        const { error: updateError } = await supabase
          .from("leave_management")
          .update(updateData)
          .eq("id", row.id);

        if (updateError) throw updateError;

        // Log
        const logUpdate = {
          status: newStatus,
          ...(isHodUser && {
            hod_name: user.full_name || user.Name,
            hod_id: user.emp_id,
            hod_action: "Rejected",
            hod_approval_time: new Date().toISOString(),
            hod_remarks: rowRemarks.hod || "",
          }),
          ...(isHrUser && {
            hr_name: user.full_name || user.Name,
            hr_id: user.emp_id,
            hr_action: "Rejected",
            hr_approval_time: new Date().toISOString(),
            hr_remarks: rowRemarks.hr || "",
          }),
        };
        await supabase
          .from("logs")
          .update(logUpdate)
          .eq("request_id", row.id)
          .eq("request_type", "Leave");

        // WhatsApp
        try {
          await sendRejectedMessageToEmployee({
            employeePhone: row.employeePhone, employeeName: row.employeeName, leaveType: row.leaveType,
            fromDate: formatDate(rowDates.from || row.startDate),
            toDate: formatDate(rowDates.to || row.endDate),
            totalDays: calculateDays(rowDates.from || row.startDate, rowDates.to || row.endDate),
            hrRemarks: rowRemarks.hr || rowRemarks.hod || "Decision by management",
          });
        } catch (waE) { console.error("WA Error:", waE); }

        successCount++;
      } catch (err) {
        console.error("Bulk Item Error:", err);
        failCount++;
      }
    }

    setBulkLoading(false);
    setSelectedIds([]);
    fetchLeaveData();

    if (failCount === 0) {
      toast.success(`Successfully rejected ${successCount} leave requests`);
    } else {
      toast.error(`Rejected ${successCount} requests, but ${failCount} failed`);
    }
  };

  const handleExportToExcel = async () => {
    try {
      setExportLoading(true);

      // Fetch all approved leaves for the custom date range
      const { data, error } = await supabase
        .from('leave_management')
        .select('*')
        .eq('status', 'Approved')
        .gte('leave_date_start', exportFromDate)
        .lte('leave_date_start', exportToDate)
        .order('leave_date_start', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('No approved leaves found for the current month');
        return;
      }

      // Format data for Excel
      const excelData = data.flatMap(item => {
        const rows = [];
        const baseRow = {
          'Employee ID': item.emp_id,
          'Employee Name': item.employee_name,
          'Designation': item.designation || '-',
          'From Date': item.leave_date_start ? dayjs(item.leave_date_start).format('DD/MM/YYYY') : '-',
          'To Date': item.leave_date_end ? dayjs(item.leave_date_end).format('DD/MM/YYYY') : '-',
          'Reason': item.remarks,
          'HOD Name': item.hod_name,
          'HOD Remarks': item.hod_remarks || '-',
          'HR Name': item.hr_name || '-',
          'HR Remarks': item.hr_remarks || '-',
          'Approved At': item.timestamp ? dayjs(item.timestamp).format('DD/MM/YYYY hh:mm A') : '-'
        };

        const casual = item.casual || 0;
        const earned = item.earned || 0;
        const unpaid = item.unpaid || 0;

        if (casual > 0) {
          rows.push({ ...baseRow, 'Leave Type': 'Casual Leave', 'Days': casual });
        }
        if (earned > 0) {
          rows.push({ ...baseRow, 'Leave Type': 'Earned Leave', 'Days': earned });
        }
        if (unpaid > 0) {
          rows.push({ ...baseRow, 'Leave Type': 'UnPaid Leave', 'Days': unpaid });
        }

        if (rows.length === 0) {
          const totalDays = calculateDays(item.leave_date_start, item.leave_date_end);
          rows.push({ ...baseRow, 'Leave Type': item.leave_type || '-', 'Days': totalDays });
        }

        return rows.map(r => ({
          'Employee ID': r['Employee ID'],
          'Employee Name': r['Employee Name'],
          'Designation': r['Designation'],
          'Leave Type': r['Leave Type'],
          'Days': r['Days'],
          'From Date': r['From Date'],
          'To Date': r['To Date'],
          'Reason': r['Reason'],
          'HOD Name': r['HOD Name'],
          'HOD Remarks': r['HOD Remarks'],
          'HR Name': r['HR Name'],
          'HR Remarks': r['HR Remarks'],
          'Approved At': r['Approved At']
        }));
      });

      // Create sheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better readability
      const wscols = [
        { wch: 15 }, // Emp ID
        { wch: 25 }, // Name
        { wch: 20 }, // Designation
        { wch: 15 }, // Leave Type
        { wch: 10 }, // Days
        { wch: 12 }, // From
        { wch: 12 }, // To
        { wch: 30 }, // Reason
        { wch: 20 }, // HOD Name
        { wch: 25 }, // HOD Remarks
        { wch: 20 }, // HR Name
        { wch: 25 }, // HR Remarks
        { wch: 20 }, // Approved At
      ];
      worksheet['!cols'] = wscols;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Approved Leaves");

      // Download
      const fileName = `Approved_Leaves_${dayjs(exportFromDate).format('DDMMYY')}_to_${dayjs(exportToDate).format('DDMMYY')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success(`Exported ${data.length} records successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export to Excel: ' + error.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleEditApproved = (item) => {
    setEditingApprovedId(item.id);
    setTempApprovedData({
      startDate: item.startDate,
      endDate: item.endDate,
      leaveType: item.leaveType,
      casual: item.casual || 0,
      earned: item.earned || 0,
      unpaid: item.unpaid || 0,
      days: item.days,
    });
  };

  const handleCancelEdit = () => {
    setEditingApprovedId(null);
    setTempApprovedData({});
  };

  const handleSaveApproved = async (originalItem) => {
    try {
      setLoading(true);

      const updateData = {};
      if (tempApprovedData.startDate !== originalItem.startDate) updateData.leave_date_start = tempApprovedData.startDate;
      if (tempApprovedData.endDate !== originalItem.endDate) updateData.leave_date_end = tempApprovedData.endDate;
      if (tempApprovedData.leaveType !== originalItem.leaveType) updateData.leave_type = tempApprovedData.leaveType;
      if (tempApprovedData.casual !== originalItem.casual) updateData.casual = tempApprovedData.casual;
      if (tempApprovedData.earned !== originalItem.earned) updateData.earned = tempApprovedData.earned;
      if (tempApprovedData.unpaid !== originalItem.unpaid) updateData.unpaid = tempApprovedData.unpaid;

      if (Object.keys(updateData).length === 0) {
        handleCancelEdit();
        setLoading(false);
        return;
      }

      // Update leave_management
      const { error: updateError } = await supabase
        .from("leave_management")
        .update(updateData)
        .eq("id", originalItem.id);

      if (updateError) throw updateError;

      // Handle Quota updates if counts changed
      const countsChanged =
        tempApprovedData.casual !== originalItem.casual ||
        tempApprovedData.earned !== originalItem.earned ||
        tempApprovedData.unpaid !== originalItem.unpaid;

      if (countsChanged) {
        const currentYear = getFiscalYear(new Date(originalItem.startDate));
        const employeeId = originalItem.employeeId;

        const quotaUpdates = [
          { type: "Casual", old: originalItem.casual || 0, new: tempApprovedData.casual, column: "casual_leave_used" },
          { type: "Earned", old: originalItem.earned || 0, new: tempApprovedData.earned, column: "earned_leave_used" },
          { type: "UnPaid", old: originalItem.unpaid || 0, new: tempApprovedData.unpaid, column: "unpaid_leave_used" }
        ].filter(u => u.old !== u.new);

        for (const update of quotaUpdates) {
          const { data: q } = await supabase
            .from("yearly_quota")
            .select("*")
            .eq("emp_id", employeeId)
            .eq("year", currentYear)
            .maybeSingle();

          if (q) {
            let updatePayload = {};
            const diff = update.new - update.old;

            if (update.type === "Earned") {
              if (diff > 0) {
                const carriedForward = q.carried_forward_el || 0;
                if (carriedForward >= diff) {
                  updatePayload.carried_forward_el = carriedForward - diff;
                } else {
                  updatePayload.carried_forward_el = 0;
                  updatePayload.earned_leave_used = (q.earned_leave_used || 0) + (diff - carriedForward);
                }
              } else {
                const absDiff = Math.abs(diff);
                const used = q.earned_leave_used || 0;
                if (used >= absDiff) {
                  updatePayload.earned_leave_used = used - absDiff;
                } else {
                  updatePayload.earned_leave_used = 0;
                  updatePayload.carried_forward_el = (q.carried_forward_el || 0) + (absDiff - used);
                }
              }
            } else {
              updatePayload[update.column] = (q[update.column] || 0) + diff;
            }
            await supabase.from("yearly_quota").update(updatePayload).eq("id", q.id);
          }
        }
      }

      toast.success("Leave request updated successfully");
      handleCancelEdit();
      fetchLeaveData();
    } catch (error) {
      console.error("Save Error:", error);
      toast.error(`Failed to save changes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return isNaN(date.getTime())
      ? dateString
      : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
  };



  const leaveTypes = ["Casual Leave", "Earned Leave", "UnPaid Leave"];

  const renderPendingLeavesTable = (data = []) => (
    <table className="min-w-full divide-y divide-slate-100">
      <thead className="sticky top-0 z-10 border-b bg-slate-50 border-slate-200">
        <tr>
          <th className="w-4 px-4 py-3 sm:px-6 sm:py-4"></th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={leaves.length > 0 && selectedIds.length === leaves.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
              />
              <span>Select All</span>
            </div>
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Status
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Employee ID
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Name
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            From
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            To
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Days
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Reason
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Leave Type
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            HOD Name
          </th>
          {showHodColumn && (
            <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
              HOD Remarks
            </th>
          )}
          {showHrColumn && (
            <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
              HR Remarks
            </th>
          )}
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-slate-100">
        {data.length > 0 ? (
          data.map((item, index) => (
            <tr key={index} className="transition-colors bg-yellow-50 hover:bg-yellow-100">
              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500"></div>
              </td>
              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                {((user?.is_hod &&
                  (item.status === "Pending" ||
                    item.status === "Pending HOD") &&
                  (item.hodName === user?.full_name ||
                    item.hodName === user?.Name)) ||
                  ((user?.role === "hr" ||
                    user?.role === "HR" ||
                    user?.role === "admin" ||
                    user?.role === "Admin" ||
                    user?.Admin === "Yes") &&
                    (item.status === "Pending HR" ||
                      item.status === "Pending" ||
                      item.status === "Pending HOD"))) && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => handleCheckboxChange(item.id, item)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
                    />
                  )}
              </td>
              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${item.status?.toString().toLowerCase().includes("approved")
                    ? "bg-green-100 text-green-800"
                    : item.status?.toString().toLowerCase().includes("rejected")
                      ? "bg-red-100 text-red-800"
                      : item.status === "Pending" || item.status === "Pending HOD"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                >
                  {item.status === "Pending" || item.status === "Pending HOD"
                    ? "Pending HOD"
                    : item.status?.includes("Rejected")
                      ? "Rejected"
                      : item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {item.employeeId}
              </td>
              <td className="px-4 py-3 text-sm font-medium sm:px-6 sm:py-4 whitespace-nowrap text-slate-900">
                <div className="flex flex-col">
                  <span>{item.employeeName}</span>
                  {rowQuotas[item.employeeId] ? (
                    <div className="flex gap-1.5 mt-1 text-[9px] font-bold uppercase tracking-tighter">
                      <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">
                        EL: {(rowQuotas[item.employeeId].earned_leave_limit || 24) - (rowQuotas[item.employeeId].earned_leave_used || 0)}
                      </span>
                      <span className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">
                        CL: {(rowQuotas[item.employeeId].casual_leave_limit || 12) - (rowQuotas[item.employeeId].casual_leave_used || 0)}
                      </span>
                      <span className="text-purple-700 bg-purple-50 px-1 py-0.5 rounded border border-purple-100">
                        CF: {rowQuotas[item.employeeId].carried_forward_el || 0}
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 mt-1 text-[9px] font-bold uppercase tracking-tighter opacity-60">
                      <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">EL: 24</span>
                      <span className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">CL: 12</span>
                      <span className="text-purple-700 bg-purple-50 px-1 py-0.5 rounded border border-purple-100">CF: 0</span>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-600">
                {(selectedRow?.id === item.id || (isHr && selectedIds.includes(item.id))) ? (
                  <input
                    type="date"
                    value={editableDates[item.id]?.from || ""}
                    onChange={(e) => handleDateChange(item.id, "from", e.target.value)}
                    className="p-1 text-sm border rounded border-slate-300"
                  />
                ) : (
                  formatDate(item.startDate)
                )}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-600">
                {(selectedRow?.id === item.id || (isHr && selectedIds.includes(item.id))) ? (
                  <input
                    type="date"
                    value={editableDates[item.id]?.to || ""}
                    onChange={(e) => handleDateChange(item.id, "to", e.target.value)}
                    className="p-1 text-sm border rounded border-slate-300"
                  />
                ) : (
                  formatDate(item.endDate)
                )}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                <div className="flex flex-col">
                  <span className="text-slate-700">
                    {(selectedRow?.id === item.id || (isHr && selectedIds.includes(item.id)))
                      ? calculateDays(editableDates[item.id]?.from, editableDates[item.id]?.to)
                      : item.days} days
                  </span>
                  {item.monthSplit && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="text-slate-400">↳</span> {item.monthSplit}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {item.reason}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {isHr && (item.status === "Pending HR" || item.status === "Pending" || item.status === "Pending HOD") && (selectedRow?.id === item.id || selectedIds.includes(item.id)) ? (
                  <div
                    className="relative flex flex-col gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[140px]"
                    onFocus={() => setActivePopupId(item.id)}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setActivePopupId(null);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">CL:</span>
                        <span className="text-[8px] text-indigo-600 font-black">
                          Rem: {(rowQuotas[item.employeeId]?.casual_leave_limit || 12) - (rowQuotas[item.employeeId]?.casual_leave_used || 0)}
                        </span>
                      </div>
                      <input
                        type="number"
                        value={leaveCounts[item.id]?.casual || 0}
                        onChange={(e) => handleCountChange(item.id, "casual", e.target.value)}
                        className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                        min="0"
                        step="1"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">EL:</span>
                        <span className="text-[8px] text-emerald-600 font-black">
                          Rem: {((rowQuotas[item.employeeId]?.earned_leave_limit || 24) - (rowQuotas[item.employeeId]?.earned_leave_used || 0)) + (rowQuotas[item.employeeId]?.carried_forward_el || 0)}
                        </span>
                      </div>
                      <input
                        type="number"
                        value={leaveCounts[item.id]?.earned || 0}
                        onChange={(e) => handleCountChange(item.id, "earned", e.target.value)}
                        className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                        min="0"
                        step="1"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">LOP:</span>
                      <input
                        type="number"
                        value={leaveCounts[item.id]?.unpaid || 0}
                        onChange={(e) => handleCountChange(item.id, "unpaid", e.target.value)}
                        className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                        min="0"
                        step="1"
                      />
                    </div>
                    <div className={`border-t border-slate-200 pt-1 mt-1 text-[10px] font-bold flex justify-between ${Math.abs(((leaveCounts[item.id]?.casual || 0) + (leaveCounts[item.id]?.earned || 0) + (leaveCounts[item.id]?.unpaid || 0)) - calculateDays(editableDates[item.id]?.from, editableDates[item.id]?.to)) > 0.01
                      ? "text-red-500"
                      : "text-green-600"
                      }`}>
                      <span>Total:</span>
                      <span>{((leaveCounts[item.id]?.casual || 0) + (leaveCounts[item.id]?.earned || 0) + (leaveCounts[item.id]?.unpaid || 0)).toFixed(0)} / {calculateDays(editableDates[item.id]?.from, editableDates[item.id]?.to)}</span>
                    </div>

                    {/* Leave Detail Popup (Inline) */}
                    {activePopupId === item.id && (() => {
                      const from = editableDates[item.id]?.from;
                      const to = editableDates[item.id]?.to;
                      const leaveType = item.leaveType;

                      if (!from || !to || !leaveType) return null;

                      let leaveWarning = null;
                      let leaveNote = null;

                      const appliedDays = calculateDays(from, to);
                      const targetDate = new Date(from);
                      const fyMonthIndex = targetDate.getMonth() >= 3 ? targetDate.getMonth() - 2 : targetDate.getMonth() + 10;

                      const maxAccEL = fyMonthIndex * 2;
                      const maxAccCL = fyMonthIndex * 1;

                      const quota = rowQuotas[item.employeeId] || {};
                      const usedEL = quota.earned_leave_used || 0;
                      const usedCL = quota.casual_leave_used || 0;
                      const carriedForwardEL = quota.carried_forward_el || 0;

                      const availableAccEL = Math.max(0, maxAccEL + carriedForwardEL - usedEL);
                      const availableAccCL = Math.max(0, maxAccCL - usedCL);

                      if (leaveType === 'UnPaid Leave') {
                        leaveWarning = `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। आपने LWP (बिना वेतन की छुट्टी) का चयन किया है। आपके पूरे ${appliedDays} दिन का वेतन काटा जाएगा।`;
                      } else {
                        const effectiveCL = Math.min(3, availableAccCL);
                        const maxPaidPossible = Math.min(10, effectiveCL + availableAccEL);
                        const totalAvailable = availableAccEL + availableAccCL;

                        if (appliedDays > maxPaidPossible) {
                          const lwpDays = appliedDays - maxPaidPossible;
                          if (totalAvailable > maxPaidPossible) {
                            leaveWarning = `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। आपके पास कुल ${totalAvailable} छुट्टियां (EL: ${availableAccEL}, CL: ${availableAccCL}) हैं, लेकिन आप एक बार में अधिकतम 10 दिन (जिसमें अधिकतम 3 CL शामिल हो सकते हैं) की ही सवेतन छुट्टी ले सकते हैं। अतः आपके अतिरिक्त ${lwpDays} दिन LWP (बिना वेतन) माने जाएंगे।`;
                          } else {
                            leaveWarning = `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। आपके पास केवल ${totalAvailable} छुट्टियां (EL: ${availableAccEL}, CL: ${availableAccCL}) उपलब्ध हैं। आपके अतिरिक्त ${lwpDays} दिन LWP (बिना वेतन) माने जाएंगे।`;
                          }
                        } else {
                          leaveNote = `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। आपके पास पर्याप्त छुट्टियां (कुल: ${totalAvailable} -> EL: ${availableAccEL}, CL: ${availableAccCL}) उपलब्ध हैं। आपके वेतन से कोई कटौती नहीं होगी।`;
                        }
                      }

                      if (leaveWarning) {
                        return (
                          <div className="absolute z-[60] bottom-full mb-2 left-1/2 -translate-x-1/2 w-[280px] sm:top-1/2 sm:-translate-y-1/2 sm:right-full sm:mr-3 sm:left-auto sm:translate-x-0 sm:bottom-auto sm:mb-0 sm:w-80 bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="flex gap-2 items-start">
                              <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                              <div>
                                <p className="text-xs font-bold text-rose-900 leading-snug">छुट्टी अलर्ट</p>
                                <p className="text-[10px] text-rose-700 mt-0.5 font-medium leading-relaxed whitespace-normal text-left">{leaveWarning}</p>
                              </div>
                            </div>
                          </div>
                        );
                      } else if (leaveNote) {
                        return (
                          <div className="absolute z-[60] bottom-full mb-2 left-1/2 -translate-x-1/2 w-[280px] sm:top-1/2 sm:-translate-y-1/2 sm:right-full sm:mr-3 sm:left-auto sm:translate-x-0 sm:bottom-auto sm:mb-0 sm:w-80 bg-emerald-50 border border-emerald-200 rounded-xl p-3 shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="flex gap-2 items-start">
                              <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                              <div>
                                <p className="text-xs font-bold text-emerald-900 leading-snug">छुट्टी विवरण</p>
                                <p className="text-[10px] text-emerald-700 mt-0.5 font-medium leading-relaxed whitespace-normal text-left">{leaveNote}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700">{item.leaveType}</span>
                    {(item.casual > 0 || item.earned > 0 || item.unpaid > 0) && (
                      <div className="flex gap-1.5 mt-1">
                        {item.casual > 0 && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold">CL: {item.casual}</span>}
                        {item.earned > 0 && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">EL: {item.earned}</span>}
                        {item.unpaid > 0 && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold">LOP: {item.unpaid}</span>}
                      </div>
                    )}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {item.hodName}
              </td>
              {showHodColumn && (
                <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                  {user?.is_hod &&
                    (item.status === "Pending" ||
                      item.status === "Pending HOD") &&
                    selectedRow?.id === item.id ? (
                    <input
                      type="text"
                      placeholder="HOD Remarks"
                      value={remarksInputs[item.id]?.hod || ""}
                      onChange={(e) =>
                        handleRemarkChange(item.id, "hod", e.target.value)
                      }
                      className="w-full min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    item.hodRemarks || "-"
                  )}
                </td>
              )}
              {showHrColumn && (
                <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                  {isHr &&
                    item.status === "Pending HR" &&
                    (selectedRow?.id === item.id || selectedIds.includes(item.id)) ? (
                    <input
                      type="text"
                      placeholder="HR Remarks"
                      value={remarksInputs[item.id]?.hr || ""}
                      onChange={(e) =>
                        handleRemarkChange(item.id, "hr", e.target.value)
                      }
                      className="w-full min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    item.hrRemarks || "-"
                  )}
                </td>
              )}
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                <div className="flex space-x-2">
                  {(user?.is_hod &&
                    (item.status === "Pending" ||
                      item.status === "Pending HOD") &&
                    (item.hodName === user?.full_name ||
                      item.hodName === user?.Name)) ||
                    ((user?.role === "hr" ||
                      user?.role === "HR" ||
                      user?.role === "admin" ||
                      user.role === "Admin" ||
                      user?.Admin === "Yes") &&
                      (item.status === "Pending HR" ||
                        item.status === "Pending" ||
                        item.status === "Pending HOD")) ? (
                    <>
                      <button
                        onClick={() => handleLeaveAction("accept", item)}
                        disabled={
                          !selectedIds.includes(item.id) || loading
                        }
                        className={`px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm ${!selectedIds.includes(item.id) || loading
                          ? "opacity-75 cursor-not-allowed"
                          : ""
                          }`}
                      >
                        {loading &&
                          actionInProgress === "accept" ? (
                          <span className="flex items-center">
                            <svg
                              className="w-3 h-3 mr-1 text-white animate-spin"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Accepting
                          </span>
                        ) : (
                          "Accept"
                        )}
                      </button>
                      <button
                        onClick={() => handleLeaveAction("rejected", item)}
                        disabled={!selectedIds.includes(item.id) || loading}
                        className={`px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm ${!selectedIds.includes(item.id) ||
                          (loading && actionInProgress === "accept")
                          ? "opacity-75 cursor-not-allowed"
                          : ""
                          }`}
                      >
                        {loading &&
                          actionInProgress === "rejected" ? (
                          <span className="flex items-center">
                            <svg
                              className="w-3 h-3 mr-1 text-white animate-spin"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Rejecting
                          </span>
                        ) : (
                          "Reject"
                        )}
                      </button>
                    </>
                  ) : // Fallback for HR when status is Pending (HOD has not approved yet)
                    (user?.role === "hr" ||
                      user?.role === "HR" ||
                      user?.role === "admin" ||
                      user?.role === "Admin" ||
                      user?.Admin === "Yes") &&
                      (item.status === "Pending" ||
                        item.status === "Pending HOD") ? (
                      <span className="text-xs italic font-medium text-orange-500">
                        Waiting for HOD
                      </span>
                    ) : (
                      <span className="text-xs italic text-slate-400">
                        {item.status === "Pending" ||
                          item.status === "Pending HOD"
                          ? "Waiting for HOD"
                          : item.status === "Pending HR"
                            ? "Waiting for HR"
                            : "-"}
                      </span>
                    )}
                </div>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={13} className="px-6 py-12 text-center text-slate-500">
              No pending leave requests found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderApprovedLeavesTable = (data = []) => (
    <table className="min-w-full divide-y divide-slate-100">
      <thead className="sticky top-0 z-10 border-b bg-slate-50 border-slate-200">
        <tr>
          <th className="w-4 px-4 py-3 sm:px-6 sm:py-4"></th>
          {isAdmin && (
            <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
              Actions
            </th>
          )}
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Status
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Employee ID
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Name
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            From
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            To
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Days
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Reason
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Leave Type
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            HOD Name
          </th>
          {showHodColumn && (
            <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
              HOD Key Remarks
            </th>
          )}
          {showHrColumn && (
            <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
              HR Key Remarks
            </th>
          )}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-slate-100">
        {data.length > 0 ? (
          data.map((item, index) => (
            <tr key={index} className={`transition-colors ${item.isActive ? 'bg-green-50 hover:bg-green-100' : 'bg-slate-50 hover:bg-slate-100'}`}>
              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                <div className={`h-2.5 w-2.5 rounded-full ${item.isActive ? 'bg-green-500' : 'bg-slate-400'}`}></div>
              </td>
              {isAdmin && (
                <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                  <div className="flex space-x-2">
                    {editingApprovedId === item.id ? (
                      <>
                        <button
                          onClick={() => handleSaveApproved(item)}
                          disabled={loading}
                          className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                          {loading ? "..." : "Save"}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={loading}
                          className="px-2 py-1 text-xs font-medium text-white bg-slate-500 rounded-lg hover:bg-slate-600 transition-colors shadow-sm disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEditApproved(item)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </td>
              )}
              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                  {item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {item.employeeId}
              </td>
              <td className="px-4 py-3 text-sm font-medium sm:px-6 sm:py-4 whitespace-nowrap text-slate-900">
                <div className="flex flex-col">
                  <span>{item.employeeName}</span>
                  {rowQuotas[item.employeeId] ? (
                    <div className="flex gap-1.5 mt-1 text-[9px] font-bold uppercase tracking-tighter">
                      <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">
                        EL: {(rowQuotas[item.employeeId].earned_leave_limit || 24) - (rowQuotas[item.employeeId].earned_leave_used || 0)}
                      </span>
                      <span className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">
                        CL: {(rowQuotas[item.employeeId].casual_leave_limit || 12) - (rowQuotas[item.employeeId].casual_leave_used || 0)}
                      </span>
                      <span className="text-purple-700 bg-purple-50 px-1 py-0.5 rounded border border-purple-100">
                        CF: {rowQuotas[item.employeeId].carried_forward_el || 0}
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 mt-1 text-[9px] font-bold uppercase tracking-tighter opacity-60">
                      <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">EL: 24</span>
                      <span className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">CL: 12</span>
                      <span className="text-purple-700 bg-purple-50 px-1 py-0.5 rounded border border-purple-100">CF: 0</span>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-600">
                {editingApprovedId === item.id ? (
                  <input
                    type="date"
                    value={tempApprovedData.startDate || ""}
                    onChange={(e) => setTempApprovedData({ ...tempApprovedData, startDate: e.target.value })}
                    className="p-1 text-sm border rounded border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  formatDate(item.startDate)
                )}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-600">
                {editingApprovedId === item.id ? (
                  <input
                    type="date"
                    value={tempApprovedData.endDate || ""}
                    onChange={(e) => setTempApprovedData({ ...tempApprovedData, endDate: e.target.value })}
                    className="p-1 text-sm border rounded border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  formatDate(item.endDate)
                )}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                <div className="flex flex-col">
                  <span className="text-slate-700">
                    {editingApprovedId === item.id
                      ? calculateDays(tempApprovedData.startDate, tempApprovedData.endDate)
                      : item.days} days
                  </span>
                  {item.monthSplit && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="text-slate-400">↳</span> {item.monthSplit}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {item.reason}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {editingApprovedId === item.id ? (
                  <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[140px]">
                    <select
                      value={tempApprovedData.leaveType}
                      onChange={(e) => setTempApprovedData({ ...tempApprovedData, leaveType: e.target.value })}
                      className="w-full mb-1 p-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                    >
                      {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">CL:</span>
                      <input
                        type="number"
                        value={tempApprovedData.casual}
                        onChange={(e) => setTempApprovedData({ ...tempApprovedData, casual: parseFloat(e.target.value) || 0 })}
                        className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                        min="0"
                        step="1"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">EL:</span>
                      <input
                        type="number"
                        value={tempApprovedData.earned}
                        onChange={(e) => setTempApprovedData({ ...tempApprovedData, earned: parseFloat(e.target.value) || 0 })}
                        className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                        min="0"
                        step="1"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">LOP:</span>
                      <input
                        type="number"
                        value={tempApprovedData.unpaid}
                        onChange={(e) => setTempApprovedData({ ...tempApprovedData, unpaid: parseFloat(e.target.value) || 0 })}
                        className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                        min="0"
                        step="1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700">{item.leaveType}</span>
                    {(item.casual > 0 || item.earned > 0 || item.unpaid > 0) && (
                      <div className="flex gap-1.5 mt-1">
                        {item.casual > 0 && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold">CL: {item.casual}</span>}
                        {item.earned > 0 && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">EL: {item.earned}</span>}
                        {item.unpaid > 0 && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold">LOP: {item.unpaid}</span>}
                      </div>
                    )}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {item.hodName}
              </td>
              {showHodColumn && (
                <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                  {item.hodRemarks || "-"}
                </td>
              )}
              {showHrColumn && (
                <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                  {item.hrRemarks || "-"}
                </td>
              )}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={isAdmin ? 14 : 13} className="px-6 py-12 text-center text-slate-500">
              No approved leave requests found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderRejectedLeavesTable = (data = []) => (
    <table className="min-w-full divide-y divide-slate-100">
      <thead className="sticky top-0 z-10 border-b bg-slate-50 border-slate-200">
        <tr>
          <th className="w-4 px-4 py-3 sm:px-6 sm:py-4"></th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Status
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Employee ID
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Name
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            From
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            To
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Days
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Reason
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            Leave Type
          </th>
          <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
            HOD Name
          </th>
          {showHodColumn && (
            <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
              HOD Key Remarks
            </th>
          )}
          {showHrColumn && (
            <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left uppercase sm:px-6 sm:py-4 text-slate-500">
              HR Key Remarks
            </th>
          )}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-slate-100">
        {data.length > 0 ? (
          data.map((item, index) => (
            <tr key={index} className="transition-colors bg-red-50 hover:bg-red-100">
              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500"></div>
              </td>
              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
                  {item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {item.employeeId}
              </td>
              <td className="px-4 py-3 text-sm font-medium sm:px-6 sm:py-4 whitespace-nowrap text-slate-900">
                {item.employeeName}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-600">
                {formatDate(item.startDate)}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-600">
                {formatDate(item.endDate)}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                <div className="flex flex-col">
                  <span className="text-slate-700">{item.days} days</span>
                  {item.monthSplit && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="text-slate-400">↳</span> {item.monthSplit}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {item.reason}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                <div className="flex flex-col">
                  <span className="font-medium text-slate-700">{item.leaveType}</span>
                  {(item.casual > 0 || item.earned > 0 || item.unpaid > 0) && (
                    <div className="flex gap-1.5 mt-1">
                      {item.casual > 0 && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold">CL: {item.casual}</span>}
                      {item.earned > 0 && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">EL: {item.earned}</span>}
                      {item.unpaid > 0 && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold">LOP: {item.unpaid}</span>}
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                {item.hodName}
              </td>
              {showHodColumn && (
                <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                  {item.hodRemarks || "-"}
                </td>
              )}
              {showHrColumn && (
                <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                  {item.hrRemarks || "-"}
                </td>
              )}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
              No rejected leave requests found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderPagination = () => {
    if (!hasNextPage && !isFetchingNextPage) return null;

    return (
      <div ref={ref} className="flex justify-center p-4">
        {isFetchingNextPage ? (
          <div className="w-8 h-8 border-b-2 border-indigo-600 rounded-full animate-spin"></div>
        ) : (
          <span className="text-sm text-slate-500">
            {hasNextPage ? "Loading more..." : "No more data"}
          </span>
        )}
      </div>
    );
  };

  const renderTable = () => {
    // Determine which data to show based on active tab
    // Since we filter on server, `leaves` is sufficient
    // passing `leaves` to all render functions is correct

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto custom-scrollbar">
          {activeTab === "pending" && renderPendingLeavesTable(leaves)}
          {activeTab === "approved" && renderApprovedLeavesTable(leaves)}
          {activeTab === "rejected" && renderRejectedLeavesTable(leaves)}

          {/* Sentinel for infinite scroll */}
          {renderPagination()}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden sm:gap-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">
            Leave Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage employee leave requests and history
          </p>
        </div>
        <div className="flex flex-col-2 gap-3 w-full md:flex-row md:w-auto md:items-center md:justify-end">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={handleAcceptAll}
                disabled={bulkLoading}
                className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
              >
                {bulkLoading ? (
                  <>
                    <svg className="w-4 h-4 mr-2 text-white animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Accepting ({selectedIds.length})
                  </>
                ) : (
                  <>
                    <Check size={18} className="mr-2" />
                    Accept All ({selectedIds.length})
                  </>
                )}
              </button>
              <button
                onClick={handleRejectAll}
                disabled={bulkLoading}
                className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
              >
                {bulkLoading ? (
                  <>
                    <svg className="w-4 h-4 mr-2 text-white animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Rejecting ({selectedIds.length})
                  </>
                ) : (
                  <>
                    <X size={18} className="mr-2" />
                    Reject All ({selectedIds.length})
                  </>
                )}
              </button>
            </>
          )}

        </div>
        <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto md:items-center">
          {activeTab === "approved" && isHr ? (
            <div className="flex items-center gap-1 p-1 border rounded-lg bg-emerald-50 border-emerald-200 shadow-sm overflow-hidden h-[42px]">
              <div className="flex items-center gap-1.5 px-2 border-r border-emerald-200 shrink-0">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-emerald-600 uppercase leading-none">From</span>
                  <input
                    type="date"
                    value={exportFromDate}
                    onChange={(e) => setExportFromDate(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-[10px] sm:text-xs font-bold text-emerald-800 cursor-pointer p-0 w-24 sm:w-28 h-4"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-emerald-600 uppercase leading-none">To</span>
                  <input
                    type="date"
                    value={exportToDate}
                    onChange={(e) => setExportToDate(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-[10px] sm:text-xs font-bold text-emerald-800 cursor-pointer p-0 w-24 sm:w-28 h-4"
                  />
                </div>
              </div>
              <button
                onClick={handleExportToExcel}
                disabled={exportLoading}
                className="inline-flex items-center justify-center px-2 py-1 text-[10px] sm:text-xs font-bold text-emerald-700 hover:text-emerald-900 transition-all disabled:opacity-50 group whitespace-nowrap"
                title="Export approved leaves for selected range"
              >
                {exportLoading ? (
                  <Clock size={12} className="mr-1 animate-spin text-emerald-600" />
                ) : (
                  <FileSpreadsheet
                    size={12}
                    className="mr-1 text-emerald-600 group-hover:scale-110 transition-transform"
                  />
                )}
                {exportLoading ? "..." : "Export"}
              </button>
            </div>
          ) : (
            <div className="hidden md:block"></div> // Spacer for grid if export hidden
          )}
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center px-3 py-2.5 border border-transparent rounded-lg shadow-sm text-xs sm:text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-[42px] whitespace-nowrap"
          >
            <Plus size={16} className="mr-1.5" />
            New Request
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
        {/* Tabs & Search */}
        <div className="flex flex-col justify-between gap-4 p-4 border-b border-slate-200 md:flex-row md:items-center shrink-0">
          <div className="flex items-center gap-2 p-1 overflow-x-auto border rounded-lg bg-slate-100/50 border-slate-200/50">
            {["pending", "approved", "rejected"].map((tab) => {
              const isActive = activeTab === tab;
              const count = countsData?.[tab] || 0;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${isActive
                    ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  <span
                    className={`ml-2 py-0.5 px-2 rounded-full text-xs ${isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "bg-slate-200 text-slate-600"
                      }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto md:flex-row md:items-center">
            {/* Status Legend */}
            <div className="flex items-center gap-3 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span className="text-xs font-medium text-slate-600">Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                <span className="text-xs font-medium text-slate-600">Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <span className="text-xs font-medium text-slate-600">Rejected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
                <span className="text-xs font-medium text-slate-600">Expired</span>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search employees..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 transition-all text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search
                size={16}
                className="absolute transform -translate-y-1/2 left-3 top-1/2 text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto custom-scrollbar flex flex-col">
          {tableLoading ? (
            <div className="flex items-center justify-center flex-1 h-64 text-center">
              <div className="w-10 h-10 border-b-2 border-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : errorMessage ? (
            <div className="px-6 py-20 text-center">
              <div className="inline-block p-4 mb-4 text-red-600 bg-red-50 rounded-xl">
                <p>{errorMessage}</p>
              </div>
              <br />
              <button
                onClick={fetchLeaveData}
                className="font-medium text-indigo-600 hover:text-indigo-800"
              >
                Try Again
              </button>
            </div>
          ) : (
            renderTable()
          )}
        </div>
      </div>

      {/* Modal for new leave request */}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 sm:p-6 transition-all duration-300">
            <div
              className="absolute inset-0 bg-transparent"
              onClick={() => setShowModal(false)}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 ring-1 ring-black/5">
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b sm:px-6 sm:py-4 border-slate-100 bg-white/80 backdrop-blur-md">
                <h3 className="text-lg font-semibold tracking-tight sm:text-xl text-slate-800">
                  New Leave Request
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 transition-colors rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto sm:p-6 scrollbar-thin">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Employee Selection Section */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold tracking-wide uppercase text-slate-500">
                        Select Employee (कर्मचारी चुनें){" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative group" ref={dropdownRef}>
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <User
                            size={18}
                            className="transition-colors text-slate-400 group-focus-within:text-indigo-500"
                          />
                        </div>
                        <input
                          type="text"
                          name="employeeName"
                          value={formData.employeeName}
                          onChange={(e) => {
                            handleInputChange(e);
                            setIsEmployeeDropdownOpen(true);
                          }}
                          onFocus={() => setIsEmployeeDropdownOpen(true)}
                          placeholder="Search or Select Employee..."
                          className="block w-full py-3 pl-10 pr-10 font-medium transition-all bg-white rounded-xl border-slate-200 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          autoComplete="off"
                          required
                        />
                        <div
                          className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                          onClick={() =>
                            setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)
                          }
                        >
                          <ChevronDown
                            size={16}
                            className={`text-slate-400 transition-transform duration-200 ${isEmployeeDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </div>

                        {/* Custom Dropdown List */}
                        {isEmployeeDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 overflow-y-auto duration-100 bg-white border shadow-xl rounded-xl border-slate-100 max-h-60 scrollbar-thin scrollbar-thumb-slate-200 animate-in fade-in zoom-in-95">
                            {employees.filter((emp) =>
                              emp.name
                                .toLowerCase()
                                .includes(formData.employeeName.toLowerCase()),
                            ).length > 0 ? (
                              employees
                                .filter((emp) =>
                                  emp.name
                                    .toLowerCase()
                                    .includes(
                                      formData.employeeName.toLowerCase(),
                                    ),
                                )
                                .map((employee) => (
                                  <div
                                    key={employee.id}
                                    className="flex items-center justify-between px-4 py-3 transition-colors border-b cursor-pointer hover:bg-indigo-50 border-slate-50 last:border-0 group/item"
                                    onClick={() => {
                                      handleEmployeeChange(employee.name);
                                      setIsEmployeeDropdownOpen(false);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium transition-colors text-slate-700 group-hover/item:text-indigo-700">
                                        {employee.name}
                                      </span>
                                      {employee.designation && (
                                        <span className="text-[10px] text-slate-400">
                                          {employee.designation}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md group-hover/item:bg-white transition-colors">
                                      {employee.id}
                                    </span>
                                  </div>
                                ))
                            ) : (
                              <div className="flex flex-col items-center px-4 py-8 text-center text-slate-400">
                                <Users size={24} className="mb-2 opacity-20" />
                                <p className="text-xs">
                                  No employees found matching "
                                  {formData.employeeName}"
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info Cards Grid */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                      {/* Employee ID Card */}
                      <div className="flex items-center gap-3 p-3 border bg-slate-50 rounded-xl border-slate-100">
                        <div className="flex items-center justify-center w-8 h-8 bg-white border rounded-full shadow-sm text-slate-500 border-slate-100 shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Emp ID
                          </p>
                          <p className="text-xs font-semibold break-words text-slate-900">
                            {formData.employeeId || "-"}
                          </p>
                        </div>
                      </div>

                      {/* HOD Card */}
                      {formData.hodId && (
                        <div className="flex items-center gap-3 p-3 border border-indigo-100 bg-indigo-50/50 rounded-xl">
                          <div className="flex items-center justify-center w-8 h-8 text-indigo-600 bg-white border border-indigo-100 rounded-full shadow-sm shrink-0">
                            <Users size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">
                              HOD
                            </p>
                            <p className="text-xs font-semibold break-words text-slate-900">
                              {formData.hodName || "-"}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* HR Card */}
                      <div className="flex items-center gap-3 p-3 border border-purple-100 bg-purple-50/50 rounded-xl">
                        <div className="flex items-center justify-center w-8 h-8 text-purple-600 bg-white border border-purple-100 rounded-full shadow-sm shrink-0">
                          <Shield size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-0.5">
                            HR
                          </p>
                          <p className="text-xs font-semibold break-words text-slate-900">
                            {formData.hrName || "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Leave Balances Grid */}
                    {formData.employeeId && (
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="p-2 text-center border rounded-xl border-emerald-100 bg-emerald-50 shadow-sm">
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mb-0.5 leading-none">EL Rem.</p>
                          <p className="text-sm font-bold text-emerald-700">{leaveBalances.earned.remaining}</p>
                        </div>
                        <div className="p-2 text-center border rounded-xl border-indigo-100 bg-indigo-50 shadow-sm">
                          <p className="text-[9px] font-black text-indigo-600 uppercase tracking-wider mb-0.5 leading-none">CL Rem.</p>
                          <p className="text-sm font-bold text-indigo-700">{leaveBalances.casual.remaining}</p>
                        </div>
                        <div className="p-2 text-center border rounded-xl border-purple-100 bg-purple-50 shadow-sm">
                          <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider mb-0.5 leading-none">CF EL</p>
                          <p className="text-sm font-bold text-purple-700">{leaveBalances.carriedForward}</p>
                        </div>
                      </div>
                    )}
                  </div>


                  {/* Leave Type */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold tracking-wide uppercase text-slate-500">
                      Leave Type (छुट्टी के प्रकार){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <FileText
                          size={18}
                          className="transition-colors text-slate-400 group-focus-within:text-indigo-500"
                        />
                      </div>
                      <select
                        name="leaveType"
                        value={formData.leaveType}
                        onChange={handleInputChange}
                        className="block w-full py-3 pl-10 pr-10 font-medium transition-all bg-white appearance-none rounded-xl border-slate-200 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        required
                      >
                        <option value="">Select Leave Type</option>
                        <option
                          value="Casual Leave"
                          disabled={leaveBalances.casual.remaining <= 0}
                        >
                          Casual Leave {leaveBalances.casual.remaining <= 0 ? '(Quota Exhausted)' : `(${leaveBalances.casual.remaining} remaining)`}
                        </option>
                        <option
                          value="Earned Leave"
                          disabled={leaveBalances.earned.remaining <= 0 && leaveBalances.carriedForward <= 0}
                        >
                          Earned Leave {(leaveBalances.earned.remaining <= 0 && leaveBalances.carriedForward <= 0) ? '(Quota Exhausted)' : `(${leaveBalances.earned.remaining + leaveBalances.carriedForward} remaining)`}
                        </option>
                        <option value="UnPaid Leave">UnPaid Leave (No Limit)</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <ChevronDown size={16} className="text-slate-400" />
                      </div>
                    </div>
                    {/* Show warning if selected leave type has low balance */}
                    {formData.leaveType === 'Casual Leave' && leaveBalances.casual.remaining > 0 && leaveBalances.casual.remaining <= 2 && (
                      <p className="mt-1 text-xs text-orange-600 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Low balance: Only {leaveBalances.casual.remaining} casual leave(s) remaining
                      </p>
                    )}
                  </div>

                  {/* Dates & Duration */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold tracking-wide uppercase text-slate-500">
                          From Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          name="fromDate"
                          value={formData.fromDate}
                          onChange={(e) => {
                            const newFrom = e.target.value;
                            if (
                              formData.toDate &&
                              new Date(newFrom) > new Date(formData.toDate)
                            ) {
                              toast.error(
                                "Start date cannot be after end date",
                              );
                              setFormData((prev) => ({
                                ...prev,
                                fromDate: newFrom,
                                toDate: "",
                              }));
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                fromDate: newFrom,
                              }));
                            }
                          }}
                          className="block w-full rounded-xl border-slate-200 py-2.5 px-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-600 sm:text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold tracking-wide uppercase text-slate-500">
                          To Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          name="toDate"
                          value={formData.toDate}
                          min={formData.fromDate}
                          onChange={(e) => {
                            const newTo = e.target.value;
                            if (
                              formData.fromDate &&
                              new Date(newTo) < new Date(formData.fromDate)
                            ) {
                              toast.error(
                                "End date cannot be earlier than start date",
                              );
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                toDate: newTo,
                              }));
                            }
                          }}
                          className="block w-full rounded-xl border-slate-200 py-2.5 px-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-600 sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    {(() => {
                      let leaveWarning = null;
                      let leaveNote = null;

                      if (formData.fromDate && formData.toDate && formData.leaveType) {
                        const appliedDays = calculateDays(formData.fromDate, formData.toDate);
                        const targetDate = new Date(formData.fromDate);
                        const fyMonthIndex = targetDate.getMonth() >= 3 ? targetDate.getMonth() - 2 : targetDate.getMonth() + 10;

                        const maxAccEL = fyMonthIndex * 2;
                        const maxAccCL = fyMonthIndex * 1;

                        const usedEL = leaveBalances.earned.used || 0;
                        const usedCL = leaveBalances.casual.used || 0;
                        const carriedForwardEL = leaveBalances.carriedForward || 0;

                        const availableAccEL = Math.max(0, maxAccEL + carriedForwardEL - usedEL);
                        const availableAccCL = Math.max(0, maxAccCL - usedCL);

                        if (formData.leaveType === 'UnPaid Leave') {
                          leaveWarning = `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। आपने LWP (बिना वेतन की छुट्टी) का चयन किया है। आपके पूरे ${appliedDays} दिन का वेतन काटा जाएगा।`;
                        } else {
                          const effectiveCL = Math.min(3, availableAccCL);
                          const maxPaidPossible = Math.min(10, effectiveCL + availableAccEL);
                          const totalAvailable = availableAccEL + availableAccCL;

                          if (appliedDays > maxPaidPossible) {
                            const lwpDays = appliedDays - maxPaidPossible;
                            if (totalAvailable > maxPaidPossible) {
                              leaveWarning = `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। आपके पास कुल ${totalAvailable} छुट्टियां (EL: ${availableAccEL}, CL: ${availableAccCL}) हैं, लेकिन आप एक बार में अधिकतम 10 दिन (जिसमें अधिकतम 3 CL शामिल हो सकते हैं) की ही सवेतन छुट्टी ले सकते हैं। अतः आपके अतिरिक्त ${lwpDays} दिन LWP (बिना वेतन) माने जाएंगे।`;
                            } else {
                              leaveWarning = `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। आपके पास केवल ${totalAvailable} छुट्टियां (EL: ${availableAccEL}, CL: ${availableAccCL}) उपलब्ध हैं। आपके अतिरिक्त ${lwpDays} दिन LWP (बिना वेतन) माने जाएंगे।`;
                            }
                          } else {
                            leaveNote = `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। आपके पास पर्याप्त छुट्टियां (कुल: ${totalAvailable} -> EL: ${availableAccEL}, CL: ${availableAccCL}) उपलब्ध हैं। आपके वेतन से कोई कटौती नहीं होगी।`;
                          }
                        }
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

                    {/* Duration Display */}
                    <div className="flex items-center justify-between p-3 border border-indigo-100 bg-indigo-50 rounded-xl mt-4">
                      <span className="text-sm font-medium text-indigo-900">
                        Total Duration:
                      </span>
                      <span className="text-sm font-bold text-indigo-700">
                        {formData.fromDate && formData.toDate
                          ? `${calculateDays(formData.fromDate, formData.toDate)} Days`
                          : "0 Days"}
                      </span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold tracking-wide uppercase text-slate-500">
                      Reason (कारण) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute pointer-events-none top-3 left-3">
                        <FileText
                          size={18}
                          className="transition-colors text-slate-400 group-focus-within:text-indigo-500"
                        />
                      </div>
                      <textarea
                        name="reason"
                        value={formData.reason}
                        onChange={handleInputChange}
                        rows={3}
                        className="block w-full py-3 pl-10 font-medium transition-all bg-white resize-none rounded-xl border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
                        placeholder="Please provide reason for leave..."
                        required
                      />
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex justify-end pt-6 mt-4 space-x-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`px-8 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 ${submitting ? "opacity-70 cursor-not-allowed transform-none" : ""}`}
                    >
                      {submitting ? "Submitting..." : "Submit Request"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default LeaveManagement;

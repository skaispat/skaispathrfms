import React, { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";
import { createPortal } from "react-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import {
  Search,
  X,
  Check,
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
  const isHr =
    user?.role === "hr" ||
    user?.role === "HR" ||
    user?.role === "admin" ||
    user?.role === "Admin" ||
    user?.Admin === "Yes";
  const isHod = user?.is_hod;
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
  const [editableDates, setEditableDates] = useState({ from: "", to: "" });
  const [leaveCounts, setLeaveCounts] = useState({ casual: 0, earned: 0, unpaid: 0 });
  const [remarksInputs, setRemarksInputs] = useState({});
  const [exportLoading, setExportLoading] = useState(false);

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

  const handleCheckboxChange = (leaveId, rowData) => {
    if (selectedRow?.id === leaveId) {
      setSelectedRow(null);
      setEditableDates({ from: "", to: "" });
      setLeaveCounts({ casual: 0, earned: 0, unpaid: 0 });
    } else {
      // Convert DD/MM/YYYY to YYYY-MM-DD for date input
      const formatForInput = (dateStr) => {
        if (!dateStr) return "";
        // Check if dateStr is already in YYYY-MM-DD
        if (dateStr.includes("-")) return dateStr;

        const [day, month, year] = dateStr.split("/");
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      };

      setSelectedRow(rowData);
      const from = formatForInput(rowData.startDate);
      const to = formatForInput(rowData.endDate);
      setEditableDates({
        from: from,
        to: to,
      });

      // Initialize counts based on current leaveType and days
      const days = calculateDays(from, to);
      const initialCounts = { casual: 0, earned: 0, unpaid: 0 };
      if (rowData.leaveType === "Casual Leave") initialCounts.casual = days;
      else if (rowData.leaveType === "Earned Leave") initialCounts.earned = days;
      else if (rowData.leaveType === "UnPaid Leave") initialCounts.unpaid = days;

      setLeaveCounts(initialCounts);
    }
  };

  const handleDateChange = (field, value) => {
    setEditableDates((prev) => {
      const newDates = {
        ...prev,
        [field]: value,
      };

      // Recalculate and reset counts when dates change
      const days = calculateDays(newDates.from, newDates.to);
      const initialCounts = { casual: 0, earned: 0, unpaid: 0 };
      if (selectedRow?.leaveType === "Casual Leave") initialCounts.casual = days;
      else if (selectedRow?.leaveType === "Earned Leave") initialCounts.earned = days;
      else if (selectedRow?.leaveType === "UnPaid Leave") initialCounts.unpaid = days;

      setLeaveCounts(initialCounts);
      return newDates;
    });
  };

  const handleCountChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    setLeaveCounts((prev) => ({
      ...prev,
      [field]: numValue,
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
          unpaid: { used: balanceData.unpaid_leave_total_taken ?? 0 }
        });
      } else {
        // Reset to defaults if no data found (or handle as 0 used)
        setLeaveBalances({
          casual: { total: 12, used: 0, remaining: 12 },
          earned: { total: 24, used: 0, remaining: 24 },
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

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error: queryError,
    refetch
  } = useInfiniteQuery({
    queryKey: ["leaves", user?.emp_id, activeTab, searchTerm],
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
    refetch();
  };

  const leaves = data?.pages.flatMap((page) => page.data) || [];

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
        serial_no: null, // As specified in schema, integer
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

  const handleLeaveAction = async (action) => {
    if (!selectedRow) {
      toast.error("Please select a leave request");
      return;
    }

    setActionInProgress(action);
    setLoading(true);

    try {
      // Determine new status and notification message
      let newStatus = "";
      let notificationMessage = "";
      const currentStatus = selectedRow.status;

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
          // Allow HR/Admin to override HOD step if needed, or strictly HOD?
          // Strictly speaking, if user is HOD for this request
          // For now, allow if isHod or Admin
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
        // Should not happen if buttons are hidden
        throw new Error("Invalid status transition.");
      }

      // Prepare update data
      const currentRowRemarks = remarksInputs[selectedRow.id] || {};

      const updateData = {
        timestamp: new Date().toISOString(), // Update timestamp
        leave_date_start:
          editableDates.from && editableDates.from !== selectedRow.startDate
            ? editableDates.from
            : selectedRow.startDate,
        leave_date_end:
          editableDates.to && editableDates.to !== selectedRow.endDate
            ? editableDates.to
            : selectedRow.endDate,
        status: newStatus,
        casual: leaveCounts.casual,
        earned: leaveCounts.earned,
        unpaid: leaveCounts.unpaid,
        ...(isHod && {
          hod_remarks: currentRowRemarks.hod || "",
          hod_id: user.emp_id,
          hod_name: user.full_name || user.Name,
        }),
        ...(isHr && {
          hr_remarks: currentRowRemarks.hr || "",
          hr_id: user.emp_id,
          hr_name: user.full_name || user.Name,
        }),
      };

      // Update the leave request in Supabase
      const { error: updateError } = await supabase
        .from("leave_management")
        .update(updateData)
        .eq("id", selectedRow.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update Log
      const logUpdate = {
        status: newStatus,
        ...(isHod && {
          hod_name: user.full_name || user.Name,
          hod_id: user.emp_id,
          hod_action: action === "accept" ? "Approved" : "Rejected",
          hod_approval_time: new Date().toISOString(),
          hod_remarks: currentRowRemarks.hod || "",
        }),
        ...(isHr && {
          hr_name: user.full_name || user.Name,
          hr_id: user.emp_id,
          hr_action: action === "accept" ? "Approved" : "Rejected",
          hr_approval_time: new Date().toISOString(), // Fixed typo from code view
          hr_remarks: currentRowRemarks.hr || "",
        }),
      };
      await supabase
        .from("logs")
        .update(logUpdate)
        .eq("request_id", selectedRow.id)
        .eq("request_type", "Leave");

      // Update yearly_quota when leave is approved
      if (newStatus === "Approved") {
        console.log("=== LEAVE APPROVED - Starting quota update ===");

        const currentYear = getFiscalYear();
        const employeeId = selectedRow.employeeId;

        // Update quota for each leave type that has a balance used
        const updates = [
          { type: "Casual", count: leaveCounts.casual, column: "casual_leave_used" },
          { type: "Earned", count: leaveCounts.earned, column: "earned_leave_used" },
          { type: "UnPaid", count: leaveCounts.unpaid, column: "unpaid_leave_used" }
        ].filter(u => u.count > 0);

        for (const update of updates) {
          const { count, column } = update;
          console.log(`Processing ${update.type} quota update: ${count} days`);

          try {
            const { data: existingQuota, error: quotaCheckError } = await supabase
              .from("yearly_quota")
              .select("*")
              .eq("emp_id", employeeId)
              .eq("year", currentYear)
              .maybeSingle();

            if (quotaCheckError) {
              console.error("Error checking yearly quota:", quotaCheckError);
              toast.error(`Failed to check ${update.type} quota: ` + quotaCheckError.message);
              continue;
            }

            if (existingQuota) {
              const currentUsed = existingQuota[column] || 0;
              const newUsed = currentUsed + count;
              await supabase
                .from("yearly_quota")
                .update({ [column]: newUsed })
                .eq("id", existingQuota.id);
              console.log(`Updated existing yearly_quota: ${column} to ${newUsed}`);
            } else {
              const insertPayload = {
                emp_id: employeeId,
                year: currentYear,
                casual_leave_used: update.type === "Casual" ? count : 0,
                earned_leave_used: update.type === "Earned" ? count : 0,
                unpaid_leave_used: update.type === "UnPaid" ? count : 0,
                casual_leave_limit: 12,
                earned_leave_limit: 24,
              };
              await supabase.from("yearly_quota").insert(insertPayload);
              console.log("Created new yearly_quota record");
            }
          } catch (err) {
            console.error(`Quota update error for ${update.type}:`, err);
          }
        }
        console.log("=== LEAVE QUOTA UPDATE COMPLETE ===");
      }

      toast.success(
        `Leave ${notificationMessage} for ${selectedRow.employeeName || "employee"}`,
      );

      // Trigger WhatsApp Notifications (Non-blocking)
      (async () => {
        try {
          const leaveDays = calculateDays(
            editableDates.from || selectedRow.startDate,
            editableDates.to || selectedRow.endDate
          );

          const mdNumber = import.meta.env.VITE_MD_MOBILE_NUMBER;
          const specialEmpIds = ["1", "175", "53", "219", "3", "233", "245", "341", "16", "294", "217", "152", "527", "501", "235", "504", "180", "321", "519", "242", "246", "518"]; // Target Employee IDs for MD notification

          if (newStatus === "Pending HR") {
            // HOD Approved -> Notify HR
            console.log("📤 Sending WhatsApp notification to HR...");
            await sendWhatsappMessageToHr({
              employeId: selectedRow.employeeId,
              empId: selectedRow.employeeId,
              tableid: selectedRow.id,
              employeeName: selectedRow.employeeName,
              leaveType: selectedRow.leaveType,
              fromDate: formatDate(editableDates.from || selectedRow.startDate),
              toDate: formatDate(editableDates.to || selectedRow.endDate),
              totalDays: leaveDays,
              reason: selectedRow.reason,
            });
          } else if (newStatus === "Approved") {
            // HR Approved -> Notify Employee
            console.log("📤 Sending Approval WhatsApp to Employee...");
            await sendApprovedMessageToEmployee({
              employeePhone: selectedRow.employeePhone,
              employeeName: selectedRow.employeeName,
              leaveType: selectedRow.leaveType,
              fromDate: formatDate(editableDates.from || selectedRow.startDate),
              toDate: formatDate(editableDates.to || selectedRow.endDate),
              totalDays: leaveDays,
              reason: selectedRow.reason,
            });

            // Also notify MD for special employees
            if (specialEmpIds.includes(String(selectedRow.employeeId))) {
              console.log("👑 Sending Approval WhatsApp to MD Sir...");
              await sendApprovedMessageToEmployee({
                employeePhone: mdNumber,
                employeeName: `${selectedRow.employeeName} (Employee ID: ${selectedRow.employeeId})`,
                leaveType: selectedRow.leaveType,
                fromDate: formatDate(editableDates.from || selectedRow.startDate),
                toDate: formatDate(editableDates.to || selectedRow.endDate),
                totalDays: leaveDays,
                reason: selectedRow.reason,
              });
            }
          } else if (newStatus === "Rejected") {
            // Rejected -> Notify Employee
            console.log("📤 Sending Rejection WhatsApp to Employee...");
            await sendRejectedMessageToEmployee({
              employeePhone: selectedRow.employeePhone,
              employeeName: selectedRow.employeeName,
              leaveType: selectedRow.leaveType,
              fromDate: formatDate(editableDates.from || selectedRow.startDate),
              toDate: formatDate(editableDates.to || selectedRow.endDate),
              totalDays: leaveDays,
              hrRemarks: currentRowRemarks.hr || currentRowRemarks.hod || "Decision by management",
            });

            // Also notify MD for special employees
            if (specialEmpIds.includes(String(selectedRow.employeeId))) {
              console.log("👑 Sending Rejection WhatsApp to MD Sir...");
              await sendRejectedMessageToEmployee({
                employeePhone: mdNumber,
                employeeName: `${selectedRow.employeeName} (Employee ID: ${selectedRow.employeeId})`,
                leaveType: selectedRow.leaveType,
                fromDate: formatDate(editableDates.from || selectedRow.startDate),
                toDate: formatDate(editableDates.to || selectedRow.endDate),
                totalDays: leaveDays,
                hrRemarks: currentRowRemarks.hr || currentRowRemarks.hod || "Decision by management",
              });
            }
          }
        } catch (waError) {
          console.error("⚠️ WhatsApp notification failed:", waError);
        }
      })();

      fetchLeaveData();
      setSelectedRow(null);
      setEditableDates({ from: "", to: "" });
    } catch (error) {
      console.error("Update error:", error);
      toast.error(`Failed to update leave: ${error.message}`);
    } finally {
      setLoading(false);
      setActionInProgress(null);
    }
  };

  const handleExportToExcel = async () => {
    try {
      setExportLoading(true);

      const startOfCurrentMonth = dayjs().startOf('month').format('YYYY-MM-DD');
      const endOfCurrentMonth = dayjs().endOf('month').format('YYYY-MM-DD');

      // Fetch all approved leaves for the current month
      const { data, error } = await supabase
        .from('leave_management')
        .select('*')
        .eq('status', 'Approved')
        .gte('leave_date_start', startOfCurrentMonth)
        .lte('leave_date_start', endOfCurrentMonth)
        .order('leave_date_start', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('No approved leaves found for the current month');
        return;
      }

      // Format data for Excel
      const excelData = data.map(item => ({
        'Employee ID': item.emp_id,
        'Employee Name': item.employee_name,
        'Designation': item.designation || '-',
        'Leave Type': item.leave_type,
        'From Date': item.leave_date_start ? dayjs(item.leave_date_start).format('DD/MM/YYYY') : '-',
        'To Date': item.leave_date_end ? dayjs(item.leave_date_end).format('DD/MM/YYYY') : '-',
        'Total Days': calculateDays(item.leave_date_start, item.leave_date_end),
        'Reason': item.remarks,
        'HOD Name': item.hod_name,
        'HOD Remarks': item.hod_remarks || '-',
        'HR Name': item.hr_name || '-',
        'HR Remarks': item.hr_remarks || '-',
        'Approved At': item.timestamp ? dayjs(item.timestamp).format('DD/MM/YYYY hh:mm A') : '-'
      }));

      // Create sheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better readability
      const wscols = [
        { wch: 15 }, // Emp ID
        { wch: 25 }, // Name
        { wch: 20 }, // Designation
        { wch: 15 }, // Leave Type
        { wch: 12 }, // From
        { wch: 12 }, // To
        { wch: 10 }, // Days
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
      const fileName = `Approved_Leaves_${dayjs().format('MMM_YYYY')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success(`Exported ${data.length} records successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export to Excel: ' + error.message);
    } finally {
      setExportLoading(false);
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
            Select
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
                      checked={selectedRow?.id === item.id}
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
                {item.employeeName}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-600">
                {selectedRow?.id === item.id ? (
                  <input
                    type="date"
                    value={editableDates.from}
                    onChange={(e) => handleDateChange("from", e.target.value)}
                    className="p-1 text-sm border rounded border-slate-300"
                  />
                ) : (
                  formatDate(item.startDate)
                )}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-600">
                {selectedRow?.id === item.id ? (
                  <input
                    type="date"
                    value={editableDates.to}
                    onChange={(e) => handleDateChange("to", e.target.value)}
                    className="p-1 text-sm border rounded border-slate-300"
                  />
                ) : (
                  formatDate(item.endDate)
                )}
              </td>
              <td className="px-4 py-3 text-sm sm:px-6 sm:py-4 whitespace-nowrap text-slate-500">
                <div className="flex flex-col">
                  <span className="text-slate-700">
                    {selectedRow?.id === item.id
                      ? calculateDays(editableDates.from, editableDates.to)
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
                {isHr && (item.status === "Pending HR" || item.status === "Pending" || item.status === "Pending HOD") && selectedRow?.id === item.id ? (
                  <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 min-w-[140px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">CL:</span>
                      <input
                        type="number"
                        value={leaveCounts.casual}
                        onChange={(e) => handleCountChange("casual", e.target.value)}
                        className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                        min="0"
                        step="1"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">EL:</span>
                      <input
                        type="number"
                        value={leaveCounts.earned}
                        onChange={(e) => handleCountChange("earned", e.target.value)}
                        className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                        min="0"
                        step="1"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">LOP:</span>
                      <input
                        type="number"
                        value={leaveCounts.unpaid}
                        onChange={(e) => handleCountChange("unpaid", e.target.value)}
                        className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                        min="0"
                        step="1"
                      />
                    </div>
                    <div className={`border-t border-slate-200 pt-1 mt-1 text-[10px] font-bold flex justify-between ${Math.abs((leaveCounts.casual + leaveCounts.earned + leaveCounts.unpaid) - calculateDays(editableDates.from, editableDates.to)) > 0.01
                      ? "text-red-500"
                      : "text-green-600"
                      }`}>
                      <span>Total:</span>
                      <span>{(leaveCounts.casual + leaveCounts.earned + leaveCounts.unpaid).toFixed(0)} / {calculateDays(editableDates.from, editableDates.to)}</span>
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
                    selectedRow?.id === item.id ? (
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
                        onClick={() => handleLeaveAction("accept")}
                        disabled={
                          !selectedRow || selectedRow.id !== item.id || loading
                        }
                        className={`px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm ${!selectedRow || selectedRow.id !== item.id || loading
                          ? "opacity-75 cursor-not-allowed"
                          : ""
                          }`}
                      >
                        {loading &&
                          selectedRow?.id === item.id &&
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
                        onClick={() => handleLeaveAction("rejected")}
                        disabled={selectedRow?.id !== item.id || loading}
                        className={`px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm ${selectedRow?.id !== item.id ||
                          (loading && actionInProgress === "accept")
                          ? "opacity-75 cursor-not-allowed"
                          : ""
                          }`}
                      >
                        {loading &&
                          selectedRow?.id === item.id &&
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
              <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
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
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-slate-900">
            Leave Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage employee leave requests and history
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full md:w-auto"
        >
          <Plus size={18} className="mr-2" />
          New Leave Request
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
        {/* Tabs & Search */}
        <div className="flex flex-col justify-between gap-4 p-4 border-b border-slate-200 md:flex-row md:items-center shrink-0">
          <div className="flex items-center gap-2 p-1 overflow-x-auto border rounded-lg bg-slate-100/50 border-slate-200/50">
            {["pending", "approved", "rejected"].map((tab) => {
              const isActive = activeTab === tab;
              const count = activeTab === tab ? leaves.length : 0;
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
            {/* Export Button for HR/Admin on Approved Tab */}
            {activeTab === "approved" && isHr && (
              <button
                onClick={handleExportToExcel}
                disabled={exportLoading}
                className="inline-flex items-center justify-center px-4 py-2 border border-green-200 rounded-lg shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 hover:text-green-800 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed group"
                title="Export current month's approved leaves to Excel"
              >
                {exportLoading ? (
                  <Clock size={18} className="mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet size={18} className="mr-2 text-green-600 group-hover:scale-110 transition-transform" />
                )}
                {exportLoading ? "Exporting..." : "Export Current Month"}
              </button>
            )}

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
                          disabled={leaveBalances.earned.remaining <= 0}
                        >
                          Earned Leave {leaveBalances.earned.remaining <= 0 ? '(Quota Exhausted)' : `(${leaveBalances.earned.remaining} remaining)`}
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

                    {/* Duration Display */}
                    <div className="flex items-center justify-between p-3 border border-indigo-100 bg-indigo-50 rounded-xl">
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

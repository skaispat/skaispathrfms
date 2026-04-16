import React, { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { createPortal } from 'react-dom';
import { Search, X, Check, Clock, Calendar, Plus, User, Briefcase, FileText, Users, ChevronDown, MapPin, Phone, Image as ImageIcon, Shield, CheckCircle, Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import useAuthStore from '../store/authStore';
import {
  sendGatePassMessageToHr,
  sendGatePassApprovedToEmployee,
  sendGatePassRejectedToEmployee,
  sendGatePassHodRejectedToEmployee
} from '../whatsappMessageSender/sendGatePassWhatsapp';

const GatePass = () => {
  const { user } = useAuthStore();
  const isHr = user?.role === 'hr' || user?.role === 'HR' || user?.role === 'admin' || user?.role === 'Admin' || user?.Admin === 'Yes';
  const isHod = user?.is_hod;
  const showHrColumn = isHr || (!isHod && !isHr);
  const showHodColumn = (isHod && !isHr) || (!isHod && !isHr);

  const [searchTerm, setSearchTerm] = useState('');
  const [pendingPasses, setPendingPasses] = useState([]);
  const [approvedPasses, setApprovedPasses] = useState([]);
  const [rejectedPasses, setRejectedPasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionInProgress, setActionInProgress] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [remarksInputs, setRemarksInputs] = useState({});
  const [exportLoading, setExportLoading] = useState(false);

  const handleRemarkChange = (id, field, value) => {
    setRemarksInputs(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  // New Request Modal State
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
    employeeId: '',
    employeeName: '',
    hodId: '',
    hodName: '',
    hrId: '',
    hrName: '',
    visitPlace: '',
    visitReason: '',
    departureTime: '',
    arrivalTime: '',
    whatsappNumber: '',
    gatePassImage: null
  });

  useEffect(() => {
    if (user) {
      fetchGatePassData();
      fetchEmployees();
    }
  }, [user]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('emp_id, full_name, phone_number');

      if (error) throw error;

      if (data) {
        setEmployees(data.map(e => ({
          id: e.emp_id,
          name: e.full_name,
          phone: e.phone_number
        })).filter(e => e.id && e.name));
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleEmployeeChange = async (selectedName) => {
    const selectedEmployee = employees.find(emp => emp.name === selectedName);

    setFormData(prev => ({
      ...prev,
      employeeName: selectedName,
      employeeId: selectedEmployee ? selectedEmployee.id : '',
      whatsappNumber: selectedEmployee ? selectedEmployee.phone : '',
      hodName: '',
      hodId: ''
    }));

    if (selectedEmployee?.id) {
      try {
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('hod_id')
          .eq('emp_id', selectedEmployee.id)
          .maybeSingle();

        if (teamMember?.hod_id) {
          const { data: hodUser } = await supabase
            .from('users')
            .select('full_name')
            .eq('emp_id', teamMember.hod_id)
            .single();

          if (hodUser) {
            setFormData(prev => ({ ...prev, hodName: hodUser.full_name, hodId: teamMember.hod_id }));
          } else {
            setFormData(prev => ({ ...prev, hodName: '', hodId: null }));
          }
        } else {
          // No HOD assigned in team_members
          setFormData(prev => ({ ...prev, hodName: '', hodId: null }));
        }

        // Fetch HR Details
        const { data: hrData } = await supabase
          .from('users')
          .select('full_name, emp_id')
          .eq('department', 'HR')
          .order('is_hod', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (hrData) {
          setFormData(prev => ({ ...prev, hrName: hrData.full_name, hrId: hrData.emp_id }));
        } else {
          setFormData(prev => ({ ...prev, hrName: 'Pawan Tiwari', hrId: 1 }));
        }
      } catch (error) {
        console.error('Error fetching HOD/HR:', error);
      }
    }
  };

  const handleCheckboxChange = (leaveId, rowData) => {
    if (selectedRow?.id === leaveId) {
      setSelectedRow(null);
    } else {
      setSelectedRow(rowData);
    }
  };

  const fetchGatePassData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('gate_pass')
        .select('*, users(full_name, phone_number, emp_id)')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const enrichedData = data.map(item => ({
        ...item,
        employee_name: item.users?.full_name || item.emp_id
      }));

      // Filter based on Role
      const isHr = user?.role === 'hr' || user?.role === 'HR' || user?.role === 'admin' || user?.role === 'Admin' || user?.Admin === 'Yes';
      const isHod = user?.is_hod;
      const userName = user?.full_name || user?.Name;

      const filteredData = enrichedData.filter(item => {
        if (isHr) return true;
        if (isHod) {
          // View requests where I am HOD OR it is my own request
          return (item.hod_name?.toLowerCase() === userName?.toLowerCase()) || (item.emp_id === user?.emp_id);
        }
        return item.emp_id === user?.emp_id;
      });

      setPendingPasses(filteredData.filter(p => p.status === 'Pending' || p.status === 'Pending HOD' || p.status === 'Pending HR'));

      // Approved tab should show any pass that has been approved by HOD or is fully Approved
      setApprovedPasses(filteredData.filter(p =>
        p.status?.toLowerCase() === 'approved' ||
        p.status === 'Pending HR' // Show acts approved by HOD, pending HR in approved list for HOD
      ));

      setRejectedPasses(filteredData.filter(p => p.status?.toLowerCase().includes('rejected')));

    } catch (error) {
      console.error('Error fetching gate pass data:', error);
      setError(error.message);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  const handleAction = async (action, request) => {
    // Determine new status
    let newStatus = '';
    const currentStatus = request.status;
    const isHr = user?.role === 'hr' || user?.role === 'HR' || user?.role === 'admin' || user?.role === 'Admin' || user?.Admin === 'Yes';
    const isHod = user?.is_hod;

    // Authorization Check & Status Transition
    if (action === 'reject') {
      newStatus = 'Rejected';
    } else {
      // Approve logic
      if (currentStatus === 'Pending' || currentStatus === 'Pending HOD') {
        // First step approval always goes to Pending HR
        if (isHod || isHr) {
          newStatus = 'Pending HR';
        }
      } else if (currentStatus === 'Pending HR') {
        if (isHr) {
          newStatus = 'Approved';
        }
      }
    }

    if (!newStatus) return;

    setActionInProgress(request.id);
    const currentRowRemarks = remarksInputs[request.id] || {};

    try {
      const { error } = await supabase
        .from('gate_pass')
        .update({
          status: newStatus,
          ...(isHod && { hod_remarks: currentRowRemarks.hod || '' }),
          ...(isHr && {
            hr_remarks: currentRowRemarks.hr || '',
            hr_name: user.full_name || user.Name
          })
        })
        .eq('id', request.id);

      if (error) throw error;

      // Update Logs
      // Update Logs
      const logUpdates = {
        status: newStatus,
        ...(isHod && {
          hod_name: user.full_name || user.Name,
          hod_id: user.emp_id,
          hod_action: action === 'approve' ? 'Approved' : 'Rejected',
          hod_approval_time: new Date().toISOString(),
          hod_remarks: currentRowRemarks.hod || ''
        }),
        ...(isHr && {
          hr_name: user.full_name || user.Name,
          hr_id: user.emp_id,
          hr_action: action === 'approve' ? 'Approved' : 'Rejected',
          hr_approval_time: new Date().toISOString(),
          hr_remarks: currentRowRemarks.hr || ''
        })
      };
      await supabase.from('logs').update(logUpdates).eq('request_id', request.id).eq('request_type', 'Gate Pass');

      toast.success(`Request ${action === 'approve' ? 'Approved' : 'Rejected'}`);

      // WhatsApp Notifications
      (async () => {
        try {
          const employeePhone = request.employee_whatsapp_number || request.users?.phone_number;
          const mdNumber = import.meta.env.VITE_MD_MOBILE_NUMBER;
          const specialEmpIds = ["1", "175", "53", "219", "3", "233", "245", "341", "16", "294", "217", "152", "527", "501", "235", "504", "180", "321", "519", "242", "246", "518"];
          const currentEmpId = String(request.emp_id || request.users?.emp_id);

          const formatDateTime = (dateStr) => {
            if (!dateStr) return 'N/A';
            return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          };

          const calculateDuration = (fromDate, toDate) => {
            if (!fromDate) return 'N/A';
            if (!toDate) return 'Same';
            const from = new Date(fromDate);
            const to = new Date(toDate);
            const fromDateStr = new Date(fromDate).toISOString().split('T')[0];
            const toDateStr = new Date(toDate).toISOString().split('T')[0];
            if (fromDateStr === toDateStr) return 'Same';
            const diffMs = to - from;
            if (diffMs < 0) return 'N/A';
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            return String(diffDays);
          };

          if (newStatus === 'Pending HR') {
            // HOD Approved -> Notify HR
            console.log("📤 Sending Gate Pass WhatsApp to HR...");
            await sendGatePassMessageToHr({
              employeId: request.hr_id || 'HR',
              tableid: request.id,
              employeeName: request.employee_name,
              empId: request.emp_id,
              department: 'N/A',
              leaveType: 'Gate Pass',
              fromDate: formatDateTime(request.departure_from_plant),
              toDate: formatDateTime(request.arrival_at_plant),
              totalDays: calculateDuration(request.departure_from_plant, request.arrival_at_plant),
              reason: request.place_reason_to_visit,
            });
          } else if (newStatus === 'Approved') {
            // HR Approved -> Notifications are now handled via Supabase Edge Function Webhook
            console.log("✅ Gate Pass Approved. Notification will be sent via Supabase Webhook.");
          } else if (newStatus === 'Rejected') {
            // Final Rejection (HR Action or HOD Action)
            if (isHr) {
              if (employeePhone) {
                console.log("📤 Sending Gate Pass Rejection to Employee...");
                await sendGatePassRejectedToEmployee({
                  employeePhone,
                  employeeName: request.employee_name,
                  fromDate: formatDateTime(request.departure_from_plant),
                  toDate: formatDateTime(request.arrival_at_plant),
                  totalDays: calculateDuration(request.departure_from_plant, request.arrival_at_plant),
                  hrRemarks: currentRowRemarks.hr || 'Decision by management',
                });
              }

              // MD Notification
              if (specialEmpIds.includes(currentEmpId)) {
                console.log("👑 Sending Gate Pass Rejection to MD Sir...");
                await sendGatePassRejectedToEmployee({
                  employeePhone: mdNumber,
                  employeeName: `${request.employee_name} (ID: ${currentEmpId})`,
                  fromDate: formatDateTime(request.departure_from_plant),
                  toDate: formatDateTime(request.arrival_at_plant),
                  totalDays: calculateDuration(request.departure_from_plant, request.arrival_at_plant),
                  hrRemarks: currentRowRemarks.hr || 'Decision by management',
                });
              }
            } else if (isHod) {
              // HOD Rejection
              if (employeePhone) {
                console.log("📤 Sending HOD Rejection WhatsApp...");
                await sendGatePassHodRejectedToEmployee({
                  employeePhone,
                  employeeName: request.employee_name,
                  requestType: 'gate pass request',
                  fromDate: formatDateTime(request.departure_from_plant),
                  toDate: formatDateTime(request.arrival_at_plant),
                });
              }
            }
          }
        } catch (err) {
          console.error("⚠️ WhatsApp Gate Pass notification failed:", err);
        }
      })();

      fetchGatePassData();
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleExportToExcel = async () => {
    try {
      setExportLoading(true);

      const startOfCurrentMonth = dayjs().startOf('month').format('YYYY-MM-DDTHH:mm:ss');
      const endOfCurrentMonth = dayjs().endOf('month').format('YYYY-MM-DDTHH:mm:ss');

      // Fetch all approved gate passes for the current month
      const { data, error } = await supabase
        .from('gate_pass')
        .select(`
          *,
          users(full_name, emp_id)
        `)
        .eq('status', 'Approved')
        .gte('departure_from_plant', startOfCurrentMonth)
        .lte('departure_from_plant', endOfCurrentMonth)
        .order('departure_from_plant', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('No approved gate passes found for the current month');
        return;
      }

      // Format data for Excel
      const excelData = data.map(item => ({
        'Employee ID': item.emp_id || item.users?.emp_id,
        'Employee Name': item.emp_name || item.users?.full_name,
        'Destination & Reason': item.place_reason_to_visit,
        'Departure': item.departure_from_plant ? dayjs(item.departure_from_plant).format('DD/MM/YYYY hh:mm A') : '-',
        'Arrival': item.arrival_at_plant ? dayjs(item.arrival_at_plant).format('DD/MM/YYYY hh:mm A') : '-',
        'WhatsApp Number': item.employee_whatsapp_number,
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
        { wch: 40 }, // Destination & Reason
        { wch: 20 }, // Departure
        { wch: 20 }, // Arrival
        { wch: 15 }, // WhatsApp
        { wch: 20 }, // HOD Name
        { wch: 25 }, // HOD Remarks
        { wch: 20 }, // HR Name
        { wch: 25 }, // HR Remarks
        { wch: 20 }, // Approved At
      ];
      worksheet['!cols'] = wscols;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Approved Gate Passes");

      // Download
      const fileName = `Approved_Gate_Passes_${dayjs().format('MMM_YYYY')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success(`Exported ${data.length} records successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export to Excel: ' + error.message);
    } finally {
      setExportLoading(false);
    }
  };

  const uploadImageToDrive = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `gate-passes/${Date.now()}.${fileExt}`;

      const { error } = await supabase
        .storage
        .from('images')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase
        .storage
        .from('images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'employeeName') {
      handleEmployeeChange(value);
    } else if (name === 'gatePassImage') {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employeeName || !formData.visitPlace || !formData.visitReason || !formData.departureTime) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!formData.gatePassImage) {
      toast.error('Please upload the image');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = '';
      if (formData.gatePassImage) {
        imageUrl = await uploadImageToDrive(formData.gatePassImage);
      }

      const insertData = {
        timestamp: new Date().toISOString(),
        emp_id: formData.employeeId,
        place_reason_to_visit: `${formData.visitPlace} - ${formData.visitReason}`,
        departure_from_plant: formData.departureTime,
        arrival_at_plant: formData.arrivalTime || null,
        employee_whatsapp_number: formData.whatsappNumber,
        status: 'Pending HR',
        hod_name: formData.hodName,
        hod_id: formData.hodId,
        hr_id: formData.hrId,
        hr_name: formData.hrName,
        image_gate_pass: imageUrl,
        emp_name: formData.employeeName
      };

      // 🔐 LIMIT CHECKS — PLACE BEFORE INSERT
      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      // Current month range
      const firstDayOfMonth = new Date(
        today.getFullYear(), today.getMonth(), 1
      ).toISOString();

      const lastDayOfMonth = new Date(
        today.getFullYear(), today.getMonth() + 1,
        0, 23, 59, 59
      ).toISOString();

      // 1️⃣ Check: One request per day
      const { data: todayRequests, error: todayError } = await supabase
        .from("gate_pass")
        .select("id")
        .eq("emp_id", formData.employeeId)
        .gte("timestamp", todayStart)
        .lte("timestamp", todayEnd);

      if (todayError) {
        toast.error("Error checking daily limit");
        return;
      }

      if (todayRequests.length > 0) {
        toast.error("Only 1 gate pass request allowed per day");
        return;
      }

      // 2️⃣ Check: Max 3 per month
      const { data: monthlyRequests, error: monthError } = await supabase
        .from("gate_pass")
        .select("id")
        .eq("emp_id", formData.employeeId)
        .gte("timestamp", firstDayOfMonth)
        .lte("timestamp", lastDayOfMonth);

      if (monthError) {
        toast.error("Error checking monthly limit");
        return;
      }

      if (monthlyRequests.length >= 3) {
        toast.error("You can only request 3 gate passes in a month");
        return;
      }

      const { data, error } = await supabase.from('gate_pass').insert([insertData]).select();
      if (error) throw error;

      if (data && data[0]) {
        await supabase.from('logs').insert({
          request_id: data[0].id,
          request_type: 'Gate Pass',
          emp_id: formData.employeeId,
          emp_name: formData.employeeName,
          status: (formData.hodName === 'HR' || formData.hodId === 1 || formData.hodName === 'Pawan Tiwari') ? 'Pending HR' : 'Pending',
          hod_id: formData.hodId,
          hod_name: formData.hodName,
          hr_id: formData.hrId,
          hr_name: formData.hrName
        });

        // WhatsApp Notification for New Gate Pass
        (async () => {
          try {
            const formatDateTime = (dateStr) => {
              if (!dateStr) return 'N/A';
              return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            };

            const calculateDuration = (fromDate, toDate) => {
              if (!fromDate) return 'N/A';
              if (!toDate) return 'Same';
              const fromStr = new Date(fromDate).toISOString().split('T')[0];
              const toStr = new Date(toDate).toISOString().split('T')[0];
              if (fromStr === toStr) return 'Same';
              const diffMs = new Date(toDate) - new Date(fromDate);
              if (diffMs < 0) return 'N/A';
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              return String(diffDays);
            };

            const statusLabel = insertData.status;

            if (statusLabel === 'Pending HR') {
              console.log("📤 Sending Gate Pass WhatsApp to HR...");
              await sendGatePassMessageToHr({
                employeId: formData.hrId || 'HR',
                tableid: data[0].id,
                employeeName: formData.employeeName,
                empId: formData.employeeId,
                department: 'N/A',
                leaveType: 'Gate Pass',
                fromDate: formatDateTime(formData.departureTime),
                toDate: formatDateTime(formData.arrivalTime),
                totalDays: calculateDuration(formData.departureTime, formData.arrivalTime),
                reason: `${formData.visitPlace} - ${formData.visitReason}`,
              });
            }
          } catch (waError) {
            console.error("⚠️ WhatsApp creation notification failed:", waError);
          }
        })();
      }

      toast.success('Gate Pass Created');
      setShowModal(false);
      setFormData({
        employeeId: '', employeeName: '', hodName: '', hodId: '', hrName: '', hrId: '', visitPlace: '', visitReason: '',
        departureTime: '', arrivalTime: '', whatsappNumber: '', gatePassImage: null
      });
      fetchGatePassData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const renderTable = (data) => (
    <div className="overflow-auto flex-1 custom-scrollbar">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Select</th>
            <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
            <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
            <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</th>
            <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">HOD</th>
            {showHodColumn && <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">HOD Remarks</th>}
            {showHrColumn && <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">HR Remarks</th>}
            <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Attachment</th>
            {activeTab === 'pending' && (
              <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.length > 0 ? (
            data.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                  {((user?.is_hod && (item.status === 'Pending' || item.status === 'Pending HOD') && (item.hod_name === user?.full_name || item.hod_name === user?.Name)) ||
                    ((user?.role === 'hr' || user?.role === 'HR' || user?.role === 'admin' || user?.role === 'Admin' || user?.Admin === 'Yes') && item.status === 'Pending HR')) && (
                      <input
                        type="checkbox"
                        checked={selectedRow?.id === item.id}
                        onChange={() => handleCheckboxChange(item.id, item)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                      />
                    )}
                </td>
                <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 text-sm">{item.employee_name}</span>
                    <span className="text-xs text-slate-500">{item.emp_id}</span>
                  </div>
                </td>
                <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                  <div className="flex flex-col text-sm text-slate-600">
                    <span>Out: {formatDate(item.departure_from_plant)}</span>
                    {item.arrival_at_plant && <span>In: {formatDate(item.arrival_at_plant)}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 sm:px-6 sm:py-4">
                  <p className="text-sm text-slate-500 max-w-xs truncate" title={item.place_reason_to_visit}>{item.place_reason_to_visit}</p>
                  <a href={`tel:${item.employee_whatsapp_number}`} className="text-xs text-indigo-500 hover:underline">{item.employee_whatsapp_number}</a>
                </td>
                <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">{item.hod_name}</td>
                {showHodColumn && (
                  <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">
                    {user?.is_hod && (item.status === 'Pending' || item.status === 'Pending HOD') && selectedRow?.id === item.id ? (
                      <input
                        type="text"
                        placeholder="HOD Remarks"
                        value={remarksInputs[item.id]?.hod || ''}
                        onChange={(e) => handleRemarkChange(item.id, 'hod', e.target.value)}
                        className="w-full min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      item.hod_remarks || '-'
                    )}
                  </td>
                )}
                {showHrColumn && (
                  <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">
                    {isHr && item.status === 'Pending HR' && selectedRow?.id === item.id ? (
                      <input
                        type="text"
                        placeholder="HR Remarks"
                        value={remarksInputs[item.id]?.hr || ''}
                        onChange={(e) => handleRemarkChange(item.id, 'hr', e.target.value)}
                        className="w-full min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      item.hr_remarks || '-'
                    )}
                  </td>
                )}
                <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.status === 'Approved' ? 'bg-green-100 text-green-800' :
                    item.status?.includes('Rejected') ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                    {(item.status === 'Pending' || item.status === 'Pending HOD') ? 'Pending HOD' : (item.status?.includes('Rejected') ? 'Rejected' : item.status)}
                  </span>
                </td>
                <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">
                  {item.image_gate_pass ? (
                    <a href={item.image_gate_pass} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800"><ImageIcon size={18} /></a>
                  ) : '-'}
                </td>
                {activeTab === 'pending' && (
                  <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm font-medium">
                    {/* Only show actions if not final status AND user has authority for current status */}
                    {item.status !== 'Approved' && !item.status?.includes('Rejected') && (
                      // Authorization Logic for Button Visibility
                      (
                        // If Pending: Visible for Assigned HOD OR HR/Admin
                        ((item.status === 'Pending' || item.status === 'Pending HOD') && (
                          (user?.is_hod && (item.hod_name === user?.full_name || item.hod_name === user?.Name)) ||
                          (user?.role === 'hr' || user?.role === 'HR' || user?.role === 'admin' || user?.role === 'Admin')
                        )) ||
                        // If Pending HR: Visible ONLY for HR/Admin
                        (item.status === 'Pending HR' && (
                          user?.role === 'hr' || user?.role === 'HR' || user?.role === 'admin' || user?.role === 'Admin'
                        ))
                      ) && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAction('approve', item)}
                            disabled={actionInProgress === item.id || selectedRow?.id !== item.id}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleAction('reject', item)}
                            disabled={actionInProgress === item.id || selectedRow?.id !== item.id}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Reject
                          </button>
                        </div>
                      )
                    )}
                    {/* Visual feedback removed as HOD is bypassed */}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={activeTab === 'pending' ? "11" : "10"} className="px-6 py-12 text-center text-slate-500">No requests found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-4 sm:gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Gate Pass Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage employee gate pass requests</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full md:w-auto"
        >
          <Plus size={18} className="mr-2" />
          New Gate Pass
        </button>
      </div>

      {/* Controls & Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {/* Tabs & Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-lg border border-slate-200/50 overflow-x-auto">
            {['pending', 'approved', 'rejected'].map((tab) => {
              const isActive = activeTab === tab;
              const count = tab === 'pending' ? pendingPasses.length : tab === 'approved' ? approvedPasses.length : rejectedPasses.length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${isActive
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto md:flex-row md:items-center">
            {/* Export Button for HR/Admin on Approved Tab */}
            {activeTab === "approved" && isHr && (
              <button
                onClick={handleExportToExcel}
                disabled={exportLoading}
                className="inline-flex items-center justify-center px-4 py-2 border border-green-200 rounded-lg shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 hover:text-green-800 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed group"
                title="Export current month's approved gate passes to Excel"
              >
                {exportLoading ? (
                  <Clock size={18} className="mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet size={18} className="mr-2 text-green-600 group-hover:scale-110 transition-transform" />
                )}
                {exportLoading ? "Exporting..." : "Export Current Month"}
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative max-w-full md:max-w-xs w-full">
            <input
              type="text"
              placeholder="Search employees..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex text-center items-center justify-center flex-1 h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            renderTable(activeTab === 'pending' ? pendingPasses : activeTab === 'approved' ? approvedPasses : rejectedPasses)
          )}
        </div>
      </div>

      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 sm:p-6 transition-all duration-300">
          <div className="absolute inset-0 bg-transparent" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 ring-1 ring-black/5">
            <div className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight">New Gate Pass Request</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6 scrollbar-thin">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Employee Selection Section */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Select Employee <span className="text-red-500">*</span></label>
                    <div className="relative group" ref={dropdownRef}>
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" /></div>
                      <input
                        type="text"
                        name="employeeName"
                        value={formData.employeeName}
                        onChange={(e) => {
                          handleInputChange(e);
                          setIsEmployeeDropdownOpen(true);
                        }}
                        onFocus={() => setIsEmployeeDropdownOpen(true)}
                        placeholder="Search or select employee..."
                        className="block w-full rounded-xl border-slate-200 pl-10 pr-10 py-3 text-slate-700 bg-white focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        autoComplete="off"
                        required
                      />
                      <div
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                        onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                      >
                        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isEmployeeDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>

                      {/* Custom Dropdown List */}
                      {isEmployeeDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 animate-in fade-in zoom-in-95 duration-100">
                          {employees.filter(e => e.name.toLowerCase().includes(formData.employeeName.toLowerCase())).length > 0 ? (
                            employees
                              .filter(e => e.name.toLowerCase().includes(formData.employeeName.toLowerCase()))
                              .map(e => (
                                <div
                                  key={e.id}
                                  className="px-4 py-3 hover:bg-indigo-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between group/item"
                                  onClick={() => {
                                    handleEmployeeChange(e.name);
                                    setIsEmployeeDropdownOpen(false);
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-700 group-hover/item:text-indigo-700 transition-colors">{e.name}</span>
                                    {e.phone && <span className="text-[10px] text-slate-400">{e.phone}</span>}
                                  </div>
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md group-hover/item:bg-white transition-colors">
                                    {e.id}
                                  </span>
                                </div>
                              ))
                          ) : (
                            <div className="px-4 py-8 text-center text-slate-400 flex flex-col items-center">
                              <Users size={24} className="mb-2 opacity-20" />
                              <p className="text-xs">No employees found matching "{formData.employeeName}"</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    {/* Employee ID Card */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-500 border border-slate-100 shadow-sm shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Emp ID</p>
                        <p className="font-semibold text-xs text-slate-900 break-words">{formData.employeeId || '-'}</p>
                      </div>
                    </div>

                    {/* HOD Card */}
                    {formData.hodId && (
                      <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm shrink-0">
                          <Users size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">HOD</p>
                          <p className="font-semibold text-xs text-slate-900 break-words">{formData.hodName || '-'}</p>
                        </div>
                      </div>
                    )}

                    {/* HR Card */}
                    <div className="flex items-center gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-purple-600 border border-purple-100 shadow-sm shrink-0">
                        <Shield size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-0.5">HR</p>
                        <p className="font-semibold text-xs text-slate-900 break-words">{formData.hrName || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Place to Visit */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Place to Visit <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MapPin size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" /></div>
                    <input
                      type="text"
                      name="visitPlace"
                      value={formData.visitPlace}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 pl-10 py-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 placeholder-slate-400"
                      placeholder="e.g. Client Site"
                      required
                    />
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Reason <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <div className="absolute top-3 left-3"><FileText size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" /></div>
                    <textarea
                      name="visitReason"
                      value={formData.visitReason}
                      onChange={handleInputChange}
                      rows={2}
                      className="block w-full rounded-xl border-slate-200 pl-10 py-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-medium text-slate-800 placeholder-slate-400"
                      placeholder="Brief purpose of visit..."
                      required
                    />
                  </div>
                </div>

                {/* Time Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Departure Time <span className="text-red-500">*</span></label>
                    <input
                      type="datetime-local"
                      name="departureTime"
                      value={formData.departureTime}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 py-2.5 px-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-600 sm:text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Expected Arrival</label>
                    <input
                      type="datetime-local"
                      name="arrivalTime"
                      value={formData.arrivalTime}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 py-2.5 px-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-600 sm:text-sm"
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">WhatsApp Number <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" /></div>
                    <input
                      type="tel"
                      name="whatsappNumber"
                      value={formData.whatsappNumber}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 pl-10 py-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 placeholder-slate-400"
                      placeholder="Enter number"
                      required
                    />
                  </div>
                </div>

                {/* Attachment */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Attachment <span className="text-red-500">*</span></label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 transition-colors mb-2" />
                        <p className="text-sm text-slate-500"><span className="font-semibold">Click to upload</span> image</p>
                      </div>
                      <input type="file" name="gatePassImage" className="hidden" onChange={handleInputChange} accept="image/*" />
                    </label>
                  </div>
                  {formData.gatePassImage && (
                    <p className="text-xs text-green-600 flex items-center gap-1 mt-1 font-medium">
                      <CheckCircle size={14} /> Selected: {formData.gatePassImage.name}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end space-x-4 pt-6 mt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all">Cancel</button>
                  <button type="submit" disabled={submitting} className={`px-8 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 ${submitting ? 'opacity-70 cursor-not-allowed transform-none' : ''}`}>
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default GatePass;

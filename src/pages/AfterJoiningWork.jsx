import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Filter, Search, Clock, CheckCircle, X, Upload } from 'lucide-react';
import useDataStore from '../store/dataStore';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';

const AfterJoiningWork = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);

  const [formData, setFormData] = useState({
    checkSalarySlipResume: false,
    offerLetterReceived: false,
    welcomeMeeting: false,
    biometricAccess: false,
    punchCode: "", // Add punch code field
    officialEmailId: false,
    emailId: "",
    emailPassword: "",
    assignAssets: false,
    // Remove image upload fields and replace with input fields
    laptop: "",
    mobile: "",
    vehicle: "",
    other: "",
    // Keep these for manual image upload
    manualImage: null,
    manualImageUrl: "",
    pfEsic: false,
    companyDirectory: false,
    assets: [],
    employeeId: "", // Add employeeId field
  });

  const fetchJoiningData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      // 1. Fetch Candidate Data from joining_form
      const { data: joiningData, error: joiningError } = await supabase
        .from('joining_form')
        .select('*');

      if (joiningError) throw new Error(`Supabase joining_form error: ${joiningError.message}`);

      // 2. Fetch Checklist Data from after_joining
      const { data: checklistData, error: checklistError } = await supabase
        .from('after_joining')
        .select('*');

      if (checklistError) throw new Error(`Supabase after_joining error: ${checklistError.message}`);

      // Process and Merge Data
      const processedData = joiningData.map(joinItem => {
        // Find matching checklist item with robust string comparison
        const checklistItem = checklistData.find(c =>
          String(c.joining_id).trim() === String(joinItem.joining_id).trim()
        );

        return {
          timestamp: joinItem.timestamp || "",
          joiningNo: joinItem.joining_id || "",
          candidateName: joinItem.name_as_per_aadhar || "",
          fatherName: joinItem.father_name || "",
          dateOfJoining: joinItem.date_of_joining || "",
          designation: joinItem.designation || "",
          salary: joinItem.department || "", // Using department as salary per original code
          candidatePhoto: joinItem.candidate_photo || "",
          department: joinItem.department || "",

          // Fields from after_joining table (or defaults)
          plannedDate: checklistItem?.planned_date || joinItem.planned_date || "",
          actual: checklistItem?.actual_date || "",
          checkSalarySlipResume: checklistItem?.check_salary_slip_resume || false,
          offerLetterReceived: checklistItem?.offer_letter_received || false,
          welcomeMeeting: checklistItem?.welcome_meeting || false,
          biometricAccess: checklistItem?.biometric_access || false,
          officialEmailId: checklistItem?.official_email_id || false,
          assignAssets: checklistItem?.assign_assets || false,
          pfEsic: checklistItem?.pf_esic || false,
          companyDirectory: checklistItem?.company_directory || false,
          status: checklistItem?.status || 'Pending',
          empId: joinItem.emp_id || checklistItem?.emp_id || "",
          delay: checklistItem?.delay || "",
          isSubmitted: joinItem.father_name !== 'Pending Update'
        }
      });

      // Filter based on status
      const pendingTasks = processedData.filter(
        (task) => task.status !== 'Completed'
      );
      setPendingData(pendingTasks);

      const historyTasks = processedData.filter(
        (task) => task.status === 'Completed'
      );
      setHistoryData(historyTasks);
    } catch (error) {
      console.error("Error fetching joining data:", error);
      setError(error.message);
      toast.error(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  // Fetch previous assets data from Assets table in Supabase
  const fetchAssetsData = async (employeeId) => {
    try {
      // Fetch data from Supabase 'assets' table
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('employee_id', employeeId)
        .limit(1);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (data && data.length > 0) {
        const asset = data[0];
        return {
          punchCode: asset.punch_code || "",
          emailId: asset.email_id || "",
          emailPassword: asset.email_password || "",
          laptop: asset.laptop || "",
          mobile: asset.mobile || "",
          vehicle: asset.vehicle || "",
          other: asset.sim || "", // Using sim as other
          manualImageUrl: asset.manual || "",
          employeeId: asset.employee_id || ""  // Add this
        };
      }

      return null;
    } catch (error) {
      console.error("Error fetching assets data:", error);
      return null;
    }
  };

  useEffect(() => {
    fetchJoiningData();
  }, []);

  const handleAfterJoiningClick = async (item) => {
    // Reset form data first
    setFormData({
      checkSalarySlipResume: item.checkSalarySlipResume,
      offerLetterReceived: item.offerLetterReceived,
      welcomeMeeting: item.welcomeMeeting,
      biometricAccess: item.biometricAccess,
      punchCode: "", // Will fetch from assets
      officialEmailId: item.officialEmailId,
      emailId: "", // Will fetch from assets
      emailPassword: "", // Will fetch from assets
      assignAssets: item.assignAssets,
      laptop: "", // Will fetch from assets
      mobile: "", // Will fetch from assets
      vehicle: "", // Will fetch from assets
      other: "", // Will fetch from assets
      manualImage: null,
      manualImageUrl: "", // Will fetch from assets
      pfEsic: item.pfEsic,
      companyDirectory: item.companyDirectory,
      assets: [],
      employeeId: item.joiningNo || "", // Initialize with joiningNo
    });

    setSelectedItem(item);
    setShowModal(true);
    setSelectedItem(item);
    setShowModal(true);
    setLoading(true);
    setValidationError(null);

    try {
      // Fetch assets data
      const assetsData = await fetchAssetsData(item.joiningNo);

      // Merge with assets data if available
      const finalFormData = {
        punchCode: assetsData?.punchCode || "",
        emailId: assetsData?.emailId || "",
        emailPassword: assetsData?.emailPassword || "",
        laptop: assetsData?.laptop || "",
        mobile: assetsData?.mobile || "",
        vehicle: assetsData?.vehicle || "",
        other: assetsData?.other || "",
        manualImageUrl: assetsData?.manualImageUrl || "",
        manualImage: null,
        assets: [],
        employeeId: assetsData?.employeeId || (assetsData?.punchCode ? "" : item.joiningNo), // Prefer existing if available
      };

      setFormData(prev => ({
        ...prev,
        ...finalFormData
      }));

    } catch (error) {
      console.error("Error fetching detailed values:", error);
      toast.error("Failed to load details");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (name) => {
    setFormData((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const validateEmployeeId = async (id) => {
    if (!id) {
      setValidationError(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('users')
        .select('emp_id')
        .eq('emp_id', id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Error checking emp_id:", error);
        return;
      }

      if (data) {
        setValidationError("emp id is already taken provide different emp id");
      } else {
        setValidationError(null);
      }
    } catch (err) {
      console.error("Validation error:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    // Remove leading zeros from Employee ID and convert to uppercase
    if (name === 'employeeId') {
      newValue = value.replace(/^0+/, '').toUpperCase();
    }

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const handleImageUpload = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        [fieldName]: file,
      }));
    }
  };

  // Save assets data to Assets table in Supabase
  const saveAssetsData = async (employeeId, employeeName, assetsData) => {
    try {
      const now = new Date();
      const timestamp = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      // Check if record exists
      const { data: existingData, error: fetchError } = await supabase
        .from('assets')
        .select('id')
        .eq('employee_id', employeeId)
        .limit(1);

      if (fetchError) {
        throw new Error(`Supabase fetch error: ${fetchError.message}`);
      }

      const assetRecord = {
        timestamp: timestamp,
        employee_id: employeeId,
        employee_name: employeeName,
        email_id: assetsData.emailId || "",
        email_password: assetsData.emailPassword || "",
        laptop: assetsData.laptop || "",
        mobile: assetsData.mobile || "",
        vehicle: assetsData.vehicle || "",
        sim: assetsData.other || "", // Using other as sim
        manual: assetsData.manualImageUrl || "",
        punch_code: assetsData.punchCode || ""
      };

      if (existingData && existingData.length > 0) {
        // Update existing record
        const { data, error } = await supabase
          .from('assets')
          .update(assetRecord)
          .eq('employee_id', employeeId);

        if (error) {
          throw new Error(`Supabase update error: ${error.message}`);
        }
        return data;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('assets')
          .insert([assetRecord]);

        if (error) {
          throw new Error(`Supabase insert error: ${error.message}`);
        }
        return data;
      }
    } catch (error) {
      throw new Error(`Failed to save assets data: ${error.message}`);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmitting(true);

    if (!selectedItem.joiningNo) {
      toast.error("No employee selected");
      setSubmitting(false);
      return;
    }

    if (validationError) {
      toast.error("Please resolve the errors before submitting");
      setSubmitting(false);
      return;
    }

    try {
      let manualImageUrl = formData.manualImageUrl;
      if (formData.manualImage) {
        toast.error("Image upload functionality needs to be implemented with Supabase Storage");
      }

      // Save assets data
      // Use formData.employeeId instead of selectedItem.joiningNo if we are assigning a new ID
      const targetEmployeeId = formData.employeeId || selectedItem.joiningNo;

      // Ensure user exists in 'users' table before assigning assets
      // This is required to satisfy the foreign key constraint on the assets table
      const { data: userCheck } = await supabase
        .from('users')
        .select('emp_id')
        .eq('emp_id', targetEmployeeId)
        .maybeSingle();

      if (!userCheck) {
        // Create new user record
        const { error: createUserError } = await supabase
          .from('users')
          .insert([{
            emp_id: targetEmployeeId,
            username: selectedItem.candidateName.toLowerCase().replace(/\s+/g, ''),
            password: 'user123',
            full_name: selectedItem.candidateName,
            email: formData.emailId || null,
            phone_number: formData.mobile || null,
            role: 'employee',
            department: selectedItem.department,
            designation: selectedItem.designation,
            joining_date: selectedItem.dateOfJoining || null,
            is_active: true,
            page_access: [
              "my-profile",
              "my-attendance",
              "leave-request",
              "gate-pass-request",
              "my-salary",
              "company-calendar"
            ]
          }]);

        if (createUserError) {
          throw new Error(`Failed to create user record: ${createUserError.message}`);
        }
      }

      await saveAssetsData(targetEmployeeId, selectedItem.candidateName, {
        emailId: formData.emailId,
        emailPassword: formData.emailPassword,
        laptop: formData.laptop,
        mobile: formData.mobile,
        vehicle: formData.vehicle,
        other: formData.other,
        manualImageUrl: manualImageUrl,
        punchCode: formData.punchCode
      });

      // Update after_joining table in Supabase
      const now = new Date();
      // Format for Supabase YYYY-MM-DD
      const formattedDateForDB = now.toISOString().split('T')[0];

      const allFieldsYes =
        formData.checkSalarySlipResume &&
        formData.offerLetterReceived &&
        formData.welcomeMeeting &&
        formData.biometricAccess &&
        formData.officialEmailId &&
        formData.assignAssets &&
        formData.pfEsic &&
        formData.companyDirectory;

      // Prepare the upsert data
      const upsertData = {
        joining_id: selectedItem.joiningNo,
        emp_id: targetEmployeeId,
        planned_date: selectedItem.plannedDate || null, // Preserve planned date, handle empty string
        check_salary_slip_resume: formData.checkSalarySlipResume,
        offer_letter_received: formData.offerLetterReceived,
        welcome_meeting: formData.welcomeMeeting,
        biometric_access: formData.biometricAccess,
        official_email_id: formData.officialEmailId,
        assign_assets: formData.assignAssets,
        pf_esic: formData.pfEsic,
        company_directory: formData.companyDirectory,
        updated_at: new Date().toISOString()
      };

      // Always mark as completed/processed if submitted, as per user request
      upsertData.actual_date = formattedDateForDB;
      upsertData.status = 'Completed';

      // Upsert into after_joining based on joining_id match
      // First we need to check if a record exists to get its ID, or rely on unique constraint on joining_id if it exists
      // Since we didn't add a unique constraint in the SQL, let's look it up or just append. 
      // Ideally we should have UNIQUE(joining_id). 
      // For now, let's check existence first.

      const { data: existing, error: existError } = await supabase
        .from('after_joining')
        .select('id')
        .eq('joining_id', selectedItem.joiningNo)
        .limit(1);

      if (existError) throw existError;

      let result;
      if (existing && existing.length > 0) {
        result = await supabase
          .from('after_joining')
          .update(upsertData)
          .eq('id', existing[0].id);
      } else {
        result = await supabase
          .from('after_joining')
          .insert([upsertData]);
      }

      if (result.error) {
        throw new Error(`Supabase error: ${result.error.message}`);
      }

      if (allFieldsYes) {
        toast.success("All conditions met! Status completed.");
      } else {
        toast.success("Progress saved successfully.");
      }

      setShowModal(false);
      fetchJoiningData();
    } catch (error) {
      console.error("Update error:", error);
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };


  const formatDOB = (dateString) => {
    if (!dateString) return "";

    // Handle the format "2021-11-01"
    if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const day = parts[2];
        const month = parts[1];
        const year = parts[0].slice(-2); // Get last 2 digits of year
        return `${day}/${month}/${year}`;
      }
    }

    // Fallback for other formats
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const day = date.getDate();
    const month = date.getMonth() + 1; // Months are 0-indexed, so add 1
    const year = date.getFullYear().toString().slice(-2);

    return `${day}/${month}/${year}`;
  };

  const filteredPendingData = pendingData.filter((item) => {
    const matchesSearch =
      item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.joiningNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredHistoryData = historyData.filter((item) => {
    const matchesSearch =
      item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.joiningNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">After Joining Work</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage onboarding tasks and employee asset assignment</p>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {/* Toolbar: Tabs & Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-lg border border-slate-200/50">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === "pending"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              onClick={() => setActiveTab("pending")}
            >
              <Clock size={16} className="inline mr-2" />
              Pending
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === "pending" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                }`}>
                {filteredPendingData.length}
              </span>
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === "history"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              onClick={() => setActiveTab("history")}
            >
              <CheckCircle size={16} className="inline mr-2" />
              History
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === "history" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                }`}>
                {filteredHistoryData.length}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm w-full">
            <input
              type="text"
              placeholder="Search by name or ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 overflow-auto custom-scrollbar">
            {activeTab === "pending" && (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      EMP ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Father Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Date Of Joining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Designation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-3"></div>
                          <span className="text-slate-500 text-sm font-medium">
                            Loading pending tasks...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-red-500 space-y-2">
                          <p className="font-medium">Error: {error}</p>
                          <button
                            onClick={fetchJoiningData}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                          >
                            Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPendingData.length > 0 ? (
                    filteredPendingData.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors duration-150 group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleAfterJoiningClick(item)}
                            disabled={!item.isSubmitted}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all transform ${item.isSubmitted
                              ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-indigo-200"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                              }`}
                            title={!item.isSubmitted ? "Joining Form Not Submitted" : "Process Item"}
                          >
                            Process
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {item.empId || item.joiningNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {item.candidateName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.fatherName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {formatDOB(item.dateOfJoining)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.designation}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.salary}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === 'Completed'
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                            }`}>
                            {item.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-16 text-center bg-slate-50/50">
                        <p className="text-slate-500 text-sm">No pending after joining work found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "history" && (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Designation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Date Of Joining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-3"></div>
                          <span className="text-slate-500 text-sm font-medium">
                            Loading history...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredHistoryData.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-16 text-center bg-slate-50/50">
                        <p className="text-slate-500 text-sm">No history found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryData.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {item.empId || item.joiningNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {item.candidateName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.designation}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {formatDOB(item.dateOfJoining)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            Completed
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showModal && selectedItem && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-all duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* Minimal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-white sticky top-0 z-20">
              <div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                  Onboarding Process
                </h3>
                <p className="text-sm text-slate-500 mt-0.5 font-medium">{selectedItem.candidateName}</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all duration-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
              <form onSubmit={handleSubmit} className="space-y-8">

                {/* Employee ID Section - Clean & Prominent */}
                <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200 space-y-4 shadow-sm relative overflow-hidden">
                  {/* Decorative accent */}
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <label className="text-sm font-bold text-indigo-900 block mb-0.5">
                        Employee ID
                      </label>
                      <p className="text-xs text-indigo-700/80 font-medium">Assign a unique ID (e.g. EMP001)</p>
                    </div>
                    <div className="w-40 flex-shrink-0">
                      <input
                        type="text"
                        name="employeeId"
                        value={formData.employeeId}
                        onChange={handleInputChange}
                        onBlur={(e) => validateEmployeeId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border-2 border-indigo-200 rounded-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-bold text-indigo-700 placeholder-indigo-300 transition-all text-center shadow-sm"
                        placeholder="EMP ID"
                      />
                    </div>
                  </div>
                  {validationError && (
                    <p className="text-red-500 text-xs flex items-center justify-end font-medium">
                      {validationError}
                    </p>
                  )}
                </div>


                {/* Essential Checklist - Grid Layout */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Essential Checklist</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: "checkSalarySlipResume", label: "Salary Slip & Resume" },
                      { key: "offerLetterReceived", label: "Offer Letter Signed" },
                      { key: "welcomeMeeting", label: "Welcome Meeting" },
                      { key: "biometricAccess", label: "Biometric Access" },
                      { key: "pfEsic", label: "PF / ESIC Registration" },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className={`relative flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 ${formData[item.key]
                          ? 'border-indigo-600 bg-indigo-50/30'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData[item.key]}
                          onChange={() => handleCheckboxChange(item.key)}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 transition-colors"
                        />
                        <span className={`ml-3 text-sm font-medium ${formData[item.key] ? 'text-indigo-900' : 'text-slate-600'}`}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Dependent Field: Biometric Punch Code - Inline if active */}
                  {formData.biometricAccess && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-1 ml-1">
                      <div className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <label className="text-sm text-slate-600 whitespace-nowrap">Device Punch Code:</label>
                        <input
                          type="text"
                          name="punchCode"
                          value={formData.punchCode}
                          onChange={handleInputChange}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm outline-none transition-all w-40"
                          placeholder="Required..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100"></div>

                {/* Accounts & Assets - Minimal Toggles */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Accounts & Assets</h4>
                  <div className="space-y-3">

                    {/* Official Email */}
                    <div className={`p-4 rounded-xl border transition-all duration-200 ${formData.officialEmailId ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-50' : 'bg-slate-50/30 border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Official Email Account</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={formData.officialEmailId} onChange={() => handleCheckboxChange("officialEmailId")} className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                      {formData.officialEmailId && (
                        <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">Email Address / User ID</label>
                          <input
                            type="email"
                            name="emailId"
                            value={formData.emailId}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm outline-none transition-all"
                            placeholder="e.g. rahul.dahiya@company.com"
                          />
                        </div>
                      )}
                    </div>

                    {/* Assign Assets */}
                    <div className={`p-4 rounded-xl border transition-all duration-200 ${formData.assignAssets ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-50' : 'bg-slate-50/30 border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Assign Hardware Assets</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={formData.assignAssets} onChange={() => handleCheckboxChange("assignAssets")} className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                      {formData.assignAssets && (
                        <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[{ id: "laptop", label: "Laptop Model/ID" }, { id: "mobile", label: "Mobile Phone" }, { id: "vehicle", label: "Vehicle Number" }, { id: "other", label: "SIM / Other" }].map((asset) => (
                            <div key={asset.id}>
                              <label className="block text-xs font-medium text-slate-500 mb-1.5">{asset.label}</label>
                              <input
                                type="text"
                                name={asset.id}
                                value={formData[asset.id]}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm outline-none transition-all"
                                placeholder="Details..."
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Company Directory */}
                    <div className={`p-4 rounded-xl border transition-all duration-200 ${formData.companyDirectory ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-50' : 'bg-slate-50/30 border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Company Directory & Manual</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={formData.companyDirectory} onChange={() => handleCheckboxChange("companyDirectory")} className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                      {formData.companyDirectory && (
                        <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
                          <div className="flex items-center gap-4">
                            <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-indigo-600 rounded-lg text-sm font-medium transition-all group">
                              <Upload size={16} className="mr-2 group-hover:scale-110 transition-transform" />
                              {formData.manualImage ? "Change File" : formData.manualImageUrl ? "Replace File" : "Upload Manual"}
                              <input type="file" id="manualImage" accept="image/*" onChange={(e) => handleImageUpload(e, "manualImage")} className="hidden" />
                            </label>
                            {/* Preview */}
                            {(formData.manualImage || formData.manualImageUrl) && (
                              <div className="h-10 w-10 overflow-hidden rounded-md border border-slate-200 relative group/preview">
                                <img src={formData.manualImage ? URL.createObjectURL(formData.manualImage) : formData.manualImageUrl} alt="Preview" className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/10 group-hover/preview:bg-black/0 transition-colors" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* Clean Footer */}
                <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white pb-0 z-10">
                  <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-50 font-medium text-sm transition-all focus:outline-none">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-6 py-2.5 rounded-xl text-white font-medium text-sm shadow-lg shadow-indigo-200 transition-all transform active:scale-95 ${submitting ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200/50"}`}
                  >
                    {submitting ? "Processing..." : "Complete Process"}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div >
  );
};

export default AfterJoiningWork;
// Changed From Call Tracker to Enquiry Status
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, CheckCircle, X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getCallTrackerEnquiries,
  updateCallTrackerEnquiry,
  getLatestJoiningFormId,
  insertJoiningFormRecord
} from '../api/callTrackerApi';

const CallTracker = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    candidateSays: '',
    status: '',
    nextDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [enquiryData, setEnquiryData] = useState([]);
  const [error, setError] = useState(null);

  const fetchEnquiryData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      // Fetch data from API
      const enquiryData = await getCallTrackerEnquiries();

      // Process enquiry data
      const processedEnquiryData = enquiryData.map(item => ({
        id: item.id,
        indentNo: item.indent_number || '',
        candidateEnquiryNo: item.candidate_enquiry_number || '',
        applyingForPost: item.applying_for_post || '',
        department: item.department || '',
        candidateName: item.candidate_name || '',
        candidateDOB: item.dob || '',
        candidatePhone: item.candidate_phone_number || '',
        candidateEmail: item.candidate_email || '',
        previousCompany: item.previous_company_name || '',
        jobExperience: item.job_experience || '',
        lastSalary: '',
        previousPosition: item.previous_position || '',
        reasonForLeaving: item.reason_of_leaving_previous_company || '',
        maritalStatus: item.marital_status || '',
        lastEmployerMobile: item.last_employer_mobile_number || '',
        candidatePhoto: item.candidate_photo || '',
        candidateResume: item.resume_copy || '',
        referenceBy: item.reference_by || '',
        presentAddress: item.present_address || '',
        aadharNo: item.aadhar_number || '',
        designation: item.applying_for_post || '',
        // New fields for tracking
        trackerStatus: item.tracker_status || 'NeedMore',
        candidateSays: item.what_did_the_candidate_says || '',
        nextDate: item.next_call_date || '',
        actual: item.actual || '',
        timestamp: item.timestamp
      }));

      setEnquiryData(processedEnquiryData);

    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiryData();
  }, []);

  // Filter pending: items that are NOT Joining or Reject
  const pendingData = enquiryData.filter(item => {
    const status = item.trackerStatus;
    // Assuming 'NeedMore' is default, and other active statuses are Pending, Follow-up, Interview, Negotiation, On Hold
    return status !== 'Joining' && status !== 'Reject' && status !== 'Complete';
  });

  // Filter history: items that ARE Joining, Reject, or Complete
  const historyData = enquiryData.filter(item => {
    const status = item.trackerStatus;
    return status === 'Joining' || status === 'Reject' || status === 'Complete';
  });

  const handleCallClick = (item) => {
    setSelectedItem(item);
    setFormData({
      candidateSays: item.candidateSays || '',
      status: item.trackerStatus || '',
      nextDate: item.nextDate || ''
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // utils/dateFormatter.js
  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;

      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return isoString;
    }
  }

  const formatDOB = (dateString) => {
    if (!dateString) return '';

    // Handle different date formats
    let date;

    if (dateString instanceof Date) {
      date = dateString;
    }
    else if (typeof dateString === 'string' && dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        if (parseInt(parts[0]) > 12) {
          date = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
          date = new Date(parts[2], parts[0] - 1, parts[1]);
        }
      }
    }
    else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      return dateString;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!formData.candidateSays || !formData.status) {
      toast.error('Please fill all required fields');
      setSubmitting(false);
      return;
    }

    try {
      const now = new Date();
      const formattedTimestamp = now.toISOString();

      const isTerminal = ['Joining', 'Reject', 'Complete'].includes(formData.status);

      const updateData = {
        tracker_status: formData.status,
        what_did_the_candidate_says: formData.candidateSays,
        next_call_date: isTerminal ? null : (formData.nextDate ? formatDOB(formData.nextDate) : null),
        actual: formattedTimestamp
      };

      await updateCallTrackerEnquiry(selectedItem.id, updateData);

      // If status is 'Joining', insert into joining_form
      if (formData.status === 'Joining') {
        try {
          // fetch last joining ID to generate new one
          const { data: lastData, error: lastError } = await getLatestJoiningFormId();

          let nextId = 'JOB001';
          if (!lastError && lastData && lastData.length > 0 && lastData[0].joining_id) {
            const lastId = lastData[0].joining_id;
            const match = lastId.match(/JOB(\d+)/);
            if (match) {
              const num = parseInt(match[1], 10);
              nextId = `JOB${String(num + 1).padStart(3, '0')}`;
            }
          }

          // Map fields
          const joiningPayload = {
            joining_id: nextId,
            name_as_per_aadhar: selectedItem.candidateName || 'Unknown Candidate',
            mobile_no: selectedItem.candidatePhone || '',
            personal_email: selectedItem.candidateEmail || null,
            department: selectedItem.department || 'Pending',
            designation: selectedItem.applyingForPost || 'Pending', // mapped from applyingForPost
            aadhar_card_number: selectedItem.aadharNo || 'Pending',
            date_of_birth: selectedItem.candidateDOB ? new Date(selectedItem.candidateDOB).toISOString().split('T')[0] : null,
            current_address: selectedItem.presentAddress || null,
            date_of_joining: formData.candidateSays || new Date().toISOString().split('T')[0], // Using 'candidateSays' or today
            father_name: 'Pending Update', // Placeholder to satisfy DB constraint
            gender: 'Other', // Placeholder to satisfy DB constraint
            family_mobile_no: selectedItem.lastEmployerMobile || null, // Best guess or empty
            relationship_with_family: null,
            highest_qualification: null,
            bank_account_no: null,
            ifsc_code: null,
            branch_name: null,
          };

          const { error: insertError } = await insertJoiningFormRecord(joiningPayload);

          if (insertError) {
            console.error('Error inserting into joining_form:', insertError);
            toast.error(`Failed to add to joining list: ${insertError.message}`);
          } else {
            toast.success('Added to Joining List');
          }

        } catch (jError) {
          console.error('Joining insert logic error:', jError);
        }
      }

      toast.success('Update successful!');
      setShowModal(false);
      fetchEnquiryData();

    } catch (error) {
      console.error('Submission failed:', error);
      toast.error(`Failed to update: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPendingData = pendingData.filter(item => {
    const matchesSearch = item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.candidateEnquiryNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredHistoryData = historyData.filter(item => {
    const matchesSearch = item.candidateEnquiryNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.candidateSays?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">Enquiry Status</h1>
          <p className="text-slate-500 mt-1 text-sm">Track and manage candidate enquiry updates</p>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {/* Toolbar: Tabs & Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-lg border border-slate-200/50">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === 'pending'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              onClick={() => setActiveTab('pending')}
            >
              <Clock size={16} className="inline mr-2" />
              Pending
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === 'pending' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
                }`}>
                {filteredPendingData.length}
              </span>
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === 'history'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              onClick={() => setActiveTab('history')}
            >
              <CheckCircle size={16} className="inline mr-2" />
              History
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === 'history' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
                }`}>
                {filteredHistoryData.length}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm w-full">
            <input
              type="text"
              placeholder="Search by candidate or enquiry no..."
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
                      Indent No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Enquiry No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Applying For Post
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Candidate Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Photo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50">
                      Resume
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="10" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-3"></div>
                          <span className="text-slate-500 text-sm font-medium">
                            Loading pending calls...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="10" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-red-500 space-y-2">
                          <p className="font-medium">Error: {error}</p>
                          <button
                            onClick={fetchEnquiryData}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                          >
                            Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPendingData.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-6 py-16 text-center bg-slate-50/50">
                        <p className="text-slate-500 text-sm">No pending calls found matching your search.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPendingData.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors duration-150 group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleCallClick(item)}
                            className="px-4 py-1.5 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 text-xs font-semibold shadow-sm shadow-indigo-200 transition-all transform hover:scale-105 active:scale-95"
                          >
                            Call Candidate
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {item.indentNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.candidateEnquiryNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.applyingForPost}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.department}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {item.candidateName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.candidatePhone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.candidateEmail}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.candidatePhoto ? (
                            <a
                              href={item.candidatePhoto}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.candidateResume ? (
                            <a
                              href={item.candidateResume}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
                            >
                              Resume
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === "history" && (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Enquiry No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Remarks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-3"></div>
                          <span className="text-slate-500 text-sm font-medium">
                            Loading call history...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredHistoryData.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-16 text-center bg-slate-50/50">
                        <p className="text-slate-500 text-sm">No call history found.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryData.map((item, index) => {
                      const isJoining = item.trackerStatus === 'Joining';
                      const displayRemarks = isJoining ? 'Joining Scheduled' : item.candidateSays;

                      // Helper to safely format YYYY-MM-DD
                      const formatDateSafe = (str) => {
                        if (!str) return "-";
                        if (typeof str === 'string' && str.match(/^\d{4}-\d{2}-\d{2}$/)) {
                          const [y, m, d] = str.split('-');
                          return `${d}/${m}/${y}`;
                        }
                        return formatDOB(str);
                      };

                      const displayDate = isJoining
                        ? formatDateSafe(item.candidateSays)
                        : (item.nextDate ? formatDateSafe(item.nextDate) : "-");

                      return (
                        <tr key={index} className="hover:bg-slate-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            {item.candidateEnquiryNo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 text-xs font-medium rounded-full border ${item.trackerStatus === "Joining"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : item.trackerStatus === "Reject"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}
                            >
                              {item.trackerStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={isJoining ? '' : item.candidateSays}>
                            {displayRemarks}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {displayDate}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono text-xs">
                            {formatDateTime(item.actual)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Call Modal */}
      {showModal && selectedItem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-xl font-semibold text-gray-800">
                Call Tracker
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Candidate Enquiry No. <span className="font-normal text-gray-400 lowercase">(इन्क्वायरी संख्या)</span>
                  </label>
                  <input
                    type="text"
                    value={selectedItem.candidateEnquiryNo}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm font-medium focus:outline-none cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status <span className="font-normal text-gray-400 lowercase">(स्थिति)</span> *
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none bg-white appearance-none"
                    required
                  >
                    <option value="">Select Status</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Interview">Interview - (साक्षात्कार)</option>
                    <option value="Negotiation">Negotiation - (बातचीत)</option>
                    <option value="On Hold">On Hold - (होल्ड पर)</option>
                    <option value="Joining">Joining - (भर्ती)</option>
                    <option value="Reject">Reject - (अस्वीकार)</option>
                  </select>
                </div>

                {/* Dynamic Label for Candidate Says Field */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {formData.status === "Negotiation"
                      ? "Customer Requirement *"
                      : formData.status === "On Hold"
                        ? "Reason For Holding *"
                        : formData.status === "Joining"
                          ? "Joining Date *"
                          : formData.status === "Reject"
                            ? "Rejection Reason *"
                            : "Candidate Remarks *"}
                  </label>
                  {formData.status === "Joining" ? (
                    <input
                      type="date"
                      name="candidateSays"
                      value={formData.candidateSays}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      required
                    />
                  ) : (
                    <textarea
                      name="candidateSays"
                      value={formData.candidateSays}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none resize-none placeholder:text-gray-300"
                      placeholder="Enter details here..."
                      required
                    />
                  )}
                </div>

                {/* Dynamic Label for Next Date Field */}
                {formData.status &&
                  !["Joining", "Reject"].includes(formData.status) && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {formData.status === "Interview"
                          ? "Schedule Date (निर्धारित तिथि) *"
                          : formData.status === "On Hold"
                            ? "Recall Date (वापसी की तिथि) *"
                            : "Next Date (अगली तारीख) *"}
                      </label>
                      <input
                        type="date"
                        name="nextDate"
                        value={formData.nextDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        required
                      />
                    </div>
                  )}

                <div className="pt-2">
                  <button
                    type="submit"
                    className={`w-full py-3.5 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform active:scale-95 flex items-center justify-center ${submitting ? "opacity-75 cursor-not-allowed" : ""}`}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving Update...
                      </>
                    ) : (
                      "Save Update"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="w-full mt-3 py-3 px-4 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
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

export default CallTracker;
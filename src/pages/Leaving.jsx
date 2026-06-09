
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Filter, Search, Clock, CheckCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import useDataStore from '../store/dataStore';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';

const Leaving = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    dateOfLeaving: '',
    mobileNumber: '',
    reasonOfLeaving: ''
  });

  const fetchJoiningData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      // Fetch data from Supabase users table
      const { data, error } = await supabase
        .from('users')
        .select('*');

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      // Process data to match existing UI structure
      const processedData = data.map(item => ({
        rowIndex: item.emp_id, // Using emp_id as unique identifier
        employeeNo: item.emp_id || '',
        candidateName: item.full_name || '',
        fatherName: '', // father_name is not in users schema
        dateOfJoining: item.joining_date || '',
        designation: item.designation || '',
        department: item.department || '',
        mobileNo: item.phone_number || item.mobile_number || '',
        firmName: item.firm_name || '', // Assuming this field might exist or be empty
        workingPlace: item.work_location || '',
        plannedDate: '', // Users table might not have this, leaving empty
        actual: '',
        leavingDate: '',
        reason: '',
      }));

      // Show all users who haven't left yet (filtering is done in the render logic via historyData check)
      setPendingData(processedData);
    } catch (error) {
      console.error('Error fetching users data:', error);
      setError(error.message);
      toast.error(`Failed to load users data: ${error.message}`);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  // Fetch leaving data
  // Fetch leaving data
  const fetchLeavingData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      // Fetch data from Supabase employee_leaving table joined with users
      const { data, error } = await supabase
        .from('employee_leaving')
        .select(`
          *,
          users (
            emp_id,
            full_name,
            joining_date,
            designation,
            department,
            phone_number
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      // Process data to match existing UI structure
      // Note: employee_leaving stores the leaving details. 
      // User details (name, designation etc) come from the joined users table.
      const processedData = data.map(item => ({
        timestamp: item.created_at || '',
        employeeId: item.emp_id || '',
        name: item.users?.full_name || '',
        dateOfLeaving: item.date_of_leaving || '',
        mobileNo: item.users?.phone_number || '', // Assuming phone_number is in users table
        reasonOfLeaving: item.reason_of_leaving || '',
        firmName: '', // Not in employee_leaving or users schema provided
        fatherName: '', // father_name not in users table
        dateOfJoining: item.users?.joining_date || '',
        workingLocation: '', // Not in provided schemas
        designation: item.users?.designation || '',
        department: item.users?.department || '',
        plannedDate: item.planned_date || '',
        actual: item.actual_date || '', // Schema says actual_date
      }));

      const historyTasks = processedData;
      setHistoryData(historyTasks);
    } catch (error) {
      console.error('Error fetching leaving data:', error);
      setError(error.message);
      toast.error(`Failed to load leaving data: ${error.message}`);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchJoiningData();
    fetchLeavingData();
  }, []);

  // Reset pagination when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  // Filter out employees who already have leaving records
  const filteredPendingData = pendingData
    .filter(item => {
      // Remove items that exist in history
      const isInHistory = historyData.some(historyItem =>
        historyItem.employeeId && item.employeeNo &&
        historyItem.employeeId.toString().trim() === item.employeeNo.toString().trim()
      );
      return !isInHistory;
    })
    .filter(item => {
      // Apply search filter
      const matchesSearch = item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.employeeNo?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

  const filteredHistoryData = historyData.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Calculate pagination
  const currentDataList = activeTab === 'pending' ? filteredPendingData : filteredHistoryData;
  const totalPages = Math.ceil(currentDataList.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = currentDataList.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleLeavingClick = (item) => {
    setSelectedItem(item);
    setFormData({
      dateOfLeaving: '',
      mobileNumber: item.mobileNo || '',
      reasonOfLeaving: ''
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

  const formatPlannedDate = (dateString) => {
    if (!dateString) return '';

    // Handle ISO date strings from Supabase
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // If it's already in a readable format, return as is
      return dateString;
    }

    // Format as "9/18/2025 13:56:18"
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const formatDOB = (dateString) => {
    if (!dateString) return '';

    // If it's already in dd/mm/yyyy format, return as is
    if (typeof dateString === 'string' && dateString.includes('/')) {
      return dateString;
    }

    // Handle ISO date strings from Supabase
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.dateOfLeaving || !formData.reasonOfLeaving) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const now = new Date();
      // Format timestamp as ISO string for Supabase
      const formattedTimestamp = now.toISOString();

      // Format leaving date for Supabase (ISO format for storage)
      const leavingDate = new Date(formData.dateOfLeaving);
      const formattedLeavingDate = leavingDate.toISOString();

      // First, update the JOINING table with leaving date and reason
      // Commented out as we are now using USERS table and IDs won't match joining table
      /* 
      const { error: updateError } = await supabase
        .from('joining')
        .update({
          leaving_date: formattedLeavingDate,
          reason: formData.reasonOfLeaving
        })
        .eq('id', selectedItem.rowIndex); // Using rowIndex which corresponds to id

      if (updateError) {
        throw new Error(`Failed to update JOINING table: ${updateError.message}`);
      }
      */

      // Then, insert the leaving record into the LEAVING table
      const { error: insertError } = await supabase
        .from('employee_leaving')
        .insert([
          {
            emp_id: selectedItem.employeeNo,
            reason_of_leaving: formData.reasonOfLeaving,
            date_of_leaving: formattedLeavingDate,
            planned_date: selectedItem.plannedDate || null,
            actual_date: selectedItem.actual || null
            // Other booleans default to false as per schema
          }
        ]);

      if (insertError) {
        throw new Error(`Failed to insert into LEAVING table: ${insertError.message}`);
      }

      setFormData({
        dateOfLeaving: '',
        reasonOfLeaving: '',
      });
      setShowModal(false);
      toast.success('Leaving request added successfully!');
      setSelectedItem(null);

      // Refresh both datasets
      await fetchJoiningData();
      await fetchLeavingData();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Something went wrong: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-11rem)] flex flex-col gap-4 sm:gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">Employee Leaving</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage employee exits and leaving history</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex-1 flex flex-col">
        {/* Toolbar: Tabs + Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
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

          <div className="relative max-w-xs w-full">
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

        {/* Tab Content items */}
        <div className="overflow-auto flex-1 custom-scrollbar relative">
          {activeTab === 'pending' && (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">EMP ID</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Father Name</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Of Joining</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Designation</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {tableLoading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex justify-center flex-col items-center">
                        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin mb-2"></div>
                        <span className="text-slate-500 text-sm">Loading pending records...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="bg-red-50 text-red-600 rounded-lg p-4 inline-block">
                        <p>Error: {error}</p>
                        <button
                          onClick={fetchJoiningData}
                          className="mt-2 text-sm font-medium underline hover:text-red-800"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleLeavingClick(item)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          Mark Leaving
                        </button>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">{item.employeeNo}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.candidateName}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">{item.fatherName}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.dateOfJoining ? formatDOB(item.dateOfJoining) : '-'}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">{item.designation}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">{item.department}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                      No pending leaving requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'history' && (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">EMP ID</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name </th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Of Joining</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Of Leaving</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Designation</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason Of Leaving</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {tableLoading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex justify-center flex-col items-center">
                        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin mb-2"></div>
                        <span className="text-slate-500 text-sm">Loading history...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <p className="text-red-500">Error: {error}</p>
                      <button
                        onClick={fetchLeavingData}
                        className="mt-2 text-sm font-medium underline"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">{item.employeeId}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.dateOfJoining ? formatDOB(item.dateOfJoining) : '-'}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.dateOfLeaving ? formatDOB(item.dateOfLeaving) : '-'}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">{item.designation}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500">{item.department}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-500 max-w-xs truncate" title={item.reasonOfLeaving}>{item.reasonOfLeaving}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                      No leaving history found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {currentDataList.length > 0 && !tableLoading && (
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex items-center justify-between shrink-0">
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, currentDataList.length)}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, currentDataList.length)}</span> of{' '}
              <span className="font-medium">{currentDataList.length}</span> results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg border border-slate-200 transition-all ${currentPage === 1
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm'}`}
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Logic to show a window of pages around current page if strict pagination is needed, 
                  // but for simplicity with small data sizes, just showing first 5 or simpler logic is often okay.
                  // Implemented a simple sliding window logic here for better UX
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
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${currentPage === pageNum
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-indigo-600'
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
                className={`p-2 rounded-lg border border-slate-200 transition-all ${currentPage === totalPages
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm'}`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedItem && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-all duration-300">
          <div
            className="absolute inset-0 bg-transparent"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <h3 className="text-xl font-semibold text-slate-800 tracking-tight">Leaving Form</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">EMP ID</label>
                <input
                  type="text"
                  value={selectedItem.employeeNo}
                  disabled
                  className="block w-full rounded-xl border-slate-200 bg-slate-50 text-slate-500 px-3 py-2.5 sm:text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Name (नाम)</label>
                <input
                  type="text"
                  value={selectedItem.candidateName}
                  disabled
                  className="block w-full rounded-xl border-slate-200 bg-slate-50 text-slate-500 px-3 py-2.5 sm:text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Date Of Leaving (छोड़ने का दिनांक) <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  name="dateOfLeaving"
                  value={formData.dateOfLeaving}
                  onChange={handleInputChange}
                  className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 bg-white text-slate-800 font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Mobile Number (मोबाइल नंबर)</label>
                <input
                  type="tel"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                  className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 bg-white text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Reason Of Leaving (छोड़ने का कारण) <span className="text-red-500">*</span></label>
                <textarea
                  name="reasonOfLeaving"
                  value={formData.reasonOfLeaving}
                  onChange={handleInputChange}
                  rows={3}
                  className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 bg-white text-slate-800 font-medium resize-none"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-6 py-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 text-sm font-medium transition-all transform hover:-translate-y-0.5 ${submitting ? 'opacity-70 cursor-not-allowed transform-none' : ''
                    }`}
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center">
                      <svg
                        className="animate-spin h-4 w-4 text-white mr-2"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Submitting...</span>
                    </div>
                  ) : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Leaving;
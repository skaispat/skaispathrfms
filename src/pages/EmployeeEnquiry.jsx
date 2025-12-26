// Changed From Find Enquiry to Employee Enquiry
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, CheckCircle, X, Upload, Plus } from 'lucide-react';
import useDataStore from '../store/dataStore';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';

const EmployeeEnquiry = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [indentData, setIndentData] = useState([]);
  const [enquiryData, setEnquiryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [generatedCandidateNo, setGeneratedCandidateNo] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  const [formData, setFormData] = useState({
    candidateName: '',
    candidateDOB: '',
    candidatePhone: '',
    candidateEmail: '',
    previousCompany: '',
    jobExperience: '',
    department: '',
    previousPosition: '',
    reasonForLeaving: '',
    maritalStatus: '',
    lastEmployerMobile: '',
    candidatePhoto: null,
    candidateResume: null,
    presentAddress: '',
    referenceBy: '',
    aadharNo: '',
    status: 'NeedMore'
  });



  // Fetch all necessary data
  const fetchAllData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      // Fetch JOB VACANCY data from Supabase
      const { data: indentResult, error: indentError } = await supabase
        .from('job_vacancy')
        .select('*')
        .eq('status', 'NeedMore');

      if (indentError) {
        throw new Error(`Supabase error: ${indentError.message}`);
      }

      const processedIndentData = indentResult.map(row => ({
        id: row.id,
        indentNo: row.indent_number,
        post: row.post,
        department: row.department,
        gender: row.gender,
        prefer: row.prefer,
        numberOfPost: row.number_of_posts,
        competitionDate: row.completion_date,
        socialSite: row.social_site,
        status: row.status,
        experience: row.experience,
      }));

      // Fetch EMPLOYEE ENQUIRY data from Supabase
      const { data: enquiryResult, error: enquiryError } = await supabase
        .from('employee_enquiry')
        .select('*');

      if (enquiryError) {
        throw new Error(`Supabase error: ${enquiryError.message}`);
      }

      // Count completed recruitments per indent number
      const indentRecruitmentCount = {};

      enquiryResult.forEach(row => {
        const indentNo = row.indent_number;
        const statusValue = row.tracker_status;

        if (indentNo && statusValue) {
          if (!indentRecruitmentCount[indentNo]) {
            indentRecruitmentCount[indentNo] = 0;
          }
          indentRecruitmentCount[indentNo]++;
        }
      });

      // Filter out indent items where recruitment is complete
      const pendingTasks = processedIndentData.filter(task => {
        const indentNo = task.indentNo;
        const requiredPosts = parseInt(task.numberOfPost) || 0;
        const completedRecruitments = indentRecruitmentCount[indentNo] || 0;

        // Show in pending only if not all required posts are filled
        return completedRecruitments < requiredPosts;
      });

      setIndentData(pendingTasks);

      // Process ENQUIRY data for history tab
      const processedEnquiryData = enquiryResult.map(row => ({
        id: row.id,
        indentNo: row.indent_number,
        candidateEnquiryNo: row.candidate_enquiry_number,
        applyingForPost: row.applying_for_post,
        department: row.department,
        candidateName: row.candidate_name,
        candidateDOB: row.dob,
        candidatePhone: row.candidate_phone_number,
        candidateEmail: row.candidate_email,
        previousCompany: row.previous_company_name,
        jobExperience: row.job_experience || '',
        lastSalary: '', // Not in the new schema
        previousPosition: row.previous_position || '',
        reasonForLeaving: row.reason_of_leaving_previous_company || '',
        maritalStatus: row.marital_status || '',
        lastEmployerMobile: row.last_employer_mobile_number || '',
        candidatePhoto: row.candidate_photo || '',
        candidateResume: row.resume_copy || '',
        referenceBy: row.reference_by || '',
        presentAddress: row.present_address || '',
        aadharNo: row.aadhar_number || '',
        timestamp: row.timestamp,
        planned: row.planned,
        actual: row.actual,
        timeDelay: row.time_delay,
        whatDidCandidateSay: row.what_did_the_candidate_says,
        trackerStatus: row.tracker_status,
        nextCallDate: row.next_call_date,
        nextPlanned: row.next_planned,
        nextActual: row.next_actual
      }));

      setEnquiryData(processedEnquiryData);

    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  const generateNextAAPIndentNumber = () => {
    // Extract all indent numbers from both indentData and enquiryData
    const allIndentNumbers = [
      ...indentData.map(item => item.indentNo),
      ...enquiryData.map(item => item.indentNo)
    ].filter(Boolean); // Remove empty/null values

    // Find the highest AAP number
    let maxAAPNumber = 0;

    allIndentNumbers.forEach(indentNo => {
      const match = indentNo.match(/^AAP-(\d+)$/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxAAPNumber) {
          maxAAPNumber = num;
        }
      }
    });

    // Return the next AAP number
    const nextNumber = maxAAPNumber + 1;
    return `AAP-${String(nextNumber).padStart(2, '0')}`;
  };

  // Generate candidate number based on existing enquiries
  const generateCandidateNumber = () => {
    if (enquiryData.length === 0) {
      return 'ENQ-01';
    }

    // Find the highest existing candidate number
    const lastNumber = enquiryData.reduce((max, enquiry) => {
      if (!enquiry.candidateEnquiryNo) return max;

      const match = enquiry.candidateEnquiryNo.match(/ENQ-(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);

    const nextNumber = lastNumber + 1;
    return `ENQ-${String(nextNumber).padStart(2, '0')}`;
  };

  // Upload file to Supabase Storage
  const uploadFileToSupabase = async (file, type) => {
    try {
      if (!file) return null;

      const fileExt = file.name.split('.').pop();
      // key structure: enquiry/candidateNo_type_timestamp.ext
      const fileName = `enquiry/${generatedCandidateNo}_${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading file to Supabase:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const historyData = enquiryData;

  const handleEnquiryClick = (item = null) => {
    let indentNo = '';
    let isNewAAP = false;

    if (item) {
      setSelectedItem(item);
      indentNo = item.indentNo;
    } else {
      // Generate a new AAP indent number for new enquiries
      indentNo = generateNextAAPIndentNumber();
      isNewAAP = true;

      // Create a default empty item for new enquiry
      setSelectedItem({
        indentNo: indentNo,
        post: '',
        gender: '',
        prefer: '',
        numberOfPost: '',
        competitionDate: '',
        socialSite: '',
        status: 'NeedMore',
        plannedDate: '',
        actual: '',
        experience: ''
      });
    }


    const candidateNo = generateCandidateNumber();
    setGeneratedCandidateNo(candidateNo);
    setFormData({
      candidateName: '',
      candidateDOB: '',
      candidatePhone: '',
      candidateEmail: '',
      previousCompany: '',
      jobExperience: '',
      department: item ? item.department : '',
      lastSalary: '',
      previousPosition: '',
      reasonForLeaving: '',
      maritalStatus: '',
      lastEmployerMobile: '',
      candidatePhoto: null,
      candidateResume: null,
      referenceBy: '',
      presentAddress: '',
      aadharNo: '',
      status: 'NeedMore'
    });
    setShowModal(true);
  };

  const formatDOB = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return as-is if not a valid date
    }

    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear().toString().slice(-2);

    return `${day}-${month}-${year}`;
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let photoUrl = '';
      let resumeUrl = '';

      // Upload photo if exists
      if (formData.candidatePhoto) {
        setUploadingPhoto(true);
        photoUrl = await uploadFileToSupabase(formData.candidatePhoto, 'photo');
        setUploadingPhoto(false);
        toast.success('Photo uploaded successfully!');
      }

      // Upload resume if exists
      if (formData.candidateResume) {
        setUploadingResume(true);
        resumeUrl = await uploadFileToSupabase(formData.candidateResume, 'resume');
        setUploadingResume(false);
        toast.success('Resume uploaded successfully!');
      }

      // Create timestamp
      const now = new Date();
      const formattedTimestamp = now.toISOString();

      // Insert into EMPLOYEE ENQUIRY table
      const enquiryData = {
        timestamp: formattedTimestamp,
        indent_number: selectedItem.indentNo,
        candidate_enquiry_number: generatedCandidateNo,
        applying_for_post: selectedItem.post,
        candidate_name: formData.candidateName,
        dob: formData.candidateDOB,
        candidate_phone_number: formData.candidatePhone,
        candidate_email: formData.candidateEmail,
        previous_company_name: formData.previousCompany || '',
        job_experience: formData.jobExperience || '',
        department: formData.department || '',
        previous_position: formData.previousPosition || '',
        reason_of_leaving_previous_company: formData.reasonForLeaving || '',
        marital_status: formData.maritalStatus || '',
        last_employer_mobile_number: formData.lastEmployerMobile || '',
        candidate_photo: photoUrl,
        reference_by: formData.referenceBy || '',
        present_address: formData.presentAddress || '',
        aadhar_number: formData.aadharNo || '',
        resume_copy: resumeUrl,
        tracker_status: formData.status
        // Other fields like planned, actual, etc. are initially null
      };

      const { error: insertError } = await supabase
        .from('employee_enquiry')
        .insert([enquiryData]);

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Only update JOB VACANCY table if status is Complete
      if (formData.status === 'Complete') {
        // Update JOB VACANCY table
        const { error: updateError } = await supabase
          .from('job_vacancy')
          .update({
            status: 'Complete'
          })
          .eq('indent_number', selectedItem.indentNo);

        if (updateError) {
          console.error('JOB VACANCY update failed:', updateError.message);
        }

        toast.success('Enquiry submitted and Job Vacancy marked as Complete!');
      } else {
        toast.success('Enquiry submitted successfully!');
      }

      setShowModal(false);
      fetchAllData();

    } catch (error) {
      console.error('Submission error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
      setUploadingPhoto(false);
      setUploadingResume(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      setFormData(prev => ({
        ...prev,
        [field]: file
      }));
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = (data) => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  };

  const filteredPendingData = sortedData(indentData.filter(item => {
    const matchesSearch = item.post?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.indentNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }));

  const filteredHistoryData = sortedData(historyData.filter(item => {
    const matchesSearch = item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.candidateEnquiryNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.indentNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }));

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Decide which data to paginate based on active tab
  const dataToPaginate = activeTab === 'pending' ? filteredPendingData : filteredHistoryData;
  const currentData = dataToPaginate.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Reset to first page when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);


  return (
    <div className="h-full flex flex-col gap-4 sm:gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Employee Enquiry</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage job enquiries and candidate details</p>
        </div>
        <button
          onClick={() => handleEnquiryClick()}
          className="inline-flex items-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus size={18} className="mr-2" />
          New Enquiry
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {/* Filters and Tabs */}
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
              placeholder="Search enquiries..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {activeTab === "pending" && (
            <>
              <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 sm:px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                        Action
                      </th>
                      {[
                        { key: 'indentNo', label: 'Indent No.' },
                        { key: 'post', label: 'Post' },
                        { key: 'department', label: 'Department' },
                        { key: 'gender', label: 'Gender' },
                        { key: 'prefer', label: 'Prefer' },
                        { key: 'numberOfPost', label: 'Number Of Post' },
                        { key: 'competitionDate', label: 'Competition Date' }
                      ].map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-3 sm:px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                          onClick={() => handleSort(col.key)}
                        >
                          <div className="flex items-center space-x-1 group">
                            <span>{col.label}</span>
                            {sortConfig.key === col.key ? (
                              <span className="text-indigo-600 font-bold">
                                {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                              </span>
                            ) : (
                              <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                ↕
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {tableLoading ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-12 text-center">
                          <div className="flex justify-center flex-col items-center">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-3"></div>
                            <span className="text-slate-500 text-sm font-medium">
                              Loading pending enquiries...
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : currentData.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-16 text-center bg-slate-50/50">
                          <p className="text-slate-500 text-sm">
                            No pending enquiries found.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      currentData.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors duration-150">
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleEnquiryClick(item)}
                              className="px-4 py-1.5 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 text-xs font-semibold shadow-sm shadow-indigo-200 transition-all transform hover:scale-105 active:scale-95"
                            >
                              Enquiry
                            </button>
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            {item.indentNo}
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                            {item.post}
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                            {item.department}
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.gender === 'Male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'}`}>
                              {item.gender}
                            </span>
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                            {item.prefer || "-"} {item.experience}
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                            {item.numberOfPost}
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-slate-600">
                            {item.competitionDate
                              ? new Date(
                                item.competitionDate
                              ).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                              : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination - Fixed at bottom */}
              <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === Math.ceil(filteredPendingData.length / itemsPerPage)}
                      className={`ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 ${currentPage === Math.ceil(filteredPendingData.length / itemsPerPage) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-slate-600">
                        Showing <span className="font-medium text-slate-900">{indexOfFirstItem + 1}</span> to <span className="font-medium text-slate-900">{Math.min(indexOfLastItem, filteredPendingData.length)}</span> of <span className="font-medium text-slate-900">{filteredPendingData.length}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => paginate(currentPage - 1)}
                          disabled={currentPage === 1}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {/* Page Numbers */}
                        {Array.from({ length: Math.ceil(filteredPendingData.length / itemsPerPage) }).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => paginate(idx + 1)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === idx + 1
                              ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                              : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                              }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => paginate(currentPage + 1)}
                          disabled={currentPage === Math.ceil(filteredPendingData.length / itemsPerPage)}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 ${currentPage === Math.ceil(filteredPendingData.length / itemsPerPage) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "history" && (
            <>
              <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      {[
                        { key: 'timestamp', label: 'Timestamp' },
                        { key: 'indentNo', label: 'Indent No' },
                        { key: 'candidateEnquiryNo', label: 'Candidate Enquiry No' },
                        { key: 'applyingForPost', label: 'Applying For Post' },
                        { key: 'candidateName', label: 'Candidate Name' },
                        { key: 'candidateDOB', label: 'DOB' },
                        { key: 'candidatePhone', label: 'Phone' },
                        { key: 'candidateEmail', label: 'Email' },
                        { key: 'previousCompany', label: 'Previous Company' },
                        { key: 'jobExperience', label: 'Experience' },
                        { key: 'department', label: 'Department' },
                        { key: 'previousPosition', label: 'Previous Position' },
                        { key: 'reasonForLeaving', label: 'Reason Of Leaving' },
                        { key: 'maritalStatus', label: 'Marital Status' },
                        { key: 'lastEmployerMobile', label: 'Last Employer Mobile' },
                        { key: 'candidatePhoto', label: 'Photo' },
                        { key: 'referenceBy', label: 'Reference By' },
                        { key: 'presentAddress', label: 'Address' },
                        { key: 'aadharNo', label: 'Aadhar' },
                        { key: 'candidateResume', label: 'Resume' },
                        { key: 'planned', label: 'Planned' },
                        { key: 'actual', label: 'Actual' },
                        { key: 'timeDelay', label: 'Time Delay' },
                        { key: 'whatDidCandidateSay', label: 'Candidate Comments' },
                        { key: 'trackerStatus', label: 'Status' },
                        { key: 'nextCallDate', label: 'Next Call Date' },
                        { key: 'nextPlanned', label: 'Next Planned' },
                        { key: 'nextActual', label: 'Next Actual' }
                      ].map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-3 sm:px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200 whitespace-nowrap"
                          onClick={() => handleSort(col.key)}
                        >
                          <div className="flex items-center space-x-1 group">
                            <span>{col.label}</span>
                            {sortConfig.key === col.key ? (
                              <span className="text-indigo-600 font-bold">
                                {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                              </span>
                            ) : (
                              <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                ↕
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {tableLoading ? (
                      <tr>
                        <td colSpan="28" className="px-6 py-12 text-center">
                          <div className="flex justify-center flex-col items-center">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-3"></div>
                            <span className="text-slate-500 text-sm font-medium">
                              Loading enquiry history...
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : currentData.length === 0 ? (
                      <tr>
                        <td colSpan="28" className="px-6 py-16 text-center bg-slate-50/50">
                          <p className="text-slate-500 text-sm">
                            No enquiry history found.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      currentData.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.indentNo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.candidateEnquiryNo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.applyingForPost}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.candidateName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.candidateDOB ? new Date(item.candidateDOB).toLocaleDateString() : '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.candidatePhone}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.candidateEmail}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.previousCompany}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.jobExperience}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.department}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.previousPosition}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.reasonForLeaving}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.maritalStatus}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.lastEmployerMobile}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            {item.candidatePhoto ? (
                              <a href={item.candidatePhoto} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-900 font-medium">View</a>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.referenceBy}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.presentAddress}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.aadharNo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            {item.candidateResume ? (
                              <a href={item.candidateResume} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-900 font-medium">View</a>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.planned ? new Date(item.planned).toLocaleString() : '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.actual ? new Date(item.actual).toLocaleString() : '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.timeDelay}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.whatDidCandidateSay}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.trackerStatus === 'Joining' ? 'bg-green-50 text-green-700 border-green-200' :
                              item.trackerStatus === 'Reject' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }`}>
                              {item.trackerStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.nextCallDate ? new Date(item.nextCallDate).toLocaleDateString() : '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.nextPlanned ? new Date(item.nextPlanned).toLocaleString() : '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.nextActual ? new Date(item.nextActual).toLocaleString() : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination - Fixed at bottom */}
              <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0">
                <div className="flex items-center justify-between">
                  {/* Mobile Pagination */}
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === Math.ceil(filteredHistoryData.length / itemsPerPage)}
                      className={`ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 ${currentPage === Math.ceil(filteredHistoryData.length / itemsPerPage) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Next
                    </button>
                  </div>

                  {/* Desktop Pagination */}
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-slate-600">
                        Showing <span className="font-medium text-slate-900">{indexOfFirstItem + 1}</span> to <span className="font-medium text-slate-900">{Math.min(indexOfLastItem, filteredHistoryData.length)}</span> of <span className="font-medium text-slate-900">{filteredHistoryData.length}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => paginate(currentPage - 1)}
                          disabled={currentPage === 1}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {/* Page Numbers */}
                        {Array.from({ length: Math.ceil(filteredHistoryData.length / itemsPerPage) }).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => paginate(idx + 1)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === idx + 1
                              ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                              : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                              }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => paginate(currentPage + 1)}
                          disabled={currentPage === Math.ceil(filteredHistoryData.length / itemsPerPage)}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 ${currentPage === Math.ceil(filteredHistoryData.length / itemsPerPage) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div >
      </div >

      {showModal && selectedItem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all">

            {/* Header */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-semibold text-gray-800">Edit Enquiry Details</h2>
              <div className="flex items-center gap-2">

                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Section: Job Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Indent No. <span className="font-normal text-gray-400 lowercase">(इंडेंट नंबर)</span>
                    </label>
                    <input
                      type="text"
                      value={selectedItem.indentNo}
                      disabled
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm font-medium focus:outline-none cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Enquiry No. <span className="font-normal text-gray-400 lowercase">(इन्क्वायरी संख्या)</span>
                    </label>
                    <input
                      type="text"
                      value={generatedCandidateNo}
                      disabled
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm font-medium focus:outline-none cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Post <span className="font-normal text-gray-400 lowercase">(पद)</span>
                    </label>
                    <input
                      type="text"
                      value={selectedItem.post}
                      onChange={(e) => {
                        setSelectedItem((prev) => ({
                          ...prev,
                          post: e.target.value,
                        }));
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Department <span className="font-normal text-gray-400 lowercase">(विभाग)</span>
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none bg-white"
                    >
                      <option value="">Select Department</option>
                      <option value="Hr">Hr</option>
                      <option value="Admin">Admin</option>
                      <option value="Sms">Sms</option>
                      <option value="Rolling mill">Rolling mill</option>
                      <option value="Sms Lab">Sms Lab</option>
                      <option value="Dispatch">Dispatch</option>
                      <option value="R/M Purchase">R/M Purchase</option>
                      <option value="Store Purchase">Store Purchase</option>
                      <option value="Store">Store</option>
                      <option value="WB (Weightment Bridge)">WB (Weightment Bridge)</option>
                      <option value="HouseKeeping">HouseKeeping</option>
                      <option value="Health & Safety">Health & Safety</option>
                      <option value="Accounts">Accounts</option>
                      <option value="Sales">Sales</option>
                      <option value="AUTOMOBILE">AUTOMOBILE</option>
                    </select>
                  </div>
                </div>

                <div className="h-px bg-gray-100 my-4"></div>

                {/* Section: Candidate Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Full Name <span className="font-normal text-gray-400 lowercase">(पुरा नाम)</span> <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="candidateName"
                      value={formData.candidateName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none placeholder:text-gray-300"
                      placeholder="Enter candidate full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Date of Birth <span className="font-normal text-gray-400 lowercase">(जन्म तिथि)</span>
                    </label>
                    <input
                      type="date"
                      name="candidateDOB"
                      value={formData.candidateDOB}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Phone Number <span className="font-normal text-gray-400 lowercase">(फ़ोन नंबर)</span> <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="candidatePhone"
                      value={formData.candidatePhone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      placeholder="Ex: 9876543210"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Email Address <span className="font-normal text-gray-400 lowercase">(ईमेल)</span>
                    </label>
                    <input
                      type="email"
                      name="candidateEmail"
                      value={formData.candidateEmail}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      placeholder="Ex: john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Marital Status <span className="font-normal text-gray-400 lowercase">(वैवाहिक स्थिति)</span>
                    </label>
                    <select
                      name="maritalStatus"
                      value={formData.maritalStatus}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none bg-white"
                    >
                      <option value="">Select Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Aadhar No. <span className="font-normal text-gray-400 lowercase">(आधार नं)</span> <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="aadharNo"
                      value={formData.aadharNo}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      placeholder="Ex: 1234 5678 9012"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Current Address <span className="font-normal text-gray-400 lowercase">(वर्तमान पता)</span>
                  </label>
                  <textarea
                    name="presentAddress"
                    value={formData.presentAddress}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none resize-none"
                    placeholder="Enter full address"
                  />
                </div>

                <div className="h-px bg-gray-100 my-4"></div>

                {/* Section: Experience & History */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Previous Company <span className="font-normal text-gray-400 lowercase">(पिछली कंपनी)</span>
                    </label>
                    <input
                      type="text"
                      name="previousCompany"
                      value={formData.previousCompany}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      placeholder="Ex: Tech Solutions Pvt Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Job Experience <span className="font-normal text-gray-400 lowercase">(काम का अनुभव)</span>
                    </label>
                    <input
                      type="text"
                      name="jobExperience"
                      value={formData.jobExperience}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      placeholder="Ex: 2 Years"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Previous Position <span className="font-normal text-gray-400 lowercase">(पिछला पद)</span>
                    </label>
                    <input
                      type="text"
                      name="previousPosition"
                      value={formData.previousPosition}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      placeholder="Ex: Software Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Reason For Leaving <span className="font-normal text-gray-400 lowercase">(छोड़ने का कारण)</span>
                    </label>
                    <input
                      type="text"
                      name="reasonForLeaving"
                      value={formData.reasonForLeaving}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      placeholder="Reason for leaving previous company"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Last Employer Mobile <span className="font-normal text-gray-400 lowercase">(अंतिम नियोक्ता मोबाइल)</span>
                    </label>
                    <input
                      type="tel"
                      name="lastEmployerMobile"
                      value={formData.lastEmployerMobile}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      placeholder="Ex: 9876543210"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Reference By <span className="font-normal text-gray-400 lowercase">(संदर्भ)</span>
                    </label>
                    <input
                      type="text"
                      name="referenceBy"
                      value={formData.referenceBy}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      placeholder="Referral name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Status <span className="font-normal text-gray-400 lowercase">(स्थिति)</span> <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none bg-white"
                      required
                    >
                      <option value="NeedMore">Need More</option>
                      <option value="Complete">Complete</option>
                    </select>
                  </div>
                </div>

                <div className="h-px bg-gray-100 my-4"></div>

                {/* Section: Documents */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Candidate Photo <span className="font-normal text-gray-400 lowercase">(फोटो)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="photo-upload"
                        className="flex items-center px-4 py-2.5 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 text-gray-600 transition-colors text-sm font-medium"
                      >
                        <Upload size={16} className="mr-2 text-indigo-500" />
                        {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => handleFileChange(e, "candidatePhoto")}
                        className="hidden"
                        id="photo-upload"
                      />
                      {formData.candidatePhoto && !uploadingPhoto && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded max-w-[150px] truncate">
                          {formData.candidatePhoto.name}
                        </span>
                      )}
                      {uploadingPhoto && (
                        <div className="w-5 h-5 border-2 border-indigo-500 border-dashed rounded-full animate-spin"></div>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 ml-1">JPG, PNG, PDF (Max 10MB)</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Candidate Resume <span className="font-normal text-gray-400 lowercase">(बायोडाटा)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="resume-upload"
                        className="flex items-center px-4 py-2.5 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 text-gray-600 transition-colors text-sm font-medium"
                      >
                        <Upload size={16} className="mr-2 text-indigo-500" />
                        {uploadingResume ? "Uploading..." : "Upload Resume"}
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(e, "candidateResume")}
                        className="hidden"
                        id="resume-upload"
                      />
                      {formData.candidateResume && !uploadingResume && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded max-w-[150px] truncate">
                          {formData.candidateResume.name}
                        </span>
                      )}
                      {uploadingResume && (
                        <div className="w-5 h-5 border-2 border-indigo-500 border-dashed rounded-full animate-spin"></div>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 ml-1">PDF, DOC, DOCX (Max 10MB)</p>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white pb-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm transition-all"
                    disabled={submitting || uploadingPhoto || uploadingResume}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-medium text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center"
                    disabled={submitting || uploadingPhoto || uploadingResume}
                  >
                    {submitting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      "Save Enquiry"
                    )}
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

export default EmployeeEnquiry;
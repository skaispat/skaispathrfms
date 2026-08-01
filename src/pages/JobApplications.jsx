import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Eye, FileText, X, Download, Clock, Phone, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { getJobLeadsForEnquiry } from '../api/employeeEnquiryApi';

const JobApplications = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Pagination and Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'descending' });

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await getJobLeadsForEnquiry();
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching job leads:', error);
      toast.error('Failed to fetch job leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...leads].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const valA = a[sortConfig.key] || '';
    const valB = b[sortConfig.key] || '';

    if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
    return 0;
  });

  const filteredData = sortedData.filter(lead => {
    const term = searchTerm.toLowerCase();
    return (
      (lead.candidate_name && lead.candidate_name.toLowerCase().includes(term)) ||
      (lead.post && lead.post.toLowerCase().includes(term)) ||
      (lead.candidate_phone && lead.candidate_phone.includes(term))
    );
  });

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const openDetailsModal = (lead) => {
    setSelectedLead(lead);
    setShowModal(true);
  };

  const renderParsedSkills = (skillsJson) => {
    if (!skillsJson) return <span className="text-gray-500 italic">No skills specified</span>;
    try {
      const skills = JSON.parse(skillsJson);
      if (Object.keys(skills).length === 0) return <span className="text-gray-500 italic">No skills specified</span>;

      return (
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(skills).map(([skill, exp]) => (
            <div key={skill} className="flex flex-col border border-gray-200 rounded-lg p-2 bg-gray-50 min-w-[120px]">
              <span className="text-xs font-bold text-[#800000]">{skill}</span>
              <span className="text-xs text-gray-600">{exp ? `${exp} Years` : 'Fresher'}</span>
            </div>
          ))}
        </div>
      );
    } catch (e) {
      return <span className="text-gray-500 italic">Invalid skills data</span>;
    }
  };

  return (
    <div className="h-[calc(100vh-11rem)] sm:h-full flex flex-col gap-4 sm:gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">Job Applications</h1>
            <span className="md:hidden inline-flex items-center text-[10px] font-bold text-[#800000] bg-[#800000]/10 px-2 py-0.5 rounded-full border border-[#800000]/20 whitespace-nowrap">
              {leads.length} Total
            </span>
          </div>
          <p className="text-slate-500 mt-1 text-sm">View and manage candidate applications</p>
        </div>

        {/* Search & Stats Wrapper */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
          <div className="relative w-full md:w-72 lg:w-80">
            <input
              type="text"
              placeholder="Search applications..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] text-gray-900 placeholder-gray-400 transition-all text-sm font-medium shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          <div className="hidden md:flex shrink-0 items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <FileText size={18} className="text-[#800000]" />
            <span className="font-bold text-slate-700 whitespace-nowrap">Total: {leads.length}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col">

        {/* Table Container */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {[
                      { key: 'created_at', label: 'Date Applied' },
                      { key: 'candidate_name', label: 'Candidate Name' },
                      { key: 'post', label: 'Applied For' },
                      { key: 'candidate_phone', label: 'Phone' },
                      { key: 'candidate_experience', label: 'Experience' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="px-4 py-3 sm:px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                        onClick={() => handleSort(col.key)}
                      >
                        <div className="flex items-center space-x-1 group">
                          <span>{col.label}</span>
                          {sortConfig.key === col.key ? (
                            <span className="text-[#800000] font-bold">
                              {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                              ↕
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 sm:px-6 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Resume
                    </th>
                    <th className="px-4 py-3 sm:px-6 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-8 h-8 border-4 border-[#800000] border-dashed rounded-full animate-spin mb-3"></div>
                          <span className="text-gray-500 text-sm font-medium">Loading applications...</span>
                        </div>
                      </td>
                    </tr>
                  ) : currentData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <Search size={24} className="text-gray-400" />
                          </div>
                          <span className="text-gray-500 font-medium">No applications found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentData.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => openDetailsModal(lead)}>
                        <td className="px-4 py-3 sm:px-6 whitespace-nowrap text-sm text-gray-500 font-medium">
                          {new Date(lead.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">{lead.candidate_name}</div>
                        </td>
                        <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#800000]/10 text-[#800000]">
                            {lead.post}
                          </span>
                        </td>
                        <td className="px-4 py-3 sm:px-6 whitespace-nowrap text-sm text-gray-600 font-medium">
                          {lead.candidate_phone}
                        </td>
                        <td className="px-4 py-3 sm:px-6 whitespace-nowrap text-sm text-gray-600 font-medium">
                          {lead.candidate_experience || 'Fresher'}
                        </td>
                        <td className="px-4 py-3 sm:px-6 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                          {lead.candidate_resume ? (
                            <a
                              href={lead.candidate_resume}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center p-2 text-[#800000] hover:bg-[#800000]/10 rounded-lg transition-colors"
                              title="Download Resume"
                            >
                              <Download size={18} />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md">No Resume</span>
                          )}
                        </td>
                        <td className="px-4 py-3 sm:px-6 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={(e) => { e.stopPropagation(); openDetailsModal(lead); }}
                            className="text-[#800000] hover:text-[#600000] bg-[#800000]/5 hover:bg-[#800000]/10 p-2 rounded-lg transition-colors inline-flex items-center justify-center"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col p-3 gap-3 bg-gray-50/50">
              {loading ? (
                <div className="py-12 flex justify-center flex-col items-center">
                  <div className="w-8 h-8 border-4 border-[#800000] border-dashed rounded-full animate-spin mb-3"></div>
                  <span className="text-gray-500 text-sm font-medium">Loading applications...</span>
                </div>
              ) : currentData.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center bg-white rounded-xl border border-gray-100">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <Search size={20} className="text-gray-400" />
                  </div>
                  <span className="text-gray-500 font-medium text-sm">No applications found</span>
                </div>
              ) : (
                currentData.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col gap-3 active:scale-[0.99] transition-transform"
                    onClick={() => openDetailsModal(lead)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900 leading-tight">{lead.candidate_name}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">{new Date(lead.created_at).toLocaleDateString('en-GB')}</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#800000]/10 text-[#800000] shrink-0 text-right">
                        {lead.post}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50/50 p-2.5 rounded-lg border border-gray-50">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Phone</span>
                        <span className="font-medium text-gray-900 text-xs mt-0.5">{lead.candidate_phone}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Experience</span>
                        <span className="font-medium text-gray-900 text-xs mt-0.5">{lead.candidate_experience || 'Fresher'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-100">
                      {lead.candidate_resume ? (
                        <a
                          href={lead.candidate_resume}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-[#800000] bg-[#800000]/5 hover:bg-[#800000]/10 px-3 py-1.5 rounded-lg flex items-center transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <Download size={14} className="mr-1.5" /> Resume
                        </a>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-medium px-2 py-1 bg-gray-50 rounded-lg">No Resume</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openDetailsModal(lead); }}
                        className="text-gray-600 hover:text-[#800000] text-xs font-bold flex items-center px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Eye size={14} className="mr-1.5" /> Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pagination */}
          {!loading && filteredData.length > 0 && (
            <div className="bg-white px-4 py-3 border-t border-gray-100 flex items-center justify-between sm:px-6 shrink-0">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">
                    Showing <span className="font-bold text-gray-900">{indexOfFirstItem + 1}</span> to{' '}
                    <span className="font-bold text-gray-900">
                      {Math.min(indexOfLastItem, filteredData.length)}
                    </span>{' '}
                    of <span className="font-bold text-gray-900">{filteredData.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-3 py-2 rounded-l-lg border border-gray-200 bg-white text-sm font-medium ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                      Previous
                    </button>
                    <div className="px-4 py-2 border-y border-gray-200 bg-gray-50 text-sm font-bold text-gray-700">
                      {currentPage} / {totalPages}
                    </div>
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center px-3 py-2 rounded-r-lg border border-gray-200 bg-white text-sm font-medium ${currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showModal && selectedLead && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in-up border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-[#800000] p-4 sm:p-6 text-white shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mb-1">
                    Application Details
                  </h2>
                  <div className="flex items-center text-[#800000] bg-white/20 px-3 py-1 rounded-full w-fit">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">{selectedLead.post}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">Candidate Information</h3>

                  <div className="grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-4">
                    <div>
                      <label className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wide">Candidate Name</label>
                      <p className="text-sm font-bold text-gray-900 mt-0.5 md:mt-1">{selectedLead.candidate_name}</p>
                    </div>

                    <div>
                      <label className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone Number</label>
                      <p className="text-sm font-bold text-gray-900 mt-0.5 md:mt-1 flex items-center">
                        <Phone size={14} className="mr-1.5 text-gray-400" />
                        {selectedLead.candidate_phone}
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Experience</label>
                      <p className="text-sm font-bold text-gray-900 mt-0.5 md:mt-1 flex items-center">
                        <Briefcase size={14} className="mr-1.5 text-gray-400" />
                        {selectedLead.candidate_experience || 'Fresher'}
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wide">Applied Date</label>
                      <p className="text-sm font-bold text-gray-900 mt-0.5 md:mt-1 flex items-center">
                        <Clock size={14} className="mr-1.5 text-gray-400" />
                        {new Date(selectedLead.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">Application Data</h3>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Skills Experience</label>
                    {renderParsedSkills(selectedLead.skills)}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Candidate Remarks</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 min-h-[80px]">
                      {selectedLead.remark ? selectedLead.remark : <span className="text-gray-400 italic">No remarks provided.</span>}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Resume Document</label>
                    {selectedLead.candidate_resume ? (
                      <a
                        href={selectedLead.candidate_resume}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-[#800000]/10 text-[#800000] hover:bg-[#800000] hover:text-white rounded-xl font-bold transition-colors text-sm w-full justify-center"
                      >
                        <FileText size={16} className="mr-2" /> View/Download Resume
                      </a>
                    ) : (
                      <div className="px-4 py-2 bg-gray-100 text-gray-500 rounded-xl font-medium text-sm text-center border border-gray-200">
                        No Resume Attached
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-100 bg-white flex justify-end shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-sm transition-all"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default JobApplications;
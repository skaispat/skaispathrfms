import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAfterLeavingWorkData, updateAfterLeavingWorkRecord } from '../api/afterLeavingWorkApi';

const AfterLeavingWork = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    resignationLetterReceived: false,
    resignationAcceptance: false,
    handoverAssetsIdVisitingCard: false,
    cancellationEmailBiometric: false,
    finalReleaseDate: '',
    removeBenefitEnrollment: false
  });

  const fetchLeavingData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      // Fetch from employee_leaving joined with users to get name, designation, etc.
      const data = await getAfterLeavingWorkData();

      if (!data) {
        setPendingData([]);
        setHistoryData([]);
        return;
      }

      const processedData = data.map(item => ({
        id: item.id,
        employeeId: item.emp_id,
        name: item.users?.full_name || 'N/A',
        dateOfLeaving: item.date_of_leaving || '',
        reasonOfLeaving: item.reason_of_leaving || '',
        dateOfJoining: item.users?.joining_date || '',
        designation: item.users?.designation || '',
        department: item.users?.department || '',
        plannedDate: item.planned_date || '',
        actual: item.actual_date || '',
        finalReleaseDate: item.final_release_date || '',

        // Checklist items
        resignationLetterReceived: item.resignation_letter_received || false,
        resignationAcceptance: item.resignation_acceptance || false,
        handoverAssetsIdVisitingCard: item.handover_assets || false,
        cancellationEmailBiometric: item.cancellation_email_biometric || false,
        removeBenefitEnrollment: item.remove_benefit_enrollment || false
      }));

      const pendingTasks = processedData.filter(
        task => !task.actual
      );
      setPendingData(pendingTasks);

      const historyTasks = processedData.filter(
        task => task.actual
      );
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
    fetchLeavingData();
  }, []);

  const handleAfterLeavingClick = async (item) => {
    // Reset form with item data directly since we already fetched it
    setSelectedItem(item);

    // Convert date format if needed for input type="date"
    let formattedDate = "";
    if (item.finalReleaseDate) {
      formattedDate = item.finalReleaseDate.split('T')[0];
    }

    setFormData({
      resignationLetterReceived: item.resignationLetterReceived,
      resignationAcceptance: item.resignationAcceptance,
      handoverAssetsIdVisitingCard: item.handoverAssetsIdVisitingCard,
      cancellationEmailBiometric: item.cancellationEmailBiometric,
      finalReleaseDate: formattedDate,
      removeBenefitEnrollment: item.removeBenefitEnrollment
    });

    setShowModal(true);
  };

  const handleCheckboxChange = (name) => {
    setFormData(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmitting(true);

    if (!selectedItem.employeeId) {
      toast.error('No employee selected');
      setSubmitting(false);
      return;
    }

    try {
      // Check if all conditions are met
      const allConditionsMet =
        formData.resignationLetterReceived &&
        formData.resignationAcceptance &&
        formData.cancellationEmailBiometric &&
        formData.removeBenefitEnrollment &&
        formData.finalReleaseDate;

      // Prepare updates
      const updates = {
        resignation_letter_received: formData.resignationLetterReceived,
        resignation_acceptance: formData.resignationAcceptance,
        handover_assets: formData.handoverAssetsIdVisitingCard,
        cancellation_email_biometric: formData.cancellationEmailBiometric,
        remove_benefit_enrollment: formData.removeBenefitEnrollment,
        final_release_date: formData.finalReleaseDate || null,
        updated_at: new Date().toISOString()
      };

      // Only update actual date if all conditions are met
      if (allConditionsMet) {
        updates.actual_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      }

      await updateAfterLeavingWorkRecord(selectedItem.id, updates);

      if (allConditionsMet) {
        toast.success("All conditions met! Actual date updated successfully.");
      } else {
        toast.success(
          "Conditions updated successfully. Final release pending."
        );
      }

      setShowModal(false);
      fetchLeavingData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const filteredPendingData = pendingData.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">After Leaving Work</h1>
          <p className="text-slate-500 mt-1 text-sm">Managing checklist and final tasks after employee exit</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {/* Filter and Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Of Joining</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Of Leaving</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Designation</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason Of Leaving</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tableLoading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex justify-center flex-col items-center">
                      <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin mb-2"></div>
                      <span className="text-slate-500 text-sm">Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <p className="text-red-500">Error: {error}</p>
                    <button
                      onClick={fetchLeavingData}
                      className="mt-2 text-sm font-medium underline"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filteredPendingData.length > 0 ? (
                filteredPendingData.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleAfterLeavingClick(item)}
                        className="px-3 py-1.5 text-white bg-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        Process
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.employeeId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {item.dateOfJoining ? new Date(item.dateOfJoining).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {item.dateOfLeaving ? new Date(item.dateOfLeaving).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.designation}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 max-w-xs truncate" title={item.reasonOfLeaving}>{item.reasonOfLeaving}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                    No pending after leaving work found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedItem && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-all duration-300">
          <div
            className="absolute inset-0 bg-transparent"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col transform transition-all border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <h3 className="text-xl font-semibold text-slate-800 tracking-tight">After Leaving Work Checklist</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            {(() => {
              const isFormValid =
                formData.resignationLetterReceived &&
                formData.resignationAcceptance &&
                formData.cancellationEmailBiometric &&
                formData.removeBenefitEnrollment &&
                formData.finalReleaseDate;

              return (
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Employee ID</label>
                      <input
                        type="text"
                        value={selectedItem.employeeId}
                        disabled
                        className="block w-full rounded-xl border-slate-200 bg-slate-50 text-slate-500 px-3 py-2.5 sm:text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Name (नाम)</label>
                      <input
                        type="text"
                        value={selectedItem.name}
                        disabled
                        className="block w-full rounded-xl border-slate-200 bg-slate-50 text-slate-500 px-3 py-2.5 sm:text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-2">Checklist Items (चेकलिस्ट आइटम)</h4>

                    {[
                      { key: 'resignationLetterReceived', label: 'Resignation Letter Received (त्याग पत्र प्राप्त हुआ)', required: true },
                      { key: 'resignationAcceptance', label: 'Resignation Acceptance (इस्तीफा स्वीकार)', required: true },
                      { key: 'handoverAssetsIdVisitingCard', label: 'Handover Of Assets, ID Card & Visiting Card (संपत्ति, आईडी कार्ड और विजिटिंग कार्ड सौंपना)', required: false },
                      { key: 'cancellationEmailBiometric', label: 'Cancellation Of Email ID & Biometric Access (ईमेल आईडी और बायोमेट्रिक एक्सेस रद्द करना)', required: true },
                      { key: 'removeBenefitEnrollment', label: 'Remove Benefit Enrollment (लाभ नामांकन हटाएँ)', required: true }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center p-2 hover:bg-slate-50 rounded-lg transition-colors">
                        <input
                          type="checkbox"
                          id={item.key}
                          checked={formData[item.key]}
                          onChange={() => handleCheckboxChange(item.key)}
                          className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                        />
                        <label htmlFor={item.key} className="ml-3 text-sm text-slate-700 cursor-pointer font-medium">
                          {item.label} {item.required && <span className="text-red-500 font-bold">*</span>}
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                      Final Release Date (अंतिम रिलीज की तारीख) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="finalReleaseDate"
                      value={formData.finalReleaseDate}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 bg-white text-slate-800 font-medium"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-6 py-2 text-white rounded-xl text-sm font-medium transition-all transform ${!isFormValid || submitting
                        ? 'bg-slate-300 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:-translate-y-0.5'
                        }`}
                      disabled={!isFormValid || submitting}
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
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AfterLeavingWork;
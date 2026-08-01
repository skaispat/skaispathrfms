import React, { useEffect, useState } from "react";
import { Filter, Search, Clock, CheckCircle, ImageIcon } from "lucide-react";
import useDataStore from "../store/dataStore";
import toast from 'react-hot-toast';
import { getEmployeeJoiningData, getEmployeeLeavingData } from '../api/employeeApi';

const Employee = () => {
  const [activeTab, setActiveTab] = useState("joining");
  const [searchTerm, setSearchTerm] = useState("");
  const [joiningData, setJoiningData] = useState([]);
  const [leavingData, setLeavingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatDOB = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-GB').format(date);
  };

  const fetchJoiningData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const data = await getEmployeeJoiningData();

      const processedData = data.map(item => {
        // Check if after_joining exists and is an array (Supabase returns array for 1:N) or object
        const afterJoining = Array.isArray(item.after_joining) ? item.after_joining[0] : item.after_joining;

        return {
          employeeId: afterJoining?.emp_id || item.emp_id || item.joining_id || "",
          candidateName: item.name_as_per_aadhar || "",
          fatherName: item.father_name || "",
          dateOfJoining: item.date_of_joining || "",
          designation: item.designation || "",
          aadharPhoto: item.aadhar_card_url || "",
          candidatePhoto: item.passport_photo_url || "",
          address: item.current_address || "",
          dateOfBirth: item.date_of_birth || "",
          gender: item.gender || "",
          mobileNo: item.mobile_no || "",
          familyNo: item.family_mobile_no || "",
          relationshipWithFamily: item.relationship_with_family || "",
          accountNo: item.bank_account_no || "",
          ifsc: item.ifsc_code || "",
          branch: item.branch_name || "",
          passbook: item.bank_passbook_url || "",
          emailId: item.personal_email || "",
          department: item.department || "",
          aadharNo: item.aadhar_card_number || "",
          id: item.joining_id
        };
      });

      setJoiningData(processedData);
    } catch (error) {
      console.error("Error fetching joining data:", error);
      setError(error.message);
      toast.error(`Failed to load joining data: ${error.message}`);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  const fetchLeavingData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      const data = await getEmployeeLeavingData();

      const processedData = data.map(item => ({
        id: item.id,
        employeeId: item.emp_id || "",
        name: item.users?.full_name || "",
        dateOfLeaving: item.date_of_leaving || "",
        mobileNo: item.users?.phone_number || "",
        reasonOfLeaving: item.reason_of_leaving || "",
        fatherName: "", // users table does not have father_name
        dateOfJoining: item.users?.joining_date || "",
        designation: item.users?.designation || "",
        department: item.users?.department || "",
        plannedDate: item.planned_date || "",
        actual: item.actual_date || "",
      }));

      // Filter logic: show all or only those with planned date?
      // Keeping consistent with previous logic if it filtered by plannedDate
      const leavingEmployees = processedData.filter(
        (employee) => employee.plannedDate || employee.dateOfLeaving
      );

      setLeavingData(leavingEmployees);
    } catch (error) {
      console.error("Error fetching leaving data:", error);
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

  const filteredJoiningData = joiningData.filter((item) => {
    const matchesSearch =
      item.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.fatherName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.emailId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.mobileNo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredLeavingData = leavingData.filter((item) => {
    const matchesSearch =
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.designation?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">Employee List</h1>
          <p className="text-slate-500 mt-1 text-sm">View and manage all active and past employees</p>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {/* Toolbar: Tabs & Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-lg border border-slate-200/50">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === "joining"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              onClick={() => setActiveTab("joining")}
            >
              <CheckCircle size={16} className="inline mr-2" />
              New Joining Employees
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === "joining" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                }`}>
                {filteredJoiningData.length}
              </span>
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === "leaving"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              onClick={() => setActiveTab("leaving")}
            >
              <Clock size={16} className="inline mr-2" />
              Leaving Employees
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === "leaving" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                }`}>
                {filteredLeavingData.length}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm w-full">
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

        {/* Tab Content - Logically Separated for Cleanliness */}
        <div className="flex-1 overflow-hidden relative">
          {/* Joining Table */}
          {activeTab === "joining" && (
            <div className="absolute inset-0 overflow-auto custom-scrollbar">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    {[
                      "Employee ID", "Name", "Father Name", "Date Of Joining",
                      "Designation", "Aadhar Photo", "Candidate Photo", "Address",
                      "Date of Birth", "Gender", "Mobile No", "Family No",
                      "Relationship", "Account No", "IFSC", "Branch",
                      "Passbook", "Email Id", "Department", "Aadhar No"
                    ].map((header) => (
                      <th key={header} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="21" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                          <span className="text-slate-500 text-sm">Loading employees...</span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="21" className="px-6 py-12 text-center">
                        <p className="text-red-500 text-sm mb-2">Error: {error}</p>
                        <button
                          onClick={fetchJoiningData}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : filteredJoiningData.length === 0 ? (
                    <tr>
                      <td colSpan="21" className="px-6 py-12 text-center text-slate-500 text-sm">
                        No joining employees found.
                      </td>
                    </tr>
                  ) : (
                    filteredJoiningData.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">{item.employeeId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.candidateName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.fatherName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDOB(item.dateOfJoining)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.designation}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.aadharPhoto ? (
                            <a href={item.aadharPhoto} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                              <ImageIcon size={18} />
                            </a>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.candidatePhoto ? (
                            <a href={item.candidatePhoto} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                              <ImageIcon size={18} />
                            </a>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.address || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDOB(item.dateOfBirth)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.gender || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.mobileNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.familyNo || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.relationshipWithFamily || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.accountNo || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.ifsc || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.branch || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.passbook ? (
                            <a href={item.passbook} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                              <ImageIcon size={18} />
                            </a>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.emailId || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.department}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.aadharNo || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Leaving Table */}
          {activeTab === "leaving" && (
            <div className="absolute inset-0 overflow-auto custom-scrollbar">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    {[
                      "Employee ID", "Name", "Date Of Joining", "Date Of Leaving",
                      "Mobile Number", "Father Name", "Designation", "Department", "Reason Of Leaving"
                    ].map((header) => (
                      <th key={header} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center">
                        <div className="flex justify-center flex-col items-center">
                          <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-2"></div>
                          <span className="text-slate-500 text-sm">Loading leaving employees...</span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center">
                        <p className="text-red-500 text-sm mb-2">Error: {error}</p>
                        <button
                          onClick={fetchLeavingData}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : filteredLeavingData.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center text-slate-500 text-sm">
                        No leaving employees found.
                      </td>
                    </tr>
                  ) : (
                    filteredLeavingData.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">{item.employeeId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDOB(item.dateOfJoining)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDOB(item.dateOfLeaving)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.mobileNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.fatherName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.designation}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.department}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.reasonOfLeaving}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Employee;

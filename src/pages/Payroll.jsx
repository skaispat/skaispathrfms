import React, { useState, useEffect } from 'react';
import { Search, Calendar, Filter, MoreVertical } from 'lucide-react';
import { getPayrollRecords } from '../api/payrollApi';

const Payroll = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(""); // Changed to empty string by default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payrollData, setPayrollData] = useState([]);
  const [notification, setNotification] = useState(null);
  const [filters, setFilters] = useState({
    department: "",
    status: "",
    employmentType: "",
    location: "",
  });

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch data from API
        const data = await getPayrollRecords();

        if (data) {
          // Transform the data to match our structure
          const transformedData = data.map((row) => ({
            serialNo: row.serial_no || "",
            employeeCode: row.emp_id || "",
            employeeName: row.employee_name || "",
            designation: row.designation || "",
            daysPresent: row.days_present || 0,
            totalActual: parseFloat(row.total_actual) || 0,
            basic: parseFloat(row.basic) || 0,
            conveyance: parseFloat(row.conveyance) || 0,
            hra: parseFloat(row.hra) || 0,
            medicalAllowance: parseFloat(row.medical_allowance) || 0,
            specialAllowance: parseFloat(row.special_allowance) || 0,
            otherAllowances: parseFloat(row.other_allowances) || 0,
            loan: parseFloat(row.loan) || 0,
            additionalSalary: parseFloat(row.additional_salary) || 0,
            toBePaidAfterPF: parseFloat(row.to_be_paid_after_pf) || 0,
            year: row.year || "",
            month: row.month || "",
          }));

          setPayrollData(transformedData);
        }
      } catch (error) {
        setError(error.message);
        showNotification(`Failed to load data: ${error.message}`, "error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: value,
    }));
  };

  // Filter data based on search term and selected period
  const filteredData = payrollData.filter((item) => {
    // Filter by search term (emp code, name, designation, year, month)
    const matchesSearch =
      item.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.year.toString().includes(searchTerm) ||
      item.month.toString().toLowerCase().includes(searchTerm.toLowerCase());

    // Filter by selected period (year-month)
    let matchesPeriod = true;
    if (selectedPeriod) {
      const [selectedYear, selectedMonthNum] = selectedPeriod.split('-');

      // Convert numeric month to full month name
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const selectedMonthName = monthNames[parseInt(selectedMonthNum) - 1];

      // Match with year in column P and month name in column Q
      matchesPeriod = item.year.toString() === selectedYear &&
        item.month.toString() === selectedMonthName;
    }

    return matchesSearch && matchesPeriod;
  });

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${notification.type === "error"
            ? "bg-red-100 text-red-800 border border-red-300"
            : "bg-green-100 text-green-800 border border-green-300"
            }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">
            Payroll Management
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Manage employee salaries and allowances.</p>
        </div>
      </div>

      {/* Controls Row */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by emp code, name, designation, year or month..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 sm:text-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search
                size={18}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative">
              <input
                type="text"
                onFocus={(e) => { e.target.type = "month"; e.target.showPicker?.(); }}
                onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
                placeholder="Month / Year"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 sm:text-sm transition-all no-calendar-icon"
              />
              <Calendar
                size={18}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>

            <div className="relative group">
              {/* Dropdown for filters (simplified for UI) */}
              <div className="relative">
                <select
                  value={filters.department}
                  onChange={(e) =>
                    handleFilterChange("department", e.target.value)
                  }
                  className="pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 sm:text-sm appearance-none cursor-pointer transition-all min-w-[160px]"
                >
                  <option value="">All Departments</option>
                  <option value="IT">IT</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                  <option value="AUTOMOBILE">AUTOMOBILE</option>
                </select>
                <Filter
                  size={18}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <div className="absolute inset-y-0 right-0 top-1/2 transform -translate-y-1/2 pr-2 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full flex-col p-6 text-center">
            <p className="text-red-500 font-medium mb-2">Error: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">S.No</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Emp Code</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Name</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Designation</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Days Present</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Total Actual</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Basic</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Conveyance</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">HRA</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Medical</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Special</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Other</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Loan</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Additional</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs bg-indigo-50/50 text-indigo-700">Net Payable</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Year</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Month</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500">{item.serialNo}</td>
                      <td className="px-6 py-4 text-slate-500 font-medium">{item.employeeCode}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{item.employeeName}</td>
                      <td className="px-6 py-4 text-slate-500">{item.designation}</td>
                      <td className="px-6 py-4 text-slate-500">{item.daysPresent}</td>
                      <td className="px-6 py-4 text-slate-600">₹{item.totalActual.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-500">₹{item.basic.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-500">₹{item.conveyance.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-500">₹{item.hra.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-500">₹{item.medicalAllowance.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-500">₹{item.specialAllowance.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-500">₹{item.otherAllowances.toLocaleString()}</td>
                      <td className="px-6 py-4 text-red-500">{item.loan ? `₹${item.loan.toLocaleString()}` : '-'}</td>
                      <td className="px-6 py-4 text-green-600">{item.additionalSalary ? `₹${item.additionalSalary.toLocaleString()}` : '-'}</td>
                      <td className="px-6 py-4 font-bold text-indigo-700 bg-indigo-50/30">₹{item.toBePaidAfterPF.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-500">{item.year}</td>
                      <td className="px-6 py-4 text-slate-500">{item.month}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="17" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-slate-500 text-lg font-medium">
                          No payroll data found
                        </p>
                        <p className="text-slate-400 mt-1">
                          Try adjusting your search or filters
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payroll;
import React, { useEffect, useState } from 'react';
import { DollarSign, Download, Eye, Calendar, TrendingUp } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useDataStore from '../store/dataStore';
import toast from 'react-hot-toast';

const MySalary = () => {
  // const { user } = useAuthStore();
  // const { getFilteredData } = useDataStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [salaryData, setSalaryData] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  //  const salaryData = getFilteredData('salaryData', user);

  //  Filter salary by selected year
  const filteredSalary = salaryData.filter(record => {
    return record.year.includes(selectedYear.toString());
  });

  const fetchSalaryData = async () => {
    setLoading(true);
    setTableLoading(true);
    setError(null);

    try {
      // Get user info from localStorage
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const employeeId = localStorage.getItem("employeeId")
      const employeeName = user?.Name;

      if (!employeeId || !employeeName) {
        throw new Error("User info missing in localStorage");
      }

      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbwfGaiHaPhexcE9i-A7q9m81IX6zWqpr4lZBe4AkhlTjVl4wCl0v_ltvBibfduNArBVoA/exec?sheet=Salary&action=fetch'
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch salary data');
      }

      const rawData = result.data || result;
      // console.log("Raw data from API:", rawData);

      if (!Array.isArray(rawData)) {
        throw new Error('Expected array data not received');
      }

      // Skip header row
      const dataRows = rawData.length > 1 ? rawData.slice(1) : [];

      // Map rows to structured data
      // Map rows to structured data - PROPERLY CONVERT STRINGS TO NUMBERS
      const processedData = dataRows
        .map((row, index) => {
          // Helper function to safely convert to number
          const toNumber = (value) => {
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
              // Remove commas and any non-numeric characters except decimal point
              const cleaned = value.replace(/[^\d.]/g, '');
              return parseFloat(cleaned) || 0;
            }
            return 0;
          };

          return {
            id: index + 1,
            timestamp: row[0] || '',
            employeeId: row[1] || '',
            employeeName: row[2] || '',
            year: row[3] || '',
            month: row[4] || '',
            basicSalary: toNumber(row[5]),
            allowances: toNumber(row[6]),
            overtime: toNumber(row[7]),
            deductions: toNumber(row[8]),
            netSalary: toNumber(row[9]),
            status: row[10] || '',
            payDate: row[11] || '',
          };
        })
        .filter(item =>
          item.employeeId === employeeId && item.employeeName === employeeName
        );

      // console.log("Filtered salary data:", processedData);
      setSalaryData(processedData);

    } catch (error) {
      console.error('Error fetching salary data:', error);
      setError(error.message);
      toast.error(`Failed to load salary data: ${error.message}`);
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryData();
  }, []);

  // Calculate yearly statistics
  // Calculate yearly statistics with type safety
  const totalEarnings = filteredSalary.reduce((sum, record) => {
    const netSalary = typeof record.netSalary === 'string'
      ? parseFloat(record.netSalary.replace(/[^\d.]/g, '')) || 0
      : record.netSalary || 0;
    return sum + netSalary;
  }, 0);

  const averageSalary = filteredSalary.length > 0 ? totalEarnings / filteredSalary.length : 0;

  const totalDeductions = filteredSalary.reduce((sum, record) => {
    const deductions = typeof record.deductions === 'string'
      ? parseFloat(record.deductions.replace(/[^\d.]/g, '')) || 0
      : record.deductions || 0;
    return sum + deductions;
  }, 0);

  const totalOvertime = filteredSalary.reduce((sum, record) => {
    const overtime = typeof record.overtime === 'string'
      ? parseFloat(record.overtime.replace(/[^\d.]/g, '')) || 0
      : record.overtime || 0;
    return sum + overtime;
  }, 0);

  const years = [2023, 2024, 2025];

  const handleDownloadPayslip = (salaryRecord) => {
    // In a real app, this would generate and download a PDF payslip
    alert(`Downloading payslip for ${salaryRecord.month}`);
  };

  const handleViewPayslip = (salaryRecord) => {
    // In a real app, this would open a detailed payslip view
    alert(`Viewing payslip for ${salaryRecord.month}`);
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-auto p-6 custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">My Salary</h1>
          <p className="text-slate-500 mt-1 text-sm">Overview of your earnings, deductions, and monthly salary details</p>
        </div>
        <div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-slate-400" />
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all hover:bg-slate-50 cursor-pointer appearance-none"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Total Earnings</h3>
            <div className="p-2 rounded-lg bg-green-50">
              <DollarSign size={20} className="text-green-600" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">₹{totalEarnings.toLocaleString()}</h3>
            <p className="text-xs text-slate-500 mt-1">For {selectedYear}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Average Salary</h3>
            <div className="p-2 rounded-lg bg-blue-50">
              <TrendingUp size={20} className="text-blue-600" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">₹{Math.round(averageSalary).toLocaleString()}</h3>
            <p className="text-xs text-slate-500 mt-1">Per month</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Total Deductions</h3>
            <div className="p-2 rounded-lg bg-red-50">
              <DollarSign size={20} className="text-red-600" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">₹{totalDeductions.toLocaleString()}</h3>
            <p className="text-xs text-slate-500 mt-1">For {selectedYear}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Total Overtime</h3>
            <div className="p-2 rounded-lg bg-amber-50">
              <DollarSign size={20} className="text-amber-600" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">₹{totalOvertime.toLocaleString()}</h3>
            <p className="text-xs text-slate-500 mt-1">For {selectedYear}</p>
          </div>
        </div>
      </div>

      {/* Salary Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Salary Records - {selectedYear}</h2>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Month</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Basic Salary</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Allowances</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Overtime</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Deductions</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Salary</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pay Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {tableLoading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-500 font-medium">Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="inline-flex items-center px-4 py-2 rounded-lg bg-red-50 text-red-600 mb-4">
                      <span className="font-medium">Error loading data: {error}</span>
                    </div>
                    <br />
                    <button
                      onClick={fetchSalaryData}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filteredSalary.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <p className="text-slate-500 text-lg">No salary records found for {selectedYear}.</p>
                  </td>
                </tr>
              ) : (
                filteredSalary.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {record.month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      ₹{record.basicSalary.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      ₹{record.allowances.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      ₹{record.overtime.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      ₹{record.deductions.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                      ₹{record.netSalary.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${record.status === 'Paid'
                        ? 'bg-green-50 text-green-700 border-green-100'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                        }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(record.payDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary Breakdown Chart (Latest Month) - Redesigned */}
      {filteredSalary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 mb-6">
            Latest Salary Breakdown - {filteredSalary[0].month}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-5 bg-green-50/50 rounded-xl border border-green-100">
              <p className="text-sm font-medium text-slate-600 mb-1">Basic Salary</p>
              <p className="text-xl font-bold text-green-700">₹{filteredSalary[0].basicSalary.toLocaleString()}</p>
            </div>
            <div className="text-center p-5 bg-blue-50/50 rounded-xl border border-blue-100">
              <p className="text-sm font-medium text-slate-600 mb-1">Allowances</p>
              <p className="text-xl font-bold text-blue-700">₹{filteredSalary[0].allowances.toLocaleString()}</p>
            </div>
            <div className="text-center p-5 bg-amber-50/50 rounded-xl border border-amber-100">
              <p className="text-sm font-medium text-slate-600 mb-1">Overtime</p>
              <p className="text-xl font-bold text-amber-700">₹{filteredSalary[0].overtime.toLocaleString()}</p>
            </div>
            <div className="text-center p-5 bg-red-50/50 rounded-xl border border-red-100">
              <p className="text-sm font-medium text-slate-600 mb-1">Deductions</p>
              <p className="text-xl font-bold text-red-700">₹{filteredSalary[0].deductions.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySalary;
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { Search, Calendar, Download, X, ChevronRight, User } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import * as XLSX from "xlsx";

dayjs.extend(isBetween);

const TotalLeaveDetails = () => {
  const [leaves, setLeaves] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [selectedMonthDetails, setSelectedMonthDetails] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("emp_id, full_name, department, designation")
        .order("full_name");
      if (userError) throw userError;
      setUsers(userData || []);

      const { data: leaveData, error: leaveError } = await supabase
        .from("leave_management")
        .select("*")
        .order("leave_date_start", { ascending: false });
      if (leaveError) throw leaveError;
      setLeaves(leaveData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const processedData = useMemo(() => {
    const summary = {};
    const currentMonth = dayjs(selectedMonth, "YYYY-MM");
    const monthStart = currentMonth.startOf("month");
    const monthEnd = currentMonth.endOf("month");

    leaves.forEach(record => {
      const empId = record.emp_id;
      const start = dayjs(record.leave_date_start);
      const end = dayjs(record.leave_date_end);

      const overlapStart = start.isAfter(monthStart) ? start : monthStart;
      const overlapEnd = end.isBefore(monthEnd) ? end : monthEnd;
      const overlapDays = overlapEnd.diff(overlapStart, "day") + 1;

      if (overlapDays > 0 && !overlapStart.isAfter(overlapEnd)) {
        if (!summary[empId]) summary[empId] = { el: 0, cl: 0, unpaid: 0, records: [] };
        const totalDays = end.diff(start, "day") + 1;
        const ratio = overlapDays / totalDays;
        summary[empId].el += (record.earned || 0) * ratio;
        summary[empId].cl += (record.casual || 0) * ratio;
        summary[empId].unpaid += (record.unpaid || 0) * ratio;
        summary[empId].records.push({
          ...record,
          overlapDays,
          displayRange: `${overlapStart.format("DD MMM")} - ${overlapEnd.format("DD MMM")}`
        });
      }
    });
    return summary;
  }, [leaves, selectedMonth]);

  const filteredUsers = users.filter((u) =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.emp_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToExcel = () => {
    const exportData = filteredUsers.map((user) => {
      const data = processedData[user.emp_id] || { el: 0, cl: 0, unpaid: 0 };
      return {
        "Employee ID": user.emp_id,
        "Employee Name": user.full_name,
        "EL": data.el.toFixed(0),
        "CL": data.cl.toFixed(0),
        "UN": data.unpaid.toFixed(0),
        "Month": dayjs(selectedMonth).format("MMMM YYYY"),
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    XLSX.writeFile(wb, `Leave_${selectedMonth}.xlsx`);
  };

  return (
    <div className="p-3 md:p-6 min-h-screen bg-white">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-xl font-bold text-black flex items-center gap-2">
          <Calendar size={20} className="text-red-600" />
          Leave Summary
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="month"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-black font-bold text-sm focus:ring-1 focus:ring-black outline-none"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-black font-bold text-sm focus:ring-1 focus:ring-black outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={exportToExcel}
            className="w-full px-4 py-2 bg-green-700 text-white rounded-lg font-bold text-sm hover:bg-green-800 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 text-center font-bold text-black animate-pulse text-sm">Loading data...</div>
      ) : (
        <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
          {/* Desktop Table */}
          <table className="hidden md:table w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase text-center">EL</th>
                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase text-center">CL</th>
                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase text-center">UN</th>
                <th className="px-6 py-3 text-[11px] font-black text-slate-500 uppercase text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => {
                const data = processedData[user.emp_id] || { el: 0, cl: 0, unpaid: 0, records: [] };
                const hasLeaves = data.records.length > 0;
                return (
                  <tr key={user.emp_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">{user.full_name?.charAt(0)}</div>
                        <div>
                          <p className="text-sm font-bold text-black">{user.full_name}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{user.emp_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-center text-sm font-black ${data.el > 0 ? 'text-green-600' : 'text-slate-200'}`}>{data.el.toFixed(0)}</td>
                    <td className={`px-4 py-3 text-center text-sm font-black ${data.cl > 0 ? 'text-blue-600' : 'text-slate-200'}`}>{data.cl.toFixed(0)}</td>
                    <td className={`px-4 py-3 text-center text-sm font-black ${data.unpaid > 0 ? 'text-amber-600' : 'text-slate-200'}`}>{data.unpaid.toFixed(0)}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => hasLeaves && setSelectedMonthDetails({ employee: user, monthName: dayjs(selectedMonth).format("MMM YYYY"), ...data })}
                        className={`p-1.5 rounded transition-all ${hasLeaves ? 'text-red-600 hover:bg-red-50' : 'text-slate-200'}`}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden grid grid-cols-1 gap-3 p-3 bg-slate-50/50">
            {filteredUsers.map((user) => {
              const data = processedData[user.emp_id] || { el: 0, cl: 0, unpaid: 0, records: [] };
              const hasLeaves = data.records.length > 0;
              return (
                <div
                  key={user.emp_id}
                  onClick={() => hasLeaves && setSelectedMonthDetails({ employee: user, monthName: dayjs(selectedMonth).format("MMM YYYY"), ...data })}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {user.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-black leading-none">{user.full_name}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{user.emp_id}</p>
                      </div>
                    </div>
                    {hasLeaves && <ChevronRight size={18} className="text-slate-400" />}
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-50 pt-3">
                    <div className="text-center p-2 rounded-lg bg-green-50/50">
                      <p className="text-[9px] font-black text-green-700 uppercase mb-0.5">EL</p>
                      <p className={`text-base font-black ${data.el > 0 ? 'text-green-600' : 'text-slate-300'}`}>{data.el.toFixed(0)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-blue-50/50">
                      <p className="text-[9px] font-black text-blue-700 uppercase mb-0.5">CL</p>
                      <p className={`text-base font-black ${data.cl > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{data.cl.toFixed(0)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-amber-50/50">
                      <p className="text-[9px] font-black text-amber-700 uppercase mb-0.5">UN</p>
                      <p className={`text-base font-black ${data.unpaid > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{data.unpaid.toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedMonthDetails && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={() => setSelectedMonthDetails(null)}>
          <div className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-red-600 text-white flex items-center justify-center font-bold text-xs">{selectedMonthDetails.employee.full_name?.charAt(0)}</div>
                <div>
                  <p className="text-sm font-bold text-black leading-none">{selectedMonthDetails.employee.full_name}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">{selectedMonthDetails.monthName}</p>
                </div>
              </div>
              <div className="flex gap-3 text-center border-l border-slate-200 pl-3 mr-4">
                <div><p className="text-[8px] font-black text-slate-400 uppercase">EL</p><p className="text-xs font-black text-green-600">{selectedMonthDetails.el.toFixed(0)}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase">CL</p><p className="text-xs font-black text-blue-600">{selectedMonthDetails.cl.toFixed(0)}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase">UN</p><p className="text-xs font-black text-amber-600">{selectedMonthDetails.unpaid.toFixed(0)}</p></div>
              </div>
              <button onClick={() => setSelectedMonthDetails(null)} className="p-1.5 hover:bg-slate-200 rounded text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-4 overflow-y-auto divide-y divide-slate-100">
              {selectedMonthDetails.records.map((record, idx) => (
                <div key={idx} className="py-3">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-wider">{record.leave_type}</span>
                      <p className="text-sm font-bold text-black mt-0.5">{record.displayRange}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-black">{record.overlapDays} Days</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{record.status}</p>
                    </div>
                  </div>
                  {record.remarks && <p className="text-[11px] text-slate-500 italic mt-1 px-2 border-l-2 border-slate-100">"{record.remarks}"</p>}
                </div>
              ))}
            </div>
            <div className="p-4 bg-white border-t border-slate-100">
              <button onClick={() => setSelectedMonthDetails(null)} className="w-full py-2.5 bg-black text-white rounded-lg font-bold text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TotalLeaveDetails;

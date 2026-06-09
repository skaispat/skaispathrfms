import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { Search, Calendar, Download, X, ChevronRight, User } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import * as XLSX from "xlsx";
import useAuthStore from "../store/authStore";

dayjs.extend(isBetween);

const TotalLeaveDetails = () => {
  const [leaves, setLeaves] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [selectedMonthDetails, setSelectedMonthDetails] = useState(null);
  const [quotas, setQuotas] = useState({});
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "Admin" || currentUser?.Admin === "Yes";
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [tempRecordData, setTempRecordData] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const getFiscalYear = () => {
    const today = new Date();
    const year = today.getFullYear();
    return today.getMonth() >= 3 ? year : year - 1;
  };

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

      const { data: quotaData, error: quotaError } = await supabase
        .from("yearly_quota")
        .select("*")
        .eq("year", getFiscalYear());
      if (quotaError) throw quotaError;
      const quotaMap = {};
      (quotaData || []).forEach(q => { quotaMap[q.emp_id] = q; });
      setQuotas(quotaMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const processedData = useMemo(() => {
    const summary = {};
    const rangeStart = dayjs(startDate);
    const rangeEnd = dayjs(endDate);

    leaves.forEach(record => {
      const empId = record.emp_id;
      const start = dayjs(record.leave_date_start);
      const end = dayjs(record.leave_date_end);

      const overlapStart = start.isAfter(rangeStart) ? start : rangeStart;
      const overlapEnd = end.isBefore(rangeEnd) ? end : rangeEnd;
      const overlapDays = overlapEnd.diff(overlapStart, "day") + 1;

      if (overlapDays > 0 && !overlapStart.isAfter(overlapEnd)) {
        if (!summary[empId]) summary[empId] = { el: 0, cl: 0, unpaid: 0, cf_used: 0, records: [] };
        const totalDays = end.diff(start, "day") + 1;
        const ratio = overlapDays / totalDays;

        const isRejected = record.status?.toLowerCase().includes("reject");
        if (!isRejected) {
          summary[empId].el += (record.earned || 0) * ratio;
          summary[empId].cl += (record.casual || 0) * ratio;
          summary[empId].unpaid += (record.unpaid || 0) * ratio;
          summary[empId].cf_used += (record.cf_el_used || 0) * ratio;
        }

        summary[empId].records.push({
          ...record,
          overlapDays,
          displayRange: `${overlapStart.format("DD MMM")} - ${overlapEnd.format("DD MMM")}`
        });
      }
    });
    return summary;
  }, [leaves, startDate, endDate]);

  const filteredUsers = users.filter((u) => {
    if (u.emp_id?.toLowerCase() === "admin" || u.full_name?.toLowerCase() === "admin") return false;

    // Check search term
    const matchesSearch = (
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.emp_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (!matchesSearch) return false;

    // Filter out users who haven't taken any leave in the selected range
    const data = processedData[u.emp_id];
    return data && (
      (data.el || 0) > 0 ||
      (data.cl || 0) > 0 ||
      (data.unpaid || 0) > 0
    );
  });

  const exportToExcel = () => {
    const exportData = [];
    filteredUsers.forEach((user) => {
      const data = processedData[user.emp_id] || { el: 0, cl: 0, unpaid: 0, records: [] };
      if ((data.el || 0) === 0 && (data.cl || 0) === 0 && (data.unpaid || 0) === 0) return;

      const q = quotas[user.emp_id] || {};
      const carriedEL = q.carried_forward_el || 0;
      const remEL = 24 - (q.earned_leave_used || 0);
      const remCL = 12 - (q.casual_leave_used || 0);
      const totalUnpaid = q.unpaid_leave_used || 0;

      if (data.records.length === 0) {
        exportData.push({
          "Employee ID": user.emp_id,
          "Employee Name": user.full_name,
          "EL (Month)": (data.el || 0).toFixed(0),
          "CL (Month)": (data.cl || 0).toFixed(0),
          "Unpaid (Month)": (data.unpaid || 0).toFixed(0),
          "From Date": "-",
          "To Date": "-",
          "Days": "-",
          "Reason": "-",
          "Carry FWD EL": carriedEL,
          "Remaining EL": remEL,
          "Remaining CL": remCL,
          "Unpaid (Yr)": totalUnpaid,
          "Used Carry FWD": (data.cf_used || 0).toFixed(0),
          "Status": "-",
        });
      } else {
        data.records.forEach(record => {
          exportData.push({
            "Employee ID": user.emp_id,
            "Employee Name": user.full_name,
            "EL (Month)": (data.el || 0).toFixed(0),
            "CL (Month)": (data.cl || 0).toFixed(0),
            "Unpaid (Month)": (data.unpaid || 0).toFixed(0),
            "From Date": dayjs(record.leave_date_start).format("DD MMM YYYY"),
            "To Date": dayjs(record.leave_date_end).format("DD MMM YYYY"),
            "Days": record.overlapDays,
            "Reason": record.remarks || "-",
            "Carry FWD EL": carriedEL,
            "Remaining EL": remEL,
            "Remaining CL": remCL,
            "Unpaid (Yr)": totalUnpaid,
            "Used Carry FWD": (record.cf_el_used * (record.overlapDays / (dayjs(record.leave_date_end).diff(dayjs(record.leave_date_start), "day") + 1)) || 0).toFixed(0),
            "Status": record.status || "-",
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detailed Leaves");
    XLSX.writeFile(wb, `Detailed_Leaves_${startDate}_to_${endDate}.xlsx`);
  };

  const handleEditRecord = (record) => {
    setEditingRecordId(record.id);
    setTempRecordData({
      casual: record.casual || 0,
      earned: record.earned || 0,
      unpaid: record.unpaid || 0,
    });
  };

  const handleSaveRecord = async (record) => {
    try {
      setSaveLoading(true);

      const deltaCasual = tempRecordData.casual - (record.casual || 0);
      const deltaEarned = tempRecordData.earned - (record.earned || 0);
      const deltaUnpaid = tempRecordData.unpaid - (record.unpaid || 0);

      if (deltaCasual === 0 && deltaEarned === 0 && deltaUnpaid === 0) {
        setEditingRecordId(null);
        return;
      }

      // 1. Update leave_management
      const { error: updateError } = await supabase
        .from("leave_management")
        .update({
          casual: tempRecordData.casual,
          earned: tempRecordData.earned,
          unpaid: tempRecordData.unpaid,
        })
        .eq("id", record.id);

      if (updateError) throw updateError;

      // 2. Update yearly_quota (delta-based)
      const currentYear = getFiscalYear();
      const { data: q } = await supabase
        .from("yearly_quota")
        .select("*")
        .eq("emp_id", record.emp_id)
        .eq("year", currentYear)
        .maybeSingle();

      if (q) {
        let updatePayload = {};

        // Handle Casual
        if (deltaCasual !== 0) {
          updatePayload.casual_leave_used = (q.casual_leave_used || 0) + deltaCasual;
        }

        // Handle Unpaid
        if (deltaUnpaid !== 0) {
          updatePayload.unpaid_leave_used = (q.unpaid_leave_used || 0) + deltaUnpaid;
        }

        // Handle Earned (including carry-forward logic)
        if (deltaEarned !== 0) {
          if (deltaEarned > 0) {
            // Added more EL usage
            const carried = q.carried_forward_el || 0;
            if (carried >= deltaEarned) {
              updatePayload.carried_forward_el = carried - deltaEarned;
            } else {
              updatePayload.carried_forward_el = 0;
              updatePayload.earned_leave_used = (q.earned_leave_used || 0) + (deltaEarned - carried);
            }
          } else {
            // Reduced EL usage (restore balance)
            const absDelta = Math.abs(deltaEarned);
            const used = q.earned_leave_used || 0;
            if (used >= absDelta) {
              updatePayload.earned_leave_used = used - absDelta;
            } else {
              updatePayload.earned_leave_used = 0;
              updatePayload.carried_forward_el = (q.carried_forward_el || 0) + (absDelta - used);
            }
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          await supabase.from("yearly_quota").update(updatePayload).eq("id", q.id);
        }
      }

      toast.success("Record updated successfully");
      setEditingRecordId(null);

      // Update local state for modal
      const updatedRecords = selectedMonthDetails.records.map(r =>
        r.id === record.id ? { ...r, ...tempRecordData } : r
      );

      // Calculate new totals for the user in processedData context if necessary, 
      // but easier to just refetch all data to keep summary accurate
      fetchData();

      // Update current modal view if still open
      setSelectedMonthDetails(prev => ({
        ...prev,
        records: updatedRecords,
        el: updatedRecords.reduce((acc, r) => acc + (r.earned || 0), 0),
        cl: updatedRecords.reduce((acc, r) => acc + (r.casual || 0), 0),
        unpaid: updatedRecords.reduce((acc, r) => acc + (r.unpaid || 0), 0),
      }));

    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to update record");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="p-3 md:p-6 min-h-screen bg-white">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight flex items-center gap-2">
          <Calendar size={20} className="text-red-600" />
          Total Leave Details
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">From:</span>
            <input
              type="date"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-black font-bold text-xs focus:ring-1 focus:ring-black outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">To:</span>
            <input
              type="date"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-black font-bold text-xs focus:ring-1 focus:ring-black outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
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
                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase text-center">Unpaid</th>
                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase text-center">Carry FWD</th>
                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase text-center">Rem EL</th>
                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase text-center">Rem CL</th>
                <th className="px-4 py-3 text-[11px] font-black text-slate-500 uppercase text-center">Used CF</th>
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
                    <td className={`px-4 py-3 text-center text-sm font-black text-amber-700`}>{data.unpaid.toFixed(0)}</td>
                    <td className={`px-4 py-3 text-center text-sm font-black text-purple-600`}>{quotas[user.emp_id]?.carried_forward_el || 0}</td>
                    <td className={`px-4 py-3 text-center text-sm font-black text-emerald-600`}>{24 - (quotas[user.emp_id]?.earned_leave_used || 0)}</td>
                    <td className={`px-4 py-3 text-center text-sm font-black text-sky-600`}>{12 - (quotas[user.emp_id]?.casual_leave_used || 0)}</td>
                    <td className={`px-4 py-3 text-center text-sm font-black ${data.cf_used > 0 ? 'text-purple-600' : 'text-slate-200'}`}>{data.cf_used.toFixed(0)}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => hasLeaves && setSelectedMonthDetails({
                          employee: user,
                          range: `${dayjs(startDate).format("DD MMM")} - ${dayjs(endDate).format("DD MMM YYYY")}`,
                          ...data
                        })}
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
                  onClick={() => hasLeaves && setSelectedMonthDetails({
                    employee: user,
                    range: `${dayjs(startDate).format("DD MMM")} - ${dayjs(endDate).format("DD MMM YYYY")}`,
                    ...data
                  })}
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

                  <div className="grid grid-cols-4 gap-2 border-t border-slate-50 pt-3">
                    <div className="text-center p-2 rounded-lg bg-green-50/50">
                      <p className="text-[9px] font-black text-green-700 uppercase mb-0.5">EL</p>
                      <p className={`text-base font-black ${data.el > 0 ? 'text-green-600' : 'text-slate-300'}`}>{data.el.toFixed(0)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-purple-50/50">
                      <p className="text-[9px] font-black text-purple-700 uppercase mb-0.5">Used CF</p>
                      <p className={`text-base font-black ${data.cf_used > 0 ? 'text-purple-600' : 'text-slate-300'}`}>{data.cf_used.toFixed(0)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-blue-50/50">
                      <p className="text-[9px] font-black text-blue-700 uppercase mb-0.5">CL</p>
                      <p className={`text-base font-black ${data.cl > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{data.cl.toFixed(0)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-amber-50/50">
                      <p className="text-[9px] font-black text-amber-700 uppercase mb-0.5">Unpaid</p>
                      <p className={`text-base font-black text-amber-700`}>{data.unpaid.toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="text-center p-2 rounded-lg bg-purple-50/50">
                      <p className="text-[9px] font-black text-purple-700 uppercase mb-0.5">Carry</p>
                      <p className={`text-base font-black text-purple-600`}>{quotas[user.emp_id]?.carried_forward_el || 0}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-emerald-50/50">
                      <p className="text-[9px] font-black text-emerald-700 uppercase mb-0.5">Rem EL</p>
                      <p className={`text-base font-black text-emerald-600`}>{24 - (quotas[user.emp_id]?.earned_leave_used || 0)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-sky-50/50">
                      <p className="text-[9px] font-black text-sky-700 uppercase mb-0.5">Rem CL</p>
                      <p className={`text-base font-black text-sky-600`}>{12 - (quotas[user.emp_id]?.casual_leave_used || 0)}</p>
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
                  <p className="text-[10px] font-bold text-slate-500 mt-1">{selectedMonthDetails.range}</p>
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-wider">{record.leave_type}</span>
                        {isAdmin && editingRecordId !== record.id && (
                          <button
                            onClick={() => handleEditRecord(record)}
                            className="px-2 py-0.5 text-[9px] font-black text-white bg-red-600 rounded hover:bg-red-700 transition-colors uppercase shadow-sm"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-bold text-black mt-0.5">{record.displayRange}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-black">{record.overlapDays} Days</p>
                      <p className={`text-[12px] font-bold uppercase ${record.status?.toLowerCase().includes("reject") ? "text-red-600 font-black" : "text-green-700"}`}>
                        {record.status}
                      </p>
                    </div>
                  </div>

                  {editingRecordId === record.id ? (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Casual</label>
                          <input
                            type="number"
                            className="w-full px-2 py-1 text-xs font-bold border rounded bg-white"
                            value={tempRecordData.casual}
                            onChange={(e) => setTempRecordData({ ...tempRecordData, casual: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Earned</label>
                          <input
                            type="number"
                            className="w-full px-2 py-1 text-xs font-bold border rounded bg-white"
                            value={tempRecordData.earned}
                            onChange={(e) => setTempRecordData({ ...tempRecordData, earned: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Unpaid</label>
                          <input
                            type="number"
                            className="w-full px-2 py-1 text-xs font-bold border rounded bg-white"
                            value={tempRecordData.unpaid}
                            onChange={(e) => setTempRecordData({ ...tempRecordData, unpaid: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveRecord(record)}
                          disabled={saveLoading}
                          className="flex-1 py-1.5 bg-green-600 text-white text-[10px] font-bold rounded uppercase hover:bg-green-700 transition-colors"
                        >
                          {saveLoading ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingRecordId(null)}
                          className="flex-1 py-1.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded uppercase hover:bg-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex gap-3 mt-1.5 ${record.status?.toLowerCase().includes("reject") ? "opacity-60" : ""}`}>
                      <span className="text-[10px] font-bold text-slate-500">CL: <span className={`text-black ${record.status?.toLowerCase().includes("reject") ? "text-red-600 line-through" : ""}`}>{record.casual || 0}</span></span>
                      <span className="text-[10px] font-bold text-slate-500">EL: <span className={`text-black ${record.status?.toLowerCase().includes("reject") ? "text-red-600 line-through" : ""}`}>{record.earned || 0}</span></span>
                      <span className="text-[10px] font-bold text-slate-500">UN: <span className={`text-black ${record.status?.toLowerCase().includes("reject") ? "text-red-600 line-through" : ""}`}>{record.unpaid || 0}</span></span>
                    </div>
                  )}

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

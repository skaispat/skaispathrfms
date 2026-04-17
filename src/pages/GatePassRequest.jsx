import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Calendar, Plus, User, FileText, CheckCircle, AlertCircle, X, MapPin, Briefcase, Users, Shield, Search, ChevronDown, Phone, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import useAuthStore from '../store/authStore';
import { sendGatePassMessageToHr } from '../whatsappMessageSender/sendGatePassWhatsapp';

const GatePassRequest = () => {
  const { user } = useAuthStore();

  // State
  const [loading, setLoading] = useState(true);
  const [passHistory, setPassHistory] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [monthlyRequestCount, setMonthlyRequestCount] = useState(0);
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
  const [hodDetails, setHodDetails] = useState({ name: 'Not Assigned', id: null });
  const [hrDetails, setHrDetails] = useState({ name: 'HR Department', id: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isUserHod, setIsUserHod] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    visitPlace: '',
    visitReason: '',
    departureTime: '',
    arrivalTime: '',
    whatsappNumber: '',
    gatePassImage: null
  });

  // Fetch Data on component mount
  useEffect(() => {
    if (user) {
      fetchUserDataAndHistory();
    }
  }, [user]);

  const fetchUserDataAndHistory = async () => {
    setLoading(true);
    try {
      // 0. Fetch Current User Details (is_hod, phone_number)
      const { data: currentUserData } = await supabase
        .from('users')
        .select('is_hod, phone_number')
        .eq('emp_id', user.emp_id)
        .single();

      if (currentUserData) {
        setIsUserHod(currentUserData.is_hod);
        if (currentUserData.phone_number) {
          setFormData(prev => ({ ...prev, whatsappNumber: currentUserData.phone_number }));
        } else if (user.phone_number) {
          setFormData(prev => ({ ...prev, whatsappNumber: user.phone_number }));
        }
      }

      // 1. Fetch HOD Details
      const { data: teamData } = await supabase
        .from('team_members')
        .select('hod_id')
        .eq('emp_id', user.emp_id)
        .maybeSingle();

      if (teamData?.hod_id) {
        const { data: hodUser } = await supabase
          .from('users')
          .select('full_name, department, phone_number')
          .eq('emp_id', teamData.hod_id)
          .single();

        if (hodUser) {
          setHodDetails({ name: hodUser.full_name, id: teamData.hod_id, department: hodUser.department, phone: hodUser.phone_number });
        } else {
          setHodDetails({ name: 'Not Assigned', id: null });
        }
      } else {
        setHodDetails({ name: 'Not Assigned', id: null });
      }

      // 2. Fetch HR Details
      const { data: hrData } = await supabase
        .from('users')
        .select('full_name, emp_id')
        .eq('department', 'HR')
        .order('is_hod', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (hrData) {
        setHrDetails({ name: hrData.full_name, id: hrData.emp_id });
      } else {
        setHrDetails({ name: 'Pawan Tiwari', id: 1 });
      }

      // 3. Fetch Gate Pass History for this user
      const { data: historyData, error: historyError } = await supabase
        .from('gate_pass')
        .select('*, users(full_name)')
        .eq('emp_id', user.emp_id)
        .order('timestamp', { ascending: false });

      if (historyError) throw historyError;

      const flattenedHistory = historyData.map(item => ({
        ...item,
        employee_name: item.users?.full_name || 'Unknown'
      }));

      setPassHistory(flattenedHistory);
      calculateStats(flattenedHistory);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load your gate pass data.');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (history) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const todayStr = new Date().toDateString();

    let total = history.length;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let monthlyCount = 0;
    let submittedToday = false;

    history.forEach(pass => {
      const passDate = new Date(pass.departure_from_plant || pass.timestamp);

      // Status counts
      const status = pass.status?.toLowerCase() || '';
      if (status.includes('pending')) pending++;
      else if (status.includes('approved')) approved++;
      else if (status.includes('rejected')) rejected++;

      // Monthly Limit Check
      if (passDate.getMonth() === currentMonth && passDate.getFullYear() === currentYear) {
        monthlyCount++;
      }

      // Daily Check
      if (passDate.toDateString() === todayStr) {
        submittedToday = true;
      }
    });

    setStats({ total, pending, approved, rejected });
    setMonthlyRequestCount(monthlyCount);
    setHasSubmittedToday(submittedToday);
  };

  const uploadImageToDrive = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `gate-passes/${Date.now()}.${fileExt}`;

      const { error } = await supabase
        .storage
        .from('images')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase
        .storage
        .from('images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'gatePassImage') {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (monthlyRequestCount >= 3) {
      toast.error('You have reached the monthly limit of 3 gate pass requests');
      return;
    }
    if (hasSubmittedToday) {
      toast.error('You have already submitted a gate pass request today.');
      return;
    }

    if (!formData.visitPlace || !formData.visitReason || !formData.departureTime || !formData.whatsappNumber) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!formData.gatePassImage) {
      toast.error('Please upload an attachment image');
      return;
    }

    // Validate Arrival Time
    if (formData.arrivalTime) {
      const departure = new Date(formData.departureTime);
      const arrival = new Date(formData.arrivalTime);
      if (arrival < departure) {
        toast.error('The arrival time cannot be earlier than the Departure time');
        return;
      }
    }

    setSubmitting(true);
    try {
      let imageUrl = '';
      if (formData.gatePassImage) {
        imageUrl = await uploadImageToDrive(formData.gatePassImage);
      }

      const insertData = {
        timestamp: new Date().toISOString(),
        emp_id: user.emp_id,
        place_reason_to_visit: `${formData.visitPlace} - ${formData.visitReason}`,
        departure_from_plant: formData.departureTime,
        arrival_at_plant: formData.arrivalTime || null,
        employee_whatsapp_number: formData.whatsappNumber,
        image_gate_pass: imageUrl,
        emp_name: user?.full_name || user?.Name,
        status: 'Pending HR',
        hod_name: isUserHod ? 'HR' : hodDetails.name,
        hod_id: isUserHod ? null : hodDetails.id,
        hr_id: hrDetails.id,
        hr_name: hrDetails.name
      };

      const { data, error } = await supabase
        .from('gate_pass')
        .insert([insertData])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        await supabase.from('logs').insert({
          request_id: data[0].id,
          request_type: 'Gate Pass',
          emp_id: user.emp_id,
          emp_name: user?.full_name || user?.Name || 'User',
          status: insertData.status,
          hod_id: hodDetails.id,
          hod_name: isUserHod ? 'HR' : hodDetails.name,
          hr_id: hrDetails.id,
          hr_name: hrDetails.name
        });
      }

      // Send WhatsApp notification
      if (data && data[0]) {
        const formatDateTime = (dateString) => {
          if (!dateString) return 'N/A';
          return new Date(dateString).toLocaleString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
        };

        const calculateDuration = (fromDate, toDate) => {
          if (!fromDate) return 'N/A';
          if (!toDate) return 'Same';
          const from = new Date(fromDate);
          const to = new Date(toDate);
          const fromDateStr = fromDate.toString().split('T')[0];
          const toDateStr = toDate.toString().split('T')[0];
          if (fromDateStr === toDateStr) return 'Same';
          const diffMs = to - from;
          if (diffMs < 0) return 'N/A';
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          return `${diffDays}`;
        };

        await sendGatePassMessageToHr({
          employeId: hrDetails.id,
          tableid: data[0].id,
          employeeName: user?.full_name || user?.Name || 'Employee',
          empId: user.emp_id,
          department: user?.department || 'N/A',
          leaveType: 'Gate Pass',
          fromDate: formatDateTime(formData.departureTime),
          toDate: formatDateTime(formData.arrivalTime),
          totalDays: calculateDuration(formData.departureTime, formData.arrivalTime),
          reason: `${formData.visitPlace} - ${formData.visitReason}`,
        });
      }

      toast.success('Gate Pass Request Submitted Successfully');
      setShowModal(false);
      setFormData({
        visitPlace: '',
        visitReason: '',
        departureTime: '',
        arrivalTime: '',
        whatsappNumber: user.phone_number || '',
        gatePassImage: null
      });
      fetchUserDataAndHistory();

    } catch (error) {
      console.error('Submission Error:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    return date.toLocaleString('en-GB', options);
  };

  const filteredHistory = passHistory.filter(item => {
    const searchString = searchTerm.toLowerCase();
    const matchesSearch =
      item.place_reason_to_visit?.toLowerCase().includes(searchString) ||
      item.employee_name?.toLowerCase().includes(searchString);

    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'pending') return matchesSearch && (item.status === 'Pending' || item.status === 'Pending HOD' || item.status === 'Pending HR');
    if (activeTab === 'approved') return matchesSearch && item.status?.toLowerCase() === 'approved';
    if (activeTab === 'rejected') return matchesSearch && item.status?.toLowerCase().includes('rejected');
    return matchesSearch;
  });

  const isLimitReached = monthlyRequestCount >= 3 || hasSubmittedToday;
  const limitMessage = monthlyRequestCount >= 3
    ? `You have used ${monthlyRequestCount}/3 gate passes for this month.`
    : 'You have already submitted a request today.';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden bg-slate-50/30 px-4 sm:px-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0 pt-2 lg:pt-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 drop-shadow-sm">My Gate Pass</h1>
          <p className="mt-1 text-sm text-slate-500">Track your out-plant visit requests</p>
        </div>
        <button
          onClick={() => {
            if (isLimitReached) {
              toast.error(limitMessage);
            } else {
              setShowModal(true);
            }
          }}
          disabled={isLimitReached}
          className={`inline-flex items-center justify-center px-6 py-3 rounded-2xl shadow-lg border border-transparent text-sm font-bold text-white transition-all transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-offset-2 w-full lg:w-auto
            ${isLimitReached
              ? 'bg-slate-400 cursor-not-allowed shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200 ring-indigo-500'}`}
        >
          <Plus size={18} className="mr-2" />
          {isLimitReached ? 'Limit Reached' : 'New Gate Pass'}
        </button>
      </div>

      {isLimitReached && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3 shrink-0 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
            <AlertCircle size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-wide">Submission Limit</h4>
            <p className="text-xs text-amber-700 font-medium mt-0.5">{limitMessage}</p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 sm:gap-6 shrink-0">
        <StatCard label="Pending" value={stats.pending} icon={Clock} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Approved" value={stats.approved} icon={CheckCircle} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="Rejected" value={stats.rejected} icon={AlertCircle} color="text-rose-600" bg="bg-rose-50" />
        <div className="hidden md:block">
          <StatCard label="Total" value={stats.total} icon={FileText} color="text-indigo-600" bg="bg-indigo-50" />
        </div>
      </div>

      {/* History Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col mb-4 min-h-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/60 rounded-xl overflow-x-auto no-scrollbar">
            {['all', 'pending', 'approved', 'rejected'].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap
                    ${isActive
                      ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
          <div className="relative max-w-full md:max-w-xs w-full group">
            <input
              type="text"
              placeholder="Filter gate passes..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
        </div>

        {/* List/Table */}
        <div className="overflow-auto flex-1 custom-scrollbar min-h-0">
          {/* Desktop Table */}
          <table className="hidden lg:table min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-200 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Date & Time</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Place & Reason</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Approver</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Image</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => {
                  const s = item.status?.toLowerCase() || '';
                  const statusLabel = (item.status === 'Pending' || item.status === 'Pending HOD') ? 'Pending HOD' : (item.status?.includes('Rejected') ? 'Rejected' : (item.status || 'Pending'));
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-all duration-200 group">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-sm text-slate-900">
                        <div className="flex flex-col">
                          <span>{formatDate(item.departure_from_plant, true)}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Applied: {formatDate(item.timestamp)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500 font-medium max-w-sm truncate" title={item.place_reason_to_visit}>{item.place_reason_to_visit}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${s === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm shadow-emerald-50' : s.includes('rejected') ? 'bg-rose-50 text-rose-700 border-rose-100 shadow-sm shadow-rose-50' : 'bg-amber-50 text-amber-700 border-amber-100 shadow-sm shadow-amber-50'}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">
                        {item.hod_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.image_gate_pass ? (
                          <a href={item.image_gate_pass} target="_blank" rel="noopener noreferrer" className="p-2 bg-indigo-50 rounded-lg text-indigo-600 hover:bg-indigo-100 transition-all inline-block shadow-sm ring-1 ring-white">
                            <ImageIcon size={16} />
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center opacity-40">
                      <FileText size={48} className="text-slate-300 mb-4" />
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No records available</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Mobile Card List */}
          <div className="lg:hidden p-4 space-y-4">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item, idx) => {
                const s = item.status?.toLowerCase() || '';
                const statusLabel = (item.status === 'Pending' || item.status === 'Pending HOD') ? 'Pending HOD' : (item.status?.includes('Rejected') ? 'Rejected' : (item.status || 'Pending'));
                return (
                  <div key={item.id} className="group/card bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-indigo-200 transition-all animate-in slide-in-from-right-4 duration-300 relative overflow-hidden" style={{ animationDelay: `${idx * 50}ms` }}>
                    {/* Top Bar with ID, Aligned Status, and Image Attachment */}
                    <div className="flex justify-between items-center bg-slate-50 -m-5 mb-0 px-5 py-4 border-b border-slate-100 rounded-t-2xl relative">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">GP-{item.id.toString().slice(-4)}</span>
                        <span className="text-[9px] font-bold text-slate-500 mt-1">{formatDate(item.timestamp)}</span>
                      </div>

                      {/* Centered Status Badge - Aligned with icons */}
                      <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm whitespace-nowrap ${s === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : s.includes('rejected') ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                          {statusLabel}
                        </span>
                      </div>

                      {item.image_gate_pass && (
                        <a href={item.image_gate_pass} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm ring-1 ring-slate-100 ring-inset hover:bg-indigo-50 transition-all z-20">
                          <ImageIcon size={16} />
                        </a>
                      )}
                      {!item.image_gate_pass && <div className="w-8 h-8" />} {/* Placeholder to maintain centering */}
                    </div>

                    {/* Visit Details */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50/50">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Departure</p>
                        <p className="text-[11px] font-bold text-slate-700 flex items-center gap-2"><Clock size={14} className="text-indigo-500" />{formatDate(item.departure_from_plant, true)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Arrival</p>
                        <p className="text-[11px] font-bold text-slate-700 flex items-center gap-2"><Clock size={14} className="text-slate-300" />{item.arrival_at_plant ? formatDate(item.arrival_at_plant, true) : 'Open Entry'}</p>
                      </div>
                    </div>

                    {/* Purpose Card */}
                    <div className="bg-slate-50/50 p-3.5 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5"><MapPin size={12} className="text-rose-400" /> Destination & Purpose</p>
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic line-clamp-3">{item.place_reason_to_visit}</p>
                    </div>

                    {/* Centered Approver Footer */}
                    <div className="flex items-center justify-center pt-3 border-t border-slate-100/80">
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Reviewed By:</span>
                        <span className="text-[10px] text-slate-900 font-black uppercase tracking-tight">{item.hod_name || 'HR Team'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center opacity-40">
                <FileText size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest">No passes found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-all duration-300">
          <div className="absolute inset-0" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-white animate-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">New Gate Pass Request</h3>
                <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mt-0.5">Application for plant exit</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2.5 rounded-2xl transition-all"
              >
                <X size={22} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 scrollbar-hide">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="p-2.5 bg-white rounded-xl text-slate-500 shadow-sm ring-1 ring-slate-100 shrink-0">
                      <User size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Applied By</p>
                      <p className="font-bold text-sm text-slate-900 truncate uppercase">{user?.full_name || 'User'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 shadow-sm">
                    <div className="p-2.5 bg-white rounded-xl text-indigo-600 shadow-sm ring-1 ring-indigo-50 shrink-0">
                      <Shield size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Level 1 Review</p>
                      <p className="font-bold text-sm text-slate-900 truncate uppercase">{hrDetails.name}</p>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                      <MapPin size={14} className="text-indigo-500" /> Visit Place
                    </label>
                    <input
                      type="text"
                      name="visitPlace"
                      value={formData.visitPlace}
                      onChange={handleInputChange}
                      placeholder="e.g. Client Site, Bank etc."
                      className="block w-full rounded-2xl border-slate-200 py-4 px-4 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-sm"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                      <Phone size={14} className="text-emerald-500" /> WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      name="whatsappNumber"
                      value={formData.whatsappNumber}
                      onChange={handleInputChange}
                      className="block w-full rounded-2xl border-slate-200 py-4 px-4 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                      <Clock size={14} className="text-indigo-500" /> Departure Time
                    </label>
                    <input
                      type="datetime-local"
                      name="departureTime"
                      value={formData.departureTime}
                      onChange={handleInputChange}
                      className="block w-full rounded-2xl border-slate-200 py-4 px-4 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-sm"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                      <Clock size={14} className="text-slate-400" /> Expected Arrival
                    </label>
                    <input
                      type="datetime-local"
                      name="arrivalTime"
                      value={formData.arrivalTime}
                      onChange={handleInputChange}
                      min={formData.departureTime}
                      disabled={!formData.departureTime}
                      className="block w-full rounded-2xl border-slate-200 py-4 px-4 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-sm disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Detailed Reason</label>
                  <textarea
                    name="visitReason"
                    rows={3}
                    value={formData.visitReason}
                    onChange={handleInputChange}
                    className="block w-full rounded-2xl border-slate-200 py-4 px-4 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium text-slate-700 shadow-sm resize-none"
                    placeholder="Briefly explain the purpose of your visit..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Image Attachment</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-white/50 transition-all group overflow-hidden">
                    {formData.gatePassImage ? (
                      <div className="flex items-center gap-3 p-4">
                        <ImageIcon className="text-indigo-500" size={24} />
                        <p className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{formData.gatePassImage.name}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 transition-colors mb-2" />
                        <p className="text-xs text-slate-500 font-medium">Click to upload <span className="font-black text-indigo-500">Gate Pass Photo</span></p>
                      </div>
                    )}
                    <input type="file" name="gatePassImage" className="hidden" onChange={handleInputChange} accept="image/*" />
                  </label>
                </div>

                {/* Footer */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-8 py-4 rounded-2xl text-sm font-black text-slate-500 uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-10 py-4 rounded-2xl text-sm font-black text-white uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transform active:scale-95 transition-all disabled:opacity-70"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
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

const StatCard = ({ label, value, icon: Icon, color, bg }) => (
  <div className="bg-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center gap-1 sm:gap-2 hover:shadow-md transition-all duration-300 group min-w-0 overflow-hidden">
    <div className={`p-1.5 sm:p-3 rounded-lg sm:rounded-2xl ${bg} ${color} transition-transform group-hover:scale-110 shadow-sm border border-white`}>
      <Icon size={14} className="sm:w-5 sm:h-5" />
    </div>
    <div className="space-y-0 w-full overflow-hidden">
      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter sm:tracking-widest truncate leading-tight">{label}</p>
      <h3 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight truncate">{value}</h3>
    </div>
  </div>
);

export default GatePassRequest;
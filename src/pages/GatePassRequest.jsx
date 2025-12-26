import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Calendar, Plus, User, FileText, CheckCircle, AlertCircle, X, MapPin, Briefcase, Users, Shield, Search, ChevronDown, Phone, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import useAuthStore from '../store/authStore';

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
          .select('full_name, department')
          .eq('emp_id', teamData.hod_id)
          .single();

        if (hodUser) {
          setHodDetails({ name: hodUser.full_name, id: teamData.hod_id, department: hodUser.department });
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
        status: (hodDetails.id === null || hodDetails.name === 'HR' || hodDetails.department === 'HR' || isUserHod || hodDetails.id === 1 || hodDetails.name === 'Pawan Tiwari') ? 'Pending HR' : 'Pending HOD', // Initial status
        hod_name: isUserHod ? 'HR' : hodDetails.name,
        hod_id: isUserHod ? null : hodDetails.id, // Insert HOD ID if not user
        hod_id: isUserHod ? null : hodDetails.id, // Insert HOD ID if not user
        hr_id: hrDetails.id, // Insert HR ID
        hr_name: hrDetails.name
      };

      const { data, error } = await supabase
        .from('gate_pass')
        .insert([insertData])
        .select();

      if (error) throw error;

      // Log entry
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

      if (error) throw error;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

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

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">My Gate Pass</h1>
          <p className="text-slate-500 mt-1 text-sm">View your gate pass history and status</p>
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
          className={`inline-flex items-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 
            ${isLimitReached
              ? 'bg-slate-400 cursor-not-allowed shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          <Plus size={18} className="mr-2" />
          {isLimitReached ? 'Limit Reached' : 'New Gate Pass'}
        </button>
      </div>

      {isLimitReached && (
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 flex items-center gap-3 shrink-0">
          <div className="p-1.5 bg-orange-100 rounded-full text-orange-600">
            <AlertCircle size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-orange-900">Submission Limit Reached</h4>
            <p className="text-sm text-orange-700 mt-0.5">
              {limitMessage}
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        {[
          { label: 'Total Requests', value: stats.total, color: 'blue', icon: FileText },
          { label: 'Pending', value: stats.pending, color: 'yellow', icon: Clock },
          { label: 'Approved', value: stats.approved, color: 'emerald', icon: CheckCircle },
          { label: 'Rejected', value: stats.rejected, color: 'red', icon: AlertCircle }
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
            </div>
            <div className={`p-3 rounded-lg bg-${stat.color}-50 text-${stat.color}-600`}>
              <stat.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {/* Tabs & Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-lg border border-slate-200/50">
            {['all', 'pending', 'approved', 'rejected'].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${isActive
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              );
            })}
          </div>

          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Search history..."
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Place & Reason</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">HOD</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Image</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => {
                  const statusKey = item.status?.toLowerCase() || 'pending';
                  let badgeClass = 'bg-slate-100 text-slate-800';
                  let statusLabel = (item.status === 'Pending' || item.status === 'Pending HOD') ? 'Pending HOD' : (item.status?.includes('Rejected') ? 'Rejected' : (item.status || 'Pending'));

                  if (statusKey.includes('pending')) {
                    badgeClass = 'bg-yellow-100 text-yellow-800';
                    if (statusKey.includes('hr')) badgeClass = 'bg-blue-100 text-blue-800';
                  } else if (statusKey.includes('approved')) {
                    badgeClass = 'bg-green-100 text-green-800';
                  } else if (statusKey.includes('rejected')) {
                    badgeClass = 'bg-red-100 text-red-800';
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 text-sm">{formatDate(item.departure_from_plant, true)}</span>
                          <span className="text-xs text-slate-400 mt-0.5">Applied: {formatDate(item.timestamp)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900 max-w-xs truncate" title={item.place_reason_to_visit}>
                          {item.place_reason_to_visit}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${badgeClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {item.hod_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {item.image_gate_pass ? (
                          <a href={item.image_gate_pass} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 transition-colors">
                            <ImageIcon size={16} /> View
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <FileText size={48} className="mb-4 text-slate-200" />
                      <p className="text-lg font-medium text-slate-900">No requests found</p>
                      <p className="text-sm mt-1">Try adjusting your filtering.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-all duration-300">
          <div className="absolute inset-0 bg-transparent" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <h3 className="text-xl font-semibold text-slate-800 tracking-tight">New Gate Pass</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-500 border border-slate-100 shadow-sm shrink-0">
                      <User size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Employee</p>
                      <p className="font-semibold text-sm text-slate-900 break-words leading-tight">{user?.full_name || 'User'}</p>
                    </div>
                  </div>

                  {!isUserHod && hodDetails.id && hodDetails.id !== 1 && hodDetails.name !== 'Not Assigned' && (
                    <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm shrink-0">
                        <Users size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-0.5">HOD</p>
                        <p className="font-semibold text-sm text-slate-900 break-words leading-tight">{hodDetails.name}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-purple-600 border border-purple-100 shadow-sm shrink-0">
                      <Shield size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-0.5">HR</p>
                      <p className="font-semibold text-sm text-slate-900 break-words leading-tight">{hrDetails.name}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Place to Visit <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <MapPin size={18} className="text-slate-400 group-focus-within:text-indigo-500" />
                    </div>
                    <input
                      type="text"
                      name="visitPlace"
                      value={formData.visitPlace}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 pl-10 py-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 placeholder-slate-400"
                      placeholder="e.g. Client Site, Vendor Office"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Reason <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <FileText size={18} className="text-slate-400 group-focus-within:text-indigo-500" />
                    </div>
                    <textarea
                      name="visitReason"
                      rows={2}
                      value={formData.visitReason}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 pl-10 py-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-medium text-slate-800 placeholder-slate-400"
                      placeholder="Brief purpose of visit..."
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Departure Time <span className="text-red-500">*</span></label>
                    <input
                      type="datetime-local"
                      name="departureTime"
                      value={formData.departureTime}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 py-2.5 px-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-600 sm:text-sm"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Expected Arrival</label>
                    <input
                      type="datetime-local"
                      name="arrivalTime"
                      value={formData.arrivalTime}
                      onChange={handleInputChange}
                      min={formData.departureTime}
                      disabled={!formData.departureTime}
                      className="block w-full rounded-xl border-slate-200 py-2.5 px-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-600 sm:text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">WhatsApp Number <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <Phone size={18} className="text-slate-400 group-focus-within:text-indigo-500" />
                    </div>
                    <input
                      type="tel"
                      name="whatsappNumber"
                      value={formData.whatsappNumber}
                      onChange={handleInputChange}
                      className="block w-full rounded-xl border-slate-200 pl-10 py-3 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 placeholder-slate-400"
                      placeholder="Enter number"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Attachment (Optional)</label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                        <p className="text-sm text-slate-500"><span className="font-semibold">Click to upload</span> image</p>
                      </div>
                      <input type="file" name="gatePassImage" className="hidden" onChange={handleInputChange} accept="image/*" />
                    </label>
                  </div>
                  {formData.gatePassImage && (
                    <p className="text-xs text-green-600 flex items-center gap-1 mt-1 font-medium">
                      <CheckCircle size={14} /> Selected: {formData.gatePassImage.name}
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-4 pt-6 mt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-8 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg shadow-indigo-200 transform hover:-translate-y-0.5 ${submitting ? 'opacity-70 cursor-not-allowed transform-none' : ''}`}
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

export default GatePassRequest;
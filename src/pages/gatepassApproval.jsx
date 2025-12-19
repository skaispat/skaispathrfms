import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FileText, User, Briefcase, Calendar, Clock, MessageSquare, Check, X, Shield, ChevronRight, Quote, MapPin, Phone, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const GatePassApproval = () => {
    const { approverId, id } = useParams();
    const [request, setRequest] = useState(null);
    const [approver, setApprover] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [currentRemarks, setCurrentRemarks] = useState('');
    const [error, setError] = useState(null);
    const [actionSuccess, setActionSuccess] = useState(false);
    const [successData, setSuccessData] = useState({ action: '', role: '' });

    useEffect(() => {
        if (id && approverId) {
            fetchRequest();
        }
    }, [id, approverId]);

    const fetchRequest = async () => {
        try {
            // Fetch Request
            const { data, error } = await supabase
                .from('gate_pass') // Changed from leave_management
                .select('*, users(full_name, emp_id)') // Join to get employee name
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!data) throw new Error('Request not found');

            // Fetch Approver Details
            // Try fetching by emp_id first
            let { data: approverData, error: approverError } = await supabase
                .from('users')
                .select('*')
                .eq('emp_id', approverId)
                .maybeSingle();

            // If not found by emp_id, try by UUID
            if (!approverData) {
                const { data: approverUuidData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', approverId)
                    .maybeSingle();
                approverData = approverUuidData;
            }

            // Fetch HR Name
            const { data: hrData } = await supabase
                .from('users')
                .select('full_name, phone_number, emp_id')
                .eq('department', 'HR')
                .order('is_hod', { ascending: false })
                .limit(1)
                .maybeSingle();

            // Prepare request object
            setRequest({
                ...data,
                employee_name: data.users?.full_name || 'Employee', // Handle joined data
                departureTime: formatDate(data.departure_from_plant),
                arrivalTime: data.arrival_at_plant ? formatDate(data.arrival_at_plant) : 'Not specified',
                hr_name: hrData?.full_name || 'HR Department',
                hr_phone: hrData?.phone_number,
                hr_id_val: hrData?.emp_id
            });

            if (approverData) {
                setApprover(approverData);
            } else {
                console.warn('Approver not found for ID:', approverId);
            }

        } catch (err) {
            console.error('Error fetching data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const handleAction = async (action) => {
        if (!request) return;
        if (!approver) {
            toast.error('Approver identification failed. Cannot process action.');
            return;
        }

        setActionLoading(true);

        try {
            let newStatus = request.status;
            let logAction = '';

            const isHodAction = request.status === 'Pending';
            const isHrAction = request.status === 'Pending HR';

            // Validate Approver Role
            if (isHodAction) {
                if (!approver.is_hod && approver.department !== 'HR' && approver.role !== 'admin') {
                    // Allow if approver name matches hod_name in request (loose check if backend logic is based on names)
                    // or stricter check:
                    if (!approver.is_hod) {
                        // Double check if this user is actually the assigned HOD for this request could be done here, 
                        // but sticking to basic permission check for now as per Duplicate request.
                        toast.error('You do not have HOD permissions.');
                        setActionLoading(false);
                        return;
                    }
                }
            }

            if (isHrAction) {
                if (approver.department !== 'HR') {
                    toast.error('You do not have HR permissions.');
                    setActionLoading(false);
                    return;
                }
            }

            if (!isHodAction && !isHrAction) {
                toast.error('Action already taken or invalid status.');
                setActionLoading(false);
                return;
            }

            if (action === 'approve') {
                if (isHodAction) {
                    if (approver.department === 'HR') {
                        newStatus = 'Approved'; // Skip 'Pending HR' step if HOD is HR
                        logAction = 'Approved (HOD & HR)';
                    } else {
                        newStatus = 'Pending HR';
                        logAction = 'Approved';
                    }
                } else if (isHrAction) {
                    newStatus = 'Approved';
                    logAction = 'Approved';
                }
            } else {
                newStatus = isHodAction ? 'Rejected by HOD' : 'Rejected by HR';
                logAction = 'Rejected';
            }

            // Update gate_pass
            const updateData = {
                status: newStatus,
                ...(isHodAction && {
                    hod_remarks: currentRemarks,
                    hod_id: approver.emp_id,
                    hod_name: approver.full_name
                }),
                ...(isHrAction && {
                    hr_remarks: currentRemarks,
                    hr_id: approver.emp_id
                }),
                // If HOD is HR and skipping, ensure HR fields are also filled
                ...((isHodAction && approver.department === 'HR' && action === 'approve') && {
                    hr_remarks: currentRemarks,
                    hr_id: approver.emp_id
                })
            };

            const { error: updateError } = await supabase
                .from('gate_pass')
                .update(updateData)
                .eq('id', id);

            if (updateError) throw updateError;

            // Log Update
            const logUpdateData = {
                status: newStatus,
                updated_at: new Date().toISOString(),
                ...(isHodAction && {
                    hod_action: logAction,
                    hod_approval_time: new Date().toISOString(),
                    hod_remarks: currentRemarks,
                    hod_id: approver.emp_id,
                    hod_name: approver.full_name
                }),
                ...(isHrAction && {
                    hr_action: logAction,
                    hr_approval_time: new Date().toISOString(),
                    hr_remarks: currentRemarks,
                    hr_id: approver.emp_id,
                    hr_name: approver.full_name
                })
            };

            await supabase
                .from('logs')
                .update(logUpdateData)
                .eq('request_id', id)
                .eq('request_type', 'Gate Pass'); // Changed to Gate Pass

            toast.success(`Request ${action === 'approve' ? 'Approved' : 'Rejected'} Successfully`);

            setSuccessData({
                action: action === 'approve' ? 'Approved' : 'Rejected',
                role: (isHodAction && approver.department === 'HR') ? 'HR' : (isHodAction ? 'HOD' : 'HR')
            });
            setActionSuccess(true);



        } catch (err) {
            console.error('Action error:', err);
            toast.error('Failed to process action');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" /></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-500 font-medium">{error}</div>;
    if (!request) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-slate-500">Request not found</div>;

    const isActionable = (request.status === 'Pending' && approver?.is_hod) ||
        (request.status === 'Pending HR' && approver?.department === 'HR');

    const notActionableReason = !isActionable && (request.status === 'Pending' || request.status === 'Pending HR')
        ? "You are not authorized to approve this request at this stage."
        : null;

    if (actionSuccess) {
        return (
            <div className="fixed inset-0 bg-gray-100/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 font-sans">
                <div className="max-w-sm w-full bg-white rounded-3xl shadow-2xl p-8 text-center animate-fade-in-up ring-1 ring-black/5">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl ${successData.action === 'Approved' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' : 'bg-gradient-to-br from-red-400 to-red-600 text-white'
                        }`}>
                        {successData.action === 'Approved' ? <Check className="w-10 h-10" /> : <X className="w-10 h-10" />}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Request {successData.action}</h2>
                    <p className="text-slate-500 mb-8 text-sm leading-relaxed">
                        {successData.role === 'HR'
                            ? `This request has been processed by the HR Department.`
                            : `This request has been processed by the Head of Department.`}
                    </p>
                    <button
                        onClick={() => window.close()}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm hover:bg-black transition-all shadow-xl shadow-slate-200"
                    >
                        Close Window
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-gray-50/50 backdrop-blur-sm flex flex-col items-center justify-center font-sans sm:p-4 md:p-6">
            <div className="w-full sm:max-w-lg md:max-w-2xl bg-white sm:rounded-3xl shadow-2xl shadow-slate-200/50 flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden sm:ring-1 sm:ring-black/5">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 leading-tight">Gate Pass Request</h2>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">ID: #{id?.slice(0, 8)}</p>
                        </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${request.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        request.status.includes('Rejected') ? 'bg-red-50 text-red-600 border border-red-100' :
                            'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                        {request.status.includes('Rejected') ? <X className="w-3 h-3" /> :
                            request.status === 'Approved' ? <Check className="w-3 h-3" /> :
                                <Clock className="w-3 h-3" />}
                        {request.status}
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">

                    {/* Upper Section: Action Banner + Employee Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left Col: Action Banner / Status */}
                        {isActionable ? (
                            <div className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-sm relative overflow-hidden group flex flex-col justify-between h-full">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2 opacity-90">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Action Required</p>
                                    </div>
                                    <h3 className="text-xl font-bold mb-1 tracking-tight leading-tight text-slate-900">
                                        Hi, {approver?.full_name?.split(' ')[0] || 'Approver'}
                                    </h3>
                                    <p className="text-slate-500 text-xs font-medium leading-relaxed">
                                        Review gate pass request from <span className="text-slate-900 font-bold">{request.employee_name}</span>.
                                    </p>
                                </div>
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-100/50" />
                            </div>
                        ) : notActionableReason ? (
                            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-start gap-3 h-full">
                                <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800 font-medium leading-relaxed">{notActionableReason}</p>
                            </div>
                        ) : null}

                        {/* Right Col: Employee & Stats */}
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-center">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-lg shadow-sm">
                                    {request.employee_name?.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 leading-tight">{request.employee_name}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Applicant</p>
                                </div>
                            </div>

                            <div className="bg-white px-3 py-2 rounded-xl border border-gray-200/50 mt-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">WhatsApp</p>
                                <div className="flex items-center gap-1.5">
                                    <Phone className="w-3 h-3 text-green-500" />
                                    <a href={`https://wa.me/${request.employee_whatsapp_number?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 truncate">
                                        {request.employee_whatsapp_number || "N/A"}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Date/Time Flow */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm relative flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="text-left">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Departure</p>
                                <p className="text-sm font-bold text-slate-900">{request.departureTime}</p>
                            </div>
                            <div className="px-4 text-gray-200">
                                <ChevronRight className="w-4 h-4" />
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Expected Arrival</p>
                                <p className="text-sm font-bold text-slate-900">{request.arrivalTime}</p>
                            </div>
                        </div>
                    </div>

                    {/* Place and Reason */}
                    <div className="space-y-3">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <MapPin className="w-3 h-3" />
                                Place & Reason
                            </h5>
                            <p className="text-xs leading-relaxed text-slate-700 font-medium">
                                {request.place_reason_to_visit || "No specific details provided."}
                            </p>
                        </div>

                        {/* Gate Pass Image Attachment */}
                        {request.image_gate_pass && (
                            <div className="bg-white p-4 rounded-xl border border-gray-100">
                                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <ImageIcon className="w-3 h-3" />
                                    Attachment
                                </h5>
                                <a
                                    href={request.image_gate_pass}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block relative rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-300 transition-colors group"
                                >
                                    <img
                                        src={request.image_gate_pass}
                                        alt="Gate Pass Attachment"
                                        className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                                        <span className="bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Click to View</span>
                                    </div>
                                </a>
                            </div>
                        )}

                        {request.hod_remarks && (
                            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">HOD Remarks</h5>
                                <div className="flex gap-3">
                                    <div className="w-0.5 bg-indigo-300 rounded-full" />
                                    <p className="text-xs leading-relaxed text-indigo-900">
                                        {request.hod_remarks}
                                    </p>
                                </div>
                            </div>
                        )}

                        {request.hr_remarks && (
                            <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                                <h5 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2">HR Remarks</h5>
                                <div className="flex gap-3">
                                    <div className="w-0.5 bg-purple-300 rounded-full" />
                                    <p className="text-xs leading-relaxed text-purple-900">
                                        {request.hr_remarks}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action Area */}
                {isActionable && (
                    <div className="p-4 bg-white border-t border-gray-100 shadow-xl z-30">
                        <div className="flex gap-3 items-end">
                            <div className="relative flex-1">
                                <textarea
                                    value={currentRemarks}
                                    onChange={(e) => setCurrentRemarks(e.target.value)}
                                    placeholder="Add remarks..."
                                    className="w-full h-12 py-3 px-4 pr-9 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all resize-none font-medium placeholder:text-gray-400"
                                />
                                <MessageSquare className="absolute right-3 top-3.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <button
                                onClick={() => handleAction('reject')}
                                disabled={actionLoading}
                                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs text-red-600 bg-white border border-red-100 hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50"
                            >
                                {actionLoading ? (
                                    <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <X className="w-4 h-4" />
                                        Reject
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => handleAction('approve')}
                                disabled={actionLoading}
                                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs text-white bg-[#16A34A] hover:bg-[#15803d] shadow-lg shadow-green-100 hover:shadow-xl hover:shadow-green-200 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {actionLoading ? (
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Approve Request
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GatePassApproval;

import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Bell, CheckCircle, Clock } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';

const Header = ({ children }) => {
  const { user, logout } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Fetch Notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;

      const isAdmin = user?.Admin === 'Yes' || user?.role === 'admin' || user?.role === 'Admin';
      const isHr = user?.role === 'hr' || user?.role === 'HR';
      const isHod = user?.is_hod;
      const empId = user?.emp_id;
      const userName = user?.full_name || user?.Name;

      try {
        // Fetch HR Name once for display
        let hrName = 'HR Admin';
        const { data: hrUsers } = await supabase
          .from('users')
          .select('full_name')
          .ilike('role', 'hr')
          .limit(1);

        if (hrUsers && hrUsers.length > 0) {
          hrName = hrUsers[0].full_name;
        }

        const notificationsMap = new Map();

        // Helper to add notification
        const addNotification = (item, type, context) => { // context: 'personal' | 'management'
          const isLeave = type === 'leave';
          const idPrefix = isLeave ? 'leave' : 'gate';
          const uniqueId = `${idPrefix}-${item.id}`;

          // Avoid duplicates (prioritize management view often has more info, or personal view is sufficient)
          if (notificationsMap.has(uniqueId)) return;

          const dateRange = isLeave
            ? `${new Date(item.leave_date_start).toLocaleDateString()} - ${new Date(item.leave_date_end).toLocaleDateString()}`
            : new Date(item.departure_from_plant).toLocaleString();

          const title = context === 'personal'
            ? (isLeave ? 'My Leave Request' : 'My Gate Pass')
            : `${item.employee_name || 'Employee'}`; // For HOD/Admin seeing others

          // Determine Display Status
          const rawStatus = item.status?.toLowerCase() || 'pending';
          let displayStatus = item.status;
          let hodStatus = 'Pending';
          let hrStatus = 'Pending';

          if (rawStatus.includes('approved')) {
            hodStatus = 'Approved';
            hrStatus = 'Approved';
          } else if (rawStatus === 'pending hr') {
            hodStatus = 'Approved';
            hrStatus = 'Pending';
          } else if (rawStatus.includes('rejected by hod')) {
            hodStatus = 'Rejected';
            hrStatus = '-';
          } else if (rawStatus.includes('rejected by hr')) {
            hodStatus = 'Approved';
            hrStatus = 'Rejected';
          }

          notificationsMap.set(uniqueId, {
            id: uniqueId,
            type: isLeave ? 'Leave Request' : 'Gate Pass',
            title: title,
            time: item.timestamp || item.created_at,
            link: isLeave ? (context === 'management' ? '/leave-management' : '/leave-request') : (context === 'management' ? '/gate-pass' : '/gate-pass-request'),
            status: item.status,
            context, // 'personal' or 'management'
            isLeave, // boolean flag for icon
            details: {
              type: isLeave ? item.leave_type : 'Gate Pass',
              description: isLeave ? item.reason : (item.place_reason_to_visit || 'No description'), // Add Description
              date: dateRange,
              hod: { name: item.hod_name || 'HOD', status: hodStatus },
              hr: { name: hrName, status: hrStatus }
            }
          });
        };

        // 1. Fetch My Requests (All Users)
        if (empId) {
          const [myLeaves, myGatePasses] = await Promise.all([
            supabase.from('leave_management').select('*').eq('emp_id', empId).order('timestamp', { ascending: false }).limit(20),
            supabase.from('gate_pass').select('*, users(full_name)').eq('emp_id', empId).order('timestamp', { ascending: false }).limit(20)
          ]);

          myLeaves.data?.forEach(item => addNotification(item, 'leave', 'personal'));
          myGatePasses.data?.forEach(item => {
            // For personal gate passes, we have the user object now but we know it's us.
            // Ensure we use the proper name field if it comes from the join.
            const enrichedItem = { ...item, employee_name: item.users?.full_name || item.employee_name || 'Me' };
            addNotification(enrichedItem, 'gate', 'personal');
          });
        }

        // 2. Fetch Management Requests (HOD / HR / Admin)
        if (isHod || isHr || isAdmin) {
          let leaveQuery = supabase.from('leave_management').select('*').order('timestamp', { ascending: false }).limit(50);
          let gateQuery = supabase.from('gate_pass').select('*, users(full_name)').order('timestamp', { ascending: false }).limit(50);

          if (!isAdmin && !isHr) {
            // If just HOD (not Admin/HR), restrict to their team
            leaveQuery = leaveQuery.eq('hod_name', userName);
            gateQuery = gateQuery.eq('hod_name', userName);
          }
          // If Admin/HR, we fetch ALL (already defined by default queries above)

          const [teamLeaves, teamGatePasses] = await Promise.all([leaveQuery, gateQuery]);

          teamLeaves.data?.forEach(item => {
            // Deduplicate: If I am looking at my own request in management view, skip if already added (or update context if needed)
            // But usually, management view is more authoritative for headers.
            // Let's just add. The Map handles deduplication based on ID.
            // However, we want 'Management' context to override 'Personal' if we want to show "Approve" actions?
            // Actually, for notification list, seeing "My Leave" is distinct from "Employee X Leave".
            // Since we deduplicate by ID, the first one wins.
            // 'Personal' added first. So if I am HOD and I approved my own leave (unlikely but possible), I see it as "My Leave".
            // If I want to see it as "Employee X" for approval, I should maybe key them uniquely?
            // No, usually notifications link to the same item.
            // Let's stick to deduplication. If I requested it, it's personal.
            // Ensure we don't overwrite if it's my own request already added.
            if (item.emp_id !== empId) {
              addNotification(item, 'leave', 'management');
            }
          });

          teamGatePasses.data?.forEach(item => {
            if (item.emp_id !== empId) {
              // item.users.full_name comes from the join
              const enrichedItem = { ...item, employee_name: item.users?.full_name || item.employee_name || 'Unknown Employee' };
              addNotification(enrichedItem, 'gate', 'management');
            }
          });
        }

        // 3. Fetch System Notifications (e.g. Requests for more leaves)
        if (isAdmin) {
          const { data: systemNotifs } = await supabase
            .from('notifications')
            .select('*')
            // You might want to filter by recipient_role or similar if valid
            .order('created_at', { ascending: false })
            .limit(20);

          systemNotifs?.forEach(item => {
            const uniqueId = `sys-${item.id}`;
            notificationsMap.set(uniqueId, {
              id: uniqueId,
              type: 'System Alert',
              title: 'Admin Notification',
              time: item.created_at,
              link: '/settings',
              status: item.is_read ? 'Read' : 'Unread',
              context: 'management',
              isLeave: false,
              message: item.message, // Use message directly for simple notifications
              details: {
                type: 'Alert',
                description: item.message,
                date: new Date(item.created_at).toLocaleDateString(),
                hod: null,
                hr: null
              }
            });
          });
        }

        const allNotifications = Array.from(notificationsMap.values()).sort((a, b) => new Date(b.time) - new Date(a.time));
        setNotifications(allNotifications);

      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/user-login');
    toast.success('Logged out successfully');
  };

  const handleNotificationClick = (link) => {
    setIsNotificationOpen(false);
    navigate(link);
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-20 px-3 sm:px-6 py-3">
      <div className="flex justify-between items-center max-w-7xl mx-auto w-full gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 overflow-visible pl-12 lg:pl-0">
          {children}
        </div>

        <div className="flex items-center space-x-3 sm:space-x-5">

          {/* Notification Bell */}
          <div className="relative z-30" ref={notificationRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsNotificationOpen(!isNotificationOpen);
              }}
              className="relative p-2 text-slate-950 bg-white/40 hover:bg-white/60 backdrop-blur-md rounded-full transition-all focus:outline-none border border-white/50 shadow-sm cursor-pointer"
            >
              <Bell size={20} className="text-slate-950" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white animate-pulse"></span>
              )}
            </button>

            {isNotificationOpen && (
              <div className="fixed inset-x-4 top-[64px] sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-3 w-auto sm:w-[28rem] bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 transform origin-top-right transition-all overflow-hidden ring-1 ring-slate-900/5 flex flex-col">
                <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-50 flex justify-between items-center bg-white flex-shrink-0">
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">Notifications</h3>
                  {notifications.length > 0 && (
                    <span className="text-[10px] font-bold text-white bg-[#991B1B] px-2.5 py-1 rounded-full shadow-sm shadow-red-200">{notifications.length} New</span>
                  )}
                </div>

                <div className="max-h-[60vh] sm:max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 overscroll-contain">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif.link)}
                        className="px-4 py-3 sm:px-5 sm:py-4 hover:bg-slate-50/80 transition-all cursor-pointer border-b border-slate-50 last:border-0 group relative"
                      >
                        <div className="flex gap-3 sm:gap-4">
                          {/* Icon Column */}
                          <div className="mt-1 flex-shrink-0">
                            {notif.type.includes('Leave') ? (
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-sm ${notif.status?.toLowerCase().includes('approved') ? 'bg-green-50 text-green-600' :
                                notif.status?.toLowerCase().includes('reject') ? 'bg-red-50 text-red-600' :
                                  'bg-blue-50 text-blue-600'
                                }`}>
                                <Clock size={20} strokeWidth={2} />
                              </div>
                            ) : (
                              <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm">
                                <Bell size={20} strokeWidth={2} />
                              </div>
                            )}
                          </div>

                          {/* Content Column */}
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-semibold text-slate-800 leading-tight">
                                {notif.title}
                              </p>
                              <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                {formatTimeAgo(notif.time)}
                              </span>
                            </div>

                            {/* Main Message / Details */}
                            <div className="text-sm text-slate-600 leading-relaxed space-y-1.5 mt-1">
                              {/* Leave Specific Layout */}
                              {notif.details ? (
                                <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100/80 text-xs text-slate-600 mt-1.5">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                    <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Type</span>
                                      <span className="font-medium text-slate-800">{notif.details.type}</span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date</span>
                                      <span className="font-medium text-slate-800 truncate" title={notif.details.date}>{notif.details.date}</span>
                                    </div>

                                    {/* Description Field */}
                                    <div className="col-span-2 flex flex-col mt-2 pt-2 border-t border-slate-200/60">
                                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Description</span>
                                      <p className="text-slate-600 italic line-clamp-2">{notif.details.description}</p>
                                    </div>

                                    {/* HOD Section */}
                                    {notif.details.hod && (
                                      <div className="flex flex-col mt-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">HOD</span>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="font-medium text-slate-700" title={notif.details.hod.name || notif.details.hod}>{notif.details.hod.name || notif.details.hod}</span>
                                          {notif.details.hod.status && (
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${notif.details.hod.status.includes('Approv') ? 'bg-green-100 text-green-700' :
                                              notif.details.hod.status.includes('Reject') ? 'bg-red-100 text-red-700' :
                                                'bg-slate-100 text-slate-500'
                                              }`}>
                                              {notif.details.hod.status}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* HR Section */}
                                    {notif.details.hr && (
                                      <div className="flex flex-col mt-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">HR</span>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="font-medium text-slate-700" title={notif.details.hr.name || notif.details.hr}>{notif.details.hr.name || notif.details.hr}</span>
                                          {notif.details.hr.status && (
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${notif.details.hr.status.includes('Approv') ? 'bg-green-100 text-green-700' :
                                              notif.details.hr.status.includes('Reject') ? 'bg-red-100 text-red-700' :
                                                'bg-slate-100 text-slate-500'
                                              }`}>
                                              {notif.details.hr.status}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p>{notif.message}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-12 text-center bg-slate-50/30">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 mb-4 text-slate-300 border border-slate-100">
                        <CheckCircle size={32} strokeWidth={1.5} />
                      </div>
                      <p className="text-sm font-semibold text-slate-600">All caught up!</p>
                      <p className="text-xs text-slate-400 mt-1">No new notifications at the moment.</p>
                    </div>
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                      className="text-xs font-semibold text-[#991B1B] hover:text-red-700 transition-colors uppercase tracking-wider"
                      onClick={() => setIsNotificationOpen(false)}
                    >
                      Close Notifications
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

          <div className="relative z-30" ref={dropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="flex items-center gap-3 pl-2 sm:pl-4 focus:outline-none group cursor-pointer"
            >
              <div className="flex flex-col items-end hidden md:block text-right">
                <p className="text-sm font-black text-slate-950 leading-tight group-hover:text-slate-800 transition-colors drop-shadow-sm">
                  {user?.full_name || user?.Name || 'Guest User'}
                </p>
                <p className="text-xs text-slate-800 font-bold capitalize">
                  {user?.role || user?.designation || 'User'}
                </p>
              </div>

              <div className="h-10 w-10 rounded-full bg-white/50 flex items-center justify-center border-2 border-white text-slate-900 overflow-hidden shadow-md group-hover:scale-105 transition-all">
                {user?.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={20} />
                )}
              </div>
            </button>

            {isDropdownOpen && (
              <div className="fixed inset-x-4 top-[64px] sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-3 w-auto sm:w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 transform origin-top-right transition-all">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <p className="text-sm font-bold text-slate-800 truncate">{user?.full_name || user?.Name || 'Guest User'}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email || 'No email'}</p>
                </div>

                <div className="py-1">
                  <Link
                    to="/my-profile"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#991B1B] transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <User size={18} />
                    My Profile
                  </Link>
                </div>

                <div className="py-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
import React, { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Edit2,
  Save,
  X,
  Camera,
  Shield,
  Clock,
  FileText,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  History,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getMyProfileData,
  getMyActivityHistory,
  uploadMyProfilePicture,
  updateMyProfileData
} from '../api/myProfileApi';

const MyProfile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Main Profile State
  const [profileData, setProfileData] = useState(null);
  const [formData, setFormData] = useState({});

  // History Data
  const [leaveData, setLeaveData] = useState([]);
  const [gatePassData, setGatePassData] = useState([]);

  // Fetch User Data from Supabase
  const fetchUserData = async () => {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) throw new Error("User session not found.");

      const sessionUser = JSON.parse(storedUser);
      // Fallback to username if emp_id missing
      const identifier = sessionUser.emp_id || sessionUser.username;

      if (!identifier) throw new Error("User identifier missing.");

      const data = await getMyProfileData(sessionUser);

      setProfileData(data);
      setFormData({ ...data, password: '' });

      // Store ID for other components if needed
      localStorage.setItem("employeeId", data.emp_id);

    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast.error(`Failed to load profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Activity History (Leaves & Gate Passes)
  const fetchActivityHistory = async () => {
    if (!profileData?.emp_id) return;

    try {
      const { leaves, passes } = await getMyActivityHistory(profileData.emp_id);

      if (leaves) {
        const sensitiveLeaves = leaves.map(leave => ({
          type: leave.leave_type || 'Leave',
          from: leave.leave_date_start ? new Date(leave.leave_date_start).toLocaleDateString('en-GB') : '-',
          to: leave.leave_date_end ? new Date(leave.leave_date_end).toLocaleDateString('en-GB') : '-',
          status: leave.status || 'Pending'
        }));
        setLeaveData(sensitiveLeaves);
      }

      if (passes) {
        const sensitivePasses = passes.map(pass => ({
          type: pass.pass_type || 'Gate Pass',
          outTime: pass.out_time || '-',
          inTime: pass.in_time || '-',
          status: pass.status || 'Pending'
        }));
        setGatePassData(sensitivePasses);
      }

      if (passes) {
        const sensitivePasses = passes.map(pass => ({
          reason: pass.place_reason_to_visit || 'Gate Pass',
          outTime: pass.departure_from_plant ? new Date(pass.departure_from_plant).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          inTime: pass.arrival_at_plant ? new Date(pass.arrival_at_plant).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          status: pass.status || 'Pending'
        }));
        setGatePassData(sensitivePasses);
      }

    } catch (error) {
      console.error("Error fetching activity history:", error);
      toast.error("Failed to load activity history");
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (profileData) {
      fetchActivityHistory();
    }
  }, [profileData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    try {
      setUploading(true);
      const file = e.target.files[0];
      if (!file) return;

      const publicUrl = await uploadMyProfilePicture(file, profileData.emp_id, !isEditing);
      setFormData(prev => ({ ...prev, profile_picture: publicUrl }));
      if (!isEditing) {
        setProfileData(prev => ({ ...prev, profile_picture: publicUrl }));
        toast.success('Profile picture updated');
      }

    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Update everything in formData except emp_id (pk) and timestamps
      const { created_at, updated_at, emp_id, password, ...updates } = formData;

      if (password && password.trim() !== '') {
        updates.password = password;
      }

      await updateMyProfileData(profileData.emp_id, updates);

      setProfileData({ ...formData, password: '' });
      setFormData(prev => ({ ...prev, password: '' })); // Clear password after save
      setIsEditing(false);
      toast.success("Profile updated successfully!");

    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profileData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#991B1B]"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-3 shrink-0">
        <div className="space-y-0.5">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight truncate drop-shadow-sm">My Profile</h1>
          <p className="text-slate-500 text-xs sm:text-sm hidden sm:block">Personal details and activity summary</p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData({ ...profileData, password: '' });
                }}
                className="px-3 py-2 text-xs sm:text-sm text-slate-600 hover:text-slate-800 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 sm:px-6 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 text-xs sm:text-sm font-bold active:scale-95"
              >
                <Save size={16} />
                <span>Save</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 sm:px-6 sm:py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm font-bold active:scale-95 text-xs sm:text-sm"
              title="Edit Profile"
            >
              <Edit2 size={16} className="text-indigo-600" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Left Column: Profile Card */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-all duration-500 relative">
              <div className="relative h-28 sm:h-32 bg-white overflow-hidden border-b border-slate-100">
                <img src="/SKA.png" alt="SKA Banner" className="w-full h-full object-contain p-3 sm:p-4 group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="px-4 sm:px-6 pb-6 sm:pb-8 relative">
                <div className="relative -mt-14 sm:-mt-16 mb-4 sm:mb-5 inline-block">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-4 border-white overflow-hidden bg-white shadow-xl flex items-center justify-center transform rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    {formData.profile_picture ? (
                      <img
                        src={formData.profile_picture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-white flex items-center justify-center">
                        <img src="/user.png" alt="User Avatar" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  <label className={`absolute -bottom-2 -right-2 bg-white text-indigo-600 p-2 sm:p-2.5 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all shadow-lg border border-slate-100 hover:scale-110 active:scale-95 ${!isEditing && 'hidden'}`}>
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Camera size={18} />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words">{formData.full_name || 'User'}</h2>
                  <p className="text-indigo-600 font-semibold text-xs sm:text-sm flex items-center gap-2 break-words">
                    <Briefcase size={16} className="shrink-0" />
                    <span>{formData.designation || 'No Designation'}</span>
                  </p>
                  <p className="text-slate-400 text-xs font-mono uppercase tracking-widest flex items-center gap-2">
                    <Shield size={14} className="shrink-0" />
                    <span>{formData.emp_id || 'ID N/A'}</span>
                  </p>

                  <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-100 grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-2.5 sm:p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Emp ID</p>
                      <p className="text-xs sm:text-sm font-bold text-slate-700 truncate">{formData.emp_id || '-'}</p>
                    </div>
                    <div className="p-2.5 sm:p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${formData.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {formData.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <div className="col-span-2 p-2.5 sm:p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Department</p>
                        <p className="text-xs sm:text-sm font-bold text-slate-700 break-words">{formData.department || '-'}</p>
                      </div>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <Shield size={18} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Details */}
          <div className="lg:col-span-8 space-y-6">
            <SectionCard title="Work Information" icon={Briefcase}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <InfoField label="EMP ID" value={formData.emp_id} icon={Shield} disabled={true} isEditing={isEditing} />
                <InfoField label="Designation" name="designation" value={formData.designation} onChange={handleInputChange} icon={Briefcase} isEditing={isEditing} />
                <InfoField
                  label="Department"
                  name="department"
                  type="select"
                  options={[
                    'HR',
                    'Admin',
                    'SMS',
                    'Rolling Mill',
                    'SMS Lab',
                    'Dispatch',
                    'R/M Purchase',
                    'Store Purchase',
                    'Store',
                    'WB (Weightment Bridge)',
                    'HouseKeeping',
                    'Health & Safety',
                    'Accounts',
                    'Sales',
                    'AUTOMOBILE'
                  ]}
                  value={formData.department}
                  onChange={handleInputChange}
                  icon={Briefcase}
                  isEditing={isEditing}
                />
                <InfoField label="Joining Date" name="joining_date" type="date" value={formData.joining_date} onChange={handleInputChange} icon={Calendar} isEditing={isEditing} />
                <InfoField label="Week Off" value={formData.week_off} icon={Calendar} disabled={true} isEditing={isEditing} />
              </div>
            </SectionCard>

            <SectionCard title="Personal Information" icon={User}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="col-span-1 sm:col-span-2">
                  <InfoField label="Full Name" name="full_name" value={formData.full_name} onChange={handleInputChange} icon={User} isEditing={isEditing} required />
                </div>
                <InfoField label="Username" value={formData.username} icon={User} disabled={true} isEditing={isEditing} />
                {isEditing && (
                  <InfoField
                    label="New Password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    icon={Lock}
                    isEditing={isEditing}
                    placeholder="Update password"
                  />
                )}

                <InfoField label="Date of Birth" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleInputChange} icon={Calendar} isEditing={isEditing} />
                <InfoField label="Gender" name="gender" type="select" options={['Male', 'Female', 'Other']} value={formData.gender} onChange={handleInputChange} icon={User} isEditing={isEditing} />
              </div>
            </SectionCard>

            <SectionCard title="Contact Information" icon={Phone}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="col-span-1 sm:col-span-2">
                  <InfoField label="Email Address" name="email" value={formData.email} onChange={handleInputChange} icon={Mail} isEditing={isEditing} required />
                </div>
                <InfoField label="Phone Number" name="phone_number" value={formData.phone_number} onChange={handleInputChange} icon={Phone} isEditing={isEditing} />
                <InfoField label="Emergency Contact" name="emergency_contact" value={formData.emergency_contact} onChange={handleInputChange} icon={Phone} isEditing={isEditing} />
                <div className="col-span-1 sm:col-span-2">
                  <InfoField label="Current Address" name="current_address" type="textarea" value={formData.current_address} onChange={handleInputChange} icon={MapPin} isEditing={isEditing} />
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        {/* History Section */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Clock className="text-indigo-600" size={20} />
            <span>Activity History</span>
          </h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <HistoryTable title="Leave History" data={leaveData} columns={['Type', 'From', 'To', 'Status']} keys={['type', 'from', 'to', 'status']} />
            <HistoryTable title="Gate Pass History" data={gatePassData} columns={['Reason', 'Out Time', 'In Time', 'Status']} keys={['reason', 'outTime', 'inTime', 'status']} />
          </div>
        </div>

      </div>
    </div>
  );
};

// UI Components

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-300">
    <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-white">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="bg-indigo-50 p-2 sm:p-2.5 rounded-xl border border-indigo-100 shrink-0">
          <Icon className="text-indigo-600 w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
      </div>
    </div>
    <div className="p-4 sm:p-6">
      {children}
    </div>
  </div>
);

const InfoField = ({ label, icon: Icon, name, value, onChange, type = "text", required = false, disabled = false, isEditing = true, options = null, placeholder = null }) => {
  const [showPassword, setShowPassword] = useState(false);

  // Read Only View
  if (!isEditing || disabled) {
    return (
      <div className="group animate-in fade-in slide-in-from-bottom-2 duration-300">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
          {label}
        </label>
        <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-100 group-hover:border-indigo-100 group-hover:bg-indigo-50/20 transition-all duration-300">
          <div className="p-1.5 sm:p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0">
            <Icon size={14} className="sm:w-4 sm:h-4" />
          </div>
          <span className={`text-xs sm:text-[13px] font-bold ${!value ? 'text-slate-300 italic' : 'text-slate-700'} break-words [overflow-wrap:anywhere] leading-snug flex-1 min-w-0`}>
            {value ? (type === 'date' ? new Date(value).toLocaleDateString('en-GB') : type === 'password' ? '••••••••' : value) : 'Not specified'}
          </span>
        </div>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="animate-in zoom-in-95 duration-200">
      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 sm:mb-2 ml-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative group/field">
        <div className="absolute inset-y-0 left-0 pl-3.5 sm:pl-4 flex items-center pointer-events-none">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within/field:text-indigo-500 transition-colors" />
        </div>

        {type === 'select' ? (
          <select
            name={name}
            value={value || ''}
            onChange={onChange}
            className="w-full pl-10 sm:pl-12 pr-9 sm:pr-10 py-2.5 sm:py-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none bg-white transition-all shadow-sm appearance-none font-medium text-xs sm:text-sm text-slate-700 hover:border-indigo-300"
          >
            <option value="">Select {label}</option>
            {options && options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            name={name}
            value={value || ''}
            onChange={onChange}
            rows="3"
            className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none resize-none transition-all shadow-sm font-medium text-xs sm:text-sm text-slate-700 hover:border-indigo-300"
            placeholder={placeholder || `Enter ${label}`}
          ></textarea>
        ) : (
          <>
            <input
              type={type === 'password' ? (showPassword ? 'text' : 'password') : type}
              name={name}
              value={value || ''}
              onChange={onChange}
              className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm font-medium text-xs sm:text-sm text-slate-700 hover:border-indigo-300"
              placeholder={placeholder || `Enter ${label}`}
            />
            {type === 'password' && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 sm:pr-4 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          </>
        )}
        {type === 'select' && (
          <div className="absolute inset-y-0 right-0 pr-3.5 sm:pr-4 flex items-center pointer-events-none text-slate-400">
            <ChevronDown size={18} />
          </div>
        )}
      </div>
    </div>
  );
};

const HistoryTable = ({ title, data, columns, keys }) => (
  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow duration-300">
    <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-white relative gap-2">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="bg-indigo-50 p-2 sm:p-2.5 rounded-xl border border-indigo-100 shrink-0">
          <History className="text-indigo-600 w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">{title}</h3>
      </div>
      <span className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold bg-slate-50 border border-slate-100 text-slate-500 shadow-sm uppercase tracking-wider shrink-0">
        <FileText size={14} className="text-indigo-500" />
        {data.length} Records
      </span>
    </div>

    {/* Desktop View (Table) */}
    <div className="hidden lg:block overflow-x-auto flex-1">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50/50">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length > 0 ? (
            data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors group">
                {keys.map((key, j) => (
                  <td key={j} className="px-6 py-4 text-sm font-medium text-slate-600">
                    {key === 'status' ? (
                      <StatusBadge status={row[key]} />
                    ) : (
                      row[key]
                    )}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-6 py-16 text-center text-slate-400 italic font-medium bg-slate-50/30">
                No history records found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* Mobile/Tablet View (Cards) */}
    <div className="lg:hidden p-3 sm:p-6 space-y-3 sm:space-y-4 max-h-[500px] overflow-y-auto bg-slate-50/30 custom-scrollbar">
      {data.length > 0 ? (
        data.map((row, i) => (
          <div key={i} className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 sm:space-y-4 hover:border-indigo-200 transition-colors animate-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-start gap-2">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{columns[0]}</p>
                <p className="font-bold text-slate-900 text-xs sm:text-sm break-words">{row[keys[0]]}</p>
              </div>
              <StatusBadge status={row[keys[keys.length - 1]]} />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-3 sm:pt-4 border-t border-slate-50">
              {keys.slice(1, -1).map((key, j) => (
                <div key={j} className="space-y-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{columns[j + 1]}</p>
                  <p className="text-xs font-bold text-slate-700 break-words">{row[key]}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="py-12 text-center text-slate-400 italic text-xs sm:text-sm">No records found</div>
      )}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const s = status?.toString().toLowerCase() || '';
  let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';

  if (s.includes('approv')) colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm shadow-emerald-50';
  else if (s.includes('reject') || s.includes('declin')) colorClass = 'bg-rose-50 text-rose-700 border-rose-100 shadow-sm shadow-rose-50';
  else if (s.includes('pend')) colorClass = 'bg-amber-50 text-amber-700 border-amber-100 shadow-sm shadow-amber-50';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${colorClass} shrink-0`}>
      {status}
    </span>
  );
};

export default MyProfile;

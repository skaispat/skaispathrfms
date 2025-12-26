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
  Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';

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

      let query = supabase.from('users').select('*');
      if (sessionUser.emp_id) {
        query = query.eq('emp_id', sessionUser.emp_id);
      } else {
        query = query.eq('username', sessionUser.username);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      if (!data) throw new Error("User profile not found.");

      setProfileData(data);
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
      // Fetch Leave Data
      const { data: leaves, error: leaveError } = await supabase
        .from('leave_management')
        .select('*')
        .eq('emp_id', profileData.emp_id)
        .order('timestamp', { ascending: false });

      if (leaveError) throw leaveError;

      if (leaves) {
        const sensitiveLeaves = leaves.map(leave => ({
          type: leave.leave_type || 'Leave',
          from: leave.leave_date_start ? new Date(leave.leave_date_start).toLocaleDateString('en-GB') : '-',
          to: leave.leave_date_end ? new Date(leave.leave_date_end).toLocaleDateString('en-GB') : '-',
          status: leave.status || 'Pending'
        }));
        setLeaveData(sensitiveLeaves);
      }

      // Fetch Gate Pass Data
      const { data: passes, error: passError } = await supabase
        .from('gate_pass')
        .select('*')
        .eq('emp_id', profileData.emp_id)
        .order('timestamp', { ascending: false });

      if (passError) throw passError;

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

      const fileExt = file.name.split('.').pop();
      const fileName = `profile-pictures/${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      let { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, profile_picture: data.publicUrl }));

      // Auto save image immediately if not in edit mode
      if (!isEditing) {
        await supabase.from('users').update({ profile_picture: data.publicUrl }).eq('emp_id', profileData.emp_id);
        setProfileData(prev => ({ ...prev, profile_picture: data.publicUrl }));
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

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('emp_id', profileData.emp_id);

      if (error) throw error;

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
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900"><span>My Profile</span></h1>
          <p className="text-slate-500 mt-1 text-sm"><span>Manage your personal information and view history.</span></p>
        </div>
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData({ ...profileData, password: '' }); // Reset changes and clear password
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
              >
                <Save size={18} />
                <span>Save Changes</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium"
            >
              <Edit2 size={18} />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-6 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Profile Card */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="relative h-32 bg-gradient-to-r from-slate-100 to-slate-200">
                  <div className="absolute inset-0 bg-slate-50/50"></div>
                </div>
                <div className="px-6 pb-6 relative">
                  <div className="relative -mt-16 mb-4 inline-block group">
                    <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-white shadow-md flex items-center justify-center">
                      {formData.profile_picture ? (
                        <img
                          src={formData.profile_picture}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User size={64} className="text-slate-300" />
                      )}
                    </div>
                    <label className={`absolute bottom-1 right-1 bg-indigo-600 text-white p-2.5 rounded-full cursor-pointer hover:bg-indigo-700 transition-colors shadow-lg border-2 border-white ${!isEditing && 'hidden'}`}>
                      {uploading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Camera size={16} />
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

                  <div>
                    <h2 className="text-2xl font-bold text-slate-800"><span className="notranslate">{formData.full_name || 'User'}</span></h2>
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="text-slate-500 font-medium flex items-center gap-2">
                        <Briefcase size={16} className="text-indigo-600" />
                        <span className="notranslate">{formData.designation || 'No Designation'}</span>
                      </p>
                      <p className="text-slate-400 text-sm flex items-center gap-2">
                        <Shield size={16} className="text-slate-400" />
                        <span className="notranslate">{formData.emp_id || 'ID N/A'}</span>
                      </p>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500"><span>Department</span></span>
                        <span className="font-semibold text-slate-800"><span className="notranslate">{formData.department || '-'}</span></span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500"><span>Status</span></span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${formData.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          <span className="notranslate">{formData.is_active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500"><span>Role</span></span>
                        <span className="font-semibold text-slate-800 uppercase"><span className="notranslate">{formData.role || 'Employee'}</span></span>
                      </div>
                      {formData.is_hod && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500"><span>Authority</span></span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <span className="notranslate">HOD</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Details */}
            <div className="lg:col-span-8 space-y-6">
              <SectionCard title="Work Information" icon={Briefcase}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      'Sales'
                    ]}
                    value={formData.department}
                    onChange={handleInputChange}
                    icon={Briefcase}
                    isEditing={isEditing}
                  />
                  <InfoField label="Joining Date" name="joining_date" type="date" value={formData.joining_date} onChange={handleInputChange} icon={Calendar} isEditing={isEditing} />
                </div>
              </SectionCard>

              <SectionCard title="Personal Information" icon={User}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoField label="Full Name" name="full_name" value={formData.full_name} onChange={handleInputChange} icon={User} isEditing={isEditing} required />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoField label="Email Address" name="email" value={formData.email} onChange={handleInputChange} icon={Mail} isEditing={isEditing} required />
                  <InfoField label="Phone Number" name="phone_number" value={formData.phone_number} onChange={handleInputChange} icon={Phone} isEditing={isEditing} />
                  <InfoField label="Emergency Contact" name="emergency_contact" value={formData.emergency_contact} onChange={handleInputChange} icon={Phone} isEditing={isEditing} />
                  <div className="md:col-span-2">
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
    </div>
  );
};

// UI Components

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50/50">
      <div className="bg-indigo-50 p-2 rounded-lg">
        <Icon className="text-indigo-600" size={20} />
      </div>
      <h3 className="font-bold text-slate-900"><span>{title}</span></h3>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

const InfoField = ({ label, icon: Icon, name, value, onChange, type = "text", required = false, disabled = false, isEditing = true, options = null, placeholder = null }) => {
  const [showPassword, setShowPassword] = useState(false);

  // Read Only View
  if (!isEditing || disabled) {
    return (
      <div className="group">
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5"><span>{label}</span></label>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 group-hover:border-slate-300 transition-colors">
          <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className={`text-sm font-medium ${!value ? 'text-slate-400 italic' : 'text-slate-700'}`}>
            <span className="notranslate">{value ? (type === 'date' ? new Date(value).toLocaleDateString('en-GB') : type === 'password' ? '••••••••' : value) : 'Not set'}</span>
          </span>
        </div>
      </div>
    );
  }

  // Edit Mode
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        <span>{label}</span> {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon className="h-4 w-4 text-slate-400" />
        </div>

        {type === 'select' ? (
          <select
            name={name}
            value={value || ''}
            onChange={onChange}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white transition-all shadow-sm notranslate"
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
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none transition-all shadow-sm notranslate"
            placeholder={placeholder || `Enter ${label}`}
          ></textarea>
        ) : (
          <>
            <input
              type={type === 'password' ? (showPassword ? 'text' : 'password') : type}
              name={name}
              value={value || ''}
              onChange={(e) => {
                if (type === 'password' && !showPassword) setShowPassword(true);
                onChange(e);
              }}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm notranslate"
              placeholder={placeholder || `Enter ${label}`}
            />
            {type === 'password' && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const HistoryTable = ({ title, data, columns, keys }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
      <h3 className="font-bold text-slate-900"><span>{title}</span></h3>
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-500 shadow-sm">
        <FileText size={12} />
        <span>{data.length} Records</span>
      </span>
    </div>
    <div className="overflow-x-auto flex-1">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"><span>{col}</span></th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length > 0 ? (
            data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                {keys.map((key, j) => (
                  <td key={j} className="px-6 py-4 text-sm text-slate-600">
                    {key === 'status' ? (
                      <StatusBadge status={row[key]} />
                    ) : (
                      <span className="notranslate">{row[key]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500 italic">
                <span>No records found</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const s = status?.toString().toLowerCase() || '';
  let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';

  if (s.includes('approv')) colorClass = 'bg-green-50 text-green-700 border-green-200';
  else if (s.includes('reject') || s.includes('declin')) colorClass = 'bg-red-50 text-red-700 border-red-200';
  else if (s.includes('pend')) colorClass = 'bg-yellow-50 text-yellow-700 border-yellow-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      <span className="notranslate">{status}</span>
    </span>
  );
};

export default MyProfile;

import React, { useState, useEffect } from 'react';
import {
    Users,
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    Check,
    Shield,
    Mail,
    Phone,
    MapPin,
    Briefcase,
    Calendar,
    User,
    Power,
    Camera,
    Eye,
    EyeOff,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    AlertCircle
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

const Settings = () => {
    const { user: currentUser } = useAuthStore();
    // Define Page Permissions Constants
    const ALL_PAGES = [
        { id: '/', label: 'Dashboard' },
        { id: 'indent', label: 'Job Vacancy' },
        { id: 'find-enquiry', label: 'Find Enquiry' },
        { id: 'call-tracker', label: 'Call Tracker' },
        { id: 'joining', label: 'Joining Checklist' },
        { id: 'after-joining-work', label: 'After Joining Work' },
        { id: 'leaving', label: 'Leaving Checklist' },
        { id: 'after-leaving-work', label: 'After Leaving Work' },
        { id: 'employee', label: 'Employee Management' },
        { id: 'my-profile', label: 'My Profile' },
        { id: 'my-attendance', label: 'My Attendance' },
        { id: 'leave-request', label: 'Leave Request' },
        { id: 'my-salary', label: 'My Salary' },
        { id: 'company-calendar', label: 'Company Calendar' },
        { id: 'leave-management', label: 'Leave Management' },
        { id: 'gate-pass', label: 'Gate Pass' },
        { id: 'gate-pass-request', label: 'Gate Pass Request' },
        { id: 'attendance', label: 'Attendance' },
        { id: 'attendancedaily', label: 'Attendance Daily' },
        { id: 'report', label: 'Reports' },
        { id: 'payroll', label: 'Payroll' },
        { id: 'misreport', label: 'MIS Report' },
        { id: 'settings', label: 'Settings' }
    ];

    const DEFAULT_USER_PAGES = [
        'my-profile',
        'my-attendance',
        'leave-request',
        'gate-pass-request',
        'my-salary',
        'company-calendar'
    ];

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('users'); // 'users' | 'hod'
    const [selectedDepartment, setSelectedDepartment] = useState('All');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // HOD Management State
    const [selectedHod, setSelectedHod] = useState(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [hodSearchTerm, setHodSearchTerm] = useState('');

    // Modal Team Selection
    const [selectedTeam, setSelectedTeam] = useState([]);
    const [teamSearchTerm, setTeamSearchTerm] = useState('');
    const [assignSearchTerm, setAssignSearchTerm] = useState('');

    // Validation Errors
    const [errors, setErrors] = useState({});

    // Leave Quota State - uses employee_leave_balances view fields
    const [leaveQuota, setLeaveQuota] = useState({
        casual_leave_remaining: 12,
        earned_leave_remaining: 24,
        unpaid_leave_total_taken: 0
    });
    const [loadingQuota, setLoadingQuota] = useState(false);


    // Form State
    const [formData, setFormData] = useState({
        emp_id: '',
        full_name: '',
        email: '',
        password: '',
        role: 'employee',
        designation: '',
        department: '',
        is_hod: false,
        page_access: DEFAULT_USER_PAGES,
        phone_number: '',
        date_of_birth: '',
        joining_date: '',
        gender: '',

        emergency_contact: '',
        current_address: '',
        username: '',
        is_active: true,
        profile_picture: ''
    });

    const [showPassword, setShowPassword] = useState(false);

    // Leave Request State (Admin)
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [leaveFormData, setLeaveFormData] = useState({
        employeeId: '',
        employeeName: '',
        designation: '',
        hodName: '',
        leaveType: '',
        fromDate: '',
        toDate: '',
        toDate: '',
        reason: '',
        hodId: '' // Add hodId to state
    });

    // Custom Dropdown State for Leave Request
    const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
    const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const [usersResponse, teamResponse] = await Promise.all([
                supabase
                    .from('users')
                    .select('*')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('team_members')
                    .select('*')
            ]);

            if (usersResponse.error) throw usersResponse.error;
            // distinct error handling for team members in case table doesn't exist yet
            if (teamResponse.error && teamResponse.error.code !== 'PGRST116') {
                console.warn('Error fetching team members:', teamResponse.error);
            }

            const teamMap = {}; // emp_id -> hod_id (Last one wins - for backward compatibility)
            const teamMapAll = {}; // emp_id -> [hod_id] (All HODs)

            if (teamResponse.data) {
                teamResponse.data.forEach(t => {
                    teamMap[t.emp_id] = t.hod_id;
                    if (!teamMapAll[t.emp_id]) teamMapAll[t.emp_id] = [];
                    teamMapAll[t.emp_id].push(t.hod_id);
                });
            }

            const usersWithTeam = (usersResponse.data || []).map(u => ({
                ...u,
                hod_id: teamMap[u.emp_id] || null,
                hod_ids: teamMapAll[u.emp_id] || []
            }));

            setUsers(usersWithTeam);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            emp_id: '',
            full_name: '',
            email: '',
            password: '', // Only for new users or password reset
            role: 'employee',
            designation: '',
            department: '',
            phone_number: '',
            date_of_birth: '',
            joining_date: '',
            gender: '',

            emergency_contact: '',
            current_address: '',
            username: '',
            is_active: true,
            is_hod: false,
            page_access: DEFAULT_USER_PAGES,
            profile_picture: ''
        });
        setSelectedTeam([]);
        setEditingUser(null);
        setErrors({});
    };



    const handleOpenModal = async (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                emp_id: user.emp_id,
                full_name: user.full_name,
                email: user.email,
                password: '', // Don't show existing password
                role: user.role || 'employee',
                designation: user.designation || '',
                department: user.department || '',
                phone_number: user.phone_number || '',
                date_of_birth: user.date_of_birth || '',
                joining_date: user.joining_date || '',
                gender: user.gender || '',

                emergency_contact: user.emergency_contact || '',
                current_address: user.current_address || '',
                username: user.username || '',
                is_active: user.is_active,
                is_hod: user.is_hod || false,
                page_access: user.page_access || DEFAULT_USER_PAGES,
                profile_picture: user.profile_picture || ''
            });

            // If editing, find current team members
            const currentTeam = users.filter(u => u.hod_id === user.emp_id).map(u => u.emp_id);
            setSelectedTeam(currentTeam);

            // Fetch leave quota for the user
            await fetchLeaveQuota(user.emp_id);
        } else {
            resetForm();
            // Reset leave quota for new users only
            setLeaveQuota({
                casual_leave_remaining: 12,
                earned_leave_remaining: 24,
                unpaid_leave_total_taken: 0
            });
        }
        setIsModalOpen(true);
    };

    const fetchLeaveQuota = async (empId) => {
        setLoadingQuota(true);
        try {
            // Use the employee_leave_balances view which computes remaining balances
            const { data, error } = await supabase
                .from('employee_leave_balances')
                .select('*')
                .eq('emp_id', empId)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setLeaveQuota({
                    casual_leave_remaining: data.casual_leave_remaining ?? 12,
                    earned_leave_remaining: data.earned_leave_remaining ?? 24,
                    unpaid_leave_total_taken: data.unpaid_leave_total_taken ?? 0
                });
            } else {
                // No record exists yet for this year - show full limits
                setLeaveQuota({
                    casual_leave_remaining: 12,
                    earned_leave_remaining: 24,
                    unpaid_leave_total_taken: 0
                });
            }
        } catch (error) {
            console.error('Error fetching leave quota:', error);
            toast.error('Failed to load leave information');
        } finally {
            setLoadingQuota(false);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        if (name === 'phone_number') {
            // Only allow numbers and max 10 digits
            const numbersOnly = value.replace(/[^0-9]/g, '');
            if (numbersOnly.length > 10) return;

            setFormData(prev => ({
                ...prev,
                [name]: numbersOnly
            }));
            return;
        }

        if (name === 'emp_id') {
            // Remove leading zeros and enforce uppercase (prevents 001, 0, etc.)
            const newEmpId = value.replace(/^0+/, '').toUpperCase();

            setFormData(prev => ({
                ...prev,
                [name]: newEmpId
            }));

            // Real-time duplicate check
            const duplicate = users.find(u => u.emp_id === newEmpId);

            if (duplicate) {
                // If editing, it's a conflict only if the found user is NOT the one we are editing
                // If creating (editingUser is null), any match is a conflict
                if (!editingUser || duplicate.emp_id !== editingUser.emp_id) {
                    setErrors(prev => ({ ...prev, emp_id: 'This EMP ID is already assigned to another user' }));
                } else {
                    setErrors(prev => ({ ...prev, emp_id: '' }));
                }
            } else {
                setErrors(prev => ({ ...prev, emp_id: '' }));
            }

            return;
        }

        setFormData(prev => {
            const newData = {
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            };

            // Auto-set admin pages if role becomes admin
            if (name === 'role' && (value === 'admin' || value === 'Admin')) {
                newData.page_access = ALL_PAGES.map(p => p.id);
                newData.is_hod = true;
            }

            // Auto-set leave-management and gate-pass page access if is_hod is checked
            if (name === 'is_hod') {
                let currentAccess = [...(prev.page_access || [])];

                if (checked) {
                    if (!currentAccess.includes('leave-management')) {
                        currentAccess.push('leave-management');
                    }
                    if (!currentAccess.includes('gate-pass')) {
                        currentAccess.push('gate-pass');
                    }
                } else {
                    // Remove leave-management and gate-pass
                    currentAccess = currentAccess.filter(id => id !== 'leave-management' && id !== 'gate-pass');
                }
                newData.page_access = currentAccess;
            }

            return newData;
        });
    };

    const scrollToField = (fieldName) => {
        // specific timeout to allow UI to render error message space
        setTimeout(() => {
            const element = document.getElementsByName(fieldName)[0];
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.focus();
            }
        }, 100);
    };

    const handlePageAccessToggle = (pageId) => {
        setFormData(prev => {
            const currentAccess = prev.page_access || [];
            if (currentAccess.includes(pageId)) {
                return { ...prev, page_access: currentAccess.filter(id => id !== pageId) };
            } else {
                return { ...prev, page_access: [...currentAccess, pageId] };
            }
        });
    };

    const handleSelectAllPages = () => {
        setFormData(prev => ({ ...prev, page_access: ALL_PAGES.map(p => p.id) }));
    };

    const handleDeselectAllPages = () => {
        setFormData(prev => ({ ...prev, page_access: [] }));
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

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('images')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, profile_picture: data.publicUrl }));
            toast.success('Image uploaded successfully');

        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error('Error uploading image: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Create a cleaned version of the form data to ensure whitespace doesn't bypass checks
        const cleanedData = {
            ...formData,
            emp_id: formData.emp_id?.trim().toUpperCase(),
            username: formData.username?.trim(),
            email: formData.email?.trim(),
            full_name: formData.full_name?.trim()
        };

        // Basic validation
        const newErrors = {};

        // Validations
        if (!cleanedData.emp_id) newErrors.emp_id = 'EMP ID is required';

        if (!cleanedData.username) newErrors.username = 'Username is required';
        else if (/\s/.test(cleanedData.username)) newErrors.username = 'Username cannot contain spaces';

        if (cleanedData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedData.email)) newErrors.email = 'Invalid email address';

        if (!cleanedData.full_name) newErrors.full_name = 'Full Name is required';



        if (!editingUser && !cleanedData.password) newErrors.password = 'Password is required';

        if (cleanedData.phone_number && cleanedData.phone_number.length !== 10) {
            newErrors.phone_number = 'Phone number must be exactly 10 digits';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            const firstField = Object.keys(newErrors)[0];
            scrollToField(firstField);
            toast.error('Please fix the form errors');
            return;
        }

        // Check for duplicates in DB before saving

        // 1. Check against local state (Immediate feedback)
        const localDuplicate = users.find(u =>
            u.emp_id?.toLowerCase() === cleanedData.emp_id?.toLowerCase()
        );

        if (localDuplicate) {
            // If we are editing, allow if it's the same user
            if (!editingUser || localDuplicate.emp_id !== editingUser.emp_id) {
                setErrors(prev => ({ ...prev, emp_id: 'This EMP ID is already assigned to another user' }));
                scrollToField('emp_id');
                toast.error('Duplicate EMP ID found');
                return;
            }
        }
        try {
            // Run checks in parallel for better performance and safety avoiding complex OR strings
            const [empCheck, usernameCheck] = await Promise.all([
                supabase
                    .from('users')
                    .select('emp_id')
                    .ilike('emp_id', cleanedData.emp_id), // Case-insensitive check
                supabase
                    .from('users')
                    .select('emp_id, username') // Select emp_id to verify if it's the same user
                    .eq('username', cleanedData.username)
            ]);

            if (empCheck.error) throw empCheck.error;
            if (usernameCheck.error) throw usernameCheck.error;

            const conflictErrors = {};

            // Check EMP ID Conflict
            if (empCheck.data && empCheck.data.length > 0) {
                const existingUser = empCheck.data[0];
                // If we are editing, it's a conflict only if the found user is NOT the one we are editing
                // If creating (editingUser is null), any match is a conflict
                if (!editingUser || existingUser.emp_id !== editingUser.emp_id) {
                    conflictErrors.emp_id = 'This EMP ID is already assigned to another user';
                }
            }

            // Check Username Conflict
            if (usernameCheck.data && usernameCheck.data.length > 0) {
                const existingUser = usernameCheck.data[0];
                if (!editingUser || existingUser.emp_id !== editingUser.emp_id) {
                    conflictErrors.username = 'This Username is already taken';
                }
            }

            if (Object.keys(conflictErrors).length > 0) {
                setErrors(prev => ({ ...prev, ...conflictErrors }));
                const firstField = Object.keys(conflictErrors)[0];
                scrollToField(firstField);
                toast.error('Duplicate entry found');
                return;
            }


            const userData = { ...cleanedData };

            // Sanitize Date Fields: Convert empty strings to null
            if (!userData.date_of_birth) userData.date_of_birth = null;
            if (!userData.joining_date) userData.joining_date = null;

            // If editing and password is empty, remove it so it doesn't overwrite with empty string
            if (editingUser && !userData.password) {
                delete userData.password;
            }

            // ... (rest of saving logic)

            let result;
            if (editingUser) {
                // Update
                const { error } = await supabase
                    .from('users')
                    .update(userData)
                    .eq('emp_id', editingUser.emp_id);

                if (error) throw error;
                toast.success('User updated successfully');
            } else {
                // Create
                if (!userData.password) {
                    toast.error('Password is required for new users');
                    return;
                }
                const { error } = await supabase
                    .from('users')
                    .insert([userData]);

                if (error) throw error;

                // For new users, we need to handle team assignment after we confirm specific ID usage.
                // Since we manually input emp_id, we can use it immediately.
                if (userData.is_hod && selectedTeam.length > 0) {
                    await handleUpdateTeam(userData.emp_id);
                }

                toast.success('User created successfully');
            }

            if (editingUser && userData.is_hod) {
                await handleUpdateTeam(userData.emp_id);
            }

            handleCloseModal();
            fetchUsers();
            setSelectedTeam([]);
        } catch (error) {
            console.error('Error saving user:', error);

            if (error.message && error.message.includes('invalid input syntax for type date')) {
                setErrors(prev => ({
                    ...prev,
                    date_of_birth: 'Invalid date format',
                    joining_date: 'Invalid date format'
                }));
                toast.error('Please check the date fields');
            } else {
                toast.error(`Error: ${error.message}`);
            }
        }
    };

    // Helper to handle team updates
    const handleUpdateTeam = async (hodId) => {
        if (!hodId) return;

        try {
            // 1. Clear old team members not in new selection
            if (editingUser) {
                const currentMembers = users.filter(u => u.hod_id === hodId).map(u => u.emp_id);
                const toRemove = currentMembers.filter(id => !selectedTeam.includes(id));

                if (toRemove.length > 0) {
                    await supabase
                        .from('team_members')
                        .delete()
                        .in('emp_id', toRemove);
                }
            }

            // 2. Add new team members
            if (selectedTeam.length > 0) {
                const updates = selectedTeam.map(empId => ({
                    hod_id: hodId,
                    emp_id: empId
                }));

                // Upsert to handle re-assignments
                await supabase
                    .from('team_members')
                    .upsert(updates);
            }

        } catch (error) {
            console.error("Error updating team members:", error);
            toast.error("Failed to update team assignments");
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = (
            user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.emp_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.designation?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesDepartment = selectedDepartment === 'All' || user.department === selectedDepartment;
        return matchesSearch && matchesDepartment;
    });

    const uniqueDepartments = ['All', ...new Set(users.map(u => u.department).filter(Boolean).sort())];

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

    const handlePageChange = (pageNumber) => {
        if (pageNumber < 1 || pageNumber > totalPages) return;
        setCurrentPage(pageNumber);
    };

    // Reset to page 1 when search term changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // HOD Logic
    const managers = users.filter(u => u.is_hod);
    const filteredManagers = managers.filter(m =>
        m.full_name?.toLowerCase().includes(hodSearchTerm.toLowerCase()) ||
        m.department?.toLowerCase().includes(hodSearchTerm.toLowerCase())
    );

    const getEmployeesForHod = (hodId) => {
        return users.filter(u => u.hod_id === hodId);
    };

    const handleAssignEmployees = async () => {
        if (!selectedHod || selectedEmployees.length === 0) return;

        try {
            setLoading(true);

            const updates = selectedEmployees.map(empId => ({
                hod_id: selectedHod.emp_id,
                emp_id: empId
            }));

            const { error } = await supabase
                .from('team_members')
                .upsert(updates);

            if (error) throw error;

            toast.success(`Successfully assigned ${selectedEmployees.length} employees to ${selectedHod.full_name}`);
            setIsAssignModalOpen(false);
            setSelectedEmployees([]);
            fetchUsers(); // Refresh data
        } catch (error) {
            console.error('Error assigning employees:', error);
            toast.error('Failed to assign employees: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveEmployeeFromHod = async (empId) => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('emp_id', empId);

            if (error) throw error;
            toast.success('Employee removed from team');
            fetchUsers();
        } catch (error) {
            console.error('Error removing employee:', error);
            toast.error('Failed to remove employee');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenLeaveModal = () => {
        setLeaveFormData({
            employeeId: '',
            employeeName: '',
            designation: '',
            hodName: '',
            leaveType: '',
            fromDate: '',
            toDate: '',
            fromDate: '',
            toDate: '',
            reason: '',
            hodId: ''
        });
        setIsLeaveModalOpen(true);
    };

    const handleLeaveInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'employeeId') {
            const selectedEmployee = users.find(u => u.emp_id === value);
            if (selectedEmployee) {
                const hod = users.find(u => u.emp_id === selectedEmployee.hod_id);
                setLeaveFormData(prev => ({
                    ...prev,
                    employeeId: value,
                    employeeName: selectedEmployee.full_name,
                    designation: selectedEmployee.designation || '',
                    hodName: hod ? hod.full_name : 'Pawan Tiwari',
                    hodId: hod ? hod.emp_id : 1
                }));
            }
        } else {
            setLeaveFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleLeaveSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const insertData = {
                timestamp: new Date().toISOString(),
                emp_id: leaveFormData.employeeId,
                employee_name: leaveFormData.employeeName,
                leave_date_start: leaveFormData.fromDate,
                leave_date_end: leaveFormData.toDate,
                remarks: leaveFormData.reason,
                status: (leaveFormData.hodId === 1 || leaveFormData.hodName === 'Pawan Tiwari' || leaveFormData.hodName === 'HR') ? 'Pending HR' : 'Pending', // Start flow regardless of who adds it

                leave_type: leaveFormData.leaveType,
                hod_name: leaveFormData.hodName,
                hod_id: leaveFormData.hodId,
                designation: leaveFormData.designation
            };

            const { error } = await supabase
                .from('leave_management')
                .insert([insertData]);

            if (error) throw error;

            toast.success('Leave added successfully');
            setIsLeaveModalOpen(false);
        } catch (error) {
            console.error('Error adding leave:', error);
            toast.error('Failed to add leave');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleLeaveAccess = async (user) => {
        const newStatus = !user.is_leave_allowed;
        // Optimistic update
        setUsers(users.map(u => u.emp_id === user.emp_id ? { ...u, is_leave_allowed: newStatus } : u));

        try {
            const { error } = await supabase
                .from('users')
                .update({ is_leave_allowed: newStatus })
                .eq('emp_id', user.emp_id);

            if (error) throw error;
            toast.success(`Leave access ${newStatus ? 'enabled' : 'disabled'} for ${user.full_name}`);
        } catch (error) {
            console.error('Error toggling leave access:', error);
            toast.error('Failed to update leave access');
            // Revert on error
            setUsers(users.map(u => u.emp_id === user.emp_id ? { ...u, is_leave_allowed: !newStatus } : u));
        }
    };

    return (
        <div className="h-full flex flex-col gap-4 sm:gap-6 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 mb-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
                    <p className="text-slate-500 mt-1 text-sm">Manage system users, teams, and access permissions.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Minimal Stats in Header */}
                    {activeTab === 'users' && !loading && (
                        <div className="flex items-center gap-4 sm:gap-6 hidden xl:flex">
                            <div className="text-right">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Users</p>
                                <p className="text-xl font-bold text-slate-900 leading-none">{users.length}</p>
                            </div>
                            <div className="w-px h-8 bg-slate-200"></div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">HOD's</p>
                                <p className="text-xl font-bold text-slate-900 leading-none">{users.filter(u => u.is_hod).length}</p>
                            </div>
                            <div className="w-px h-8 bg-slate-200"></div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Admins</p>
                                <p className="text-xl font-bold text-slate-900 leading-none">{users.filter(u => u.role === 'admin' || u.role === 'Admin').length}</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="flex gap-2 w-full sm:w-auto">
                            {(currentUser?.role === 'admin' || currentUser?.role === 'Admin') && (
                                <button
                                    onClick={handleOpenLeaveModal}
                                    className="flex-1 sm:flex-none items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium flex"
                                >
                                    <Calendar size={20} />
                                    <span className="hidden sm:inline">Add Leave</span>
                                    <span className="sm:hidden">Leave</span>
                                </button>
                            )}
                            <button
                                onClick={() => handleOpenModal()}
                                className="flex-1 sm:flex-none items-center justify-center gap-2 bg-[#991B1B] text-white px-4 py-2 rounded-lg hover:bg-red-800 transition-colors shadow-sm font-medium flex"
                            >
                                <Plus size={20} />
                                <span className="hidden sm:inline">Add User</span>
                                <span className="sm:hidden">User</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="bg-slate-100/70 p-1 rounded-xl flex gap-1 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`${activeTab === 'users'
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            } px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap`}
                    >
                        <Users size={16} />
                        User Management
                    </button>
                    <button
                        onClick={() => setActiveTab('hod')}
                        className={`${activeTab === 'hod'
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            } px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap`}
                    >
                        <Briefcase size={16} />
                        HOD & Teams
                    </button>
                </div>

                {activeTab === 'users' && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#991B1B] focus:ring-2 focus:ring-[#991B1B]/10 outline-none transition-all bg-white hover:bg-slate-50 focus:bg-white"
                            />
                        </div>
                        <div className="relative w-full sm:w-48">
                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#991B1B] focus:ring-2 focus:ring-[#991B1B]/10 outline-none transition-all bg-white hover:bg-slate-50 focus:bg-white appearance-none cursor-pointer"
                            >
                                {uniqueDepartments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                )}
            </div>


            {/* Content Based on Tab */}
            {activeTab === 'users' ? (
                <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
                    {/* Stats Cards */}




                    {/* Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-md">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User Details</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role & Designation</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reporting To</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Leave Access</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                                Loading users...
                                            </td>
                                        </tr>
                                    ) : currentItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                                No users found matching your search.
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {currentItems.map((user) => (
                                                <tr key={user.emp_id} className="group hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-semibold border border-slate-200 overflow-hidden">
                                                                {user.profile_picture ? (
                                                                    <img
                                                                        src={user.profile_picture}
                                                                        alt={user.full_name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    user.full_name?.charAt(0).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-slate-800">{user.full_name}</p>
                                                                <p className="text-sm text-slate-500">{user.email}</p>
                                                                <p className="text-xs text-slate-400 font-mono mt-0.5">{user.emp_id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className={`inline-flex self-start items-center px-2 py-0.5 rounded text-xs font-medium ${user.role === 'admin' || user.role === 'Admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                                                                }`}>
                                                                {user.role || 'N/A'}
                                                            </span>
                                                            <span className="text-sm text-slate-600 mt-1">{user.designation || '-'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600">
                                                        {user.department || '-'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {user.hod_ids && user.hod_ids.length > 0 ? (
                                                            <div className="flex flex-col gap-2">
                                                                {user.hod_ids.map((hodId, index) => {
                                                                    const hodUser = users.find(u => u.emp_id === hodId);
                                                                    return (
                                                                        <div key={`${user.emp_id}-hod-${hodId}-${index}`} className="flex items-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 font-bold overflow-hidden border border-slate-200">
                                                                                {hodUser?.profile_picture ? (
                                                                                    <img src={hodUser.profile_picture} className="w-full h-full object-cover" alt="" />
                                                                                ) : (
                                                                                    hodUser?.full_name?.charAt(0) || '?'
                                                                                )}
                                                                            </div>
                                                                            <span className="text-sm text-slate-700 font-medium">
                                                                                {hodUser?.full_name || 'Unknown HOD'}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">Not Assigned</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={user.is_leave_allowed !== false} // Default true
                                                                onChange={() => handleToggleLeaveAccess(user)}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                        </label>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                            {user.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleOpenModal(user)}
                                                                className="p-2 rounded-lg text-slate-400 hover:text-[#991B1B] hover:bg-red-50 transition-colors"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {Array.from({ length: Math.max(0, itemsPerPage - currentItems.length) }).map((_, index) => (
                                                <tr key={`empty-${index}`} className="border-b border-transparent">
                                                    <td colSpan="7" className="px-6 py-4 pointer-events-none">
                                                        <div className="h-10"></div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    {!loading && filteredUsers.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-4 bg-white border-t border-slate-100 sm:px-6 rounded-b-2xl border-x border-b border-slate-200/60 -mt-px mb-6 shadow-sm">
                            <div className="flex items-center justify-between w-full">
                                <div className="text-sm text-slate-500">
                                    Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to <span className="font-medium">{Math.min(indexOfLastItem, filteredUsers.length)}</span> of <span className="font-medium">{filteredUsers.length}</span> results
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                                                ? 'bg-[#991B1B] text-white'
                                                : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-21rem)] min-h-0 overflow-hidden">
                    {/* Left List: Managers */}
                    <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-full">
                        <div className="p-4 border-b border-slate-100">
                            <h3 className="font-bold text-lg text-slate-900 mb-4">Departments</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search managers..."
                                    value={hodSearchTerm}
                                    onChange={(e) => setHodSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#991B1B] focus:ring-2 focus:ring-[#991B1B]/10 outline-none transition-all bg-white hover:bg-slate-50 focus:bg-white"
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                            {filteredManagers.length === 0 ? (
                                <p className="text-center text-slate-500 py-8 text-sm">No managers found.</p>
                            ) : (
                                filteredManagers.map(manager => (
                                    <button
                                        key={manager.emp_id}
                                        onClick={() => setSelectedHod(manager)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all mb-2 ${selectedHod?.emp_id === manager.emp_id
                                            ? 'bg-white border-[#991B1B]/30 shadow-md ring-1 ring-[#991B1B]/10'
                                            : 'bg-white border-transparent hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                {manager.profile_picture ? (
                                                    <img src={manager.profile_picture} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm font-bold text-slate-500">{manager.full_name?.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`font-semibold text-sm truncate ${selectedHod?.emp_id === manager.emp_id ? 'text-[#991B1B]' : 'text-slate-800'}`}>
                                                    {manager.full_name}
                                                </p>
                                                <p className="text-xs text-slate-500 truncate">{manager.department || 'No Dept'}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{getEmployeesForHod(manager.emp_id).length} Employees</p>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Details and Team */}
                    <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-full">
                        {selectedHod ? (
                            <>
                                {/* HOD Header */}
                                <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                                    <div className="flex gap-4">
                                        <div className="w-16 h-16 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                                            {selectedHod.profile_picture ? (
                                                <img src={selectedHod.profile_picture} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <User size={32} className="text-slate-300" />
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">{selectedHod.full_name}</h2>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                                                <span className="flex items-center gap-1"><Briefcase size={14} /> {selectedHod.designation}</span>
                                                <span className="flex items-center gap-1"><MapPin size={14} /> {selectedHod.department}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-medium border border-purple-200 uppercase tracking-wide">{selectedHod.role}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsAssignModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#991B1B] text-white rounded-lg hover:bg-red-800 transition-colors shadow-sm text-sm font-medium"
                                    >
                                        <Plus size={16} />
                                        Assign Employees
                                    </button>
                                </div>

                                {/* Team List */}
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        Team Members
                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{getEmployeesForHod(selectedHod.emp_id).length}</span>
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {getEmployeesForHod(selectedHod.emp_id).length > 0 ? (
                                            getEmployeesForHod(selectedHod.emp_id).map(emp => (
                                                <div key={emp.emp_id} className="group relative p-4 rounded-2xl border border-slate-200/60 hover:border-red-200 hover:bg-red-50/30 transition-all bg-white shadow-sm flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-sm border border-slate-100">
                                                        {emp.profile_picture ? (
                                                            <img src={emp.profile_picture} className="w-full h-full rounded-full object-cover" />
                                                        ) : emp.full_name?.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-slate-800 text-sm truncate">{emp.full_name}</p>
                                                        <p className="text-xs text-slate-500 truncate">{emp.designation || 'No Designation'}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveEmployeeFromHod(emp.emp_id)}
                                                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-600 transition-all"
                                                        title="Remove from team"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-2 py-12 text-center border-2 border-dashed border-slate-100 rounded-xl">
                                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                                                    <Users size={24} />
                                                </div>
                                                <p className="text-slate-500 text-sm font-medium">No team members assigned yet.</p>
                                                <p className="text-slate-400 text-xs mt-1">Click "Assign Employees" to build the team.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <Users size={48} className="mb-4 text-slate-200" />
                                <p className="text-lg font-medium text-slate-500">Select a Department Head</p>
                                <p className="text-sm">Manage their team and assignments</p>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {/* Assign Employees Modal */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6 transition-all duration-300">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAssignModalOpen(false)}></div>
                    <div className="relative bg-white sm:rounded-2xl shadow-xl w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Assign Employees</h3>
                                <p className="text-sm text-slate-500">Add members to {selectedHod?.full_name}'s team</p>
                            </div>
                            <button onClick={() => setIsAssignModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search employees..."
                                    value={assignSearchTerm}
                                    onChange={(e) => setAssignSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 sm:p-4 custom-scrollbar">
                            {users
                                .filter(u =>
                                    (u.role !== 'manager' && u.role !== 'Manager' && u.role !== 'admin' && u.role !== 'Admin' && u.hod_id !== selectedHod.emp_id) &&
                                    (u.full_name?.toLowerCase().includes(assignSearchTerm.toLowerCase()) ||
                                        u.emp_id?.toLowerCase().includes(assignSearchTerm.toLowerCase()) ||
                                        u.department?.toLowerCase().includes(assignSearchTerm.toLowerCase()))
                                )
                                .map(user => (
                                    <label key={user.emp_id} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedEmployees.includes(user.emp_id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedEmployees(prev => [...prev, user.emp_id]);
                                                else setSelectedEmployees(prev => prev.filter(id => id !== user.emp_id));
                                            }}
                                            className="w-5 h-5 rounded border-slate-300 text-[#991B1B] focus:ring-[#991B1B]"
                                        />
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-800">{user.full_name}</p>
                                            <p className="text-xs text-slate-500">{user.designation} • {user.department}</p>
                                            {user.hod_id && (
                                                <p className="text-[10px] text-orange-500 mt-0.5">Currently assigned to another HOD</p>
                                            )}
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden">
                                            {user.profile_picture ? <img src={user.profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">{user.full_name?.charAt(0)}</div>}
                                        </div>
                                    </label>
                                ))}
                        </div>
                        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 sticky bottom-0">
                            <button onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-white rounded-lg transition-colors text-sm">Cancel</button>
                            <button
                                onClick={handleAssignEmployees}
                                disabled={selectedEmployees.length === 0}
                                className="px-6 py-2 bg-[#991B1B] text-white rounded-lg font-medium hover:bg-red-800 disabled:opacity-50 transition-colors text-sm"
                            >
                                Assign ({selectedEmployees.length})
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Modal Slide-over or Center Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6 transition-all duration-300">
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleCloseModal}></div>
                        <div className="relative bg-white sm:rounded-2xl shadow-xl w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">


                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
                                <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                                    {editingUser ? 'Edit User' : 'Add New User'}
                                </h2>
                                <button
                                    onClick={handleCloseModal}
                                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                    {/* Profile Picture Section */}
                                    <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center mb-4">
                                        <div className="relative group">
                                            <div className="w-24 h-24 rounded-full border-4 border-slate-100 overflow-hidden bg-slate-100 flex items-center justify-center shadow-sm">
                                                {formData.profile_picture ? (
                                                    <img
                                                        src={formData.profile_picture}
                                                        alt="Profile"
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <User size={40} className="text-slate-400" />
                                                )}
                                            </div>
                                            <label className="absolute bottom-0 right-0 bg-[#991B1B] text-white p-2 rounded-full cursor-pointer hover:bg-red-800 transition-colors shadow-md transform translate-x-1/4 translate-y-1/4">
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
                                        <p className="text-xs text-slate-400 mt-2">Allowed *.jpeg, *.jpg, *.png, *.gif</p>
                                    </div>

                                    {/* Account Info Section */}
                                    <div className="col-span-1 md:col-span-2">
                                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b pb-2">Account Information</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">EMP ID <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Shield className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="emp_id"
                                                    value={formData.emp_id}
                                                    onChange={handleInputChange}
                                                    required
                                                    disabled={!!editingUser && !(currentUser?.role === 'admin' || currentUser?.role === 'Admin')}
                                                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${errors.emp_id ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ((editingUser && !(currentUser?.role === 'admin' || currentUser?.role === 'Admin')) ? 'bg-slate-50 text-slate-500 border-slate-200' : 'border-slate-300 focus:border-[#991B1B] focus:ring-[#991B1B]')} focus:ring-1 outline-none`}
                                                    placeholder="Eg: 120"
                                                />
                                            </div>
                                            {errors.emp_id && <p className="text-xs text-red-500 mt-1 ml-1">{errors.emp_id}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Username <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <User className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="username"
                                                    value={formData.username}
                                                    onChange={handleInputChange}
                                                    required
                                                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${errors.username ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-[#991B1B] focus:ring-[#991B1B]'} focus:ring-1 outline-none`}
                                                    placeholder="jdoe"
                                                />
                                            </div>
                                            {errors.username && <p className="text-xs text-red-500 mt-1 ml-1">{errors.username}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Mail className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-[#991B1B] focus:ring-[#991B1B]'} focus:ring-1 outline-none`}
                                                    placeholder="john@example.com"
                                                />
                                            </div>
                                            {errors.email && <p className="text-xs text-red-500 mt-1 ml-1">{errors.email}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Password {editingUser && <span className="text-xs text-slate-400 font-normal">(Leave blank to keep unchanged)</span>}
                                                {!editingUser && <span className="text-red-500">*</span>}
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Shield className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={handleInputChange}
                                                    required={!editingUser}
                                                    className={`w-full pl-10 pr-10 py-2 rounded-lg border ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-[#991B1B] focus:ring-[#991B1B]'} focus:ring-1 outline-none`}
                                                    placeholder="••••••••"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                                                >
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                            {errors.password && <p className="text-xs text-red-500 mt-1 ml-1">{errors.password}</p>}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Shield className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <select
                                                    name="role"
                                                    value={formData.role}
                                                    onChange={handleInputChange}
                                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B] outline-none appearance-none bg-white"
                                                >
                                                    <option value="employee">Employee</option>
                                                    <option value="HR">HR</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="manager">Manager</option>

                                                    <option value="GM">GM</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Briefcase className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <select
                                                    name="department"
                                                    value={formData.department}
                                                    onChange={handleInputChange}
                                                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${errors.department ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-[#991B1B] focus:ring-[#991B1B]'} focus:ring-1 outline-none appearance-none bg-white`}
                                                >
                                                    <option value="">Select Department</option>
                                                    <option value="Hr">Hr</option>
                                                    <option value="Admin">Admin</option>
                                                    <option value="Sms">Sms</option>
                                                    <option value="Rolling mill">Rolling mill</option>
                                                    <option value="Sms Lab">Sms Lab</option>
                                                    <option value="Dispatch">Dispatch</option>
                                                    <option value="R/M Purchase">R/M Purchase</option>
                                                    <option value="Store Purchase">Store Purchase</option>
                                                    <option value="Store">Store</option>
                                                    <option value="WB (Weightment Bridge)">WB (Weightment Bridge)</option>
                                                    <option value="HouseKeeping">HouseKeeping</option>
                                                    <option value="Health & Safety">Health & Safety</option>
                                                    <option value="Accounts">Accounts</option>
                                                    <option value="Sales">Sales</option>
                                                    <option value="AUTOMOBILE">Automobile</option>
                                                </select>
                                            </div>
                                            {errors.department && <p className="text-xs text-red-500 mt-1 ml-1">{errors.department}</p>}
                                        </div>

                                        <div className="flex items-center gap-2 pt-8">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    name="is_active"
                                                    checked={formData.is_active}
                                                    onChange={handleInputChange}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                                <span className="ml-3 text-sm font-medium text-slate-700">Account Active</span>
                                            </label>
                                        </div>

                                        <div className="flex items-center gap-2 pt-4">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    name="is_hod"
                                                    checked={formData.is_hod}
                                                    onChange={handleInputChange}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#991B1B]"></div>
                                                <span className="ml-3 text-sm font-medium text-slate-700">Department Head (HOD)</span>
                                            </label>
                                        </div>
                                    </div>

                                    {formData.is_hod && (
                                        <div className="col-span-1 md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                                            <h3 className="text-sm font-bold text-slate-800 mb-3">Assign Team Members</h3>
                                            <div className="relative mb-3">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Search employees to assign..."
                                                    value={teamSearchTerm}
                                                    onChange={(e) => setTeamSearchTerm(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B] outline-none"
                                                />
                                            </div>
                                            <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                                {users
                                                    .filter(u => u.emp_id !== formData.emp_id && u.role !== 'admin' && u.role !== 'manager' && !u.is_hod) // Filter out self and other HODs generally
                                                    .filter(u => u.full_name?.toLowerCase().includes(teamSearchTerm.toLowerCase()))
                                                    .map(user => (
                                                        <label key={user.emp_id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border ${selectedTeam.includes(user.emp_id) ? 'bg-white border-[#991B1B] ring-1 ring-[#991B1B]/10' : 'border-transparent hover:bg-white'}`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedTeam.includes(user.emp_id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedTeam(prev => [...prev, user.emp_id]);
                                                                    else setSelectedTeam(prev => prev.filter(id => id !== user.emp_id));
                                                                }}
                                                                className="w-4 h-4 rounded border-slate-300 text-[#991B1B] focus:ring-[#991B1B]"
                                                            />
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                {user.profile_picture ? <img src={user.profile_picture} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-slate-500">{user.full_name?.charAt(0)}</span>}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-slate-800 text-sm truncate">{user.full_name}</p>
                                                                <p className="text-xs text-slate-500 truncate">{user.designation} {user.hod_id && user.hod_id !== formData.emp_id && <span className="text-orange-500 ml-1">(Already assigned)</span>}</p>
                                                            </div>
                                                        </label>
                                                    ))}
                                                {users.filter(u => u.emp_id !== formData.emp_id && u.role !== 'admin' && u.role !== 'manager' && !u.is_hod).length === 0 && (
                                                    <p className="text-center text-slate-400 py-4 text-sm">No eligible employees found.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Page Access Section - Hidden for Admins */}
                                    {formData.role !== 'admin' && formData.role !== 'Admin' && (
                                        <div className="col-span-1 md:col-span-2 mt-4">
                                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b pb-2 flex justify-between items-center">
                                                Page Access Permissions
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={handleSelectAllPages} className="text-xs text-[#991B1B] hover:underline font-medium">Select All</button>
                                                    <span className="text-slate-300">|</span>
                                                    <button type="button" onClick={handleDeselectAllPages} className="text-xs text-slate-500 hover:underline">None</button>
                                                </div>
                                            </h3>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                {ALL_PAGES.map(page => (
                                                    <label key={page.id} className="flex items-center gap-2 cursor-pointer group">
                                                        <div className="relative flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.page_access?.includes(page.id)}
                                                                onChange={() => handlePageAccessToggle(page.id)}
                                                                className="peer h-4 w-4 rounded border-slate-300 text-[#991B1B] focus:ring-[#991B1B]"
                                                            />
                                                        </div>
                                                        <span className={`text-sm ${formData.page_access?.includes(page.id) ? 'text-slate-800 font-medium' : 'text-slate-500'} group-hover:text-[#991B1B] transition-colors`}>
                                                            {page.label}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Personal Info Section */}
                                    <div className="col-span-1 md:col-span-2 mt-2">
                                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b pb-2">Personal Information</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <User className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="full_name"
                                                    value={formData.full_name}
                                                    onChange={handleInputChange}
                                                    required
                                                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${errors.full_name ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-[#991B1B] focus:ring-[#991B1B]'} focus:ring-1 outline-none`}
                                                    placeholder="John Doe"
                                                />
                                            </div>
                                            {errors.full_name && <p className="text-xs text-red-500 mt-1 ml-1">{errors.full_name}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Calendar className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="date"
                                                    name="date_of_birth"
                                                    value={formData.date_of_birth}
                                                    onChange={handleInputChange}
                                                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${errors.date_of_birth ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-[#991B1B] focus:ring-[#991B1B]'} focus:ring-1 outline-none`}
                                                />
                                            </div>
                                            {errors.date_of_birth && <p className="text-xs text-red-500 mt-1 ml-1">{errors.date_of_birth}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                                            <select
                                                name="gender"
                                                value={formData.gender}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B] outline-none bg-white"
                                            >
                                                <option value="">Select Gender</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>


                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Briefcase className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="designation"
                                                    value={formData.designation}
                                                    onChange={handleInputChange}
                                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B] outline-none"
                                                    placeholder="Software Engineer"
                                                />
                                            </div>
                                        </div>



                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Joining Date</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Calendar className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="date"
                                                    name="joining_date"
                                                    value={formData.joining_date}
                                                    onChange={handleInputChange}
                                                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${errors.joining_date ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-[#991B1B] focus:ring-[#991B1B]'} focus:ring-1 outline-none`}
                                                />
                                            </div>
                                            {errors.joining_date && <p className="text-xs text-red-500 mt-1 ml-1">{errors.joining_date}</p>}
                                        </div>
                                    </div>

                                    {/* Contact Info Section */}
                                    <div className="col-span-1 md:col-span-2 mt-2">
                                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b pb-2">Contact Information</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-slate-500 font-medium border-r pr-2 border-slate-300">+91</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    name="phone_number"
                                                    value={formData.phone_number}
                                                    onChange={handleInputChange}
                                                    className={`w-full pl-14 pr-4 py-2 rounded-lg border ${errors.phone_number ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-[#991B1B] focus:ring-[#991B1B]'} focus:ring-1 outline-none`}
                                                    placeholder="9876543210"
                                                />
                                            </div>
                                            {errors.phone_number && <p className="text-xs text-red-500 mt-1 ml-1">{errors.phone_number}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Emergency Contact</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Phone className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="emergency_contact"
                                                    value={formData.emergency_contact}
                                                    onChange={handleInputChange}
                                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B] outline-none"
                                                    placeholder="Name - Number"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 pt-2.5 pointer-events-none">
                                                    <MapPin className="h-4 w-4 text-slate-400" />
                                                </div>
                                                <textarea
                                                    name="current_address"
                                                    value={formData.current_address}
                                                    onChange={handleInputChange}
                                                    rows="3"
                                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:border-[#991B1B] focus:ring-1 focus:ring-[#991B1B] outline-none resize-none"
                                                    placeholder="Current Residential Address"
                                                ></textarea>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Leave Information Section - Only show when editing */}
                                    {editingUser && (
                                        <>
                                            <div className="col-span-1 md:col-span-2 mt-4">
                                                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-slate-500" />
                                                    Leave Information ({new Date().getFullYear()})
                                                </h3>
                                            </div>

                                            {loadingQuota ? (
                                                <div className="col-span-1 md:col-span-2 flex items-center justify-center py-8">
                                                    <div className="w-6 h-6 border-2 border-slate-200 border-t-[#991B1B] rounded-full animate-spin"></div>
                                                    <span className="ml-2 text-sm text-slate-500">Loading leave data...</span>
                                                </div>
                                            ) : (
                                                <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    {/* Casual Leave Card */}
                                                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-4 border border-indigo-100 relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 opacity-5">
                                                            <Calendar size={80} className="transform rotate-12 translate-x-4 -translate-y-2" />
                                                        </div>
                                                        <div className="relative z-10">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Casual Leave</span>
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-200/50 text-indigo-700">CL</span>
                                                            </div>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-2xl font-bold text-slate-900">
                                                                    {leaveQuota.casual_leave_remaining}
                                                                </span>
                                                                <span className="text-sm text-slate-500">/ 12</span>
                                                            </div>
                                                            <div className="mt-2">
                                                                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                                                    <span>Used: {12 - leaveQuota.casual_leave_remaining}</span>
                                                                    <span>Remaining</span>
                                                                </div>
                                                                <div className="w-full bg-white/50 rounded-full h-1.5 overflow-hidden">
                                                                    <div
                                                                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                                                        style={{ width: `${(leaveQuota.casual_leave_remaining / 12) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Earned Leave Card */}
                                                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-4 border border-emerald-100 relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 opacity-5">
                                                            <Briefcase size={80} className="transform rotate-12 translate-x-4 -translate-y-2" />
                                                        </div>
                                                        <div className="relative z-10">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Earned Leave</span>
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-200/50 text-emerald-700">EL</span>
                                                            </div>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-2xl font-bold text-slate-900">
                                                                    {leaveQuota.earned_leave_remaining}
                                                                </span>
                                                                <span className="text-sm text-slate-500">/ 24</span>
                                                            </div>
                                                            <div className="mt-2">
                                                                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                                                    <span>Used: {24 - leaveQuota.earned_leave_remaining}</span>
                                                                    <span>Remaining</span>
                                                                </div>
                                                                <div className="w-full bg-white/50 rounded-full h-1.5 overflow-hidden">
                                                                    <div
                                                                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                                                        style={{ width: `${(leaveQuota.earned_leave_remaining / 24) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Unpaid Leave Card */}
                                                    <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-xl p-4 border border-rose-100 relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 opacity-5">
                                                            <AlertCircle size={80} className="transform rotate-12 translate-x-4 -translate-y-2" />
                                                        </div>
                                                        <div className="relative z-10">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Unpaid Leave</span>
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-200/50 text-rose-700">LOP</span>
                                                            </div>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-2xl font-bold text-slate-900">
                                                                    {leaveQuota.unpaid_leave_total_taken}
                                                                </span>
                                                                <span className="text-sm text-slate-500">Taken</span>
                                                            </div>
                                                            <div className="mt-2">
                                                                <p className="text-[10px] text-slate-500">Recorded as Loss of Pay</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                </form>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end p-4 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 sticky bottom-0 gap-3 sm:gap-0">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-medium sm:mr-3 border border-slate-200 sm:border-transparent rounded-lg hover:bg-white sm:hover:bg-transparent text-center"
                                >
                                    Cancel
                                </button>

                                <button
                                    onClick={handleSubmit}
                                    className="px-6 py-2.5 bg-[#991B1B] text-white rounded-lg hover:bg-red-800 transition-colors shadow-sm font-medium text-center"
                                >
                                    {editingUser ? 'Save Changes' : 'Create User'}
                                </button>
                            </div>

                        </div>
                    </div >
                )
            }

            {/* Leave Request Modal */}
            {isLeaveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsLeaveModalOpen(false)}></div>
                    <div className="relative bg-white sm:rounded-2xl shadow-xl w-full sm:max-w-lg h-full sm:h-auto overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Add Leave Request</h2>
                            <button onClick={() => setIsLeaveModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
                            <form onSubmit={handleLeaveSubmit} className="space-y-5">
                                {/* Employee Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee Name (कर्मचारी का नाम) <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        {/* Trigger / Display */}
                                        <div
                                            onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                                            className={`w-full px-4 py-2.5 rounded-xl border bg-white shadow-sm cursor-pointer flex items-center justify-between transition-all ${isEmployeeDropdownOpen ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300'}`}
                                        >
                                            <span className={`text-sm flex items-center gap-2 ${leaveFormData.employeeId ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                                {leaveFormData.employeeId ? (
                                                    <>
                                                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                                            {users.find(u => u.emp_id === leaveFormData.employeeId)?.profile_picture ? (
                                                                <img src={users.find(u => u.emp_id === leaveFormData.employeeId)?.profile_picture} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-slate-500">{users.find(u => u.emp_id === leaveFormData.employeeId)?.full_name?.charAt(0)}</span>
                                                            )}
                                                        </div>
                                                        {users.find(u => u.emp_id === leaveFormData.employeeId)?.full_name || 'Selected Employee'}
                                                    </>
                                                ) : 'Search and select employee...'}
                                            </span>
                                            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isEmployeeDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                                        </div>

                                        {/* Overlay to close when clicking outside */}
                                        {isEmployeeDropdownOpen && (
                                            <div className="fixed inset-0 z-10" onClick={() => setIsEmployeeDropdownOpen(false)}></div>
                                        )}

                                        {/* Dropdown Panel */}
                                        {isEmployeeDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                {/* Search Input */}
                                                <div className="p-3 border-b border-slate-50 bg-slate-50/50">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                        <input
                                                            type="text"
                                                            placeholder="Type name or ID to search..."
                                                            value={employeeSearchTerm}
                                                            onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-400"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>

                                                {/* List */}
                                                <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                                                    {users.filter(u =>
                                                        u.is_active &&
                                                        (u.full_name?.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
                                                            u.emp_id?.toLowerCase().includes(employeeSearchTerm.toLowerCase()))
                                                    ).length > 0 ? (
                                                        users.filter(u =>
                                                            u.is_active &&
                                                            (u.full_name?.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
                                                                u.emp_id?.toLowerCase().includes(employeeSearchTerm.toLowerCase()))
                                                        ).map(u => (
                                                            <div
                                                                key={u.emp_id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleLeaveInputChange({ target: { name: 'employeeId', value: u.emp_id } });
                                                                    setIsEmployeeDropdownOpen(false);
                                                                    setEmployeeSearchTerm('');
                                                                }}
                                                                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${leaveFormData.employeeId === u.emp_id
                                                                    ? 'bg-indigo-50 border border-indigo-100 shadow-sm'
                                                                    : 'hover:bg-slate-50 border border-transparent'
                                                                    }`}
                                                            >
                                                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 overflow-hidden shrink-0 border border-slate-200">
                                                                    {u.profile_picture ? (
                                                                        <img src={u.profile_picture} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        u.full_name?.charAt(0)
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between items-center mb-0.5">
                                                                        <p className={`text-sm font-semibold truncate ${leaveFormData.employeeId === u.emp_id ? 'text-indigo-900' : 'text-slate-800'}`}>
                                                                            {u.full_name}
                                                                        </p>
                                                                        {leaveFormData.employeeId === u.emp_id && <Check size={14} className="text-indigo-600 shrink-0" />}
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                                                                        <span className="font-mono bg-slate-100 px-1 rounded flex items-center">{u.emp_id}</span>
                                                                        <span>•</span>
                                                                        <span>{u.designation || 'No Role'}</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="py-8 text-center flex flex-col items-center justify-center text-slate-400">
                                                            <User size={24} className="mb-2 opacity-50" />
                                                            <p className="text-sm font-medium">No employees found</p>
                                                            <p className="text-xs mt-1">Try searching for a different name</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Read-only Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation (पद का नाम)</label>
                                        <input
                                            type="text"
                                            value={leaveFormData.designation}
                                            readOnly
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 outline-none cursor-not-allowed text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            {(leaveFormData.hodName === 'Pawan Tiwari' || leaveFormData.hodName === 'HR') ? 'HR Name (एचआर का नाम)' : 'HOD Name (एचओडी का नाम)'}
                                        </label>
                                        <input
                                            type="text"
                                            value={leaveFormData.hodName}
                                            readOnly
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 outline-none cursor-not-allowed text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Leave Type */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5"> Leave Type (छुट्टी के प्रकार)<span className="text-red-500">*</span></label>
                                    <select
                                        name="leaveType"
                                        value={leaveFormData.leaveType}
                                        onChange={handleLeaveInputChange}
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white shadow-sm transition-all text-sm"
                                    >
                                        <option value="">Select Type</option>
                                        <option value="Casual Leave">Casual Leave</option>
                                        <option value="Earned Leave">Earned Leave</option>
                                        <option value="Unpaid Leave">Unpaid Leave</option>
                                    </select>
                                </div>

                                {/* Dates & Duration */}
                                <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-medium text-slate-700">From Date <span className="text-red-500">*</span></label>
                                            <input
                                                type="date"
                                                name="fromDate"
                                                value={leaveFormData.fromDate}
                                                onChange={(e) => {
                                                    const newFrom = e.target.value;
                                                    if (leaveFormData.toDate && new Date(newFrom) > new Date(leaveFormData.toDate)) {
                                                        toast.error("Start date cannot be after end date");
                                                        setLeaveFormData(prev => ({ ...prev, fromDate: newFrom, toDate: '' }));
                                                    } else {
                                                        setLeaveFormData(prev => ({ ...prev, fromDate: newFrom }));
                                                    }
                                                }}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white shadow-sm transition-all text-sm"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-medium text-slate-700">To Date <span className="text-red-500">*</span></label>
                                            <input
                                                type="date"
                                                name="toDate"
                                                value={leaveFormData.toDate}
                                                min={leaveFormData.fromDate || new Date().toISOString().split('T')[0]}
                                                onChange={(e) => {
                                                    const newTo = e.target.value;
                                                    if (leaveFormData.fromDate && new Date(newTo) < new Date(leaveFormData.fromDate)) {
                                                        toast.error("End date cannot be earlier than start date");
                                                    } else {
                                                        setLeaveFormData(prev => ({ ...prev, toDate: newTo }));
                                                    }
                                                }}
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white shadow-sm transition-all text-sm"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Duration Display */}
                                    <div className="bg-indigo-50/50 rounded-lg p-3 flex items-center justify-between border border-indigo-100">
                                        <span className="text-sm font-medium text-indigo-900">Total Duration</span>
                                        <span className="text-sm font-bold text-indigo-700 bg-white px-3 py-1 rounded-md shadow-sm border border-indigo-100">
                                            {leaveFormData.fromDate && leaveFormData.toDate ?
                                                (() => {
                                                    const start = new Date(leaveFormData.fromDate);
                                                    const end = new Date(leaveFormData.toDate);
                                                    const diffTime = Math.abs(end - start);
                                                    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                                    return `${days} Days`;
                                                })()
                                                : '0 Days'}
                                        </span>
                                    </div>
                                </div>

                                {/* Reason */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason (कारण) <span className="text-red-500">*</span></label>
                                    <textarea
                                        name="reason"
                                        value={leaveFormData.reason}
                                        onChange={handleLeaveInputChange}
                                        required
                                        rows="3"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none bg-white shadow-sm transition-all text-sm"
                                        placeholder="Please provide a reason for the leave..."
                                    ></textarea>
                                </div>

                                <div className="flex justify-end pt-4 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsLeaveModalOpen(false)}
                                        className="px-5 py-2.5 text-slate-600 hover:text-slate-800 font-medium hover:bg-slate-50 rounded-xl transition-colors text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md font-medium text-sm"
                                    >
                                        Submit Request
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Settings;

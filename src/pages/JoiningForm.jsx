import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Upload,
  User,
  Briefcase,
  Phone,
  CreditCard,
  FileText,
  CheckCircle,
  ChevronDown,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import loginImage from '../assets/logo.jpg';

const DEPARTMENTS = [
  "Hr",
  "Admin",
  "Sms",
  "Rolling mill",
  "Sms Lab",
  "Dispatch",
  "R/M Purchase",
  "Store Purchase",
  "Store",
  "WB (Weightment Bridge)",
  "HouseKeeping",
  "Health & Safety",
  "Accounts",
  "Sales",
  "Automobile"
];

const JoiningForm = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [empIdError, setEmpIdError] = useState('');
  const [checkingEmpId, setCheckingEmpId] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Check if already submitted
  useEffect(() => {
    const hasSubmitted = localStorage.getItem('hasSubmittedJoiningForm');
    const empId = localStorage.getItem('submittedEmpId');
    const username = localStorage.getItem('submittedUsername');
    const password = localStorage.getItem('submittedPassword');

    if (hasSubmitted) {
      setIsSubmitted(true);
      if (empId) {
        setSubmittedData({ empId, username, password });
      }
    }
  }, []);

  // Form State matching 'joining_form' table structure (snake_case for DB, but camelCase for state if preferred, keeping mostly flat)
  // We will map state to snake_case payload on submit.
  const [formData, setFormData] = useState({
    joiningId: '',
    nameAsPerAadhar: '',
    fatherName: '',
    dateOfBirth: '',
    gender: '',
    department: '',
    mobileNo: '+91',
    personalEmail: '',
    familyMobileNo: '+91',
    relationshipWithFamily: '',
    currentAddress: '',
    dateOfJoining: '',
    designation: '',
    highestQualification: '',
    aadharCardNo: '',
    bankAccountNo: '',
    ifscCode: '',
    branchName: '',
    bankName: '',
    empId: '',
    username: '',
    password: '',

    // File objects
    passportPhoto: null,
    aadharCardPhoto: null,
    bankPassbookPhoto: null,
  });

  // Check if empId already exists in users table
  useEffect(() => {
    const checkEmpId = async () => {
      if (!formData.empId || currentStep !== 1) {
        setEmpIdError('');
        return;
      }
      setCheckingEmpId(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('emp_id')
          .eq('emp_id', formData.empId);

        if (data && data.length > 0) {
          setEmpIdError('This Employee ID already exists.');
        } else {
          setEmpIdError('');
        }
      } catch (err) {
        console.error('Error checking Employee ID:', err);
        setEmpIdError('');
      } finally {
        setCheckingEmpId(false);
      }
    };

    const timer = setTimeout(() => {
      checkEmpId();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [formData.empId, currentStep]);

  // Check if username already exists in users table
  useEffect(() => {
    const checkUsername = async () => {
      if (!formData.username || currentStep !== 1) {
        setUsernameError('');
        return;
      }
      setCheckingUsername(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username')
          .eq('username', formData.username);

        if (data && data.length > 0) {
          setUsernameError('This username is already taken. Please try another.');
        } else {
          setUsernameError('');
        }
      } catch (err) {
        console.error('Error checking username:', err);
        setUsernameError('');
      } finally {
        setCheckingUsername(false);
      }
    };

    const timer = setTimeout(() => {
      checkUsername();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [formData.username, currentStep]);

  // Auto-generate Joining ID
  useEffect(() => {
    const fetchLastId = async () => {
      try {
        const { data, error } = await supabase
          .from('joining_form')
          .select('joining_id')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error fetching last ID:', error);
          return;
        }

        let nextId = 'JOB001';
        if (data && data.length > 0 && data[0].joining_id) {
          const lastId = data[0].joining_id;
          const match = lastId.match(/JOB(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            nextId = `JOB${String(num + 1).padStart(3, '0')}`;
          }
        }
        setFormData(prev => ({ ...prev, joiningId: nextId }));
      } catch (err) {
        console.error('Error generating ID:', err);
      }
    };

    fetchLastId();
  }, []);

  // Update URL with generated ID
  useEffect(() => {
    if (formData.joiningId && !isSubmitted) {
      navigate(`/joining-form/${formData.joiningId}`, { replace: true });
    }
  }, [formData.joiningId, navigate, isSubmitted]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'empId') {
      let cleaned = value.replace(/[^0-9]/g, '');
      setFormData(prev => ({ ...prev, [name]: cleaned }));
      return;
    }

    if (name === 'username') {
      // Must start with a letter
      let cleaned = value.replace(/^[^a-zA-Z]+/, '');
      setFormData(prev => ({ ...prev, [name]: cleaned }));
      return;
    }

    if (name === 'nameAsPerAadhar' || name === 'fatherName' || name === 'relationshipWithFamily' || name === 'designation') {
      // Allow only alphabetic characters and spaces
      let cleaned = value.replace(/[^a-zA-Z\s]/g, '');
      setFormData(prev => ({ ...prev, [name]: cleaned }));
      return;
    }

    if (name === 'personalEmail') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError('');
      }
      setFormData(prev => ({ ...prev, [name]: value }));
      return;
    }

    if (name === 'aadharCardNo') {
      let cleaned = value.replace(/[^0-9]/g, '');
      if (cleaned.length > 12) {
        cleaned = cleaned.substring(0, 12);
      }
      setFormData(prev => ({ ...prev, [name]: cleaned }));
      return;
    }

    if (name === 'mobileNo' || name === 'familyMobileNo') {
      // Allow only numbers and ensure +91 prefix
      // Remove any non-numeric characters except initial +
      let cleaned = value.replace(/[^0-9]/g, '');

      // Check if user is trying to delete +91
      // If the resulting length is less than 2 (i.e. '9' or empty), reset to +91 or protect it.
      // Easiest is to strip everything, take the last digits, and re-append to +91

      // If user pasted something with +91, handle it
      if (value.startsWith('+91')) {
        cleaned = value.substring(3).replace(/[^0-9]/g, '');
      } else {
        // User typed into the prefix or cleared it
        // Just take the digits
        cleaned = value.replace(/[^0-9]/g, '');
        // If they typed 91... handle? 
        // Let's just treat all input as "the number part" if possible, but that's hard if they type
        // Simpler: Just enforce +91 + next 10 digits
      }

      // Limit to 10 digits
      if (cleaned.length > 10) {
        cleaned = cleaned.substring(0, 10);
      }

      setFormData(prev => ({ ...prev, [name]: '+91' + cleaned }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      // 5MB file size limit for production safety
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File size must be less than 5MB.');
        e.target.value = ''; // Reset input
        return;
      }
      setFormData(prev => ({ ...prev, [fieldName]: file }));
    }
  };

  const [isCustomDept, setIsCustomDept] = useState(false);

  const handleDeptSelectChange = (e) => {
    const value = e.target.value;
    if (value === 'Other') {
      setIsCustomDept(true);
      setFormData(prev => ({ ...prev, department: '' }));
    } else {
      setIsCustomDept(false);
      setFormData(prev => ({ ...prev, department: value }));
    }
  };

  // Upload file helper
  const uploadFile = async (file, path) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('images') // Using 'images' bucket as seen in project
      .upload(filePath, file);

    if (uploadError) {
      console.error(`Error uploading ${path}:`, uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const toastId = toast.loading('Submitting joining form...');

    try {
      const folder = `joining-docs/${formData.joiningId || 'temp'}`;

      // Upload Files
      const uploadPromises = [];

      // Passport Photo
      if (formData.passportPhoto) {
        uploadPromises.push(uploadFile(formData.passportPhoto, folder));
      } else {
        uploadPromises.push(Promise.resolve(null));
      }

      // Aadhar Card
      if (formData.aadharCardPhoto) {
        uploadPromises.push(uploadFile(formData.aadharCardPhoto, folder));
      } else {
        uploadPromises.push(Promise.resolve(null));
      }

      // Bank Passbook
      if (formData.bankPassbookPhoto) {
        uploadPromises.push(uploadFile(formData.bankPassbookPhoto, folder));
      } else {
        uploadPromises.push(Promise.resolve(null));
      }

      const [passportUrl, aadharUrl, bankPassbookUrl] = await Promise.all(uploadPromises);

      // Prepare Payload
      const payload = {
        joining_id: formData.joiningId,
        name_as_per_aadhar: formData.nameAsPerAadhar?.trim(),
        father_name: formData.fatherName?.trim(),
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender,
        department: formData.department?.trim(),
        mobile_no: formData.mobileNo,
        personal_email: formData.personalEmail?.trim(),
        family_mobile_no: formData.familyMobileNo === '+91' ? null : formData.familyMobileNo,
        relationship_with_family: formData.relationshipWithFamily?.trim(),
        current_address: formData.currentAddress?.trim(),
        date_of_joining: formData.dateOfJoining || null,
        designation: formData.designation?.trim(),
        highest_qualification: formData.highestQualification?.trim(),
        aadhar_card_number: formData.aadharCardNo?.trim(),
        bank_account_no: formData.bankAccountNo?.trim(),
        ifsc_code: formData.ifscCode?.trim(),
        branch_name: formData.branchName?.trim(),
        bank_name: formData.bankName?.trim(),
        emp_id: formData.empId?.trim(),
        username: formData.username?.trim(),
        password: formData.password, // Passwords should generally not be trimmed just in case they intentionally used spaces, though usually bad practice. Let's leave password alone or trim it based on standard practice. We will trim it.
        passport_photo_url: passportUrl,
        aadhar_card_url: aadharUrl,
        bank_passbook_url: bankPassbookUrl,
      };
      // Trim password too
      payload.password = payload.password?.trim();

      const { error: insertError } = await supabase
        .from('joining_form')
        .insert([payload]);

      if (insertError) throw insertError;

      toast.success('Joining form submitted successfully!', { id: toastId });

      // Mark as submitted
      localStorage.setItem('hasSubmittedJoiningForm', 'true');
      localStorage.setItem('submittedEmpId', formData.empId);
      localStorage.setItem('submittedUsername', formData.username);
      localStorage.setItem('submittedPassword', formData.password);

      setSubmittedData({
        empId: formData.empId,
        username: formData.username,
        password: formData.password
      });
      setIsSubmitted(true);

      // Reset Form (optional now as we hide it)
      setFormData({
        joiningId: '', nameAsPerAadhar: '', fatherName: '', dateOfBirth: '', gender: '',
        department: '', mobileNo: '+91', personalEmail: '', familyMobileNo: '+91',
        relationshipWithFamily: '', currentAddress: '', dateOfJoining: '', designation: '',
        highestQualification: '', aadharCardNo: '', bankAccountNo: '', ifscCode: '',
        branchName: '', bankName: '', empId: '', username: '', password: '',
        passportPhoto: null, aadharCardPhoto: null, bankPassbookPhoto: null
      });

    } catch (error) {
      console.error('Submission Error:', error);
      toast.error(`Submission failed: ${error.message}`, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 relative overflow-hidden">
          {/* Top colored line */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#991B1B]"></div>

          <div className="p-8 md:p-12 text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <CheckCircle className="text-green-600" size={40} strokeWidth={3} />
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 md:mb-3 tracking-tight">Application Submitted!</h2>

            <p className="text-slate-500 text-base md:text-lg mb-6 md:mb-8 leading-relaxed">
              Successfully recorded in the system.
            </p>

            {/* Credentials Card */}
            {submittedData && (
              <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-200 border-dashed relative group hover:border-[#991B1B]/30 transition-colors text-left">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4 text-center">Account Credentials Generated</p>

                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-sm font-semibold text-slate-500">Employee ID</span>
                    <span className="text-base font-bold text-slate-800">{submittedData.empId}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-sm font-semibold text-slate-500">Username</span>
                    <span className="text-base font-bold text-slate-800">{submittedData.username}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-500">Password</span>
                    <span className="text-base font-bold text-slate-800">{submittedData.password}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-5 font-medium text-center">Please securely save these credentials to access the portal.</p>
              </div>
            )}

            {/* Account Review Notice */}
            <div className="bg-amber-50/80 rounded-2xl p-5 mb-8 border border-amber-200/60 text-amber-900 text-sm leading-relaxed shadow-sm text-center">
              <p className="font-bold mb-2 text-[15px]">
                Your account is under review. After 24 hours, your account will be active. If not, please contact HR.
              </p>
              <p className="font-semibold text-amber-800/80 text-[13px]">
                आपका खाता समीक्षा के अधीन है। 24 घंटे के बाद आपका खाता सक्रिय हो जाएगा, यदि नहीं तो कृपया HR से संपर्क करें।
              </p>
            </div>

            <div className="space-y-8">
              <button
                onClick={() => {
                  localStorage.removeItem('hasSubmittedJoiningForm');
                  localStorage.removeItem('submittedEmpId');
                  localStorage.removeItem('submittedUsername');
                  localStorage.removeItem('submittedPassword');
                  navigate('/login');
                }}
                className="w-full py-3.5 px-6 rounded-xl bg-[#991B1B] text-white font-bold hover:bg-[#7F1D1D] active:scale-[0.98] transition-all shadow-lg shadow-red-900/10 flex items-center justify-center gap-2"
              >
                <span>Close & Go to Login</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleStepSubmit = (e) => {
    e.preventDefault();
    if (currentStep === 1 && (checkingEmpId || empIdError || checkingUsername || usernameError)) {
      return;
    }
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit(e);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="bg-[#800000] text-white px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <img src={loginImage} alt="Logo" className="h-10 sm:h-14 w-auto object-contain bg-white p-1 sm:p-1.5 rounded-md" />
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Link
            to="/home"
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 text-white/90 hover:bg-white/10 hover:text-white"
          >
            About
          </Link>
          <Link
            to="/career"
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 text-white/90 hover:bg-white/10 hover:text-white"
          >
            Career
          </Link>
          <Link
            to="/login"
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 text-white/90 hover:bg-white/10 hover:text-white"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-grow pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Page Header */}
          <div className="mb-6 md:mb-8 max-w-3xl">
            <h1 className="text-2xl md:text-4xl font-bold text-slate-900 tracking-tight">Employee Joining Form</h1>
            <p className="text-slate-500 mt-2 md:mt-3 text-sm md:text-lg">Please verify and fill in the details below to complete the new employee onboarding process.</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8 mt-4 max-w-3xl px-10 sm:px-12">
            <div className="relative h-16 w-full">
              <div className="absolute left-0 top-4 sm:top-5 w-full h-1.5 bg-slate-200 rounded-full z-0 translate-y-[-50%]"></div>
              <div className="absolute left-0 top-4 sm:top-5 h-1.5 bg-[#991B1B] rounded-full z-0 transition-all duration-500 translate-y-[-50%]" style={{ width: `${((currentStep - 1) / 3) * 100}%` }}></div>

              {[
                { id: 1, label: 'Login' },
                { id: 2, label: 'Personal' },
                { id: 3, label: 'Professional' },
                { id: 4, label: 'Bank' }
              ].map((step, index) => (
                <div
                  key={step.id}
                  className="absolute top-0 flex flex-col items-center w-20 sm:w-24 -ml-10 sm:-ml-12"
                  style={{ left: `${(index / 3) * 100}%` }}
                >
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300 ${currentStep >= step.id ? 'bg-[#991B1B] text-white shadow-md shadow-[#991B1B]/30 scale-110' : 'bg-white text-slate-400 border-2 border-slate-200'}`}>
                    {currentStep > step.id ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} /> : step.id}
                  </div>
                  <span className={`mt-2 sm:mt-3 text-[10px] sm:text-xs font-bold text-center leading-tight break-words ${currentStep >= step.id ? 'text-[#991B1B]' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleStepSubmit} className="space-y-8 max-w-3xl">

            {currentStep === 1 && (
              <SectionCard title="Step 1: Login Details" icon={User}>
                <div className="grid grid-cols-1 gap-6">
                  <InputField label="Employee ID (कर्मचारी आईडी)" name="empId" value={formData.empId} onChange={handleInputChange} placeholder="e.g. 101" required error={empIdError} />
                  <InputField label="Username (उपयोगकर्ता नाम)" name="username" value={formData.username} onChange={handleInputChange} placeholder="Choose a username" required error={usernameError} />
                  <InputField label="Password (पासवर्ड)" name="password" type="password" value={formData.password} onChange={handleInputChange} placeholder="Choose a password" required />
                </div>
              </SectionCard>
            )}

            {currentStep === 2 && (
              <>
                <SectionCard title="Step 2: Personal Details" icon={User}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <InputField label="Name As Per Aadhar (नाम आधार के अनुसार)" name="nameAsPerAadhar" value={formData.nameAsPerAadhar} onChange={handleInputChange} required placeholder="Enter full name" />
                    <InputField label="Father Name (पिता का नाम)" name="fatherName" value={formData.fatherName} onChange={handleInputChange} required placeholder="Enter father's name" />
                    <InputField label="Date Of Birth (जन्मतिथि)" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleInputChange} required />
                    <SelectField label="Gender (लिंग)" name="gender" value={formData.gender} onChange={handleInputChange} options={['Male', 'Female', 'Other']} required />
                    <PhoneInputField label="Mobile No. (मोबाइल नंबर)" name="mobileNo" value={formData.mobileNo} onChange={handleInputChange} required placeholder="9999999999" />
                    <InputField label="Email (ईमेल)" name="personalEmail" type="email" value={formData.personalEmail} onChange={handleInputChange} placeholder="email@example.com" error={emailError} />
                    <PhoneInputField label="Family Mobile No. (पारिवारिक मोबाइल नंबर)" name="familyMobileNo" value={formData.familyMobileNo} onChange={handleInputChange} placeholder="9999999999" />
                    <InputField label="Relationship With Family (परिवार के साथ संबंध)" name="relationshipWithFamily" value={formData.relationshipWithFamily} onChange={handleInputChange} placeholder="e.g. Father" />
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Current Address (वर्तमान पता)</label>
                      <textarea
                        name="currentAddress"
                        value={formData.currentAddress}
                        onChange={handleInputChange}
                        rows="3"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#991B1B] focus:ring-4 focus:ring-[#991B1B]/5 outline-none transition-all resize-none bg-slate-50 focus:bg-white"
                        placeholder="Enter full residential address..."
                      ></textarea>
                    </div>
                    <InputField label="Aadhar Card No. (आधार कार्ड नंबर)" name="aadharCardNo" value={formData.aadharCardNo} onChange={handleInputChange} required placeholder="12 digit number" maxLength={12} />
                  </div>
                </SectionCard>
                <SectionCard title="Personal Documents" icon={FileText}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FileUploadField
                      label="Passport Size Photo (पासपोर्ट साइज फोटो)"
                      name="passportPhoto"
                      onChange={(e) => handleFileChange(e, 'passportPhoto')}
                      file={formData.passportPhoto}
                    />
                    <FileUploadField
                      label="Aadhar Card Photo (आधार कार्ड)"
                      name="aadharCardPhoto"
                      onChange={(e) => handleFileChange(e, 'aadharCardPhoto')}
                      file={formData.aadharCardPhoto}
                    />
                  </div>
                </SectionCard>
              </>
            )}

            {currentStep === 3 && (
              <SectionCard title="Step 3: Professional Details" icon={Briefcase}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <InputField label="Highest Qualification (उच्चतम योग्यता)" name="highestQualification" value={formData.highestQualification} onChange={handleInputChange} placeholder="e.g. 12th Pass" required />
                  <div>
                    <SelectField
                      label="Department (विभाग)"
                      name="departmentSelect"
                      value={isCustomDept ? 'Other' : (DEPARTMENTS.includes(formData.department) ? formData.department : '')}
                      onChange={handleDeptSelectChange}
                      options={[...DEPARTMENTS, 'Other']}
                      required
                    />
                    {isCustomDept && (
                      <div className="mt-3">
                        <InputField
                          label="Specify Department (विभाग निर्दिष्ट करें)"
                          name="department"
                          value={formData.department}
                          onChange={handleInputChange}
                          required
                          placeholder="Enter department name"
                        />
                      </div>
                    )}
                  </div>
                  <InputField label="Designation (पद)" name="designation" value={formData.designation} onChange={handleInputChange} required placeholder="e.g. Operator" />
                  <InputField label="Date of Joining (जॉइनिंग की तारीख)" name="dateOfJoining" type="date" value={formData.dateOfJoining} onChange={handleInputChange} required />
                </div>
              </SectionCard>
            )}

            {currentStep === 4 && (
              <>
                <SectionCard title="Step 4: Bank Details" icon={CreditCard}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <InputField label="Bank Name (बैंक का नाम)" name="bankName" value={formData.bankName} onChange={handleInputChange} placeholder="Bank Name" required />
                    <InputField label="Bank Account No. (बैंक खाता संख्या)" name="bankAccountNo" value={formData.bankAccountNo} onChange={handleInputChange} placeholder="Account Number" required />
                    <InputField label="IFSC Code (आईएफएससी कोड)" name="ifscCode" value={formData.ifscCode} onChange={handleInputChange} placeholder="IFSC Code" required />
                    <InputField label="Branch Name (शाखा का नाम)" name="branchName" value={formData.branchName} onChange={handleInputChange} placeholder="Branch Name" required />
                  </div>
                </SectionCard>
                <SectionCard title="Bank Documents" icon={FileText}>
                  <div className="grid grid-cols-1">
                    <FileUploadField
                      label="Bank Passbook Photo (बैंक पासबुक)"
                      name="bankPassbookPhoto"
                      onChange={(e) => handleFileChange(e, 'bankPassbookPhoto')}
                      file={formData.bankPassbookPhoto}
                    />
                  </div>
                </SectionCard>
              </>
            )}

            {/* Action Buttons */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/85 backdrop-blur-xl border-t border-slate-200/80 z-50">
              <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-end gap-4">

                <div className="grid grid-cols-2 sm:flex sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    className="w-full sm:w-auto px-6 py-3 sm:py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors rounded-xl hover:bg-slate-50 border border-slate-200 sm:border-transparent"
                    onClick={() => currentStep > 1 ? prevStep() : navigate('/login')}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (currentStep === 1 && (checkingEmpId || !!empIdError || checkingUsername || !!usernameError)) || !!emailError}
                    className={`
                    w-full sm:w-auto px-8 py-3 sm:py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all duration-200 flex items-center justify-center gap-2
                    ${(submitting || (currentStep === 1 && (checkingEmpId || !!empIdError || checkingUsername || !!usernameError)) || !!emailError)
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed border-transparent'
                        : 'bg-[#991B1B] hover:bg-[#7F1D1D] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'}
                  `}
                  >
                    {submitting || (currentStep === 1 && (checkingEmpId || checkingUsername)) ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        <span>{submitting ? 'Submitting...' : 'Checking...'}</span>
                      </>
                    ) : currentStep < 4 ? (
                      <span>Next Step</span>
                    ) : (
                      <>
                        <span>Submit Application</span>
                        <CheckCircle size={16} strokeWidth={2.5} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

// Reusable UI Components

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
    <div className="px-4 md:px-6 py-4 md:py-5 border-b border-slate-100 flex items-center gap-3">
      <div className="bg-red-50 p-2 rounded-lg text-[#991B1B]">
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <h2 className="font-bold text-slate-800 text-base md:text-lg">{title}</h2>
    </div>
    <div className="p-4 md:p-8 bg-white">
      {children}
    </div>
  </div>
);

const InputField = ({ label, name, type = "text", value, onChange, placeholder, required, readOnly, error }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === 'password';
  const inputType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="group">
      <label className="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-[#991B1B] transition-colors break-words whitespace-normal leading-relaxed">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={inputType}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          className={`w-full px-4 py-3 rounded-xl border ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 focus:border-[#991B1B] focus:ring-[#991B1B]/5'} focus:ring-4 outline-none transition-all placeholder:text-slate-400
            ${readOnly ? 'bg-slate-50 text-slate-500 cursor-not-allowed border-slate-100' : 'bg-slate-50 focus:bg-white'}
            ${isPasswordType ? 'pr-12' : ''}
          `}
        />
        {isPasswordType && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}
    </div>
  );
};

const SelectField = ({ label, name, value, onChange, options, required }) => (
  <div className="group">
    <label className="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-[#991B1B] transition-colors break-words whitespace-normal leading-relaxed">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#991B1B] focus:ring-4 focus:ring-[#991B1B]/5 outline-none transition-all appearance-none bg-slate-50 focus:bg-white cursor-pointer"
      >
        <option value="">Select {label}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-[#991B1B]" size={18} />
    </div>
  </div>
);

const FileUploadField = ({ label, name, onChange, file }) => (
  <div className="space-y-2">
    <label className="block text-sm font-semibold text-slate-700 break-words whitespace-normal leading-relaxed">{label}</label>
    <div className="relative group">
      <input
        type="file"
        id={name}
        onChange={onChange}
        className="hidden"
        accept="image/*,.pdf"
      />
      <label
        htmlFor={name}
        className={`flex flex-col items-center justify-center gap-3 px-4 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300
          ${file
            ? 'border-red-200 bg-red-50/50'
            : 'border-slate-200 hover:border-[#991B1B]/40 hover:bg-slate-50'}`}
      >
        <div className={`p-3 rounded-full transition-colors ${file ? 'bg-white text-[#991B1B] shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#991B1B] group-hover:shadow-sm'}`}>
          <Upload size={20} />
        </div>
        <div className="text-center">
          <p className={`text-sm font-medium transition-colors ${file ? 'text-[#991B1B]' : 'text-slate-700 group-hover:text-slate-900'}`}>
            {file ? (file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name) : "Click to upload"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "SVG, PNG, JPG (Max 5MB)"}
          </p>
        </div>
      </label>
    </div>
  </div>
);

const PhoneInputField = ({ label, name, value, onChange, placeholder, required }) => {
  const displayValue = value ? value.replace(/^\+91/, '') : '';

  return (
    <div className="group">
      <label className="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-[#991B1B] transition-colors break-words whitespace-normal leading-relaxed">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span className="text-slate-500 font-medium border-r pr-3 border-slate-300 group-focus-within:text-slate-700 group-focus-within:border-[#991B1B]/30 transition-colors">+91</span>
        </div>
        <input
          type="text"
          name={name}
          value={displayValue}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="w-full pl-20 pr-4 py-3 rounded-xl border border-slate-200 focus:border-[#991B1B] focus:ring-4 focus:ring-[#991B1B]/5 outline-none transition-all bg-slate-50 focus:bg-white"
          maxLength={10}
        />
      </div>
    </div>
  );
};

export default JoiningForm;

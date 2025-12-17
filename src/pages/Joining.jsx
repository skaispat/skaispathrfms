import React, { useState, useEffect } from 'react';
import {
  Search, Filter, ChevronLeft, ChevronRight, FileText, Calendar,
  User, Phone, Mail, MapPin, Briefcase, Share2, Eye, Edit, X,
  Upload, CreditCard, CheckCircle, ChevronDown, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';

// --- Shared Components for Form ---
const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
    <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
      <div className="bg-red-50 p-2 rounded-lg text-[#991B1B]">
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <h2 className="font-bold text-slate-800 text-lg">{title}</h2>
    </div>
    <div className="p-6 md:p-8 bg-white">
      {children}
    </div>
  </div>
);

const InputField = ({ label, name, type = "text", value, onChange, placeholder, required, readOnly }) => (
  <div className="group">
    <label className="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-[#991B1B] transition-colors">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      readOnly={readOnly}
      className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#991B1B] focus:ring-4 focus:ring-[#991B1B]/5 outline-none transition-all placeholder:text-slate-400
        ${readOnly ? 'bg-slate-50 text-slate-500 cursor-not-allowed border-slate-100' : 'bg-slate-50 focus:bg-white'}
      `}
    />
  </div>
);

const SelectField = ({ label, name, value, onChange, options, required }) => (
  <div className="group">
    <label className="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-[#991B1B] transition-colors">
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

const FileUploadField = ({ label, name, onChange, file }) => {
  const isUrl = typeof file === 'string';
  const isFile = file instanceof File;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
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
              {isFile
                ? (file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name)
                : (isUrl ? "File Uploaded (Click to Change)" : "Click to upload")}
            </p>
            {isUrl && (
              <a
                href={file}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 underline mt-1 block hover:text-blue-800 z-10 relative"
                onClick={(e) => e.stopPropagation()}
              >
                View Current File
              </a>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {isFile ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "SVG, PNG, JPG (Max 5MB)"}
            </p>
          </div>
        </label>
      </div>
    </div>
  );
};

const PhoneInputField = ({ label, name, value, onChange, placeholder, required }) => {
  const displayValue = value ? value.replace(/^\+91/, '') : '';

  return (
    <div className="group">
      <label className="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-[#991B1B] transition-colors">
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

// --- Joining Form Integrated Component ---
const JoiningForm = ({ existingData, onCancel, onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);

  const [formData, setFormData] = useState({
    joiningId: existingData?.joining_id || '',
    nameAsPerAadhar: existingData?.name_as_per_aadhar || '',
    fatherName: existingData?.father_name || '',
    dateOfBirth: existingData?.date_of_birth || '',
    gender: existingData?.gender || '',
    department: existingData?.department || '',
    mobileNo: existingData?.mobile_no || '+91',
    personalEmail: existingData?.personal_email || '',
    familyMobileNo: existingData?.family_mobile_no || '+91',
    relationshipWithFamily: existingData?.relationship_with_family || '',
    currentAddress: existingData?.current_address || '',
    dateOfJoining: existingData?.date_of_joining || '',
    designation: existingData?.designation || '',
    highestQualification: existingData?.highest_qualification || '',
    aadharCardNo: existingData?.aadhar_card_number || '',
    bankAccountNo: existingData?.bank_account_no || '',
    ifscCode: existingData?.ifsc_code || '',
    branchName: existingData?.branch_name || '',
    passportPhoto: existingData?.passport_photo_url || null,
    aadharCardPhoto: existingData?.aadhar_card_url || null,
    bankPassbookPhoto: existingData?.bank_passbook_url || null,
  });

  useEffect(() => {
    // If we have existing data but no joiningId, generate one
    if (!formData.joiningId) {
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
    }
  }, [formData.joiningId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'mobileNo' || name === 'familyMobileNo') {
      let cleaned = value.replace(/[^0-9]/g, '');
      if (value.startsWith('+91')) {
        cleaned = value.substring(3).replace(/[^0-9]/g, '');
      } else {
        cleaned = value.replace(/[^0-9]/g, '');
      }
      if (cleaned.length > 10) cleaned = cleaned.substring(0, 10);
      setFormData(prev => ({ ...prev, [name]: '+91' + cleaned }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, [fieldName]: file }));
    }
  };

  const uploadFile = async (file, path) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${path}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
    if (uploadError) {
      console.error(`Error uploading ${path}:`, uploadError);
      throw uploadError;
    }
    const { data } = supabase.storage.from('images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const toastId = toast.loading('Submitting joining form...');
    try {
      const folder = `joining-docs/${formData.joiningId || 'temp'}`;

      const processFile = async (fileOrUrl) => {
        if (!fileOrUrl) return null;
        if (typeof fileOrUrl === 'string') return fileOrUrl;
        return uploadFile(fileOrUrl, folder);
      };

      const [passportUrl, aadharUrl, bankPassbookUrl] = await Promise.all([
        processFile(formData.passportPhoto),
        processFile(formData.aadharCardPhoto),
        processFile(formData.bankPassbookPhoto)
      ]);

      const payload = {
        joining_id: formData.joiningId,
        name_as_per_aadhar: formData.nameAsPerAadhar,
        father_name: formData.fatherName,
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender,
        department: formData.department,
        mobile_no: formData.mobileNo,
        personal_email: formData.personalEmail,
        family_mobile_no: formData.familyMobileNo === '+91' ? null : formData.familyMobileNo,
        relationship_with_family: formData.relationshipWithFamily,
        current_address: formData.currentAddress,
        date_of_joining: formData.dateOfJoining || null,
        designation: formData.designation,
        highest_qualification: formData.highestQualification,
        aadhar_card_number: formData.aadharCardNo,
        bank_account_no: formData.bankAccountNo,
        ifsc_code: formData.ifscCode,
        branch_name: formData.branchName,
      };

      if (passportUrl) payload.passport_photo_url = passportUrl;
      if (aadharUrl) payload.aadhar_card_url = aadharUrl;
      if (bankPassbookUrl) payload.bank_passbook_url = bankPassbookUrl;

      // Upsert logic (checking existingData)
      let result;
      if (existingData && existingData.joining_id) {
        // Update existing
        const { error: updateError } = await supabase
          .from('joining_form')
          .update(payload)
          .eq('joining_id', existingData.joining_id);
        if (updateError) throw updateError;
        result = existingData.joining_id;
      } else {
        // Insert new
        const { error: insertError } = await supabase.from('joining_form').insert([payload]);
        if (insertError) throw insertError;
        result = formData.joiningId;
      }

      toast.success('Joining form submitted successfully!', { id: toastId });
      setSubmittedId(result);
      if (onSuccess) onSuccess();
      setIsSubmitted(true);
    } catch (error) {
      console.error('Submission Error:', error);
      toast.error(`Submission failed: ${error.message}`, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 relative overflow-hidden my-auto">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#991B1B]"></div>
          <div className="p-8 md:p-12 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <CheckCircle className="text-green-600" size={40} strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Application Recorded!</h2>
            <p className="text-slate-500 text-lg mb-8 leading-relaxed">Successfully recorded in the system.</p>
            {submittedId && (
              <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-200 border-dashed relative">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5">Joining ID</p>
                <div className="text-4xl font-mono font-bold text-slate-800 tracking-tight flex justify-center items-center gap-3">{submittedId}</div>
              </div>
            )}
            <button onClick={onCancel} className="w-full py-3.5 px-6 rounded-xl bg-[#991B1B] text-white font-bold hover:bg-[#7F1D1D] shadow-lg shadow-red-900/10">
              Return to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-6">
            <button onClick={onCancel} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors gap-1 text-sm font-medium mb-4">
              <ChevronLeft size={16} /> Back to List
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Employee Joining Form</h1>
            <p className="text-slate-500 mt-3 text-lg">Verify and fill in details.</p>
          </div>

          <form id="joining-form" onSubmit={handleSubmit} className="space-y-8">
            <SectionCard title="Basic Information" icon={User}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <InputField label="Joining ID (जॉइनिंग आईडी)" name="joiningId" value={formData.joiningId} onChange={handleInputChange} required readOnly={true} placeholder="Auto-generated" />
                <div className="md:col-span-1" />
                <InputField label="Name As Per Aadhar (नाम आधार के अनुसार)" name="nameAsPerAadhar" value={formData.nameAsPerAadhar} onChange={handleInputChange} required />
                <InputField label="Father Name (पिता का नाम)" name="fatherName" value={formData.fatherName} onChange={handleInputChange} required />
                <InputField label="Date Of Birth As per Aadhar (आधार के अनुसार जन्मतिथि)" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleInputChange} required />
                <SelectField label="Gender (लिंग)" name="gender" value={formData.gender} onChange={handleInputChange} options={['Male', 'Female', 'Other']} required />
                <InputField label="Aadhar Card No. (आधार कार्ड नंबर)" name="aadharCardNo" value={formData.aadharCardNo} onChange={handleInputChange} required />
              </div>
            </SectionCard>

            <SectionCard title="Employment Details" icon={Briefcase}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InputField label="Department (विभाग)" name="department" value={formData.department} onChange={handleInputChange} required />
                <InputField label="Designation (पद)" name="designation" value={formData.designation} onChange={handleInputChange} required />
                <InputField label="Date of Joining (जॉइनिंग की तारीख)" name="dateOfJoining" type="date" value={formData.dateOfJoining} onChange={handleInputChange} required />
                <InputField label="Highest Qualification (उच्चतम योग्यता)" name="highestQualification" value={formData.highestQualification} onChange={handleInputChange} />
              </div>
            </SectionCard>

            <SectionCard title="Contact Information" icon={Phone}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <PhoneInputField label="Mobile No. (मोबाइल नंबर)" name="mobileNo" value={formData.mobileNo} onChange={handleInputChange} required />
                <InputField label="Personal Email (व्यक्तिगत ईमेल)" name="personalEmail" type="email" value={formData.personalEmail} onChange={handleInputChange} />
                <PhoneInputField label="Family Mobile No. (पारिवारिक मोबाइल नंबर)" name="familyMobileNo" value={formData.familyMobileNo} onChange={handleInputChange} />
                <InputField label="Relationship With Family (परिवार के साथ संबंध)" name="relationshipWithFamily" value={formData.relationshipWithFamily} onChange={handleInputChange} />
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Current Address (वर्तमान पता)</label>
                  <textarea name="currentAddress" value={formData.currentAddress} onChange={handleInputChange} rows="3" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#991B1B] focus:ring-4 focus:ring-[#991B1B]/5 outline-none transition-all resize-none bg-slate-50 focus:bg-white"></textarea>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Financial Details" icon={CreditCard}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InputField label="Bank Account No. (बैंक खाता संख्या)" name="bankAccountNo" value={formData.bankAccountNo} onChange={handleInputChange} />
                <InputField label="IFSC Code (आईएफएससी कोड)" name="ifscCode" value={formData.ifscCode} onChange={handleInputChange} />
                <InputField label="Branch Name (शाखा का नाम)" name="branchName" value={formData.branchName} onChange={handleInputChange} />
              </div>
            </SectionCard>

            <SectionCard title="Documents Upload" icon={FileText}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FileUploadField label="Passport Size Photo (पासपोर्ट साइज फोटो)" name="passportPhoto" onChange={(e) => handleFileChange(e, 'passportPhoto')} file={formData.passportPhoto} />
                <FileUploadField label="Aadhar Card (आधार कार्ड)" name="aadharCardPhoto" onChange={(e) => handleFileChange(e, 'aadharCardPhoto')} file={formData.aadharCardPhoto} />
                <FileUploadField label="Bank Passbook (बैंक पासबुक)" name="bankPassbookPhoto" onChange={(e) => handleFileChange(e, 'bankPassbookPhoto')} file={formData.bankPassbookPhoto} />
              </div>
            </SectionCard>

          </form>
        </div>
      </div>

      <div className="shrink-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)] z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-end gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all duration-200 shadow-sm focus:ring-2 focus:ring-slate-200 outline-none"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="joining-form"
            disabled={submitting}
            className={`px-8 py-2.5 rounded-xl text-sm font-bold text-white shadow-md shadow-red-900/10 hover:shadow-lg hover:shadow-red-900/20 transition-all duration-200 flex items-center gap-2.5 transform active:scale-[0.98] focus:ring-4 focus:ring-red-900/10 outline-none ${submitting
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-[#991B1B] to-[#7F1D1D] hover:from-[#7F1D1D] hover:to-[#601515]'
              }`}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>Submit Application</span>
                <CheckCircle size={18} strokeWidth={2.5} className="opacity-90" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Share Modal ---
const ShareModal = ({ isOpen, onClose, candidate }) => {
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRecipientName('');
      setRecipientEmail('');
    }
  }, [isOpen]);

  if (!isOpen || !candidate) return null;

  const subject = `Candidate Joining Details - ${candidate.name_as_per_aadhar}`;
  const message = `Dear Recipient,

We are pleased to share the joining details for ${candidate.name_as_per_aadhar}, selected for the position of ${candidate.designation}.

Candidate Overview:
--------------------------------------------------
• Name: ${candidate.name_as_per_aadhar}
• Position: ${candidate.designation}
• Department: ${candidate.department}
• Contact: ${candidate.mobile_no}
• Email: ${candidate.personal_email || 'N/A'}
• Reference ID: ${candidate.joining_id || 'N/A'}

Please access the joining form via the link below:
https://skajoiningforms.vercel.app/joining-form/${candidate.joining_id}

Best regards,
HR Team`;

  const handleSend = () => {
    if (!recipientEmail) {
      toast.error('Please enter a recipient email.');
      return;
    }
    toast.success('Email sent successfully!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">Share Candidate Details</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Recipient Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Enter recipient name"
              className="w-full px-3 py-2 border rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email Address <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Enter recipient email"
              className="w-full px-3 py-2 border rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Subject <span className="text-red-500">*</span></label>
            <input type="text" value={subject} readOnly className="w-full px-3 py-2 border rounded-lg text-sm text-gray-600 bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Message <span className="text-red-500">*</span></label>
            <textarea value={message} readOnly rows={8} className="w-full px-3 py-2 border rounded-lg text-sm text-gray-600 bg-gray-50 resize-none font-mono text-xs" />
          </div>
          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-md text-indigo-600"><FileText size={16} /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-indigo-900">Attached Link</p>
              <p className="text-xs text-indigo-700 break-all">https://skajoiningforms.vercel.app/joining-form/{candidate.joining_id}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSend} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm">Send Email</button>
        </div>
      </div>
    </div>
  );
};


const Joining = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [joiningData, setJoiningData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState(false); // Toggle between Table and Form
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCandidate, setShareCandidate] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchJoiningData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('joining_form')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJoiningData(data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJoiningData();
  }, [viewMode]); // Refetch when returning from form

  // Filter Logic
  const filteredData = joiningData.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.name_as_per_aadhar?.toLowerCase().includes(searchLower) ||
      item.mobile_no?.toLowerCase().includes(searchLower) ||
      item.department?.toLowerCase().includes(searchLower) ||
      item.joining_id?.toLowerCase().includes(searchLower) ||
      item.designation?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);
  useEffect(() => setCurrentPage(1), [searchTerm]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleViewForm = (item) => {
    setSelectedCandidate(item);
    setViewMode(true);
  };

  const handleShare = (item) => {
    setShareCandidate(item);
    setShowShareModal(true);
  };

  if (viewMode) {
    return (
      <JoiningForm
        existingData={selectedCandidate}
        onCancel={() => { setViewMode(false); setSelectedCandidate(null); }}
        onSuccess={() => { setViewMode(false); setSelectedCandidate(null); }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Employee Joining Data</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage and view detailed employee joining records</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 shrink-0">
        <div className="relative flex-1 max-w-lg">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 sm:text-sm transition-all"
            placeholder="Search by name, mobile, department, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="min-w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs first:pl-8">Action</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Joining ID</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Candidate Name</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Department</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Phone</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">DOJ</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr><td colSpan="10" className="px-6 py-24 text-center">Loading...</td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan="10" className="px-6 py-24 text-center">No records found.</td></tr>
              ) : (
                currentItems.map((item) => (
                  <tr key={item.joining_id} className="group hover:bg-slate-50 transition-colors duration-150">
                    <td className="px-6 py-4 pl-8">
                      <div className="flex items-center gap-3">
                        {item.father_name !== 'Pending Update' ? (
                          <>
                            <button
                              onClick={() => handleViewForm(item)}
                              className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-all"
                              title="Update Details"
                            >
                              <Edit size={14} className="text-indigo-600 group-hover:text-indigo-700 transition-colors" />
                              <span className="text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">Update</span>
                            </button>
                            <button
                              onClick={() => handleShare(item)}
                              className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
                              title="Share Update Link"
                            >
                              <Share2 size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                              <span className="text-xs font-semibold text-slate-600 group-hover:text-indigo-700">Share</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleViewForm(item)}
                              className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-all"
                              title="View & Edit Form"
                            >
                              <Eye size={14} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                              <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-700">View</span>
                            </button>
                            <button
                              onClick={() => handleShare(item)}
                              className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
                              title="Share Form Link"
                            >
                              <Share2 size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                              <span className="text-xs font-semibold text-slate-600 group-hover:text-indigo-700">Share</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{item.joining_id}</span></td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{item.name_as_per_aadhar}</td>
                    <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{item.department}</span></td>
                    <td className="px-6 py-4 text-slate-600">{item.mobile_no}</td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(item.date_of_joining)}</td>
                    <td className="px-6 py-4">
                      {item.father_name === 'Pending Update' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">Pending</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Submitted</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Footer */}
        {filteredData.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-900">{indexOfFirstItem + 1}</span> to <span className="font-medium text-slate-900">{Math.min(indexOfLastItem, filteredData.length)}</span> of <span className="font-medium text-slate-900">{filteredData.length}</span> results
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                        ? 'bg-indigo-600 text-white border border-indigo-600'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        candidate={shareCandidate}
      />
    </div>
  );
};

export default Joining;
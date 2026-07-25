import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { User, Lock, Loader2, Eye, EyeOff, CheckCircle2, Briefcase, ChevronRight, Users, Phone, Mail, MapPin, ShieldCheck, Shield, FileText, Building2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { supabase } from '../supabaseClient';
import loginImage from '../assets/logo.jpg';

// Clear language hint on load if needed
localStorage.removeItem('hasSeenLanguageHint');

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('login');
  const [jobVacancies, setJobVacancies] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  // Legal & Privacy Modal states
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Form states
  const [candidateName, setCandidateName] = useState('');
  const [candidateExperience, setCandidateExperience] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [candidateResume, setCandidateResume] = useState(null);
  const [candidateRemark, setCandidateRemark] = useState('');
  const [submitLeadLoading, setSubmitLeadLoading] = useState(false);

  // Wizard states
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSkills, setSelectedSkills] = useState({});
  const [applicantCount, setApplicantCount] = useState(0);

  useEffect(() => {
    if (selectedJob) {
      const fetchApplicantCount = async () => {
        const { count, error } = await supabase
          .from('job_leads')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', selectedJob.id);

        if (!error && count !== null) {
          setApplicantCount(count);
        }
      };
      fetchApplicantCount();
    }
  }, [selectedJob]);

  useEffect(() => {
    if (location.pathname === '/home') setActiveTab('home');
    else if (location.pathname === '/career') setActiveTab('career');
    else setActiveTab('login');
  }, [location.pathname]);

  useEffect(() => {
    if (activeTab === 'career' && jobVacancies.length === 0) {
      const fetchJobs = async () => {
        setLoadingJobs(true);
        try {
          const { data, error } = await supabase
            .from('job_vacancy')
            .select('*')
            .order('id', { ascending: false });
          if (error) throw error;

          if (data && data.length > 0) {
            const jobsWithCounts = await Promise.all(
              data.map(async (job) => {
                const { count, error: countError } = await supabase
                  .from('job_leads')
                  .select('*', { count: 'exact', head: true })
                  .eq('job_id', job.id);
                return { ...job, applicantCount: countError ? 0 : (count || 0) };
              })
            );
            setJobVacancies(jobsWithCounts);
          } else {
            setJobVacancies([]);
          }
        } catch (err) {
          console.error('Error fetching jobs:', err);
        } finally {
          setLoadingJobs(false);
        }
      };
      fetchJobs();
    }
  }, [activeTab, jobVacancies.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // 1. Fetch user from Supabase 'users' table
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Invalid credentials');
        } else {
          console.error('Supabase error:', error);
          toast.error('Error connecting to login server');
        }
        setSubmitting(false);
        return;
      }

      // 2. Validate Password (Plain text comparison as per existing system)
      if (!user || user.password !== password) {
        toast.error('Invalid credentials');
        setSubmitting(false);
        return;
      }

      // 3. Check if account is active
      if (user.is_active === false) {
        toast.error('Your account has been deactivated. Please contact the administrator.');
        setSubmitting(false);
        return;
      }

      toast.success('Login successful!');

      // 4. Create compatibility object for existing app components
      const userForStore = {
        ...user,
        Name: user.full_name,
        Admin: (user.role && user.role.toLowerCase() === 'admin') ? 'Yes' : 'No'
      };

      // 5. Store user session
      localStorage.setItem('user', JSON.stringify(userForStore));
      login(userForStore);

      // 6. Navigate to dashboard for all users
      navigate("/", { replace: true });

    } catch (err) {
      console.error('Login exception:', err);
      toast.error('An unexpected error occurred during login');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;
    setSubmitLeadLoading(true);

    try {
      let resumeUrl = '';

      if (candidateResume) {
        const fileExt = candidateResume.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(fileName, candidateResume);

        if (uploadError) {
          console.warn('Could not upload to images bucket');
          const { error: fallbackError } = await supabase.storage.from('images').upload(fileName, candidateResume);
          if (fallbackError) {
            throw new Error('Resume upload failed: ' + fallbackError.message);
          } else {
            const { data } = supabase.storage.from('images').getPublicUrl(fileName);
            resumeUrl = data.publicUrl;
          }
        } else {
          const { data } = supabase.storage.from('images').getPublicUrl(fileName);
          resumeUrl = data.publicUrl;
        }
      }

      const { error } = await supabase
        .from('job_leads')
        .insert([{
          job_id: selectedJob.id,
          post: selectedJob.post,
          required_experience: selectedJob.experience || 'Fresher',
          candidate_name: candidateName,
          candidate_experience: candidateExperience ? (candidateExperience === '0' ? 'Fresher' : `${candidateExperience} ${candidateExperience === '1' ? 'Year' : 'Years'}`) : '',
          candidate_phone: candidatePhone,
          candidate_resume: resumeUrl,
          skills: JSON.stringify(selectedSkills),
          remark: candidateRemark,
        }]);

      if (error) throw error;

      toast.success('Application submitted successfully!');
      setSelectedJob(null);
      setCandidateName('');
      setCandidateExperience('');
      setCandidatePhone('');
      setCandidateResume(null);
      setSelectedSkills({});
      setCurrentStep(1);
      setCandidateRemark('');

    } catch (err) {
      console.error('Apply error:', err);
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setSubmitLeadLoading(false);
    }
  };

  const renderApplyForm = () => (
    <div className="space-y-6 animate-fade-in-up">
      <div className="border-b border-gray-100 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm sm:text-base font-bold text-gray-500 uppercase tracking-wider">Apply For</span>
          <button onClick={() => {
            setSelectedJob(null);
            setCurrentStep(1);
            setSelectedSkills({});
          }} className="text-gray-500 hover:text-[#800000] font-medium text-xs sm:text-sm flex items-center bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back
          </button>
        </div>
        <div className="flex flex-row items-center gap-3 flex-wrap">
          <h2 className="text-xl sm:text-3xl font-extrabold text-[#800000] tracking-tight">{selectedJob.post}</h2>
          <span className="text-[10px] sm:text-xs font-bold text-[#1d4ed8] bg-[#eff6ff] px-2.5 py-1 rounded-full w-fit whitespace-nowrap border border-[#bfdbfe]">
            {applicantCount} {applicantCount === 1 ? 'person applied' : 'people applied'}
          </span>
        </div>
      </div>

      <div className="bg-gray-50 p-4 sm:p-6 rounded-2xl border border-gray-200">
        {/* <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-3">Job Overview</h4> */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
          <div>
            <span className="block text-gray-500 mb-1">Minimum Experience</span>
            <span className="font-semibold text-gray-800">{selectedJob.experience || 'Fresher'}</span>
          </div>
          <div>
            <span className="block text-gray-500 mb-1">Number of Posts</span>
            <span className="font-semibold text-gray-800">{selectedJob.number_of_posts || 1}</span>
          </div>
          <div>
            <span className="block text-gray-500 mb-1">Posted Date</span>
            <span className="font-semibold text-gray-800">
              {new Date(selectedJob.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
        {selectedJob.skill_required && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <span className="block text-gray-500 mb-2 text-xs sm:text-sm">Required Skills</span>
            <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible gap-2 pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {selectedJob.skill_required.split(',').map((s, i) => (
                <span key={i} className="whitespace-nowrap flex-shrink-0 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200 shadow-sm">{s.trim()}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleApplySubmit} className="space-y-5 bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
        {currentStep === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-fade-in-up">
            <div className="space-y-1.5 sm:col-span-2">
              <h3 className="text-lg font-bold text-[#800000]">Step 1: Basic Details</h3>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700">Full Name *</label>
              <input type="text" required value={candidateName} onChange={e => setCandidateName(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] transition-colors text-sm" placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700">Phone Number *</label>
              <input type="tel" required value={candidatePhone} onChange={e => setCandidatePhone(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] transition-colors text-sm" placeholder="+91 9876543210" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700">Total Experience (in years) *</label>
              <input type="text" required value={candidateExperience} onChange={e => {
                // Only allow numbers, dots, and hyphens (for ranges like 2-5)
                const val = e.target.value.replace(/[^0-9.-]/g, '');
                setCandidateExperience(val);
              }} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] transition-colors text-sm" placeholder="e.g. 2 or 2-5 (Use 0 for Fresher)" />
            </div>
            <div className="pt-4 flex justify-end sm:col-span-2">
              <button type="button" onClick={() => {
                if (candidateName && candidatePhone && candidateExperience) setCurrentStep(2);
                else toast.error("Please fill all required fields");
              }} className="w-1/2 sm:w-auto flex items-center justify-center px-4 sm:px-8 py-3 rounded-xl font-bold text-white bg-[#800000] hover:bg-[#600000] shadow-lg hover:shadow-[#800000]/20 transition-all hover:-translate-y-0.5 text-sm sm:text-base">
                Next Step <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-5 animate-fade-in-up">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-[#800000]">Step 2: Skills Assessment</h3>
              <p className="text-sm text-gray-500">Please select the skills you have and specify your experience in years.</p>
            </div>

            <div className="space-y-4">
              {selectedJob.skill_required ? selectedJob.skill_required.split(',').map((skillStr, idx) => {
                const skill = skillStr.trim();
                const isChecked = selectedSkills[skill] !== undefined;
                return (
                  <div key={idx} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-xl transition-all ${isChecked ? 'bg-[#800000]/5 border-[#800000]/30' : 'bg-gray-50 border-gray-200'}`}>
                    <label className="flex items-center cursor-pointer min-w-[150px]">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSkills(prev => ({ ...prev, [skill]: '' }));
                          } else {
                            setSelectedSkills(prev => {
                              const newSkills = { ...prev };
                              delete newSkills[skill];
                              return newSkills;
                            });
                          }
                        }}
                        className="w-4 h-4 text-[#800000] border-gray-300 rounded focus:ring-[#800000]"
                      />
                      <span className="ml-3 text-sm font-bold text-gray-700">{skill}</span>
                    </label>

                    {isChecked && (
                      <input
                        type="text"
                        placeholder="Years of experience (e.g. 2)"
                        value={selectedSkills[skill] || ''}
                        onChange={(e) => setSelectedSkills(prev => ({ ...prev, [skill]: e.target.value }))}
                        className="flex-1 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] transition-colors"
                      />
                    )}
                  </div>
                );
              }) : (
                <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-xl border border-gray-200">No specific skills listed for this role.</div>
              )}
            </div>

            <div className="pt-4 flex flex-row justify-between gap-3">
              <button type="button" onClick={() => setCurrentStep(1)} className="flex-1 sm:flex-none px-4 sm:px-6 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors text-sm sm:text-base">
                Back
              </button>
              <button type="button" onClick={() => {
                const emptyExp = Object.values(selectedSkills).some(exp => !exp.trim());
                if (emptyExp) {
                  toast.error("Please specify experience for all selected skills");
                  return;
                }
                setCurrentStep(3);
              }} className="flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-8 py-3 rounded-xl font-bold text-white bg-[#800000] hover:bg-[#600000] shadow-lg hover:shadow-[#800000]/20 transition-all hover:-translate-y-0.5 text-sm sm:text-base">
                Next Step <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="grid grid-cols-1 gap-5 animate-fade-in-up">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-[#800000]">Step 3: Final Details</h3>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700">Resume Upload *</label>
              <input type="file" required onChange={e => setCandidateResume(e.target.files[0])} accept=".pdf,.doc,.docx" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-[#800000]/10 file:text-[#800000] hover:file:bg-[#800000]/20 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700">Remarks (Optional)</label>
              <textarea value={candidateRemark} onChange={e => setCandidateRemark(e.target.value)} rows="3" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] transition-colors text-sm" placeholder="Any additional information..."></textarea>
            </div>
            <div className="pt-4 flex flex-row justify-between gap-3">
              <button type="button" onClick={() => setCurrentStep(2)} className="flex-1 sm:flex-none px-4 sm:px-6 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors text-sm sm:text-base">
                Back
              </button>
              <button type="submit" disabled={submitLeadLoading} className={`flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all text-sm sm:text-base ${submitLeadLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#800000] hover:bg-[#600000] hover:shadow-[#800000]/20 hover:-translate-y-0.5'}`}>
                {submitLeadLoading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mx-auto" /> : 'Submit'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );

  const renderHomeContent = () => (
    <div className="space-y-4 animate-fade-in-up">
      <div className="border-b border-gray-100 pb-6">
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Sarthak HR Portal</h2>
        <p className="mt-4 text-lg text-gray-600 w-full leading-relaxed text-justify">
          This portal is the central hub for all our employees and partners. Access your benefits, check your attendance, manage your leaves, and stay updated with the latest news from the company.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Users className="mr-2 text-[#800000]" size={24} />
            Quick Access
          </h3>
          <ul className="space-y-4">
            {[
              "Manage Your Attendance",
              "Manage Your Leaves",
              "View Your Profile",
              "Holiday Calendar"
            ].map((link, i) => (
              <li key={i} className="flex items-center text-gray-700 hover:text-[#800000] cursor-pointer transition-colors group">
                <CheckCircle2 size={18} className="mr-3 text-[#800000]/60 group-hover:text-[#800000]" />
                <span className="font-medium">{link}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Phone className="mr-2 text-[#800000]" size={24} />
            Contact HR
          </h3>
          <div className="space-y-4 text-gray-600">
            <div className="flex items-center">
              <Mail className="mr-3 text-gray-400" size={18} />
              <span>hr@skaispat.in</span>
            </div>
            <div className="flex items-center">
              <Phone className="mr-3 text-gray-400" size={18} />
              <span>+91 9109164455</span>
            </div>
            <div className="flex items-start">
              <MapPin className="mr-3 text-gray-400 mt-1" size={18} />
              <span>Plot No. 1,2,3,11,12 CSIDC Growth Centre, Industrial Area Siltara Phase-2, Raipur (CG)- 493221.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCareerContent = () => {
    if (selectedJob) return renderApplyForm();

    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="border-b border-gray-100 pb-2">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Open Roles</h2>
        </div>

        <div className="space-y-2">
          {loadingJobs ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 sm:p-6 border border-gray-200 rounded-2xl bg-white animate-pulse space-y-3.5">
                  {/* Top skeleton header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                      <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                      <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                      <div className="h-3.5 w-20 bg-gray-200 rounded-full"></div>
                    </div>
                    <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
                  </div>

                  {/* Separator line */}
                  <div className="h-[2px] w-full bg-gray-100"></div>

                  {/* Main content row */}
                  <div className="flex items-start space-x-4">
                    {/* Circle icon skeleton */}
                    <div className="w-12 h-12 rounded-full bg-gray-200 shrink-0"></div>
                    {/* Content lines skeleton */}
                    <div className="flex-1 space-y-2.5 pt-0.5">
                      <div className="h-4 bg-gray-200 rounded-full w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded-full w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded-full w-2/3"></div>
                      <div className="flex gap-2 pt-1">
                        <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
                        <div className="h-5 w-20 bg-gray-200 rounded-full"></div>
                        <div className="h-5 w-14 bg-gray-200 rounded-full"></div>
                      </div>
                    </div>
                    {/* Action button skeleton */}
                    <div className="hidden sm:block h-10 w-28 bg-gray-200 rounded-xl shrink-0 self-center"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : jobVacancies.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200 font-medium">
              No positions available at the moment. Please check back later.
            </div>
          ) : (
            jobVacancies.map((job) => (
              <div key={job.id} className="relative flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border border-gray-200 rounded-2xl hover:shadow-lg hover:border-[#800000]/30 transition-all bg-white group">
                <div className="mb-3 sm:mb-0 w-full sm:w-auto flex-1 min-w-0">
                  <div className="pr-24 sm:pr-0">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3">
                      <h4 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-[#800000] transition-colors">{job.post}</h4>
                      {job.status === 'Completed' ? (
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-slate-100 text-slate-500 w-fit">
                          Closed
                        </span>
                      ) : (
                        <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe] w-fit">
                          {job.applicantCount || 0} {(job.applicantCount || 0) === 1 ? 'person applied' : 'people applied'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 sm:mt-2 text-xs sm:text-sm text-gray-500 font-medium">
                      <span className="flex items-center"><Briefcase size={14} className="mr-1 text-gray-400" /> {job.experience + ' Experience' || 'Fresher'}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                      <span>{job.number_of_posts || 1} Post</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                      <span>Posted: {new Date(job.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  {job.skill_required && (
                    <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible gap-1.5 sm:gap-2 mt-2.5 sm:mt-3 pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {job.skill_required.split(',').map((skill, index) => (
                        <span key={index} className="whitespace-nowrap flex-shrink-0 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-green-50 text-green-700 text-[11px] sm:text-xs font-semibold rounded-full border border-green-200">
                          {skill.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  disabled={job.status === 'Completed'}
                  onClick={() => {
                    setSelectedJob(job);
                    setCurrentStep(1);
                    setSelectedSkills({});
                  }}
                  className={`absolute top-4 right-4 sm:static flex-shrink-0 flex items-center justify-center text-xs sm:text-sm font-bold text-white px-3 py-1.5 sm:px-6 sm:py-2.5 rounded-lg sm:rounded-xl transition-all shadow-md ${job.status === 'Completed'
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-[#800000] hover:bg-[#600000] hover:shadow-lg'
                    }`}
                >
                  <span className="hidden sm:inline">{job.status === 'Completed' ? 'Position Closed' : 'Apply Now'}</span>
                  <span className="sm:hidden">{job.status === 'Completed' ? 'Closed' : 'Apply'}</span>
                  {job.status !== 'Completed' && <ChevronRight className="ml-1 w-3 h-3 sm:w-4 sm:h-4" />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderLoginContent = () => (
    <div className="max-w-[420px] mx-auto space-y-6 animate-fade-in-up py-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Official Sarthak TMT Secured Portal</span>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Employee Login</h2>
        <p className="text-sm text-gray-500 font-medium">Enter your credentials to access your account.</p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="username" className="block text-sm font-bold text-gray-700">Username</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400 group-focus-within:text-[#800000] transition-colors" />
            </div>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] transition-all text-sm bg-gray-50 hover:bg-gray-50/50 focus:bg-white font-medium"
              placeholder="Enter your username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-bold text-gray-700">Password</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#800000] transition-colors" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full pl-11 pr-12 py-3.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] transition-all text-sm bg-gray-50 hover:bg-gray-50/50 focus:bg-white font-medium"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-[#800000] transition-colors focus:outline-none"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className={`w-full flex justify-center py-3 px-4 rounded-xl shadow-lg shadow-[#800000]/20 text-sm font-bold text-white bg-[#800000] hover:bg-[#600000] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#800000] transition-all duration-200 transform hover:-translate-y-0.5 ${submitting ? 'opacity-70 cursor-not-allowed hover:bg-[#800000] hover:translate-y-0' : ''
              }`}
          >
            {submitting ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="animate-spin h-4 w-4" />
                <span>Logging in...</span>
              </div>
            ) : (
              'Login to Portal'
            )}
          </button>

          <div className="text-center">
            <p className="text-sm sm:text-base text-gray-600 font-medium">
              New User?{' '}
              <Link
                to="/joining-form"
                className="text-[#800000] font-bold hover:text-[#600000] hover:underline transition-all"
              >
                Join here
              </Link>
            </p>
          </div>
        </div>
      </form>

      {/* Security & Access Notice */}
      {/* <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
        <Shield className="w-4 h-4 text-[#800000] shrink-0" />
        <span>256-Bit SSL Encrypted • Authorized Sarthak TMT Personnel Only</span>
      </div> */}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="bg-[#800000] text-white px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <img src={loginImage} alt="Sarthak TMT Logo" className="h-10 sm:h-14 w-auto object-contain bg-white p-1 sm:p-1.5 rounded-md" />
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Link
            to="/home"
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'home' ? 'bg-white text-[#800000] shadow-md' : 'text-white/90 hover:bg-white/10 hover:text-white'}`}
          >
            About
          </Link>
          <Link
            to="/career"
            className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center ${activeTab === 'career' ? 'bg-white text-[#800000] shadow-md' : 'text-white/90 hover:bg-white/10 hover:text-white'}`}
          >
            Career
            {activeTab !== 'career' && (
              <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-[#800000]"></span>
              </span>
            )}
          </Link>
          <Link
            to="/login"
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'login' ? 'bg-white text-[#800000] shadow-md' : 'text-white/90 hover:bg-white/10 hover:text-white'}`}
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Hero Banner */}
      <div className="relative h-[35vh] sm:h-[45vh] min-h-[300px] sm:min-h-[350px] w-full flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-[center_25%] bg-no-repeat"
          style={{ backgroundImage: 'url("/login-bg.jpg")' }}
        />
        <div className="absolute inset-0 bg-[#800000]/70 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />

        <div className="relative z-10 text-center px-4 animate-fade-in-up transform sm:-translate-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-white/90 text-xs font-semibold mb-3 border border-white/20">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Sarthak TMT</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight drop-shadow-sm mb-4">
            HR Portal
          </h1>
          <p className="text-lg sm:text-xl text-white/90 font-medium max-w-2xl sm:max-w-5xl mx-auto drop-shadow-md">
            Grow your career with us through seamless access to resources, careers, and support.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-24 relative z-20 pb-16">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-6 sm:p-10 lg:p-12 flex-1">
            {activeTab === 'home' && renderHomeContent()}
            {activeTab === 'career' && renderCareerContent()}
            {activeTab === 'login' && renderLoginContent()}
          </div>
        </div>
      </div>

      {/* Corporate Trust & Legal Footer */}
      <footer className="bg-gray-900 text-gray-400 text-xs py-8 px-4 sm:px-8 border-t border-gray-800 mt-auto z-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-sm mb-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>Sarthak TMT / SKA Ispat</span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Official Human Resource Management System portal. Providing secure employee authentication, attendance tracking, leave requests, and career applications.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Corporate HR Support</h4>
            <p className="text-gray-400">Email: <a href="mailto:hr@skaispat.in" className="text-gray-300 hover:text-white underline">hr@skaispat.in</a></p>
            <p className="text-gray-400 mt-1">Phone: <a href="tel:+919109164455" className="text-gray-300 hover:text-white underline">+91 9109164455</a></p>
            <p className="text-gray-400 mt-1">Plot No. 1,2,3,11,12 CSIDC Growth Centre, Industrial Area Siltara Phase-2, Raipur (CG) 493221</p>
          </div>
          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Portal Security & Compliance</h4>
            <div className="flex flex-col space-y-2">
              <button onClick={() => setShowPrivacyModal(true)} className="text-left text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" /> Privacy Policy & Data Protection
              </button>
              <button onClick={() => setShowTermsModal(true)} className="text-left text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" /> Terms of Portal Usage
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-6 pt-4 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-500">
          <p>© {new Date().getFullYear()} Sarthak TMT. All rights reserved.</p>
          {/* <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>256-Bit SSL Encrypted • Verified Domain (hr.sarthaktmt.com)</span>
          </div> */}
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative animate-fade-in-up">
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4 border-b pb-3">
              <ShieldCheck className="w-6 h-6 text-[#800000]" />
              <h3 className="text-xl font-bold text-gray-900">Privacy Policy & Data Protection</h3>
            </div>
            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <p><strong>1. Introduction</strong><br />This Privacy Policy outlines how Sarthak TMT ollects, processes, and protects employee and candidate data on the HRMS portal (hr.sarthaktmt.com).</p>
              <p><strong>2. Information Collection</strong><br />We collect personal details necessary for human resource management, including employment records, attendance timestamps, leave applications, contact information, and resume files submitted by candidates.</p>
              <p><strong>3. Data Security & Encryption</strong><br />All transmitted data is encrypted using 256-Bit SSL/TLS standards. Access to credentials and personal records is strictly limited to authorized personnel.</p>
              <p><strong>4. Third-Party Sharing</strong><br />We do not sell, rent, or trade employee or candidate data to third parties. Data is only processed internally for official company administrative procedures.</p>
              <p><strong>5. Contact Information</strong><br />For data protection inquiries, contact HR administration at <strong>hr@skaispat.in</strong> or call <strong>+91 9109164455</strong>.</p>
            </div>
            <div className="mt-6 pt-4 border-t flex justify-end">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-5 py-2.5 bg-[#800000] text-white font-bold rounded-xl text-sm hover:bg-[#600000] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Portal Usage Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative animate-fade-in-up">
            <button
              onClick={() => setShowTermsModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4 border-b pb-3">
              <Building2 className="w-6 h-6 text-[#800000]" />
              <h3 className="text-xl font-bold text-gray-900">Terms of Portal Usage</h3>
            </div>
            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <p><strong>1. Authorized Access Only</strong><br />Access to this Human Resource Management System is restricted to active employees and authorized personnel of Sarthak TMT. Unauthorized access attempts are strictly prohibited.</p>
              <p><strong>2. Credential Protection</strong><br />Users are responsible for maintaining the confidentiality of their login credentials. Any suspicious activity should be reported immediately to HR support.</p>
              <p><strong>3. Official Records</strong><br />Attendance records, leave submissions, and employee logs generated in this system constitute official corporate records.</p>
              <p><strong>4. Corporate System Compliance</strong><br />Usage of this portal must comply with Sarthak TMT internal IT security policies and code of conduct.</p>
            </div>
            <div className="mt-6 pt-4 border-t flex justify-end">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-5 py-2.5 bg-[#800000] text-white font-bold rounded-xl text-sm hover:bg-[#600000] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

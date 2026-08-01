import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ApprovalForm = lazy(() => import('./pages/ApprovalForm'));
const JobVacancy = lazy(() => import('./pages/JobVacancy'));
const SocialSite = lazy(() => import('./pages/SocialSite'));
const JobApplications = lazy(() => import('./pages/JobApplications'));
const CallTracker = lazy(() => import('./pages/CallTracker'));
const AfterJoiningWork = lazy(() => import('./pages/AfterJoiningWork'));
const Leaving = lazy(() => import('./pages/Leaving'));
const AfterLeavingWork = lazy(() => import('./pages/AfterLeavingWork'));
const Employee = lazy(() => import('./pages/Employee'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const MyAttendance = lazy(() => import('./pages/MyAttendance'));
const LeaveRequest = lazy(() => import('./pages/LeaveRequest'));
const MySalary = lazy(() => import('./pages/MySalary'));
const CompanyCalendar = lazy(() => import('./pages/CompanyCalendar'));
const Attendance = lazy(() => import('./pages/Attendance'));
const LeaveManagement = lazy(() => import('./pages/LeaveManagement'));
const Attendancedaily = lazy(() => import('./pages/Attendancedaily'));
const Report = lazy(() => import('./pages/Report'));
const Payroll = lazy(() => import('./pages/Payroll'));
const MisReport = lazy(() => import('./pages/MisReport'));
const Joining = lazy(() => import('./pages/Joining'));
const GatePass = lazy(() => import('./pages/GatePass'));
const GatePassRequest = lazy(() => import('./pages/GatePassRequest'));
const GatePassApproval = lazy(() => import('./pages/gatepassApproval'));
const Settings = lazy(() => import('./pages/Settings'));
const TotalLeaveDetails = lazy(() => import('./pages/TotalLeaveDetails'));
const JoiningForm = lazy(() => import('./pages/JoiningForm'));
const Visitors = lazy(() => import('./pages/Visitors'));
const Birthday = lazy(() => import('./pages/Birthday'));
const EmployeeDetails = lazy(() => import('./pages/EmployeeDetails'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin"></div>
  </div>
);

function App() {
  return (
    <div className="gradient-bg min-h-screen">
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster position="top-right" containerStyle={{ zIndex: 99999 }} />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/user-login" element={<Login />} />
            <Route path="/login" element={<Navigate to="/user-login" replace />} />
            <Route path="/home" element={<Login />} />
            <Route path="/career" element={<Login />} />
            <Route path="/joining-form" element={<JoiningForm />} />
            <Route path="/joining-form/:id" element={<JoiningForm />} />
            {/* <Route path="/leave-approve/:approverId/:id" element={<ApprovalForm />} /> */}
            {/* <Route path="/gatepass-approve/:approverId/:id" element={<GatePassApproval />} /> */}

            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="job-vacancy" element={<JobVacancy />} />
              {/* <Route path="social-site" element={<SocialSite />} /> */}
              <Route path="job-applications" element={<JobApplications />} />
              <Route path="call-tracker" element={<CallTracker />} />
              <Route path='joining' element={<Joining />} />
              <Route path="after-joining-work" element={<AfterJoiningWork />} />
              <Route path="leaving" element={<Leaving />} />
              <Route path="after-leaving-work" element={<AfterLeavingWork />} />
              <Route path="employee" element={<Employee />} />
              <Route path="employee-details" element={<EmployeeDetails />} />
              <Route path="my-profile" element={<MyProfile />} />
              <Route path="my-attendance" element={<MyAttendance />} />
              <Route path="leave-request" element={<LeaveRequest />} />
              <Route path="my-salary" element={<MySalary />} />
              <Route path="company-calendar" element={<CompanyCalendar />} />
              <Route path="leave-management" element={<LeaveManagement />} />
              <Route path="gate-pass" element={<GatePass />} />
              <Route path="total-leave-details" element={<TotalLeaveDetails />} />
              <Route path="gate-pass-request" element={<GatePassRequest />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="attendancedaily" element={<Attendancedaily />} />
              <Route path="report" element={<Report />} />
              <Route path="payroll" element={<Payroll />} />
              <Route path="misreport" element={<MisReport />} />
              <Route path="settings" element={<Settings />} />
              <Route path="visitors" element={<Visitors />} />
              <Route path="birthday" element={<Birthday />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </div>
  );
}

export default App;
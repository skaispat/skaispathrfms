import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ApprovalForm from './pages/ApprovalForm';
import JobVacancy from './pages/JobVacancy';
import SocialSite from './pages/SocialSite';
import EmployeeEnquiry from './pages/EmployeeEnquiry';
import CallTracker from './pages/CallTracker';
import AfterJoiningWork from './pages/AfterJoiningWork';
import Leaving from './pages/Leaving';
import AfterLeavingWork from './pages/AfterLeavingWork';
import Employee from './pages/Employee';
import MyProfile from './pages/MyProfile';
import MyAttendance from './pages/MyAttendance';
import LeaveRequest from './pages/LeaveRequest';
import MySalary from './pages/MySalary';
import CompanyCalendar from './pages/CompanyCalendar';
import ProtectedRoute from './components/ProtectedRoute';
import Attendance from './pages/Attendance';
import LeaveManagement from './pages/LeaveManagement';
import Attendancedaily from './pages/Attendancedaily';
import Report from './pages/Report';
import Payroll from './pages/Payroll';
import MisReport from './pages/MisReport';
import Joining from './pages/Joining';
import GatePass from './pages/GatePass';
import GatePassRequest from './pages/GatePassRequest';
import GatePassApproval from './pages/gatepassApproval';
import Settings from './pages/Settings';


function App() {
  return (
    <div className="gradient-bg min-h-screen">
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
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
            <Route path="employee_enquiry" element={<EmployeeEnquiry />} />
            <Route path="call-tracker" element={<CallTracker />} />
            <Route path='joining' element={<Joining />} />
            <Route path="after-joining-work" element={<AfterJoiningWork />} />
            <Route path="leaving" element={<Leaving />} />
            <Route path="after-leaving-work" element={<AfterLeavingWork />} />
            <Route path="employee" element={<Employee />} />
            <Route path="my-profile" element={<MyProfile />} />
            <Route path="my-attendance" element={<MyAttendance />} />
            <Route path="leave-request" element={<LeaveRequest />} />
            <Route path="my-salary" element={<MySalary />} />
            <Route path="company-calendar" element={<CompanyCalendar />} />
            <Route path="leave-management" element={<LeaveManagement />} />
            <Route path="gate-pass" element={<GatePass />} />
            <Route path="gate-pass-request" element={<GatePassRequest />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="attendancedaily" element={<Attendancedaily />} />
            <Route path="report" element={<Report />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="misreport" element={<MisReport />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
import { supabase } from '../supabaseClient';

export const getAllEmployeesListForSearch = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('emp_id, full_name, username, phone_number, profile_picture, department, designation')
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const getComprehensiveEmployeeDetails = async (empIdOrTerm, fiscalYear) => {
  if (!empIdOrTerm) return null;

  const cleanTerm = String(empIdOrTerm).trim();

  // 1. Fetch User Record from `users`
  const { data: userByEmpId } = await supabase.from('users').select('*').eq('emp_id', cleanTerm).maybeSingle();

  let userRecord = userByEmpId;
  if (!userRecord) {
    const { data: userByUsername } = await supabase.from('users').select('*').eq('username', cleanTerm).maybeSingle();
    userRecord = userByUsername;
  }
  if (!userRecord) {
    const { data: usersByName } = await supabase.from('users').select('*').ilike('full_name', `%${cleanTerm}%`).limit(1);
    if (usersByName && usersByName.length > 0) {
      userRecord = usersByName[0];
    }
  }

  if (!userRecord) {
    throw new Error(`No employee found matching "${empIdOrTerm}"`);
  }

  const targetEmpId = userRecord.emp_id;
  const targetFullName = userRecord.full_name || userRecord.Name;

  // 2. Fetch HOD Information (Check team_members first, then userRecord.hod_id)
  let hodUser = null;
  const { data: teamData } = await supabase
    .from('team_members')
    .select('hod_id')
    .eq('emp_id', targetEmpId)
    .maybeSingle();

  const effectiveHodId = teamData?.hod_id || userRecord.hod_id;

  if (effectiveHodId) {
    const { data: hodData } = await supabase
      .from('users')
      .select('emp_id, full_name, department, designation, phone_number, profile_picture')
      .eq('emp_id', effectiveHodId)
      .maybeSingle();
    hodUser = hodData;
  }

  // 3. Fetch Supervised Team Members if employee is an HOD
  let teamMembersList = [];
  if (userRecord.is_hod) {
    const { data: membersRes } = await supabase
      .from('team_members')
      .select('emp_id')
      .eq('hod_id', targetEmpId);

    if (membersRes && membersRes.length > 0) {
      const memberEmpIds = membersRes.map(m => m.emp_id);
      const { data: membersData } = await supabase
        .from('users')
        .select('emp_id, full_name, department, designation, phone_number, profile_picture')
        .in('emp_id', memberEmpIds);
      teamMembersList = membersData || [];
    }
  }

  // 4. Parallel Database Queries for Leaves, GatePasses, Balances, Quota, Assets
  const [
    leavesRes,
    gatePassesRes,
    balanceRes,
    quotaRes,
    assetsRes
  ] = await Promise.all([
    // All Leave Records
    supabase.from('leave_management')
      .select('*')
      .or(`emp_id.eq.${targetEmpId},employee_name.eq.${targetFullName}`)
      .order('leave_date_start', { ascending: false }),

    // All Gate Pass Records
    supabase.from('gate_pass')
      .select('*')
      .or(`emp_id.eq.${targetEmpId},emp_name.eq.${targetFullName}`)
      .order('timestamp', { ascending: false }),

    // Leave Balances
    supabase.from('employee_leave_balances')
      .select('*')
      .eq('emp_id', targetEmpId)
      .maybeSingle(),

    // Yearly Quota
    fiscalYear
      ? supabase.from('yearly_quota')
          .select('*')
          .eq('emp_id', targetEmpId)
          .eq('year', fiscalYear)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Assets Issued
    supabase.from('assets')
      .select('*')
      .eq('employee_id', targetEmpId)
      .maybeSingle()
  ]);

  // 5. Fetch Biometric API Attendance from .env
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const firstDayStr = `${y}-${m}-01`;

  let todayPunchLogs = [];
  let monthPunchLogs = [];
  let biometricError = null;

  const biometricApiUrl = import.meta.env.VITE_BIOMETRIC_API_URL;
  if (biometricApiUrl) {
    try {
      const bioResponse = await fetch(`${biometricApiUrl}&FromDate=${firstDayStr}&ToDate=${todayStr}`);
      if (bioResponse.ok) {
        const bioData = await bioResponse.json();
        if (Array.isArray(bioData)) {
          monthPunchLogs = bioData.filter(log => String(log.UserId) === String(targetEmpId));
          todayPunchLogs = monthPunchLogs.filter(log => log.LogDate && log.LogDate.startsWith(todayStr));
        }
      }
    } catch (err) {
      console.warn('Biometric API fetch error:', err);
      biometricError = err.message;
    }
  }

  return {
    user: userRecord,
    hod: hodUser,
    teamMembers: teamMembersList,
    leaves: leavesRes.data || [],
    gatePasses: gatePassesRes.data || [],
    balances: balanceRes.data || null,
    quota: quotaRes.data || null,
    assets: assetsRes.data || null,
    attendance: {
      todayLogs: todayPunchLogs,
      monthLogs: monthPunchLogs,
      biometricError
    }
  };
};

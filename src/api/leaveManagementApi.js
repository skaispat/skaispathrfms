import { supabase } from '../supabaseClient';

export const getUsersForLeaveManagement = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('emp_id, full_name, role, is_hod, department, is_active');
  if (error) throw error;
  return data;
};

export const getLeaveBalancesForUser = async (userFullName, userEmpId, currentYear) => {
  const { data: balanceData, error: balanceError } = await supabase
    .from('leave_management')
    .select('leave_type, duration_days, status, start_half_day, end_half_day, leave_date_start, cf_el_used')
    .eq('employee_name', userFullName)
    .in('status', ['Approved', 'Pending', 'Pending HR', 'Pending HOD']);

  if (balanceError) console.error("Error fetching balance:", balanceError);

  let quotaData = null;
  if (userEmpId) {
    const { data } = await supabase
      .from('yearly_quota')
      .select('*')
      .eq('emp_id', userEmpId)
      .eq('year', currentYear)
      .maybeSingle();
    quotaData = data;
  }

  return { balanceData: balanceData || [], quotaData };
};

export const getHodAndHrDetailsForEmp = async (empId) => {
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('hod_id')
    .eq('emp_id', empId)
    .maybeSingle();

  let hodUser = null;
  if (teamMember?.hod_id) {
    const { data } = await supabase
      .from('users')
      .select('full_name, emp_id, phone_number, department')
      .eq('emp_id', teamMember.hod_id)
      .single();
    hodUser = data;
  }

  const { data: hrData } = await supabase
    .from('users')
    .select('full_name, emp_id, phone_number')
    .eq('department', 'HR')
    .order('is_hod', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { teamMember, hodUser, hrData };
};

export const fetchPaginatedLeavesWithEmployee = async ({
  user,
  isHr,
  isHod,
  activeTab,
  exportFromDate,
  exportToDate,
  searchTerm,
  pageParam,
  itemsPerPage = 10
}) => {
  let query = supabase
    .from("leave_management")
    .select(`
      *,
      employee:users!leave_management_emp_id_fkey(phone_number)
    `, { count: "exact" });

  if (isHr) {
  } else if (isHod) {
    query = query.or(`hod_id.eq.${user.emp_id},emp_id.eq.${user.emp_id}`);
  } else {
    query = query.eq("emp_id", user.emp_id);
  }

  if (activeTab === "pending") {
    query = query.in("status", ["Pending", "Pending HOD", "Pending HR"]);
  } else if (activeTab === "approved") {
    query = query.ilike("status", "%Approved%");
    if (exportFromDate && exportToDate) {
      query = query.gte("leave_date_start", exportFromDate).lte("leave_date_start", exportToDate);
    }
  } else if (activeTab === "rejected") {
    query = query.ilike("status", "%Reject%");
  }

  if (searchTerm) {
    query = query.or(`employee_name.ilike.%${searchTerm}%,emp_id.ilike.%${searchTerm}%`);
  }

  const from = pageParam * itemsPerPage;
  const to = from + itemsPerPage - 1;

  const { data, error } = await query
    .order("timestamp", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return data;
};

export const fetchCountWithQuery = async (queryFn) => {
  let q = supabase.from("leave_management").select("*", { count: "exact", head: true });
  q = queryFn(q);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
};

export const getExportLeaveRecords = async (queryFilters) => {
  let query = supabase.from("leave_management").select("*");
  if (queryFilters?.status) query = query.eq("status", queryFilters.status);
  if (queryFilters?.startDate) query = query.gte("leave_date_start", queryFilters.startDate);
  if (queryFilters?.endDate) query = query.lte("leave_date_end", queryFilters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const checkExistingLeaveConflict = async (empId, empName, startDate, endDate) => {
  const { data, error } = await supabase
    .from('leave_management')
    .select('id, leave_date_start, leave_date_end, status')
    .or(`employee_id.eq.${empId},employee_name.eq.${empName}`)
    .in('status', ['Pending', 'Pending HOD', 'Pending HR', 'Approved'])
    .lte('leave_date_start', endDate)
    .gte('leave_date_end', startDate);

  if (error) console.error("Error checking leave overlap:", error);
  return data || [];
};

export const insertLeaveRequestRecord = async (insertData, logPayload) => {
  const { data, error } = await supabase
    .from('leave_management')
    .insert([insertData])
    .select();

  if (error) throw error;

  if (data && data[0]) {
    await supabase.from('logs').insert({
      ...logPayload,
      request_id: data[0].id
    });
  }

  return data;
};

export const updateLeaveStatusAndLogs = async (id, updatePayload, logPayload) => {
  const { error: updateError } = await supabase
    .from("leave_management")
    .update(updatePayload)
    .eq("id", id);

  if (updateError) throw updateError;

  if (logPayload) {
    await supabase
      .from("logs")
      .update(logPayload)
      .eq("request_id", id)
      .eq("request_type", "Leave");
  }
};

export const updateYearlyQuotaRecord = async (id, updatePayload) => {
  const { data, error } = await supabase
    .from("yearly_quota")
    .update(updatePayload)
    .eq("id", id);

  if (error) throw error;
  return data;
};

export const insertYearlyQuotaRecord = async (insertPayload) => {
  const { data, error } = await supabase
    .from("yearly_quota")
    .insert(insertPayload);

  if (error) throw error;
  return data;
};

export const fetchSingleLeaveRecord = async (id) => {
  const { data, error } = await supabase
    .from("leave_management")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
};

export const updateLeaveCfUsed = async (id, cfUsed) => {
  const { data, error } = await supabase
    .from("leave_management")
    .update({ cf_el_used: cfUsed })
    .eq("id", id);

  if (error) throw error;
  return data;
};

export const getYearlyQuotaForEmp = async (employeeId, currentYear) => {
  const { data: q } = await supabase
    .from("yearly_quota")
    .select("*")
    .eq("emp_id", employeeId)
    .eq("year", currentYear)
    .maybeSingle();

  return q;
};

export const getYearlyQuotasForEmpIds = async (empIds, currentYear) => {
  const { data, error } = await supabase
    .from("yearly_quota")
    .select("*")
    .in("emp_id", empIds)
    .eq("year", currentYear);

  if (error) throw error;
  return data;
};

export const updateLeaveManagementRecord = async (id, updateData) => {
  const { data, error } = await supabase
    .from("leave_management")
    .update(updateData)
    .eq("id", id);

  if (error) throw error;
  return data;
};

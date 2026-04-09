
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ulgviqruyccrjncetqsv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ3ZpcXJ1eWNjcmpuY2V0cXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjkxMjQsImV4cCI6MjA4MTA0NTEyNH0.u-6m0NuJwo0e5ezN9bi_kpnSVHXQcQrHW_ISdNfoHEE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('leave_management')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching leave_management:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in leave_management:', Object.keys(data[0]));
  } else {
    console.log('No data in leave_management');
  }

  const { data: quotaData, error: quotaError } = await supabase
    .from('yearly_quota')
    .select('*')
    .limit(1);

  if (quotaError) {
    console.error('Error fetching yearly_quota:', quotaError);
  } else if (quotaData && quotaData.length > 0) {
    console.log('Columns in yearly_quota:', Object.keys(quotaData[0]));
  } else {
    console.log('No data in yearly_quota');
  }
}

checkColumns();

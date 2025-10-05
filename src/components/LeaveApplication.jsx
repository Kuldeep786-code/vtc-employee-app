import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function LeaveApplication() {
  const [leaveForm, setLeaveForm] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    leave_type: 'casual',
    document: null
  });
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [availableLeaves, setAvailableLeaves] = useState(0);

  useEffect(() => {
    fetchLeaveBalance();
  }, []);

  const fetchLeaveBalance = async () => {
    const { data } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', (await supabase.auth.getUser()).data.user.id)
      .single();
    setLeaveBalance(data);
  };

  const calculateAvailableLeaves = () => {
    if (!leaveBalance) return 0;
    return leaveBalance[`${leaveForm.leave_type}_leaves`] || 0;
  };

  const handleFileUpload = async (file) => {
    const fileName = `leave-docs/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from('employee-documents')
      .upload(fileName, file);
    
    if (error) throw error;
    return supabase.storage.from('employee-documents').getPublicUrl(fileName).data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (calculateAvailableLeaves() <= 0) {
      alert('Insufficient leave balance!');
      return;
    }

    let documentUrl = '';
    if (leaveForm.document) {
      documentUrl = await handleFileUpload(leaveForm.document);
    }

    const { error } = await supabase.from('leaves').insert({
      employee_id: (await supabase.auth.getUser()).data.user.id,
      ...leaveForm,
      document_url: documentUrl
    });

    if (error) alert('Error: ' + error.message);
    else {
      alert('Leave application submitted successfully!');
      setLeaveForm({ start_date: '', end_date: '', reason: '', leave_type: 'casual', document: null });
    }
  };

  const getLeaveDays = () => {
    if (!leaveForm.start_date || !leaveForm.end_date) return 0;
    const start = new Date(leaveForm.start_date);
    const end = new Date(leaveForm.end_date);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h2>Apply for Leave</h2>
      
      {leaveBalance && (
        <div style={{ background: '#f0f8ff', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
          <h4>Your Leave Balance</h4>
          <p>Casual: {leaveBalance.casual_leaves} | Sick: {leaveBalance.sick_leaves} | 
             Earned: {leaveBalance.earned_leaves} | Compensatory: {leaveBalance.compensatory_leaves}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Leave Type:</label>
          <select 
            value={leaveForm.leave_type}
            onChange={e => setLeaveForm({...leaveForm, leave_type: e.target.value})}
            style={{ width: '100%', padding: '8px' }}
          >
            <option value="casual">Casual Leave</option>
            <option value="sick">Sick Leave</option>
            <option value="earned">Earned Leave</option>
            <option value="compensatory">Compensatory Leave</option>
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Start Date:</label>
          <input 
            type="date"
            value={leaveForm.start_date}
            onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>End Date:</label>
          <input 
            type="date"
            value={leaveForm.end_date}
            onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        {leaveForm.start_date && leaveForm.end_date && (
          <div style={{ marginBottom: '15px', color: '#666' }}>
            Total Days: {getLeaveDays()} | Available: {calculateAvailableLeaves()}
          </div>
        )}

        <div style={{ marginBottom: '15px' }}>
          <label>Reason:</label>
          <textarea 
            value={leaveForm.reason}
            onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
            required
            rows="4"
            style={{ width: '100%', padding: '8px' }}
            placeholder="Please provide detailed reason for leave..."
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Supporting Document (Optional):</label>
          <input 
            type="file"
            onChange={e => setLeaveForm({...leaveForm, document: e.target.files[0]})}
            style={{ width: '100%', padding: '8px' }}
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>

        <button 
          type="submit"
          disabled={calculateAvailableLeaves() <= 0}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: calculateAvailableLeaves() <= 0 ? '#ccc' : '#007bff', 
            color: 'white', 
            border: 'none',
            borderRadius: '5px'
          }}
        >
          {calculateAvailableLeaves() <= 0 ? 'Insufficient Leave Balance' : 'Apply for Leave'}
        </button>
      </form>
    </div>
  );
}
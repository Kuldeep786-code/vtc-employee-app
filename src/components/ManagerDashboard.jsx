import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ManagerDashboard() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [activeTab, setActiveTab] = useState('attendance');

  useEffect(() => {
    if (activeTab === 'attendance') fetchPendingRequests();
    if (activeTab === 'leaves') fetchPendingLeaves();
    fetchTeamMembers();
  }, [activeTab]);

  const fetchPendingLeaves = async () => {
    const { data } = await supabase
      .from('leaves')
      .select(`
        *,
        employees (full_name, email)
      `)
      .eq('status', 'pending');
    setPendingLeaves(data || []);
  };

  const handleLeaveApproval = async (id, status) => {
    const { error } = await supabase
      .from('leaves')
      .update({ 
        status,
        approved_by: (await supabase.auth.getUser()).data.user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) alert('Error: ' + error.message);
    else fetchPendingLeaves();
  };

  // ... (previous manager functions remain same)

  return (
    <div style={{ padding: '20px' }}>
      <h1>Manager Dashboard</h1>
      
      {/* Navigation Tabs */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('attendance')}>Attendance Approvals</button>
        <button onClick={() => setActiveTab('leaves')}>Leave Approvals</button>
        <button onClick={() => setActiveTab('team')}>Team Management</button>
        <button onClick={() => supabase.auth.signOut()}>Logout</button>
      </div>

      {/* Attendance Approvals Tab */}
      {activeTab === 'attendance' && (
        <div>
          <h2>Pending Attendance Approvals ({pendingRequests.length})</h2>
          {pendingRequests.map(request => (
            <div key={request.id} style={{border: '1px solid #ccc', padding: '10px', margin: '10px 0'}}>
              <strong>{request.employees.full_name}</strong> - 
              {new Date(request.signin_time).toLocaleString()} - 
              Status: {request.status}
              <div style={{ marginTop: '10px' }}>
                <button onClick={() => handleApproval(request.id, 'approved')}>Approve</button>
                <button onClick={() => handleApproval(request.id, 'rejected')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leave Approvals Tab */}
      {activeTab === 'leaves' && (
        <div>
          <h2>Pending Leave Approvals ({pendingLeaves.length})</h2>
          {pendingLeaves.map(leave => (
            <div key={leave.id} style={{border: '1px solid #ccc', padding: '15px', margin: '10px 0'}}>
              <strong>{leave.employees.full_name}</strong> - {leave.employees.email}
              <div><strong>Dates:</strong> {leave.start_date} to {leave.end_date}</div>
              <div><strong>Type:</strong> {leave.leave_type}</div>
              <div><strong>Reason:</strong> {leave.reason}</div>
              {leave.document_url && (
                <div>
                  <strong>Document:</strong> 
                  <a href={leave.document_url} target="_blank" rel="noopener noreferrer">
                    View Document
                  </a>
                </div>
              )}
              <div style={{ marginTop: '10px' }}>
                <button onClick={() => handleLeaveApproval(leave.id, 'approved')}>Approve</button>
                <button onClick={() => handleLeaveApproval(leave.id, 'rejected')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Management Tab */}
      {activeTab === 'team' && (
        <div>
          <h2>Team Members ({teamMembers.length})</h2>
          {teamMembers.map(member => (
            <div key={member.id} style={{padding: '10px', border: '1px solid #eee', margin: '5px 0'}}>
              {member.full_name} - {member.email} - {member.role}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
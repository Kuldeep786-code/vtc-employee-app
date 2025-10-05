import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import LeaveApplication from './LeaveApplication';
// import HolidayCalendar from './HolidayCalendar'; // Temporary comment out

export default function EmployeeDashboard() {
  const [attendance, setAttendance] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [location, setLocation] = useState(null);
  const [activeTab, setActiveTab] = useState('attendance');
  const [myLeaves, setMyLeaves] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchAttendance();
    fetchMyLeaves();
    fetchLeaveBalance();
    getCurrentLocation();
  }, []);

  // Camera functions for face recognition
  const startCamera = async () => {
    try {
      setShowCamera(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } // Front camera only
      });
      streamRef.current = mediaStream;
      videoRef.current.srcObject = mediaStream;
    } catch (error) {
      alert('Camera access denied. Please allow camera access for face verification.');
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      setShowCamera(false);
      setCapturedImage(null);
    }
  };

  const captureSelfie = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL('image/png');
    setCapturedImage(imageDataUrl);
    stopCamera();
  };

  const uploadSelfie = async (imageDataUrl) => {
    try {
      // Convert data URL to blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      
      const fileName = `attendance-selfies/${(await supabase.auth.getUser()).data.user.id}/${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('employee-selfies')
        .upload(fileName, blob);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('employee-selfies')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading selfie:', error);
      throw error;
    }
  };

  // Compensatory Leave Function
  const addCompensatoryLeave = async (date) => {
    try {
      const { data: isHoliday } = await supabase
        .from('holidays')
        .select('id')
        .eq('date', date)
        .single();

      if (isHoliday) {
        console.log('Holiday detected, adding compensatory leave...');
        
        const { data: currentBalance } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('employee_id', (await supabase.auth.getUser()).data.user.id)
          .single();

        const newBalance = (currentBalance?.compensatory_leaves || 0) + 1;
        
        const { error } = await supabase
          .from('leave_balances')
          .upsert({
            employee_id: (await supabase.auth.getUser()).data.user.id,
            compensatory_leaves: newBalance,
            casual_leaves: currentBalance?.casual_leaves || 12,
            sick_leaves: currentBalance?.sick_leaves || 10,
            earned_leaves: currentBalance?.earned_leaves || 15,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'employee_id',
            ignoreDuplicates: false 
          });

        if (!error) {
          console.log('Compensatory leave added! New balance:', newBalance);
          fetchLeaveBalance();
        }
      }
    } catch (error) {
      console.log('No holiday today or already processed');
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      error => {
        console.error('Location error:', error);
        alert('Error getting location. Please allow location access.');
      }
    );
  };

  const fetchAttendance = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { data } = await supabase
        .from('attendance')
        .select(`
          *,
          employees (full_name)
        `)
        .eq('employee_id', user.id)
        .order('signin_time', { ascending: false })
        .limit(30);
      
      setAttendance(data || []);
      
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = data?.find(record => 
        record.signin_time.includes(today)
      );
      setTodayAttendance(todayRecord);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const fetchMyLeaves = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { data } = await supabase
        .from('leaves')
        .select('*')
        .eq('employee_id', user.id)
        .order('applied_at', { ascending: false });
      setMyLeaves(data || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { data } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', user.id)
        .single();
      setLeaveBalance(data);
    } catch (error) {
      console.log('Leave balance not found, will be created on first holiday');
    }
  };

  const handleSignIn = async () => {
    if (!capturedImage) {
      alert('Please capture your selfie first for face verification');
      return;
    }

    getCurrentLocation();
    
    setTimeout(async () => {
      if (!location) {
        alert('Please allow location access to sign in');
        return;
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        const user = (await supabase.auth.getUser()).data.user;
        
        // Upload selfie first
        const selfieUrl = await uploadSelfie(capturedImage);
        
        // Check if today is holiday and add compensatory leave
        await addCompensatoryLeave(today);

        // Create attendance record with selfie
        const { error } = await supabase.from('attendance').insert({
          employee_id: user.id,
          signin_location: `POINT(${location.lng} ${location.lat})`,
          signin_selfie_url: selfieUrl,
          status: 'pending',
          signin_time: new Date().toISOString()
        });

        if (error) {
          alert('Error signing in: ' + error.message);
        } else {
          alert('✅ Sign in successful! Selfie captured and waiting for manager approval.');
          setCapturedImage(null);
          fetchAttendance();
        }
      } catch (error) {
        alert('Error during sign in: ' + error.message);
      }
    }, 1000);
  };

  const handleSignOut = async () => {
    if (!todayAttendance) {
      alert('No active sign-in found for today');
      return;
    }

    getCurrentLocation();
    
    setTimeout(async () => {
      if (!location) {
        alert('Please allow location access to sign out');
        return;
      }

      try {
        const { error } = await supabase
          .from('attendance')
          .update({ 
            signout_time: new Date().toISOString(),
            signout_location: `POINT(${location.lng} ${location.lat})`
          })
          .eq('id', todayAttendance.id);

        if (error) {
          alert('Error signing out: ' + error.message);
        } else {
          alert('✅ Sign out successful!');
          fetchAttendance();
        }
      } catch (error) {
        alert('Error during sign out: ' + error.message);
      }
    }, 1000);
  };

  // Temporary Holiday Calendar Component
  const HolidayCalendar = () => {
    return (
      <div style={{ padding: '20px', background: 'white', borderRadius: '10px' }}>
        <h2>🎉 Holiday Calendar</h2>
        <p>Holiday calendar feature will be available soon.</p>
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          <p>📅 Holiday calendar is under development</p>
          <p>This feature will show all company holidays and allow admin to manage them.</p>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Employee Dashboard</h1>
        <button 
          onClick={() => supabase.auth.signOut()}
          style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Logout
        </button>
      </div>

      {/* Leave Balance Display */}
      {leaveBalance && (
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          color: 'white', 
          padding: '20px', 
          borderRadius: '10px', 
          marginBottom: '20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3>📊 Your Leave Balance</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div><strong>Casual:</strong> {leaveBalance.casual_leaves} days</div>
            <div><strong>Sick:</strong> {leaveBalance.sick_leaves} days</div>
            <div><strong>Earned:</strong> {leaveBalance.earned_leaves} days</div>
            <div><strong>Compensatory:</strong> {leaveBalance.compensatory_leaves} days</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('attendance')}
          style={{ 
            padding: '12px 20px', 
            background: activeTab === 'attendance' ? '#007bff' : '#f8f9fa', 
            color: activeTab === 'attendance' ? 'white' : 'black',
            border: '1px solid #ddd',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          📅 Attendance
        </button>
        <button 
          onClick={() => setActiveTab('leave')}
          style={{ 
            padding: '12px 20px', 
            background: activeTab === 'leave' ? '#007bff' : '#f8f9fa', 
            color: activeTab === 'leave' ? 'white' : 'black',
            border: '1px solid #ddd',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          📝 Apply Leave
        </button>
        <button 
          onClick={() => setActiveTab('holidays')}
          style={{ 
            padding: '12px 20px', 
            background: activeTab === 'holidays' ? '#007bff' : '#f8f9fa', 
            color: activeTab === 'holidays' ? 'white' : 'black',
            border: '1px solid #ddd',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🎉 Holiday Calendar
        </button>
        <button 
          onClick={() => setActiveTab('myleaves')}
          style={{ 
            padding: '12px 20px', 
            background: activeTab === 'myleaves' ? '#007bff' : '#f8f9fa', 
            color: activeTab === 'myleaves' ? 'white' : 'black',
            border: '1px solid #ddd',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          📋 My Leaves ({myLeaves.length})
        </button>
      </div>

      {/* Attendance Tab with Face Recognition */}
      {activeTab === 'attendance' && (
        <div>
          {/* Selfie Capture Section */}
          <div style={{ 
            background: '#f8f9fa', 
            padding: '20px', 
            borderRadius: '10px', 
            marginBottom: '20px',
            border: '1px solid #e9ecef'
          }}>
            <h3>📸 Face Verification Required</h3>
            
            {!showCamera && !capturedImage && (
              <div>
                <p>Please capture your selfie for attendance verification</p>
                <button 
                  onClick={startCamera}
                  style={{
                    padding: '12px 30px',
                    background: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '16px',
                    cursor: 'pointer'
                  }}
                >
                  📷 Open Camera
                </button>
              </div>
            )}

            {showCamera && (
              <div>
                <p>Please position your face in the camera</p>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  style={{ width: '100%', maxWidth: '400px', border: '2px solid #007bff', borderRadius: '10px' }}
                />
                <div style={{ marginTop: '10px' }}>
                  <button 
                    onClick={captureSelfie}
                    style={{
                      padding: '10px 20px',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      marginRight: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    📸 Capture Selfie
                  </button>
                  <button 
                    onClick={stopCamera}
                    style={{
                      padding: '10px 20px',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
            )}

            {capturedImage && (
              <div>
                <p>✅ Selfie captured successfully!</p>
                <img 
                  src={capturedImage} 
                  alt="Captured selfie" 
                  style={{ width: '200px', border: '2px solid #28a745', borderRadius: '10px' }}
                />
                <div style={{ marginTop: '10px' }}>
                  <button 
                    onClick={() => setCapturedImage(null)}
                    style={{
                      padding: '10px 20px',
                      background: '#ffc107',
                      color: 'black',
                      border: 'none',
                      borderRadius: '5px',
                      marginRight: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Retake Photo
                  </button>
                </div>
              </div>
            )}
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {/* Attendance Status Section */}
          <div style={{ 
            background: '#f8f9fa', 
            padding: '20px', 
            borderRadius: '10px', 
            marginBottom: '20px',
            border: '1px solid #e9ecef'
          }}>
            <h3>Today's Attendance Status</h3>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 'bold',
              color: todayAttendance ? 
                (todayAttendance.signout_time ? '#28a745' : '#ffc107') : '#dc3545'
            }}>
              {todayAttendance ? 
                (todayAttendance.signout_time ? '✅ Signed Out' : '🟡 Signed In - ' + todayAttendance.status) 
                : '❌ Not Signed In'}
            </div>
            
            <div style={{ marginTop: '15px' }}>
              {!todayAttendance ? (
                <button 
                  onClick={handleSignIn} 
                  disabled={!capturedImage}
                  style={{
                    padding: '12px 30px',
                    background: capturedImage ? '#28a745' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '16px',
                    cursor: capturedImage ? 'pointer' : 'not-allowed'
                  }}
                >
                  {capturedImage ? '📍 Sign In with Selfie' : 'Please Capture Selfie First'}
                </button>
              ) : !todayAttendance.signout_time ? (
                <button 
                  onClick={handleSignOut} 
                  style={{
                    padding: '12px 30px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '16px',
                    cursor: 'pointer'
                  }}
                >
                  🏠 Sign Out
                </button>
              ) : null}
            </div>
          </div>

          {/* Recent Attendance Records */}
          <h3>Recent Attendance Records ({attendance.length})</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {attendance.map(record => (
              <div key={record.id} style={{
                border: '1px solid #ddd',
                padding: '15px',
                borderRadius: '5px',
                background: record.status === 'approved' ? '#f0fff0' : 
                           record.status === 'rejected' ? '#fff0f0' : '#fffaf0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Date:</strong> {new Date(record.signin_time).toLocaleDateString('en-IN')}
                    <br />
                    <strong>Time:</strong> {new Date(record.signin_time).toLocaleTimeString('en-IN')}
                    {record.signout_time && ` to ${new Date(record.signout_time).toLocaleTimeString('en-IN')}`}
                  </div>
                  <div>
                    <strong>Status:</strong> 
                    <span style={{
                      color: record.status === 'approved' ? 'green' : 
                             record.status === 'rejected' ? 'red' : 'orange',
                      fontWeight: 'bold',
                      marginLeft: '10px'
                    }}>
                      {record.status?.toUpperCase()}
                    </span>
                  </div>
                </div>
                {record.signin_selfie_url && (
                  <div style={{ marginTop: '10px' }}>
                    <strong>Selfie:</strong>{' '}
                    <a href={record.signin_selfie_url} target="_blank" rel="noopener noreferrer">
                      👤 View Selfie
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Tabs */}
      {activeTab === 'leave' && <LeaveApplication />}
      {activeTab === 'holidays' && <HolidayCalendar />}
      {activeTab === 'myleaves' && (
        <div>
          <h2>My Leave Applications</h2>
          {myLeaves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              No leave applications found
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {myLeaves.map(leave => (
                <div key={leave.id} style={{
                  border: '1px solid #ddd',
                  padding: '20px',
                  borderRadius: '8px',
                  background: leave.status === 'approved' ? '#f0fff0' : 
                             leave.status === 'rejected' ? '#fff0f0' : '#fffaf0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                        {leave.start_date} to {leave.end_date}
                      </div>
                      <div><strong>Type:</strong> {leave.leave_type}</div>
                      <div><strong>Reason:</strong> {leave.reason}</div>
                    </div>
                    <div style={{
                      padding: '5px 15px',
                      background: leave.status === 'approved' ? '#28a745' : 
                                 leave.status === 'rejected' ? '#dc3545' : '#ffc107',
                      color: 'white',
                      borderRadius: '20px',
                      fontWeight: 'bold'
                    }}>
                      {leave.status?.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
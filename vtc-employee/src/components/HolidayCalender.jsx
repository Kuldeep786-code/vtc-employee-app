import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function HolidayCalendar() {
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', description: '' });

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    const { data } = await supabase
      .from('holidays')
      .select('*')
      .order('date');
    setHolidays(data || []);
  };

  const addHoliday = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('holidays').insert([newHoliday]);
    if (error) alert('Error: ' + error.message);
    else {
      setNewHoliday({ date: '', name: '', description: '' });
      fetchHolidays();
    }
  };

  const deleteHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else fetchHolidays();
  };

  const isHoliday = (date) => {
    return holidays.some(holiday => holiday.date === date);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Holiday Calendar</h2>
      
      {/* Add Holiday Form (for Admin) */}
      <div style={{ marginBottom: '30px', padding: '20px', background: '#f5f5f5', borderRadius: '5px' }}>
        <h3>Add New Holiday</h3>
        <form onSubmit={addHoliday}>
          <input
            type="date"
            value={newHoliday.date}
            onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
            placeholder="Date"
            required
            style={{ marginRight: '10px', padding: '8px' }}
          />
          <input
            type="text"
            value={newHoliday.name}
            onChange={e => setNewHoliday({...newHoliday, name: e.target.value})}
            placeholder="Holiday Name"
            required
            style={{ marginRight: '10px', padding: '8px' }}
          />
          <input
            type="text"
            value={newHoliday.description}
            onChange={e => setNewHoliday({...newHoliday, description: e.target.value})}
            placeholder="Description"
            style={{ marginRight: '10px', padding: '8px' }}
          />
          <button type="submit" style={{ padding: '8px 15px' }}>Add Holiday</button>
        </form>
      </div>

      {/* Holidays List */}
      <div>
        <h3>Upcoming Holidays ({holidays.length})</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {holidays.map(holiday => (
            <div key={holiday.id} style={{
              border: '1px solid #ddd',
              padding: '15px',
              borderRadius: '5px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong>{new Date(holiday.date).toLocaleDateString()}</strong>
                <div style={{ fontWeight: 'bold' }}>{holiday.name}</div>
                <div style={{ color: '#666' }}>{holiday.description}</div>
              </div>
              <button 
                onClick={() => deleteHoliday(holiday.id)}
                style={{ background: '#ff4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px' }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CheckCircle, 
  BarChart3, 
  Plus, 
  Download,
  AlertTriangle,
  Search,
  Calendar,
  Sparkles,
  Filter,
  Mail,
  X,
  Settings2,
  Check,
  Menu
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import { Student, AttendanceRecord, AttendanceStatus } from './types';
import { getAttendanceInsights, generateNotificationEmail } from './services/gemini';

// --- Constants ---

const EXPORT_COLUMNS = [
  { id: 'id', label: 'Student ID' },
  { id: 'name', label: 'Full Name' },
  { id: 'email', label: 'Email Address' },
  { id: 'grade', label: 'Grade' },
  { id: 'admissionDate', label: 'Enrollment Date' },
  { id: 'presentCount', label: 'Present Days' },
  { id: 'absentCount', label: 'Absent Days' },
  { id: 'lateCount', label: 'Late Days' },
  { id: 'rate', label: 'Attendance %' },
];

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-6 py-4 md:py-3 transition-colors ${
      active 
        ? 'bg-indigo-600 text-white border-r-4 border-indigo-300 md:border-r-4' 
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium text-lg md:text-base">{label}</span>
  </button>
);

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="text-white" size={24} />
      </div>
      {trend && (
        <span className={`text-sm font-medium ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
  </div>
);

// --- Main App ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'attendance' | 'analytics'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([
    { id: '1', name: 'John Doe', email: 'john@example.com', grade: 'Grade 10', admissionDate: '2023-09-01' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', grade: 'Grade 10', admissionDate: '2023-09-01' },
    { id: '3', name: 'Mike Johnson', email: 'mike@example.com', grade: 'Grade 11', admissionDate: '2022-09-01' },
    { id: '4', name: 'Sarah Wilson', email: 'sarah@example.com', grade: 'Grade 12', admissionDate: '2021-09-01' },
  ]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportSettingsOpen, setIsExportSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Export selection state
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(EXPORT_COLUMNS.map(c => c.id));
  
  // Notification states
  const [isNotifying, setIsNotifying] = useState(false);
  const [notificationPreview, setNotificationPreview] = useState<string | null>(null);
  
  // Form state
  const [newStudent, setNewStudent] = useState({ name: '', email: '', grade: '' });

  // Close mobile menu on tab change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeTab]);

  // Initial load: create some fake attendance history
  useEffect(() => {
    const history: AttendanceRecord[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      students.forEach(s => {
        const status: AttendanceStatus = Math.random() > 0.1 ? 'Present' : (Math.random() > 0.5 ? 'Absent' : 'Late');
        history.push({ studentId: s.id, date: dateStr, status });
      });
    }
    setAttendance(history);
  }, []);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return students;
    return students.filter(s => 
      s.name.toLowerCase().includes(query) || 
      s.grade.toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  const mostIrregularStudent = useMemo(() => {
    const stats = students.map(s => {
      const absences = attendance.filter(r => r.studentId === s.id && r.status === 'Absent').length;
      return { ...s, absences };
    });
    return stats.sort((a, b) => b.absences - a.absences)[0];
  }, [attendance, students]);

  const stats = useMemo(() => {
    const todayRecords = attendance.filter(r => r.date === selectedDate);
    const presentCount = todayRecords.filter(r => r.status === 'Present').length;
    return {
      total: students.length,
      present: presentCount,
      absent: todayRecords.filter(r => r.status === 'Absent').length,
      rate: students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0
    };
  }, [attendance, students, selectedDate]);

  const chartData = useMemo(() => {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(new Date().getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayRecords = attendance.filter(r => r.date === dateStr);
      const present = dayRecords.filter(r => r.status === 'Present').length;
      data.push({
        date: dateStr,
        attendance: present
      });
    }
    return data;
  }, [attendance]);

  const handleMarkAttendance = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => {
      const filtered = prev.filter(r => !(r.studentId === studentId && r.date === selectedDate));
      return [...filtered, { studentId, date: selectedDate, status }];
    });
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const id = Math.random().toString(36).substr(2, 9);
    setStudents([...students, { ...newStudent, id, admissionDate: new Date().toISOString().split('T')[0] }]);
    setIsModalOpen(false);
    setNewStudent({ name: '', email: '', grade: '' });
  };

  const handleNotifyStudent = async () => {
    if (!mostIrregularStudent) return;
    setIsNotifying(true);
    try {
      const emailContent = await generateNotificationEmail(mostIrregularStudent, mostIrregularStudent.absences);
      setNotificationPreview(emailContent);
    } catch (error) {
      alert("Failed to generate notification.");
    } finally {
      setIsNotifying(false);
    }
  };

  const prepareExportData = () => {
    return students.map(s => {
      const records = attendance.filter(r => r.studentId === s.id);
      const presentCount = records.filter(r => r.status === 'Present').length;
      const row: any = {};
      if (selectedExportColumns.includes('id')) row['Student ID'] = s.id;
      if (selectedExportColumns.includes('name')) row['Full Name'] = s.name;
      if (selectedExportColumns.includes('email')) row['Email Address'] = s.email;
      if (selectedExportColumns.includes('grade')) row['Grade'] = s.grade;
      if (selectedExportColumns.includes('presentCount')) row['Present Days'] = presentCount;
      if (selectedExportColumns.includes('rate')) {
        const total = records.length;
        row['Attendance %'] = total > 0 ? `${Math.round((presentCount / total) * 100)}%` : '0%';
      }
      return row;
    });
  };

  const exportToExcel = () => {
    const data = prepareExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(wb, `attendance_summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToCSV = () => {
    const data = prepareExportData();
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map((row: any) => headers.map(header => JSON.stringify(row[header] || "")).join(","));
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_summary_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const fetchAIInsights = async () => {
    setLoadingInsights(true);
    const insights = await getAttendanceInsights(students, attendance);
    setAiInsights(insights || 'No insights available.');
    setLoadingInsights(false);
  };

  const toggleColumn = (id: string) => {
    setSelectedExportColumns(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Responsive) */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-gray-900 text-white flex flex-col shadow-2xl z-40 transition-transform duration-300 transform lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-500 p-2 rounded-lg">
                <CheckCircle className="text-white" size={24} />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Attendify<span className="text-indigo-400">Pro</span></h1>
            </div>
            <button className="lg:hidden text-gray-400" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <nav className="space-y-1 -mx-6">
            <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSearchQuery(''); }} />
            <SidebarItem icon={Users} label="Students" active={activeTab === 'students'} onClick={() => { setActiveTab('students'); setSearchQuery(''); }} />
            <SidebarItem icon={Calendar} label="Attendance" active={activeTab === 'attendance'} onClick={() => { setActiveTab('attendance'); setSearchQuery(''); }} />
            <SidebarItem icon={BarChart3} label="Analytics" active={activeTab === 'analytics'} onClick={() => { setActiveTab('analytics'); setSearchQuery(''); }} />
          </nav>
        </div>
        <div className="mt-auto p-6">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center space-x-3">
              <img src="https://picsum.photos/32/32" className="rounded-full w-8 h-8" alt="Admin" />
              <div>
                <p className="text-sm font-semibold">Administrator</p>
                <p className="text-[10px] text-gray-500">Super Admin</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative w-full">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 py-3 md:py-4 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center space-x-3">
            <button className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-50 rounded-lg transition" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-gray-800 capitalize truncate max-w-[120px] md:max-w-none">{activeTab}</h2>
          </div>
          
          <div className="flex items-center space-x-1 md:space-x-3">
            {activeTab === 'attendance' && (
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="hidden md:block border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-medium text-gray-700"
              />
            )}
            <button 
              onClick={() => setIsExportSettingsOpen(true)}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title="Settings"
            >
              <Settings2 size={20} />
            </button>
            <div className="flex space-x-1">
              <button 
                onClick={exportToCSV}
                className="flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm"
              >
                <Download size={14} className="md:size-4" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button 
                onClick={exportToExcel}
                className="flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-2 text-xs md:text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition shadow-sm"
              >
                <Download size={14} className="md:size-4" />
                <span className="hidden sm:inline">Excel</span>
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:y-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
              {/* Alert - Mobile Optimized */}
              {mostIrregularStudent && mostIrregularStudent.absences > 0 && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4 shadow-sm">
                  <div className="flex items-center space-x-3 w-full md:w-auto">
                    <div className="bg-rose-500 p-2 rounded-xl flex-shrink-0">
                      <AlertTriangle className="text-white" size={20} />
                    </div>
                    <h4 className="text-rose-900 font-bold md:hidden">Attendance Alert</h4>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-rose-900 font-bold hidden md:block">Irregular Attendance Alert</h4>
                    <p className="text-rose-700 text-sm">
                      <span className="font-semibold">{mostIrregularStudent.name}</span> has <span className="font-bold underline">{mostIrregularStudent.absences} absences</span> this month.
                    </p>
                  </div>
                  <button 
                    onClick={handleNotifyStudent}
                    disabled={isNotifying}
                    className="w-full md:w-auto flex items-center justify-center space-x-2 text-rose-600 hover:text-rose-800 text-sm font-bold bg-white px-4 py-2.5 rounded-xl border border-rose-200 transition shadow-sm"
                  >
                    {isNotifying ? <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div> : <Mail size={16} />}
                    <span>Notify Now</span>
                  </button>
                </div>
              )}

              {/* Stats - Grid adjustments */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard title="Students" value={stats.total} icon={Users} color="bg-blue-500" />
                <StatCard title="Present" value={stats.present} icon={CheckCircle} color="bg-emerald-500" />
                <StatCard title="Absentees" value={stats.absent} icon={AlertTriangle} color="bg-rose-500" />
                <StatCard title="Rate" value={`${stats.rate}%`} icon={BarChart3} color="bg-indigo-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Chart - Responsive height */}
                <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800 text-lg mb-4 md:mb-6">Weekly Attendance Trend</h3>
                  <div className="h-48 md:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} dy={10} hide={window.innerWidth < 640} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                        <Area type="monotone" dataKey="attendance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAtt)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* AI Insights - Mobile friendly layout */}
                <div className="bg-indigo-900 rounded-2xl p-6 text-white flex flex-col shadow-xl relative overflow-hidden group">
                  <div className="flex items-center space-x-2 mb-4">
                    <Sparkles className="text-indigo-300" size={20} />
                    <h3 className="font-bold text-lg">AI Insights</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-[100px]">
                    {loadingInsights ? (
                      <div className="flex items-center justify-center h-full space-x-2">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                      </div>
                    ) : (
                      <p className="text-indigo-100 text-sm leading-relaxed italic">
                        {aiInsights || "Use Gemini 3 to analyze attendance behavior and identify risks."}
                      </p>
                    )}
                  </div>
                  <button onClick={fetchAIInsights} disabled={loadingInsights} className="mt-6 w-full py-3 bg-white text-indigo-900 font-bold rounded-xl active:scale-95 disabled:opacity-50 transition">
                    Analyze Data
                  </button>
                </div>
              </div>

              {/* Table - Horizontal Scroll on Mobile */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Frequent Absentees</h3>
                  <button onClick={() => setActiveTab('students')} className="text-xs md:text-sm text-indigo-600 font-semibold hover:underline">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[500px] md:min-w-0">
                    <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-widest">
                      <tr>
                        <th className="px-6 py-3">Student Name</th>
                        <th className="px-6 py-3">Grade</th>
                        <th className="px-6 py-3">Absences</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {students.slice(0, 5).map(s => {
                        const absences = attendance.filter(r => r.studentId === s.id && r.status === 'Absent').length;
                        return (
                          <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-500 flex-shrink-0">
                                {s.name.charAt(0)}
                              </div>
                              <span className="text-sm font-semibold text-gray-900 truncate max-w-[120px]">{s.name}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{s.grade}</td>
                            <td className="px-6 py-4">
                              <span className={`text-sm font-bold ${absences > 3 ? 'text-red-500' : 'text-gray-900'}`}>{absences}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-lg">Active</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search by name or grade..." 
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 w-full md:w-auto"
                >
                  <Plus size={18} />
                  <span>Add New Student</span>
                </button>
              </div>

              {filteredStudents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {filteredStudents.map(s => (
                    <div key={s.id} className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4 md:mb-6">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-xl md:text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                          {s.name.charAt(0)}
                        </div>
                        <span className="bg-gray-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 rounded-full">{s.grade}</span>
                      </div>
                      <h3 className="font-bold text-lg md:text-xl text-gray-900 mb-1 truncate">{s.name}</h3>
                      <p className="text-gray-400 text-xs md:text-sm mb-4 md:mb-6 truncate">{s.email}</p>
                      <div className="pt-4 md:pt-6 border-t border-gray-50 flex items-center justify-between">
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Enrolled</div>
                        <div className="text-sm font-bold text-gray-700">{s.admissionDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                  <Search className="text-gray-200 mb-4" size={48} />
                  <h3 className="text-lg font-bold text-gray-800">No students found</h3>
                  <p className="text-gray-500 text-sm">Adjust your search to find more results</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="animate-in fade-in duration-500 space-y-4 md:space-y-6">
              <div className="bg-white p-3 md:p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:flex-1 sm:max-w-md">
                   <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                   <input 
                    type="text" 
                    placeholder="Quick filter..." 
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex w-full sm:w-auto justify-between sm:justify-end sm:space-x-6">
                   <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                      <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase">Present: {attendance.filter(r => r.date === selectedDate && r.status === 'Present').length}</span>
                   </div>
                   <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                      <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase">Absent: {attendance.filter(r => r.date === selectedDate && r.status === 'Absent').length}</span>
                   </div>
                </div>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="md:hidden w-full border border-gray-100 rounded-xl px-4 py-2 text-sm bg-gray-50 font-medium text-gray-700"
                />
              </div>

              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 md:px-8 md:py-6 bg-indigo-600 text-white">
                  <h3 className="text-lg font-bold">Attendance Log</h3>
                  <p className="text-indigo-100 text-xs opacity-90">{new Date(selectedDate).toLocaleDateString()}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[450px]">
                    <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-widest border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4 md:px-8">Student</th>
                        <th className="px-4 py-4 text-center">P</th>
                        <th className="px-4 py-4 text-center">A</th>
                        <th className="px-4 py-4 text-center">L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredStudents.map(s => {
                        const currentRecord = attendance.find(r => r.studentId === s.id && r.date === selectedDate);
                        return (
                          <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 md:px-8">
                              <div className="font-bold text-gray-900 text-sm md:text-base">{s.name}</div>
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider">{s.grade}</div>
                            </td>
                            <td className="px-2 py-4 text-center">
                              <button onClick={() => handleMarkAttendance(s.id, 'Present')} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mx-auto transition-all ${currentRecord?.status === 'Present' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-gray-50 text-gray-300'}`}><CheckCircle size={20} /></button>
                            </td>
                            <td className="px-2 py-4 text-center">
                              <button onClick={() => handleMarkAttendance(s.id, 'Absent')} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mx-auto transition-all ${currentRecord?.status === 'Absent' ? 'bg-rose-500 text-white shadow-lg' : 'bg-gray-50 text-gray-300'}`}><AlertTriangle size={20} /></button>
                            </td>
                            <td className="px-2 py-4 text-center">
                              <button onClick={() => handleMarkAttendance(s.id, 'Late')} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mx-auto transition-all ${currentRecord?.status === 'Late' ? 'bg-amber-500 text-white shadow-lg' : 'bg-gray-50 text-gray-300'}`}><Calendar size={20} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-500">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-6 md:mb-8">Status Distribution</h3>
                  <div className="h-56 md:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Present', value: attendance.filter(r => r.status === 'Present').length },
                            { name: 'Absent', value: attendance.filter(r => r.status === 'Absent').length },
                            { name: 'Late', value: attendance.filter(r => r.status === 'Late').length },
                          ]}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#f43f5e" />
                          <Cell fill="#f59e0b" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-6 md:mb-8">Daily Trends</h3>
                  <div className="h-56 md:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} dy={10} hide={window.innerWidth < 640} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} />
                        <Tooltip />
                        <Line type="monotone" dataKey="attendance" stroke="#6366f1" strokeWidth={4} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
               </div>

               <div className="bg-indigo-600 rounded-3xl p-6 md:p-10 text-white flex flex-col md:flex-row md:items-center justify-between shadow-2xl relative overflow-hidden group space-y-6 md:space-y-0">
                  <div className="space-y-3 relative z-10 max-w-xl">
                    <h3 className="text-2xl md:text-3xl font-bold">Monthly Reports</h3>
                    <p className="text-indigo-100 text-base md:text-lg opacity-80">Full administrative data is ready for export. Columns are customizable in settings.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 relative z-10">
                    <button onClick={exportToExcel} className="w-full sm:w-auto px-8 py-4 bg-white text-indigo-600 font-bold rounded-2xl hover:bg-indigo-50 active:scale-95 shadow-xl transition">
                      Excel Format
                    </button>
                    <button onClick={exportToCSV} className="w-full sm:w-auto px-8 py-4 bg-indigo-500 text-white font-bold rounded-2xl hover:bg-indigo-400 border border-indigo-400 active:scale-95 transition">
                      CSV Format
                    </button>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Responsive Modals */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300">
              <div className="p-8 md:p-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-800">New Student</h3>
                  <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400"><X size={24} /></button>
                </div>
                <form onSubmit={handleAddStudent} className="space-y-4 md:space-y-5">
                  <input required type="text" className="w-full px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Full name" value={newStudent.name} onChange={(e) => setNewStudent({...newStudent, name: e.target.value})} />
                  <input required type="email" className="w-full px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Email address" value={newStudent.email} onChange={(e) => setNewStudent({...newStudent, email: e.target.value})} />
                  <select required className="w-full px-5 py-3 md:py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" value={newStudent.grade} onChange={(e) => setNewStudent({...newStudent, grade: e.target.value})}>
                    <option value="">Select Grade</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                  <button type="submit" className="w-full py-4 md:py-5 bg-indigo-600 text-white font-bold rounded-2xl active:scale-95 transition">Enroll Student</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {isExportSettingsOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300">
              <div className="p-8 md:p-10 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-800">Export Settings</h3>
                  <button onClick={() => setIsExportSettingsOpen(false)} className="text-gray-400"><X size={24} /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {EXPORT_COLUMNS.map(col => (
                    <button 
                      key={col.id}
                      onClick={() => toggleColumn(col.id)}
                      className={`flex items-center space-x-3 p-4 rounded-xl border transition-all ${
                        selectedExportColumns.includes(col.id) ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 bg-gray-50 text-gray-500'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedExportColumns.includes(col.id) ? 'bg-indigo-600' : 'bg-white'}`}>
                        {selectedExportColumns.includes(col.id) && <Check size={12} className="text-white" />}
                      </div>
                      <span className="text-sm font-semibold">{col.label}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setIsExportSettingsOpen(false)} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl">Apply Changes</button>
              </div>
            </div>
          </div>
        )}

        {notificationPreview && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800">Email Preview</h3>
                  <button onClick={() => setNotificationPreview(null)} className="text-gray-400"><X size={24} /></button>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 md:p-6 border border-gray-100 mb-6 max-h-[40vh] overflow-y-auto">
                   <div className="text-xs md:text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{notificationPreview}</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => { alert('Simulation: Email sent.'); setNotificationPreview(null); }} className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100">Send Email</button>
                  <button onClick={() => setNotificationPreview(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

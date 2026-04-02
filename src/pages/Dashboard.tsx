import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, CheckCircle2, ClipboardList, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import api, { getStudentAttendance } from '../api';

export default function Dashboard() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<any>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const response = await api.get('/batches');
        setBatches(response.data.batches || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    const fetchAttendance = async () => {
      try {
        const response = await getStudentAttendance();
        setAttendance(response.data);
      } catch (err) {
        console.error(err);
      } finally {
        setAttendanceLoading(false);
      }
    };
    fetchBatches();
    fetchAttendance();
  }, []);

  const overallPct = attendance?.overallPercentage ?? null;
  const overallAttendanceHasClasses = (attendance?.metrics ?? []).some((m: any) => (m.totalClasses ?? 0) > 0);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      
      {/* Welcome Header */}
      <div className="border-b border-slate-200 dark:border-[#242830] pb-6">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-[#f0f2f5]">
          Welcome, {user?.name.split(' ')[0]}
        </h2>
        <p className="mt-2 text-slate-500 dark:text-[#8b95a2] text-lg">
          Here's an overview of your progress and active curriculum.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#13151a] p-6 rounded-xl border border-slate-200 dark:border-[#242830] shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 dark:bg-[#1e2a3d] text-blue-600 dark:text-blue-400 rounded-lg">
            <BookOpen size={20} />
          </div>
          <div>
            <p className="text-slate-500 dark:text-[#8b95a2] text-sm font-medium">Active Courses</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-[#f0f2f5] mt-1">{loading ? '-' : batches.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#13151a] p-6 rounded-xl border border-slate-200 dark:border-[#242830] shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-[#052e1e] text-emerald-600 dark:text-[#10b981] rounded-lg">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-slate-500 dark:text-[#8b95a2] text-sm font-medium">Assignments Done</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-[#f0f2f5] mt-1">-</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#13151a] p-6 rounded-xl border border-slate-200 dark:border-[#242830] shadow-sm flex items-start gap-4">
          <div className={`p-3 rounded-lg ${
            !overallAttendanceHasClasses
              ? 'bg-slate-100 dark:bg-[#1a1d24] text-slate-500 dark:text-[#5a6474]'
              : overallPct !== null && overallPct < 75
                ? 'bg-amber-50 dark:bg-[#2d2008] text-amber-600 dark:text-[#f59e0b]'
                : 'bg-emerald-50 dark:bg-[#052e1e] text-emerald-600 dark:text-[#10b981]'
          }`}>
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-slate-500 dark:text-[#8b95a2] text-sm font-medium">Attendance</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-[#f0f2f5] mt-1">
              {attendanceLoading ? '-' : overallPct !== null ? `${overallPct}%` : '--'}
            </p>
            {!attendanceLoading && !overallAttendanceHasClasses && (
              <p className="text-xs text-slate-400 dark:text-[#5a6474] mt-1">No classes yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Attendance Breakdown ─── */}
      {!attendanceLoading && attendance?.metrics && attendance.metrics.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-5 h-5 text-slate-400 dark:text-[#5a6474]" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-[#f0f2f5]">Attendance Breakdown</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {attendance.metrics.map((m: any) => {
              const hasClasses = (m.totalClasses ?? 0) > 0;
              const pctColor = !hasClasses ? 'text-slate-400 dark:text-[#5a6474]' : m.percentage >= 75 ? 'text-emerald-600 dark:text-[#10b981]' : m.percentage >= 50 ? 'text-amber-600 dark:text-[#f59e0b]' : 'text-red-600 dark:text-[#ef4444]';
              const barColor = !hasClasses ? 'bg-slate-300 dark:bg-[#242830]' : m.percentage >= 75 ? 'bg-emerald-500 dark:bg-[#10b981]' : m.percentage >= 50 ? 'bg-amber-500 dark:bg-[#f59e0b]' : 'bg-red-500 dark:bg-[#ef4444]';
              return (
                <div key={m.batchId} className="rounded-xl bg-white dark:bg-[#13151a] border border-slate-200 dark:border-[#242830] p-5">
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{m.batchName}</h4>
                      <p className="text-xs text-slate-500 dark:text-[#8b95a2] mt-0.5">{m.courseName || 'Unknown Course'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-2xl font-bold ${pctColor}`}>{hasClasses ? `${m.percentage}%` : '--'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-100 dark:bg-[#1a1d24] rounded-full h-1.5 overflow-hidden">
                      <div className={`${barColor} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${hasClasses ? m.percentage : 0}%` }}></div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-[#8b95a2] shrink-0">
                      {hasClasses ? `${m.attendedClasses}/${m.totalClasses}` : 'None'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Enrolled Batches ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-[#f0f2f5]">Enrolled Curriculum</h3>
          <Link to="/courses" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-50">
            {[1, 2, 3].map(n => <div key={n} className="h-40 bg-slate-100 dark:bg-[#13151a] rounded-xl animate-pulse border border-slate-200 dark:border-[#242830]" />)}
          </div>
        ) : batches.length === 0 ? (
           <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#242830] bg-slate-50 border-slate-200 dark:bg-[#13151a] p-12 text-center">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No courses yet</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-[#8b95a2]">You are not enrolled in any active curriculums right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((batch: any) => (
              <Link 
                key={batch._id} 
                to={`/courses/${batch._id}`}
                className="group flex flex-col justify-between rounded-xl bg-white dark:bg-[#13151a] border border-slate-200 dark:border-[#242830] p-5 transition-shadow hover:shadow-md hover:border-slate-300 dark:hover:border-[#5a6474]"
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center rounded bg-blue-50 dark:bg-[#1e2a3d] px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                      Batch
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-[#f0f2f5] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">{batch.name}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-[#8b95a2] line-clamp-1">
                    {batch.course?.name || 'Unknown Course'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

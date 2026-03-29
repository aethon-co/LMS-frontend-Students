import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Calendar, CheckCircle } from 'lucide-react';
import { Link } from 'react-router';
import api from '../api';

export default function Dashboard() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

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
    fetchBatches();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-slate-100 font-sans">
      <div className="bg-gradient-to-br from-slate-900 via-blue-900/40 pos to-slate-900 rounded-3xl p-8 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <h2 className="text-3xl font-extrabold mb-2 tracking-tight z-10 relative">Welcome back, {user?.name.split(' ')[0]}! 👋</h2>
        <p className="text-slate-400 text-lg z-10 relative">Ready to continue your learning journey today?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex items-center gap-4 hover:bg-slate-800 transition-colors">
          <div className="p-4 bg-blue-500/10 text-blue-400 rounded-xl">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-semibold">Active Courses</p>
            <p className="text-2xl font-bold text-white">{loading ? '-' : batches.length}</p>
          </div>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex items-center gap-4 hover:bg-slate-800 transition-colors">
          <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-semibold">Assignments Done</p>
            <p className="text-2xl font-bold text-white">-</p>
          </div>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex items-center gap-4 hover:bg-slate-800 transition-colors">
          <div className="p-4 bg-amber-500/10 text-amber-400 rounded-xl">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-sm font-semibold">Upcoming Deadlines</p>
            <p className="text-2xl font-bold text-white">-</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white tracking-tight">Your Enrolled Batches</h3>
          <Link to="/courses" className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-4 py-2 rounded-lg">
            View all
          </Link>
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-slate-500 font-medium">Loading batches...</div>
        ) : batches.length === 0 ? (
           <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-12 text-center flex flex-col items-center justify-center">
            <h3 className="text-xl font-semibold text-slate-200">No courses yet</h3>
            <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">You are not enrolled in any active curriculums right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {batches.map((batch: any) => (
              <Link 
                key={batch._id} 
                to={`/courses/${batch._id}`}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 transition-all hover:bg-slate-800 hover:border-slate-600 hover:shadow-lg hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                      Batch
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">{batch.name}</h3>
                  <p className="mt-2 text-sm text-slate-400 line-clamp-2">
                    Course material: {batch.course?.name || 'Unknown Course'}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-sm text-slate-300 group-hover:text-blue-300">
                  <span className="font-medium">Enter course</span>
                  <BookOpen className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

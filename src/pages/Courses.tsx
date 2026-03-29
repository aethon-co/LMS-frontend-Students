import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen } from 'lucide-react';
import api from '../api';

export default function Courses() {
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">My Courses</h1>
          <p className="mt-1 text-sm text-slate-400">Manage and access your enrolled curriculum.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-[200px] rounded-2xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-12 text-center flex flex-col items-center justify-center">
            <BookOpen className="h-12 w-12 text-slate-500 mb-4" />
            <h3 className="text-xl font-semibold text-slate-200">No courses yet</h3>
            <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">You are not enrolled in any active curriculums right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((batch: any) => (
            <Link 
              key={batch._id} 
              to={`/courses/${batch._id}`}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 transition-all hover:bg-slate-800 hover:border-slate-600 hover:shadow-[0_0_15px_rgba(79,70,229,0.1)] hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400 ring-1 ring-inset ring-indigo-500/20 uppercase tracking-widest">
                    Batch
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-100 group-hover:text-indigo-400 transition-colors mb-2">
                  {batch.name}
                </h3>
                <p className="text-sm text-slate-400 flex-1">
                  Access course material, video lectures, and submit assignments seamlessly.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm text-slate-300 font-medium group-hover:text-indigo-400 transition-colors">
                <span>Enter Course</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

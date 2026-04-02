import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, ArrowRight } from 'lucide-react';
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      <div className="border-b border-slate-200 dark:border-[#242830] pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-[#f0f2f5]">My Curriculum</h1>
        <p className="mt-2 text-slate-500 dark:text-[#8b95a2]">Manage and access your enrolled learning paths.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-50">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-[180px] rounded-xl bg-slate-100 dark:bg-[#13151a] border border-slate-200 dark:border-[#242830] animate-pulse" />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#242830] bg-slate-50 dark:bg-[#13151a] p-12 text-center flex flex-col items-center justify-center">
            <BookOpen className="h-10 w-10 text-slate-400 dark:text-[#5a6474] mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No courses yet</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-[#8b95a2] max-w-sm mx-auto">You are not enrolled in any active curriculums right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((batch: any) => (
            <Link 
              key={batch._id} 
              to={`/courses/${batch._id}`}
              className="group flex flex-col justify-between rounded-xl bg-white dark:bg-[#13151a] border border-slate-200 dark:border-[#242830] p-6 transition-shadow hover:shadow-md hover:border-slate-300 dark:hover:border-[#5a6474]"
            >
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center rounded bg-blue-50 dark:bg-[#1e2a3d] px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                    Batch
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-[#f0f2f5] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2">
                  {batch.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-[#8b95a2] flex-1 line-clamp-2">
                  Access course material, video lectures, and submit assignments seamlessly.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm text-slate-600 dark:text-[#8b95a2] font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <span>Enter Course</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

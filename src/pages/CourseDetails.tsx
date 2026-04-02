import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { Video, FileText, UploadCloud, PlayCircle, TrendingUp } from 'lucide-react';
import axios from 'axios';
import api, { getStudentAttendance } from '../api';

export default function CourseDetails() {
  const { batchId } = useParams();
  const [batch, setBatch] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lectures' | 'assignments'>('lectures');
  
  // Video Player state
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>('');

  // Uploading state tracking
  const [uploadingAssignmentId, setUploadingAssignmentId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attendance for this batch
  const [batchAttendance, setBatchAttendance] = useState<any>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!batchId) return;
      try {
        const batchRes = await api.get(`/batches/${batchId}`);
        const _batch = batchRes.data.batch;
        setBatch(_batch);

        if (_batch && _batch.course?._id) {
          const courseId = _batch.course._id;
          const [lecturesRes, assignmentsRes] = await Promise.all([
            api.get(`/courses/${courseId}/lectures`),
            api.get(`/batches/${batchId}/assignments`)
          ]);
          setLectures(lecturesRes.data.lectures || []);
          setAssignments(assignmentsRes.data.assignments || []);
        } else {
           const assignmentsRes = await api.get(`/batches/${batchId}/assignments`);
           setAssignments(assignmentsRes.data.assignments || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    const fetchAttendance = async () => {
      try {
        const res = await getStudentAttendance();
        const metrics = res.data.metrics || [];
        const match = metrics.find((m: any) => m.batchId === batchId);
        if (match) setBatchAttendance(match);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDetails();
    fetchAttendance();
  }, [batchId]);

  const handlePlayLecture = async (lectureId: string, title: string) => {
    try {
      const res = await api.get(`/lectures/${lectureId}/stream-url`);
      setActiveVideo(res.data.streamUrl);
      setVideoTitle(title);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert("Error loading video stream");
    }
  };

  const handleUploadClick = (assignmentId: string) => {
    setUploadingAssignmentId(assignmentId);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const assignmentId = uploadingAssignmentId;
    if (!file || !assignmentId) return;

    try {
      setUploadProgress(prev => ({ ...prev, [assignmentId]: 10 }));

      // 1. Get presigned URL
      const urlRes = await api.post(`/assignments/${assignmentId}/upload-url`, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream'
      });

      const { uploadUrl } = urlRes.data;
      setUploadProgress(prev => ({ ...prev, [assignmentId]: 40 }));

      // 2. Put object to S3 directly
      await axios.put(uploadUrl, file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
             const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
             const mappedProgress = 40 + (percentCompleted * 0.6);
             setUploadProgress(prev => ({ ...prev, [assignmentId]: mappedProgress }));
          }
        }
      });

      alert("Submission successful!");
      window.location.reload(); 

    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploadingAssignmentId(null);
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[assignmentId];
        return next;
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Loading curriculum...</div>;
  }

  if (!batch) {
    return <div className="p-12 text-center text-red-400 font-bold bg-red-500/10 border border-red-500/20 rounded-xl max-w-lg mx-auto mt-12">Course access error.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-slate-100 font-sans">
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-3xl p-8 border border-slate-800 relative shadow-[0_0_15px_rgba(79,70,229,0.1)]">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/courses" className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-semibold tracking-wider uppercase">
            ← Back to Courses
          </Link>
        </div>
        <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-white">{batch.name}</h1>
        <p className="text-blue-200/80 text-lg">{batch.course?.name || "Premium Course Material"}</p>
      </div>

      {/* Attendance Banner */}
      {batchAttendance && (
        <div className={`rounded-2xl p-5 border flex items-center justify-between ${
          batchAttendance.percentage >= 75 
            ? 'bg-emerald-500/5 border-emerald-500/20' 
            : batchAttendance.percentage >= 50 
              ? 'bg-amber-500/5 border-amber-500/20'
              : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${batchAttendance.percentage >= 75 ? 'bg-emerald-500/10' : batchAttendance.percentage >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
              <TrendingUp className={`w-5 h-5 ${batchAttendance.percentage >= 75 ? 'text-emerald-400' : batchAttendance.percentage >= 50 ? 'text-amber-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Your Attendance</p>
              <p className="text-xs text-slate-400">{batchAttendance.attendedClasses} of {batchAttendance.totalClasses} classes attended</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 bg-slate-700 rounded-full h-2 overflow-hidden">
              <div className={`h-2 rounded-full transition-all duration-500 ${batchAttendance.percentage >= 75 ? 'bg-emerald-500' : batchAttendance.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${batchAttendance.percentage}%` }}></div>
            </div>
            <span className={`text-2xl font-extrabold ${batchAttendance.percentage >= 75 ? 'text-emerald-400' : batchAttendance.percentage >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {batchAttendance.percentage}%
            </span>
          </div>
        </div>
      )}

      {activeVideo && (
        <div className="bg-black rounded-3xl overflow-hidden shadow-2xl relative border border-slate-800 animate-in zoom-in-95 duration-300">
           <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/90 to-transparent z-10 flex justify-between items-center text-white">
             <div className="flex items-center gap-2">
               <Video className="w-5 h-5 text-blue-400" />
               <h3 className="font-bold text-lg">{videoTitle}</h3>
             </div>
             <button onClick={() => setActiveVideo(null)} className="opacity-70 hover:opacity-100 font-bold px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors border border-white/10">Close Player</button>
           </div>
           <video 
             src={activeVideo} 
             controls 
             autoPlay 
             className="w-full aspect-video outline-none bg-black"
             controlsList="nodownload"
           >
             Your browser does not support the video tag.
           </video>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button 
          onClick={() => setActiveTab('lectures')}
          className={`px-6 py-4 text-sm font-semibold border-b-2 transition-all gap-2 flex items-center ${
            activeTab === 'lectures' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Video size={18} /> Video Curriculum
        </button>
        <button 
          onClick={() => setActiveTab('assignments')}
          className={`px-6 py-4 text-sm font-semibold border-b-2 transition-all gap-2 flex items-center ${
            activeTab === 'assignments' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText size={18} /> Assignments
        </button>
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === 'lectures' && (
           <div className="grid gap-4">
             {lectures.length === 0 ? (
               <div className="text-center py-16 text-slate-400 border border-dashed border-slate-700/50 bg-slate-800/20 rounded-2xl flex flex-col items-center">
                 <Video className="w-12 h-12 text-slate-600 mb-3" />
                 <p className="font-medium text-lg text-slate-200">No video lectures yet.</p>
                 <p className="text-sm">Check back later when curriculum is assigned.</p>
               </div>
             ) : (
               lectures.map((lecture, index) => (
                 <div key={lecture._id} onClick={() => handlePlayLecture(lecture._id, lecture.title)} className="group cursor-pointer bg-slate-800/50 p-4 rounded-2xl flex items-center gap-4 hover:bg-slate-800 border border-slate-700/50 transition-all shadow-sm hover:shadow-[0_0_15px_rgba(79,70,229,0.1)] hover:-translate-y-0.5">
                    <div className="w-16 h-12 bg-slate-900 rounded-lg flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:text-blue-300 transition-all shadow-inner">
                      <PlayCircle size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-100 group-hover:text-white transition-colors">
                        <span className="text-blue-400 mr-2">{index + 1}.</span>{lecture.title}
                      </h4>
                      {lecture.description && <p className="text-sm text-slate-400 mt-1 line-clamp-1">{lecture.description}</p>}
                    </div>
                 </div>
               ))
             )}
           </div>
        )}

        {activeTab === 'assignments' && (
           <div className="grid gap-6">
             <input type="file" ref={fileInputRef} className="hidden" onChange={onFileChange} />

             {assignments.length === 0 ? (
               <div className="text-center py-16 text-slate-400 border border-dashed border-slate-700/50 bg-slate-800/20 rounded-2xl flex flex-col items-center">
                 <FileText className="w-12 h-12 text-slate-600 mb-3" />
                 <p className="font-medium text-slate-200 text-lg">No assignments due.</p>
                 <p className="text-sm">Enjoy your free time!</p>
               </div>
             ) : (
               assignments.map(a => (
                 <div key={a._id} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 shadow-sm flex flex-col md:flex-row gap-6 md:items-start transition-colors hover:bg-slate-800">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                         <h4 className="text-xl font-bold text-white tracking-tight">{a.name}</h4>
                         <span className="w-fit px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-md uppercase tracking-wide">
                           Due {new Date(a.dueDate).toLocaleDateString()}
                         </span>
                      </div>
                      <p className="text-slate-400 mt-3 text-sm leading-relaxed whitespace-pre-wrap">{a.description}</p>
                      
                      <div className="mt-5 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-700">
                          Max Score: {a.maxMarks}
                        </span>
                      </div>
                    </div>

                    <div className="md:w-56 shrink-0 flex flex-col">
                       {uploadProgress[a._id] ? (
                          <div className="w-full bg-slate-900 rounded-lg p-3 border border-slate-700">
                             <div className="w-full bg-slate-800 rounded-full h-2 mb-2 relative overflow-hidden">
                               <div className="bg-blue-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${uploadProgress[a._id]}%` }}></div>
                             </div>
                             <span className="text-xs font-bold text-center block animate-pulse text-blue-400 uppercase tracking-widest">Uploading {Math.floor(uploadProgress[a._id])}%</span>
                          </div>
                       ) : (
                          <button 
                            disabled={!!uploadingAssignmentId}
                            onClick={() => handleUploadClick(a._id)}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 transition-all hover:shadow-[0_0_15px_rgba(79,70,229,0.4)] disabled:opacity-50 disabled:hover:bg-blue-600 disabled:hover:shadow-none"
                          >
                            <UploadCloud size={18} /> 
                            Submit Work
                          </button>
                       )}
                    </div>
                 </div>
               ))
             )}
           </div>
        )}
      </div>
    </div>
  );
}

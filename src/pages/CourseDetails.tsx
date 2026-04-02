import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { Video, FileText, UploadCloud, PlayCircle, TrendingUp, CheckCircle2, BookOpen, Eye, Pencil, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import api, { getStudentAttendance, uploadAssignmentViaApi } from '../api';

const COMPLETION_THRESHOLD = 0.80; // must match backend

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
  const [activeLectureId, setActiveLectureId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Progress tracking
  const [lectureProgress, setLectureProgress] = useState<Record<string, { isCompleted: boolean; watchedSeconds: number; lastPosition: number }>>({});
  const [courseCompletionPercentage, setCourseCompletionPercentage] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalLectures, setTotalLectures] = useState(0);
  const reportedCompletedRef = useRef<Set<string>>(new Set());
  const progressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Uploading state tracking
  const [uploadingAssignmentId, setUploadingAssignmentId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; type: 'success' | 'error'; message: string }>>([]);

  // Attendance for this batch
  const [batchAttendance, setBatchAttendance] = useState<any>(null);

  const pushToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts(prev => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3500);
  }, []);

  const refreshAssignments = useCallback(async () => {
    if (!batchId) return;

    const assignmentsRes = await api.get(`/batches/${batchId}/assignments`);
    setAssignments(assignmentsRes.data.assignments || []);
  }, [batchId]);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!batchId) return;
      try {
        const batchRes = await api.get(`/batches/${batchId}`);
        const _batch = batchRes.data.batch;
        setBatch(_batch);

        if (_batch && _batch.course?._id) {
          const courseId = _batch.course._id;
          const [lecturesRes, assignmentsRes, progressRes] = await Promise.all([
            api.get(`/courses/${courseId}/lectures`),
            api.get(`/batches/${batchId}/assignments`),
            api.get(`/courses/${courseId}/progress`).catch(() => null),
          ]);
          const fetchedLectures = lecturesRes.data.lectures || [];
          setLectures(fetchedLectures);
          setAssignments(assignmentsRes.data.assignments || []);

          if (progressRes) {
            const { lectureProgress: lp, courseCompletionPercentage: ccp, completedLectures, totalLectures: tl } = progressRes.data;
            const progressMap: Record<string, any> = {};
            for (const item of (lp || [])) {
              progressMap[item.lectureId] = item;
            }
            setLectureProgress(progressMap);
            setCourseCompletionPercentage(ccp ?? 0);
            setCompletedCount(completedLectures ?? 0);
            setTotalLectures(tl ?? fetchedLectures.length);

            const completedSet = new Set<string>();
            for (const item of (lp || [])) {
              if (item.isCompleted) completedSet.add(item.lectureId);
            }
            reportedCompletedRef.current = completedSet;
          } else {
            setTotalLectures(fetchedLectures.length);
          }
        } else {
          await refreshAssignments();
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
        console.error(err)
      }
    };
    fetchDetails();
    fetchAttendance();
  }, [batchId, refreshAssignments]);

  const sendProgressUpdate = useCallback(async (lectureId: string, watchedSeconds: number, totalDuration: number, lastPosition: number) => {
    try {
      const res = await api.post(`/lectures/${lectureId}/progress`, {
        watchedSeconds,
        totalDuration,
        lastPosition,
      });
      const updated = res.data.progress;
      setLectureProgress(prev => ({
        ...prev,
        [lectureId]: {
          isCompleted: updated.isCompleted,
          watchedSeconds: updated.watchedSeconds,
          lastPosition: updated.lastPosition,
        }
      }));

      setLectureProgress(prev => {
        const values = Object.values({ ...prev, [lectureId]: { isCompleted: updated.isCompleted, watchedSeconds: updated.watchedSeconds, lastPosition: updated.lastPosition } });
        const completed = values.filter((v: any) => v.isCompleted).length;
        const total = Math.max(totalLectures, values.length);
        setCompletedCount(completed);
        setCourseCompletionPercentage(total > 0 ? Math.round((completed / total) * 100) : 0);
        return { ...prev, [lectureId]: { isCompleted: updated.isCompleted, watchedSeconds: updated.watchedSeconds, lastPosition: updated.lastPosition } };
      });
    } catch (err) {
      console.error('Failed to update progress', err);
    }
  }, [totalLectures]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    const lId = activeLectureId;
    if (!video || !lId || !video.duration) return;

    const currentTime = video.currentTime;
    const duration = video.duration;
    const watchedPct = currentTime / duration;

    if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
    progressDebounceRef.current = setTimeout(() => {
      sendProgressUpdate(lId, currentTime, duration, currentTime);
    }, 5000);

    if (watchedPct >= COMPLETION_THRESHOLD && !reportedCompletedRef.current.has(lId)) {
      reportedCompletedRef.current.add(lId);
      if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
      sendProgressUpdate(lId, currentTime, duration, currentTime);
    }
  }, [activeLectureId, sendProgressUpdate]);

  const handleVideoPause = useCallback(() => {
    const video = videoRef.current;
    const lId = activeLectureId;
    if (!video || !lId || !video.duration) return;
    if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
    sendProgressUpdate(lId, video.currentTime, video.duration, video.currentTime);
  }, [activeLectureId, sendProgressUpdate]);

  const handlePlayLecture = async (lectureId: string, title: string) => {
    if (videoRef.current && activeLectureId && videoRef.current.duration) {
      await sendProgressUpdate(activeLectureId, videoRef.current.currentTime, videoRef.current.duration, videoRef.current.currentTime);
    }
    try {
      const res = await api.get(`/lectures/${lectureId}/stream-url`);
      setActiveVideo(res.data.streamUrl);
      setVideoTitle(title);
      setActiveLectureId(lectureId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      pushToast('error', 'Error loading video stream');
    }
  };

  const handleCloseVideo = async () => {
    if (videoRef.current && activeLectureId && videoRef.current.duration) {
      await sendProgressUpdate(activeLectureId, videoRef.current.currentTime, videoRef.current.duration, videoRef.current.currentTime);
    }
    setActiveVideo(null);
    setActiveLectureId(null);
    setVideoTitle('');
  };

  const handleUploadClick = (assignmentId: string) => {
    setUploadingAssignmentId(assignmentId);
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const assignmentId = uploadingAssignmentId;
    if (!file || !assignmentId) return;

    try {
      setUploadProgress(prev => ({ ...prev, [assignmentId]: 10 }));
      const urlRes = await api.post(`/assignments/${assignmentId}/upload-url`, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream'
      });
      const { uploadUrl } = urlRes.data;
      setUploadProgress(prev => ({ ...prev, [assignmentId]: 40 }));
      try {
        await axios.put(uploadUrl, file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(prev => ({ ...prev, [assignmentId]: 40 + (percentCompleted * 0.6) }));
            }
          }
        });
      } catch {
        await uploadAssignmentViaApi(assignmentId, file, (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(prev => ({ ...prev, [assignmentId]: 40 + (percentCompleted * 0.6) }));
          }
        });
      }
      await refreshAssignments();
      pushToast('success', 'Assignment uploaded successfully');
    } catch (err) {
      console.error(err);
      pushToast('error', 'Upload failed. Please try again.');
    } finally {
      setUploadingAssignmentId(null);
      setUploadProgress(prev => { const next = { ...prev }; delete next[assignmentId]; return next; });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleViewSubmission = useCallback(async (submissionId: string) => {
    try {
      const res = await api.get(`/submissions/${submissionId}/download-url`);
      window.open(res.data.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      pushToast('error', 'Could not open your submission');
    }
  }, [pushToast]);

  if (loading) {
    return <div className="p-12 text-center text-slate-500 dark:text-[#5a6474] font-medium animate-pulse">Loading curriculum...</div>;
  }

  if (!batch) {
    return <div className="p-12 text-center text-red-500 dark:text-[#ef4444] font-medium bg-red-50 dark:bg-[#0c0e12] border border-red-200 dark:border-[#7f1d1d] rounded-xl max-w-lg mx-auto mt-12">Course access error.</div>;
  }

  const completedLectures = new Set(
    Object.entries(lectureProgress)
      .filter(([, v]) => v.isCompleted)
      .map(([k]) => k)
  );
  
  const attendancePercentage = batchAttendance?.percentage ?? null;
  const hasAttendanceSessions = (batchAttendance?.totalClasses ?? 0) > 0;
  const attendanceTone = !hasAttendanceSessions ? 'empty' : 
                         attendancePercentage !== null && attendancePercentage >= 75 ? 'good' : 
                         attendancePercentage !== null && attendancePercentage >= 50 ? 'warn' : 'bad';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      <div className="fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-sm ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-[#065f46] dark:bg-[#052e1e] dark:text-[#a7f3d0]'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-[#7f1d1d] dark:bg-[#2d0f0f] dark:text-[#fecaca]'
            }`}
          >
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        ))}
      </div>
      
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-[#242830] pb-6">
        <Link to="/courses" className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm font-medium mb-4">
          <ArrowLeft size={16} /> Back to Curriculum
        </Link>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-[#f0f2f5] mb-2">{batch.name}</h1>
        <p className="text-slate-500 dark:text-[#8b95a2] text-lg">{batch.course?.name || "Premium Course Material"}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Course Completion Progress */}
        {totalLectures > 0 && (
          <div className="bg-white dark:bg-[#13151a] rounded-xl p-6 border border-slate-200 dark:border-[#242830] flex flex-col justify-center">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-[#f0f2f5]">
                <BookOpen size={18} />
                <span className="text-sm font-medium">Course Progress</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-[#8b95a2]">{completedCount} of {totalLectures} lectures</span>
                <span className={`text-lg font-bold ${courseCompletionPercentage === 100 ? 'text-emerald-600 dark:text-[#10b981]' : 'text-blue-600 dark:text-blue-400'}`}>
                  {courseCompletionPercentage}%
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-100 dark:bg-[#1a1d24] rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${courseCompletionPercentage === 100 ? 'bg-emerald-500 dark:bg-[#10b981]' : 'bg-blue-600 dark:bg-blue-500'}`}
                style={{ width: `${courseCompletionPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Attendance Banner */}
        {batchAttendance && (
          <div className="bg-white dark:bg-[#13151a] rounded-xl p-6 border border-slate-200 dark:border-[#242830] flex flex-col justify-center">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-[#f0f2f5]">
                <TrendingUp size={18} />
                <span className="text-sm font-medium">Your Attendance</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-[#8b95a2]">
                  {hasAttendanceSessions ? `${batchAttendance.attendedClasses} of ${batchAttendance.totalClasses} classes` : 'No classes'}
                </span>
                <span className={`text-lg font-bold ${
                  attendanceTone === 'good' ? 'text-emerald-600 dark:text-[#10b981]' :
                  attendanceTone === 'warn' ? 'text-amber-600 dark:text-[#f59e0b]' :
                  attendanceTone === 'bad' ? 'text-red-600 dark:text-[#ef4444]' : 'text-slate-400 dark:text-[#5a6474]'
                }`}>
                  {attendancePercentage !== null ? `${attendancePercentage}%` : '--'}
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-100 dark:bg-[#1a1d24] rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  attendanceTone === 'good' ? 'bg-emerald-500 dark:bg-[#10b981]' :
                  attendanceTone === 'warn' ? 'bg-amber-500 dark:bg-[#f59e0b]' :
                  attendanceTone === 'bad' ? 'bg-red-500 dark:bg-[#ef4444]' : 'bg-slate-400 dark:bg-[#5a6474]'
                }`}
                style={{ width: `${attendancePercentage ?? 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Video Player */}
      {activeVideo && (
        <div className="bg-[#0c0e12] rounded-xl overflow-hidden border border-slate-200 dark:border-[#242830] animate-in slide-in-from-top-4 duration-300">
          <div className="p-4 bg-slate-50 border-b border-slate-200 dark:bg-[#13151a] dark:border-[#242830] flex justify-between items-center text-slate-900 dark:text-[#f0f2f5]">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-medium text-sm">{videoTitle}</h3>
              {activeLectureId && completedLectures.has(activeLectureId) && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-[#052e1e] border border-emerald-200 dark:border-[#065f46] rounded-md text-xs font-medium text-emerald-700 dark:text-[#10b981]">
                  <CheckCircle2 className="w-3 h-3" /> Completed
                </span>
              )}
            </div>
            <button onClick={handleCloseVideo} className="text-xs font-medium px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#242830] dark:hover:bg-[#1e2128] rounded-md transition-colors text-slate-700 dark:text-[#f0f2f5]">Close Player</button>
          </div>
          <video
            ref={videoRef}
            src={activeVideo}
            controls
            autoPlay
            className="w-full aspect-video outline-none bg-black"
            controlsList="nodownload"
            onTimeUpdate={handleTimeUpdate}
            onPause={handleVideoPause}
            onEnded={handleVideoPause}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-[#242830]">
        <button
          onClick={() => setActiveTab('lectures')}
          className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'lectures' ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-[#8b95a2] dark:hover:text-[#f0f2f5]'
          }`}
        >
          Video Curriculum
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'assignments' ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-[#8b95a2] dark:hover:text-[#f0f2f5]'
          }`}
        >
          Assignments
        </button>
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === 'lectures' && (
          <div className="space-y-3">
            {lectures.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-[#5a6474] border border-dashed border-slate-300 dark:border-[#242830] bg-slate-50 dark:bg-[#1a1d24] rounded-xl flex flex-col items-center">
                <Video className="w-8 h-8 text-slate-400 dark:text-[#5a6474] mb-3" />
                <p className="font-medium text-sm text-slate-900 dark:text-[#f0f2f5]">No video lectures yet</p>
                <p className="text-xs mt-1">Check back later when curriculum is assigned.</p>
              </div>
            ) : (
              lectures.map((lecture, index) => {
                const isCompleted = completedLectures.has(lecture._id);
                const prog = lectureProgress[lecture._id];
                const isActive = activeLectureId === lecture._id;
                return (
                  <div
                    key={lecture._id}
                    onClick={() => handlePlayLecture(lecture._id, lecture.title)}
                    className={`cursor-pointer p-4 rounded-xl flex items-center gap-4 border transition-colors ${
                      isActive
                        ? 'bg-blue-50 border-blue-200 dark:bg-[#1e2a3d] dark:border-[#2d4a7a]'
                        : isCompleted
                          ? 'bg-emerald-50 border-emerald-200 dark:bg-[#052e1e] dark:border-[#065f46] hover:border-emerald-300 dark:hover:border-[#10b981]'
                          : 'bg-white border-slate-200 dark:bg-[#13151a] dark:border-[#242830] hover:border-slate-300 dark:hover:border-[#5a6474]'
                    }`}
                  >
                    <div className="w-12 h-10 shrink-0 bg-slate-100 dark:bg-[#1a1d24] rounded-lg flex items-center justify-center">
                       {isCompleted
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-[#10b981]" />
                        : <PlayCircle size={20} className={`${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-[#5a6474]'} transition-colors`} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-medium transition-colors ${isCompleted ? 'text-emerald-800 dark:text-[#10b981]' : isActive ? 'text-blue-800 dark:text-blue-400' : 'text-slate-900 dark:text-[#f0f2f5]'}`}>
                        <span className={`mr-2 ${isCompleted ? 'text-emerald-500 dark:text-[#065f46]' : 'text-slate-400 dark:text-[#5a6474]'}`}>{index + 1}.</span>{lecture.title}
                      </h4>
                      {prog && prog.watchedSeconds > 0 && !isCompleted && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 dark:bg-[#242830] rounded-full h-1 max-w-[120px]">
                            <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${Math.min(100, (prog.watchedSeconds / 1) * 0)}%` }} />
                          </div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-[#8b95a2]">In Progress</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <input type="file" ref={fileInputRef} className="hidden" onChange={onFileChange} />
            {assignments.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-[#5a6474] border border-dashed border-slate-300 dark:border-[#242830] bg-slate-50 dark:bg-[#1a1d24] rounded-xl flex flex-col items-center">
                <FileText className="w-8 h-8 text-slate-400 dark:text-[#5a6474] mb-3" />
                <p className="font-medium text-sm text-slate-900 dark:text-[#f0f2f5]">No assignments due</p>
                <p className="text-xs mt-1">Check back later for new tasks.</p>
              </div>
            ) : (
              assignments.map(a => {
                const submission = a.studentSubmission;
                const hasSubmission = Boolean(submission?.hasFile);
                return (
                <div key={a._id} className="bg-white dark:bg-[#13151a] p-5 rounded-xl border border-slate-200 dark:border-[#242830] flex flex-col md:flex-row gap-5 md:items-start">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h4 className="text-base font-semibold text-slate-900 dark:text-[#f0f2f5]">{a.name}</h4>
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#1a1d24] border border-slate-200 dark:border-[#242830] text-slate-600 dark:text-[#8b95a2] text-[10px] font-semibold rounded uppercase tracking-wider">
                          Due {new Date(a.dueDate).toLocaleDateString()}
                        </span>
                        {hasSubmission && (
                          <span className="px-2 py-0.5 bg-emerald-50 dark:bg-[#052e1e] border border-emerald-200 dark:border-[#065f46] text-emerald-700 dark:text-[#10b981] text-[10px] font-semibold rounded uppercase tracking-wider">
                            Submitted
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-[#8b95a2] mt-2 text-sm leading-relaxed whitespace-pre-wrap">{a.description}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-[#0c0e12] px-2 py-1 text-xs font-medium text-slate-700 dark:text-[#8b95a2] border border-slate-200 dark:border-[#242830]">
                        Max Score: {a.maxMarks}
                      </span>
                      {submission?.submittedAt && (
                        <span className="inline-flex items-center rounded-md bg-white dark:bg-[#1a1d24] px-2 py-1 text-xs font-medium text-slate-500 dark:text-[#5a6474] border border-slate-200 dark:border-[#242830]">
                          Uploaded {new Date(submission.submittedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="md:w-48 shrink-0 flex flex-col pt-1">
                    {uploadProgress[a._id] ? (
                      <div className="w-full bg-slate-50 dark:bg-[#1a1d24] rounded-md p-3 border border-slate-200 dark:border-[#242830]">
                        <div className="w-full bg-slate-200 dark:bg-[#242830] rounded-full h-1.5 mb-2 overflow-hidden">
                          <div className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress[a._id]}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-center block text-blue-600 dark:text-blue-400 uppercase tracking-widest">Uploading {Math.floor(uploadProgress[a._id])}%</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {hasSubmission && submission?._id && (
                          <button
                            disabled={!!uploadingAssignmentId}
                            onClick={() => handleViewSubmission(submission._id)}
                            className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-[#242830] bg-white dark:bg-[#1a1d24] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f0f2f5] hover:bg-slate-50 dark:hover:bg-[#242830] transition-colors disabled:opacity-50"
                          >
                            <Eye size={14} /> View File
                          </button>
                        )}
                        <button
                          disabled={!!uploadingAssignmentId}
                          onClick={() => handleUploadClick(a._id)}
                          className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                            hasSubmission 
                              ? 'bg-slate-100 dark:bg-[#242830] text-slate-700 dark:text-[#f0f2f5] hover:bg-slate-200 dark:hover:bg-[#2d323c]'
                              : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500'
                          }`}
                        >
                          {hasSubmission ? <Pencil size={14} /> : <UploadCloud size={14} />}
                          {hasSubmission ? 'Replace File' : 'Submit Work'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )})
            )}
          </div>
        )}
      </div>
    </div>
  );
}

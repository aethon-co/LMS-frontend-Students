import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { Video, FileText, UploadCloud, PlayCircle, TrendingUp, CheckCircle2, BookOpen, Eye, Pencil } from 'lucide-react';
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

            // Populate already-completed set so we don't re-send
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

      // Recalculate completion counts
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

    // Debounce: send update every 5 seconds of real time
    if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
    progressDebounceRef.current = setTimeout(() => {
      sendProgressUpdate(lId, currentTime, duration, currentTime);
    }, 5000);

    // Eagerly mark completed in UI at threshold, send immediately
    if (watchedPct >= COMPLETION_THRESHOLD && !reportedCompletedRef.current.has(lId)) {
      reportedCompletedRef.current.add(lId);
      if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
      sendProgressUpdate(lId, currentTime, duration, currentTime);
    }
  }, [activeLectureId, sendProgressUpdate]);

  // Flush progress when video is paused or closed
  const handleVideoPause = useCallback(() => {
    const video = videoRef.current;
    const lId = activeLectureId;
    if (!video || !lId || !video.duration) return;
    if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
    sendProgressUpdate(lId, video.currentTime, video.duration, video.currentTime);
  }, [activeLectureId, sendProgressUpdate]);

  const handlePlayLecture = async (lectureId: string, title: string) => {
    // Flush prior video progress
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
    return <div className="p-12 text-center text-slate-500 font-bold animate-pulse">Loading curriculum...</div>;
  }

  if (!batch) {
    return <div className="p-12 text-center text-red-400 font-bold bg-red-500/10 border border-red-500/20 rounded-xl max-w-lg mx-auto mt-12">Course access error.</div>;
  }

  const completedLectures = new Set(
    Object.entries(lectureProgress)
      .filter(([, v]) => v.isCompleted)
      .map(([k]) => k)
  );
  const attendancePercentage =
    batchAttendance && typeof batchAttendance.percentage === 'number'
      ? batchAttendance.percentage
      : null;
  const hasAttendanceSessions = (batchAttendance?.totalClasses ?? 0) > 0;
  const attendanceTone = !hasAttendanceSessions
    ? 'empty'
    : attendancePercentage !== null && attendancePercentage >= 75
      ? 'good'
      : attendancePercentage !== null && attendancePercentage >= 50
        ? 'warn'
        : 'bad';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-slate-100 font-sans">
      <div className="fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${
              toast.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : 'border-red-500/30 bg-red-500/10 text-red-100'
            }`}
          >
            <p className="text-sm font-semibold">{toast.message}</p>
          </div>
        ))}
      </div>
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-3xl p-8 border border-slate-800 relative shadow-[0_0_15px_rgba(79,70,229,0.1)]">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/courses" className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-semibold tracking-wider uppercase">
            ← Back to Courses
          </Link>
        </div>
        <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-white">{batch.name}</h1>
        <p className="text-blue-200/80 text-lg">{batch.course?.name || "Premium Course Material"}</p>

        {/* Course Completion Progress */}
        {totalLectures > 0 && (
          <div className="mt-6 bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-300">Course Completion</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{completedCount}/{totalLectures} lectures</span>
                <span className={`text-lg font-extrabold ${courseCompletionPercentage === 100 ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {courseCompletionPercentage}%
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${courseCompletionPercentage === 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(79,70,229,0.4)]'}`}
                style={{ width: `${courseCompletionPercentage}%` }}
              />
            </div>
            {courseCompletionPercentage === 100 && (
              <div className="flex items-center gap-2 mt-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 text-xs font-semibold">🎉 Course Completed!</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attendance Banner */}
      {batchAttendance && (
        <div className={`rounded-2xl p-5 border flex items-center justify-between ${
          attendanceTone === 'good'
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : attendanceTone === 'warn'
              ? 'bg-amber-500/5 border-amber-500/20'
              : attendanceTone === 'bad'
                ? 'bg-red-500/5 border-red-500/20'
                : 'bg-slate-800/40 border-slate-700/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${
              attendanceTone === 'good'
                ? 'bg-emerald-500/10'
                : attendanceTone === 'warn'
                  ? 'bg-amber-500/10'
                  : attendanceTone === 'bad'
                    ? 'bg-red-500/10'
                    : 'bg-slate-700/40'
            }`}>
              <TrendingUp className={`w-5 h-5 ${
                attendanceTone === 'good'
                  ? 'text-emerald-400'
                  : attendanceTone === 'warn'
                    ? 'text-amber-400'
                    : attendanceTone === 'bad'
                      ? 'text-red-400'
                      : 'text-slate-400'
              }`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Your Attendance</p>
              <p className="text-xs text-slate-400">
                {hasAttendanceSessions
                  ? `${batchAttendance.attendedClasses} of ${batchAttendance.totalClasses} classes attended`
                  : 'No classes held yet'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  attendanceTone === 'good'
                    ? 'bg-emerald-500'
                    : attendanceTone === 'warn'
                      ? 'bg-amber-500'
                      : attendanceTone === 'bad'
                        ? 'bg-red-500'
                        : 'bg-slate-500'
                }`}
                style={{ width: `${attendancePercentage ?? 0}%` }}
              />
            </div>
            <span className={`text-2xl font-extrabold ${
              attendanceTone === 'good'
                ? 'text-emerald-400'
                : attendanceTone === 'warn'
                  ? 'text-amber-400'
                  : attendanceTone === 'bad'
                    ? 'text-red-400'
                    : 'text-slate-300'
            }`}>
              {attendancePercentage !== null ? `${attendancePercentage}%` : '--'}
            </span>
          </div>
        </div>
      )}

      {/* Video Player */}
      {activeVideo && (
        <div className="bg-black rounded-3xl overflow-hidden shadow-2xl relative border border-slate-800 animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/90 to-transparent z-10 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-lg">{videoTitle}</h3>
              {activeLectureId && completedLectures.has(activeLectureId) && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Completed
                </span>
              )}
            </div>
            <button onClick={handleCloseVideo} className="opacity-70 hover:opacity-100 font-bold px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors border border-white/10">Close Player</button>
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
            activeTab === 'lectures' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Video size={18} /> Video Curriculum
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-6 py-4 text-sm font-semibold border-b-2 transition-all gap-2 flex items-center ${
            activeTab === 'assignments' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
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
              lectures.map((lecture, index) => {
                const isCompleted = completedLectures.has(lecture._id);
                const prog = lectureProgress[lecture._id];
                const isActive = activeLectureId === lecture._id;
                return (
                  <div
                    key={lecture._id}
                    onClick={() => handlePlayLecture(lecture._id, lecture.title)}
                    className={`group cursor-pointer p-4 rounded-2xl flex items-center gap-4 border transition-all shadow-sm hover:-translate-y-0.5 ${
                      isActive
                        ? 'bg-blue-900/30 border-blue-500/50 shadow-[0_0_15px_rgba(79,70,229,0.2)]'
                        : isCompleted
                          ? 'bg-emerald-900/10 border-emerald-500/20 hover:bg-emerald-900/20'
                          : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:shadow-[0_0_15px_rgba(79,70,229,0.1)]'
                    }`}
                  >
                    <div className={`w-16 h-12 rounded-lg flex items-center justify-center transition-all shadow-inner ${
                      isCompleted ? 'bg-emerald-900/30' : 'bg-slate-900 group-hover:scale-110'
                    }`}>
                      {isCompleted
                        ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        : <PlayCircle size={24} className={`${isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-300'} transition-colors`} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-semibold transition-colors ${isCompleted ? 'text-emerald-300' : 'text-slate-100 group-hover:text-white'}`}>
                        <span className={`mr-2 ${isCompleted ? 'text-emerald-500' : 'text-blue-400'}`}>{index + 1}.</span>{lecture.title}
                      </h4>
                      {lecture.description && <p className="text-sm text-slate-400 mt-1 line-clamp-1">{lecture.description}</p>}
                      {prog && prog.watchedSeconds > 0 && !isCompleted && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 bg-slate-700/50 rounded-full h-1 overflow-hidden max-w-[160px]">
                            <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${Math.min(100, (prog.watchedSeconds / 1) * 0)}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">In Progress</span>
                        </div>
                      )}
                    </div>
                    {isCompleted && (
                      <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    )}
                    {!isCompleted && prog && prog.watchedSeconds > 5 && (
                      <span className="shrink-0 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-semibold text-blue-400">
                        In Progress
                      </span>
                    )}
                  </div>
                );
              })
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
              assignments.map(a => {
                const submission = a.studentSubmission;
                const hasSubmission = Boolean(submission?.hasFile);
                return (
                <div key={a._id} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 shadow-sm flex flex-col md:flex-row gap-6 md:items-start transition-colors hover:bg-slate-800">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                      <h4 className="text-xl font-bold text-white tracking-tight">{a.name}</h4>
                      <span className="w-fit px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-md uppercase tracking-wide">
                        Due {new Date(a.dueDate).toLocaleDateString()}
                      </span>
                      {hasSubmission && (
                        <span className="w-fit px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-md uppercase tracking-wide">
                          Submitted
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 mt-3 text-sm leading-relaxed whitespace-pre-wrap">{a.description}</p>
                    <div className="mt-5 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-700">
                        Max Score: {a.maxMarks}
                      </span>
                      {submission?.submittedAt && (
                        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                          Uploaded {new Date(submission.submittedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="md:w-56 shrink-0 flex flex-col">
                    {uploadProgress[a._id] ? (
                      <div className="w-full bg-slate-900 rounded-lg p-3 border border-slate-700">
                        <div className="w-full bg-slate-800 rounded-full h-2 mb-2 relative overflow-hidden">
                          <div className="bg-blue-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${uploadProgress[a._id]}%` }} />
                        </div>
                        <span className="text-xs font-bold text-center block animate-pulse text-blue-400 uppercase tracking-widest">Uploading {Math.floor(uploadProgress[a._id])}%</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {hasSubmission && submission?._id && (
                          <button
                            disabled={!!uploadingAssignmentId}
                            onClick={() => handleViewSubmission(submission._id)}
                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 transition-all disabled:opacity-50"
                          >
                            <Eye size={18} /> View Submission
                          </button>
                        )}
                        <button
                          disabled={!!uploadingAssignmentId}
                          onClick={() => handleUploadClick(a._id)}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 transition-all hover:shadow-[0_0_15px_rgba(79,70,229,0.4)] disabled:opacity-50 disabled:hover:bg-blue-600 disabled:hover:shadow-none"
                        >
                          {hasSubmission ? <Pencil size={18} /> : <UploadCloud size={18} />}
                          {hasSubmission ? 'Replace Submission' : 'Submit Work'}
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

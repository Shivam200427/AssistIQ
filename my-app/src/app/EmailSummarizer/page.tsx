"use client";
import { motion } from 'framer-motion';
import { Brain, Calendar, CirclePlus, Mail, Mails, Pencil, X, Sparkles, Copy, Check, Clock, Send, Paintbrush, RefreshCw, KeyRound, ExternalLink, ShieldAlert, UserCheck, ArrowRightLeft } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import Shymmer from '../components/Shymmer';
import axios from 'axios';
import Back from '../components/Back';

interface Email {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients?: {
    emailAddress: {
      name: string;
      address: string;
    };
  }[];
  receivedDateTime: string;
  importance: "low" | "normal" | "high";
  hasAttachments: boolean;
  categories?: string[];
  bodyPreview: string;
  body: {
    contentType: "Text" | "HTML";
    content: string;
  };
}

const DEMO_EMAILS: Email[] = [
  {
    id: "demo-1",
    subject: "Urgent: Operating Systems Project Milestone 2 Submission",
    from: {
      emailAddress: {
        name: "Prof. Raghav Sharma",
        address: "raghav.sharma@university.edu",
      },
    },
    receivedDateTime: new Date().toISOString(),
    importance: "high",
    hasAttachments: true,
    categories: ["Academic"],
    bodyPreview: "Reminder that Milestone 2 for the OS kernel thread scheduler is due this Friday by 11:59 PM. Submit via GitHub Classroom.",
    body: {
      contentType: "Text",
      content: "Dear Students,\n\nThis is an urgent reminder that Milestone 2 of your Operating Systems kernel project is strictly due this Friday at 11:59 PM. Please ensure your code passes all concurrency unit tests and that your team pull request is submitted on GitHub Classroom.\n\nLate submissions will incur a 10% penalty per day.\n\nRegards,\nProf. Raghav Sharma\nDepartment of Computer Science",
    },
  },
  {
    id: "demo-2",
    subject: "Campus Placement Drive: Round 1 Technical Interview Schedule",
    from: {
      emailAddress: {
        name: "Placement Cell Assist",
        address: "placements@university.edu",
      },
    },
    receivedDateTime: new Date(Date.now() - 3600000 * 4).toISOString(),
    importance: "high",
    hasAttachments: false,
    categories: ["Placement"],
    bodyPreview: "Shortlisted candidates for Vertex Cloud Systems must report for Round 1 interviews tomorrow at 10:00 AM in Seminar Hall 3.",
    body: {
      contentType: "Text",
      content: "Hello Candidates,\n\nCongratulations on clearing the preliminary coding assessment. Your Round 1 Technical Interviews with the Vertex Cloud engineering team are scheduled for tomorrow starting at 10:00 AM sharp in Seminar Hall 3.\n\nPlease bring two printed copies of your resume and your college ID card. Dress code is strictly formal.\n\nBest of luck,\nCareer Services & Placement Cell",
    },
  },
  {
    id: "demo-3",
    subject: "Class Schedule Update: Advanced Algorithms Lecture Venue Shift",
    from: {
      emailAddress: {
        name: "Academic Coordinator",
        address: "academics@university.edu",
      },
    },
    receivedDateTime: new Date(Date.now() - 3600000 * 24).toISOString(),
    importance: "normal",
    hasAttachments: false,
    categories: ["Notice"],
    bodyPreview: "Please note that tomorrow's 2 PM Advanced Algorithms lecture is shifted to Auditorium B due to maintenance.",
    body: {
      contentType: "Text",
      content: "Dear Students,\n\nPlease be informed that tomorrow's 2:00 PM - 3:30 PM lecture for Advanced Algorithms (CS-401) will be held in Auditorium B instead of Room 204 due to electrical maintenance.\n\nPlease arrive 5 minutes early.\n\nBest regards,\nAcademic Operations",
    },
  },
];

const Page = () => {
  const [SelectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "tags">("all");
  const [keywords, setkeywords] = useState<string[]>(["urgent", "assignment", "placement"]);
  const [keywordval, setkeywordval] = useState("");
  const [summary, setsummary] = useState("");
  const [draftmail, setdraftmail] = useState("");
  const [events, setevents] = useState("");
  const [loading, setloading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [showeditwindow, setshoweditwindow] = useState(false);
  const [Emails, setEmails] = useState<Email[]>([]);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [connectedUser, setConnectedUser] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [eventAddedStatus, setEventAddedStatus] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  const handleConnectOutlook = () => {
    window.location.href = "/api/auth/callback?redirect=/EmailSummarizer";
  };

  const handleSwitchAccount = async () => {
    try {
      await axios.get("/api/auth/logout");
    } catch (e) {}
    window.location.href = "/api/auth/callback?redirect=/EmailSummarizer";
  };

  const handleLoadDemo = () => {
    setUsingDemo(true);
    setIsAuthorized(true);
    setConnectedUser("demo.student@university.edu");
    setEmails(DEMO_EMAILS);
    if (DEMO_EMAILS.length > 0) {
      setSelectedEmail(DEMO_EMAILS[0]);
    }
  };

  const handleselectedemail = (email: Email) => {
    setsummary("");
    setdraftmail("");
    setevents("");
    setEventAddedStatus(null);
    setSelectedEmail(email);
  };

  const addkeyword = () => {
    const trimmed = keywordval.trim().toLowerCase();
    if (!trimmed || keywords.includes(trimmed)) return;
    setkeywords(prev => [...prev, trimmed]);
    setkeywordval("");
  };

  const deletekeyword = (idx: number) => {
    setkeywords(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCopyDraft = () => {
    if (!draftmail) return;
    navigator.clipboard.writeText(draftmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const editted = () => {
    const edit_content = (document.getElementById('edit') as HTMLTextAreaElement | null)?.value;
    if (edit_content) setdraftmail(edit_content);
    setshoweditwindow(false);
  };

  type CalendarDraft = { subject: string; date: string; startTime: string; endTime: string; location: string; allDay: boolean };
  const [calendarDraft, setCalendarDraft] = useState<CalendarDraft | null>(null);
  const [calendarMessage, setCalendarMessage] = useState("");

  // Step 1: propose an event (nothing is written yet) and open the preview.
  const handleAddToCalendar = async () => {
    if (!events || addingEvent) return;
    try {
      setAddingEvent(true);
      setCalendarMessage("");
      const today = new Date();
      const res = await axios.post('/api/calender/draft', {
        subject: SelectedEmail?.subject || "",
        events,
        today: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
      });
      setCalendarDraft(res.data.draft);
      setCalendarMessage(res.data.message || "");
    } catch {
      setCalendarDraft({ subject: SelectedEmail?.subject || "Event", date: "", startTime: "", endTime: "", location: "", allDay: false });
      setCalendarMessage("Couldn't read the details automatically — fill them in yourself.");
    } finally {
      setAddingEvent(false);
    }
  };

  // Step 2: write the event only after the student confirms the preview.
  const confirmCalendarEvent = async () => {
    if (!calendarDraft) return;
    if (usingDemo) {
      setCalendarMessage("Demo inbox: connect your Outlook account to add events to a real calendar.");
      return;
    }
    try {
      setAddingEvent(true);
      await axios.post('/api/calender', {
        confirmed: true,
        event: calendarDraft,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      setCalendarDraft(null);
      setEventAddedStatus("✓ Added to your calendar");
      setTimeout(() => setEventAddedStatus(null), 4000);
    } catch (err: any) {
      setCalendarMessage(err?.response?.data?.message || "The event couldn't be added. Nothing was changed in your calendar.");
    } finally {
      setAddingEvent(false);
    }
  };

  // AI Pipeline for selected email
  useEffect(() => {
    if (!SelectedEmail) return;

    const emailContent = {
      subject: SelectedEmail.subject,
      sender: SelectedEmail.from?.emailAddress?.name,
      content: SelectedEmail.body?.content || SelectedEmail.bodyPreview,
    };

    const runAI = async () => {
      try {
        setAiLoading(true);
        const [sumRes, draftRes, evRes] = await Promise.allSettled([
          axios.post("/api/email/summarize", emailContent),
          axios.post("/api/email/draft", emailContent),
          axios.post("/api/email/events", emailContent),
        ]);

        if (sumRes.status === "fulfilled") {
          setsummary(sumRes.value.data.summary || sumRes.value.data.message || "Summary complete.");
        } else {
          setsummary("Summary unavailable for this thread.");
        }

        if (draftRes.status === "fulfilled") {
          setdraftmail(draftRes.value.data.draft || draftRes.value.data.draftmail || draftRes.value.data.message || "Draft complete.");
        } else {
          setdraftmail("Suggested reply: Thank you for the update. Received and acknowledged.");
        }

        if (evRes.status === "fulfilled") {
          setevents(evRes.value.data.events || evRes.value.data.message || "No immediate deadlines detected.");
        } else {
          setevents("No calendar deadlines detected in this email.");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAiLoading(false);
      }
    };

    runAI();
  }, [SelectedEmail]);

  // Fetch emails from API on mount
  const fetchEmails = async () => {
    try {
      setloading(true);
      const res = await axios.get(`/api/emails?t=${Date.now()}`);
      if (Array.isArray(res.data)) {
        setIsAuthorized(true);
        setEmails(res.data);
        if (res.headers['x-user-email']) {
          setConnectedUser(res.headers['x-user-email']);
        }
        if (res.data.length > 0) {
          setSelectedEmail(res.data[0]);
        }
      }
    } catch (err: any) {
      console.log("Emails load notice:", err?.response?.status || err.message);
      if (err?.response?.status === 401) {
        setIsAuthorized(false);
      }
    } finally {
      setloading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const filteredEmails = Emails.filter(email => {
    if (filterMode === "all") return true;
    if (keywords.length === 0) return true;
    const content = `${email.subject} ${email.bodyPreview} ${email.from.emailAddress?.name || ""}`.toLowerCase();
    return keywords.some(kw => content.includes(kw));
  });

  return (
    <div className='relative min-h-screen bg-[#070a12] text-white font-body py-6 px-4 md:px-8'>
      <Back />

      {/* Header Banner */}
      <div className='max-w-7xl mx-auto pt-14 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#16243f]'>
        <div>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 text-[#38bdf8] font-tag text-xs uppercase mb-2 transform -rotate-1'>
            <Paintbrush className="w-3.5 h-3.5" />
            <span>✦ Email Summary ✦</span>
          </div>
          <h1 className='text-3xl sm:text-4xl font-extrabold text-white'>
            Email <span className='font-tag text-[#38bdf8] spray-glow'>Summary</span>
          </h1>
          <p className='text-gray-400 text-xs md:text-sm mt-1'>
            Extract essential action points, auto-draft replies, and sync deadlines from your connected inbox.
          </p>
        </div>

        {/* Auth / Status Pills */}
        <div className='flex items-center gap-2'>
          {isAuthorized === false && !usingDemo ? (
            <button
              onClick={handleConnectOutlook}
              className='flex items-center gap-2 text-xs font-bold bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] px-4 py-2.5 rounded-xl transition-all spray-glow shadow-[0_0_15px_rgba(14,165,233,0.4)] cursor-pointer'
            >
              <KeyRound className='w-4 h-4' />
              CONNECT OUTLOOK
            </button>
          ) : (
            <div className='flex items-center gap-2 text-xs text-[#38bdf8] bg-[#0d1527] px-4 py-2 rounded-xl border border-[#0ea5e9]/30 font-tag'>
              <span className='w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse' />
              <span className='truncate max-w-[200px]'>
                {usingDemo ? "DEMO INBOX PREVIEW" : connectedUser ? connectedUser : "OUTLOOK CONNECTED"}
              </span>
              <span className='text-gray-400'>({Emails.length} msgs)</span>
            </div>
          )}

          <button
            onClick={fetchEmails}
            title='Refresh Inbox'
            className='p-2 bg-[#0d1527] hover:bg-[#131e36] border border-[#16243f] rounded-xl text-gray-300 hover:text-[#38bdf8] transition-colors cursor-pointer'
          >
            <RefreshCw className='w-4 h-4' />
          </button>

          {isAuthorized && (
            <button
              onClick={handleSwitchAccount}
              title='Switch Account'
              className='p-2 bg-[#0d1527] hover:bg-[#131e36] border border-[#16243f] rounded-xl text-gray-300 hover:text-[#38bdf8] transition-colors cursor-pointer'
            >
              <ArrowRightLeft className='w-4 h-4' />
            </button>
          )}
        </div>
      </div>

      {/* Disconnected Notice Banner if not logged in */}
      {isAuthorized === false && !usingDemo && (
        <div className='max-w-7xl mx-auto mt-6 rounded-2xl bg-gradient-to-r from-[#0ea5e9]/20 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow'>
          <div className='w-full bg-[#0d1527] p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[#0ea5e9]/30'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-[#0ea5e9]/20 border border-[#0ea5e9]/40 flex items-center justify-center text-[#38bdf8]'>
                <ShieldAlert className='w-5 h-5' />
              </div>
              <div>
                <h3 className='text-sm font-bold text-white font-tag'>
                  OUTLOOK INBOX NOT CONNECTED
                </h3>
                <p className='text-xs text-gray-400'>
                  Link your Microsoft Outlook account to automatically fetch and summarize your actual incoming messages, or try the interactive demo preview.
                </p>
              </div>
            </div>

            <div className='flex items-center gap-2.5 w-full md:w-auto'>
              <button
                onClick={handleConnectOutlook}
                className='flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer'
              >
                <KeyRound className='w-3.5 h-3.5' />
                CONNECT NOW
              </button>
              <button
                onClick={handleLoadDemo}
                className='flex-1 md:flex-none bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/30 text-[#38bdf8] font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer'
              >
                LOAD DEMO INBOX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className='max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 mt-6'>
        
        {/* Left Sidebar: Filter Tabs + Email List */}
        <div className='w-full lg:w-[340px] h-[82vh] rounded-3xl bg-gradient-to-b from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow flex-shrink-0 flex flex-col'>
          <div className='flex flex-col w-full h-full bg-[#0d1527] p-3.5 rounded-3xl border border-[#16243f]'>
            
            {/* Filter Mode Selector */}
            <div className='flex items-center gap-1.5 p-1 bg-black/50 rounded-xl border border-[#16243f] mb-3'>
              <button
                onClick={() => setFilterMode("all")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filterMode === "all"
                    ? "bg-[#0ea5e9] text-[#070a12] shadow-[0_0_10px_rgba(14,165,233,0.4)]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                ALL ({Emails.length})
              </button>
              <button
                onClick={() => setFilterMode("tags")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filterMode === "tags"
                    ? "bg-[#0ea5e9] text-[#070a12] shadow-[0_0_10px_rgba(14,165,233,0.4)]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                TAGS ({filteredEmails.length})
              </button>
            </div>

            {/* Keyword Tag Input (Visible when in TAGS mode) */}
            {filterMode === "tags" && (
              <div className='mb-3 pb-3 border-b border-[#16243f]'>
                <div className='flex gap-1.5 mb-2'>
                  <input
                    className='flex-1 bg-black/60 border border-[#16243f] focus:border-[#38bdf8] rounded-xl px-2.5 py-1.5 text-xs text-white outline-none transition-colors'
                    placeholder='Add tag (e.g. exam)'
                    value={keywordval}
                    onChange={(e) => setkeywordval(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addkeyword()}
                  />
                  <button
                    onClick={addkeyword}
                    className='bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] font-bold text-xs px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer'
                  >
                    +
                  </button>
                </div>
                <div className='flex flex-wrap gap-1 max-h-[60px] overflow-y-auto custom-scroll'>
                  {keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className='inline-flex items-center gap-1 bg-[#131e36] border border-[#0ea5e9]/30 text-[#38bdf8] px-2 py-0.5 rounded-md text-[10px] font-tag'
                    >
                      {kw}
                      <X className='w-2.5 h-2.5 hover:text-red-400 cursor-pointer' onClick={() => deletekeyword(idx)} />
                    </span>
                  ))}
                  {keywords.length === 0 && (
                    <span className='text-[10px] text-gray-500'>No active tags. Showing all.</span>
                  )}
                </div>
              </div>
            )}

            {/* Header of List */}
            <div className='flex items-center justify-between px-2 py-1.5 mb-2'>
              <span className='text-xs font-bold text-[#38bdf8] flex items-center gap-2 uppercase font-tag'>
                <Mails className='w-4 h-4' /> {filterMode === "all" ? "Inbox Threads" : "Filtered Threads"}
              </span>
              <span className='text-[10px] text-gray-400 font-bold'>
                {filteredEmails.length} messages
              </span>
            </div>

            {/* Email Threads List */}
            {loading ? (
              <div className='flex-1 flex flex-col gap-2 p-2'>
                <Shymmer />
                <Shymmer />
                <Shymmer />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className='flex flex-col items-center justify-center flex-1 text-center p-4 text-gray-400 text-xs gap-3'>
                <Mail className='w-8 h-8 opacity-30 text-[#38bdf8]' />
                {isAuthorized === false && !usingDemo ? (
                  <>
                    <span className='text-gray-300 font-semibold'>Outlook Not Connected</span>
                    <p className='text-[11px] text-gray-500'>Click below to link your Microsoft account or preview demo messages.</p>
                    <div className='flex flex-col gap-2 w-full mt-2'>
                      <button
                        onClick={handleConnectOutlook}
                        className='w-full bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] font-bold py-2 rounded-xl text-xs cursor-pointer'
                      >
                        CONNECT ACCOUNT
                      </button>
                      <button
                        onClick={handleLoadDemo}
                        className='w-full bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/30 text-[#38bdf8] py-2 rounded-xl text-xs cursor-pointer'
                      >
                        LOAD DEMO EMAILS
                      </button>
                    </div>
                  </>
                ) : Emails.length === 0 ? (
                  <>
                    <span className='text-gray-300 font-bold font-tag text-sm uppercase'>0 Emails in this Inbox</span>
                    <p className='text-[11px] text-gray-400 leading-relaxed'>
                      Connected as: <span className='text-[#38bdf8] font-bold'>{connectedUser || "Current Account"}</span>.
                      If your school or primary emails are on another Microsoft account, click Switch Account below.
                    </p>
                    <div className='flex flex-col gap-2 w-full mt-2'>
                      <button
                        onClick={fetchEmails}
                        className='w-full bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer'
                      >
                        <RefreshCw className='w-3.5 h-3.5' /> REFRESH INBOX
                      </button>
                      <button
                        onClick={handleSwitchAccount}
                        className='w-full bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/30 text-[#38bdf8] py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer'
                      >
                        <ArrowRightLeft className='w-3.5 h-3.5' /> SWITCH OUTLOOK ACCOUNT
                      </button>
                      <button
                        onClick={handleLoadDemo}
                        className='w-full bg-black/40 hover:bg-[#11192e] border border-[#16243f] text-gray-400 hover:text-white py-2 rounded-xl text-xs cursor-pointer'
                      >
                        PREVIEW DEMO EMAILS
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>No emails match your active tags.</span>
                    <button
                      onClick={() => setFilterMode("all")}
                      className='bg-[#131e36] hover:bg-[#1a2947] border border-[#0ea5e9]/30 text-[#38bdf8] px-3 py-1.5 rounded-lg text-xs cursor-pointer'
                    >
                      VIEW ALL EMAILS ({Emails.length})
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className='flex flex-col gap-2 w-full flex-1 overflow-y-auto custom-scroll pr-1'>
                {filteredEmails.map((email, index) => {
                  const isSelected = SelectedEmail?.id === email.id;
                  return (
                    <div
                      key={email.id || index}
                      onClick={() => handleselectedemail(email)}
                      className={`p-3 rounded-2xl transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-[#131e36] border-[#38bdf8] shadow-[0_0_15px_rgba(14,165,233,0.3)]"
                          : "bg-black/40 border-[#16243f] hover:border-[#0ea5e9]/40 hover:bg-[#11192e]"
                      }`}
                    >
                      <div className='flex justify-between items-center mb-1'>
                        <span className='text-xs font-bold truncate text-white max-w-[170px]'>
                          {email.from?.emailAddress?.name || "Unknown"}
                        </span>
                        <span className='text-[10px] text-gray-400'>
                          {new Date(email.receivedDateTime).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <div className='text-xs text-[#38bdf8] font-medium truncate mb-1'>
                        {email.subject || "(No Subject)"}
                      </div>
                      <div className='text-[11px] text-gray-400 line-clamp-2 leading-relaxed'>
                        {email.bodyPreview}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Selected Email & AI Output Panels */}
        {SelectedEmail ? (
          <div className='flex-1 flex flex-col lg:flex-row gap-6'>
            
            {/* Email Viewer Column */}
            <div className='flex-1 flex flex-col gap-6 min-h-[82vh]'>
              
              {/* Selected Email Message Box */}
              <div className='rounded-3xl bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow flex-1'>
                <div className='w-full h-full bg-[#0d1527] p-5 rounded-3xl flex flex-col border border-[#16243f]'>
                  <div className='flex items-center justify-between pb-3 border-b border-[#16243f] mb-3'>
                    <span className='text-xs font-bold text-[#38bdf8] flex items-center gap-2 uppercase font-tag'>
                      <Mail className='w-4 h-4' /> Active Message
                    </span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      SelectedEmail.importance === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-[#0ea5e9]/15 text-[#38bdf8] border border-[#0ea5e9]/30'
                    }`}>
                      {SelectedEmail.importance} PRIORITY
                    </span>
                  </div>

                  <h2 className='text-lg font-bold text-white mb-2 leading-snug'>
                    {SelectedEmail.subject}
                  </h2>

                  <div className='flex justify-between items-center text-xs text-gray-400 mb-4 pb-3 border-b border-[#16243f]'>
                    <div>
                      <span className='text-gray-200 font-semibold'>{SelectedEmail.from?.emailAddress?.name}</span>
                      <span className='text-gray-500 ml-2'>&lt;{SelectedEmail.from?.emailAddress?.address}&gt;</span>
                    </div>
                    <span className='text-gray-400'>
                      {new Date(SelectedEmail.receivedDateTime).toLocaleString()}
                    </span>
                  </div>

                  <div className='flex-1 overflow-y-auto custom-scroll text-xs text-gray-300 leading-relaxed bg-black/40 p-4 rounded-2xl border border-[#16243f] min-h-[220px]'>
                    {SelectedEmail.body?.contentType?.toUpperCase() === "HTML" ? (
                      // Sandboxed iframe (no scripts, no same-origin access) so email HTML cannot run code in the app.
                      <iframe
                        title='Email content'
                        sandbox=''
                        referrerPolicy='no-referrer'
                        className='w-full min-h-[320px] rounded-xl bg-white'
                        srcDoc={SelectedEmail.body.content || ""}
                      />
                    ) : (
                      <p className='whitespace-pre-wrap'>{SelectedEmail.body?.content || SelectedEmail.bodyPreview}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Summary Box */}
              <div className='rounded-3xl bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow h-[250px]'>
                <div className='w-full h-full bg-[#0d1527] p-5 rounded-3xl flex flex-col border border-[#16243f]'>
                  <div className='flex items-center justify-between pb-2.5 border-b border-[#16243f] mb-2'>
                    <div className='flex items-center gap-2'>
                      <Brain className='w-4 h-4 text-[#38bdf8]' />
                      <span className='text-xs font-bold text-[#38bdf8] uppercase font-tag'>
                        ✦ AI ACTION SUMMARY ✦
                      </span>
                    </div>
                    {aiLoading && (
                      <span className='text-[10px] text-[#38bdf8] animate-pulse font-tag'>
                        ANALYZING...
                      </span>
                    )}
                  </div>
                  <div className='flex-1 overflow-y-auto custom-scroll text-xs text-gray-200 p-3 bg-black/40 rounded-2xl leading-relaxed whitespace-pre-wrap'>
                    {aiLoading && !summary ? <Shymmer /> : summary}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Control Center Column (Reply + Deadlines) */}
            <div className='w-full lg:w-[360px] flex flex-col gap-6 flex-shrink-0'>
              
              {/* Auto Draft Reply Card */}
              <div className='rounded-3xl bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow flex-1 min-h-[300px]'>
                <div className='w-full h-full bg-[#0d1527] p-5 rounded-3xl flex flex-col border border-[#16243f]'>
                  <div className='flex items-center justify-between pb-2 border-b border-[#16243f] mb-2'>
                    <span className='text-xs font-bold text-[#38bdf8] flex items-center gap-2 uppercase font-tag'>
                      <Sparkles className='w-4 h-4' /> AI Suggested Reply
                    </span>
                    <div className='flex items-center gap-2'>
                      {draftmail && (
                        <>
                          <button
                            onClick={handleCopyDraft}
                            className='text-gray-400 hover:text-[#38bdf8] transition-colors p-1 cursor-pointer'
                            title='Copy reply'
                          >
                            {copied ? <Check className='w-3.5 h-3.5 text-[#38bdf8]' /> : <Copy className='w-3.5 h-3.5' />}
                          </button>
                          <button
                            onClick={() => setshoweditwindow(true)}
                            className='text-gray-400 hover:text-[#38bdf8] transition-colors p-1 cursor-pointer'
                            title='Edit reply'
                          >
                            <Pencil className='w-3.5 h-3.5' />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className='flex-1 overflow-y-auto custom-scroll text-xs text-gray-200 p-3 bg-black/40 rounded-2xl leading-relaxed whitespace-pre-wrap'>
                    {aiLoading && !draftmail ? <Shymmer /> : draftmail}
                  </div>
                </div>
              </div>

              {/* Events & Calendar Sync Card */}
              <div className='rounded-3xl bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow'>
                <div className='w-full bg-[#0d1527] p-5 rounded-3xl border border-[#16243f] flex flex-col gap-2'>
                  <div className='flex items-center justify-between pb-2 border-b border-[#16243f]'>
                    <span className='text-xs font-bold text-[#38bdf8] flex items-center gap-2 uppercase font-tag'>
                      <Calendar className='w-4 h-4' /> Detected Deadlines
                    </span>
                  </div>
                  <div className='text-xs text-gray-300 p-3 bg-black/40 rounded-2xl leading-relaxed max-h-[120px] overflow-y-auto custom-scroll'>
                    {aiLoading && !events ? <Shymmer /> : events}
                  </div>
                  {events && (
                    <button
                      onClick={handleAddToCalendar}
                      disabled={addingEvent}
                      className='mt-2 w-full bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] hover:from-[#7dd3fc] hover:to-[#38bdf8] text-[#070a12] font-bold text-xs py-2.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50'
                    >
                      {eventAddedStatus || (addingEvent ? "Preparing preview…" : "Add to calendar…")}
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className='flex-1 h-[82vh] rounded-3xl bg-gradient-to-br from-[#0ea5e9]/30 via-[#16243f] to-[#070a12] p-[2px] card-spray-shadow'>
            <div className='w-full h-full bg-[#0d1527] rounded-3xl flex flex-col items-center justify-center text-center p-8 border border-[#16243f]'>
              <div className='w-16 h-16 rounded-2xl bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 flex items-center justify-center mb-4 text-[#38bdf8]'>
                <Mail className='w-8 h-8' />
              </div>
              <h3 className='text-2xl font-extrabold text-white font-tag'>
                Select an Email to Inspect
              </h3>
              <p className='text-gray-400 text-xs sm:text-sm max-w-md mt-2'>
                Choose any thread from the inbox on the left to extract instant action summaries, suggested replies, and calendar deadlines.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Calendar event preview — nothing is written until the student confirms */}
      {calendarDraft && (
        <div className='fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4' role='dialog' aria-modal='true' aria-label='Review calendar event'>
          <div className='w-full max-w-md rounded-3xl bg-[#0d1527] border border-[#16243f] p-6 flex flex-col gap-3 text-sm'>
            <div className='flex justify-between items-center'>
              <h2 className='font-bold text-white text-base'>Review event before adding</h2>
              <button onClick={() => setCalendarDraft(null)} className='text-gray-400 hover:text-white p-1 cursor-pointer' aria-label='Cancel'>
                <X className='w-5 h-5' />
              </button>
            </div>
            <p className='text-xs text-gray-400'>Check the details. Nothing is added to your calendar until you press Confirm.</p>
            <label className='text-xs text-gray-300'>Title
              <input value={calendarDraft.subject} onChange={(e) => setCalendarDraft({ ...calendarDraft, subject: e.target.value })} className='mt-1 w-full rounded-xl border border-[#16243f] bg-black/50 px-3 py-2 text-white outline-none focus:border-[#38bdf8]' />
            </label>
            <label className='text-xs text-gray-300'>Date
              <input type='date' value={calendarDraft.date} onChange={(e) => setCalendarDraft({ ...calendarDraft, date: e.target.value })} className='mt-1 w-full rounded-xl border border-[#16243f] bg-black/50 px-3 py-2 text-white outline-none focus:border-[#38bdf8]' />
            </label>
            <label className='flex items-center gap-2 text-xs text-gray-300 cursor-pointer'>
              <input type='checkbox' checked={calendarDraft.allDay} onChange={(e) => setCalendarDraft({ ...calendarDraft, allDay: e.target.checked })} className='accent-[#38bdf8]' /> All-day
            </label>
            {!calendarDraft.allDay && (
              <div className='grid grid-cols-2 gap-2'>
                <label className='text-xs text-gray-300'>Start
                  <input type='time' value={calendarDraft.startTime} onChange={(e) => setCalendarDraft({ ...calendarDraft, startTime: e.target.value })} className='mt-1 w-full rounded-xl border border-[#16243f] bg-black/50 px-3 py-2 text-white outline-none focus:border-[#38bdf8]' />
                </label>
                <label className='text-xs text-gray-300'>End
                  <input type='time' value={calendarDraft.endTime} onChange={(e) => setCalendarDraft({ ...calendarDraft, endTime: e.target.value })} className='mt-1 w-full rounded-xl border border-[#16243f] bg-black/50 px-3 py-2 text-white outline-none focus:border-[#38bdf8]' />
                </label>
              </div>
            )}
            <label className='text-xs text-gray-300'>Location (optional)
              <input value={calendarDraft.location} onChange={(e) => setCalendarDraft({ ...calendarDraft, location: e.target.value })} className='mt-1 w-full rounded-xl border border-[#16243f] bg-black/50 px-3 py-2 text-white outline-none focus:border-[#38bdf8]' />
            </label>
            {calendarMessage && <p role='alert' className='text-xs text-amber-300'>{calendarMessage}</p>}
            <div className='flex justify-end gap-2 pt-2'>
              <button onClick={() => setCalendarDraft(null)} className='rounded-xl border border-[#16243f] px-4 py-2 text-gray-200 cursor-pointer'>Cancel</button>
              <button
                onClick={confirmCalendarEvent}
                disabled={addingEvent || !calendarDraft.subject.trim() || !calendarDraft.date || (!calendarDraft.allDay && (!calendarDraft.startTime || !calendarDraft.endTime))}
                className='rounded-xl bg-[#38bdf8] px-4 py-2 font-bold text-[#070a12] hover:bg-[#7dd3fc] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'
              >
                {addingEvent ? "Adding…" : "Confirm & add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Draft Modal */}
      {showeditwindow && (
        <div className='fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4'>
          <div className='w-full max-w-xl rounded-3xl bg-gradient-to-br from-[#38bdf8] to-[#0284c7] p-[2px] card-spray-shadow'>
            <div className='bg-[#0d1527] rounded-3xl p-6 border border-[#16243f] flex flex-col gap-4'>
              <div className='flex justify-between items-center pb-2 border-b border-[#16243f]'>
                <span className='font-bold text-sm text-white font-tag uppercase'>✦ EDIT DRAFT REPLY ✦</span>
                <button
                  onClick={() => setshoweditwindow(false)}
                  className='text-gray-400 hover:text-white p-1 cursor-pointer'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
              <textarea
                id='edit'
                defaultValue={draftmail}
                className='h-[250px] w-full resize-none bg-black/60 border border-[#16243f] rounded-2xl p-4 overflow-y-auto custom-scroll text-xs text-gray-200 outline-none focus:border-[#38bdf8]'
              />
              <button
                onClick={editted}
                className='w-full bg-[#0ea5e9] hover:bg-[#38bdf8] text-[#070a12] font-bold uppercase text-xs py-3 rounded-xl transition-all cursor-pointer'
              >
                SAVE DRAFT // READY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;

import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

/* --- 🌸 Background Petals --- */
const PETAL_COLORS = ["#ffb703", "#fb8500", "#ff7b54", "#ffd166", "#e63946"];
const PETALS = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 9) % 100,
  size: 9 + ((i * 5) % 11),
  dur: 11 + ((i * 7) % 9),
  delay: -((i * 3.1) % 16),
  color: PETAL_COLORS[i % PETAL_COLORS.length],
}));

/* --- 🏵️ Rotating Mandala --- */
function Mandala({ className }) {
  return (
    <svg className={className} viewBox="-200 -200 400 400" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        <circle r="196" />
        <circle r="186" strokeDasharray="1.5 5" />
        <circle r="118" />
        <circle r="68" />
        <circle r="28" />
        {Array.from({ length: 16 }).map((_, i) => (
          <g key={i} transform={`rotate(${i * 22.5})`}>
            <path d="M0 -120 C 26 -142 26 -168 0 -184 C -26 -168 -26 -142 0 -120Z" />
            <path d="M0 -70 C 12 -84 12 -102 0 -116 C -12 -102 -12 -84 0 -70Z" />
            <path d="M0 -30 L 8 -48 L 0 -66 L -8 -48 Z" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function Photo({ src, name }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("");
    return <div className="photo-fallback">{initials}</div>;
  }
  return <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Core Data States
  const [profile, setProfile] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [acceptedIds, setAcceptedIds] = useState([]);
  const [sentRequestIds, setSentRequestIds] = useState([]);

  // 🚫 Blocked Users State (Saved per user)
  const [blockedIds, setBlockedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`pairperfect_blocked_${user?._id || user?.id}`)) || [];
    } catch {
      return [];
    }
  });

  // UI States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("matches"); // "matches" | "requests" | "biodata" | "blocked"
  const [bioSection, setBioSection] = useState("all");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [toastAlert, setToastAlert] = useState("");
  const [matchSearch, setMatchSearch] = useState("");

  // ✏️ Quick Bio Edit Modal State
  const [showQuickBioModal, setShowQuickBioModal] = useState(false);
  const [quickBioForm, setQuickBioForm] = useState({ about: "", partnerPreference: "" });
  const [savingBio, setSavingBio] = useState(false);

  const calculateAge = (dobString) => {
    if (!dobString) return 24;
    const born = new Date(dobString);
    const now = new Date();
    let age = now.getFullYear() - born.getFullYear();
    const beforeBirthday =
      now.getMonth() < born.getMonth() ||
      (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
    if (beforeBirthday) age--;
    return age > 0 ? age : 24;
  };

  const getProfileUserId = (p) => String(p?.user?._id || p?.user || p?._id);

  // Fetch Connections
  const fetchConnections = useCallback(async () => {
    if (!user) return;
    try {
      const [pendingRes, acceptedRes] = await Promise.all([
        api.get("/connections/pending").catch(() => ({ data: [] })),
        api.get("/connections/accepted").catch(() => ({ data: [] })),
      ]);
      setPendingRequests(pendingRes.data || []);
      setAcceptedIds((acceptedRes.data || []).map((person) => String(person._id)));
    } catch {
      // ignore
    }
  }, [user]);

  // Initial Fetch
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      api.get("/profile/me").catch(() => ({ data: null })),
      api.get("/profile").catch(() => ({ data: [] })),
      api.get("/connections/pending").catch(() => ({ data: [] })),
      api.get("/connections/accepted").catch(() => ({ data: [] })),
    ])
      .then(([meRes, allRes, pendingRes, acceptedRes]) => {
        if (!isMounted) return;
        setProfile(meRes.data);
        if (meRes.data) {
          setQuickBioForm({
            about: meRes.data.about || "",
            partnerPreference: meRes.data.partnerPreference || "",
          });
        }

        const list = Array.isArray(allRes.data)
          ? allRes.data
          : allRes.data?.profiles && Array.isArray(allRes.data.profiles)
          ? allRes.data.profiles
          : [];
        setAllProfiles(list);

        setPendingRequests(pendingRes.data || []);
        setAcceptedIds((acceptedRes.data || []).map((p) => String(p._id)));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Handle Send Interest
  const handleConnect = async (targetId, targetName) => {
    try {
      await api.post("/connections/send", { receiverId: targetId });
      setSentRequestIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
      setToastAlert(`Interest request sent to ${targetName || "Match"}! 💌`);
    } catch (err) {
      setToastAlert(err.response?.data?.message || "Request send nahi ho saki.");
    }
  };

  // Handle Respond
  const handleRespond = async (connectionId, status, senderName) => {
    try {
      await api.post("/connections/respond", { connectionId, status });
      await fetchConnections();
      setToastAlert(status === "accepted" ? `${senderName || "Request"} accepted! 💬` : "Request rejected.");
    } catch (err) {
      setToastAlert(err.response?.data?.message || "Action fail ho gaya.");
    }
  };

  // 🚫 Handle Block User
  const handleBlockUser = (targetId, targetName) => {
    if (window.confirm(`Kya aap sach me ${targetName || "is user"} ko block karna chahte hain?`)) {
      const updated = [...blockedIds, targetId];
      setBlockedIds(updated);
      try {
        localStorage.setItem(`pairperfect_blocked_${user?._id || user?.id}`, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      setToastAlert(`${targetName || "Profile"} block ho gayi hai 🚫`);
      setSelectedMatch(null);
    }
  };

  // 🔓 Handle Unblock User
  const handleUnblockUser = (targetId, targetName) => {
    const updated = blockedIds.filter((id) => id !== targetId);
    setBlockedIds(updated);
    try {
      localStorage.setItem(`pairperfect_blocked_${user?._id || user?.id}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setToastAlert(`${targetName || "Profile"} unblock ho gayi! ✓`);
  };

  // ✏️ Quick Save Bio
  const handleSaveQuickBio = async (e) => {
    e.preventDefault();
    setSavingBio(true);
    try {
      const res = await api.post("/profile", {
        ...profile,
        about: quickBioForm.about,
        partnerPreference: quickBioForm.partnerPreference,
      });
      setProfile(res.data);
      setShowQuickBioModal(false);
      setToastAlert("Aapka bio kamyabi se update ho gaya! ✨");
    } catch (err) {
      setToastAlert(err.response?.data?.message || "Bio update nahi ho saka.");
    } finally {
      setSavingBio(false);
    }
  };

  // 🗑️ Delete/Reset Profile
  const handleDeleteProfile = async () => {
    const userInput = prompt("Apna pura bio-data delete karne ke liye 'DELETE' likhein:");
    if (userInput === "DELETE") {
      try {
        await api.delete("/profile/me").catch(() => api.delete("/profile"));
        setProfile(null);
        localStorage.removeItem(`pairperfect_draft_${user?._id || user?.id}`);
        setToastAlert("Aapka bio-data successfully delete ho chuka hai.");
      } catch (err) {
        setToastAlert(err.response?.data?.message || "Profile delete nahi ho saki.");
      }
    }
  };

  // Target Gender & Filtered Matches (Blocks & Search applied)
  const recommendedMatches = useMemo(() => {
    const myGender = profile?.gender?.toLowerCase() || "";
    const targetGender = myGender === "male" ? "female" : myGender === "female" ? "male" : null;

    return allProfiles.filter((p) => {
      const targetUserId = getProfileUserId(p);
      if (profile?._id && p._id === profile._id) return false;
      if (blockedIds.includes(targetUserId)) return false; // Filter out blocked
      if (targetGender && p.gender?.toLowerCase() !== targetGender) return false;

      // Search Filter
      if (matchSearch.trim()) {
        const query = matchSearch.toLowerCase();
        const matchesName = p.fullName?.toLowerCase().includes(query);
        const matchesCity = p.city?.toLowerCase().includes(query);
        const matchesJob = p.occupation?.toLowerCase().includes(query);
        const matchesCaste = p.caste?.toLowerCase().includes(query);
        return matchesName || matchesCity || matchesJob || matchesCaste;
      }
      return true;
    });
  }, [allProfiles, profile, blockedIds, matchSearch]);

  // Blocked users list
  const blockedUsersList = useMemo(() => {
    return allProfiles.filter((p) => blockedIds.includes(getProfileUserId(p)));
  }, [allProfiles, blockedIds]);

  const completeness = useMemo(() => {
    if (!profile) return 30;
    const keyFields = [
      "fullName", "gender", "dob", "phone", "religion",
      "caste", "education", "occupation", "city", "photoUrl",
      "about", "partnerPreference",
    ];
    let filled = 0;
    keyFields.forEach((f) => {
      if (profile[f]) filled++;
    });
    return Math.round((filled / keyFields.length) * 100);
  }, [profile]);

  if (loading) {
    return (
      <>
        <style>{dashboardStyles}</style>
        <div className="dash-layout">
          <div className="dash-loading-screen">
            <span className="loading-flower">🌸</span>
            <p>Loading your sacred command center...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{dashboardStyles}</style>
      <div className="dash-layout">
        
        {/* Floating Notification Toast */}
        {toastAlert && (
          <div className="floating-toast" role="status">
            <span>✨ {toastAlert}</span>
            <button onClick={() => setToastAlert("")} aria-label="Dismiss alert">✕</button>
          </div>
        )}

        {/* Ambient Animated Background */}
        <div className="dash-bg-layer" aria-hidden="true">
          <div className="ambient-blob b1" />
          <div className="ambient-blob b2" />
          <Mandala className="bg-mandala m-left" />
          <Mandala className="bg-mandala m-right" />

          {PETALS.map((p, i) => (
            <i
              key={i}
              className="dash-petal"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: p.color,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
          <div className="dash-grain" />
        </div>

        {/* ================= 1. NAVBAR ================= */}
        <header className="dash-nav">
          <Link to="/" className="brand-logo" aria-label="PairPerfect Matrimony">
            <svg className="logo-rings" viewBox="0 0 44 28" aria-hidden="true">
              <circle cx="15" cy="15" r="10" />
              <circle cx="29" cy="15" r="10" />
              <path d="M22 2 L25 6.5 L22 11 L19 6.5 Z" />
            </svg>
            <span className="brand-text">
              <span className="brand-name">Pair<b>Perfect</b></span>
              <small className="logo-sub">Pavitra Rishtey</small>
            </span>
          </Link>

          <div className="header-actions">
            <Link to="/messages" className="nav-chat-btn" title="Open Messages">
              💬 <span className="nav-btn-text">Chats</span>
            </Link>
            <Link to="/" className="browse-matches-btn" title="Browse All Profiles">
              🔍 <span className="nav-btn-text">Explore</span>
            </Link>
            <button onClick={logout} className="logout-btn" aria-label="Log out">
              Logout
            </button>
          </div>
        </header>

        {/* ================= 2. MAIN HUB ================= */}
        <main className="dash-main-container">
          
          {/* Welcome User Banner */}
          <div className="user-hero-banner">
            <div className="user-hero-left">
              <div className="user-avatar-badge">
                <Photo src={profile?.photoUrl} name={profile?.fullName || user?.name} />
                <span className="online-dot" title="Active Account" />
              </div>
              <div className="user-hero-info">
                <span className="shubh-tag">॥ शुभ विवाह ॥</span>
                <h2>Namaste, {profile?.fullName?.split(" ")[0] || user?.name}!</h2>
                <p className="hero-subline">
                  {profile?.occupation || "Member"} • {profile?.city || "India"}
                </p>
              </div>
            </div>

            <div className="user-hero-right">
              <div className="profile-meter-box">
                <div className="meter-label-row">
                  <span>Profile Strength</span>
                  <strong>{completeness}%</strong>
                </div>
                <div className="meter-bar-track">
                  <div className="meter-bar-fill" style={{ width: `${completeness}%` }} />
                </div>
              </div>
              <div className="hero-btn-group">
                <button onClick={() => setShowQuickBioModal(true)} className="btn-quick-bio">
                  ✎ Quick Bio
                </button>
                <Link to="/create-profile" className="btn-edit-bio">
                  Full Form ➔
                </Link>
              </div>
            </div>
          </div>

          {/* ================= 3. INSTAGRAM STORIES CAROUSEL ================= */}
          <section className="stories-section">
            <div className="stories-header">
              <span className="stories-title">✨ Active Matches Today</span>
              <small>Tap on any story to view instant bio</small>
            </div>

            <div className="stories-scroll-row">
              {recommendedMatches.length === 0 ? (
                <div className="empty-story-note">Searching prospective brides & grooms in your community...</div>
              ) : (
                recommendedMatches.slice(0, 15).map((match) => (
                  <button
                    key={match._id}
                    className="story-avatar-item"
                    onClick={() => setSelectedMatch(match)}
                    aria-label={`View ${match.fullName}`}
                  >
                    <div className="story-ring">
                      <div className="story-img-wrap">
                        <Photo src={match.photoUrl} name={match.fullName} />
                      </div>
                    </div>
                    <span className="story-name">{match.fullName?.split(" ")[0]}</span>
                    <span className="story-age">{calculateAge(match.dob)}y • {match.city?.split(",")[0] || "India"}</span>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* ================= 4. QUICK STATS RIBBON (2x2 GRID ON MOBILE) ================= */}
          <section className="quick-stats-ribbon">
            <div
              className={`stat-pill-card ${activeTab === "matches" ? "active" : ""}`}
              onClick={() => setActiveTab("matches")}
            >
              <div className="stat-icon-wrap">💫</div>
              <div className="stat-details">
                <span className="stat-count">{recommendedMatches.length}</span>
                <span className="stat-label">Matches</span>
              </div>
            </div>

            <div
              className={`stat-pill-card ${activeTab === "requests" ? "active" : ""}`}
              onClick={() => setActiveTab("requests")}
            >
              <div className="stat-icon-wrap">🔔</div>
              <div className="stat-details">
                <span className="stat-count">{pendingRequests.length}</span>
                <span className="stat-label">Requests</span>
              </div>
            </div>

            <div
              className="stat-pill-card"
              onClick={() => navigate("/messages")}
            >
              <div className="stat-icon-wrap">💬</div>
              <div className="stat-details">
                <span className="stat-count">{acceptedIds.length}</span>
                <span className="stat-label">Connected</span>
              </div>
            </div>

            <div
              className={`stat-pill-card ${activeTab === "biodata" ? "active" : ""}`}
              onClick={() => setActiveTab("biodata")}
            >
              <div className="stat-icon-wrap">📜</div>
              <div className="stat-details">
                <span className="stat-count">{completeness}%</span>
                <span className="stat-label">My Bio</span>
              </div>
            </div>
          </section>

          {/* ================= 5. TABS BAR (EQUAL GRID ON MOBILE) ================= */}
          <div className="dashboard-tabs-bar">
            <button
              className={`tab-btn ${activeTab === "matches" ? "on" : ""}`}
              onClick={() => setActiveTab("matches")}
            >
              🌟 Matches ({recommendedMatches.length})
            </button>
            <button
              className={`tab-btn ${activeTab === "requests" ? "on" : ""}`}
              onClick={() => setActiveTab("requests")}
            >
              💌 Requests ({pendingRequests.length})
            </button>
            <button
              className={`tab-btn ${activeTab === "biodata" ? "on" : ""}`}
              onClick={() => setActiveTab("biodata")}
            >
              📜 My Bio-Data
            </button>
            {blockedIds.length > 0 && (
              <button
                className={`tab-btn tab-blocked ${activeTab === "blocked" ? "on" : ""}`}
                onClick={() => setActiveTab("blocked")}
              >
                🚫 Blocked ({blockedIds.length})
              </button>
            )}
          </div>

          {/* ================= TAB 1: RECOMMENDED MATCHES (WITH SEARCH + MOBILE CAROUSEL SLIDER) ================= */}
          {activeTab === "matches" && (
            <div className="matches-tab-content">
              {/* 🔍 Search Input for Matches */}
              <div className="matches-search-box">
                <span className="search-ico">🔍</span>
                <input
                  type="text"
                  placeholder="Search matches by name, city, job, caste..."
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  className="matches-search-input"
                />
                {matchSearch && (
                  <button onClick={() => setMatchSearch("")} className="search-clear-btn">✕</button>
                )}
              </div>

              {recommendedMatches.length === 0 ? (
                <div className="empty-feed-card">
                  <span className="empty-icon">🕊️</span>
                  <h3>No matches found</h3>
                  <p>{matchSearch ? "Koi profile search query se match nahi hui." : "Naye profiles aate hi yahan dikhenge."}</p>
                </div>
              ) : (
                <>
                  <div className="slider-indicator-note">
                    <span>📱 Swipe horizontally ➔ to browse cards</span>
                  </div>

                  {/* Desktop Grid / Mobile Swipe Slider */}
                  <div className="matches-feed-grid mobile-slider">
                    {recommendedMatches.map((item) => {
                      const targetUserId = getProfileUserId(item);
                      const isConnected = acceptedIds.includes(targetUserId);
                      const isSent = sentRequestIds.includes(targetUserId);
                      const incomingReq = pendingRequests.find(
                        (req) => String(req.sender?._id || req.sender) === targetUserId
                      );

                      return (
                        <article key={item._id} className="feed-match-card">
                          <div className="match-card-top">
                            <div className="arch-wrap">
                              <div className="arch">
                                <div className="arch-in">
                                  <Photo src={item.photoUrl} name={item.fullName} />
                                </div>
                              </div>
                              <span className={`role-badge ${item.gender?.toLowerCase() === "male" ? "male" : "female"}`}>
                                {item.gender === "Male" ? "Groom" : "Bride"}
                              </span>
                              <span className="verified-seal">✓ Verified</span>
                            </div>

                            <div className="match-card-details">
                              <div className="name-age-row">
                                <h4>{item.fullName}</h4>
                                <span className="age-chip">{calculateAge(item.dob)} yrs</span>
                              </div>

                              <p className="vitals-line">
                                {item.height ? `${item.height} cm, ` : ""}{item.religion || "Faith"}{item.caste ? ` (${item.caste})` : ""}
                              </p>

                              <div className="meta-compact-list">
                                <div><span className="meta-icon">🎓</span><span className="txt">{item.education || "Graduate"}</span></div>
                                <div><span className="meta-icon">💼</span><span className="txt">{item.occupation || "Professional"}, <strong>{item.annualIncome || "Confidential"}</strong></span></div>
                                <div><span className="meta-icon">📍</span><span className="txt">{item.city || "India"}, {item.state || ""}</span></div>
                              </div>

                              <div className="card-actions-row">
                                {isConnected ? (
                                  <button
                                    className="btn-action-primary sent"
                                    onClick={() => navigate(`/messages?userId=${targetUserId}`)}
                                  >
                                    💬 Chat
                                  </button>
                                ) : incomingReq ? (
                                  <div className="dual-req-btns">
                                    <button
                                      className="btn-acc"
                                      onClick={() => handleRespond(incomingReq._id, "accepted", item.fullName)}
                                    >
                                      ✓ Accept
                                    </button>
                                    <button
                                      className="btn-rej"
                                      onClick={() => handleRespond(incomingReq._id, "rejected", item.fullName)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : isSent ? (
                                  <button className="btn-action-primary sent" disabled>
                                    ✓ Sent
                                  </button>
                                ) : (
                                  <button
                                    className="btn-action-primary"
                                    onClick={() => handleConnect(targetUserId, item.fullName)}
                                  >
                                    Connect 💌
                                  </button>
                                )}

                                <button
                                  className="btn-action-secondary"
                                  onClick={() => setSelectedMatch(item)}
                                >
                                  View 👁️
                                </button>

                                <button
                                  className="btn-action-block"
                                  title="Block this user"
                                  onClick={() => handleBlockUser(targetUserId, item.fullName)}
                                >
                                  🚫
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ================= TAB 2: PENDING REQUESTS ================= */}
          {activeTab === "requests" && (
            <div className="requests-container-box">
              {pendingRequests.length === 0 ? (
                <div className="empty-feed-card">
                  <span className="empty-icon">💌</span>
                  <h3>No pending requests at the moment</h3>
                  <p>When someone expresses interest in your bio-data, they will appear here.</p>
                </div>
              ) : (
                <div className="requests-list-grid">
                  {pendingRequests.map((req) => (
                    <div key={req._id} className="request-full-card">
                      <div className="req-card-left">
                        <div className="req-avatar">
                          <Photo src={req.sender?.photoUrl} name={req.sender?.name} />
                        </div>
                        <div>
                          <h4>{req.sender?.name || "Prospective Member"}</h4>
                          <p>Sent an interest request to view your contact & connect.</p>
                        </div>
                      </div>

                      <div className="req-card-right">
                        <button
                          className="btn-req-accept"
                          onClick={() => handleRespond(req._id, "accepted", req.sender?.name)}
                        >
                          ✓ Accept Request
                        </button>
                        <button
                          className="btn-req-reject"
                          onClick={() => handleRespond(req._id, "rejected", req.sender?.name)}
                        >
                          Decline
                        </button>
                        <button
                          className="btn-req-block"
                          title="Block sender"
                          onClick={() => handleBlockUser(req.sender?._id || req.sender, req.sender?.name)}
                        >
                          🚫
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: USER'S OWN BIO-DATA (2-COLUMN BOXED UI) ================= */}
          {activeTab === "biodata" && (
            <div className="biodata-view-container">
              {profile ? (
                <div className="biodata-wrapper-boxed">
                  
                  {/* Category Filter Pills to avoid endless scroll */}
                  <div className="bio-cat-pills-row">
                    <button className={`cat-pill ${bioSection === "all" ? "on" : ""}`} onClick={() => setBioSection("all")}>All Details</button>
                    <button className={`cat-pill ${bioSection === "identity" ? "on" : ""}`} onClick={() => setBioSection("identity")}>👤 Identity</button>
                    <button className={`cat-pill ${bioSection === "community" ? "on" : ""}`} onClick={() => setBioSection("community")}>🪔 Religion</button>
                    <button className={`cat-pill ${bioSection === "career" ? "on" : ""}`} onClick={() => setBioSection("career")}>🎓 Career</button>
                    <button className={`cat-pill ${bioSection === "family" ? "on" : ""}`} onClick={() => setBioSection("family")}>👨‍👩‍👦 Family</button>
                    <button className={`cat-pill ${bioSection === "lifestyle" ? "on" : ""}`} onClick={() => setBioSection("lifestyle")}>🥗 Lifestyle</button>
                  </div>

                  <div className="biodata-sections-grid">
                    {/* 1. Personal Identity */}
                    {(bioSection === "all" || bioSection === "identity") && (
                      <div className="bio-card">
                        <h4>👤 Personal Identity & Vitals</h4>
                        <div className="bio-details-grid">
                          <div className="grid-cell"><span className="cell-label">Full Name</span> <strong className="cell-val">{profile.fullName || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Gender</span> <strong className="cell-val">{profile.gender || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Age</span> <strong className="cell-val">{calculateAge(profile.dob)} Years</strong></div>
                          <div className="grid-cell"><span className="cell-label">Height</span> <strong className="cell-val">{profile.height ? `${profile.height} cm` : "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Contact Phone</span> <strong className="cell-val">{profile.phone || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Marital Status</span> <strong className="cell-val">{profile.maritalStatus || "-"}</strong></div>
                        </div>
                      </div>
                    )}

                    {/* 2. Religion & Community */}
                    {(bioSection === "all" || bioSection === "community") && (
                      <div className="bio-card">
                        <h4>🪔 Religion & Community</h4>
                        <div className="bio-details-grid">
                          <div className="grid-cell"><span className="cell-label">Religion</span> <strong className="cell-val">{profile.religion || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Caste / Sub-caste</span> <strong className="cell-val">{profile.caste || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Mother Tongue</span> <strong className="cell-val">{profile.motherTongue || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Manglik Status</span> <strong className="cell-val">{profile.manglik || "-"}</strong></div>
                        </div>
                      </div>
                    )}

                    {/* 3. Education & Career */}
                    {(bioSection === "all" || bioSection === "career") && (
                      <div className="bio-card">
                        <h4>🎓 Education & Career</h4>
                        <div className="bio-details-grid">
                          <div className="grid-cell"><span className="cell-label">Highest Education</span> <strong className="cell-val">{profile.education || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Occupation</span> <strong className="cell-val">{profile.occupation || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Annual Package</span> <strong className="cell-val">{profile.annualIncome ? `${profile.annualIncome}` : "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Current City</span> <strong className="cell-val">{profile.city || "-"}</strong></div>
                        </div>
                      </div>
                    )}

                    {/* 4. Family Background */}
                    {(bioSection === "all" || bioSection === "family") && (
                      <div className="bio-card">
                        <h4>👨‍👩‍👧‍👦 Family Background</h4>
                        <div className="bio-details-grid">
                          <div className="grid-cell"><span className="cell-label">Father's Name</span> <strong className="cell-val">{profile.fatherName || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Father's Occupation</span> <strong className="cell-val">{profile.fatherOccupation || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Mother's Name</span> <strong className="cell-val">{profile.motherName || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Mother's Occupation</span> <strong className="cell-val">{profile.motherOccupation || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Siblings</span> <strong className="cell-val">{profile.siblings ?? 0}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Family Type</span> <strong className="cell-val">{profile.familyType || "-"}</strong></div>
                        </div>
                      </div>
                    )}

                    {/* 5. Lifestyle & About */}
                    {(bioSection === "all" || bioSection === "lifestyle") && (
                      <div className="bio-card full-span">
                        <h4>🥗 Diet, Lifestyle & About Me</h4>
                        <div className="bio-details-grid">
                          <div className="grid-cell"><span className="cell-label">Dietary Choice</span> <strong className="cell-val">{profile.diet || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Smoking</span> <strong className="cell-val">{profile.smoking || "-"}</strong></div>
                          <div className="grid-cell"><span className="cell-label">Drinking</span> <strong className="cell-val">{profile.drinking || "-"}</strong></div>
                        </div>
                        {profile.about && (
                          <div className="about-text-box">
                            <span>About Me:</span>
                            <p>{profile.about}</p>
                          </div>
                        )}
                        {profile.partnerPreference && (
                          <div className="about-text-box">
                            <span>Partner Expectations:</span>
                            <p>{profile.partnerPreference}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions: Edit or Delete Bio-Data */}
                  <div className="biodata-manage-footer">
                    <button onClick={() => setShowQuickBioModal(true)} className="btn-manage-edit">
                      ✎ Quick Edit Bio
                    </button>
                    <Link to="/create-profile" className="btn-manage-full">
                      Edit All 30 Fields
                    </Link>
                    <button onClick={handleDeleteProfile} className="btn-manage-delete">
                      🗑️ Delete Bio-Data
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-feed-card">
                  <span className="empty-icon">🕊️</span>
                  <h3>You haven't completed your bio-data yet</h3>
                  <Link to="/create-profile" className="btn-action-primary">Create Bio-Data Now ✦</Link>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: BLOCKED PROFILES ================= */}
          {activeTab === "blocked" && (
            <div className="blocked-view-container">
              {blockedUsersList.length === 0 ? (
                <div className="empty-feed-card">
                  <span className="empty-icon">🕊️</span>
                  <h3>No blocked users</h3>
                  <p>Aapne kisi bhi user ko block nahi kiya hai.</p>
                </div>
              ) : (
                <div className="blocked-list-grid">
                  {blockedUsersList.map((bUser) => {
                    const bUserId = getProfileUserId(bUser);
                    return (
                      <div key={bUser._id} className="blocked-user-row">
                        <div className="b-left">
                          <div className="b-avatar">
                            <Photo src={bUser.photoUrl} name={bUser.fullName} />
                          </div>
                          <div>
                            <h4>{bUser.fullName}</h4>
                            <p>{calculateAge(bUser.dob)} yrs • {bUser.city || "India"}</p>
                          </div>
                        </div>
                        <button
                          className="btn-unblock-pill"
                          onClick={() => handleUnblockUser(bUserId, bUser.fullName)}
                        >
                          🔓 Unblock
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>

        {/* ================= 6. IN-DASHBOARD BIO-DATA POPUP MODAL ================= */}
        {selectedMatch && (
          <div className="modal-backdrop" onClick={() => setSelectedMatch(null)}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedMatch(null)} aria-label="Close">✕</button>

              <div className="modal-bio-head">
                <div className="modal-avatar">
                  <Photo src={selectedMatch.photoUrl} name={selectedMatch.fullName} />
                </div>
                <div>
                  <span className="modal-verified-tag">✓ 100% Verified Profile</span>
                  <h3>{selectedMatch.fullName}</h3>
                  <p>{calculateAge(selectedMatch.dob)} years • {selectedMatch.occupation || "Professional"} • {selectedMatch.city}</p>
                </div>
              </div>

              <div className="modal-bio-body">
                <div className="bio-section-box">
                  <strong>About</strong>
                  <p>{selectedMatch.about || "Cultured, family-oriented and seeking a compatible life partner."}</p>
                </div>

                <div className="bio-stats-grid">
                  <div><span>Community</span><strong>{selectedMatch.religion} {selectedMatch.caste ? `(${selectedMatch.caste})` : ""}</strong></div>
                  <div><span>Diet</span><strong>{selectedMatch.diet || "Vegetarian"}</strong></div>
                  <div><span>Marital Status</span><strong>{selectedMatch.maritalStatus || "Never Married"}</strong></div>
                  <div><span>Annual Package</span><strong>{selectedMatch.annualIncome || "Confidential"}</strong></div>
                  <div><span>Education</span><strong>{selectedMatch.education || "Graduate"}</strong></div>
                  <div><span>Current City</span><strong>{selectedMatch.city || "India"}, {selectedMatch.state || ""}</strong></div>
                </div>
              </div>

              <div className="modal-bio-footer">
                <div className="footer-action-cluster">
                  {acceptedIds.includes(getProfileUserId(selectedMatch)) ? (
                    <button
                      className="btn-action-primary full sent"
                      onClick={() => navigate(`/messages?userId=${getProfileUserId(selectedMatch)}`)}
                    >
                      💬 Open Chat Conversation
                    </button>
                  ) : sentRequestIds.includes(getProfileUserId(selectedMatch)) ? (
                    <button className="btn-action-primary full sent" disabled>✓ Request Sent</button>
                  ) : (
                    <button
                      className="btn-action-primary full"
                      onClick={() => {
                        handleConnect(getProfileUserId(selectedMatch), selectedMatch.fullName);
                        setSelectedMatch(null);
                      }}
                    >
                      Send Direct Interest 💌
                    </button>
                  )}

                  <button
                    className="btn-block-subtle"
                    onClick={() => handleBlockUser(getProfileUserId(selectedMatch), selectedMatch.fullName)}
                  >
                    🚫 Block this Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 7. QUICK BIO EDIT MODAL ================= */}
        {showQuickBioModal && (
          <div className="modal-backdrop" onClick={() => setShowQuickBioModal(false)}>
            <div className="modal-sheet quick-edit-sheet" onClick={(e) => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setShowQuickBioModal(false)}>✕</button>

              <div className="quick-modal-head">
                <span className="ganesh">॥ आत्म परिचय ॥</span>
                <h3>Quick Edit Bio & Preferences</h3>
                <p>Instantly update what prospective matches see on your card</p>
              </div>

              <form onSubmit={handleSaveQuickBio} className="quick-bio-form">
                <div className="input-field-group">
                  <label>About Me (Bio)</label>
                  <textarea
                    rows={3}
                    placeholder="Describe your hobbies, values and personality..."
                    value={quickBioForm.about}
                    onChange={(e) => setQuickBioForm({ ...quickBioForm, about: e.target.value })}
                  />
                </div>

                <div className="input-field-group">
                  <label>Partner Expectations</label>
                  <textarea
                    rows={3}
                    placeholder="Qualities you seek in your prospective life partner..."
                    value={quickBioForm.partnerPreference}
                    onChange={(e) => setQuickBioForm({ ...quickBioForm, partnerPreference: e.target.value })}
                  />
                </div>

                <div className="modal-actions-pair">
                  <button type="submit" className="btn-action-primary" disabled={savingBio}>
                    {savingBio ? "Saving..." : "Save Changes ✦"}
                  </button>
                  <button type="button" onClick={() => setShowQuickBioModal(false)} className="btn-cancel">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="matrimony-footer">
          <p>© {new Date().getFullYear()} PairPerfect Matrimony — Pavitra Rishtey. All Rights Reserved.</p>
        </footer>
      </div>
    </>
  );
}

const dashboardStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Hind:wght@400;500;600;700&family=Yatra+One&display=swap');

  .dash-layout {
    --night: #1f0210;
    --wine: #4a0418;
    --maroon: #7c0a2b;
    --gold: #d4a72c;
    --gold-2: #f2cf6b;
    --gold-line: rgba(212, 167, 44, 0.35);
    --ivory: #fff7e6;
    --ivory-2: #f6e8c8;
    --ink: #2b1118;
    --ink-soft: #6b525a;
    --display: 'Yatra One', 'Tiro Devanagari Hindi', Georgia, serif;
    --body: 'Hind', 'Segoe UI', system-ui, -apple-system, sans-serif;

    min-height: 100vh;
    min-height: 100dvh;
    background:
      radial-gradient(circle at 1px 1px, rgba(212, 167, 44, 0.12) 1px, transparent 0) 0 0 / 26px 26px,
      var(--night);
    color: var(--ivory);
    font-family: var(--body);
    box-sizing: border-box;
    overflow-x: hidden;
    position: relative;
    padding-bottom: 24px;
    -webkit-tap-highlight-color: transparent;
  }

  .dash-layout *, .dash-layout *::before, .dash-layout *::after { box-sizing: border-box; }
  .dash-layout button, .dash-layout a, .dash-layout input, .dash-layout textarea { touch-action: manipulation; }

  /* Background Aesthetics */
  .dash-bg-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .ambient-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.2;
    animation: drift 16s ease-in-out infinite alternate;
    will-change: transform;
  }
  .b1 { width: clamp(280px, 45vw, 550px); height: clamp(280px, 45vw, 550px); background: var(--gold); top: 15%; left: -100px; }
  .b2 { width: clamp(260px, 40vw, 480px); height: clamp(260px, 40vw, 480px); background: var(--maroon); bottom: 10%; right: -80px; animation-delay: -6s; }
  .bg-mandala { position: absolute; color: var(--gold); opacity: 0.12; pointer-events: none; will-change: transform; }
  .m-left { width: 600px; height: 600px; left: -200px; top: 25%; animation: spinClockwise 110s linear infinite; }
  .m-right { width: 520px; height: 520px; right: -180px; bottom: 15%; animation: spinCounterClockwise 85s linear infinite; }
  .dash-petal {
    position: absolute;
    top: -5%;
    border-radius: 0 100% 0 100%;
    opacity: 0;
    animation: petalFall linear infinite;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
    pointer-events: none;
    will-change: transform, opacity;
  }
  .dash-grain {
    position: absolute;
    inset: 0;
    opacity: 0.08;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E");
  }

  /* 1. NAVBAR */
  .dash-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    height: 60px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(31, 2, 16, 0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--gold-line);
    gap: 10px;
  }
  .brand-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--ivory); flex-shrink: 0; }
  .logo-rings { width: 36px; height: 24px; fill: none; stroke: var(--gold); stroke-width: 1.6; }
  .logo-rings path { fill: var(--gold-2); stroke: none; }
  .brand-text { display: flex; flex-direction: column; line-height: 1; }
  .brand-name { font-family: var(--display); font-size: clamp(19px, 4vw, 23px); }
  .brand-name b { font-weight: 400; color: var(--gold-2); }
  .logo-sub { font-size: 10px; color: var(--gold); margin-top: 2px; letter-spacing: 0.5px; }

  .header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .nav-chat-btn {
    color: var(--gold-2);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid var(--gold-line);
    background: rgba(212, 167, 44, 0.1);
  }
  .browse-matches-btn {
    background: linear-gradient(135deg, var(--gold-2), var(--gold));
    color: #3a0618;
    text-decoration: none;
    padding: 6px 14px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 13px;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .logout-btn {
    background: transparent;
    border: 1px solid #e57373;
    color: #ff9c9c;
    padding: 5px 10px;
    border-radius: 999px;
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
  }

  /* 2. MAIN CONTAINER */
  .dash-main-container {
    position: relative;
    z-index: 5;
    max-width: 1200px;
    margin: 16px auto 32px;
    padding: 0 12px;
  }

  /* User Hero Banner */
  .user-hero-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(160deg, var(--maroon), var(--wine));
    border: 1.5px solid var(--gold);
    border-radius: 16px;
    padding: 16px 18px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    gap: 14px;
  }
  .user-hero-left { display: flex; align-items: center; gap: 12px; }
  .user-avatar-badge {
    position: relative;
    width: 62px;
    height: 62px;
    border-radius: 50%;
    border: 2px solid var(--gold);
    overflow: hidden;
    background: #e9d5ad;
    flex-shrink: 0;
  }
  .user-avatar-badge img { width: 100%; height: 100%; object-fit: cover; }
  .online-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #0f7a55;
    border: 2px solid var(--ivory);
  }
  .shubh-tag { font-family: var(--display); font-size: 11.5px; color: var(--gold-2); display: block; margin-bottom: 2px; }
  .user-hero-info h2 { font-family: var(--display); font-size: clamp(20px, 3.5vw, 26px); margin: 0; font-weight: 400; color: var(--ivory); }
  .hero-subline { font-size: 12.5px; color: rgba(255, 247, 230, 0.82); margin: 2px 0 0; }

  .user-hero-right { display: flex; align-items: center; gap: 12px; }
  .profile-meter-box {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(212, 167, 44, 0.3);
    border-radius: 10px;
    padding: 8px 12px;
    min-width: 150px;
  }
  .meter-label-row { display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: var(--gold-2); margin-bottom: 4px; }
  .meter-bar-track { width: 100%; height: 6px; background: rgba(255, 247, 230, 0.15); border-radius: 999px; overflow: hidden; }
  .meter-bar-fill { height: 100%; background: linear-gradient(90deg, var(--gold), #22c55e); border-radius: 999px; }

  .hero-btn-group { display: flex; gap: 6px; }
  .btn-quick-bio {
    background: rgba(255, 247, 230, 0.12);
    color: var(--gold-2);
    border: 1px solid var(--gold);
    font-size: 12px;
    font-weight: 600;
    padding: 7px 12px;
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-edit-bio {
    background: var(--gold);
    color: #3a0618;
    text-decoration: none;
    font-weight: 700;
    font-size: 12px;
    padding: 7px 14px;
    border-radius: 999px;
    white-space: nowrap;
  }

  /* 3. INSTAGRAM STORIES CAROUSEL */
  .stories-section {
    margin: 16px 0;
    background: rgba(255, 247, 230, 0.04);
    border: 1px solid var(--gold-line);
    border-radius: 14px;
    padding: 12px 14px;
  }
  .stories-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .stories-title { font-size: 13px; font-weight: 700; color: var(--gold-2); }
  .stories-header small { color: rgba(255, 247, 230, 0.6); font-size: 11px; }

  .stories-scroll-row {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .stories-scroll-row::-webkit-scrollbar { display: none; }

  .story-avatar-item {
    background: none;
    border: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    min-width: 64px;
    text-align: center;
  }
  .story-ring {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    padding: 2px;
    background: linear-gradient(135deg, #f2cf6b, #d4a72c, #e63946);
    display: grid;
    place-items: center;
  }
  .story-img-wrap {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    background: #e9d5ad;
    border: 1.5px solid var(--night);
  }
  .story-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
  .story-name { font-size: 11.5px; font-weight: 600; color: var(--ivory); margin-top: 4px; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .story-age { font-size: 10.5px; color: var(--gold-2); }
  .empty-story-note { font-size: 12px; color: rgba(255, 247, 230, 0.6); padding: 6px; }

  /* 4. QUICK STATS RIBBON (2x2 GRID ON MOBILE) */
  .quick-stats-ribbon {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 18px;
  }
  .stat-pill-card {
    background: rgba(255, 247, 230, 0.05);
    border: 1px solid var(--gold-line);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .stat-pill-card:active { transform: scale(0.98); }
  .stat-pill-card.active { border-color: var(--gold); background: rgba(212, 167, 44, 0.16); }
  .stat-icon-wrap { font-size: 22px; flex-shrink: 0; }
  .stat-details { display: flex; flex-direction: column; min-width: 0; }
  .stat-count { font-family: var(--display); font-size: 20px; color: var(--gold-2); line-height: 1.1; }
  .stat-label { font-size: 11px; color: rgba(255, 247, 230, 0.75); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* 5. TABS BAR */
  .dashboard-tabs-bar {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--gold-line);
    padding-bottom: 10px;
    overflow-x: auto;
  }
  .tab-btn {
    flex: 1;
    background: transparent;
    border: 1px solid rgba(255, 247, 230, 0.25);
    color: rgba(255, 247, 230, 0.85);
    padding: 8px 6px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    white-space: nowrap;
  }
  .tab-btn.on { background: var(--maroon); border-color: var(--gold); color: var(--ivory); }
  .tab-btn.tab-blocked { border-color: #ef4444; color: #fca5a5; }
  .tab-btn.tab-blocked.on { background: #7f1d1d; color: #fff; }

  /* ================= 🔍 MATCHES SEARCH BAR ================= */
  .matches-search-box {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 14px;
  }
  .search-ico {
    position: absolute;
    left: 12px;
    font-size: 13px;
    opacity: 0.7;
    pointer-events: none;
  }
  .matches-search-input {
    width: 100%;
    padding: 9px 36px 9px 36px;
    background: rgba(255, 247, 230, 0.08);
    border: 1.5px solid var(--gold-line);
    border-radius: 999px;
    color: var(--ivory);
    font-size: 13px;
    outline: none;
  }
  .matches-search-input:focus {
    border-color: var(--gold-2);
    background: rgba(255, 247, 230, 0.12);
  }
  .search-clear-btn {
    position: absolute;
    right: 12px;
    background: transparent;
    border: none;
    color: var(--gold-2);
    cursor: pointer;
    font-size: 13px;
  }

  /* Slider Note for Mobile */
  .slider-indicator-note {
    display: none;
    font-size: 11px;
    color: var(--gold-2);
    margin-bottom: 10px;
    text-align: right;
  }

  /* ================= MATCHES FEED & MOBILE SLIDER ================= */
  .matches-feed-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 16px;
  }

  .feed-match-card {
    background: var(--ivory);
    color: var(--ink);
    border: 1.5px solid var(--gold);
    border-radius: 16px;
    padding: 12px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
  }
  .arch-wrap { position: relative; margin-bottom: 16px; }
  .arch {
    height: 230px;
    padding: 4px;
    border: 2px solid var(--gold);
    border-radius: 999px 999px 10px 10px;
    background: linear-gradient(#fff, var(--ivory-2));
  }
  .arch-in { height: 100%; border-radius: 999px 999px 6px 6px; overflow: hidden; background: #e9d5ad; }
  .arch-in img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo-fallback { width: 100%; height: 100%; display: grid; place-items: center; background: linear-gradient(160deg, var(--maroon), var(--wine)); color: var(--gold-2); font-family: var(--display); font-size: 46px; }
  .role-badge { position: absolute; left: 8px; bottom: -9px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--gold); font-size: 11px; font-weight: 600; color: var(--ivory); background: var(--maroon); }
  .role-badge.male { background: #1d3a73; }
  .verified-seal { position: absolute; right: 8px; bottom: -9px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--gold-2); background: #0f7a55; color: #fff; font-size: 11px; font-weight: 600; }

  .name-age-row { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .name-age-row h4 { font-family: var(--display); font-size: 19px; margin: 0; color: var(--maroon); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .age-chip { font-size: 11.5px; font-weight: 600; color: var(--maroon); background: #fffdf5; border: 1px solid #dcc58f; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
  .vitals-line { margin: 3px 0 6px; font-size: 12.5px; color: var(--ink-soft); }

  .meta-compact-list { display: grid; gap: 4px; padding-top: 6px; margin-bottom: 10px; border-top: 1px dashed #d9c18a; font-size: 12.5px; }
  .meta-compact-list > div { display: flex; align-items: center; gap: 6px; }
  .meta-compact-list .txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .card-actions-row { display: flex; gap: 5px; margin-top: auto; align-items: center; }
  .btn-action-primary {
    flex: 1;
    background: var(--maroon);
    color: var(--ivory);
    border: none;
    padding: 8px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    text-align: center;
    white-space: nowrap;
  }
  .btn-action-primary.sent { background: #0f7a55; }
  .btn-action-secondary {
    background: transparent;
    color: var(--maroon);
    border: 1.5px solid var(--gold);
    padding: 7px 9px;
    border-radius: 8px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-action-block {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 7px 9px;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
  }
  .btn-action-block:hover { background: #ef4444; color: #fff; }

  .dual-req-btns { display: flex; gap: 5px; flex: 1; }
  .btn-acc { flex: 1; background: #0f7a55; color: #fff; border: none; border-radius: 6px; font-weight: 700; padding: 6px; cursor: pointer; font-size: 11.5px; }
  .btn-rej { background: #c92a2a; color: #fff; border: none; border-radius: 6px; padding: 6px 8px; cursor: pointer; font-size: 11.5px; }

  /* REQUESTS TAB */
  .requests-container-box { display: flex; flex-direction: column; gap: 12px; }
  .request-full-card {
    background: var(--ivory);
    color: var(--ink);
    border: 1.5px solid var(--gold);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .req-card-left { display: flex; align-items: center; gap: 12px; }
  .req-avatar { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 2px solid var(--gold); background: #e9d5ad; flex-shrink: 0; }
  .req-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .req-card-left h4 { font-family: var(--display); font-size: 18px; color: var(--maroon); margin: 0 0 2px; }
  .req-card-left p { margin: 0; font-size: 12px; color: var(--ink-soft); }
  .req-card-right { display: flex; gap: 6px; }
  .btn-req-accept { background: #0f7a55; color: #fff; border: none; padding: 7px 12px; border-radius: 7px; font-weight: 700; font-size: 12px; cursor: pointer; }
  .btn-req-reject { background: #c92a2a; color: #fff; border: none; padding: 7px 10px; border-radius: 7px; font-weight: 700; font-size: 12px; cursor: pointer; }
  .btn-req-block { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 7px 8px; border-radius: 7px; cursor: pointer; }

  /* TAB 3: USER'S OWN BIO-DATA (2-COLUMNS BOXES) */
  .biodata-wrapper-boxed { display: flex; flex-direction: column; gap: 12px; }
  .bio-cat-pills-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }
  .bio-cat-pills-row::-webkit-scrollbar { display: none; }
  .cat-pill {
    background: rgba(255, 247, 230, 0.06);
    border: 1px solid var(--gold-line);
    color: var(--ivory);
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .cat-pill.on { background: var(--gold); color: #3a0618; border-color: var(--gold); font-weight: 700; }

  .biodata-sections-grid { display: flex; flex-direction: column; gap: 14px; }
  .bio-card { 
    background: var(--ivory); 
    color: var(--ink); 
    border: 1.5px solid var(--gold); 
    border-radius: 14px; 
    padding: 14px 12px; 
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  }
  .bio-card h4 { 
    font-family: var(--display); 
    font-size: 17.5px; 
    color: var(--maroon); 
    margin: 0 0 10px; 
    border-bottom: 1.5px dashed #dcc58f; 
    padding-bottom: 5px; 
  }

  .bio-details-grid { 
    display: grid; 
    grid-template-columns: 1fr 1fr; 
    gap: 8px 10px; 
  }
  .grid-cell { 
    background: #fffdf7; 
    border: 1px solid #dcc58f; 
    border-radius: 8px; 
    padding: 7px 10px; 
    display: flex; 
    flex-direction: column; 
    gap: 2px;
    min-width: 0;
  }
  .cell-label { 
    font-size: 11px; 
    font-weight: 600; 
    color: var(--ink-soft); 
    white-space: nowrap; 
    overflow: hidden; 
    text-overflow: ellipsis; 
  }
  .cell-val { 
    font-size: 13.5px; 
    font-weight: 700; 
    color: var(--ink); 
    white-space: nowrap; 
    overflow: hidden; 
    text-overflow: ellipsis; 
  }

  .about-text-box { 
    margin-top: 10px; 
    background: #fffdf7; 
    border: 1px solid #dcc58f; 
    border-radius: 8px; 
    padding: 8px 10px; 
  }
  .about-text-box span { font-weight: 700; color: var(--maroon); font-size: 12px; display: block; margin-bottom: 2px; }
  .about-text-box p { margin: 0; line-height: 1.5; color: var(--ink); font-size: 13px; }

  /* Bio Manage Footer: Edit or Delete */
  .biodata-manage-footer {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  .btn-manage-edit {
    flex: 1;
    background: var(--maroon);
    color: var(--ivory);
    border: 1px solid var(--gold);
    padding: 10px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 12.5px;
    cursor: pointer;
  }
  .btn-manage-full {
    flex: 1;
    background: var(--gold);
    color: #3a0618;
    text-decoration: none;
    padding: 10px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 12.5px;
    text-align: center;
  }
  .btn-manage-delete {
    background: transparent;
    border: 1px solid #ef4444;
    color: #ef4444;
    padding: 10px 14px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
  }

  /* ================= TAB 4: BLOCKED USERS ================= */
  .blocked-list-grid { display: flex; flex-direction: column; gap: 10px; }
  .blocked-user-row {
    background: var(--ivory);
    color: var(--ink);
    border: 1px solid var(--gold);
    border-radius: 12px;
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .b-left { display: flex; align-items: center; gap: 10px; }
  .b-avatar { width: 42px; height: 42px; border-radius: 50%; overflow: hidden; border: 1.5px solid var(--gold); }
  .b-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .b-left h4 { margin: 0; font-family: var(--display); font-size: 17px; color: var(--maroon); }
  .b-left p { margin: 0; font-size: 11.5px; color: var(--ink-soft); }
  .btn-unblock-pill {
    background: #0f7a55;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
  }

  /* ================= 6. IN-DASHBOARD MODALS ================= */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(15, 1, 8, 0.85);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .modal-sheet {
    position: relative;
    width: 100%;
    max-width: 440px;
    background: var(--ivory);
    color: var(--ink);
    border: 2px solid var(--gold);
    border-radius: 18px;
    padding: 22px 18px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
    animation: pop 0.25s ease both;
  }
  .close-btn { position: absolute; top: 10px; right: 10px; border: none; background: var(--ivory-2); color: var(--maroon); width: 28px; height: 28px; border-radius: 50%; font-weight: 700; cursor: pointer; }
  .modal-bio-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #d9c18a; }
  .modal-avatar { width: 66px; height: 78px; border: 2px solid var(--gold); border-radius: 999px 999px 8px 8px; overflow: hidden; background: #e9d5ad; flex-shrink: 0; }
  .modal-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .modal-verified-tag { font-size: 11px; font-weight: 700; color: #0f7a55; }
  .modal-bio-head h3 { font-family: var(--display); font-size: 20px; margin: 2px 0; color: var(--maroon); }
  .modal-bio-head p { margin: 0; font-size: 12px; color: var(--ink-soft); }
  .bio-section-box { margin-bottom: 10px; font-size: 13px; }
  .bio-section-box strong { color: var(--maroon); display: block; margin-bottom: 2px; }
  .bio-section-box p { margin: 0; line-height: 1.45; }
  .bio-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; padding: 8px; background: var(--ivory-2); border-radius: 8px; border: 1px solid #e2cd9a; }
  .bio-stats-grid div { display: flex; flex-direction: column; }
  .bio-stats-grid span { font-size: 10.5px; color: var(--ink-soft); }
  .bio-stats-grid strong { font-size: 12.5px; }

  .footer-action-cluster { display: flex; flex-direction: column; gap: 8px; }
  .btn-block-subtle { background: none; border: none; color: #ef4444; font-size: 12px; cursor: pointer; text-decoration: underline; }

  /* Quick Bio Edit Sheet */
  .quick-edit-sheet { max-width: 400px; }
  .quick-modal-head { text-align: center; margin-bottom: 14px; }
  .ganesh { display: block; font-family: var(--display); font-size: 12.5px; color: var(--maroon); margin-bottom: 2px; }
  .quick-modal-head h3 { font-family: var(--display); font-size: 20px; color: var(--maroon); margin: 0 0 4px; }
  .quick-modal-head p { margin: 0; font-size: 12px; color: var(--ink-soft); }
  .quick-bio-form { display: flex; flex-direction: column; gap: 12px; }
  .input-field-group { display: flex; flex-direction: column; gap: 4px; }
  .input-field-group label { font-size: 12.5px; font-weight: 600; }
  .input-field-group textarea {
    padding: 8px 10px;
    border: 1.5px solid #dcc58f;
    border-radius: 8px;
    background: #fffdf7;
    font-size: 13px;
    font-family: var(--body);
    outline: none;
  }
  .modal-actions-pair { display: flex; gap: 8px; margin-top: 4px; }
  .btn-cancel { background: transparent; border: 1px solid #dcc58f; border-radius: 8px; padding: 8px 14px; font-size: 12.5px; cursor: pointer; }

  /* Floating Toast Alert */
  .floating-toast {
    position: fixed;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    width: min(420px, calc(100vw - 28px));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px;
    border: 1.5px solid var(--gold);
    border-radius: 10px;
    background: #fff7e6;
    color: #2b1118;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    animation: pop 0.25s ease both;
  }
  .floating-toast span { font-size: 12.5px; font-weight: 600; }
  .floating-toast button { border: 0; background: transparent; color: #7c0a2b; font-size: 16px; font-weight: 700; cursor: pointer; }

  /* Loading State */
  .dash-loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 70vh; color: var(--gold-2); }
  .loading-flower { font-size: 40px; animation: spinClockwise 4s linear infinite; margin-bottom: 12px; }

  /* Footer */
  .matrimony-footer { max-width: 1200px; margin: 30px auto 0; border-top: 1px solid var(--gold-line); padding: 14px 16px; text-align: center; font-size: 12px; color: rgba(255, 247, 230, 0.6); }
  .matrimony-footer p { margin: 0; }

  /* Animations */
  @keyframes spinClockwise { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes spinCounterClockwise { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
  @keyframes drift { from { transform: translate(0, 0) scale(1); } to { transform: translate(60px, 40px) scale(1.15); } }
  @keyframes petalFall {
    0% { transform: translate3d(0, -6vh, 0) rotate(0deg); opacity: 0; }
    10% { opacity: 0.65; }
    50% { transform: translate3d(36px, 48vh, 0) rotate(190deg); opacity: 0.55; }
    100% { transform: translate3d(-24px, 106vh, 0) rotate(380deg); opacity: 0; }
  }
  @keyframes pop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }

  /* ================= 📱 MOBILE SPECIFIC SLIDER & 2-COLUMN OPTIMIZATIONS ================= */
  @media (max-width: 768px) {
    .quick-stats-ribbon { grid-template-columns: 1fr 1fr; gap: 8px; }
    .user-hero-banner { flex-direction: column; align-items: flex-start; padding: 14px; gap: 12px; }
    .user-hero-right { width: 100%; justify-content: space-between; }
    .profile-meter-box { min-width: 0; flex: 1; }

    /* 🔥 HORIZONTAL SWIPE SLIDER FOR MOBILE MATCHES (NO VERTICAL SCROLL) */
    .slider-indicator-note { display: block; }
    .matches-feed-grid.mobile-slider {
      display: flex !important;
      overflow-x: auto !important;
      scroll-snap-type: x mandatory !important;
      gap: 14px !important;
      padding-bottom: 12px !important;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .matches-feed-grid.mobile-slider::-webkit-scrollbar { display: none; }
    
    .matches-feed-grid.mobile-slider .feed-match-card {
      min-width: 82vw !important;
      max-width: 82vw !important;
      scroll-snap-align: center !important;
      flex-shrink: 0 !important;
    }
  }

  @media (max-width: 480px) {
    .dash-nav { padding: 0 10px; }
    .nav-btn-text { display: none; }
    .browse-matches-btn, .nav-chat-btn { padding: 5px 9px; font-size: 12px; }
    .logout-btn { padding: 4px 8px; font-size: 11.5px; }

    .user-hero-left { gap: 10px; }
    .user-avatar-badge { width: 52px; height: 52px; }
    .user-hero-right { flex-direction: column; align-items: stretch; gap: 8px; }
    .hero-btn-group { width: 100%; }
    .btn-quick-bio, .btn-edit-bio { flex: 1; text-align: center; }

    /* Bio-Data grid stays 2-columns (no stacking) */
    .bio-details-grid { grid-template-columns: 1fr 1fr; gap: 6px 8px; }
    .grid-cell { padding: 6px 8px; }
    .cell-label { font-size: 10px; }
    .cell-val { font-size: 12.5px; }

    .request-full-card { flex-direction: column; align-items: flex-start; }
    .req-card-right { width: 100%; }
    .btn-req-accept, .btn-req-reject { flex: 1; }
  }

  @media (max-width: 360px) {
    .brand-name { font-size: 17px; }
    .logo-rings { width: 32px; height: 20px; }
    .dashboard-tabs-bar .tab-btn { font-size: 11px; padding: 6px 2px; }
  }
`;
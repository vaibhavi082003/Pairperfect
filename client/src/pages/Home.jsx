import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

/* ------------------------------------------------------------------
   🎬 HERO SCENES & CONFIG
------------------------------------------------------------------- */
const SCENE_MS = 6000;

const HERO_SCENES = [
  { key: "mehendi", name: "Mehendi", hindi: "मेहंदी", line: "Haathon par rachti nayi kahani", a: "#04201a", b: "#1c5a34", glow: "#a7d65a" },
  { key: "haldi", name: "Haldi", hindi: "हल्दी", line: "Peele rang mein ghule sapne", a: "#2b0716", b: "#8a3a0b", glow: "#ffb703" },
  { key: "sangeet", name: "Sangeet", hindi: "संगीत", line: "Dhol, geet aur do parivaaron ka milan", a: "#1b0636", b: "#7a0f55", glow: "#ff6fae" },
  { key: "pheras", name: "Pheras", hindi: "फेरे", line: "Saat vachan, saat janam ka saath", a: "#3d0414", b: "#a3122f", glow: "#ffd166" },
];

/* Original soft/light petals */
const PETAL_COLORS = ["#ffb703", "#fb8500", "#ff7b54", "#ffd166", "#e63946"];
const PETALS = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37 + 9) % 100,
  size: 9 + ((i * 5) % 11),
  dur: 11 + ((i * 7) % 9),
  delay: -((i * 3.1) % 16),
  color: PETAL_COLORS[i % PETAL_COLORS.length],
}));

const COMMUNITIES = ["Hindi", "Punjabi", "Bengali", "Gujarati", "Marathi", "Marwadi", "Kannada", "Tamil", "Telugu", "Malayalam", "Sindhi", "Oriya"];
const RELIGIONS = ["All", "Hindu", "Sikh", "Muslim", "Christian", "Jain"];
const GENDER_OPTIONS = [["All", "All profiles"], ["Female", "Brides"], ["Male", "Grooms"]];

/* ---------- Helpers ---------- */

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

function HoverWord({ en, hi }) {
  return (
    <span className="hover-word-box">
      <span className="en-text">{en}</span>
      <span className="hi-text">{hi}</span>
    </span>
  );
}

export default function Home() {
  const { user, logout, saveAuth } = useAuth();
  const navigate = useNavigate();

  const [myProfile, setMyProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const [currentSlide, setCurrentSlide] = useState(0);
  const scene = HERO_SCENES[currentSlide];

  const [scrolled, setScrolled] = useState(false);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("All");
  const [religionFilter, setReligionFilter] = useState("All");

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [selectedProfile, setSelectedProfile] = useState(null);
  const [connectedIds, setConnectedIds] = useState([]);
  const [heroProfileFor, setHeroProfileFor] = useState("Myself");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [acceptedIds, setAcceptedIds] = useState([]);
  const [sentRequestIds, setSentRequestIds] = useState([]);
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const [toastAlert, setToastAlert] = useState("");
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const socketRef = useRef(null);

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    try {
      const [pending, accepted] = await Promise.all([
        api.get("/connections/pending"),
        api.get("/connections/accepted"),
      ]);
      setPendingRequests(pending.data || []);
      setAcceptedIds((accepted.data || []).map((person) => String(person._id)));
    } catch (err) {
      setToastAlert(err.response?.data?.message || "Connections load nahi ho sake.");
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchConnections();
  }, [fetchConnections, user]);

  useEffect(() => {
    const userId = user?.id || user?._id;
    if (!userId) return undefined;

    const socket = io("http://localhost:5000", { withCredentials: true });
    socketRef.current = socket;
    socket.emit("joinUser", userId);

    socket.on("newConnectionReceived", (data) => {
      setToastAlert(data.message);
      fetchConnections();
    });
    socket.on("receiveMessage", (msg) => {
      const text = msg.text || "";
      setToastAlert(`Naya message: "${text.substring(0, 20)}${text.length > 20 ? "..." : ""}" 💬`);
      setUnreadMsgCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [fetchConnections, user?.id, user?._id]);

  // Auto Hero Carousel
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SCENES.length);
    }, SCENE_MS);
    return () => clearTimeout(timer);
  }, [currentSlide]);

  // Navbar Scroll
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowLoginModal(false);
        setSelectedProfile(null);
        setShowBellDropdown(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch Logged in user's profile
  useEffect(() => {
    if (user) {
      api
        .get("/profile/me")
        .then((res) => setMyProfile(res.data))
        .catch(() => setMyProfile(null));
    } else {
      setMyProfile(null);
    }
  }, [user]);

  // Fetch real registered profiles
  useEffect(() => {
    let isMounted = true;
    const fetchRegisteredProfiles = async () => {
      setLoadingProfiles(true);
      try {
        const res = await api.get("/profile");
        if (!isMounted) return;
        if (Array.isArray(res.data)) {
          setProfiles(res.data);
        } else if (res.data?.profiles && Array.isArray(res.data.profiles)) {
          setProfiles(res.data.profiles);
        } else {
          setProfiles([]);
        }
      } catch (err) {
        try {
          const fallbackRes = await api.get("/profile/all");
          if (isMounted) {
            setProfiles(Array.isArray(fallbackRes.data) ? fallbackRes.data : []);
          }
        } catch {
          if (isMounted) setProfiles([]);
        }
      } finally {
        if (isMounted) setLoadingProfiles(false);
      }
    };

    fetchRegisteredProfiles();
    return () => { isMounted = false; };
  }, [user]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const { data } = await api.post("/auth/login", loginForm);
      saveAuth(data);
      setShowLoginModal(false);
      setLoginForm({ email: "", password: "" });
      if (!data.user.profileCreated) {
        navigate("/create-profile");
      }
    } catch (err) {
      setLoginError(err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoggingIn(false);
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return 24;
    const born = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - born.getFullYear();
    const beforeBirthday =
      now.getMonth() < born.getMonth() ||
      (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
    if (beforeBirthday) age--;
    return age;
  };

  const isNewUser = (createdAt) => {
    if (!createdAt) return false;
    const createdDate = new Date(createdAt);
    const today = new Date();
    const diffDays = (today - createdDate) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  };

  const myGender = myProfile?.gender?.toLowerCase() || "";
  const targetGender = myGender === "male" ? "female" : myGender === "female" ? "male" : null;

  const filteredMatches = profiles.filter((p) => {
    if (myProfile?._id && p._id === myProfile._id) return false;

    if (user && targetGender) {
      if (p.gender?.toLowerCase() !== targetGender) return false;
    } else {
      if (genderFilter !== "All" && p.gender !== genderFilter) return false;
    }

    const matchesSearch =
      search === "" ||
      p.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase()) ||
      p.occupation?.toLowerCase().includes(search.toLowerCase());

    const matchesReligion = religionFilter === "All" || p.religion === religionFilter;

    return matchesSearch && matchesReligion;
  });

  const getProfileUserId = (profile) => String(profile.user?._id || profile.user || profile._id);

  const handleConnect = async (targetId, targetName) => {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      await api.post("/connections/send", { receiverId: targetId });
      socketRef.current?.emit("sendConnectionNotification", {
        receiverId: targetId,
        senderName: user.name,
      });
      setSentRequestIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
      setToastAlert(`Request sent to ${targetName}! 💌`);
    } catch (err) {
      setToastAlert(err.response?.data?.message || "Request send nahi ho saki.");
    }
  };

  const handleRespond = async (connectionId, status, senderName) => {
    try {
      await api.post("/connections/respond", { connectionId, status });
      await fetchConnections();
      setShowBellDropdown(false);
      setToastAlert(status === "accepted" ? `${senderName || "Request"} accepted. 💬` : "Request rejected.");
    } catch (err) {
      setToastAlert(err.response?.data?.message || "Request update nahi ho saki.");
    }
  };

  return (
    <>
      <style>{homeStyles}</style>
      <div className="home-layout">
        {toastAlert && (
          <div className="floating-toast" role="status">
            <span>✨ {toastAlert}</span>
            <button onClick={() => setToastAlert("")} aria-label="Dismiss alert">✕</button>
          </div>
        )}

        {/* ================= 1. COMMUNITY MARQUEE ================= */}
        <div className="top-community-bar">
          <div className="marquee">
            {[...COMMUNITIES, ...COMMUNITIES].map((c, i) => (
              <span key={i}>{c}<em>✦</em></span>
            ))}
          </div>
        </div>

        {/* ================= 2. NAVBAR ================= */}
        <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
          <div className="nav-container">
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

            <div className="nav-search-desktop">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by name, city, profession..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search profiles"
              />
            </div>

            <div className="nav-actions">
              {user ? (
                <>
                  <div className="bell-container">
                    <button
                      className="btn-circle-bell"
                      onClick={() => setShowBellDropdown((shown) => !shown)}
                      aria-label={`Connection requests: ${pendingRequests.length}`}
                      aria-expanded={showBellDropdown}
                    >
                      🔔
                      {pendingRequests.length > 0 && (
                        <span className="bell-badge">{pendingRequests.length}</span>
                      )}
                    </button>
                    {showBellDropdown && (
                      <div className="bell-dropdown-box">
                        <div className="bell-dropdown-header">
                          <h4>Requests ({pendingRequests.length})</h4>
                          <button onClick={() => setShowBellDropdown(false)} aria-label="Close requests">✕</button>
                        </div>
                        {pendingRequests.length === 0 ? (
                          <p className="empty-requests">Koi request nahi hai</p>
                        ) : (
                          pendingRequests.map((req) => (
                            <div key={req._id} className="request-card-row">
                              <div>
                                <strong>{req.sender?.name}</strong>
                                <small>ne request bheji</small>
                              </div>
                              <div className="request-actions">
                                <button className="btn-acc-pill" onClick={() => handleRespond(req._id, "accepted", req.sender?.name)}>
                                  ✓ Accept
                                </button>
                                <button className="btn-rej-pill" onClick={() => handleRespond(req._id, "rejected", req.sender?.name)} aria-label="Reject request">
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <Link to="/messages" className="nav-messages-pill" title="Open Messages">
                    💬 <span className="nav-btn-text">Messages</span>
                    {unreadMsgCount > 0 && <span className="msg-counter">{unreadMsgCount}</span>}
                  </Link>
                  <Link to="/dashboard" className="nav-user-badge" title="Go to Dashboard">
                    ✨ {user.name}
                  </Link>
                  <button onClick={logout} className="btn-logout" aria-label="Log out">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <span className="member-label">Already a member?</span>
                  <Link to="/login" className="btn-nav-login">
                    Log in
                  </Link>
                  <Link to="/register" className="btn-nav-register">
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Search */}
          <div className="nav-search-mobile">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, city, profession..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search profiles on mobile"
            />
          </div>
        </header>

        {/* ================= 3. HERO SECTION ================= */}
        <section
          className="hero-section"
          style={{ "--glow": scene.glow, "--ms": `${SCENE_MS}ms` }}
        >
          <div className="hero-bg" aria-hidden="true">
            {HERO_SCENES.map((s, i) => (
              <div
                key={s.key}
                className={`scene ${currentSlide === i ? "on" : ""}`}
                style={{ "--a": s.a, "--b": s.b, "--glow": s.glow, "--gs": `${s.glow}44` }}
              >
                <i className="blob blob1" />
                <i className="blob blob2" />
              </div>
            ))}

            <Mandala className="mandala m-big" />
            <Mandala className="mandala m-small" />
            <div className="hero-shade" />
            <div className="grain" />

            {/* Original light/soft floating petals */}
            {PETALS.map((p, i) => (
              <i
                key={i}
                className="petal"
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

            <div className="hero-watermark" key={scene.key}>{scene.hindi}</div>
          </div>

          <div className="hero-container">
            <div className="hero-left">
              <h1 className="hero-heading">
                <span className="hero-heading-line">
                  <HoverWord en="Dil" hi="दिल" /> <HoverWord en="se" hi="से" /> <HoverWord en="dil" hi="दिल" /> <HoverWord en="tak," hi="तक," />
                </span>
                <span className="hero-heading-line">
                  <HoverWord en="ek" hi="एक" /> <HoverWord en="pavitra" hi="पवित्र" /> <HoverWord en="rishta." hi="रिश्ता।" />
                </span>
              </h1>

              <p className="hero-subtext">
                India's most trusted matrimony service. Celebrate life together with
                verified brides and grooms from cultured and respected families across India.
              </p>

              <p className="scene-line" key={`line-${scene.key}`}>
                ✦ {scene.line}
              </p>

              <div className="scene-tabs" role="tablist" aria-label="Wedding ceremonies">
                {HERO_SCENES.map((s, i) => (
                  <button
                    key={s.key}
                    role="tab"
                    aria-selected={currentSlide === i}
                    className={`scene-tab ${currentSlide === i ? "on" : ""}`}
                    onClick={() => setCurrentSlide(i)}
                  >
                    <span className="st-hindi">{s.hindi}</span>
                    <span className="st-name">{s.name}</span>
                    <span className="st-bar"><i /></span>
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Dynamic Card */}
            <div className="hero-right">
              {!user && (
                <div className="invite-card">
                  <div className="invite-head">
                    <span className="ganesh">॥ श्री गणेशाय नमः ॥</span>
                    <h3>Create a matrimony profile</h3>
                    <p>Find your soulmate today</p>
                  </div>

                  <div className="invite-body">
                    <div className="card-input-group">
                      <label htmlFor="profileFor">Profile created for</label>
                      <select
                        id="profileFor"
                        value={heroProfileFor}
                        onChange={(e) => setHeroProfileFor(e.target.value)}
                        className="matrimony-select"
                      >
                        <option value="Myself">Myself</option>
                        <option value="Son">My Son</option>
                        <option value="Daughter">My Daughter</option>
                        <option value="Brother">My Brother</option>
                        <option value="Sister">My Sister</option>
                        <option value="Friend">Relative / Friend</option>
                      </select>
                    </div>

                    <div className="card-input-group">
                      <label htmlFor="lookingFor">Looking for</label>
                      <select
                        id="lookingFor"
                        value={genderFilter}
                        onChange={(e) => setGenderFilter(e.target.value)}
                        className="matrimony-select"
                      >
                        <option value="All">Bride or Groom (All)</option>
                        <option value="Female">Bride (Female)</option>
                        <option value="Male">Groom (Male)</option>
                      </select>
                    </div>

                    <div className="card-input-group">
                      <label htmlFor="community">Community / Religion</label>
                      <select
                        id="community"
                        value={religionFilter}
                        onChange={(e) => setReligionFilter(e.target.value)}
                        className="matrimony-select"
                      >
                        <option value="All">All Religions</option>
                        <option value="Hindu">Hindu</option>
                        <option value="Sikh">Sikh</option>
                        <option value="Muslim">Muslim</option>
                        <option value="Christian">Christian</option>
                        <option value="Jain">Jain</option>
                      </select>
                    </div>

                    <button onClick={() => navigate("/register")} className="btn-register-cta">
                      Create my free profile
                    </button>

                    <p className="card-disclaimer">
                      By registering, you agree to our <u>Terms</u> and <u>Privacy Policy</u>
                    </p>
                  </div>
                </div>
              )}

              {user && !myProfile && (
                <div className="invite-card incomplete-card">
                  <div className="invite-head">
                    <span className="ganesh">॥ स्वागतम् ॥</span>
                    <h3>Complete Your Biodata</h3>
                    <p>Namaste {user.name}, you are just 1 step away!</p>
                  </div>
                  <div className="invite-body">
                    <div className="bio-progress-box">
                      <div className="bio-progress-labels">
                        <span>Profile Completeness</span>
                        <strong>40%</strong>
                      </div>
                      <div className="bio-bar-track">
                        <div className="bio-bar-fill" style={{ width: "40%" }}></div>
                      </div>
                    </div>

                    <p className="incomplete-desc">
                      Add your gotra/caste, education, photos, and expectations so prospective families can express interest.
                    </p>

                    <button onClick={() => navigate("/create-profile")} className="btn-register-cta">
                      Complete Biodata Now ➔
                    </button>

                    <button onClick={() => navigate("/dashboard")} className="btn-link-flat">
                      Skip to Dashboard
                    </button>
                  </div>
                </div>
              )}

              {user && myProfile && (
                <div className="invite-card user-welcome-card">
                  <div className="invite-head user-head">
                    <span className="ganesh">॥ शुभ विवाह ॥</span>
                    <div className="user-hero-avatar">
                      <Photo src={myProfile.photoUrl} name={myProfile.fullName} />
                      <span className="mini-verified-badge" title="Verified">✓</span>
                    </div>
                    <h3>Namaste, {myProfile.fullName?.split(" ")[0]}!</h3>
                    <p className="user-hero-meta">
                      {myProfile.occupation || "Member"} • {myProfile.city || "India"}
                    </p>
                  </div>

                  <div className="invite-body">
                    <div className="user-quick-stats-grid">
                      <div className="u-stat-box">
                        <span className="u-stat-count">{filteredMatches.length}</span>
                        <span className="u-stat-title">New Matches</span>
                      </div>
                      <div className="u-stat-box">
                        <span className="u-stat-count">{sentRequestIds.length}</span>
                        <span className="u-stat-title">Requests Sent</span>
                      </div>
                    </div>

                    <button onClick={() => navigate("/dashboard")} className="btn-register-cta">
                      Go to My Dashboard ➔
                    </button>

                    <div className="card-sub-actions">
                      <Link to="/messages" className="btn-secondary-link">
                        💬 Open Messages
                      </Link>
                      <span className="divider-dot">•</span>
                      <Link to="/create-profile" className="btn-secondary-link">
                        ✎ Edit Biodata
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="hero-scallop" />
        </section>

        {/* ================= 4. TRUST STATS STRIP ================= */}
        <section className="stats-strip">
          <div className="stats-container">
            <div className="stat-card">
              <span className="stat-number">100%</span>
              <span className="stat-label">Verified Profiles</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">50,000+</span>
              <span className="stat-label">Happy Marriages</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">100%</span>
              <span className="stat-label">Privacy Protected</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">28+</span>
              <span className="stat-label">States Connected</span>
            </div>
          </div>
        </section>

        {/* ================= 5. FILTERS SECTION ================= */}
        <section className="filter-controls-section">
          <div className="filters-strip">
            {!user && (
              <div className="filter-group">
                <span className="filter-label">Show:</span>
                <div className="chips-row">
                  {GENDER_OPTIONS.map(([value, label]) => (
                    <button
                      key={value}
                      className={`chip ${genderFilter === value ? "on" : ""}`}
                      onClick={() => setGenderFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="filter-group">
              <span className="filter-label">Religion:</span>
              <div className="chips-row">
                {RELIGIONS.map((r) => (
                  <button
                    key={r}
                    className={`chip ${religionFilter === r ? "on" : ""}`}
                    onClick={() => setReligionFilter(r)}
                  >
                    {r === "All" ? "All religions" : r}
                  </button>
                ))}
              </div>
            </div>

            {(search || religionFilter !== "All" || genderFilter !== "All") && (
              <button
                className="btn-reset"
                onClick={() => {
                  setSearch("");
                  setGenderFilter("All");
                  setReligionFilter("All");
                }}
              >
                Clear all filters ✕
              </button>
            )}
          </div>
        </section>

        {/* ================= 6. REAL PROFILES / MATCHES ================= */}
        <main className="matches-wrapper">
          <div className="matches-top">
            <div className="section-title-box">
              <h2 className="section-heading">Featured verified profiles</h2>
              <p className="section-subheading">Recently registered and verified prospective matches</p>
            </div>
            <span className="status-tag">
              {loadingProfiles
                ? "Loading members..."
                : user && targetGender
                  ? `Showing ${targetGender === "female" ? "brides" : "grooms"}`
                  : `Showing ${filteredMatches.length} profiles`}
            </span>
          </div>

          {loadingProfiles ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Khoj rahe hain pavitra rishtey...</p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🕊️</span>
              <h3>No registered profiles matching your filter</h3>
              <p>Be the first to join in your community, or clear current search filters.</p>
              {!user && (
                <Link to="/register" className="btn-cta-empty">
                  Register Your Profile Now
                </Link>
              )}
            </div>
          ) : (
            <div className="profiles-grid">
              {filteredMatches.map((item) => {
                const profileUserId = getProfileUserId(item);
                const isConnected = acceptedIds.includes(profileUserId) || connectedIds.includes(profileUserId);
                const incomingRequest = pendingRequests.find(
                  (request) => String(request.sender?._id || request.sender) === profileUserId
                );
                return (
                  <article key={item._id} className="profile-card">
                    <div className="arch-wrap">
                      <div className="arch">
                        <div className="arch-in">
                          <Photo src={item.photoUrl} name={item.fullName} />
                        </div>
                      </div>

                      {isNewUser(item.createdAt) && <span className="badge-new">New</span>}

                      <span className={`role-tag ${item.gender?.toLowerCase() || "female"}`}>
                        {item.gender === "Male" ? "Groom" : "Bride"}
                      </span>
                      <span className="seal">✓ Verified</span>
                    </div>

                    <div className="card-details">
                      <div className="name-row">
                        <h4>{item.fullName}</h4>
                        <span className="age-pill">{calculateAge(item.dob)} yrs</span>
                      </div>

                      <p className="vitals">
                        {item.height ? `${item.height} cm, ` : ""}{item.religion || "Faith"} {item.caste ? `(${item.caste})` : ""}
                      </p>

                      <div className="meta-lines">
                        <div><span className="meta-icon">🎓</span><span className="meta-text">{item.education || "Graduate"}</span></div>
                        <div><span className="meta-icon">💼</span><span className="meta-text">{item.occupation || "Professional"}, <strong>{item.annualIncome || "Confidential"}</strong></span></div>
                        <div><span className="meta-icon">📍</span><span className="meta-text">{item.city || "India"}, {item.state || ""}</span></div>
                      </div>

                      <div className="card-btns">
                        {isConnected ? (
                          <button
                            className="btn-interest sent"
                            onClick={() => navigate(`/messages?userId=${profileUserId}`)}
                            title="Open Chat"
                          >
                            💬 Message
                          </button>
                        ) : incomingRequest ? (
                          <div className="request-card-actions">
                            <button className="btn-acc-pill" onClick={() => handleRespond(incomingRequest._id, "accepted", item.fullName)}>
                              ✓ Accept
                            </button>
                            <button className="btn-rej-pill" onClick={() => handleRespond(incomingRequest._id, "rejected", item.fullName)} aria-label={`Reject ${item.fullName}'s request`}>
                              ✕
                            </button>
                          </div>
                        ) : sentRequestIds.includes(profileUserId) ? (
                          <button className="btn-interest sent" disabled>
                            ✓ Request Sent
                          </button>
                        ) : (
                          <button
                            className="btn-interest"
                            onClick={() => handleConnect(profileUserId, item.fullName)}
                          >
                            Connect now
                          </button>
                        )}
                        <button className="btn-bio" onClick={() => setSelectedProfile(item)}>
                          View bio
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        {/* ================= 7. HOW IT WORKS ================= */}
        <section className="how-it-works-section">
          <div className="section-header-center">
            <span className="sub-badge">Sahaj & Saral</span>
            <h2>How PairPerfect Works</h2>
            <p>Your journey from the first namaste to the sacred pheras</p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">01</div>
              <div className="step-icon">📝</div>
              <h3>Create Profile</h3>
              <p>Register with basic information, education, family background and upload photos safely.</p>
            </div>

            <div className="step-connector" aria-hidden="true">✦</div>

            <div className="step-card">
              <div className="step-num">02</div>
              <div className="step-icon">💫</div>
              <h3>Connect & Discover</h3>
              <p>Filter by community, horoscope, education, and lifestyle. Send direct interest requests.</p>
            </div>

            <div className="step-connector" aria-hidden="true">✦</div>

            <div className="step-card">
              <div className="step-num">03</div>
              <div className="step-icon">💍</div>
              <h3>Shubh Vivaah</h3>
              <p>Involve families, chat securely, and begin a lifetime of companionship with divine blessings.</p>
            </div>
          </div>
        </section>

        {/* ================= 8. TRUST & SAFETY SHIELD ================= */}
        <section className="trust-features-section">
          <div className="trust-box">
            <div className="trust-left">
              <span className="trust-shield-icon">🛡️</span>
              <h2>Pavitra, Safe & 100% Confidential</h2>
              <p>
                Marriage is two families uniting. PairPerfect ensures end-to-end encrypted messaging,
                identity verified badges, and strict photo privacy controls.
              </p>
              <div className="trust-bullets">
                <div className="bullet-item">
                  <span className="tick">✓</span>
                  <div>
                    <strong>Govt ID & Contact Verified</strong>
                    <p>Every profile undergoes automated checks and manual phone verification.</p>
                  </div>
                </div>
                <div className="bullet-item">
                  <span className="tick">✓</span>
                  <div>
                    <strong>Photo & Phone Privacy Shield</strong>
                    <p>Contact details and phone numbers are only shared after mutual consent.</p>
                  </div>
                </div>
                <div className="bullet-item">
                  <span className="tick">✓</span>
                  <div>
                    <strong>Encrypted Real-Time Chat</strong>
                    <p>Real-time messaging via WebSockets with secure, private communication channels.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="trust-right">
              <div className="royal-pledge-card">
                <span className="om-symbol">🕉️</span>
                <h3>Our Promise to You</h3>
                <p>
                  "We commit to upholding Indian cultural values, family dignity, and total
                  transparency so you can search for your life partner with peace of mind."
                </p>
                <div className="pledge-seal">PairPerfect Trust Certified</div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 9. SUCCESS STORIES ================= */}
        <section className="stories-section">
          <div className="section-header-center">
            <span className="sub-badge">Parinaam</span>
            <h2>Real Couples, Real Stories</h2>
            <p>Read about souls who found their eternal bond on PairPerfect</p>
          </div>

          <div className="stories-grid">
            <div className="story-card">
              <div className="story-quote">“</div>
              <p className="story-text">
                "We matched through PairPerfect when both our families were searching across Pune and Mumbai.
                The transparency of bio-data and verified status made both our parents confident immediately."
              </p>
              <div className="story-author">
                <div className="author-names">Pooja &amp; Rohit Kulkarni</div>
                <div className="author-loc">Married in Jan 2024 • Pune</div>
              </div>
            </div>

            <div className="story-card">
              <div className="story-quote">“</div>
              <p className="story-text">
                "Finding someone who shared my vegetarian lifestyle, tech ambitions, and cultural roots seemed tough.
                PairPerfect brought us together in just 3 weeks. Grateful forever!"
              </p>
              <div className="story-author">
                <div className="author-names">Neha &amp; Aman Verma</div>
                <div className="author-loc">Married in Nov 2023 • Bangalore</div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 10. ABOUT CREATOR & MISSION ================= */}
        <section className="about-creator-section">
          <div className="creator-container">
            <div className="creator-card">
              <div className="creator-badge">Vision & Heritage</div>
              <h2>Built with Devotion, Guided by Culture</h2>
              <p>
                <strong>PairPerfect</strong> was crafted to replace cold swiping apps with a respectful, warm,
                and authentic Indian matchmaking portal.
              </p>
              <p>
                Designed and developed with meticulous attention to detail by modern engineers who value
                traditional Bharatiya sanskaars, bringing together compatibility filters and modern data security.
              </p>
              <div className="creator-footer-note">
                <span>Designed & Built with ❤️ for families across Bharat & the Global Diaspora</span>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 11. LOGIN MODAL ================= */}
        {showLoginModal && (
          <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
            <div
              className="sheet login-modal-box"
              role="dialog"
              aria-modal="true"
              aria-label="Log in"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-btn" aria-label="Close" onClick={() => setShowLoginModal(false)}>✕</button>

              <div className="modal-title">
                <span className="modal-icon">🌸</span>
                <h2>Welcome back</h2>
                <p>Sign in to your PairPerfect account</p>
              </div>

              {loginError && <div className="modal-error">{loginError}</div>}

              <form onSubmit={handleLoginSubmit} className="modal-form">
                <div className="input-box">
                  <label htmlFor="loginEmail">Registered email</label>
                  <input
                    id="loginEmail"
                    type="email"
                    placeholder="yourname@gmail.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="input-box">
                  <label htmlFor="loginPass">Password</label>
                  <input
                    id="loginPass"
                    type="password"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" className="btn-modal-submit" disabled={loggingIn}>
                  {loggingIn ? "Logging in..." : "Log in"}
                </button>
              </form>

              <p className="modal-bottom">
                New to PairPerfect?{" "}
                <Link to="/register" onClick={() => setShowLoginModal(false)}>
                  Register free today
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* ================= 12. BIO-DATA MODAL ================= */}
        {selectedProfile && (
          <div className="modal-backdrop" onClick={() => setSelectedProfile(null)}>
            <div
              className="sheet bio-modal-box"
              role="dialog"
              aria-modal="true"
              aria-label={`${selectedProfile.fullName} bio-data`}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-btn" aria-label="Close" onClick={() => setSelectedProfile(null)}>✕</button>

              <div className="bio-head">
                <div className="bio-avatar-wrap">
                  <Photo src={selectedProfile.photoUrl} name={selectedProfile.fullName} />
                </div>
                <div className="bio-head-info">
                  <div className="bio-verified-text">✓ 100% verified profile</div>
                  <h3>{selectedProfile.fullName}</h3>
                  <p>{calculateAge(selectedProfile.dob)} years, {selectedProfile.occupation || "Professional"}, {selectedProfile.city || "India"}</p>
                </div>
              </div>

              <div className="bio-body">
                <div className="bio-desc">
                  <strong>About</strong>
                  <p>{selectedProfile.about || "Traditional, cultured and looking for a compatible life companion."}</p>
                </div>

                <div className="bio-stats">
                  <div><span>Community</span><strong>{selectedProfile.religion} {selectedProfile.caste ? `(${selectedProfile.caste})` : ""}</strong></div>
                  <div><span>Diet</span><strong>{selectedProfile.diet || "Not specified"}</strong></div>
                  <div><span>Marital status</span><strong>{selectedProfile.maritalStatus || "Never Married"}</strong></div>
                  <div><span>Annual package</span><strong>{selectedProfile.annualIncome || "Confidential"}</strong></div>
                  <div><span>Education</span><strong>{selectedProfile.education || "Graduate"}</strong></div>
                  <div><span>Current city</span><strong>{selectedProfile.city || "India"}, {selectedProfile.state || ""}</strong></div>
                </div>
              </div>

              <div className="bio-modal-footer">
                {acceptedIds.includes(getProfileUserId(selectedProfile)) || connectedIds.includes(getProfileUserId(selectedProfile)) ? (
                  <button
                    className="btn-interest full sent"
                    onClick={() => navigate(`/messages?userId=${getProfileUserId(selectedProfile)}`)}
                  >
                    💬 Open Chat Conversation
                  </button>
                ) : pendingRequests.some((request) => String(request.sender?._id || request.sender) === getProfileUserId(selectedProfile)) ? (
                  <div className="request-card-actions modal-request-actions">
                    {(() => {
                      const request = pendingRequests.find((item) => String(item.sender?._id || item.sender) === getProfileUserId(selectedProfile));
                      return (
                        <>
                          <button className="btn-acc-pill" onClick={() => handleRespond(request._id, "accepted", selectedProfile.fullName)}>✓ Accept</button>
                          <button className="btn-rej-pill" onClick={() => handleRespond(request._id, "rejected", selectedProfile.fullName)}>✕ Reject</button>
                        </>
                      );
                    })()}
                  </div>
                ) : sentRequestIds.includes(getProfileUserId(selectedProfile)) ? (
                  <button className="btn-interest full sent" disabled>✓ Request Sent</button>
                ) : (
                  <button
                    className="btn-interest full"
                    onClick={() => handleConnect(getProfileUserId(selectedProfile), selectedProfile.fullName)}
                  >
                    Send interest 💌
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= 13. GRAND FOOTER (BALANCED 2-COLUMN ON MOBILE) ================= */}
        <footer className="matrimony-footer">
          <div className="footer-top">
            {/* 1. Brand & Helpline Card */}
            <div className="footer-col brand-col">
              <Link to="/" className="brand-logo footer-brand" aria-label="PairPerfect Home">
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
              <p className="footer-tagline">
                The most trusted Indian matchmaking portal dedicated to finding sacred lifelong bonds.
              </p>
              <div className="helpline-card">
                <span>Family Helpline Support:</span>
                <strong>+91 (0) 800-RISHTEY</strong>
                <small>Mon - Sat (9:00 AM - 8:00 PM IST)</small>
              </div>
            </div>

            {/* 2. Browse By Community (Col 1 on Mobile) */}
            <div className="footer-col col-community">
              <h4>Browse By Community</h4>
              <ul>
                <li><Link to="/">Hindi Matrimony</Link></li>
                <li><Link to="/">Marathi Matrimony</Link></li>
                <li><Link to="/">Punjabi Matrimony</Link></li>
                <li><Link to="/">Gujarati Matrimony</Link></li>
                <li><Link to="/">Bengali Matrimony</Link></li>
                <li><Link to="/">South Indian Alliances</Link></li>
              </ul>
            </div>

            {/* 3. Quick Links (Col 2 Top on Mobile) */}
            <div className="footer-col col-quick">
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/register">Create Free Profile</Link></li>
                <li><Link to="/login">Member Login</Link></li>
                <li><Link to="/messages">Encrypted Chat</Link></li>
                <li><Link to="/dashboard">My Matches</Link></li>
              </ul>
            </div>

            {/* 4. Legal & Privacy (Col 2 Bottom on Mobile) */}
            <div className="footer-col col-legal">
              <h4>Legal &amp; Privacy</h4>
              <ul>
                <li><a href="#terms">Terms of Service</a></li>
                <li><a href="#privacy">Privacy &amp; Encryption</a></li>
                <li><a href="#security">Data Security Shield</a></li>
                <li><a href="#fraud">Report Suspicious Profile</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} PairPerfect Matrimony — Pavitra Rishtey. All Rights Reserved.</p>
            <p className="footer-credits">Architected with sacred tradition &amp; modern security.</p>
          </div>
        </footer>
      </div>
    </>
  );
}

const homeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Hind:wght@400;500;600;700&family=Yatra+One&display=swap');

  /* Root Container */
  .home-layout {
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
    width: 100%;
    overflow-x: hidden;
    color: var(--ivory);
    font-family: var(--body);
    background:
      radial-gradient(circle at 1px 1px, rgba(212, 167, 44, 0.12) 1px, transparent 0) 0 0 / 26px 26px,
      var(--night);
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
  }

  .home-layout *, 
  .home-layout *::before, 
  .home-layout *::after { 
    box-sizing: border-box; 
  }

  .home-layout button, 
  .home-layout input, 
  .home-layout select { 
    font-family: var(--body); 
    touch-action: manipulation;
  }

  .home-layout :focus-visible { 
    outline: 2px solid var(--gold-2); 
    outline-offset: 2px; 
  }

  /* 1. COMMUNITY MARQUEE */
  .top-community-bar {
    background: #14010a;
    border-bottom: 1px solid var(--gold-line);
    padding: 6px 0;
    font-size: 12px;
    color: rgba(255, 247, 230, 0.75);
    overflow: hidden;
    white-space: nowrap;
    position: relative;
    z-index: 102;
  }
  .marquee { 
    display: inline-flex; 
    animation: marq 40s linear infinite; 
    will-change: transform;
  }
  .marquee:hover { animation-play-state: paused; }
  .marquee span { padding: 0 16px; cursor: pointer; transition: color 0.2s ease; }
  .marquee span:hover { color: var(--gold-2); }
  .marquee em { font-style: normal; color: var(--gold); margin-left: 24px; font-size: 8px; }

  /* 2. NAVBAR */
  .navbar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(31, 2, 16, 0.88);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--gold-line);
    transition: background 0.3s ease;
  }
  .navbar.scrolled { 
    background: rgba(31, 2, 16, 0.98); 
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45);
  }
  .nav-container {
    max-width: 1240px;
    margin: 0 auto;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .brand-logo { 
    display: flex; 
    align-items: center; 
    gap: 8px; 
    text-decoration: none; 
    color: var(--ivory);
    flex-shrink: 0;
  }
  .logo-rings { width: 38px; height: 25px; fill: none; stroke: var(--gold); stroke-width: 1.6; }
  .logo-rings path { fill: var(--gold-2); stroke: none; }
  .brand-text { display: flex; flex-direction: column; line-height: 1; }
  .brand-name { font-family: var(--display); font-size: clamp(20px, 4.5vw, 25px); }
  .brand-name b { font-weight: 400; color: var(--gold-2); }
  .logo-sub { font-size: 10.5px; color: var(--gold); margin-top: 2px; letter-spacing: 0.5px; }

  .nav-search-desktop { 
    flex: 1; 
    max-width: 360px; 
    position: relative; 
    display: flex; 
    align-items: center; 
  }
  .nav-search-desktop .search-icon { 
    position: absolute; 
    left: 12px; 
    font-size: 13px; 
    opacity: 0.7; 
    pointer-events: none;
  }
  .nav-search-desktop input {
    width: 100%;
    padding: 8px 14px 8px 36px;
    background: rgba(255, 247, 230, 0.08);
    border: 1px solid var(--gold-line);
    border-radius: 999px;
    color: var(--ivory);
    font-size: 13.5px;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
  }
  .nav-search-desktop input:focus { border-color: var(--gold-2); background: rgba(255, 247, 230, 0.14); }

  /* Mobile Search Bar */
  .nav-search-mobile {
    display: none;
    position: relative;
    padding: 0 16px 10px;
  }
  .nav-search-mobile .search-icon {
    position: absolute;
    left: 28px;
    top: 8px;
    font-size: 13px;
    opacity: 0.7;
    pointer-events: none;
  }
  .nav-search-mobile input {
    width: 100%;
    padding: 7px 12px 7px 34px;
    background: rgba(255, 247, 230, 0.08);
    border: 1px solid var(--gold-line);
    border-radius: 999px;
    color: var(--ivory);
    font-size: 13px;
    outline: none;
  }

  .nav-actions { 
    display: flex; 
    align-items: center; 
    gap: 8px; 
    flex-shrink: 0;
  }
  .bell-container { position: relative; }
  .btn-circle-bell {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 247, 230, 0.08);
    border: 1px solid var(--gold-line);
    color: var(--gold-2);
    display: grid;
    place-items: center;
    font-size: 16px;
    cursor: pointer;
    position: relative;
  }

  .bell-badge, .msg-counter {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 17px;
    height: 17px;
    padding: 0 3px;
    border-radius: 999px;
    background: #e63946;
    color: #fff;
    font-size: 10.5px;
    font-weight: 800;
    display: grid;
    place-items: center;
  }
  
  .bell-dropdown-box {
    position: absolute;
    top: 44px;
    right: -6px;
    width: min(310px, calc(100vw - 24px));
    max-height: min(400px, 75dvh);
    overflow-y: auto;
    background: #fff7e6;
    color: #2b1118;
    border: 2px solid #d4a72c;
    border-radius: 12px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
    z-index: 200;
    animation: pop 0.2s ease both;
  }
  .bell-dropdown-header {
    position: sticky;
    top: 0;
    background: #7c0a2b;
    color: #fff;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 2;
  }
  .bell-dropdown-header h4 { margin: 0; font-size: 14px; font-weight: 600; }
  .bell-dropdown-header button { border: 0; background: transparent; color: #fff; cursor: pointer; font-size: 16px; }
  .empty-requests { padding: 18px 12px; margin: 0; color: #666; text-align: center; font-size: 13px; }
  .request-card-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid #e8d9b5;
  }
  .request-card-row small { display: block; color: #777; font-size: 11.5px; }
  .request-actions, .request-card-actions { display: flex; align-items: center; gap: 5px; }
  .request-card-actions { flex: 1; }
  .request-card-actions .btn-acc-pill { flex: 1; }
  .modal-request-actions { margin-top: 14px; width: 100%; }

  .btn-acc-pill, .btn-rej-pill {
    border: none;
    padding: 5px 10px;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    font-weight: 700;
    font-size: 12px;
    white-space: nowrap;
  }
  .btn-acc-pill { background: #0f7a55; }
  .btn-rej-pill { background: #c92a2a; }

  .nav-messages-pill {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--gold-2);
    text-decoration: none;
    font-weight: 600;
    font-size: 13px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--gold-line);
    background: rgba(212, 167, 44, 0.1);
  }
  .nav-messages-pill .msg-counter { top: -5px; right: -5px; }

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
  .floating-toast span { font-size: 13px; font-weight: 500; overflow-wrap: anywhere; }
  .floating-toast button {
    flex: none;
    border: 0;
    background: transparent;
    color: #7c0a2b;
    cursor: pointer;
    font-size: 16px;
    font-weight: 700;
  }

  .member-label { font-size: 13px; color: rgba(255, 247, 230, 0.7); }
  .btn-nav-login {
    background: transparent;
    color: var(--gold-2);
    border: 1px solid var(--gold);
    padding: 5px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
  }
  .btn-nav-login:hover { background: var(--gold); color: #3a0618; }
  .btn-nav-register {
    background: var(--gold);
    color: #3a0618;
    text-decoration: none;
    padding: 6px 16px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }

  .nav-user-badge {
    color: var(--gold-2);
    text-decoration: none;
    font-weight: 600;
    font-size: 12.5px;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid var(--gold-line);
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .btn-logout {
    background: transparent;
    border: 1px solid #e57373;
    color: #ff9c9c;
    padding: 5px 10px;
    border-radius: 999px;
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
  }

  /* 3. HERO */
  .hero-section {
    position: relative;
    isolation: isolate;
    min-height: 640px;
    padding: 48px 16px 84px;
    display: flex;
    align-items: center;
    overflow: hidden;
  }
  .hero-bg { 
    position: absolute; 
    inset: 0; 
    z-index: 0; 
    overflow: hidden; 
    background: var(--night); 
  }
  .scene {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 1.8s ease;
    background:
      radial-gradient(65% 80% at 82% 28%, var(--gs), transparent 70%),
      linear-gradient(125deg, var(--a) 0%, var(--b) 100%);
    will-change: opacity;
  }
  .scene.on { opacity: 1; }
  .blob {
    position: absolute;
    border-radius: 50%;
    background: var(--glow);
    filter: blur(80px);
    opacity: 0.26;
    animation: drift 14s ease-in-out infinite alternate;
    will-change: transform;
    pointer-events: none;
  }
  .blob1 { width: 480px; height: 480px; top: -140px; left: -100px; }
  .blob2 { width: 420px; height: 420px; bottom: -160px; right: 18%; opacity: 0.2; animation-duration: 18s; animation-delay: -6s; }

  .mandala { 
    position: absolute; 
    color: var(--glow); 
    transition: color 1.8s ease; 
    pointer-events: none; 
    will-change: transform;
  }
  .m-big {
    width: min(980px, 120vw);
    height: min(980px, 120vw);
    right: -14%;
    top: 50%;
    opacity: 0.24;
    transform: translateY(-50%);
    animation: spin 120s linear infinite;
  }
  .m-small {
    width: 560px;
    height: 560px;
    left: -9%;
    bottom: -32%;
    opacity: 0.14;
    animation: spinrev 90s linear infinite;
  }

  .hero-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(20, 1, 10, 0.6) 0%, rgba(20, 1, 10, 0.18) 55%, rgba(20, 1, 10, 0.38) 100%);
  }
  .grain {
    position: absolute;
    inset: 0;
    opacity: 0.08;
    mix-blend-mode: overlay;
    pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E");
  }

  /* Original Gentle Floating Petals */
  .petal {
    position: absolute;
    top: 0;
    border-radius: 0 100% 0 100%;
    opacity: 0;
    animation-name: petal;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
    pointer-events: none;
    z-index: 2;
  }

  .hero-watermark {
    position: absolute;
    z-index: 1;
    left: 2%;
    bottom: -3%;
    font-family: var(--display);
    font-size: clamp(120px, 22vw, 320px);
    line-height: 1;
    color: transparent;
    -webkit-text-stroke: 1.5px rgba(255, 247, 230, 0.14);
    pointer-events: none;
    user-select: none;
  }

  .hero-container {
    position: relative;
    z-index: 5;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 36px;
    align-items: center;
  }
  .hero-left { min-width: 0; overflow: visible; }

  /* Hero Heading & Unclipped Matra Fix */
  .hero-heading {
    font-family: var(--display);
    font-weight: 400;
    font-size: clamp(32px, 5.2vw, 72px);
    line-height: 1.38;
    margin: 0 0 14px;
    padding-top: 8px;
    filter: drop-shadow(0 3px 14px rgba(0, 0, 0, 0.4));
    user-select: none;
    overflow: visible;
  }
  .hero-heading-line { 
    display: block; 
    white-space: normal;
    overflow: visible;
  }

  .hover-word-box {
    display: inline-grid;
    grid-template-areas: "wordStack";
    position: relative;
    cursor: pointer;
    vertical-align: baseline;
    margin: 0 2px;
    overflow: visible;
  }
  .hover-word-box > span {
    grid-area: wordStack;
    padding: 8px 2px 2px;
    margin-top: -8px;
    background: linear-gradient(180deg, #fff7e6 15%, #f2cf6b 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    transition: opacity 0.22s ease, transform 0.22s ease;
    overflow: visible;
    line-height: inherit;
  }
  .hover-word-box .en-text {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  .hover-word-box .hi-text {
    opacity: 0;
    pointer-events: none;
    transform: translateY(3px);
    background: linear-gradient(180deg, #ffd166 15%, #ff9e00 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .hover-word-box:hover .en-text,
  .hover-word-box:active .en-text {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-3px);
  }
  .hover-word-box:hover .hi-text,
  .hover-word-box:active .hi-text {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  .hero-subtext {
    font-size: clamp(14.5px, 2vw, 17px);
    line-height: 1.6;
    max-width: 520px;
    color: rgba(255, 247, 230, 0.88);
    margin: 0 0 20px;
  }

  .scene-line { 
    margin: 0 0 14px; 
    font-size: clamp(14px, 1.8vw, 16px); 
    color: var(--gold-2); 
    animation: fadein 0.8s both; 
    font-weight: 500;
  }

  /* Ceremony Tabs */
  .scene-tabs { 
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px; 
    max-width: 480px;
  }
  .scene-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 6px 7px;
    background: rgba(255, 247, 230, 0.06);
    border: 1px solid rgba(255, 247, 230, 0.2);
    border-radius: 36px 36px 8px 8px;
    color: rgba(255, 247, 230, 0.75);
    cursor: pointer;
    transition: background 0.3s, border-color 0.3s, color 0.3s;
  }
  .scene-tab:hover { border-color: var(--gold); }
  .scene-tab.on { background: rgba(212, 167, 44, 0.2); border-color: var(--gold); color: var(--ivory); }
  .st-hindi { font-family: var(--display); font-size: clamp(16px, 3vw, 20px); line-height: 1.1; }
  .st-name { font-size: 11.5px; }
  .st-bar { display: block; width: 100%; height: 2px; margin-top: 5px; background: rgba(255, 247, 230, 0.16); border-radius: 2px; overflow: hidden; }
  .st-bar i { display: block; height: 100%; width: 0; background: var(--gold-2); }
  .scene-tab.on .st-bar i { animation: fillbar var(--ms) linear forwards; }

  /* 3.1 HERO CARDS */
  .hero-right { display: flex; justify-content: flex-end; width: 100%; }
  .invite-card {
    width: 100%;
    max-width: 400px;
    background: var(--ivory);
    color: var(--ink);
    border: 2px solid var(--gold);
    border-radius: 50% 50% 20px 20px / 60px 60px 20px 20px;
    overflow: hidden;
    box-shadow: 0 0 0 5px rgba(212, 167, 44, 0.2), 0 24px 50px rgba(0, 0, 0, 0.5);
  }
  .invite-head {
    padding: 34px 20px 14px;
    text-align: center;
    color: var(--ivory);
    background: linear-gradient(160deg, var(--maroon), var(--wine));
    border-bottom: 3px solid var(--gold);
  }
  .ganesh { display: block; font-family: var(--display); font-size: 13.5px; color: var(--gold-2); margin-bottom: 4px; }
  .invite-head h3 { font-family: var(--display); font-weight: 400; font-size: 22px; margin: 0; }
  .invite-head p { margin: 3px 0 0; font-size: 13px; color: rgba(255, 247, 230, 0.85); }
  .invite-body { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
  .card-input-group { display: flex; flex-direction: column; gap: 4px; }
  .card-input-group label { font-size: 12.5px; font-weight: 600; color: var(--ink); }
  .matrimony-select {
    appearance: none;
    -webkit-appearance: none;
    padding: 10px 36px 10px 12px;
    border: 1.5px solid #dcc58f;
    border-radius: 10px;
    background: #fffdf7 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%237c0a2b' stroke-width='2'/%3E%3C/svg%3E") no-repeat right 14px center / 12px;
    color: var(--ink);
    font-size: 14px;
    outline: none;
    cursor: pointer;
  }
  .matrimony-select:focus { border-color: var(--maroon); }
  .btn-register-cta {
    margin-top: 4px;
    background: linear-gradient(135deg, var(--gold-2), var(--gold));
    color: #3a0618;
    border: none;
    border-radius: 10px;
    padding: 12px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(124, 10, 43, 0.25);
    transition: filter 0.2s, transform 0.15s;
  }
  .btn-register-cta:hover { filter: brightness(1.06); }
  .btn-register-cta:active { transform: scale(0.98); }
  .card-disclaimer { font-size: 11.5px; color: var(--ink-soft); text-align: center; margin: 0; }

  /* LOGGED-IN HERO CARD STYLES */
  .user-head {
    padding: 24px 16px 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .user-hero-avatar {
    width: 78px;
    height: 78px;
    border-radius: 50%;
    border: 3px solid var(--gold);
    overflow: hidden;
    margin: 6px 0 8px;
    position: relative;
    background: #e9d5ad;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  }
  .user-hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .mini-verified-badge {
    position: absolute;
    bottom: 2px;
    right: 2px;
    background: #0f7a55;
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 11px;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--ivory);
  }
  .user-hero-meta {
    font-size: 12.5px;
    color: var(--gold-2) !important;
    margin-top: 2px !important;
  }

  .user-quick-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 4px;
  }
  .u-stat-box {
    background: var(--ivory-2);
    border: 1px solid #e2cd9a;
    border-radius: 12px;
    padding: 10px;
    text-align: center;
  }
  .u-stat-count {
    display: block;
    font-family: var(--display);
    font-size: 24px;
    color: var(--maroon);
    line-height: 1.1;
  }
  .u-stat-title {
    font-size: 12px;
    color: var(--ink-soft);
    font-weight: 500;
  }

  .card-sub-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
    font-size: 12.5px;
  }
  .btn-secondary-link {
    color: var(--maroon);
    text-decoration: none;
    font-weight: 600;
  }
  .btn-secondary-link:hover { text-decoration: underline; }
  .divider-dot { color: var(--gold); }

  /* INCOMPLETE BIODATA CARD */
  .bio-progress-box {
    background: var(--ivory-2);
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #e2cd9a;
  }
  .bio-progress-labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-bottom: 5px;
    font-weight: 600;
    color: var(--maroon);
  }
  .bio-bar-track {
    width: 100%;
    height: 7px;
    background: rgba(0, 0, 0, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }
  .bio-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--gold), #2b8a3e);
    border-radius: 999px;
  }
  .incomplete-desc {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-soft);
    margin: 4px 0;
  }
  .btn-link-flat {
    background: none;
    border: none;
    color: var(--ink-soft);
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
    padding: 4px;
  }

  .hero-scallop {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 22px;
    z-index: 6;
    background: radial-gradient(circle at 50% 100%, transparent 0 20px, var(--night) 21px) 0 0 / 44px 22px repeat-x;
  }

  /* 4. STATS STRIP */
  .stats-strip {
    background: rgba(43, 7, 22, 0.65);
    border-top: 1px solid var(--gold-line);
    border-bottom: 1px solid var(--gold-line);
    padding: 18px 16px;
  }
  .stats-container {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  .stat-card { 
    text-align: center; 
    padding: 8px;
    background: rgba(255, 247, 230, 0.03);
    border: 1px solid rgba(212, 167, 44, 0.18);
    border-radius: 12px;
  }
  .stat-number { display: block; font-family: var(--display); font-size: clamp(22px, 3.5vw, 30px); color: var(--gold-2); }
  .stat-label { font-size: 12px; color: rgba(255, 247, 230, 0.8); }

  /* 5. FILTERS SECTION */
  .filter-controls-section { padding: 0 16px; }
  .filters-strip {
    max-width: 1200px;
    margin: 20px auto 0;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(255, 247, 230, 0.05);
    border: 1px solid var(--gold-line);
    border-radius: 14px;
  }
  .filter-group { 
    display: flex; 
    align-items: center; 
    flex-wrap: wrap; 
    gap: 8px; 
    width: 100%;
  }
  .filter-label { 
    font-size: 13px; 
    font-weight: 600; 
    color: var(--gold-2); 
    min-width: 65px;
  }
  .chips-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    flex: 1;
  }
  .chip {
    background: transparent;
    border: 1px solid rgba(255, 247, 230, 0.25);
    color: rgba(255, 247, 230, 0.88);
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
    white-space: nowrap;
  }
  .chip:hover { border-color: var(--gold); }
  .chip.on { background: var(--gold); border-color: var(--gold); color: #3a0618; font-weight: 700; }
  .btn-reset {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--gold-2);
    text-decoration: underline;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
    padding: 2px 0;
  }

  /* 6. PROFILES GRID */
  .matches-wrapper { max-width: 1200px; margin: 30px auto 60px; padding: 0 16px; }
  .matches-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 22px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--gold-line);
  }
  .section-heading { font-family: var(--display); font-weight: 400; font-size: clamp(22px, 3.2vw, 34px); margin: 0; }
  .section-subheading { margin: 3px 0 0; font-size: 13.5px; color: rgba(255, 247, 230, 0.68); }
  .status-tag { border: 1px solid var(--gold-line); padding: 4px 12px; border-radius: 999px; font-size: 12.5px; color: var(--gold-2); white-space: nowrap; }

  .loading-state { text-align: center; padding: 50px 16px; }
  .spinner {
    width: 38px; height: 38px; border: 3px solid rgba(212, 167, 44, 0.2);
    border-top-color: var(--gold-2); border-radius: 50%;
    margin: 0 auto 14px; animation: spin 0.9s linear infinite;
  }

  .profiles-grid { 
    display: grid; 
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); 
    gap: 20px; 
  }

  .profile-card {
    background: var(--ivory);
    color: var(--ink);
    border: 1px solid var(--gold);
    outline: 1px solid rgba(212, 167, 44, 0.5);
    outline-offset: -5px;
    border-radius: 16px;
    padding: 12px 12px 14px;
    transition: box-shadow 0.25s, transform 0.25s;
    display: flex;
    flex-direction: column;
  }
  .profile-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 0 0 3px rgba(212, 167, 44, 0.5), 0 16px 36px rgba(0, 0, 0, 0.45);
  }

  .arch-wrap { position: relative; margin-bottom: 18px; }
  .arch {
    height: 250px;
    padding: 4px;
    border: 2px solid var(--gold);
    border-radius: 999px 999px 10px 10px;
    background: linear-gradient(#fff, var(--ivory-2));
  }
  .arch-in { height: 100%; border-radius: 999px 999px 6px 6px; overflow: hidden; background: #e9d5ad; }
  .arch-in img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo-fallback {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: linear-gradient(160deg, var(--maroon), var(--wine));
    color: var(--gold-2);
    font-family: var(--display);
    font-size: 52px;
  }
  .role-tag {
    position: absolute;
    left: 8px;
    bottom: -10px;
    padding: 2px 10px;
    border-radius: 999px;
    border: 1px solid var(--gold);
    font-size: 11.5px;
    font-weight: 600;
    color: var(--ivory);
    background: var(--maroon);
  }
  .role-tag.male { background: #1d3a73; }
  .seal {
    position: absolute;
    right: 8px;
    bottom: -10px;
    padding: 2px 9px;
    border-radius: 999px;
    border: 1px solid var(--gold-2);
    background: #0f7a55;
    color: #fff;
    font-size: 11.5px;
    font-weight: 600;
  }
  .badge-new {
    position: absolute;
    top: 6px;
    right: 0;
    z-index: 2;
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--gold);
    color: #3a0618;
    font-size: 11.5px;
    font-weight: 700;
  }

  .card-details {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .name-row { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .card-details h4 { 
    font-family: var(--display); 
    font-weight: 400; 
    font-size: 20px; 
    margin: 0; 
    color: var(--maroon);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .age-pill { font-size: 12px; font-weight: 600; color: var(--maroon); background: #fffdf5; border: 1px solid #dcc58f; border-radius: 999px; padding: 1px 9px; white-space: nowrap; }
  .vitals { margin: 4px 0 8px; font-size: 13px; color: var(--ink-soft); }
  
  .meta-lines { 
    display: grid; 
    gap: 5px; 
    padding-top: 8px; 
    margin-bottom: 12px; 
    border-top: 1px dashed #d9c18a; 
    font-size: 13px; 
  }
  .meta-lines > div {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .meta-icon { flex-shrink: 0; }
  .meta-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-btns { display: flex; gap: 6px; margin-top: auto; }
  .btn-interest {
    flex: 1;
    background: var(--maroon);
    color: var(--ivory);
    border: 1px solid var(--maroon);
    padding: 8px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    white-space: nowrap;
  }
  .btn-interest:hover { background: var(--wine); }
  .btn-interest.sent { background: #0f7a55; border-color: #0f7a55; }
  .btn-bio {
    background: transparent;
    color: var(--maroon);
    border: 1.5px solid var(--gold);
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .empty-state { text-align: center; padding: 40px 16px; border: 1px dashed var(--gold-line); border-radius: 14px; }
  .empty-icon { font-size: 34px; display: inline-block; margin-bottom: 6px; }
  .empty-state h3 { font-family: var(--display); font-weight: 400; font-size: 20px; margin: 0 0 6px; }
  .empty-state p { margin: 0 0 14px; color: rgba(255, 247, 230, 0.7); font-size: 13.5px; }
  .btn-cta-empty {
    display: inline-block;
    background: var(--gold);
    color: #3a0618;
    padding: 8px 20px;
    border-radius: 999px;
    font-weight: 700;
    text-decoration: none;
    font-size: 13.5px;
  }

  /* 7. HOW IT WORKS */
  .how-it-works-section { max-width: 1200px; margin: 60px auto; padding: 0 16px; }
  .section-header-center { text-align: center; margin-bottom: 32px; }
  .sub-badge {
    display: inline-block;
    padding: 3px 12px;
    background: rgba(212, 167, 44, 0.15);
    border: 1px solid var(--gold-line);
    border-radius: 999px;
    font-size: 12px;
    color: var(--gold-2);
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }
  .section-header-center h2 { font-family: var(--display); font-weight: 400; font-size: clamp(24px, 3.5vw, 36px); margin: 0 0 6px; }
  .section-header-center p { margin: 0; color: rgba(255, 247, 230, 0.7); font-size: 14px; }

  .steps-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto 1fr;
    align-items: center;
    gap: 12px;
  }
  .step-card {
    background: rgba(255, 247, 230, 0.04);
    border: 1px solid var(--gold-line);
    border-radius: 16px;
    padding: 22px 16px;
    text-align: center;
    position: relative;
    transition: transform 0.2s, background 0.2s;
  }
  .step-num {
    position: absolute;
    top: 10px;
    right: 14px;
    font-family: var(--display);
    font-size: 16px;
    color: var(--gold);
    opacity: 0.6;
  }
  .step-icon { font-size: 34px; margin-bottom: 8px; }
  .step-card h3 { font-family: var(--display); font-weight: 400; font-size: 19px; margin: 0 0 5px; color: var(--gold-2); }
  .step-card p { margin: 0; font-size: 13.5px; line-height: 1.5; color: rgba(255, 247, 230, 0.75); }
  .step-connector { color: var(--gold); font-size: 16px; opacity: 0.6; }

  /* 8. TRUST & SAFETY */
  .trust-features-section { max-width: 1200px; margin: 56px auto; padding: 0 16px; }
  .trust-box {
    background: linear-gradient(135deg, rgba(74, 4, 24, 0.75), rgba(20, 1, 10, 0.92));
    border: 1px solid var(--gold);
    border-radius: 20px;
    padding: 32px 24px;
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 26px;
    align-items: center;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  }
  .trust-shield-icon { font-size: 36px; display: inline-block; margin-bottom: 6px; }
  .trust-left h2 { font-family: var(--display); font-size: clamp(24px, 3vw, 32px); margin: 0 0 8px; font-weight: 400; }
  .trust-left > p { margin: 0 0 18px; color: rgba(255, 247, 230, 0.82); line-height: 1.55; font-size: 14px; }
  .trust-bullets { display: flex; flex-direction: column; gap: 12px; }
  .bullet-item { display: flex; gap: 10px; align-items: flex-start; }
  .bullet-item .tick {
    background: var(--gold);
    color: #3a0618;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 11px;
    flex: none;
    margin-top: 2px;
  }
  .bullet-item strong { display: block; font-size: 14.5px; color: var(--gold-2); margin-bottom: 2px; }
  .bullet-item p { margin: 0; font-size: 13px; color: rgba(255, 247, 230, 0.72); }

  .royal-pledge-card {
    background: var(--ivory);
    color: var(--ink);
    border: 2px solid var(--gold);
    border-radius: 16px;
    padding: 24px 18px;
    text-align: center;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }
  .om-symbol { font-size: 28px; display: inline-block; color: var(--maroon); margin-bottom: 4px; }
  .royal-pledge-card h3 { font-family: var(--display); font-size: 20px; color: var(--maroon); margin: 0 0 6px; font-weight: 400; }
  .royal-pledge-card p { font-size: 13.5px; line-height: 1.55; font-style: italic; color: var(--ink-soft); margin: 0 0 14px; }
  .pledge-seal {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--maroon);
    color: var(--gold-2);
    font-size: 11px;
    font-weight: 700;
  }

  /* 9. STORIES */
  .stories-section { max-width: 1200px; margin: 60px auto; padding: 0 16px; }
  .stories-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .story-card {
    background: rgba(255, 247, 230, 0.04);
    border: 1px solid var(--gold-line);
    border-radius: 16px;
    padding: 22px 18px;
    position: relative;
  }
  .story-quote { font-family: var(--display); font-size: 40px; line-height: 1; color: var(--gold); opacity: 0.4; margin-bottom: -6px; }
  .story-text { font-size: 14px; line-height: 1.6; color: rgba(255, 247, 230, 0.85); margin: 0 0 14px; font-style: italic; }
  .author-names { font-family: var(--display); font-size: 16px; color: var(--gold-2); }
  .author-loc { font-size: 12px; color: rgba(255, 247, 230, 0.6); margin-top: 2px; }

  /* 10. ABOUT CREATOR */
  .about-creator-section { max-width: 1200px; margin: 50px auto 70px; padding: 0 16px; }
  .creator-card {
    text-align: center;
    background: radial-gradient(circle at 50% 0%, rgba(212, 167, 44, 0.15), transparent 70%), rgba(20, 1, 10, 0.6);
    border: 1px dashed var(--gold);
    border-radius: 18px;
    padding: 34px 18px;
  }
  .creator-badge {
    display: inline-block;
    font-size: 12px;
    font-weight: 600;
    color: var(--gold-2);
    border: 1px solid var(--gold-line);
    padding: 3px 12px;
    border-radius: 999px;
    margin-bottom: 10px;
  }
  .creator-card h2 { font-family: var(--display); font-size: clamp(22px, 3.2vw, 30px); font-weight: 400; margin: 0 0 10px; }
  .creator-card p { max-width: 760px; margin: 0 auto 8px; font-size: 14.5px; line-height: 1.6; color: rgba(255, 247, 230, 0.82); }
  .creator-footer-note { margin-top: 16px; font-size: 13px; color: var(--gold); font-weight: 600; }

  /* 11 & 12. MODALS */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 400;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px;
    background: rgba(15, 1, 8, 0.85);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .sheet {
    position: relative;
    width: 100%;
    max-height: min(600px, calc(100dvh - 30px));
    overflow-y: auto;
    background: var(--ivory);
    color: var(--ink);
    border: 2px solid var(--gold);
    border-radius: 30px 30px 18px 18px;
    box-shadow: 0 0 0 5px rgba(212, 167, 44, 0.2), 0 24px 60px rgba(0, 0, 0, 0.55);
    animation: pop 0.25s ease both;
  }
  .login-modal-box { max-width: 400px; padding: 36px 20px 22px; }
  .bio-modal-box { max-width: 500px; padding: 36px 20px 22px; }
  
  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 50%;
    background: var(--ivory-2);
    color: var(--maroon);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .modal-title { text-align: center; margin-bottom: 14px; }
  .modal-icon { font-size: 24px; }
  .modal-title h2 { font-family: var(--display); font-weight: 400; font-size: 23px; margin: 3px 0; color: var(--maroon); }
  .modal-title p { margin: 0; font-size: 13.5px; color: var(--ink-soft); }
  .modal-error { background: #fde8e8; border: 1px solid #f8b4b4; color: #9b1c1c; padding: 8px; border-radius: 8px; font-size: 13px; margin-bottom: 10px; text-align: center; }
  .modal-form { display: flex; flex-direction: column; gap: 10px; }
  .input-box { display: flex; flex-direction: column; gap: 4px; }
  .input-box label { font-size: 12.5px; font-weight: 600; }
  .input-box input {
    padding: 9px 12px;
    border: 1.5px solid #dcc58f;
    border-radius: 9px;
    background: #fffdf7;
    color: var(--ink);
    font-size: 14px;
    outline: none;
  }
  .btn-modal-submit {
    margin-top: 4px;
    padding: 11px;
    border: 1px solid var(--gold);
    border-radius: 9px;
    background: var(--maroon);
    color: var(--ivory);
    font-size: 14.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .modal-bottom { text-align: center; font-size: 13px; color: var(--ink-soft); margin: 12px 0 0; }
  .modal-bottom a { color: var(--maroon); font-weight: 700; }

  .bio-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #d9c18a; }
  .bio-avatar-wrap { flex: none; width: 72px; height: 90px; border: 2px solid var(--gold); border-radius: 999px 999px 8px 8px; overflow: hidden; background: #e9d5ad; }
  .bio-avatar-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bio-avatar-wrap .photo-fallback { font-size: 24px; }
  .bio-head-info { min-width: 0; }
  .bio-verified-text { font-size: 12px; font-weight: 600; color: #0f7a55; }
  .bio-head h3 { font-family: var(--display); font-weight: 400; font-size: 22px; margin: 2px 0; color: var(--maroon); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bio-head p { margin: 0; font-size: 13px; color: var(--ink-soft); }
  .bio-desc { margin-bottom: 10px; font-size: 13.5px; }
  .bio-desc strong { color: var(--maroon); }
  .bio-desc p { margin: 3px 0 0; line-height: 1.5; }
  .bio-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
    margin-bottom: 14px;
    padding: 10px;
    background: var(--ivory-2);
    border: 1px solid #e2cd9a;
    border-radius: 10px;
  }
  .bio-stats div { display: flex; flex-direction: column; }
  .bio-stats span { font-size: 11.5px; color: var(--ink-soft); }
  .bio-stats strong { font-size: 13px; }
  .bio-modal-footer { margin-top: 8px; }
  .btn-interest.full { width: 100%; flex: none; padding: 10px; }

  /* ================= 13. BALANCED ORIGINAL FOOTER ================= */
  .matrimony-footer {
    background: #110108;
    border-top: 1px solid var(--gold-line);
    padding: 48px 16px 22px;
  }
  .footer-top {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 1fr;
    gap: 32px;
    padding-bottom: 32px;
    border-bottom: 1px solid rgba(212, 167, 44, 0.2);
  }
  .footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  margin-bottom: 14px;
}
  .footer-tagline { font-size: 13.5px; color: rgba(255, 247, 230, 0.75); line-height: 1.55; margin: 0 0 16px; }
  .helpline-card {
    background: rgba(255, 247, 230, 0.05);
    border: 1px solid var(--gold-line);
    padding: 12px 14px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .helpline-card span { font-size: 11.5px; color: var(--gold-2); }
  .helpline-card strong { font-size: 15px; color: var(--ivory); }
  .helpline-card small { font-size: 11px; color: rgba(255, 247, 230, 0.6); }

  .footer-col h4 { 
    font-family: var(--display); 
    font-size: 18px; 
    color: var(--gold-2); 
    margin: 0 0 14px; 
    font-weight: 400; 
  }
  .footer-col ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .footer-col a { color: rgba(255, 247, 230, 0.7); text-decoration: none; font-size: 13.5px; transition: color 0.2s; }
  .footer-col a:hover { color: var(--gold); }

  .footer-bottom {
    max-width: 1200px;
    margin: 18px auto 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12.5px;
    color: rgba(255, 247, 230, 0.5);
  }
  .footer-credits { font-size: 12px; color: var(--gold); }

  /* ANIMATIONS */
  @keyframes marq { 
    from { transform: translate3d(0, 0, 0); } 
    to { transform: translate3d(-50%, 0, 0); } 
  }
  @keyframes spin { 
    from { transform: translate3d(0, -50%, 0) rotate(0deg); } 
    to { transform: translate3d(0, -50%, 0) rotate(360deg); } 
  }
  @keyframes spinrev { 
    from { transform: rotate(0deg); } 
    to { transform: rotate(-360deg); } 
  }
  @keyframes drift { 
    from { transform: translate3d(0, 0, 0) scale(1); } 
    to { transform: translate3d(120px, 80px, 0) scale(1.25); } 
  }

  /* Original Delicate Floating Petals Keyframe */
  @keyframes petal {
    0% { transform: translate3d(0, -8vh, 0) rotate(0deg); opacity: 0; }
    8% { opacity: 0.6; }
    50% { transform: translate3d(46px, 48vh, 0) rotate(200deg); opacity: 0.55; }
    100% { transform: translate3d(-34px, 105vh, 0) rotate(400deg); opacity: 0; }
  }
  @keyframes fillbar { from { width: 0; } to { width: 100%; } }
  @keyframes fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }

  /* ================= RESPONSIVE QUERIES ================= */
  @media (max-width: 960px) {
    .nav-search-desktop { display: none; }
    .nav-search-mobile { display: block; }
    .hero-container { grid-template-columns: 1fr; gap: 28px; }
    .hero-right { justify-content: center; }
    .invite-card { max-width: 440px; }
    .trust-box { grid-template-columns: 1fr; padding: 26px 18px; }
    .steps-grid { grid-template-columns: 1fr; gap: 14px; }
    .step-connector { display: none; }
    .stories-grid { grid-template-columns: 1fr; }
    .footer-top { grid-template-columns: 1fr 1fr; gap: 28px; }
  }

  /* MOBILE SPECIFIC FOOTER & LAYOUT */
  @media (max-width: 680px) {
    .member-label { display: none; }
    .nav-btn-text { display: none; }
    .nav-messages-pill { padding: 6px 10px; }
    .nav-user-badge { max-width: 95px; padding: 5px 8px; font-size: 11.5px; }
    
    .hero-section { padding: 32px 12px 64px; min-height: 0; }
    .scene-tabs { gap: 6px; }
    .st-name { font-size: 10.5px; }
    .scene-tab { padding: 7px 4px 6px; }

    /* Stats: 2x2 grid */
    .stats-container {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    /* Filters Clean Mobile Layout */
    .filters-strip { padding: 12px; gap: 10px; }
    .filter-group { flex-direction: column; align-items: flex-start; gap: 6px; }
    .chips-row { width: 100%; }

    /* PERFECT BALANCED 2-COLUMN FOOTER (NO ORPHAN COLUMNS) */
    .footer-top {
      grid-template-columns: 1fr 1fr;
      gap: 20px 14px;
    }
    .brand-col {
      grid-column: span 2;
      margin-bottom: 4px;
    }
    .col-community {
      grid-column: 1;
      grid-row: 2 / span 2; /* Left column has all 6 community links */
    }
    .col-quick {
      grid-column: 2;
      grid-row: 2;          /* Right column top has Quick Links */
    }
    .col-legal {
      grid-column: 2;
      grid-row: 3;          /* Right column bottom has Legal & Privacy */
      margin-top: 2px;
    }
    .footer-bottom {
      flex-direction: column;
      text-align: center;
      gap: 6px;
    }
      /* Mobile me "Featured verified profiles" ko Image 2 ki tarah center karne ke liye */
  .matches-top {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }

  .matches-top .status-tag {
    order: -1; /* Isse "Showing profiles" wala badge sabse upar chala jayega (Image 2 ke Sahaj & Saral ki tarah) */
  }

  .matches-top .section-title-box {
    text-align: center;
  }
  }

  @media (max-width: 360px) {
    .brand-name { font-size: 18px; }
    .btn-nav-login { padding: 4px 10px; font-size: 12px; }
    .btn-nav-register { padding: 5px 12px; font-size: 12px; }
  }
`;
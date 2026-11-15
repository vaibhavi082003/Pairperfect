import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

/* --- 🌸 Petals Data (Soft & Light) --- */
const PETAL_COLORS = ["#ffb703", "#fb8500", "#ff7b54", "#ffd166", "#e63946"];
const PETALS = Array.from({ length: 18 }, (_, i) => ({
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

const initial = {
  fullName: "",
  gender: "",
  dob: "",
  maritalStatus: "Never Married",
  height: "",
  phone: "",
  religion: "",
  caste: "",
  motherTongue: "",
  manglik: "Don't Know",
  education: "",
  occupation: "",
  annualIncome: "",
  city: "",
  state: "",
  country: "India",
  fatherName: "",
  fatherOccupation: "",
  motherName: "",
  motherOccupation: "",
  siblings: 0,
  familyType: "Nuclear",
  diet: "Vegetarian",
  smoking: "No",
  drinking: "No",
  about: "",
  partnerPreference: "",
  photoUrl: "",
};

function FormInput({ label, name, value, onChange, required, type = "text", placeholder, ...props }) {
  return (
    <div className="card-input-group">
      <label htmlFor={name}>
        {label} {required && <span className="req">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value || ""}
        onChange={onChange}
        className="matrimony-input"
        autoComplete="off"
        {...props}
      />
    </div>
  );
}

function FormSelect({ label, name, value, onChange, required, options, ...props }) {
  return (
    <div className="card-input-group">
      <label htmlFor={name}>
        {label} {required && <span className="req">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value || ""}
        onChange={onChange}
        className="matrimony-select"
        {...props}
      >
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function Photo({ src, name }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    const initials = (name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("");
    return <div className="photo-fallback">{initials}</div>;
  }
  return <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />;
}

export default function CreateProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const userDraftKey = user ? `pairperfect_draft_${user.id || user._id}` : null;

  const [form, setForm] = useState(() => ({
    ...initial,
    fullName: user?.name || "",
  }));
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // 🛡️ Phone Verification States
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);

  // Calculate strict date boundaries (Legal age: 18 - 75 years)
  const today = new Date();
  const maxDobDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    .toISOString().split("T")[0];
  const minDobDate = new Date(today.getFullYear() - 75, today.getMonth(), today.getDate())
    .toISOString().split("T")[0];

  useEffect(() => {
    localStorage.removeItem("pairperfect_profile_draft");

    api
      .get("/profile/me")
      .then((res) => {
        if (res.data && res.data.fullName) {
          const profileData = { ...res.data };
          if (profileData.dob) {
            profileData.dob = profileData.dob.split("T")[0];
          }
          setForm({ ...initial, ...profileData });
          if (profileData.isPhoneVerified) {
            setIsPhoneVerified(true);
          }
        } else {
          loadUserDraft();
        }
      })
      .catch(() => {
        loadUserDraft();
      })
      .finally(() => {
        setFetchingProfile(false);
      });
  }, [user]);

  const loadUserDraft = () => {
    if (!userDraftKey) {
      setForm({ ...initial, fullName: user?.name || "" });
      return;
    }
    const savedDraft = localStorage.getItem(userDraftKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setForm({ ...initial, ...parsed });
        if (parsed.isPhoneVerified) setIsPhoneVerified(true);
      } catch {
        setForm({ ...initial, fullName: user?.name || "" });
      }
    } else {
      setForm({ ...initial, fullName: user?.name || "" });
    }
  };

  useEffect(() => {
    if (!fetchingProfile && userDraftKey) {
      try {
        localStorage.setItem(userDraftKey, JSON.stringify({ ...form, isPhoneVerified }));
      } catch (err) {
        console.error("Draft save error:", err);
      }
    }
  }, [form, isPhoneVerified, fetchingProfile, userDraftKey]);

  // OTP Countdown Timer
  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((prev) => prev - 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Agar phone number change kare toh verification reset ho jayegi
    if (name === "phone" && isPhoneVerified) {
      setIsPhoneVerified(false);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
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
    return age > 0 ? age : 24;
  };

  // 📲 Send OTP Handler
  const handleSendOtp = async () => {
    setError("");
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(form.phone)) {
      setError("Pehle valid 10-digit Indian Mobile Number enter karein (starting with 6,7,8,9).");
      return;
    }

    setOtpLoading(true);
    setOtpError("");
    setOtpSuccess("");

    try {
      const { data } = await api.post("/auth/send-phone-otp", { phone: form.phone });
      setShowOtpModal(true);
      setOtpSuccess(data.message || "OTP sent successfully! (Dev mode: terminal me check karein ya use '123456')");
      setOtpTimer(60);
    } catch (err) {
      setError(err.response?.data?.message || "OTP bhejne me problem aayi. Kripya dobara koshish karein.");
    } finally {
      setOtpLoading(false);
    }
  };

  // ✅ Verify OTP Handler
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpValue || otpValue.trim().length < 4) {
      setOtpError("Kripya valid 6-digit OTP enter karein.");
      return;
    }

    setOtpLoading(true);
    setOtpError("");

    try {
      const { data } = await api.post("/auth/verify-phone-otp", {
        phone: form.phone,
        otp: otpValue.trim(),
      });
      setIsPhoneVerified(true);
      setShowOtpModal(false);
      setOtpValue("");
      alert(data.message || "Mobile number successfully verified! ✓");
    } catch (err) {
      setOtpError(err.response?.data?.message || "Galat OTP! Kripya sahi OTP dalein.");
    } finally {
      setOtpLoading(false);
    }
  };

  // 🚀 Strict Submit Validation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 1. Phone number format check
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(form.phone)) {
      setError("Galat phone number! Kripya sahi 10-digit mobile number dalein (6, 7, 8, 9 se shuru hona chahiye).");
      window.scrollTo({ top: 150, behavior: "smooth" });
      return;
    }

    // 2. Strict Phone OTP Verification check
    if (!isPhoneVerified) {
      setError("Pavitra Rishtey ki suraksha ke liye, kripya apna mobile number pehle OTP se verify karein.");
      window.scrollTo({ top: 150, behavior: "smooth" });
      return;
    }

    // 3. Legal Marriage Age check
    const userAge = calculateAge(form.dob);
    const minLegalAge = form.gender === "Male" ? 21 : 18;

    if (userAge < minLegalAge) {
      setError(
        `Niyam anusar, ${form.gender === "Male" ? "Groom (Male) ki aayu kam se kam 21 saal" : "Bride (Female) ki aayu kam se kam 18 saal"} honi anivarya hai.`
      );
      window.scrollTo({ top: 150, behavior: "smooth" });
      return;
    }

    setLoading(true);

    const cleanPayload = {};
    Object.entries(form).forEach(([key, val]) => {
      if (val !== "" && val !== null && val !== undefined) {
        if (key === "height" || key === "siblings") {
          const num = Number(val);
          if (!isNaN(num)) cleanPayload[key] = num;
        } else {
          cleanPayload[key] = val;
        }
      }
    });

    cleanPayload.isPhoneVerified = true;

    try {
      await api.post("/profile", cleanPayload);

      if (userDraftKey) {
        localStorage.removeItem(userDraftKey);
      }
      localStorage.removeItem("pairperfect_profile_draft");

      setUser((prev) => ({ ...prev, profileCreated: true }));
      navigate("/dashboard");
    } catch (err) {
      const serverMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Backend rejected data. Kripya sahi information check karein.";
      setError(serverMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDraft = () => {
    if (window.confirm("Kya aap sach me ye form reset karna chahte hain?")) {
      if (userDraftKey) {
        localStorage.removeItem(userDraftKey);
      }
      localStorage.removeItem("pairperfect_profile_draft");
      setIsPhoneVerified(false);
      setForm({ ...initial, fullName: user?.name || "" });
    }
  };

  if (fetchingProfile) {
    return (
      <>
        <style>{createProfileStyles}</style>
        <div className="cp-layout">
          <div className="cp-loading-screen">
            <span className="loading-flower">🌸</span>
            <p>Loading your sacred bio-data...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{createProfileStyles}</style>

      <div className="cp-layout">
        <div className="cp-bg-layer" aria-hidden="true">
          <div className="ambient-blob b1" />
          <div className="ambient-blob b2" />
          <Mandala className="bg-mandala m-left" />
          <Mandala className="bg-mandala m-right" />

          {PETALS.map((p, i) => (
            <i
              key={i}
              className="cp-petal"
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
          <div className="cp-grain" />
        </div>

        <header className="cp-nav">
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

          <div className="nav-actions-right">
            <span className="auto-save-pill" title="All edits are auto-saved">
              <span className="pill-dot" /> <span className="pill-text">Draft Saved</span>
            </span>
            <Link to="/dashboard" className="btn-skip-dash">
              Dashboard <span className="dash-arrow">→</span>
            </Link>
          </div>
        </header>

        <div className="mobile-preview-toggle-bar">
          <button
            type="button"
            className={`btn-toggle-preview ${showMobilePreview ? "active" : ""}`}
            onClick={() => setShowMobilePreview(!showMobilePreview)}
          >
            {showMobilePreview ? "✕ Hide Card Preview" : "👁️ View Live Card Preview"}
          </button>
        </div>

        <main className="cp-container">
          <div className="form-column">
            <div className="invite-head-banner">
              <span className="ganesh">॥ श्री गणेशाय नमः ॥</span>
              <h2>Complete Matrimonial Profile</h2>
              <p>Authentic verified details will protect your profile from fake accounts</p>
            </div>

            {error && (
              <div className="modal-error">
                <strong>Attention: </strong> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="sections-list">
              {/* 1. Basic Details */}
              <div className="form-section-card">
                <div className="sec-title">
                  <span className="sec-icon">👤</span> Basic Identity & Details
                </div>
                <div className="fields-grid">
                  <FormInput
                    label="Full Name"
                    name="fullName"
                    placeholder="e.g. Pooja Sharma"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                  />
                  <FormSelect
                    label="Gender"
                    name="gender"
                    options={["Male", "Female"]}
                    value={form.gender}
                    onChange={handleChange}
                    required
                  />

                  {/* Strict Legal DOB: cannot pick <18 or >75 */}
                  <FormInput
                    label="Date of Birth"
                    name="dob"
                    type="date"
                    min={minDobDate}
                    max={maxDobDate}
                    value={form.dob}
                    onChange={handleChange}
                    required
                  />

                  <FormSelect
                    label="Marital Status"
                    name="maritalStatus"
                    options={["Never Married", "Divorced", "Widowed", "Awaiting Divorce"]}
                    value={form.maritalStatus}
                    onChange={handleChange}
                  />

                  <FormInput
                    label="Height (in cm)"
                    name="height"
                    type="number"
                    placeholder="e.g. 168"
                    value={form.height}
                    onChange={handleChange}
                  />

                  {/* 📲 Verified Phone Input Field */}
                  <div className="card-input-group phone-group-box">
                    <label htmlFor="phone">
                      Contact Phone <span className="req">*</span>
                    </label>
                    <div className="phone-input-row">
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit Mobile (e.g. 9876543210)"
                        value={form.phone || ""}
                        onChange={handleChange}
                        className={`matrimony-input ${isPhoneVerified ? "input-verified" : ""}`}
                        required
                      />
                      {isPhoneVerified ? (
                        <span className="phone-verified-tag">✓ Verified</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-send-otp"
                          onClick={handleSendOtp}
                          disabled={otpLoading}
                        >
                          {otpLoading ? "Sending..." : "Verify OTP"}
                        </button>
                      )}
                    </div>
                    <small className="field-hint">
                      {isPhoneVerified
                        ? "✓ Mobile number authenticated via secure OTP."
                        : "Fake numbers blocked. Kripya OTP se verify karein."}
                    </small>
                  </div>
                </div>
              </div>

              {/* 2. Religion & Background */}
              <div className="form-section-card">
                <div className="sec-title">
                  <span className="sec-icon">🪔</span> Religion & Astrological
                </div>
                <div className="fields-grid">
                  <FormInput
                    label="Religion"
                    name="religion"
                    placeholder="Hindu, Sikh, Jain, Muslim, Christian, etc."
                    value={form.religion}
                    onChange={handleChange}
                    required
                  />
                  <FormInput
                    label="Caste / Sub-caste"
                    name="caste"
                    placeholder="e.g. Brahmin, Maratha, etc."
                    value={form.caste}
                    onChange={handleChange}
                  />
                  <FormInput
                    label="Mother Tongue"
                    name="motherTongue"
                    placeholder="Hindi, Marathi, Punjabi, Gujarati, etc."
                    value={form.motherTongue}
                    onChange={handleChange}
                  />
                  <FormSelect
                    label="Manglik Status"
                    name="manglik"
                    options={["Don't Know", "Yes", "No", "Anshik Manglik"]}
                    value={form.manglik}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* 3. Education & Career */}
              <div className="form-section-card">
                <div className="sec-title">
                  <span className="sec-icon">🎓</span> Education & Professional Life
                </div>
                <div className="fields-grid">
                  <FormInput
                    label="Highest Qualification"
                    name="education"
                    placeholder="B.Tech, MBA, MBBS, MS, CA, etc."
                    value={form.education}
                    onChange={handleChange}
                    required
                  />
                  <FormInput
                    label="Occupation / Role"
                    name="occupation"
                    placeholder="Software Engineer, Doctor, Banking, Business, etc."
                    value={form.occupation}
                    onChange={handleChange}
                  />
                  <FormInput
                    label="Annual Income"
                    name="annualIncome"
                    placeholder="e.g. 12-15 LPA / $90,000"
                    value={form.annualIncome}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* 4. Location Details */}
              <div className="form-section-card">
                <div className="sec-title">
                  <span className="sec-icon">📍</span> Current Residential Location
                </div>
                <div className="fields-grid">
                  <FormInput
                    label="Current City"
                    name="city"
                    placeholder="Pune, Bengaluru, Mumbai, Delhi, etc."
                    value={form.city}
                    onChange={handleChange}
                    required
                  />
                  <FormInput
                    label="State"
                    name="state"
                    placeholder="Maharashtra, Karnataka, Delhi, etc."
                    value={form.state}
                    onChange={handleChange}
                  />
                  <FormInput
                    label="Country"
                    name="country"
                    placeholder="India"
                    value={form.country}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* 5. Family Details */}
              <div className="form-section-card">
                <div className="sec-title">
                  <span className="sec-icon">👨‍👩‍👧‍👦</span> Family Values & Background
                </div>
                <div className="fields-grid">
                  <FormInput
                    label="Father's Name"
                    name="fatherName"
                    placeholder="Full Name"
                    value={form.fatherName}
                    onChange={handleChange}
                  />
                  <FormInput
                    label="Father's Occupation"
                    name="fatherOccupation"
                    placeholder="Govt Service, Business, Retired, etc."
                    value={form.fatherOccupation}
                    onChange={handleChange}
                  />
                  <FormInput
                    label="Mother's Name"
                    name="motherName"
                    placeholder="Full Name"
                    value={form.motherName}
                    onChange={handleChange}
                  />
                  <FormInput
                    label="Mother's Occupation"
                    name="motherOccupation"
                    placeholder="Homemaker, Teacher, Professor, etc."
                    value={form.motherOccupation}
                    onChange={handleChange}
                  />
                  <FormInput
                    label="Number of Siblings"
                    name="siblings"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.siblings}
                    onChange={handleChange}
                  />
                  <FormSelect
                    label="Family Type"
                    name="familyType"
                    options={["Nuclear", "Joint"]}
                    value={form.familyType}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* 6. Lifestyle Habits */}
              <div className="form-section-card">
                <div className="sec-title">
                  <span className="sec-icon">🥗</span> Diet & Lifestyle Choices
                </div>
                <div className="fields-grid">
                  <FormSelect
                    label="Dietary Habit"
                    name="diet"
                    options={["Vegetarian", "Non-Vegetarian", "Eggetarian", "Vegan", "Jain"]}
                    value={form.diet}
                    onChange={handleChange}
                  />
                  <FormSelect
                    label="Smoking"
                    name="smoking"
                    options={["No", "Yes", "Occasionally"]}
                    value={form.smoking}
                    onChange={handleChange}
                  />
                  <FormSelect
                    label="Drinking"
                    name="drinking"
                    options={["No", "Yes", "Occasionally"]}
                    value={form.drinking}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* 7. About & Preferences */}
              <div className="form-section-card">
                <div className="sec-title">
                  <span className="sec-icon">✨</span> Photo, Bio & Expectations
                </div>
                <div className="fields-full">
                  <div className="card-input-group">
                    <label>Profile Photo Direct URL</label>
                    <input
                      name="photoUrl"
                      type="url"
                      placeholder="https://images.unsplash.com/your-photo.jpg"
                      value={form.photoUrl || ""}
                      onChange={handleChange}
                      className="matrimony-input"
                    />
                    <small className="field-hint">Paste a clear, smiling portrait photo URL for instant preview.</small>
                  </div>

                  <div className="card-input-group">
                    <label>About Me (Short Bio)</label>
                    <textarea
                      name="about"
                      rows={3}
                      placeholder="Share a brief overview of your personality, hobbies and cultural values..."
                      value={form.about || ""}
                      onChange={handleChange}
                      className="matrimony-textarea"
                    />
                  </div>

                  <div className="card-input-group">
                    <label>Partner Expectations</label>
                    <textarea
                      name="partnerPreference"
                      rows={3}
                      placeholder="What qualities or values are you seeking in your prospective life companion?..."
                      value={form.partnerPreference || ""}
                      onChange={handleChange}
                      className="matrimony-textarea"
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions-row">
                <button type="submit" className="btn-register-cta full-btn" disabled={loading}>
                  {loading ? "Publishing Bio-Data..." : "Save & Complete Profile ✦"}
                </button>
                <button type="button" onClick={handleResetDraft} className="btn-clear-draft">
                  Reset Form
                </button>
              </div>
            </form>
          </div>

          {/* ================= RIGHT: LIVE PREVIEW COLUMN ================= */}
          <aside className={`preview-column ${showMobilePreview ? "mobile-show" : ""}`}>
            <div className="sticky-preview-wrap">
              <div className="preview-badge-header">
                <span>✦ Live Featured Card Preview</span>
                <small>This is how prospective families see your profile</small>
              </div>

              <article className="profile-card preview-card">
                <div className="arch-wrap">
                  <div className="arch">
                    <div className="arch-in">
                      <Photo
                        src={form.photoUrl}
                        name={form.fullName || "Your Name"}
                      />
                    </div>
                  </div>

                  <span className="badge-new">New</span>

                  <span className={`role-tag ${form.gender?.toLowerCase() === "male" ? "male" : "female"}`}>
                    {form.gender === "Male" ? "Groom" : "Bride"}
                  </span>
                  
                  {isPhoneVerified && <span className="seal">✓ Verified</span>}
                </div>

                <div className="card-details">
                  <div className="name-row">
                    <h4>{form.fullName || "Your Full Name"}</h4>
                    <span className="age-pill">
                      {calculateAge(form.dob)} yrs
                    </span>
                  </div>

                  <p className="vitals">
                    {form.height ? `${form.height} cm, ` : ""}{form.religion || "Faith"} {form.caste ? `(${form.caste})` : ""}
                  </p>

                  <div className="meta-lines">
                    <div>
                      <span className="meta-icon">🎓</span>
                      <span className="meta-text">{form.education || "Education details"}</span>
                    </div>
                    <div>
                      <span className="meta-icon">💼</span>
                      <span className="meta-text">
                        {form.occupation || "Profession"}, <strong>{form.annualIncome || "Package"}</strong>
                      </span>
                    </div>
                    <div>
                      <span className="meta-icon">📍</span>
                      <span className="meta-text">
                        {form.city || "City"}
                        {form.state ? `, ${form.state}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="card-btns">
                    <button type="button" className="btn-interest" disabled>
                      Connect now
                    </button>
                    <button type="button" className="btn-bio" disabled>
                      View bio
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </aside>
        </main>

        {/* ================= 📲 OTP VERIFICATION MODAL ================= */}
        {showOtpModal && (
          <div className="otp-modal-backdrop" onClick={() => setShowOtpModal(false)}>
            <div className="otp-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <button className="otp-close-btn" onClick={() => setShowOtpModal(false)} aria-label="Close">
                ✕
              </button>

              <div className="otp-modal-head">
                <span className="ganesh">॥ सत्यमेव जयते ॥</span>
                <span className="otp-icon">📱</span>
                <h3>Verify Mobile Number</h3>
                <p>
                  Security OTP sent to: <strong>+91 {form.phone}</strong>
                </p>
              </div>

              {otpSuccess && <div className="otp-success-alert">{otpSuccess}</div>}
              {otpError && <div className="otp-error-alert">{otpError}</div>}

              <form onSubmit={handleVerifyOtp} className="otp-form">
                <div className="otp-input-box">
                  <label htmlFor="otp-input">Enter 6-Digit OTP</label>
                  <input
                    id="otp-input"
                    type="text"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otpValue}
                    onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                    required
                  />
                </div>

                <button type="submit" className="btn-verify-submit" disabled={otpLoading}>
                  {otpLoading ? "Verifying..." : "Verify & Authenticate ✓"}
                </button>
              </form>

              <div className="otp-resend-row">
                {otpTimer > 0 ? (
                  <span>Resend OTP in <strong>{otpTimer}s</strong></span>
                ) : (
                  <button type="button" onClick={handleSendOtp} className="btn-resend-link">
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <footer className="matrimony-footer">
          <p>© {new Date().getFullYear()} PairPerfect Matrimony — Pavitra Rishtey. All Rights Reserved.</p>
        </footer>
      </div>
    </>
  );
}

const createProfileStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Hind:wght@400;500;600;700&family=Yatra+One&display=swap');

  .cp-layout {
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
    color: var(--ivory);
    font-family: var(--body);
    background:
      radial-gradient(circle at 1px 1px, rgba(212, 167, 44, 0.12) 1px, transparent 0) 0 0 / 26px 26px,
      var(--night);
    padding-bottom: 30px;
    box-sizing: border-box;
    overflow-x: hidden;
    position: relative;
    -webkit-tap-highlight-color: transparent;
  }

  .cp-layout *, .cp-layout *::before, .cp-layout *::after { box-sizing: border-box; }
  .cp-layout button, .cp-layout input, .cp-layout select, .cp-layout textarea { 
    font-family: var(--body); 
    touch-action: manipulation;
  }

  /* Background Ambient Effects */
  .cp-bg-layer {
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
    opacity: 0.22;
    animation: drift 16s ease-in-out infinite alternate;
    will-change: transform;
  }
  .b1 {
    width: clamp(300px, 45vw, 550px);
    height: clamp(300px, 45vw, 550px);
    background: var(--gold);
    top: 15%;
    left: -100px;
  }
  .b2 {
    width: clamp(280px, 40vw, 480px);
    height: clamp(280px, 40vw, 480px);
    background: var(--maroon);
    bottom: 10%;
    right: -80px;
    animation-delay: -6s;
  }
  .bg-mandala {
    position: absolute;
    color: var(--gold);
    opacity: 0.12;
    pointer-events: none;
    will-change: transform;
  }
  .m-left {
    width: 600px;
    height: 600px;
    left: -200px;
    top: 25%;
    animation: spinClockwise 110s linear infinite;
  }
  .m-right {
    width: 520px;
    height: 520px;
    right: -180px;
    bottom: 15%;
    animation: spinCounterClockwise 85s linear infinite;
  }
  .cp-petal {
    position: absolute;
    top: -5%;
    border-radius: 0 100% 0 100%;
    opacity: 0;
    animation: petalFall linear infinite;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
    pointer-events: none;
    will-change: transform, opacity;
  }
  .cp-grain {
    position: absolute;
    inset: 0;
    opacity: 0.08;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E");
  }

  .cp-loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    color: var(--gold-2);
  }
  .loading-flower { font-size: 44px; animation: spinClockwise 4s linear infinite; margin-bottom: 12px; }
  .cp-loading-screen p { font-size: 16px; margin: 0; font-weight: 500; }

  /* Navbar */
  .cp-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    height: 62px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(31, 2, 16, 0.88);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--gold-line);
    gap: 12px;
  }

  .brand-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--ivory); flex-shrink: 0; }
  .logo-rings { width: 38px; height: 25px; fill: none; stroke: var(--gold); stroke-width: 1.6; }
  .logo-rings path { fill: var(--gold-2); stroke: none; }
  .brand-text { display: flex; flex-direction: column; line-height: 1; }
  .brand-name { font-family: var(--display); font-size: clamp(20px, 4.5vw, 24px); }
  .brand-name b { font-weight: 400; color: var(--gold-2); }
  .logo-sub { font-size: 10.5px; color: var(--gold); margin-top: 2px; letter-spacing: 0.5px; }

  .nav-actions-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .auto-save-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #4ade80;
    background: rgba(74, 222, 128, 0.12);
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid rgba(74, 222, 128, 0.3);
  }
  .pill-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }

  .btn-skip-dash {
    color: var(--gold-2);
    text-decoration: none;
    font-size: 13.5px;
    font-weight: 600;
    padding: 6px 14px;
    border: 1px solid var(--gold-line);
    border-radius: 999px;
    transition: background 0.2s, color 0.2s;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .btn-skip-dash:hover { background: var(--gold); color: #3a0618; }

  /* Mobile Preview Toggle Button Bar */
  .mobile-preview-toggle-bar {
    display: none;
    position: sticky;
    top: 62px;
    z-index: 90;
    padding: 8px 16px;
    background: rgba(20, 1, 10, 0.95);
    border-bottom: 1px solid var(--gold-line);
  }
  .btn-toggle-preview {
    width: 100%;
    padding: 9px;
    border-radius: 999px;
    background: rgba(212, 167, 44, 0.15);
    border: 1px solid var(--gold);
    color: var(--gold-2);
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-toggle-preview.active {
    background: var(--maroon);
    color: var(--ivory);
    border-color: var(--maroon);
  }

  /* Main Container */
  .cp-container {
    position: relative;
    z-index: 5;
    max-width: 1220px;
    margin: 26px auto 0;
    padding: 0 16px;
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 32px;
    align-items: flex-start;
  }

  .form-column { min-width: 0; }

  .invite-head-banner {
    background: linear-gradient(160deg, var(--maroon), var(--wine));
    border: 2px solid var(--gold);
    border-radius: 20px 20px 10px 10px;
    padding: 24px 20px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    margin-bottom: 20px;
    position: relative;
    overflow: hidden;
  }
  .ganesh { display: block; font-family: var(--display); font-size: 14px; color: var(--gold-2); margin-bottom: 4px; }
  .invite-head-banner h2 { font-family: var(--display); font-weight: 400; font-size: clamp(22px, 3.8vw, 28px); margin: 0 0 6px; color: var(--ivory); }
  .invite-head-banner p { margin: 0; font-size: 13.5px; color: rgba(255, 247, 230, 0.85); line-height: 1.5; }

  .modal-error {
    background: #fde8e8;
    border: 1.5px solid #f8b4b4;
    color: #9b1c1c;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 13.5px;
    margin-bottom: 18px;
    text-align: center;
  }

  .sections-list { display: flex; flex-direction: column; gap: 18px; }

  .form-section-card {
    background: var(--ivory);
    color: var(--ink);
    border: 1.5px solid var(--gold);
    border-radius: 16px;
    padding: 20px 18px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .sec-title {
    font-family: var(--display);
    font-size: 19px;
    color: var(--maroon);
    border-bottom: 1.5px dashed #dcc58f;
    padding-bottom: 7px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sec-icon { font-size: 18px; }

  .fields-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    gap: 14px;
  }
  .fields-full { display: flex; flex-direction: column; gap: 14px; }

  .card-input-group { display: flex; flex-direction: column; gap: 5px; }
  .card-input-group label { font-size: 12.5px; font-weight: 600; color: var(--ink); }
  .req { color: #c81e1e; font-weight: bold; }

  /* 📲 Phone Input Row with OTP Trigger */
  .phone-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .matrimony-input.input-verified {
    border-color: #0f7a55;
    background: #f0fdf4;
  }
  .btn-send-otp {
    background: var(--maroon);
    color: var(--ivory);
    border: 1px solid var(--gold);
    padding: 10px 14px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }
  .btn-send-otp:hover { background: var(--wine); }
  .phone-verified-tag {
    background: #0f7a55;
    color: white;
    font-size: 12px;
    font-weight: 700;
    padding: 10px 14px;
    border-radius: 9px;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(15, 122, 85, 0.3);
  }

  /* 16px Font on Inputs prevents iOS zoom bug */
  .matrimony-input, .matrimony-select, .matrimony-textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid #dcc58f;
    border-radius: 9px;
    background: #fffdf7;
    color: var(--ink);
    font-size: 16px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .matrimony-select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 36px;
    background: #fffdf7 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%237c0a2b' stroke-width='2'/%3E%3C/svg%3E") no-repeat right 14px center / 12px;
    cursor: pointer;
  }
  .matrimony-input:focus, .matrimony-select:focus, .matrimony-textarea:focus {
    border-color: var(--maroon);
    box-shadow: 0 0 0 2px rgba(124, 10, 43, 0.15);
  }
  .matrimony-textarea { resize: vertical; min-height: 70px; line-height: 1.5; }
  .field-hint { font-size: 11.5px; color: var(--ink-soft); margin-top: 2px; }

  .form-actions-row {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 8px;
  }
  .full-btn {
    flex: 1;
    padding: 14px;
    font-size: 15.5px;
    border-radius: 10px;
  }
  .btn-register-cta {
    background: linear-gradient(135deg, var(--gold-2), var(--gold));
    color: #3a0618;
    border: none;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(212, 167, 44, 0.3);
    transition: filter 0.2s, transform 0.15s;
  }
  .btn-register-cta:hover { filter: brightness(1.08); }
  .btn-register-cta:active { transform: scale(0.98); }
  .btn-register-cta:disabled { opacity: 0.65; cursor: wait; }

  .btn-clear-draft {
    background: transparent;
    border: 1px solid rgba(255, 247, 230, 0.3);
    color: rgba(255, 247, 230, 0.7);
    padding: 13px 18px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .btn-clear-draft:hover {
    border-color: #ef4444;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  /* Right Sticky Preview */
  .preview-column { position: sticky; top: 80px; }
  .sticky-preview-wrap { display: flex; flex-direction: column; gap: 12px; }
  .preview-badge-header {
    background: rgba(255, 247, 230, 0.08);
    border: 1px solid var(--gold-line);
    border-radius: 12px;
    padding: 8px 12px;
    text-align: center;
  }
  .preview-badge-header span { display: block; font-weight: 600; color: var(--gold-2); font-size: 13.5px; }
  .preview-badge-header small { color: rgba(255, 247, 230, 0.7); font-size: 11.5px; }

  /* Profile Card in Preview */
  .profile-card {
    background: var(--ivory);
    color: var(--ink);
    border: 1px solid var(--gold);
    outline: 1px solid rgba(212, 167, 44, 0.5);
    outline-offset: -5px;
    border-radius: 16px;
    padding: 14px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
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
    font-size: 56px;
  }
  .role-tag {
    position: absolute;
    left: 8px;
    bottom: -10px;
    padding: 2px 11px;
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
    padding: 2px 10px;
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
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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
  
  .meta-lines { display: grid; gap: 5px; padding-top: 8px; margin-bottom: 12px; border-top: 1px dashed #d9c18a; font-size: 13px; }
  .meta-lines > div { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .meta-icon { flex-shrink: 0; }
  .meta-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .card-btns { display: flex; gap: 6px; }
  .btn-interest, .btn-bio {
    flex: 1;
    background: var(--maroon);
    color: var(--ivory);
    border: 1px solid var(--maroon);
    padding: 8px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: not-allowed;
    opacity: 0.8;
  }
  .btn-bio {
    background: transparent;
    color: var(--maroon);
    border: 1.5px solid var(--gold);
  }

  /* ================= 📲 ROYAL OTP MODAL ================= */
  .otp-modal-backdrop {
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
  .otp-modal-sheet {
    position: relative;
    width: 100%;
    max-width: 380px;
    background: var(--ivory);
    color: var(--ink);
    border: 2px solid var(--gold);
    border-radius: 20px;
    padding: 34px 22px 24px;
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
    animation: pop 0.25s ease both;
  }
  .otp-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--ivory-2);
    color: var(--maroon);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .otp-modal-head { text-align: center; margin-bottom: 14px; }
  .otp-icon { font-size: 26px; display: inline-block; margin-bottom: 2px; }
  .otp-modal-head h3 { font-family: var(--display); font-size: 22px; color: var(--maroon); margin: 2px 0 4px; font-weight: 400; }
  .otp-modal-head p { margin: 0; font-size: 13px; color: var(--ink-soft); }
  .otp-success-alert {
    background: #def7ec;
    border: 1px solid #bcf0da;
    color: #03543f;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 12.5px;
    margin-bottom: 12px;
    text-align: center;
  }
  .otp-error-alert {
    background: #fde8e8;
    border: 1px solid #f8b4b4;
    color: #9b1c1c;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 12.5px;
    margin-bottom: 12px;
    text-align: center;
  }
  .otp-form { display: flex; flex-direction: column; gap: 12px; }
  .otp-input-box { display: flex; flex-direction: column; gap: 6px; text-align: center; }
  .otp-input-box label { font-size: 13px; font-weight: 600; }
  .otp-input-box input {
    text-align: center;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 8px;
    padding: 10px;
    border: 2px solid var(--gold);
    border-radius: 10px;
    background: #fffdf7;
    color: var(--maroon);
    outline: none;
  }
  .btn-verify-submit {
    padding: 12px;
    background: var(--maroon);
    color: var(--ivory);
    border: 1px solid var(--gold);
    border-radius: 9px;
    font-size: 14.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .otp-resend-row {
    margin-top: 14px;
    text-align: center;
    font-size: 12.5px;
    color: var(--ink-soft);
  }
  .btn-resend-link {
    background: none;
    border: none;
    color: var(--maroon);
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
  }

  .matrimony-footer {
    max-width: 1220px;
    margin: 36px auto 0;
    border-top: 1px solid var(--gold-line);
    padding: 16px 20px;
    text-align: center;
    font-size: 12.5px;
    color: rgba(255, 247, 230, 0.6);
  }
  .matrimony-footer p { margin: 0; }

  @keyframes spinClockwise { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes spinCounterClockwise { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
  @keyframes drift { from { transform: translate(0, 0) scale(1); } to { transform: translate(60px, 40px) scale(1.15); } }
  @keyframes petalFall {
    0% { transform: translate3d(0, -6vh, 0) rotate(0deg); opacity: 0; }
    10% { opacity: 0.65; }
    50% { transform: translate3d(36px, 48vh, 0) rotate(190deg); opacity: 0.55; }
    100% { transform: translate3d(-24px, 106vh, 0) rotate(380deg); opacity: 0; }
  }
  @keyframes pop {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }

  /* Responsive Rules */
  @media (max-width: 960px) {
    .cp-container { grid-template-columns: 1fr; gap: 20px; }
    .preview-column { display: none; }
    .preview-column.mobile-show {
      display: block;
      max-width: 320px;
      margin: 0 auto 20px;
      order: -1;
    }
    .mobile-preview-toggle-bar { display: block; }
  }

  @media (max-width: 600px) {
    .cp-nav { padding: 0 14px; }
    .pill-text { display: none; }
    .auto-save-pill { padding: 5px 8px; }
    .btn-skip-dash { padding: 5px 10px; font-size: 12.5px; }
    .dash-arrow { display: none; }
    .form-section-card { padding: 16px 14px; }
    .form-actions-row { flex-direction: column; }
    .btn-clear-draft { width: 100%; text-align: center; }
  }

  @media (max-width: 360px) {
    .brand-name { font-size: 18px; }
    .logo-rings { width: 34px; height: 22px; }
    .invite-head-banner { padding: 18px 12px; }
  }
`;
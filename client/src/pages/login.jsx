import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

/* --- 🌸 Petals Data (Same as Home.jsx) --- */
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
      <g fill="none" stroke="currentColor" strokeWidth="0.75">
        <circle r="196" />
        <circle r="186" strokeDasharray="2 5" />
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

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔑 Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const { saveAuth } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", form);
      saveAuth(data);
      navigate(data.user?.profileCreated ? "/dashboard" : "/create-profile");
    } catch (err) {
      setError(
        err.response?.data?.message || "Invalid email or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotMsg("");
    setForgotError("");
    setForgotLoading(true);

    try {
      const { data } = await api.post("/auth/reset-password", {
        email: forgotEmail,
        newPassword: newPassword,
      });
      setForgotMsg(data.message || "Password changed successfully! You can now log in.");
      setForgotEmail("");
      setNewPassword("");
    } catch (err) {
      setForgotError(
        err.response?.data?.message || "Password reset failed. Please check your email."
      );
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <>
      <style>{loginStyles}</style>
      <div className="login-page">

        {/* ================= BACKGROUND EFFECTS ================= */}
        <div className="login-bg" aria-hidden="true">
          <div className="ambient-blob b1" />
          <div className="ambient-blob b2" />

          <div className="mandala-center-stage">
            <Mandala className="center-mandala m-outer" />
            <Mandala className="center-mandala m-inner" />
          </div>

          {PETALS.map((p, i) => (
            <i
              key={i}
              className="login-petal"
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

          <div className="login-grain" />
        </div>

        {/* ================= NAVBAR ================= */}
        <header className="login-nav">
          <Link to="/" className="brand-logo" aria-label="PairPerfect Matrimony">
            <svg className="logo-rings" viewBox="0 0 44 28" aria-hidden="true">
              <circle cx="15" cy="15" r="10" />
              <circle cx="29" cy="15" r="10" />
              <path d="M22 2 L25 6.5 L22 11 L19 6.5 Z" />
            </svg>
            <span className="brand-text">
              <span className="brand-name">
                Pair<b>Perfect</b>
              </span>
              <small className="logo-sub">Pavitra Rishtey</small>
            </span>
          </Link>
          <Link to="/" className="btn-back-home">
            <span className="back-arrow">←</span> <span className="back-text">Back to Home</span>
          </Link>
        </header>

        {/* ================= LOGIN FORM MODAL ================= */}
        <main className="login-center">
          <div className="sheet login-modal-box">
            <Link to="/" className="close-btn" aria-label="Go to Home">
              ✕
            </Link>

            <div className="modal-title">
              <span className="ganesh">॥ श्री गणेशाय नमः ॥</span>
              <span className="modal-icon">🌸</span>
              <h2>Welcome Back</h2>
              <p>Sign in to your PairPerfect account</p>
            </div>

            {error && <div className="modal-error">{error}</div>}

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="input-box">
                <label htmlFor="login-email">Registered Email</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-box">
                <div className="label-row">
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(true);
                      setForgotMsg("");
                      setForgotError("");
                    }}
                    className="forgot-pwd-btn"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="pwd-input-wrap">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    className="btn-toggle-eye"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-modal-submit"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Log In ✦"}
              </button>
            </form>

            <p className="modal-bottom">
              New to PairPerfect?{" "}
              <Link to="/register">Register free today</Link>
            </p>
          </div>
        </main>

        {/* ================= RESET PASSWORD MODAL ================= */}
        {showForgotModal && (
          <div className="forgot-backdrop" onClick={() => setShowForgotModal(false)}>
            <div className="forgot-box" onClick={(e) => e.stopPropagation()}>
              <button
                className="close-btn"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotMsg("");
                  setForgotError("");
                }}
                aria-label="Close"
              >
                ✕
              </button>
              <div className="modal-title">
                <span className="modal-icon">🔑</span>
                <h2>Reset Password</h2>
                <p>Enter your email and set a new password</p>
              </div>

              {forgotMsg && <div className="modal-info">{forgotMsg}</div>}
              {forgotError && <div className="modal-error">{forgotError}</div>}

              <form onSubmit={handleResetPassword} className="modal-form">
                <div className="input-box">
                  <label htmlFor="forgot-email">Registered Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="yourname@gmail.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="input-box">
                  <label htmlFor="forgot-new-pwd">New Password</label>
                  <div className="pwd-input-wrap">
                    <input
                      id="forgot-new-pwd"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="btn-toggle-eye"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      title={showNewPassword ? "Hide password" : "Show password"}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Updating Password..." : "Update Password ✦"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= FOOTER ================= */}
        <footer className="matrimony-footer">
          <p>© PairPerfect Matrimony — India's Premier Matchmaking Portal. All Rights Reserved.</p>
        </footer>
      </div>
    </>
  );
}

const loginStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Hind:wght@400;500;600;700&family=Yatra+One&display=swap');

  .login-page {
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
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-family: var(--body);
    color: var(--ivory);
    position: relative;
    overflow-x: hidden;
    background:
      radial-gradient(circle at 1px 1px, rgba(212, 167, 44, 0.12) 1px, transparent 0) 0 0 / 26px 26px,
      var(--night);
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }

  .login-page *, .login-page *::before, .login-page *::after {
    box-sizing: border-box;
  }

  .login-page button, .login-page input {
    touch-action: manipulation;
  }

  .login-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .ambient-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(90px);
    opacity: 0.3;
    animation: drift 15s ease-in-out infinite alternate;
    will-change: transform;
  }
  .b1 {
    width: clamp(300px, 45vw, 500px);
    height: clamp(300px, 45vw, 500px);
    background: #ffb703;
    top: 20%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .b2 {
    width: clamp(260px, 40vw, 420px);
    height: clamp(260px, 40vw, 420px);
    background: #a3122f;
    bottom: 10%;
    left: 45%;
    opacity: 0.22;
    animation-delay: -5s;
  }

  .mandala-center-stage {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(920px, 95vw);
    height: min(920px, 95vw);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .center-mandala {
    position: absolute;
    width: 100%;
    height: 100%;
    color: var(--gold);
    transform-origin: center center;
    will-change: transform;
  }

  .m-outer {
    opacity: 0.3;
    animation: spinClockwise 90s linear infinite;
  }

  .m-inner {
    width: 72%;
    height: 72%;
    opacity: 0.2;
    color: var(--gold-2);
    animation: spinCounterClockwise 65s linear infinite;
  }

  .login-petal {
    position: absolute;
    top: -5%;
    border-radius: 0 100% 0 100%;
    opacity: 0;
    animation: petalFall linear infinite;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.3));
    pointer-events: none;
    will-change: transform, opacity;
  }

  .login-grain {
    position: absolute;
    inset: 0;
    opacity: 0.08;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E");
  }

  /* ================= NAVBAR ================= */
  .login-nav {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    background: rgba(31, 2, 16, 0.82);
    border-bottom: 1px solid var(--gold-line);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    gap: 10px;
  }

  .brand-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--ivory);
    flex-shrink: 0;
  }
  .logo-rings {
    width: 40px;
    height: 26px;
    fill: none;
    stroke: var(--gold);
    stroke-width: 1.6;
  }
  .logo-rings path {
    fill: var(--gold-2);
    stroke: none;
  }
  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1;
  }
  .brand-name {
    font-family: var(--display);
    font-size: clamp(20px, 4.5vw, 24px);
  }
  .brand-name b {
    font-weight: 400;
    color: var(--gold-2);
  }
  .logo-sub {
    font-size: 10.5px;
    color: var(--gold);
    margin-top: 2px;
    letter-spacing: 0.5px;
  }

  .btn-back-home {
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
  .btn-back-home:hover {
    background: var(--gold);
    color: #3a0618;
  }

  /* ================= LOGIN CENTER CARD ================= */
  .login-center {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    flex: 1;
  }

  .sheet {
    position: relative;
    width: 100%;
    max-width: 420px;
    background: var(--ivory);
    color: var(--ink);
    border: 2px solid var(--gold);
    border-radius: 50% 50% 22px 22px / 44px 44px 22px 22px;
    box-shadow: 0 0 0 5px rgba(212, 167, 44, 0.25), 0 25px 60px rgba(0, 0, 0, 0.65);
    padding: 40px 24px 26px;
    animation: pop 0.3s ease both;
  }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 50%;
    background: var(--ivory-2);
    color: var(--maroon);
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
  }
  .close-btn:hover {
    background: #ecd7a6;
  }
  .close-btn:active {
    transform: scale(0.92);
  }

  .modal-title {
    text-align: center;
    margin-bottom: 18px;
    padding: 0 10px;
  }
  .ganesh {
    display: block;
    font-family: var(--display);
    font-size: 14px;
    color: var(--maroon);
    margin-bottom: 3px;
    letter-spacing: 0.5px;
  }
  .modal-icon {
    font-size: 24px;
    display: inline-block;
    margin-bottom: 2px;
  }
  .modal-title h2 {
    font-family: var(--display);
    font-weight: 400;
    font-size: clamp(24px, 5vw, 28px);
    margin: 2px 0 4px;
    color: var(--maroon);
  }
  .modal-title p {
    margin: 0;
    font-size: 13.5px;
    color: var(--ink-soft);
  }

  .modal-error {
    background: #fde8e8;
    border: 1px solid #f8b4b4;
    color: #9b1c1c;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 14px;
    text-align: center;
  }
  .modal-info {
    background: #def7ec;
    border: 1px solid #bcf0da;
    color: #03543f;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 14px;
    text-align: center;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .input-box {
    display: flex;
    flex-direction: column;
    gap: 5px;
    text-align: left;
  }
  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }
  .input-box label {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
  }
  .forgot-pwd-btn {
    background: none;
    border: none;
    color: var(--maroon);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    padding: 2px 0;
  }
  .forgot-pwd-btn:hover {
    color: #9b1c1c;
  }

  /* 16px font prevents iOS Safari auto-zoom on input focus */
  .input-box > input {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid #dcc58f;
    border-radius: 9px;
    background: #fffdf7;
    color: var(--ink);
    font-size: 16px;
    outline: none;
    font-family: var(--body);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .input-box > input:focus {
    border-color: var(--maroon);
    box-shadow: 0 0 0 2px rgba(124, 10, 43, 0.15);
  }

  /* 👁️ Password Input & Eye Button */
  .pwd-input-wrap {
    position: relative;
    width: 100%;
  }
  .pwd-input-wrap input {
    width: 100%;
    padding: 10px 44px 10px 12px;
    border: 1.5px solid #dcc58f;
    border-radius: 9px;
    background: #fffdf7;
    color: var(--ink);
    font-size: 16px;
    outline: none;
    font-family: var(--body);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .pwd-input-wrap input:focus {
    border-color: var(--maroon);
    box-shadow: 0 0 0 2px rgba(124, 10, 43, 0.15);
  }

  .btn-toggle-eye {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 18px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.75;
    transition: opacity 0.2s;
  }
  .btn-toggle-eye:hover {
    opacity: 1;
  }

  .btn-modal-submit {
    margin-top: 4px;
    padding: 12px;
    border: 1px solid var(--gold);
    border-radius: 9px;
    background: var(--maroon);
    color: var(--ivory);
    font-size: 15.5px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(124, 10, 43, 0.25);
    transition: background 0.2s, filter 0.2s, transform 0.15s;
  }
  .btn-modal-submit:hover {
    background: var(--wine);
    filter: brightness(1.05);
  }
  .btn-modal-submit:active {
    transform: scale(0.98);
  }
  .btn-modal-submit:disabled {
    opacity: 0.7;
    cursor: wait;
  }

  .modal-bottom {
    text-align: center;
    font-size: 13.5px;
    color: var(--ink-soft);
    margin: 16px 0 0;
  }
  .modal-bottom a {
    color: var(--maroon);
    font-weight: 700;
    text-decoration: underline;
  }

  /* ================= RESET PASSWORD POPUP ================= */
  .forgot-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(15, 1, 8, 0.85);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .forgot-box {
    position: relative;
    width: 100%;
    max-width: 410px;
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    background: var(--ivory);
    color: var(--ink);
    border: 2px solid var(--gold);
    border-radius: 20px;
    padding: 34px 20px 24px;
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
    animation: pop 0.25s ease both;
  }

  /* ================= FOOTER ================= */
  .matrimony-footer {
    position: relative;
    z-index: 10;
    background: #14010a;
    border-top: 1px solid var(--gold-line);
    padding: 14px 16px;
    text-align: center;
    font-size: 12.5px;
    color: rgba(255, 247, 230, 0.65);
  }
  .matrimony-footer p {
    margin: 0;
    line-height: 1.45;
  }

  /* ================= ANIMATIONS ================= */
  @keyframes spinClockwise {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes spinCounterClockwise {
    from { transform: rotate(0deg); }
    to { transform: rotate(-360deg); }
  }

  @keyframes drift {
    from { transform: translate(-50%, -50%) scale(1); }
    to { transform: translate(-45%, -46%) scale(1.2); }
  }

  @keyframes petalFall {
    0% { transform: translate3d(0, -6vh, 0) rotate(0deg); opacity: 0; }
    10% { opacity: 0.65; }
    50% { transform: translate3d(36px, 48vh, 0) rotate(190deg); opacity: 0.55; }
    100% { transform: translate3d(-24px, 106vh, 0) rotate(380deg); opacity: 0; }
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  /* ================= MOBILE MEDIA QUERIES ================= */
  @media (max-width: 480px) {
    .login-nav {
      padding: 10px 14px;
    }
    .btn-back-home {
      padding: 5px 10px;
      font-size: 12.5px;
    }
    .back-text {
      display: none; /* Shows '← Home' cleanly on narrow screens */
    }
    .btn-back-home::after {
      content: "Home";
    }

    .login-center {
      padding: 16px 12px;
    }
    .sheet {
      padding: 34px 18px 22px;
      border-radius: 40px 40px 18px 18px / 46px 46px 18px 18px;
    }
    .close-btn {
      top: 12px;
      right: 12px;
    }
    .modal-title h2 {
      font-size: 23px;
    }
    .modal-bottom {
      font-size: 13px;
    }
  }

  /* Ultra-small screens (320px - 360px) */
  @media (max-width: 360px) {
    .brand-name {
      font-size: 18px;
    }
    .logo-rings {
      width: 34px;
      height: 22px;
    }
    .sheet {
      padding: 32px 14px 20px;
    }
  }
`;
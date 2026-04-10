import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [alert, setAlert] = useState<{ msg: string; isError: boolean } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("pharmaflow_user")) {
      navigate("/dashboard");
    }

    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { token, user } = event.data;
        localStorage.setItem("pharmaflow_token", token);
        localStorage.setItem("pharmaflow_user", JSON.stringify(user));
        navigate("/dashboard");
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  const showAlert = (msg: string, isError = true) => {
    setAlert({ msg, isError });
  };

  const hideAlert = () => {
    setAlert(null);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showAlert("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      showAlert("Password must be at least 6 characters.");
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      localStorage.setItem("pharmaflow_token", data.token);
      localStorage.setItem("pharmaflow_user", JSON.stringify(data.user));
      showAlert("Signup successful!", false);
      
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    } catch (err: any) {
      showAlert(err.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem("pharmaflow_token", data.token);
      localStorage.setItem("pharmaflow_user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err: any) {
      showAlert(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      const { url } = await response.json();
      
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        url,
        'google_login',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err) {
      showAlert("Failed to initiate Google login");
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container">
        <div className="auth-card glass-panel">
          <div className="auth-header">
            <h2>PharmaFlow</h2>
            <p>Smart Medicine Inventory</p>
          </div>
          
          {alert && (
            <div className={`alert ${alert.isError ? 'error' : 'success'}`}>
              {alert.msg}
            </div>
          )}

          {isLogin ? (
            <form id="login-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  placeholder="Enter your email" 
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  placeholder="Enter password" 
                />
              </div>
              <button type="submit" className="btn-primary auth-btn">Login</button>
              
              <div style={{ margin: '20px 0', textAlign: 'center', position: 'relative' }}>
                <hr style={{ border: '0', borderTop: '1px solid #ddd' }} />
                <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '0 10px', fontSize: '12px', color: '#999' }}>OR</span>
              </div>

              <button type="button" onClick={handleGoogleLogin} className="btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
                Login with Google
              </button>

              <p className="auth-toggle">
                Don't have an account? <span onClick={() => { setIsLogin(false); hideAlert(); }}>Sign up</span>
              </p>
            </form>
          ) : (
            <form id="signup-form" onSubmit={handleSignup}>
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  placeholder="John Doe" 
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  placeholder="Enter your email" 
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  placeholder="Create password" 
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                  placeholder="Confirm password" 
                />
              </div>
              <button type="submit" className="btn-primary auth-btn">Sign Up</button>
              
              <div style={{ margin: '20px 0', textAlign: 'center', position: 'relative' }}>
                <hr style={{ border: '0', borderTop: '1px solid #ddd' }} />
                <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '0 10px', fontSize: '12px', color: '#999' }}>OR</span>
              </div>

              <button type="button" onClick={handleGoogleLogin} className="btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
                Signup with Google
              </button>

              <p className="auth-toggle">
                Already have an account? <span onClick={() => { setIsLogin(true); hideAlert(); }}>Login</span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

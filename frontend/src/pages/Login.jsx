import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [recoveryModal, setRecoveryModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [showForgotMsg, setShowForgotMsg] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/is-empty').then(res => {
      if (res.isEmpty) navigate('/initialize');
    }).catch(() => {});
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      localStorage.setItem('swiss_side_session', data.token);
      localStorage.setItem('swiss_side_user', data.user.email);
      localStorage.setItem('swiss_side_role', data.user.role);
      localStorage.setItem('swiss_side_display_name', data.user.display_name);
      toast.success('Signed in successfully');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!recoveryEmail) return toast.error('Please enter your email.');
    setLoading(true);
    setRecoveryError('');
    try {
      const res = await api.post('/auth/request-reset', { email: recoveryEmail });
      if (res.success) {
        toast.success(res.message);
        setRecoverySuccess(true);
      }
    } catch (err) {
      setRecoveryError(err.error || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  const closeRecoveryModal = () => {
    setRecoveryModal(false);
    setRecoverySuccess(false);
    setRecoveryEmail('');
    setRecoveryError('');
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-0 md:p-6 animate-in fade-in duration-700">
      <div className="w-full max-w-full md:max-w-[420px] min-h-screen md:min-h-0 bg-white md:rounded-2xl shadow-2xl overflow-hidden border-none md:border border-[#F3F4F6] flex flex-col">
        <div className="bg-[#A0604E] p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <img src="/logo.png" alt="" className="w-40 h-40 grayscale brightness-0 invert" />
          </div>
          <img src="/logo.png" alt="Swiss Side" className="w-20 h-20 object-contain mx-auto mb-6 bg-white p-3 rounded-2xl shadow-xl relative z-10" />
          <h1 className="text-2xl font-black tracking-[0.2em] text-white uppercase relative z-10">Swiss Side</h1>
          <div className="h-[2px] w-12 bg-[#A0604E] mx-auto mt-4 rounded-full relative z-10"></div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <form onSubmit={handleLogin} className="p-8 md:p-10 space-y-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-[0.15em] text-[#9CA3AF]">Account Access</label>
              <div className="relative">
                <input 
                  type="email" 
                  className="input-field pl-11" 
                  placeholder="name@swissside.store"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              </div>
            </div>

            <div className="space-y-1.5 relative">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-black uppercase tracking-[0.15em] text-[#9CA3AF]">Security Key</label>
                <button 
                  type="button"
                  onClick={() => {
                    setRecoveryEmail(email);
                    setShowForgotMsg(false);
                    setRecoveryModal(true);
                  }}
                  className="text-[10px] font-black text-[#A0604E] uppercase tracking-widest hover:underline"
                >
                  Lost access?
                </button>
              </div>
              <div className="relative">
                <input 
                  type={showPass ? "text" : "password"} 
                  className="input-field pl-11 pr-11" 
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                <button 
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#A0604E] p-1"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-3 mt-4 h-[52px]"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <span className="uppercase">Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="bg-[#F9FAFB]/50 border-t border-[#F3F4F6] py-6 text-center">
            <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-[0.4em]">Internal Operations Only</p>
          </div>
        </div>
      </div>

      <Modal isOpen={recoveryModal} onClose={closeRecoveryModal} title="Account Recovery">
        {recoverySuccess ? (
          <div className="p-6 text-center space-y-6">
            <div className="w-16 h-16 bg-[#EAF3DE] text-[#3B6D11] rounded-full flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-[#1A1A1A] uppercase tracking-tight">Security Link Sent</h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                We have successfully dispatched a unique authentication link to <strong>{recoveryEmail}</strong>. 
                Please open your inbox and click the security link to safely reset your credentials.
              </p>
            </div>
            <button 
              onClick={closeRecoveryModal}
              className="btn-primary w-full h-[52px] uppercase tracking-wider font-black"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="p-4 space-y-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-[0.15em] text-[#9CA3AF]">Registered Email</label>
              <div className="relative">
                <input 
                  type="email" 
                  className={`input-field pl-11 ${recoveryError ? 'border-red-500 focus:ring-red-500/10' : ''}`} 
                  placeholder="name@swissside.store"
                  value={recoveryEmail}
                  onChange={(e) => {
                    setRecoveryEmail(e.target.value);
                    setRecoveryError('');
                  }}
                  required
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              </div>
              {recoveryError && (
                <p className="text-[11px] font-bold text-red-500 mt-2 pl-1">
                   {recoveryError}
                </p>
              )}
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary w-full h-[52px] flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <span className="uppercase">Request Access</span>}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}


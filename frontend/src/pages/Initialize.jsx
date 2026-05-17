import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

export default function Initialize() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/is-empty')
      .then(res => {
        if (!res.isEmpty) navigate('/login');
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [navigate]);

  const handleInit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (password.length < 8) {
      return toast.error('Password must be at least 8 characters');
    }
    
    setLoading(true);
    try {
      await api.post('/auth/initialize', { 
        firstName, 
        lastName, 
        email, 
        password 
      });
      toast.success('Administrator account created');
      navigate('/login');
    } catch (err) {
      toast.error(err.error || 'Initialization failed');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[540px] bg-white rounded-xl shadow-xl border border-[#E5E7EB] overflow-hidden">
        <div className="bg-[#1A1A2E] p-8 text-white text-center">
          <div className="w-16 h-16 bg-[#A0604E] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">System Setup</h1>
          <p className="text-white/60 text-[13px] font-medium uppercase tracking-[0.2em] mt-1">V14 Production Environment</p>
        </div>

        <form onSubmit={handleInit} className="p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">First Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Last Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Email Address</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="admin@swissside.store"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Password</label>
              <div className="relative">
                <input 
                  type={showPass ? "text" : "password"} 
                  className="input-field pr-10" 
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button 
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#A0604E]"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-[#9CA3AF] font-bold uppercase mt-1">Min. 8 characters</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Confirm</label>
              <input 
                type={showPass ? "text" : "password"} 
                className="input-field" 
                placeholder="********"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-[10px] text-[#A0604E] font-bold uppercase mt-1">Passwords mismatch</p>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-6 h-12 text-base"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Initialize System'}
          </button>
        </form>
      </div>
    </div>
  );
}

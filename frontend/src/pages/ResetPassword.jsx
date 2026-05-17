import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Mail, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [step, setStep] = useState(1); // 1: Request, 2: Confirmation
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
      setIsAdminMode(true);
      setStep(2); // Link has already been sent, show check inbox screen directly
    }
  }, [location.state]);

  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/request-reset', { email });
      setStep(2);
      toast.success('Magic link dispatched');
    } catch (err) {
      toast.error(err.response?.data?.error || 'System failed to dispatch link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[500px] animate-in fade-in zoom-in duration-500">
        {/* BRANDING HEADER */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#A0604E] rounded-[24px] shadow-2xl mb-6 border border-white/20 transition-transform hover:scale-105 duration-300">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tighter uppercase">Swiss Side Security</h1>
          <p className="text-[10px] font-black tracking-[0.5em] text-[#A0604E] mt-2 uppercase opacity-60">Authentication Protocol</p>
        </div>

        <div className="bg-white rounded-[40px] shadow-2xl border border-[#E5E7EB] p-10 md:p-14 relative overflow-hidden">
          {!isAdminMode ? (
            <div className="space-y-8 text-center animate-in fade-in duration-300">
              <div className="bg-amber-50 p-8 rounded-3xl border border-amber-100">
                <p className="text-[15px] font-bold text-amber-800 leading-relaxed uppercase tracking-tight">
                  Staff credentials can only be reset by a System Administrator.
                </p>
              </div>
              
              <button 
                onClick={() => navigate('/')} 
                className="btn-primary w-full h-16 flex items-center justify-center gap-3 shadow-xl shadow-[#A0604E]/20 text-base"
              >
                <ArrowLeft size={20} /> <span className="font-black uppercase tracking-[0.2em]">Return to Login</span>
              </button>

              <button 
                onClick={() => setIsAdminMode(true)}
                className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.3em] hover:text-[#A0604E] transition-all pt-4"
              >
                System Administrator?
              </button>
            </div>
          ) : (
            <div className="animate-in slide-in-from-bottom-6 duration-500">
              {step === 1 ? (
                <div className="space-y-10">
                  <div className="text-center">
                    <h2 className="text-xl font-black text-[#1A1A1A] uppercase tracking-tight">Admin Recovery</h2>
                    <p className="text-[14px] text-[#6B7280] mt-3 font-medium">Verify your email to receive an access token.</p>
                  </div>

                  <form onSubmit={handleRequest} className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-[0.3em] text-[#9CA3AF] block ml-1">Secure Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={20} />
                        <input 
                          type="email" 
                          className="input-field pl-14 h-16 bg-[#F9FAFB] border-2 focus:border-[#A0604E] transition-all text-lg font-bold" 
                          placeholder="admin@swissside.store"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required 
                          autoFocus
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={loading} className="btn-primary w-full h-16 flex items-center justify-center gap-4 text-base">
                      {loading ? <Loader2 className="animate-spin" size={24} /> : (
                        <span className="font-black uppercase tracking-[0.2em]">Request Access Link</span>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="text-center py-6 animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 text-emerald-600 transition-transform hover:rotate-12">
                    <Mail size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-tight mb-4">
                    Check Your Inbox
                  </h3>
                  <p className="text-[16px] text-[#6B7280] leading-relaxed mb-10 font-medium">
                    A secure authentication link has been dispatched to <br/>
                    <strong className="text-[#1A1A1A] block mt-2 text-lg tracking-tight">{email}</strong>
                  </p>
                  
                  <div className="p-6 bg-[#F9FAFB] rounded-[24px] mb-10 border border-[#F3F4F6]">
                    <p className="text-[12px] text-[#9CA3AF] font-bold uppercase tracking-widest leading-relaxed">
                      Link expires in 30 minutes. <br/>Check spam if it doesn't arrive.
                    </p>
                  </div>

                  <button
                    onClick={() => { setStep(1); setEmail(''); }}
                    className="text-[11px] font-black text-[#A0604E] uppercase tracking-[0.3em] hover:opacity-70 transition-all border-b-2 border-[#A0604E] pb-1"
                  >
                    Use Different Email
                  </button>
                </div>
              )}

              <div className="mt-10 pt-10 border-t border-[#F3F4F6] text-center">
                <button 
                  onClick={() => setIsAdminMode(false)}
                  className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-[0.3em] hover:text-[#A0604E] transition-all"
                >
                  Cancel Recovery
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-14 text-center text-[10px] font-black text-[#D1D5DB] uppercase tracking-[0.6em]">
          V18 Secure Infrastructure
        </p>
      </div>
    </div>
  );
}

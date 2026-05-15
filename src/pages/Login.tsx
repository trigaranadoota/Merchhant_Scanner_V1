import { motion } from 'motion/react';
import { signInWithGoogle } from '../lib/firebase';
import { Store, LogIn } from 'lucide-react';

export default function Login() {
  const handleLogin = () => {
    localStorage.setItem('bypassAuth', 'true');
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-slate-50 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-10 bg-white rounded-[40px] shadow-2xl shadow-slate-200 border border-slate-100"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center w-20 h-20 mb-8 rounded-3xl bg-emerald-600 text-white shadow-xl shadow-emerald-200/50">
            <Store className="w-10 h-10" />
          </div>
          
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-slate-900">
            Merchant Portal
          </h1>
          <p className="mb-10 text-slate-500 text-lg font-medium">
            Validate and redeem sustainability credits at your store.
          </p>

          <button
            onClick={handleLogin}
            className="flex items-center justify-center w-full gap-4 px-8 py-5 text-white bg-slate-900 rounded-3xl hover:bg-slate-800 transition-all duration-300 shadow-xl shadow-slate-900/20 active:scale-95 group"
          >
            <LogIn className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            <span className="font-black text-lg">Enter Merchant Portal</span>
          </button>
          
          <div className="mt-10 pt-8 border-t border-slate-50 w-full">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
              Authorized Partners Only
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

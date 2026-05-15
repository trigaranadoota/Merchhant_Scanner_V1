import React, { useState, useEffect } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { 
  Search, Check, AlertCircle, Loader2, LogOut, 
  Store, CreditCard, History, ArrowRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ShopData {
  id: string;
  name: string;
  totalDiscountsCount: number;
  totalDiscountsValue: number;
}

interface LogEntry {
  id: string;
  couponCode: string;
  userUsnMasked: string;
  discountPercentage: number;
  timestamp: any;
}

interface ValidationResult {
  code: string;
  discountPercentage: number;
  maskedUsn: string;
}

export default function Dashboard({ user }: { user: User }) {
  const [shop, setShop] = useState<ShopData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [couponCode, setCouponCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [redeeming, setRedeeming] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const idToken = await user.getIdToken();
      const meRes = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      
      if (meRes.status === 403) {
        setIsUnauthorized(true);
        setLoading(false);
        return;
      }
      
      const shopData = await meRes.json();
      setShop(shopData);

      const logsRes = await fetch('/api/logs', {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      setLogs(await logsRes.json());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode) return;
    
    setValidating(true);
    setValidationError(null);
    setValidationResult(null);
    setSuccessMessage(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/validate-code', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}` 
        },
        body: JSON.stringify({ code: couponCode })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || 'Invalid code');
      } else {
        setValidationResult(data);
      }
    } catch (error) {
      setValidationError('Failed to validate. Try again.');
    } finally {
      setValidating(false);
    }
  };

  const handleRedeem = async () => {
    if (!validationResult) return;
    
    setRedeeming(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/redeem-code', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}` 
        },
        body: JSON.stringify({ code: validationResult.code })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || 'Redemption failed');
      } else {
        setSuccessMessage(`Success! Apply ${validationResult.discountPercentage}% discount.`);
        setValidationResult(null);
        setCouponCode('');
        fetchData(); // Refresh stats and logs
      }
    } catch (error) {
      setValidationError('Redemption failed. Try again.');
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-slate-50">
        <div className="p-4 mb-6 rounded-full bg-red-50 text-red-500 shadow-sm">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-slate-900 tracking-tight">Access Denied</h1>
        <p className="text-slate-500 mb-8 max-w-sm">
          Your account ({user.email}) is not authorized to access the shop partner portal.
        </p>
        <button 
          onClick={() => signOut(auth)}
          className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-all font-medium shadow-lg shadow-slate-900/20"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-72 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200/50">
              <Store className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Shop<span className="text-emerald-600">Portal</span></h1>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <div className="px-5 py-4 bg-slate-100 rounded-xl font-bold text-slate-900 flex items-center justify-between group cursor-pointer">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Redemption
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
          <div className="px-5 py-4 text-slate-500 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors flex items-center gap-3">
            <History className="w-5 h-5" />
            History
          </div>
        </nav>

        <div className="p-6 border-t border-slate-100">
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl shadow-slate-900/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold shadow-inner">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">{shop?.name}</p>
                <p className="text-[10px] text-slate-400 truncate tracking-wide">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="w-full py-2.5 bg-slate-800 rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Merchant Terminal</h2>
              <p className="text-slate-500 text-lg">Validate and process sustainability credits.</p>
            </div>
            <div className="text-right hidden md:block">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1 block">Live System Status</span>
              <div className="flex items-center gap-2 text-emerald-600 font-bold justify-end">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Transaction Node
              </div>
            </div>
          </header>

          <div className="grid grid-cols-12 gap-6">
            {/* Main Validator Section - Bento Large */}
            <section className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-[var(--radius-bento)] shadow-sm p-8 flex flex-col min-h-[400px]">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-8">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <CreditCard className="w-5 h-5 text-slate-600" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Apply Redemption Code</h3>
                </div>

                <form onSubmit={handleValidate} className="relative mb-8">
                  <input 
                    type="text" 
                    placeholder="Enter code (e.g. SAVE25)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl text-2xl font-mono focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-300"
                  />
                  <button 
                    type="submit"
                    disabled={validating || !couponCode}
                    className="absolute right-3 top-3 bottom-3 px-8 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:bg-slate-200 disabled:shadow-none flex items-center gap-2"
                  >
                    {validating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Check
                  </button>
                </form>

                <AnimatePresence mode="wait">
                  {validationError && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center gap-3 font-medium text-sm"
                    >
                      <AlertCircle className="w-5 h-5" />
                      {validationError}
                    </motion.div>
                  )}

                  {successMessage && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-emerald-50 border-2 border-dashed border-emerald-200 rounded-3xl p-10 flex flex-col items-center text-center gap-4"
                    >
                      <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <Check className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Redemption Recorded</h3>
                        <p className="text-emerald-700 font-medium">{successMessage}</p>
                      </div>
                    </motion.div>
                  )}

                  {validationResult && (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-8 bg-emerald-50 border border-emerald-100 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8"
                    >
                      <div className="flex items-center gap-8">
                        <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center border-4 border-emerald-500 shadow-xl shadow-emerald-500/10 shrink-0">
                          <span className="text-[10px] uppercase font-black text-emerald-500 tracking-tighter -mb-1">Discount</span>
                          <span className="text-3xl font-black text-slate-900 leading-none">{validationResult.discountPercentage}%</span>
                        </div>
                        <div className="text-center md:text-left">
                          <p className="text-sm text-emerald-800 font-black uppercase tracking-[0.2em] mb-1">Redeemable Offer</p>
                          <h4 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1 italic">Sustainability Reward</h4>
                          <p className="text-sm text-slate-500 font-bold">User USN: <span className="font-mono text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded">{validationResult.maskedUsn}</span></p>
                        </div>
                      </div>
                      <button 
                        onClick={handleRedeem}
                        disabled={redeeming}
                        className="w-full md:w-auto px-12 py-5 bg-slate-900 text-white rounded-2xl font-black shadow-2xl shadow-slate-900/30 hover:scale-105 active:scale-95 transition-all text-lg flex items-center justify-center gap-3"
                      >
                        {redeeming ? <Loader2 className="w-6 h-6 animate-spin" /> : "Apply Discount"}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* Quick Stats Grid - Right Column */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <section className="bg-white border border-slate-200 rounded-[var(--radius-bento)] p-8 flex items-center gap-6 shadow-sm group hover:border-emerald-200 transition-colors">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Check className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Redeemed</p>
                  <p className="text-4xl font-black tracking-tighter text-slate-900">{shop?.totalDiscountsCount || 0}</p>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-[var(--radius-bento)] p-8 flex items-center gap-6 shadow-sm group hover:border-blue-200 transition-colors">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <CreditCard className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Value Distributed</p>
                  <p className="text-4xl font-black tracking-tighter text-slate-900">{shop?.totalDiscountsValue || 0}%</p>
                </div>
              </section>

              <section className="bg-emerald-900 text-white rounded-[var(--radius-bento)] p-8 flex items-center justify-between shadow-xl shadow-emerald-900/20 relative overflow-hidden group">
                <div className="relative z-10">
                  <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">Merchant Level</p>
                  <p className="text-2xl font-black tracking-tight italic">Verified Partner</p>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase text-emerald-400">Sync Active</span>
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-6 opacity-10 group-hover:opacity-20 group-hover:-rotate-12 transition-all duration-500">
                  <Store className="w-32 h-32" />
                </div>
              </section>
            </div>

            {/* History Log Table - Bottom Bento */}
            <section className="col-span-12 bg-white border border-slate-200 rounded-[var(--radius-bento)] shadow-sm overflow-hidden flex flex-col">
              <div className="px-10 py-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-black text-xl tracking-tight text-slate-900 flex items-center gap-3">
                  <History className="w-6 h-6 text-slate-400" /> 
                  Recent Redemptions
                </h3>
                <span className="bg-white border border-slate-200 px-4 py-1.5 rounded-full text-[10px] font-black uppercase text-slate-500 tracking-widest shadow-sm">
                  Last 50 Logs
                </span>
              </div>
              <div className="overflow-x-auto">
                {logs.length > 0 ? (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] bg-slate-50/30">
                        <th className="px-10 py-5">Code ID</th>
                        <th className="px-10 py-5">Customer USN</th>
                        <th className="px-10 py-5">Discount</th>
                        <th className="px-10 py-5 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                          <td className="px-10 py-4 font-mono font-bold text-slate-900">{log.couponCode}</td>
                          <td className="px-10 py-4 text-slate-500 font-medium">{log.userUsnMasked}</td>
                          <td className="px-10 py-4">
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-xs font-black">
                              {log.discountPercentage}%
                            </span>
                          </td>
                          <td className="px-10 py-4 text-right text-slate-400 text-xs font-bold tabular-nums">
                            {log.timestamp?.seconds 
                              ? new Date(log.timestamp.seconds * 1000).toLocaleString(undefined, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : 'Initializing...'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                    <History className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-bold text-lg">No redemption traffic detected</p>
                    <p className="text-sm font-medium">Wait for customers to show their codes</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

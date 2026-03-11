import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc } from 'firebase/firestore';
import { 
  MessageSquare, Send, Bot, User, Zap, ArrowRight, Loader2, CheckCircle2, Shield, AlertTriangle, PhoneCall
} from 'lucide-react';

// --- ИНИЦИАЛИЗАЦИЯ AEGIS CRM ---
const myRealFirebaseConfig = {
  apiKey: "AIzaSyDCsU0EgUUByrAK_CG3UdIxQ7DTwhRkhvc",
  authDomain: "aegis-crm-26ca9.firebaseapp.com",
  projectId: "aegis-crm-26ca9",
  storageBucket: "aegis-crm-26ca9.firebasestorage.app",
  messagingSenderId: "438781854337",
  appId: "1:438781854337:web:32dc926ebe06f15eab0380"
};

const app = initializeApp(myRealFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID приложения всегда жестко зафиксирован для Vercel
const appId = 'aegis-leads-app';

const safeText = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val.seconds) return new Date(val.seconds * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (val instanceof Date) return val.toLocaleTimeString('ru-RU');
  }
  return fallback;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [accessError, setAccessError] = useState(null);
  
  const [leads, setLeads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const scrollRef = useRef(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) { 
        console.error("Auth Error:", e);
        setAccessError("Ошибка авторизации Firebase. Проверьте включен ли Anonymous Auth.");
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !user || !authReady) return;

    try {
      const lRef = collection(db, 'artifacts', appId, 'public', 'data', 'leads');
      const mRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');

      const unsubL = onSnapshot(lRef, (s) => {
        setLeads(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
        setAccessError(null);
      }, (e) => {
        console.error("Leads Access Denied:", e);
        setAccessError("База данных недоступна. Права доступа отклонены.");
      });

      const unsubM = onSnapshot(mRef, (s) => {
        setMessages(s.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (e) => console.error("Messages Access Denied:", e));

      return () => { unsubL(); unsubM(); };
    } catch (err) {
      console.error("Firestore Init Error:", err);
    }
  }, [user, authReady]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, selectedId]);

  const activeMessages = messages
    .filter(m => String(m.chatId) === String(selectedId))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const activeLead = leads.find(l => l.id === selectedId);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedId || isSending || !user) return;
    setIsSending(true);
    const text = input; setInput('');
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', selectedId), {
        status: 'operator_active', updatedAt: Date.now()
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
        chatId: String(selectedId), sender: 'operator', text: text, timestamp: Date.now()
      });
    } catch (err) { console.error("Send failed:", err); } 
    finally { setIsSending(false); }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-left font-sans">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-b-8 border-blue-600">
           <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center mb-8 shadow-xl shadow-blue-500/30">
              <Bot size={40} className="text-white" />
           </div>
           <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none text-center">Aegis CRM</h1>
           <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-3 mb-10 text-center text-left">Production Build</p>
           
           {accessError && (
             <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-left">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-600 font-bold leading-tight uppercase">{accessError}</p>
             </div>
           )}

           <button 
             onClick={() => setIsAuthenticated(true)}
             disabled={!authReady}
             className="w-full bg-[#1e293b] text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
           >
             {authReady ? 'Открыть систему' : 'Установка защищенного соединения...'} <ArrowRight size={18}/>
           </button>
        </div>

        <div className="mt-8 opacity-50 flex items-center gap-2">
           <Shield size={14} className="text-slate-400"/>
           <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Система готова к работе (Vercel Edition)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 text-left overflow-hidden">
      <aside className="w-80 border-r border-slate-200 flex flex-col shrink-0 bg-white shadow-xl z-20">
        <header className="h-20 flex items-center px-6 border-b shrink-0 gap-3 bg-white">
           <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20">
             <MessageSquare size={18}/>
           </div>
           <h2 className="font-black text-xs uppercase tracking-widest text-slate-800">Активные чаты</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-white">
           {leads.map(l => (
             <button 
               key={l.id} 
               onClick={() => setSelectedId(l.id)}
               className={`w-full p-5 rounded-[1.8rem] text-left transition-all border-2 ${
                 selectedId === l.id 
                 ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-600/20' 
                 : 'bg-white border-slate-50 hover:border-slate-100 hover:bg-slate-50'
               }`}
             >
                <div className="flex justify-between items-start mb-2 text-left">
                   <p className="font-black text-xs uppercase truncate pr-4">{safeText(l.name || 'Лид ' + l.id.slice(-4))}</p>
                   <div className={`w-2 h-2 rounded-full mt-1 ${l.status === 'operator_active' ? 'bg-green-400 border border-white' : 'bg-amber-400 animate-pulse'}`}></div>
                </div>
                {l.summary ? (
                  <p className={`text-[11px] leading-relaxed line-clamp-2 italic mb-3 opacity-80 text-left ${selectedId === l.id ? 'text-blue-100' : 'text-slate-500'}`}>
                    "{safeText(l.summary)}"
                  </p>
                ) : null}
                <div className={`text-[9px] font-black flex justify-between uppercase tracking-widest ${selectedId === l.id ? 'text-blue-200' : 'text-slate-400'}`}>
                   <span className="flex items-center gap-1 text-left">@{safeText(l.username)}</span>
                   <span className="text-right">{safeText(l.updatedAt)}</span>
                </div>
             </button>
           ))}
           {leads.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center gap-4">
                 <Bot size={48} className="text-slate-200" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 text-center">Ожидание клиентов...</p>
              </div>
           ) : null}
        </div>
        <footer className="p-5 border-t bg-slate-50 text-[8px] font-black text-slate-400 text-center uppercase tracking-[0.2em] break-all">
           CRM ID: {appId}
        </footer>
      </aside>

      <main className="flex-1 flex flex-col bg-slate-100 overflow-hidden text-left">
         {selectedId ? (
           <>
             <header className="h-20 border-b flex items-center justify-between px-10 shrink-0 z-10 bg-white shadow-sm">
                <div className="text-left">
                   <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none text-left">{safeText(activeLead?.name)}</h2>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2 flex items-center gap-2 text-left">
                      <Zap size={10} className="text-amber-500" fill="currentColor"/> Лид из Telegram • ID {selectedId}
                   </p>
                </div>
                <div className="flex gap-3">
                   {activeLead?.phone ? (
                     <button onClick={() => window.open(`tel:${activeLead.phone}`)} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                       <PhoneCall size={18}/>
                     </button>
                   ) : null}
                   <button className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-slate-900/10">
                     Архивировать
                   </button>
                </div>
             </header>

             <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                {activeMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                     <div className={`max-w-[70%] p-6 rounded-[2.5rem] shadow-sm text-left ${
                       m.sender === 'user' 
                       ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-none' 
                       : m.sender === 'ai'
                         ? 'bg-blue-50 border border-blue-100 text-blue-800 rounded-br-none italic'
                         : 'bg-[#1e293b] text-white rounded-br-none shadow-xl shadow-slate-900/10'
                     }`}>
                        <div className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-40 text-left flex items-center gap-2">
                           {m.sender === 'user' ? <User size={10}/> : <Bot size={10}/>}
                           {m.sender === 'user' ? 'Клиент' : m.sender === 'operator' ? 'Оператор (Вы)' : 'Бот (AI)'}
                        </div>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium text-left">{safeText(m.text)}</p>
                        <div className="text-[8px] mt-3 font-black opacity-30 text-right uppercase tracking-widest">
                           {safeText(m.timestamp)}
                        </div>
                     </div>
                  </div>
                ))}
                <div ref={scrollRef} />
             </div>

             <div className="p-8 bg-white border-t-2 border-slate-100 z-10">
               <form onSubmit={sendMessage} className="flex gap-4 max-w-5xl mx-auto">
                  <div className="flex-1 relative">
                    <input 
                      value={input} 
                      onChange={e => setInput(e.target.value)}
                      className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500/30 focus:bg-white transition-all font-bold text-sm"
                      placeholder="Введите ответ клиенту..."
                    />
                  </div>
                  <button 
                    disabled={isSending || !input.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/30 transition-all active:scale-90 disabled:opacity-30 disabled:grayscale"
                  >
                     <Send size={24}/>
                  </button>
               </form>
             </div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-200 gap-8 grayscale opacity-20">
              <Bot size={150} strokeWidth={1} className="animate-pulse" />
              <div className="text-center">
                 <h2 className="text-3xl font-black uppercase tracking-[0.2em] leading-none text-center">Центр управления</h2>
                 <p className="text-xs font-bold mt-4 tracking-widest text-center uppercase">ВЫБЕРИТЕ ДИАЛОГ ДЛЯ НАЧАЛА РАБОТЫ</p>
              </div>
           </div>
         )}
      </main>
    </div>
  );
}
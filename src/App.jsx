import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, setDoc } from 'firebase/firestore';
import { 
  MessageSquare, Send, Bot, User, Zap, ArrowRight, 
  CheckCircle2, AlertTriangle, Phone, Calendar, Clock, FileText, Info, PhoneCall, Copy, Mic, Lock,
  Loader2, Database
} from 'lucide-react';

// --- ИНИЦИАЛИЗАЦИЯ FIREBASE (ВАШИ ОРИГИНАЛЬНЫЕ КЛЮЧИ) ---
const firebaseConfig = {
  apiKey: "AIzaSyDCsU0EgUUByrAK_CG3UdIxQ7DTwhRkhvc",
  authDomain: "aegis-crm-26ca9.firebaseapp.com",
  projectId: "aegis-crm-26ca9",
  storageBucket: "aegis-crm-26ca9.firebasestorage.app",
  messagingSenderId: "438781854337",
  appId: "1:438781854337:web:32dc926ebe06f15eab0380"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = 'aegis-leads-app';

// --- НАСТРОЙКА БЕЗОПАСНОСТИ ---
const SECRET_PIN = '7777';

const safeText = (val, fallback = '') => {
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (val && typeof val === 'object') {
    if (val.seconds) return new Date(val.seconds * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (val instanceof Date) return val.toLocaleTimeString('ru-RU');
  }
  return fallback;
};

const formatDate = (ts) => {
  if (!ts) return 'Нет данных';
  return new Date(ts).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const [leads, setLeads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Состояние для кнопки восстановления
  const [isRecovering, setIsRecovering] = useState(false);
  
  const scrollRef = useRef(null);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === SECRET_PIN) {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
    }
  };

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(e => console.error("Auth error:", e));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !user) return;

    try {
      const lRef = collection(db, 'artifacts', appId, 'public', 'data', 'leads');
      const mRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');

      const unsubL = onSnapshot(lRef, (s) => {
        setLeads(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
      }, (e) => console.error("Leads Error:", e));

      const unsubM = onSnapshot(mRef, (s) => {
        setMessages(s.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (e) => console.error("Messages Error:", e));

      return () => { unsubL(); unsubM(); };
    } catch (err) {
      console.error("Firestore Init Error:", err);
    }
  }, [user]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, selectedId]);

  const activeMessages = messages
    .filter(m => String(m.chatId) === String(selectedId))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const activeLead = leads.find(l => l.id === selectedId);
  
  // Подсчет статистики для правой колонки (как в вашем оригинале)
  if (activeLead && activeMessages.length > 0) {
    activeLead.msgCount = activeMessages.length;
    activeLead.firstMsgDate = activeMessages[0].timestamp;
    activeLead.lastMsgDate = activeMessages[activeMessages.length - 1].timestamp;
  }

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

  // ФУНКЦИЯ ВОССТАНОВЛЕНИЯ (Единственное, что добавлено в ваш код)
  const recoverMissedLeads = async () => {
    if (!db || !user) return;
    setIsRecovering(true);
    try {
      const existingLeadIds = new Set(leads.map(l => String(l.id)));
      const allChatIds = [...new Set(messages.map(m => String(m.chatId)))];
      const missingIds = allChatIds.filter(id => id && id !== 'undefined' && !existingLeadIds.has(id));

      if (missingIds.length === 0) {
        alert("Поиск завершен. Все существующие диалоги уже отображаются в списке.");
        setIsRecovering(false);
        return;
      }

      let recoveredCount = 0;
      for (const id of missingIds) {
        const userMsgs = messages.filter(m => String(m.chatId) === id).sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));
        const lastMsg = userMsgs[userMsgs.length - 1];

        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', id), {
          name: "Восстановленный диалог",
          username: "n/a",
          updatedAt: lastMsg?.timestamp || Date.now(),
          status: 'ai_active',
          summary: "Лид восстановлен из архива сообщений."
        }, { merge: true });
        
        recoveredCount++;
      }
      alert(`Успешно восстановлено потерянных диалогов: ${recoveredCount}`);
    } catch (error) {
      console.error("Recovery error:", error);
      alert("Ошибка при восстановлении: " + error.message);
    } finally {
      setIsRecovering(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-left font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-b-8 border-blue-600 z-10 relative">
           <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center mb-8 shadow-xl shadow-blue-500/30">
              <Bot size={40} className="text-white" />
           </div>
           <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none text-center">Aegis CRM</h1>
           <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-3 mb-10 text-center">Lead Control Center</p>
           
           <form onSubmit={handleLogin} className="space-y-4">
             <div>
               <div className="relative">
                 <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                   type="password"
                   value={pin}
                   onChange={e => { setPin(e.target.value); setPinError(false); }}
                   placeholder="Введите PIN-код"
                   className={`w-full bg-slate-50 border-2 ${pinError ? 'border-red-300 focus:border-red-500' : 'border-slate-100 focus:border-blue-500'} rounded-2xl py-4 pl-12 pr-4 outline-none transition-all font-bold tracking-widest text-center text-slate-700`}
                   autoFocus
                 />
               </div>
               {pinError && <p className="text-red-500 text-[10px] font-bold mt-2 uppercase tracking-widest text-center">Неверный PIN-код</p>}
             </div>
             
             <button 
               type="submit"
               disabled={!user || !pin}
               className="w-full bg-[#1e293b] hover:bg-slate-800 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
             >
               {user ? 'Войти в систему' : 'Подключение...'} <ArrowRight size={18}/>
             </button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 text-left overflow-hidden">
      
      {/* ЛЕВАЯ ПАНЕЛЬ (ЧАТЫ) */}
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
                   <p className="font-black text-xs uppercase truncate pr-4">{safeText(l.name || 'Новый лид')}</p>
                   <div className={`w-2 h-2 rounded-full mt-1 ${l.status === 'operator_active' ? 'bg-green-400 border border-white' : 'bg-amber-400 animate-pulse'}`}></div>
                </div>
                {l.summary && (
                  <p className={`text-[11px] leading-relaxed line-clamp-2 italic mb-3 opacity-80 text-left ${selectedId === l.id ? 'text-blue-100' : 'text-slate-500'}`}>
                    "{safeText(l.summary)}"
                  </p>
                )}
                <div className={`text-[9px] font-black flex justify-between uppercase tracking-widest ${selectedId === l.id ? 'text-blue-200' : 'text-slate-400'}`}>
                   <span className="flex items-center gap-1 text-left">@{safeText(l.username)}</span>
                   <span className="text-right">{safeText(l.updatedAt)}</span>
                </div>
             </button>
           ))}
           {leads.length === 0 && (
              <div className="p-10 text-center flex flex-col items-center gap-4">
                 <Bot size={48} className="text-slate-200" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 text-center">Ожидание клиентов...</p>
              </div>
           )}
        </div>
        
        {/* КНОПКА ВОССТАНОВЛЕНИЯ ЧАТОВ */}
        <footer className="p-4 border-t bg-slate-50 flex flex-col gap-3">
           <button 
             onClick={recoverMissedLeads}
             disabled={isRecovering}
             className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
           >
             {isRecovering ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
             {isRecovering ? 'Поиск данных...' : 'Восстановить чаты'}
           </button>
        </footer>
      </aside>

      {/* ЦЕНТРАЛЬНАЯ ПАНЕЛЬ (СООБЩЕНИЯ) */}
      <main className="flex-1 flex flex-col bg-slate-100 overflow-hidden text-left z-10">
         {selectedId ? (
           <>
             <header className="h-20 border-b flex items-center justify-between px-10 shrink-0 bg-white shadow-sm">
                <div>
                   <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">{safeText(activeLead?.name)}</h2>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2 flex items-center gap-2">
                      <Zap size={10} className="text-amber-500" fill="currentColor"/> Лид из Telegram • ID {selectedId}
                   </p>
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
                           {m.sender === 'user' ? 'Клиент' : m.sender === 'operator' ? 'Оператор' : 'Бот (AI)'}
                        </div>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium">{safeText(m.text)}</p>
                        <div className="text-[8px] mt-3 font-black opacity-30 text-right uppercase tracking-widest">
                           {safeText(m.timestamp)}
                        </div>
                     </div>
                  </div>
                ))}
                <div ref={scrollRef} />
             </div>

             <div className="p-8 bg-white border-t-2 border-slate-100">
               <form onSubmit={sendMessage} className="flex gap-4 max-w-5xl mx-auto">
                  <div className="flex-1 relative">
                    <input 
                      value={input} 
                      onChange={e => setInput(e.target.value)}
                      className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500/30 focus:bg-white transition-all font-bold text-sm"
                      placeholder="Написать клиенту..."
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
           <div className="flex-1 flex flex-col items-center justify-center text-slate-200 gap-8 grayscale opacity-20 select-none">
              <Bot size={150} strokeWidth={1} className="animate-pulse" />
              <div className="text-center">
                 <h2 className="text-3xl font-black uppercase tracking-[0.2em] leading-none">Центр управления</h2>
              </div>
           </div>
         )}
      </main>

      {/* ПРАВАЯ ПАНЕЛЬ (ПРОФИЛЬ - ВАШ ОРИГИНАЛЬНЫЙ) */}
      <aside className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0 z-20 shadow-xl overflow-y-auto">
         {activeLead ? (
           <div className="p-6">
             <div className="flex flex-col items-center mb-8 pt-4">
                <div className="w-24 h-24 bg-blue-100 rounded-[2rem] flex items-center justify-center text-blue-600 font-black text-3xl mb-4 shadow-inner">
                   {safeText(activeLead.name).charAt(0).toUpperCase()}
                </div>
                <h2 className="font-black text-lg text-slate-800 text-center uppercase tracking-tight">{safeText(activeLead.name)}</h2>
                <p className="text-xs font-bold text-slate-400 mt-1">@{safeText(activeLead.username)}</p>
             </div>

             <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><Phone size={12}/> Телефон</p>
                <p className="font-black text-slate-700 text-sm tracking-wider">
                   {activeLead.phone ? activeLead.phone : 'Не указан'}
                </p>
             </div>

             <div className="mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><FileText size={12}/> Сводка ИИ</h3>
                <p className="text-xs leading-relaxed text-slate-600 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 italic font-medium">
                   {activeLead.summary ? activeLead.summary : 'Сводка пока не сформирована...'}
                </p>
             </div>

             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Calendar size={12}/> Хронология</h3>
             <div className="space-y-3">
               <div className="flex justify-between items-center text-xs">
                 <span className="font-bold text-slate-500 flex items-center gap-1.5"><Calendar size={12}/> Первое обращение</span>
                 <span className="font-black text-slate-700">{formatDate(activeLead.firstMsgDate)}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="font-bold text-slate-500 flex items-center gap-1.5"><Clock size={12}/> Последняя активность</span>
                 <span className="font-black text-slate-700">{formatDate(activeLead.lastMsgDate)}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="font-bold text-slate-500 flex items-center gap-1.5"><MessageSquare size={12}/> Сообщений в чате</span>
                 <span className="font-black text-slate-700">{activeLead.msgCount || 0} шт.</span>
               </div>
             </div>
           </div>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8 text-center select-none">
             <Info size={48} className="mb-4 opacity-50" />
             <p className="text-xs font-black uppercase tracking-widest">Профиль клиента будет отображен здесь</p>
           </div>
         )}
      </aside>

    </div>
  );
}
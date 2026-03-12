import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { 
  MessageSquare, Send, Bot, User, Zap, ArrowRight, 
  CheckCircle2, AlertTriangle, Phone, Calendar, Clock, FileText, Info, Lock,
  Loader2, Database, BarChart3, PieChart, Activity, Settings, Save
} from 'lucide-react';

// --- ИНИЦИАЛИЗАЦИЯ FIREBASE ---
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
  const [isRecovering, setIsRecovering] = useState(false);
  
  // Навигация
  const [currentTab, setCurrentTab] = useState('chats'); // 'chats' | 'analytics' | 'settings'
  
  // Настройки бота
  const [botInstructions, setBotInstructions] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
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

  // Загрузка настроек бота
  useEffect(() => {
    if (!db || !user) return;
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'bot_settings');
    const unsub = onSnapshot(configRef, (doc) => {
      if (doc.exists()) setBotInstructions(doc.data().instructions || '');
    });
    return () => unsub();
  }, [user]);

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

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, selectedId, currentTab]);

  const saveBotSettings = async () => {
    setIsSavingSettings(true);
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'bot_settings');
      await setDoc(configRef, { instructions: botInstructions, updatedAt: Date.now() }, { merge: true });
      alert("Инструкции обновлены! Бот подхватит их при следующем сообщении.");
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const activeMessages = messages
    .filter(m => String(m.chatId) === String(selectedId))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const activeLead = leads.find(l => l.id === selectedId);
  const msgCount = activeMessages.length;
  const firstMsgDate = msgCount > 0 ? activeMessages[0].timestamp : null;
  const lastMsgDate = msgCount > 0 ? activeMessages[msgCount - 1].timestamp : null;
  const isAiTyping = activeLead?.status === 'ai_active' && activeMessages.length > 0 && activeMessages[activeMessages.length - 1].sender === 'user';

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

  const takeControl = async () => {
    if (!selectedId) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', selectedId), {
        status: 'operator_active', updatedAt: Date.now()
      });
    } catch (err) { console.error("Take control failed:", err); }
  };

  const returnControl = async () => {
    if (!selectedId) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', selectedId), {
        status: 'ai_active', updatedAt: Date.now()
      });
    } catch (err) { console.error("Return control failed:", err); }
  };

  const recoverMissedLeads = async () => {
    if (!db || !user) return;
    setIsRecovering(true);
    try {
      const existingLeadIds = new Set(leads.map(l => String(l.id)));
      const allChatIds = [...new Set(messages.map(m => String(m.chatId)))];
      const missingIds = allChatIds.filter(id => id && id !== 'undefined' && !existingLeadIds.has(id));

      if (missingIds.length === 0) {
        alert("Все диалоги уже в списке.");
        setIsRecovering(false);
        return;
      }

      for (const id of missingIds) {
        const userMsgs = messages.filter(m => String(m.chatId) === id).sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leads', id), {
          name: "Восстановленный диалог",
          username: "n/a",
          updatedAt: userMsgs[userMsgs.length - 1]?.timestamp || Date.now(),
          status: 'ai_active',
          summary: "Лид восстановлен из архива сообщений."
        }, { merge: true });
      }
      alert(`Восстановлено: ${missingIds.length}`);
    } catch (error) { alert(error.message); } 
    finally { setIsRecovering(false); }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-left font-sans relative overflow-hidden">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-b-8 border-blue-600 z-10 relative">
           <div className="w-24 h-24 bg-white border border-slate-100 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl overflow-hidden relative group">
              <img src="/logo-a-1.png" alt="Aegis" className="w-16 h-16 object-contain z-10" onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
              <Bot size={40} className="text-blue-600 hidden absolute" />
           </div>
           <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none text-center">Aegis CRM</h1>
           <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-3 mb-10 text-center">Lead Control Center</p>
           <form onSubmit={handleLogin} className="space-y-4">
             <div className="relative">
               <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
               <input type="password" value={pin} onChange={e => { setPin(e.target.value); setPinError(false); }} placeholder="Введите PIN-код" className={`w-full bg-slate-50 border-2 ${pinError ? 'border-red-300' : 'border-slate-100'} rounded-2xl py-4 pl-12 pr-4 outline-none font-bold text-center tracking-widest`} />
             </div>
             <button type="submit" disabled={!user || !pin} className="w-full bg-[#1e293b] text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 disabled:opacity-50 transition-all">
               {user ? 'Войти в систему' : 'Загрузка...'}
             </button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 text-left overflow-hidden">
      
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <aside className="w-80 border-r border-slate-200 flex flex-col shrink-0 bg-white shadow-xl z-20">
        <header className="px-6 pt-6 pb-4 border-b shrink-0 bg-white">
           <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-md overflow-hidden">
                <img src="/logo-a-1.png" alt="Aegis" className="w-6 h-6 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
                <Bot size={20} className="text-blue-600 hidden" />
             </div>
             <h2 className="font-black text-sm uppercase tracking-widest">Aegis CRM</h2>
           </div>

           <div className="flex bg-slate-100 p-1 rounded-xl">
             <button onClick={() => setCurrentTab('chats')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 ${currentTab === 'chats' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><MessageSquare size={14}/> Чаты</button>
             <button onClick={() => setCurrentTab('analytics')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 ${currentTab === 'analytics' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><BarChart3 size={14}/> Аналитика</button>
             <button onClick={() => setCurrentTab('settings')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 ${currentTab === 'settings' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><Settings size={14}/> Мозг</button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
           {currentTab === 'chats' && leads.map(l => (
             <button key={l.id} onClick={() => setSelectedId(l.id)} className={`w-full p-5 rounded-[1.8rem] text-left transition-all border-2 ${selectedId === l.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl' : 'bg-white border-slate-50 hover:bg-slate-50'}`}>
                <div className="flex justify-between items-start mb-2">
                   <p className="font-black text-xs uppercase truncate pr-4">{safeText(l.name || 'Новый лид')}</p>
                   <div className={`w-2 h-2 rounded-full mt-1 ${l.status === 'operator_active' ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`}></div>
                </div>
                {l.summary && <p className={`text-[11px] leading-relaxed line-clamp-2 italic mb-3 opacity-80 ${selectedId === l.id ? 'text-blue-100' : 'text-slate-500'}`}>"{safeText(l.summary)}"</p>}
                <div className={`text-[9px] font-black flex justify-between uppercase tracking-widest ${selectedId === l.id ? 'text-blue-200' : 'text-slate-400'}`}>
                   <span>@{safeText(l.username)}</span>
                   <span>{safeText(l.updatedAt)}</span>
                </div>
             </button>
           ))}
           {currentTab !== 'chats' && <div className="p-10 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">Раздел управления открыт справа</div>}
        </div>
        
        <footer className="p-4 border-t bg-slate-50">
           <button onClick={recoverMissedLeads} disabled={isRecovering} className="w-full py-2.5 bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2">
             {isRecovering ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />} Восстановить чаты
           </button>
        </footer>
      </aside>

      {/* ЦЕНТРАЛЬНАЯ ПАНЕЛЬ */}
      <main className="flex-1 flex flex-col bg-slate-100 overflow-hidden text-left z-10 relative">
         
         {currentTab === 'settings' ? (
            <div className="p-10 w-full h-full overflow-y-auto">
               <header className="mb-10">
                  <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none">Настройки Мозга ИИ</h2>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-3 flex items-center gap-2">
                     <Zap size={12} className="text-blue-500" fill="currentColor"/> Динамическая логика Антона Старокорова
                  </p>
               </header>

               <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 max-w-4xl">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><FileText size={14}/> Дополнительные инструкции и исключения</h3>
                  <textarea 
                     value={botInstructions}
                     onChange={(e) => setBotInstructions(e.target.value)}
                     className="w-full h-64 bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 outline-none focus:border-blue-500/30 transition-all font-medium text-sm leading-relaxed text-slate-700 mb-6"
                     placeholder="Напишите здесь то, что бот должен знать: акции, правила поведения, специфические ответы на вопросы..."
                  />
                  <button 
                     onClick={saveBotSettings}
                     disabled={isSavingSettings}
                     className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                     {isSavingSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                     Сохранить в память бота
                  </button>
               </div>
            </div>
         ) : currentTab === 'analytics' ? (
           <div className="p-10 w-full h-full overflow-y-auto">
             <header className="mb-10"><h2 className="text-3xl font-black uppercase tracking-tighter">Аналитика</h2></header>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
               <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Всего лидов</p>
                 <div className="text-4xl font-black text-slate-800">{leads.length}</div>
               </div>
               <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Нагрузка ИИ</p>
                 <div className="text-4xl font-black text-amber-500">{leads.filter(l => l.status === 'ai_active').length}</div>
               </div>
             </div>
           </div>
         ) : selectedId ? (
           <>
             <header className="h-20 border-b flex items-center justify-between px-10 shrink-0 bg-white shadow-sm">
                <div>
                   <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">{safeText(activeLead?.name)}</h2>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2 flex items-center gap-2">
                      <Zap size={10} className={activeLead?.status === 'operator_active' ? "text-green-500" : "text-amber-500"} fill="currentColor"/> 
                      {activeLead?.status === 'operator_active' ? 'Управление оператора' : 'Работает ИИ'} • ID {selectedId}
                   </p>
                </div>
                <div className="flex gap-3">
                   {activeLead?.status === 'operator_active' ? (
                     <button onClick={returnControl} className="px-6 py-3 bg-green-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-500/20 flex items-center gap-2">
                       <Bot size={14} /> Вернуть ИИ
                     </button>
                   ) : (
                     <button onClick={takeControl} className="px-6 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-amber-500/20 flex items-center gap-2">
                       <User size={14} /> Перехватить
                     </button>
                   )}
                   <button className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">Архивировать</button>
                </div>
             </header>

             <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar relative">
                {activeMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                     <div className={`max-w-[70%] p-6 rounded-[2.5rem] shadow-sm text-left ${m.sender === 'user' ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-none' : m.sender === 'ai' ? 'bg-blue-50 border border-blue-100 text-blue-800 rounded-br-none italic' : 'bg-[#1e293b] text-white rounded-br-none'}`}>
                        <div className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-40 flex items-center gap-2">
                           {m.sender === 'user' ? <User size={10}/> : <Bot size={10}/>}
                           {m.sender === 'user' ? 'Клиент' : m.sender === 'operator' ? 'Оператор' : 'Бот (AI)'}
                        </div>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium">{safeText(m.text)}</p>
                        <div className="text-[8px] mt-3 font-black opacity-30 text-right uppercase tracking-widest">{safeText(m.timestamp)}</div>
                     </div>
                  </div>
                ))}
                {isAiTyping && <div className="flex justify-start opacity-70 animate-pulse transition-all"><div className="bg-white border border-slate-200 text-slate-500 p-4 rounded-[2.5rem] rounded-bl-none shadow-sm flex items-center gap-3"><Bot size={14} className="text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest">ИИ формулирует ответ...</span></div></div>}
                <div ref={scrollRef} />
             </div>

             <div className="p-8 bg-white border-t-2 border-slate-100">
               <form onSubmit={sendMessage} className="flex gap-4 max-w-5xl mx-auto">
                  <div className="flex-1 relative">
                    <input value={input} onChange={e => setInput(e.target.value)} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500/30 transition-all font-bold text-sm" placeholder="Написать клиенту..." />
                  </div>
                  <button disabled={isSending || !input.trim()} className="bg-blue-600 text-white px-8 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/30 active:scale-90 transition-all disabled:opacity-30"><Send size={24}/></button>
               </form>
             </div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-200 gap-8 grayscale opacity-20"><Bot size={150} strokeWidth={1} className="animate-pulse" /><h2 className="text-3xl font-black uppercase tracking-[0.2em]">Центр управления</h2></div>
         )}
      </main>

      {/* ПРАВАЯ ПАНЕЛЬ */}
      {currentTab === 'chats' && activeLead && (
        <aside className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0 z-20 shadow-xl overflow-y-auto">
           <div className="p-6">
             <div className="flex flex-col items-center mb-8 pt-4">
                <div className="w-24 h-24 bg-blue-100 rounded-[2rem] flex items-center justify-center text-blue-600 font-black text-3xl mb-4 shadow-inner">{safeText(activeLead.name).charAt(0).toUpperCase()}</div>
                <h2 className="font-black text-lg text-slate-800 text-center uppercase tracking-tight">{safeText(activeLead.name)}</h2>
                <p className="text-xs font-bold text-slate-400 mt-1">@{safeText(activeLead.username)}</p>
             </div>

             <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><Phone size={12}/> Телефон</p>
                <p className="font-black text-slate-700 text-sm tracking-wider">{activeLead.phone ? activeLead.phone : 'Не указан'}</p>
             </div>

             <div className="mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><FileText size={12}/> Сводка ИИ</h3>
                <p className="text-xs leading-relaxed text-slate-600 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 italic font-medium">{activeLead.summary ? activeLead.summary : 'Сводка пока не сформирована...'}</p>
             </div>

             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Calendar size={12}/> Хронология</h3>
             <div className="space-y-3">
               <div className="flex justify-between items-center text-xs">
                 <span className="font-bold text-slate-500 flex items-center gap-1.5"><Calendar size={12}/> Первое</span>
                 <span className="font-black text-slate-700">{formatDate(firstMsgDate)}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="font-bold text-slate-500 flex items-center gap-1.5"><Clock size={12}/> Активность</span>
                 <span className="font-black text-slate-700">{formatDate(lastMsgDate)}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="font-bold text-slate-500 flex items-center gap-1.5"><MessageSquare size={12}/> Сообщений</span>
                 <span className="font-black text-slate-700">{msgCount} шт.</span>
               </div>
             </div>
           </div>
        </aside>
      )}

    </div>
  );
}
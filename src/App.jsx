import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, setDoc } from 'firebase/firestore';
import { 
  MessageSquare, Send, Bot, Zap, ArrowRight, 
  Settings, BarChart3, Link as LinkIcon, Save, Phone, Shield, Sparkles, Search, Lock, Mail, LogOut, Database, UserCheck, Volume2, CreditCard, Wallet, Bell, Wand2, FileText, Calendar, Clock, User
} from 'lucide-react';

// --- ИНИЦИАЛИЗАЦИЯ AEGIS ENVIRONMENT ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'aegis-saas-core';

const safeText = (val, fallback = '') => {
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (val && typeof val === 'object') {
    if (val.seconds) return new Date(val.seconds * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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

// --- ГОТОВЫЕ СЦЕНАРИИ AI-АГЕНТОВ ---
const SCENARIOS = {
  bankruptcy: `АЛГОРИТМ КВАЛИФИКАЦИИ (Банкротство):\n1. Уточни общую сумму долга.\n2. Спроси про имущество и крупные сделки за 3 года.\n3. Уточни семейное положение и наличие детей.\n4. Узнай цели кредитов.\n5. ЗАКРЫТИЕ: Требуй номер телефона для связи с юристом.`,
  real_estate: `АЛГОРИТМ КВАЛИФИКАЦИИ (Недвижимость):\n1. Какой тип недвижимости интересует?\n2. Какой планируемый бюджет?\n3. Рассматривается ли ипотека?\n4. Какие районы предпочтительны?\n5. ЗАКРЫТИЕ: Запроси номер телефона для отправки подборки.`,
  auto: `АЛГОРИТМ КВАЛИФИКАЦИИ (Автосалон):\n1. Какая марка и модель интересует?\n2. Новый или с пробегом?\n3. Рассматриваете кредит или Trade-in?\n4. Когда планируете покупку?\n5. ЗАКРЫТИЕ: Запроси телефон для записи на тест-драйв.`
};

// Компонент уведомлений
const Toast = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed top-5 right-5 z-50 bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-5">
      <Bell size={18} className="text-blue-400" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-4 text-slate-400 hover:text-white">&times;</button>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  
  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [currentTab, setCurrentTab] = useState('chats'); 
  
  // Data State
  const [leads, setLeads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // AI Settings State
  const [botInstructions, setBotInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Integrations State (Новые поля для ключей)
  const [tgToken, setTgToken] = useState('');
  const [envyboxKey, setEnvyboxKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [voiceType, setVoiceType] = useState('builtin');
  const [builtinVoice, setBuiltinVoice] = useState('male_1');
  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false);

  // Security settings
  const [dataRetention, setDataRetention] = useState('90');

  // AI Prompt Generator State
  const [promptGoal, setPromptGoal] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const scrollRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // --- АВТОРИЗАЦИЯ ---
  useEffect(() => {
    if (!auth) return;
    let isMounted = true;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        if (error.code === 'auth/operation-not-allowed') console.warn("Анонимная авторизация отключена.");
        else console.error("Auto-Auth Error:", error);
      } finally {
        if (isMounted) setAuthReady(true);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (isMounted) { setUser(u); setAuthReady(true); }
    });
    return () => { isMounted = false; unsubscribe(); };
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsAuthLoading(true); setAuthError('');
    try {
      if (isLoginMode) await signInWithEmailAndPassword(auth, email, password);
      else {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast("Учетная запись успешно создана!");
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') setAuthError('Ошибка: Метод Email/Пароль отключен в Firebase.');
      else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') setAuthError('Неверный логин или пароль.');
      else setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => { await signOut(auth); };

  // --- ЗАГРУЗКА ДАННЫХ (Мультитенантность) ---
  useEffect(() => {
    if (!db || !user || !authReady) return;
    const tenantPath = `artifacts/${appId}/users/${user.uid}`;
    
    // Лиды
    const unsubL = onSnapshot(collection(db, tenantPath, 'leads'), (s) => {
        setLeads(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => console.error("Leads Snapshot Error:", error));
    
    // Сообщения
    const unsubM = onSnapshot(collection(db, tenantPath, 'messages'), (s) => {
        setMessages(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.error("Messages Snapshot Error:", error));

    // Настройки ИИ (Промпты)
    const unsubConfig = onSnapshot(doc(db, tenantPath, 'config', 'bot_settings'), (docSnap) => {
        if (docSnap.exists()) setBotInstructions(docSnap.data().instructions || '');
    }, (error) => console.error("Config Snapshot Error:", error));

    // Настройки Интеграций (Ключи API)
    const unsubIntegrations = onSnapshot(doc(db, tenantPath, 'config', 'integrations'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setTgToken(data.telegram_token || '');
            setEnvyboxKey(data.envybox_api_key || '');
            setElevenLabsKey(data.elevenlabs_api_key || '');
            if (data.voice_type) setVoiceType(data.voice_type);
            if (data.builtin_voice) setBuiltinVoice(data.builtin_voice);
        }
    }, (error) => console.error("Integrations Snapshot Error:", error));

    return () => { unsubL(); unsubM(); unsubConfig(); unsubIntegrations(); };
  }, [user, authReady]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, selectedId, currentTab]);

  const saveBrainSettings = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const tenantPath = `artifacts/${appId}/users/${user.uid}`;
      await setDoc(doc(db, tenantPath, 'config', 'bot_settings'), {
        instructions: botInstructions, updatedAt: Date.now()
      }, { merge: true });
      showToast("Сценарии ИИ-агента успешно обновлены!");
    } catch (e) { showToast("Ошибка сохранения: " + e.message); }
    setIsSaving(false);
  };

  // Сохранение ключей интеграций
  const saveIntegrations = async () => {
    if (!user) return;
    setIsSavingIntegrations(true);
    try {
      const tenantPath = `artifacts/${appId}/users/${user.uid}`;
      await setDoc(doc(db, tenantPath, 'config', 'integrations'), {
        telegram_token: tgToken,
        envybox_api_key: envyboxKey,
        elevenlabs_api_key: elevenLabsKey,
        voice_type: voiceType,
        builtin_voice: builtinVoice,
        updatedAt: Date.now()
      }, { merge: true });
      showToast("Настройки интеграций надежно сохранены!");
    } catch (e) { showToast("Ошибка сохранения: " + e.message); }
    setIsSavingIntegrations(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedId || !user) return;
    const text = input; setInput('');
    const tenantPath = `artifacts/${appId}/users/${user.uid}`;
    try {
      await updateDoc(doc(db, tenantPath, 'leads', selectedId), { status: 'operator_active', updatedAt: Date.now() });
      await addDoc(collection(db, tenantPath, 'messages'), { chatId: String(selectedId), sender: 'operator', text: text, timestamp: Date.now() });
    } catch (err) { console.error("Send failed:", err); }
  };

  const takeControl = async () => {
    if (!selectedId || !user) return;
    const tenantPath = `artifacts/${appId}/users/${user.uid}`;
    await updateDoc(doc(db, tenantPath, 'leads', selectedId), { status: 'operator_active', updatedAt: Date.now() });
  };

  const returnToAI = async () => {
    if (!selectedId || !user) return;
    const tenantPath = `artifacts/${appId}/users/${user.uid}`;
    await updateDoc(doc(db, tenantPath, 'leads', selectedId), { status: 'ai_active', updatedAt: Date.now() });
  };

  const generateAIPrompt = async () => {
    if (!promptGoal.trim()) return;
    setIsGeneratingPrompt(true);
    
    // Симуляция работы AI-Фабрики ботов
    setTimeout(() => {
      const generated = `АЛГОРИТМ КВАЛИФИКАЦИИ (Сгенерировано ИИ):\nТвоя задача: Консультация и продажа по направлению "${promptGoal}".\n\n1. Поздоровайся и уточни главный запрос клиента.\n2. Выяви потребность (какие проблемы сейчас есть).\n3. Предложи решение из нашего ассортимента.\n4. Уточни срочность и комфортный бюджет.\n5. ЗАКРЫТИЕ: Попроси номер телефона для оформления заказа или детальной консультации специалиста.`;
      setBotInstructions(generated);
      setIsGeneratingPrompt(false);
      setPromptGoal('');
      showToast("ИИ успешно создал новый сценарий!");
    }, 1500);
  };

  const filteredLeads = leads.filter(l => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (l.name && l.name.toLowerCase().includes(term)) || (l.phone && l.phone.includes(term)) || (l.username && l.username.toLowerCase().includes(term));
  });

  const activeMessages = messages.filter(m => String(m.chatId) === String(selectedId)).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const activeLead = leads.find(l => l.id === selectedId);
  const msgCount = activeMessages.length;
  const firstMsgDate = msgCount > 0 ? activeMessages[0].timestamp : null;
  const lastMsgDate = msgCount > 0 ? activeMessages[msgCount - 1].timestamp : null;

  // --- ЭКРАН ВХОДА ---
  if (!user || !authReady) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-left font-sans relative overflow-hidden">
        <Toast message={toastMsg} onClose={() => setToastMsg('')} />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.1)_0,rgba(15,23,42,1)_100%)] pointer-events-none"></div>
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border-b-8 border-blue-600 z-10">
           <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center mb-8 shadow-xl shadow-blue-500/30">
              <Shield size={40} className="text-white" />
           </div>
           <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none text-center">Aegis SaaS</h1>
           <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-3 mb-8 text-center">AI Агенты & Квалификация</p>
           
           <form onSubmit={handleAuth} className="space-y-4">
             {authError && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 text-center">{authError}</div>}
             <div className="relative">
               <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
               <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Рабочий Email" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 outline-none font-bold text-slate-700 focus:border-blue-400 transition-colors" />
             </div>
             <div className="relative">
               <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
               <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" required minLength={6} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 outline-none font-bold text-slate-700 focus:border-blue-400 transition-colors" />
             </div>
             <button type="submit" disabled={isAuthLoading} className="w-full bg-[#1e293b] hover:bg-black text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
               {isAuthLoading ? 'Загрузка...' : isLoginMode ? 'Войти в Workspace' : 'Создать пространство'} <ArrowRight size={18}/>
             </button>
           </form>
           
           <div className="mt-6 text-center">
             <button onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors">
               {isLoginMode ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
             </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 text-left overflow-hidden">
      <Toast message={toastMsg} onClose={() => setToastMsg('')} />
      
      {/* 1. ЛЕВАЯ ПАНЕЛЬ: НАВИГАЦИЯ */}
      <aside className="w-24 bg-[#0f172a] flex flex-col items-center py-8 gap-6 shrink-0 z-30 shadow-2xl">
         <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50 mb-4">
            <Bot size={24} className="text-white" />
         </div>
         <button onClick={() => setCurrentTab('chats')} className={`p-4 rounded-2xl transition-all ${currentTab === 'chats' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Чаты"><MessageSquare size={22} /></button>
         <button onClick={() => setCurrentTab('brain')} className={`p-4 rounded-2xl transition-all ${currentTab === 'brain' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="AI-Агент (Сценарии)"><Settings size={22} /></button>
         <button onClick={() => setCurrentTab('integrations')} className={`p-4 rounded-2xl transition-all ${currentTab === 'integrations' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Интеграции"><LinkIcon size={22} /></button>
         <button onClick={() => setCurrentTab('analytics')} className={`p-4 rounded-2xl transition-all ${currentTab === 'analytics' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Биллинг"><BarChart3 size={22} /></button>
         <button onClick={() => setCurrentTab('security')} className={`p-4 rounded-2xl transition-all ${currentTab === 'security' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Безопасность"><Shield size={22} /></button>
         <div className="mt-auto">
            <button onClick={handleLogout} className="p-4 rounded-2xl text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all" title="Выход"><LogOut size={22} /></button>
         </div>
      </aside>

      {/* 2. ПАНЕЛЬ СПИСКА ЛИДОВ (Показывается только в Чатах) */}
      {currentTab === 'chats' && (
        <aside className="w-80 border-r border-slate-200 flex flex-col shrink-0 bg-white z-20 shadow-xl">
          <header className="py-4 px-5 border-b shrink-0 bg-white flex flex-col gap-3">
             <h2 className="font-black text-xs uppercase tracking-widest text-slate-800">Все лиды</h2>
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Поиск (имя, тел, ник)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-[11px] font-bold outline-none focus:border-blue-400 transition-colors"/>
             </div>
          </header>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
             {filteredLeads.map(l => (
               <button key={l.id} onClick={() => setSelectedId(l.id)} className={`w-full p-5 rounded-[1.5rem] text-left transition-all border-2 ${selectedId === l.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white border-slate-50 hover:border-slate-100 hover:bg-slate-50'}`}>
                  <div className="flex justify-between items-start mb-2">
                     <p className="font-black text-xs uppercase truncate pr-4">{safeText(l.name)}</p>
                     <div className={`w-2 h-2 rounded-full mt-1 ${l.status === 'operator_active' ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`}></div>
                  </div>
                  {l.phone && <p className={`text-[10px] font-bold mb-2 flex items-center gap-1 ${selectedId === l.id ? 'text-blue-200' : 'text-slate-500'}`}><Phone size={10}/> {l.phone}</p>}
                  <div className={`text-[9px] font-black uppercase tracking-widest ${selectedId === l.id ? 'text-blue-300' : 'text-slate-400'}`}>{safeText(l.updatedAt)}</div>
               </button>
             ))}
             {filteredLeads.length === 0 && <div className="text-center p-4 text-xs font-bold text-slate-400">Лиды не найдены</div>}
          </div>
        </aside>
      )}

      {/* 3. ЦЕНТРАЛЬНАЯ РАБОЧАЯ ОБЛАСТЬ */}
      <main className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
         
         {/* Вкладка: ЧАТЫ (Основное окно сообщений) */}
         {currentTab === 'chats' && selectedId ? (
           <>
             <header className="h-20 border-b flex items-center justify-between px-10 shrink-0 bg-white shadow-sm z-10">
                <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase leading-none">{safeText(activeLead?.name)}</h2>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2 flex items-center gap-2">
                      <Zap size={10} className={activeLead?.status === 'operator_active' ? "text-green-500" : "text-amber-500"} fill="currentColor"/> 
                      {activeLead?.status === 'operator_active' ? 'Управление Оператора' : 'Агент в работе'}
                   </p>
                </div>
                <div className="flex gap-3">
                   {activeLead?.status === 'operator_active' ? (
                     <button onClick={returnToAI} className="px-6 py-3 bg-green-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-500/20 flex items-center gap-2"><Bot size={14} /> Вернуть ИИ</button>
                   ) : (
                     <button onClick={takeControl} className="px-6 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-amber-500/20 flex items-center gap-2"><User size={14} /> Перехватить</button>
                   )}
                </div>
             </header>

             {activeLead?.summary && (
               <div className="absolute top-24 right-10 w-72 bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-xl border border-slate-100 z-20">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-2">Анализ от ИИ-агента</p>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed italic">{activeLead.summary}</p>
               </div>
             )}

             <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                {activeMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                     <div className={`max-w-[70%] p-6 rounded-[2rem] shadow-sm text-left ${m.sender === 'user' ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-none' : m.sender === 'ai' ? 'bg-blue-50 border border-blue-100 text-blue-900 rounded-br-none' : 'bg-slate-800 text-white rounded-br-none'}`}>
                        <p className="text-sm font-medium whitespace-pre-wrap">{safeText(m.text)}</p>
                        <div className="text-[8px] mt-3 font-black opacity-40 text-right uppercase tracking-widest">{safeText(m.timestamp)}</div>
                     </div>
                  </div>
                ))}
                <div ref={scrollRef} />
             </div>

             <div className="p-6 bg-white border-t border-slate-200 z-10">
               <form onSubmit={sendMessage} className="flex gap-4">
                  <input value={input} onChange={e => setInput(e.target.value)} className="flex-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500/30 transition-all font-medium text-sm" placeholder="Перехватить диалог и написать клиенту..." />
                  <button type="submit" className="bg-blue-600 text-white px-8 rounded-2xl flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all"><Send size={20}/></button>
               </form>
             </div>
           </>
         ) : currentTab === 'chats' ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4"><MessageSquare size={64} strokeWidth={1} /><p className="text-xs font-black uppercase tracking-widest">Выберите диалог</p></div>
         ) : null}

         {/* Вкладка: СЦЕНАРИИ ИИ (С ФАБРИКОЙ БОТОВ) */}
         {currentTab === 'brain' && (
           <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase mb-2">Сценарии ИИ (Алгоритмы)</h2>
              <p className="text-sm text-slate-500 font-medium mb-10">Настройте логику продаж. Загрузите готовый шаблон, напишите свой или попросите ИИ сгенерировать сценарий для вас.</p>
              
              {/* ФАБРИКА БОТОВ */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 rounded-[2rem] shadow-xl text-white mb-8 max-w-4xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-4 -translate-y-4"><Bot size={150} /></div>
                 <h3 className="text-lg font-black uppercase tracking-widest mb-2 flex items-center gap-2"><Wand2 size={20}/> AI-Фабрика Ботов</h3>
                 <p className="text-xs text-blue-100 font-medium mb-6 max-w-2xl leading-relaxed">Опишите, чем занимается ваш бизнес, и наша нейросеть сама напишет идеальный алгоритм квалификации и продаж для вашего нового бота.</p>
                 
                 <div className="flex gap-4 relative z-10">
                    <input 
                      value={promptGoal} 
                      onChange={e => setPromptGoal(e.target.value)} 
                      placeholder="Например: Продажа абонементов в фитнес-клуб..." 
                      className="flex-1 p-4 bg-white/10 border border-white/20 text-white placeholder-blue-200 rounded-xl outline-none focus:bg-white/20 transition-all font-medium text-sm"
                    />
                    <button onClick={generateAIPrompt} disabled={isGeneratingPrompt || !promptGoal} className="bg-white text-blue-600 px-8 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-50 transition-all disabled:opacity-50 flex items-center gap-2">
                      {isGeneratingPrompt ? <Bell size={16} className="animate-pulse"/> : <Sparkles size={16}/>}
                      {isGeneratingPrompt ? 'Создаем...' : 'Сгенерировать'}
                    </button>
                 </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 max-w-4xl">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4">Готовые шаблоны (Пресеты)</h3>
                 <div className="flex gap-3 mb-6 overflow-x-auto pb-2 custom-scrollbar">
                    <button onClick={() => setBotInstructions(SCENARIOS.bankruptcy)} className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold whitespace-nowrap hover:bg-slate-200 hover:text-blue-600 transition-all border border-transparent hover:border-blue-200">⚖️ Банкротство</button>
                    <button onClick={() => setBotInstructions(SCENARIOS.real_estate)} className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold whitespace-nowrap hover:bg-slate-200 hover:text-blue-600 transition-all border border-transparent hover:border-blue-200">🏢 Недвижимость</button>
                    <button onClick={() => setBotInstructions(SCENARIOS.auto)} className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold whitespace-nowrap hover:bg-slate-200 hover:text-blue-600 transition-all border border-transparent hover:border-blue-200">🚗 Автосалон</button>
                 </div>

                 <textarea value={botInstructions} onChange={(e) => setBotInstructions(e.target.value)} className="w-full h-80 bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 outline-none focus:border-blue-500/30 transition-all font-mono text-sm leading-relaxed text-slate-700 mb-6 resize-none" placeholder="Текущий алгоритм бота..." />
                 <button onClick={saveBrainSettings} disabled={isSaving} className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all flex items-center gap-2"><Save size={16} /> Сохранить в память ИИ</button>
              </div>
           </div>
         )}

         {/* Вкладка: ИНТЕГРАЦИИ (ДОБАВЛЕНО СОХРАНЕНИЕ КЛЮЧЕЙ) */}
         {currentTab === 'integrations' && (
           <div className="flex-1 p-12 overflow-y-auto">
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase mb-2">Источники и Интеграции</h2>
              <p className="text-sm text-slate-500 font-medium mb-6">Омниканальность: подключайте мессенджеры напрямую или через агрегаторы, и отправляйте лиды в вашу текущую CRM.</p>
              
              <div className="mb-8 max-w-5xl flex justify-end">
                 <button onClick={saveIntegrations} disabled={isSavingIntegrations} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all flex items-center gap-2 disabled:opacity-50">
                    <Save size={16} /> Сохранить интеграции
                 </button>
              </div>

              <div className="grid grid-cols-2 gap-6 max-w-5xl">
                 {/* Card 1: Telegram & MAX */}
                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 border-t-4 border-t-blue-500 flex flex-col justify-between">
                    <div>
                       <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6"><Bot size={24} className="text-blue-600"/></div>
                       <h3 className="text-lg font-black text-slate-800 mb-2">Telegram / VK Teams (API)</h3>
                       <p className="text-xs text-slate-500 mb-6 leading-relaxed">Бесплатно и моментально. Вставьте токен от @BotFather (TG) или Мессенджера MAX.</p>
                    </div>
                    <div>
                       <input type="text" value={tgToken} onChange={e => setTgToken(e.target.value)} placeholder="123456789:ABCDefgh..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400" />
                    </div>
                 </div>

                 {/* Card 2: Voice TTS */}
                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                       <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-black text-slate-800">Голосовой движок (TTS)</h3>
                          <Volume2 size={24} className="text-purple-600"/>
                       </div>
                       <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                         <button onClick={() => setVoiceType('builtin')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${voiceType === 'builtin' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Встроенные</button>
                         <button onClick={() => setVoiceType('elevenlabs')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${voiceType === 'elevenlabs' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}>ElevenLabs (PRO)</button>
                       </div>
                       {voiceType === 'builtin' ? (
                          <select value={builtinVoice} onChange={e => setBuiltinVoice(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-medium cursor-pointer focus:border-purple-400">
                             <option value="male_1">Мужской 1 (Деловой)</option>
                             <option value="female_1">Женский 1 (Спокойный)</option>
                          </select>
                       ) : (
                          <input type="password" value={elevenLabsKey} onChange={e => setElevenLabsKey(e.target.value)} placeholder="ElevenLabs API Key (xi-api-key)" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-400" />
                       )}
                    </div>
                 </div>

                 {/* Card 3: WhatsApp/VK (Агрегаторы) */}
                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                       <h3 className="text-lg font-black text-slate-800 mb-1 flex items-center gap-2"><MessageSquare size={18} className="text-slate-400"/> Мессенджеры (Агрегаторы)</h3>
                       <p className="text-xs text-slate-500 mb-4">Подключение WhatsApp/Instagram через Wazzup или Chat2Desk.</p>
                       <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 p-3 rounded-xl">В разработке (Фаза 3)</p>
                    </div>
                 </div>

                 {/* Card 4: Экспорт в CRM / Envybox */}
                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                       <h3 className="text-lg font-black text-slate-800 mb-1 flex items-center gap-2"><Database size={18} className="text-green-600"/> Интеграция с Envybox</h3>
                       <p className="text-xs text-slate-500 mb-4">Укажите API Ключ для приема сообщений с виджета сайта и экспорта готовых лидов в CRM.</p>
                       <input type="password" value={envyboxKey} onChange={e => setEnvyboxKey(e.target.value)} placeholder="Envybox API Key" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-green-400" />
                    </div>
                 </div>
              </div>
           </div>
         )}

         {/* Вкладка: БЕЗОПАСНОСТЬ (С ЮР. ДОКУМЕНТАМИ) */}
         {currentTab === 'security' && (
           <div className="flex-1 p-12 overflow-y-auto">
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase mb-2">Безопасность и ФЗ-152</h2>
              <p className="text-sm text-slate-500 font-medium mb-10">Управление персональными данными (ПДн) клиентов и юридическая документация.</p>
              
              <div className="grid grid-cols-2 gap-6 max-w-5xl">
                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-6"><Lock size={24} className="text-green-600"/></div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">Изоляция данных (Tenant)</h3>
                    <p className="text-xs text-slate-500 mb-6 leading-relaxed">Ваша база данных физически изолирована. Переписки зашифрованы. Доступ имеете только вы.</p>
                    <div className="px-4 py-3 bg-green-50 text-green-700 rounded-xl text-xs font-bold border border-green-100 flex items-center gap-2"><Shield size={14} /> Tenant ID: {user?.uid?.substring(0,10)}...</div>
                 </div>

                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6"><Database size={24} className="text-blue-600"/></div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">Data Retention (Автоудаление)</h3>
                    <p className="text-xs text-slate-500 mb-6 leading-relaxed">Для соблюдения ФЗ-152 настройте автоматическое удаление старых диалогов и ПДн клиентов.</p>
                    <select value={dataRetention} onChange={e => setDataRetention(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-medium mb-4 focus:border-blue-400">
                       <option value="30">Удалять старше 30 дней</option>
                       <option value="90">Удалять старше 90 дней (Рекомендуется)</option>
                    </select>
                    <button onClick={() => showToast("Политика хранения обновлена")} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all">Применить политику</button>
                 </div>

                 {/* ЮРИДИЧЕСКИЕ ДОКУМЕНТЫ */}
                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 col-span-2">
                    <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><UserCheck size={18} className="text-slate-400"/> Юридические документы (Для сайта)</h3>
                    <p className="text-xs text-slate-500 mb-6">Чтобы использовать агента легально, разместите эти документы рядом с виджетом чата или в описании бота.</p>
                    <div className="flex gap-4">
                       <button className="flex-1 bg-slate-100 text-slate-700 px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-all text-center">Скачать "Политика Конфиденциальности"</button>
                       <button className="flex-1 bg-slate-100 text-slate-700 px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-all text-center">Скачать "Согласие на обработку ПДн"</button>
                    </div>
                 </div>
              </div>
           </div>
         )}

         {/* Вкладка: АНАЛИТИКА И БИЛЛИНГ */}
         {currentTab === 'analytics' && (
           <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase mb-10">Аналитика и Биллинг</h2>
              
              <div className="grid grid-cols-3 gap-6 mb-10">
                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Всего лидов</p>
                    <p className="text-4xl font-black text-slate-800">{leads.length}</p>
                 </div>
                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 border-l-4 border-l-green-500">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Квалифицировано</p>
                    <p className="text-4xl font-black text-slate-800">{leads.filter(l => l.phone).length}</p>
                 </div>
                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 border-l-4 border-l-amber-500">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">В работе у Агента</p>
                    <p className="text-4xl font-black text-slate-800">{leads.filter(l => l.status === 'ai_active').length}</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
                 <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 border-t-4 border-t-purple-500 flex flex-col justify-between">
                    <div>
                       <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-black text-slate-800">Текущий тариф: PRO</h3>
                          <CreditCard size={24} className="text-purple-600"/>
                       </div>
                       <div className="space-y-6 mb-8">
                          <div>
                             <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                                <span>Расход токенов (AI Spend)</span>
                                <span className="text-slate-800">0 / 50,000</span>
                             </div>
                             <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-purple-500 h-full rounded-full" style={{width: '2%'}}></div>
                             </div>
                          </div>
                       </div>
                    </div>
                    <button onClick={() => showToast("Демо-режим: пополнение отключено")} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex justify-center items-center gap-2 shadow-lg shadow-slate-900/20 active:scale-95"><Wallet size={16}/> Пополнить баланс</button>
                 </div>
              </div>
           </div>
         )}

      </main>

      {/* 4. ПРАВАЯ ПАНЕЛЬ ЛИДА (Показывается только когда выбран диалог) */}
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
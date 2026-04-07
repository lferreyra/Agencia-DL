/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Version: 1.0.2 - Improved Error Diagnostics
import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Book, 
  FileText, 
  Image as ImageIcon, 
  Package, 
  TrendingUp, 
  Users, 
  Target, 
  Search, 
  AlertCircle, 
  Palette, 
  Layout, 
  Code, 
  Briefcase, 
  Zap, 
  Edit3, 
  Brain, 
  BarChart3,
  Sparkles,
  ChevronRight,
  Download,
  Copy,
  Check,
  Menu,
  X,
  Paperclip,
  FileUp,
  LogIn,
  LogOut,
  History,
  Plus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  getDocs,
  deleteDoc,
  testFirestoreConnection
} from './firebase';

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

type Role = 
  | 'DIRECTOR' 
  | 'TENDENCIAS' 
  | 'SOCIAL' 
  | 'META' 
  | 'SEO' 
  | 'PROBLEMAS' 
  | 'CREATIVO' 
  | 'LANDING' 
  | 'DEV' 
  | 'COACH' 
  | 'ENERGIA' 
  | 'EDITOR' 
  | 'NEURO' 
  | 'CRO';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  roleLabel?: string;
  type?: 'text' | 'ebook' | 'asset' | 'package';
  hasFile?: boolean;
  timestamp?: any;
}

const ROLES: Record<Role, { icon: any, label: string, desc: string }> = {
  DIRECTOR: { icon: Briefcase, label: 'Director', desc: 'Estrategia y coordinación general' },
  TENDENCIAS: { icon: TrendingUp, label: 'Tendencias', desc: 'Análisis de mercado y nichos' },
  SOCIAL: { icon: Users, label: 'Social', desc: 'Redes sociales y growth' },
  META: { icon: Target, label: 'Meta Ads', desc: 'Campañas y performance' },
  SEO: { icon: Search, label: 'SEO', desc: 'Google Trends y posicionamiento' },
  PROBLEMAS: { icon: AlertCircle, label: 'Problemas', desc: 'Detector de oportunidades' },
  CREATIVO: { icon: Palette, label: 'Creativo', desc: 'Diseño y concepto de marca' },
  LANDING: { icon: Layout, label: 'Landing', desc: 'Arquitecto de conversiones' },
  DEV: { icon: Code, label: 'Dev', desc: 'Implementación técnica' },
  COACH: { icon: Zap, label: 'Coach', desc: 'Mentoría y escalado' },
  ENERGIA: { icon: Sparkles, label: 'Energía', desc: 'Alineación y mensajes inspiradores' },
  EDITOR: { icon: Edit3, label: 'Editor', desc: 'Creador de ebooks bestseller' },
  NEURO: { icon: Brain, label: 'Neuro', desc: 'Persuasión y gatillos mentales' },
  CRO: { icon: BarChart3, label: 'CRO', desc: 'Optimización de conversión' },
};

const SYSTEM_INSTRUCTIONS = `
Eres una AGENCIA DE MARKETING DIGITAL COMPLETA con especialización en productos digitales, ebooks, y conversión. 
Actúas como un equipo de especialistas que trabajan en coordinación para generar resultados económicos reales.

REGLA INQUEBRANTABLE: MARCO GLOBAL DE CONVERSIÓN
Para CADA análisis, idea o entrega, es OBLIGATORIO incluir:
1. Promesa clara
2. Dolores del cliente
3. Identificación emocional
4. Beneficios específicos
5. Explicación técnica
6. Cómo se usa / implementa
7. Comparación con alternativas
8. Garantía o reducción de riesgo
9. Bonus
10. Preguntas frecuentes (mínimo 3)
11. Enfoque directo en conversión (CTA claro)

MODOS DE OPERACIÓN:
- [EBOOK]: Creación desde cero (Validación, Estructura, Escritura).
- [EBOOK PDF]: Transformación de contenido existente.
- [ACTIVOS]: Creación de piezas (Carrusel, Story, Reel, YouTube, FB, Ads).
- [PAQUETE COMPLETO]: Generación de todos los activos para un producto.

ROLES DISPONIBLES Y SU ENFOQUE:
- DIRECTOR: Estrategia y coordinación general. Lidera el proyecto con una visión global.
- TENDENCIAS: Análisis de mercado y nichos. Identifica qué está funcionando ahora y dónde están las oportunidades de dinero rápido.
- SOCIAL: Redes sociales y growth. Estrategias de viralidad, engagement y construcción de comunidad.
- META Ads: Campañas y performance. Optimización de anuncios pagados, segmentación y copy para anuncios.
- SEO: Google Trends y posicionamiento. Visibilidad orgánica y búsqueda de palabras clave de alta intención.
- PROBLEMAS: Detector de oportunidades. Encuentra fallos en el mercado o en la competencia para explotarlos.
- CREATIVO: Diseño y concepto de marca. Identidad visual, narrativa y estética del producto.
- LANDING: Arquitecto de conversiones. Estructura de páginas de venta, jerarquía visual y flujo de usuario.
- DEV: Implementación técnica. Automatizaciones, herramientas, integraciones y código.
- COACH: Mentoría y escalado. Cómo llevar el negocio de 0 a 100 y superar bloqueos mentales.
- ENERGIA: Alineación y mensajes inspiradores. Motivación, propósito y conexión con el cliente ideal.
- EDITOR: Creador de ebooks bestseller. Estructura, redacción, títulos ganadores y contenido de valor.
- NEURO: Persuasión y gatillos mentales. Psicología de ventas profunda y sesgos cognitivos.
- CRO: Optimización de conversión. Mejora de embudos existentes y pruebas A/B.

INSTRUCCIÓN ACTUAL:
Debes responder SIEMPRE desde la perspectiva del rol seleccionado por el usuario. 
Asegúrate de que tu tono, vocabulario y recomendaciones sean coherentes con ese rol específico.
Si el usuario cambia de rol, tu personalidad y enfoque deben cambiar inmediatamente para reflejar al nuevo especialista.
`;

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: 'Hola, soy tu equipo de especialistas en Marketing Digital. ¿Qué proyecto vamos a monetizar hoy? \n\nPuedes usar comandos como `[EBOOK]`, `[ACTIVOS]` o `[PAQUETE COMPLETO]` para empezar. \n\n**¡Ahora también puedes subir archivos PDF para que los analicemos!**' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeRole, setActiveRole] = useState<Role>('DIRECTOR');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState<{ name: string, data: string, mimeType: string } | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    testFirestoreConnection();
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Create or update user profile
          await setDoc(doc(db, 'users', currentUser.uid), {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            updatedAt: serverTimestamp()
          }, { merge: true });

          // Load or create a default session
          const sessionsRef = collection(db, 'users', currentUser.uid, 'sessions');
          const q = query(sessionsRef, orderBy('updatedAt', 'desc'));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            if (!currentSessionId) {
              setCurrentSessionId(querySnapshot.docs[0].id);
            }
          } else {
            const newSession = await addDoc(sessionsRef, {
              userId: currentUser.uid,
              title: 'Nueva Sesión',
              updatedAt: serverTimestamp()
            });
            setCurrentSessionId(newSession.id);
          }
        } catch (error) {
          console.error("Error initializing user data:", error);
        }
      } else {
        setCurrentSessionId(null);
        setSessions([]);
        setMessages([{ 
          role: 'assistant', 
          content: 'Hola, soy tu equipo de especialistas en Marketing Digital. ¿Qué proyecto vamos a monetizar hoy? \n\nPuedes usar comandos como `[EBOOK]`, `[ACTIVOS]` o `[PAQUETE COMPLETO]` para empezar. \n\n**¡Inicia sesión para guardar tu historial!**' 
        }]);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sessions Listener
  useEffect(() => {
    if (user) {
      const sessionsRef = collection(db, 'users', user.uid, 'sessions');
      const q = query(sessionsRef, orderBy('updatedAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedSessions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSessions(loadedSessions);
      }, (error) => {
        console.error("Snapshot error for sessions:", error);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // Messages Listener
  useEffect(() => {
    if (user && currentSessionId) {
      const messagesRef = collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedMessages = snapshot.docs.map(doc => doc.data() as Message);
        setMessages(loadedMessages);
      }, (error) => {
        console.error("Snapshot error for messages:", error);
      });
      return () => unsubscribe();
    } else if (!user) {
      // Reset to default welcome message if not logged in
      setMessages([{ 
        role: 'assistant', 
        content: 'Hola, soy tu equipo de especialistas en Marketing Digital. ¿Qué proyecto vamos a monetizar hoy? \n\nPuedes usar comandos como `[EBOOK]`, `[ACTIVOS]` o `[PAQUETE COMPLETO]` para empezar. \n\n**¡Inicia sesión para guardar tu historial!**' 
      }]);
    } else {
      // If logged in but no session selected, show empty or default
      setMessages([]);
    }
  }, [user, currentSessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleLogin = async () => {
    setIsLoginLoading(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setLoginError('Este dominio no está autorizado en la consola de Firebase. Por favor, añade tu dominio de Vercel a la lista de dominios autorizados.');
      } else {
        setLoginError('Hubo un error al iniciar sesión. Por favor, intenta de nuevo.');
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor, sube solo archivos PDF.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo es demasiado grande. El límite es de 5MB para asegurar un procesamiento rápido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const base64Data = base64.split(',')[1];
      setSelectedFile({
        name: file.name,
        data: base64Data,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userContent = input || (selectedFile ? `Analizando archivo: ${selectedFile.name}` : "");
    const hasFile = !!selectedFile;

    const currentInput = input;
    const currentFile = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      // 1. Save user message to Firestore
      if (user && currentSessionId) {
        try {
          // Add a timeout to Firestore operation
          const savePromise = addDoc(collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages'), {
            role: 'user',
            content: userContent,
            hasFile: hasFile,
            timestamp: serverTimestamp()
          });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Tiempo de espera agotado al guardar en la base de datos.")), 8000)
          );

          await Promise.race([savePromise, timeoutPromise]);
          
          // Update session title/timestamp
          const sessionDoc = sessions.find(s => s.id === currentSessionId);
          const updateData: any = { updatedAt: serverTimestamp() };
          if (!sessionDoc || sessionDoc.title === 'Nueva Conversación') {
            updateData.title = userContent.slice(0, 30) + (userContent.length > 30 ? '...' : '');
          }
          await setDoc(doc(db, 'users', user.uid, 'sessions', currentSessionId), updateData, { merge: true });
        } catch (dbError: any) {
          console.error("Database Error (User Message):", dbError);
          // Don't block the AI call if saving user message fails, just log it
        }
      } else {
        setMessages(prev => [...prev, { role: 'user', content: userContent, hasFile: hasFile }]);
      }

      // 2. Prepare multimodal parts for AI
      const parts: any[] = [];
      if (currentInput) parts.push({ text: currentInput });
      if (currentFile) {
        if (!currentFile.data) throw new Error("Lectura de archivo fallida.");
        parts.push({
          inlineData: {
            data: currentFile.data,
            mimeType: currentFile.mimeType
          }
        });
        if (!currentInput.includes('[EBOOK PDF]')) {
          parts.unshift({ text: "[EBOOK PDF] Analiza este documento y crea el ecosistema de ventas." });
        }
      }

      // Filter and map history to ensure valid roles and non-empty content
      const history = messages
        .filter(m => m.content && !m.content.startsWith('⚠️')) // Exclude error messages from history
        .slice(-6) // Reduced history size for faster response
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content || "" }]
        }));

      // 3. Call Gemini API with timeout
      let response;
      try {
        const aiPromise = genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            ...history,
            {
              role: 'user',
              parts: parts
            }
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTIONS + `\n\nTU ROL ACTUAL ES: [${ROLES[activeRole].label}] - ${ROLES[activeRole].desc}. \nResponde como este especialista de forma exclusiva.`
          }
        });

        const aiTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("La IA está tardando demasiado en responder. Por favor, intenta con un mensaje más corto.")), 25000)
        );

        response = await Promise.race([aiPromise, aiTimeout]) as any;
      } catch (aiError: any) {
        console.error("AI API Error:", aiError);
        throw new Error(aiError.message || "Error de conexión con el motor de IA.");
      }

      const text = response.text;
      if (!text) throw new Error("La IA devolvió una respuesta vacía.");

      // 4. Save AI response
      if (user && currentSessionId) {
        try {
          const messagesRef = collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages');
          await addDoc(messagesRef, {
            role: 'assistant',
            content: text,
            roleLabel: ROLES[activeRole].label,
            timestamp: serverTimestamp()
          });
        } catch (dbError: any) {
          console.error("Database Error (AI Response):", dbError);
          setMessages(prev => [...prev, { role: 'assistant', content: text, roleLabel: ROLES[activeRole].label }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: text, roleLabel: ROLES[activeRole].label }]);
      }
    } catch (error: any) {
      console.error("Detailed Catch-All Error:", error);
      let errorMsg = 'Error inesperado. Por favor, intenta de nuevo.';
      
      if (error?.message) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      } else {
        try {
          errorMsg = `Error técnico: ${JSON.stringify(error).slice(0, 150)}`;
        } catch (e) {
          errorMsg = 'Error crítico en el motor de procesamiento.';
        }
      }

      if (errorMsg.includes('insufficient permissions')) {
        errorMsg = "Error de permisos en la base de datos. Por favor, verifica que tu sesión sea válida.";
      }

      const finalErrorMsg = `⚠️ ERROR CRÍTICO: ${errorMsg}\n\n**Sugerencia:** Si este error persiste, por favor haz clic en "Nuevo Chat" o usa el botón "Borrar Mensajes" en la barra lateral para reiniciar esta sesión.`;
      console.log("Setting error message:", finalErrorMsg);

      if (user && currentSessionId) {
        try {
          const messagesRef = collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages');
          await addDoc(messagesRef, {
            role: 'assistant',
            content: finalErrorMsg,
            timestamp: serverTimestamp()
          });
        } catch (e) {
          console.error("Failed to save error message to DB:", e);
          setMessages(prev => [...prev, { role: 'assistant', content: finalErrorMsg }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: finalErrorMsg }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Sessions Listener
  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }

    const q = query(
      collection(db, `users/${user.uid}/sessions`),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSessions(sessionList);
    });

    return () => unsubscribe();
  }, [user]);

  const handleNewChat = async () => {
    if (window.innerWidth < 768) setIsSidebarOpen(false);
    
    if (!user) {
      setMessages([]);
      setCurrentSessionId(null);
      return;
    }

    try {
      const newSessionRef = await addDoc(collection(db, `users/${user.uid}/sessions`), {
        userId: user.uid,
        title: 'Nueva Conversación',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        activeRole: 'DIRECTOR'
      });
      
      setCurrentSessionId(newSessionRef.id);
      setMessages([]); // Will be populated by messages listener
    } catch (error: any) {
      console.error("Error creating new session:", error);
      alert(`Error al crear sesión: ${error.message || 'Sin permisos'}`);
    }
  };

  const loadSession = (sessionId: string) => {
    if (window.innerWidth < 768) setIsSidebarOpen(false);
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/sessions`, sessionId));
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
      setSessionToDelete(null);
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action + " ");
    if (action === '[EBOOK]') setActiveRole('EDITOR');
    if (action === '[EBOOK PDF]') setActiveRole('EDITOR');
    if (action === '[ACTIVOS]') setActiveRole('CREATIVO');
    if (action === '[PAQUETE COMPLETO]') setActiveRole('DIRECTOR');
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-72 bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl md:shadow-none absolute md:relative h-full"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h1 className="font-bold text-lg tracking-tight">Agencia Pro</h1>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="md:hidden">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <button 
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Nuevo Chat
              </button>
              
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={async () => {
                    if (confirm('¿Borrar todos los mensajes de este chat permanentemente?')) {
                      if (user && currentSessionId) {
                        try {
                          const messagesRef = collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages');
                          const snapshot = await getDocs(messagesRef);
                          const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                          await Promise.all(deletePromises);
                        } catch (e) {
                          console.error("Error clearing messages from DB:", e);
                        }
                      }
                      setMessages([]);
                    }
                  }}
                  className="flex items-center justify-center gap-1 bg-rose-50 text-rose-600 py-2 rounded-xl text-[10px] font-bold hover:bg-rose-100 transition-all border border-rose-100"
                  title="Borrar historial de este chat"
                >
                  <Trash2 className="w-3 h-3" />
                  Borrar Chat
                </button>
                
                <button 
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      await testFirestoreConnection();
                      await genAI.models.generateContent({
                        model: "gemini-3-flash-preview",
                        contents: "hola",
                        config: { maxOutputTokens: 5 }
                      });
                      alert("✅ Conexión con Base de Datos e IA: OK");
                    } catch (e: any) {
                      alert(`❌ Error de sistema: ${e.message}`);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="flex items-center justify-center gap-1 bg-emerald-50 text-emerald-600 py-2 rounded-xl text-[10px] font-bold hover:bg-emerald-100 transition-all border border-emerald-100"
                >
                  <Check className="w-3 h-3" />
                  Test Sistema
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {!user && (
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <p className="text-xs text-indigo-700 font-medium mb-3">Guarda tu historial y accede a funciones premium.</p>
                  <button 
                    onClick={handleLogin}
                    disabled={isLoginLoading}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50"
                  >
                    {isLoginLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        Iniciar Sesión
                      </>
                    )}
                  </button>
                  {loginError && (
                    <div className="mt-3 p-2 bg-rose-50 border border-rose-100 rounded-lg">
                      <p className="text-[10px] text-rose-600 leading-tight font-medium">{loginError}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Modos de Operación</h2>
                <div className="space-y-1">
                  <button 
                    onClick={() => handleQuickAction('[EBOOK]')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm text-slate-700"
                  >
                    <Book className="w-4 h-4 text-indigo-500" />
                    Crear Ebook
                  </button>
                  <button 
                    onClick={() => handleQuickAction('[EBOOK PDF]')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm text-slate-700"
                  >
                    <FileText className="w-4 h-4 text-emerald-500" />
                    Ebook desde PDF
                  </button>
                  <button 
                    onClick={() => handleQuickAction('[ACTIVOS]')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm text-slate-700"
                  >
                    <ImageIcon className="w-4 h-4 text-orange-500" />
                    Crear Activos
                  </button>
                  <button 
                    onClick={() => handleQuickAction('[PAQUETE COMPLETO]')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm text-slate-700"
                  >
                    <Package className="w-4 h-4 text-purple-500" />
                    Paquete Completo
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Especialistas</h2>
                <div className="grid grid-cols-1 gap-1">
                  {(Object.entries(ROLES) as [Role, typeof ROLES['DIRECTOR']][]).map(([key, role]) => (
                    <button
                      key={key}
                      onClick={() => setActiveRole(key)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                        activeRole === key 
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <role.icon className={`w-4 h-4 ${activeRole === key ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <div className="font-medium">{role.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {user && sessions.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Historial</h2>
                  <div className="space-y-1">
                    {sessions.map((session) => (
                      <div key={session.id} className="group relative">
                        <button
                          onClick={() => loadSession(session.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-xs truncate transition-all pr-10 ${
                            currentSessionId === session.id
                              ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 shadow-sm'
                              : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <History className={`w-3 h-3 ${currentSessionId === session.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                            <span className="truncate">{session.title || 'Conversación sin título'}</span>
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(session.id);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Eliminar conversación"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {user && (
              <div className="p-4 border-t border-slate-100">
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 mb-2">
                  <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-white shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{user.displayName}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-600 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:bg-red-50"
                >
                  <LogOut className="w-3 h-3" />
                  Cerrar Sesión
                </button>
              </div>
            )}
            <div className="p-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                <span>v1.0.3-stable</span>
                <span>© 2026 Agencia Pro</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="flex flex-col">
              <h2 className="font-bold text-sm text-slate-800 truncate max-w-[100px] sm:max-w-[300px]">
                {user && currentSessionId 
                  ? sessions.find(s => s.id === currentSessionId)?.title || 'Conversación'
                  : 'Nueva Conversación'}
              </h2>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Agencia Activa</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={handleNewChat}
              className="md:hidden flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-sm"
            >
              <Plus className="w-3 h-3" />
              Nuevo
            </button>
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Especialista</span>
              <span className="text-xs font-bold text-indigo-600 leading-none">{ROLES[activeRole].label}</span>
            </div>
            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl shadow-sm border border-indigo-100/50">
              {(() => {
                const Icon = ROLES[activeRole].icon;
                return Icon ? <Icon className="w-4 h-4" /> : null;
              })()}
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
              <div className="relative">
                <div className="absolute -inset-4 bg-indigo-100 rounded-full blur-2xl opacity-50 animate-pulse" />
                <div className="relative bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
                  <Sparkles className="w-12 h-12 text-indigo-600" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">¿Qué vamos a construir hoy?</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Tu equipo de especialistas está listo. Describe tu idea, sube un PDF o usa los comandos rápidos para empezar a monetizar.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-left">
                  <Book className="w-5 h-5 text-indigo-500 mb-2" />
                  <p className="text-xs font-bold text-slate-800 mb-1">Ebooks</p>
                  <p className="text-[10px] text-slate-500">Crea productos digitales de alta conversión.</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-left">
                  <ImageIcon className="w-5 h-5 text-orange-500 mb-2" />
                  <p className="text-xs font-bold text-slate-800 mb-1">Activos</p>
                  <p className="text-[10px] text-slate-500">Genera contenido visual para tus redes.</p>
                </div>
              </div>
              <button 
                onClick={handleNewChat}
                className="flex items-center gap-2 text-indigo-600 font-bold text-xs hover:underline"
              >
                <Plus className="w-3 h-3" />
                Empezar un chat limpio
              </button>
            </div>
          )}
          {messages.map((msg, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'order-2' : ''}`}>
                <div className={`flex items-center gap-2 mb-1.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {msg.role === 'user' ? 'Cliente' : (msg.roleLabel || ROLES[activeRole].label)}
                  </span>
                </div>
                <div className={`rounded-2xl p-4 md:p-6 shadow-sm border ${
                  msg.role === 'user' 
                    ? 'bg-indigo-700 text-white border-indigo-600' 
                    : 'bg-white text-slate-900 border-slate-100'
                }`}>
                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                    {msg.hasFile && (
                      <div className="flex items-center gap-2 mb-3 p-2 bg-indigo-500/20 rounded-lg border border-indigo-400/30">
                        <FileText className="w-4 h-4" />
                        <span className="text-xs font-medium">Archivo PDF adjunto</span>
                      </div>
                    )}
                    <ReactMarkdown 
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-4" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-6 mb-3 border-b pb-1" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base font-bold mt-4 mb-2" {...props} />,
                        p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        code: ({node, ...props}) => <code className="bg-slate-100 text-indigo-600 px-1 rounded" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 pl-4 italic my-4" {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
                
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-2">
                    <button 
                      onClick={() => handleCopy(msg.content, idx)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all flex items-center gap-1"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-600">Copiado</span>
                        </>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="flex gap-1">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-1.5 h-1.5 bg-indigo-400 rounded-full" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="w-1.5 h-1.5 bg-indigo-500 rounded-full" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="w-1.5 h-1.5 bg-indigo-600 rounded-full" 
                  />
                </div>
                <span className="text-xs font-medium text-slate-400 italic">El equipo está trabajando...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto relative">
            <AnimatePresence>
              {selectedFile && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-1.5 rounded-lg">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-500">Listo para analizar</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="p-1 hover:bg-indigo-100 rounded-full text-indigo-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2 no-scrollbar">
              <button 
                onClick={() => handleQuickAction('[EBOOK]')}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs font-medium transition-all border border-transparent hover:border-indigo-100"
              >
                📚 Nuevo Ebook
              </button>
              <button 
                onClick={() => handleQuickAction('[ACTIVOS]')}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-orange-600 text-xs font-medium transition-all border border-transparent hover:border-orange-100"
              >
                📸 Crear Activos
              </button>
              <button 
                onClick={() => handleQuickAction('[PAQUETE COMPLETO]')}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-600 text-xs font-medium transition-all border border-transparent hover:border-purple-100"
              >
                📦 Lanzamiento
              </button>
              <button 
                onClick={() => handleQuickAction('¿Cómo puedo monetizar mi idea?')}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 text-xs font-medium transition-all border border-transparent hover:border-emerald-100"
              >
                💰 Monetizar Idea
              </button>
            </div>

            <div className="relative group">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="application/pdf"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-3 bottom-3 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                title="Subir PDF"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Describe tu idea o sube un PDF para analizar..."
                className="w-full bg-white border border-slate-300 rounded-2xl px-12 py-4 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none min-h-[60px] max-h-[200px] text-sm text-black font-medium"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !selectedFile) || isLoading}
                className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all ${
                  (input.trim() || selectedFile) && !isLoading 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Presiona Enter para enviar. Puedes adjuntar un PDF usando el clip.
            </p>
          </div>
        </div>
      </main>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-10 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {sessionToDelete && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSessionToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full relative z-10 border border-slate-100"
            >
              <div className="bg-rose-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">¿Eliminar conversación?</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Esta acción no se puede deshacer. Se borrarán todos los mensajes de esta sesión de forma permanente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSessionToDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteSession(sessionToDelete)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

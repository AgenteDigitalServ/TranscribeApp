
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Mic, ArrowLeft, Save, FileText, Trash2, StopCircle, 
  Loader2, Tag, X, Sparkles, Search, Copy, Check, Clock, Download, Play, Pause,
  History, Upload, FileAudio, LayoutDashboard, Briefcase
} from 'lucide-react';
import jsPDF from 'jspdf';
import { AppView, Note, ProcessingStatus, SummaryFormat } from './types';
import { transcribeAudio, summarizeText } from './services/ai';
import { saveAudioLocal, getAudioLocal, deleteAudioLocal } from './services/storage';
import { Button } from './components/Button';
import { NoteCard } from './components/NoteCard';
import { Waveform } from './components/Waveform';

const Logo = () => (
  <div className="flex items-center gap-3">
    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
      <Briefcase className="w-6 h-6 text-white" />
    </div>
    <div className="flex flex-col -space-y-1">
      <span className="text-xl font-black tracking-tighter text-white">Transcribe<span className="text-blue-400">App</span></span>
      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Inteligência Executiva</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LIST);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>(SummaryFormat.EXECUTIVE);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wakeLockRef = useRef<any>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const saved = localStorage.getItem('transcribeapp_data');
      if (saved) {
        try {
          const parsedNotes: Note[] = JSON.parse(saved);
          const notesWithAudio = await Promise.all(parsedNotes.map(async (note) => {
            const blob = await getAudioLocal(note.id);
            return blob ? { ...note, audioUrl: URL.createObjectURL(blob) } : note;
          }));
          setNotes(notesWithAudio);
        } catch (e) { console.error(e); }
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const notesToSave = notes.map(({ audioUrl, ...rest }) => rest);
    localStorage.setItem('transcribeapp_data', JSON.stringify(notesToSave));
  }, [notes]);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (e) {}
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Seu navegador não suporta gravação de áudio ou a conexão não é segura (HTTPS).");
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      alert("Seu navegador não suporta a API de gravação (MediaRecorder).");
      return;
    }

    try {
      await requestWakeLock();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      setActiveStream(stream);
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/ogg') 
          ? 'audio/ogg' 
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000 
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);
      setView(AppView.RECORD);
      timerRef.current = window.setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch (err: any) { 
      console.error("Erro ao iniciar gravação:", err);
      alert(`Erro ao acessar microfone: ${err.message || "Permissão negada"}`); 
      releaseWakeLock(); 
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await processAudio(audioBlob, URL.createObjectURL(audioBlob), recordingDuration);
      };
      cleanupRecording();
    }
  };

  const cleanupRecording = () => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    setActiveStream(null);
    setIsRecording(false);
    releaseWakeLock();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const audioUrl = URL.createObjectURL(file);
      // Estima duração baseada no tamanho se não puder ler metadados instantaneamente
      await processAudio(file, audioUrl, 0);
    }
  };

  const processAudio = async (blob: Blob, audioUrl: string, durationSec: number) => {
    const noteId = Date.now().toString();
    setProcessingStatus(ProcessingStatus.TRANSCRIBING);
    setView(AppView.RECORD); // Mostra progresso
    try {
      await saveAudioLocal(noteId, blob);
      const transcription = await transcribeAudio(blob);
      setProcessingStatus(ProcessingStatus.SUMMARIZING);
      const summary = await summarizeText(transcription, selectedFormat);
      
      const newNote: Note = {
        id: noteId,
        title: fileInputRef.current?.files?.[0]?.name.split('.')[0] || `Análise ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        date: new Date().toLocaleDateString('pt-BR'),
        durationFormatted: durationSec > 0 ? formatTime(durationSec) : "Importado",
        transcription,
        summary,
        format: selectedFormat,
        tags: [],
        audioUrl
      };
      
      setActiveNote(newNote);
      setView(AppView.EDIT);
    } catch (error: any) {
      alert(`Falha no processamento: ${error.message}`);
      setView(AppView.LIST);
    } finally {
      setProcessingStatus(ProcessingStatus.IDLE);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteNote = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Excluir esta nota e áudio?")) {
      await deleteAudioLocal(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      if (activeNote?.id === id) setView(AppView.LIST);
    }
  };

  const saveNote = () => {
    if (!activeNote) return;
    setNotes(prev => {
      const exists = prev.find(n => n.id === activeNote.id);
      return exists ? prev.map(n => n.id === activeNote.id ? activeNote : n) : [activeNote, ...prev];
    });
    setView(AppView.LIST);
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (view === AppView.RECORD) {
    return (
      <div className="h-full bg-slate-950 flex flex-col items-center justify-center p-8 safe-top safe-bottom relative overflow-hidden">
        {processingStatus === ProcessingStatus.IDLE && (
          <button onClick={() => setView(AppView.LIST)} className="absolute top-10 left-8 p-4 bg-slate-900/50 rounded-2xl text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
        )}

        <div className="w-full max-w-md flex flex-col items-center gap-10">
          {processingStatus !== ProcessingStatus.IDLE ? (
            <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
                <Loader2 className="w-24 h-24 text-blue-400 animate-spin relative z-10" />
              </div>
              <div className="space-y-4 text-center">
                <p className="text-3xl font-black text-white">Processando...</p>
                <div className="bg-slate-900/50 px-6 py-2 rounded-full border border-blue-500/20">
                  <p className="text-blue-400 font-bold uppercase text-xs tracking-widest">
                    {processingStatus === ProcessingStatus.TRANSCRIBING ? "Inteligência Transcrevendo" : "Gerando Formato Escolhido"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full animate-pulse scale-[1.8]" />
                <div className="w-64 h-64 rounded-full bg-slate-900/30 border-[6px] border-red-500/10 flex items-center justify-center relative z-10">
                   <Mic className="w-24 h-24 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-8 w-full">
                <div className="space-y-2">
                  <span className="text-8xl font-mono font-black text-white tracking-tighter tabular-nums block">{formatTime(recordingDuration)}</span>
                  <p className="text-red-500 font-black uppercase tracking-[0.4em] text-center text-[10px]">Gravando</p>
                </div>
                <div className="w-full max-w-[300px] h-20 bg-slate-900/20 rounded-2xl p-2 border border-white/5 overflow-hidden">
                  <Waveform isRecording={isRecording} stream={activeStream} />
                </div>
                <button onClick={stopRecording} className="mt-6 w-full h-20 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-[28px] font-black text-xl flex items-center justify-center gap-4 shadow-2xl active:scale-95 group">
                  <StopCircle className="w-7 h-7" /> Parar e Processar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (view === AppView.EDIT && activeNote) {
    return (
      <div className="h-full bg-slate-950 flex flex-col safe-top safe-bottom">
        <header className="px-4 py-6 flex items-center gap-4 border-b border-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <button onClick={() => setView(AppView.LIST)} className="p-3 bg-slate-900 rounded-xl text-slate-400"><ArrowLeft className="w-5 h-5" /></button>
          <input value={activeNote.title} onChange={e => setActiveNote({...activeNote, title: e.target.value})} className="flex-1 bg-transparent border-none text-xl font-black outline-none text-white focus:ring-2 focus:ring-blue-500/10 rounded-lg px-2" />
          <button onClick={() => deleteNote(activeNote.id)} className="p-3 text-slate-600 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-40 scrollbar-hide">
          {activeNote.audioUrl && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center gap-5">
              <button onClick={() => { if(audioRef.current) isPlaying ? audioRef.current.pause() : audioRef.current.play(); setIsPlaying(!isPlaying); }} className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 fill-current ml-1" />}
              </button>
              <div className="flex-1">
                <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Playback de Áudio</div>
                <div className="text-base font-bold text-slate-100">{activeNote.durationFormatted}</div>
              </div>
              <audio ref={audioRef} src={activeNote.audioUrl} onEnded={() => setIsPlaying(false)} hidden />
            </div>
          )}

          <div className="bg-slate-900/40 p-6 rounded-[32px] border border-slate-800/50 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h3 className="text-slate-100 text-sm font-bold">{activeNote.format === SummaryFormat.EXECUTIVE ? 'Resumo Executivo' : 'Ata de Reunião Formal'}</h3>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(activeNote.summary); setCopiedSection('s'); setTimeout(() => setCopiedSection(null), 2000); }} className="text-slate-500 p-2 bg-slate-800 rounded-lg">
                {copiedSection === 's' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <textarea value={activeNote.summary} onChange={e => setActiveNote({...activeNote, summary: e.target.value})} className="w-full h-80 bg-transparent text-slate-300 leading-relaxed outline-none resize-none text-sm font-medium scrollbar-hide" />
          </div>

          <div className="bg-slate-900/20 p-6 rounded-[32px] border border-slate-900 space-y-5">
            <div className="flex items-center justify-between">
               <h3 className="text-slate-400 text-sm font-bold">Transcrição Bruta</h3>
               <button onClick={() => { navigator.clipboard.writeText(activeNote.transcription); setCopiedSection('t'); setTimeout(() => setCopiedSection(null), 2000); }} className="text-slate-500">
                {copiedSection === 't' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
               </button>
            </div>
            <textarea value={activeNote.transcription} onChange={e => setActiveNote({...activeNote, transcription: e.target.value})} className="w-full h-64 bg-transparent text-slate-500 text-xs leading-relaxed outline-none resize-none italic" />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent flex gap-3 safe-bottom z-50">
          <Button variant="primary" onClick={saveNote} className="w-full bg-blue-600 py-5 rounded-2xl shadow-xl shadow-blue-500/20 text-lg font-black">
            <Save className="w-5 h-5" /> Salvar Projeto
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-950 flex flex-col overflow-hidden safe-top safe-bottom">
      <header className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Logo />
          <div className="flex items-center gap-3">
             <button className="p-3 bg-slate-900/50 rounded-2xl text-slate-400"><History className="w-5 h-5" /></button>
             <div className="w-11 h-11 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 font-bold border border-slate-700">AD</div>
          </div>
        </div>

        {/* Seletor de Formato */}
        <div className="flex p-1.5 bg-slate-900/50 rounded-2xl border border-slate-800">
          <button 
            onClick={() => setSelectedFormat(SummaryFormat.EXECUTIVE)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold text-xs uppercase tracking-widest ${selectedFormat === SummaryFormat.EXECUTIVE ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Resumo Executivo
          </button>
          <button 
            onClick={() => setSelectedFormat(SummaryFormat.MEETING_MINUTES)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold text-xs uppercase tracking-widest ${selectedFormat === SummaryFormat.MEETING_MINUTES ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
          >
            <FileText className="w-4 h-4" /> Ata de Reunião
          </button>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
          <input placeholder="Pesquisar análises..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-900/40 border border-slate-800/50 rounded-[20px] py-4.5 pl-12 pr-4 text-sm focus:border-blue-500/30 outline-none transition-all text-white backdrop-blur-sm" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-36 scrollbar-hide">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-slate-600 text-center gap-6">
            <div className="p-10 bg-slate-900/30 rounded-[40px] border border-slate-800/50">
              <FileAudio className="w-14 h-14 text-slate-700" />
            </div>
            <p className="text-sm leading-relaxed text-slate-500 font-medium">Grave ou anexe um áudio para gerar<br/>sua ata ou resumo inteligente.</p>
          </div>
        ) : (
          filteredNotes.map(note => (
            <NoteCard key={note.id} note={note} onClick={() => { setActiveNote(note); setView(AppView.EDIT); }} onDelete={(e) => deleteNote(note.id, e)} />
          ))
        )}
      </div>

      <div className="fixed bottom-10 right-8 flex flex-col gap-4 z-50">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="audio/*" 
          className="hidden" 
          aria-hidden="true"
        />
        <button 
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.click();
            } else {
              alert("Erro ao carregar seletor de arquivos.");
            }
          }}
          className="h-16 w-16 bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center text-slate-300 active:scale-90 border border-slate-700 transition-all"
        >
          <Upload className="w-7 h-7" />
        </button>
        <button 
          onClick={startRecording}
          className="h-20 w-20 bg-gradient-to-br from-blue-400 to-blue-700 rounded-[24px] shadow-2xl shadow-blue-500/40 flex items-center justify-center text-white active:scale-90 transition-all"
        >
          <Plus className="w-10 h-10" />
        </button>
      </div>
    </div>
  );
};

export default App;

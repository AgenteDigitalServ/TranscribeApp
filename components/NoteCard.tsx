
import React from 'react';
import { Clock, ChevronRight, FileAudio, Users, Lightbulb, CheckSquare, Trash2 } from 'lucide-react';
import { Note } from '../types';

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const getNoteIcon = (note: Note) => {
  const text = (note.title + (note.summary || "")).toLowerCase();
  
  if (text.includes('reunião') || text.includes('meet') || text.includes('daily') || text.includes('equipe')) {
    return Users;
  }
  if (text.includes('ideia') || text.includes('brainstorm') || text.includes('pensamento') || text.includes('projeto')) {
    return Lightbulb;
  }
  if (text.includes('tarefa') || text.includes('lista') || text.includes('todo') || text.includes('fazer')) {
    return CheckSquare;
  }
  return FileAudio;
};

export const NoteCard: React.FC<NoteCardProps> = ({ note, onClick, onDelete }) => {
  const Icon = getNoteIcon(note);

  return (
    <div 
      onClick={onClick}
      className="group bg-slate-900/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-800 hover:border-cyan-500/30 hover:bg-slate-800 transition-all duration-300 cursor-pointer shadow-lg shadow-black/20 relative"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3 overflow-hidden pr-8">
          <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-cyan-500/10 transition-colors shrink-0">
            <Icon className="w-5 h-5 text-cyan-500" />
          </div>
          <h3 className="font-bold text-slate-100 text-lg line-clamp-1 group-hover:text-cyan-400 transition-colors">
            {note.title}
          </h3>
        </div>
        <button 
          onClick={onDelete}
          className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all shrink-0"
          title="Excluir gravação"
        >
          <Trash2 className="w-4.5 h-4.5" />
        </button>
      </div>
      
      <div className="flex items-center gap-3 text-xs text-slate-400 mb-3 font-medium pl-1">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          {note.date}
        </span>
        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
          {note.durationFormatted}
        </span>
      </div>

      <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed pl-1">
        {note.summary ? note.summary.replace(/[#*]/g, '') : note.transcription}
      </p>
      
      {note.tags && note.tags.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-hidden pl-1">
          {note.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-md border border-cyan-500/20">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

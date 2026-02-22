
export enum AppView {
  LIST = 'LIST',
  RECORD = 'RECORD',
  EDIT = 'EDIT',
}

export enum SummaryFormat {
  EXECUTIVE = 'EXECUTIVE',
  MEETING_MINUTES = 'MEETING_MINUTES'
}

export interface Note {
  id: string;
  title: string;
  date: string;
  durationFormatted: string;
  transcription: string;
  summary: string;
  format: SummaryFormat;
  tags: string[];
  audioUrl?: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  TRANSCRIBING = 'TRANSCRIBING',
  SUMMARIZING = 'SUMMARIZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

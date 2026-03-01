
import { GoogleGenAI } from "@google/genai";
import { SummaryFormat } from "../types";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    // Recupera a chave injetada pelo Vite
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey || apiKey === "" || apiKey === "undefined") {
      console.error("ERRO: Chave de API não encontrada no ambiente.");
      throw new Error("API Key não configurada. No Vercel, adicione GEMINI_API_KEY nas Environment Variables e faça um novo Deploy.");
    }
    
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = await blobToBase64(audioBlob);
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: base64Data,
            },
          },
          {
            text: "Transcreva este áudio para Português do Brasil. Identifique diferentes falantes e retorne apenas a transcrição fiel do conteúdo.",
          },
        ],
      },
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Erro na transcrição:", error);
    throw new Error(error.message || "Erro ao processar áudio.");
  }
};

export const summarizeText = async (text: string, format: SummaryFormat): Promise<string> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey || apiKey === "" || apiKey === "undefined") {
      throw new Error("API Key não configurada. No Vercel, adicione GEMINI_API_KEY nas Environment Variables e faça um novo Deploy.");
    }
    
    const ai = new GoogleGenAI({ apiKey });

    const prompt = format === SummaryFormat.MEETING_MINUTES 
      ? `Atue como um redator de atas profissional. Transforme a seguinte transcrição em uma ATA DE REUNIÃO FORMAL em Português do Brasil.
         Estrutura obrigatória:
         - Título da Reunião e Data
         - Participantes Identificados
         - Pauta Principal
         - Discussões e Argumentos Principais
         - Deliberações e Decisões
         - Plano de Ação (Quem, o quê e prazo)
         Transcrição: ${text}`
      : `Atue como um consultor executivo. Transforme a seguinte transcrição em um RESUMO EXECUTIVO de alto nível em Português do Brasil.
         Foco em resultados e visão estratégica:
         - Visão Geral (Resumo em 1 parágrafo)
         - Insights e Pontos Críticos
         - Decisões Estratégicas
         - Próximos Passos
         Transcrição: ${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] },
    });

    return response.text || "Não foi possível gerar o resumo.";
  } catch (error: any) {
    console.error("Erro no resumo:", error);
    throw new Error("Erro ao gerar análise da IA.");
  }
};

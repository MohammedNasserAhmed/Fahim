import { GoogleGenAI } from "@google/genai";
import { AnalyzedSection } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes Arabic text to produce structured content and a mind map.
 * Uses gemini-2.5-flash for speed and large context window.
 */
export const analyzeArabicText = async (text: string): Promise<AnalyzedSection> => {
  const modelId = "gemini-2.5-flash"; 

  const prompt = `
    You are an expert Arabic educational consultant. 
    Analyze the following Arabic text extracted from a PDF page. 
    
    Your goal is to:
    1. Clean and structure the original text (fix broken sentences from PDF extraction).
    2. Create a detailed hierarchical Mind Map of the concepts.
    
    CONSTRAINTS:
    - Do NOT summarize. Include ALL details.
    - One node = One specific idea.
    - Preserve the academic integrity.
    - OUTPUT MUST BE VALID JSON.
    
    EXPECTED JSON STRUCTURE:
    {
      "title": "Main title of this section",
      "originalText": "Cleaned, readable version of the original Arabic text...",
      "mindMap": {
        "name": "Central Concept",
        "type": "root",
        "details": "optional details",
        "children": [
           // Nested children nodes with same structure: { "name": "...", "type": "...", "children": [...] }
        ]
      }
    }
    
    TEXT TO ANALYZE:
    ${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const jsonStr = response.text || "{}";
    const data = JSON.parse(jsonStr);

    return {
      id: crypto.randomUUID(),
      title: data.title || "عنوان غير موجود",
      originalText: data.originalText || text,
      mindMap: data.mindMap || { name: "تعذر إنشاء الخريطة", type: "root", children: [] }
    };
  } catch (e) {
    console.error("AI Analysis failed", e);
    return {
      id: crypto.randomUUID(),
      title: "خطأ في المعالجة",
      originalText: text, 
      mindMap: { 
        name: "خطأ في التحليل", 
        type: "root", 
        details: "لم نتمكن من تحليل هذا الجزء. يرجى المحاولة مرة أخرى.",
        children: [] 
      }
    };
  }
};

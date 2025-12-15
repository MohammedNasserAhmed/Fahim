import { GoogleGenAI } from "@google/genai";
import { AnalyzedSection } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Analyzes Arabic text to produce structured content and a mind map.
 * Uses gemini-2.5-flash for speed and large context window.
 * Implements robust retry logic and fallback for failures.
 */
export const analyzeArabicText = async (text: string, attempt = 1): Promise<AnalyzedSection> => {
  const modelId = "gemini-2.5-flash"; 
  const MAX_RETRIES = 5;

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
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (parseError) {
        throw new Error("Invalid JSON received from model");
    }

    return {
      id: crypto.randomUUID(),
      title: data.title || "عنوان غير موجود",
      originalText: data.originalText || text,
      mindMap: data.mindMap || { name: "تعذر إنشاء الخريطة", type: "root", children: [] }
    };
  } catch (e: any) {
    console.warn(`Analysis attempt ${attempt} failed:`, e);
    
    if (attempt < MAX_RETRIES) {
      // Progressive backoff: 2s, 4s, 6s... + jitter
      const backoffTime = 2000 * attempt + (Math.random() * 500); 
      await delay(backoffTime);
      return analyzeArabicText(text, attempt + 1);
    }
    
    // If all retries fail, return a fallback object instead of throwing.
    // This ensures the application continues processing other pages.
    console.error("All analysis attempts failed. Returning fallback content.");
    
    return {
      id: crypto.randomUUID(),
      title: "فشل التحليل الآلي",
      originalText: text, // Preserve the original text so the user doesn't lose data
      mindMap: {
        name: "فشل المعالجة",
        type: "root",
        details: "حدث خطأ أثناء تحليل هذه الصفحة. النص الأصلي متاح للقراءة.",
        children: [
            {
                name: "النص محفوظ",
                type: "main",
                details: "يمكنك مراجعة النص الكامل في القسم الأيمن.",
                children: []
            },
            {
                name: "تفاصيل الخطأ",
                type: "sub",
                details: e.message || "خطأ في الاتصال بالذكاء الاصطناعي",
                children: []
            }
        ]
      }
    };
  }
};
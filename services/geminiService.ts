import { GoogleGenAI } from "@google/genai";
import { AnalyzedSection } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes Arabic text to produce structured content and a mind map.
 * Uses gemini-2.5-flash for speed and large context window.
 */
export const analyzeArabicText = async (text: string): Promise<AnalyzedSection> => {
  const modelId = "gemini-2.5-flash"; // Optimized for text processing

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
        // Recursive schema definition removed as it causes INVALID_ARGUMENT in strict mode. 
        // We rely on the prompt and responseMimeType for JSON structure.
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
    // Return structured error/fallback to allow UI to render something
    return {
      id: crypto.randomUUID(),
      title: "خطأ في المعالجة",
      originalText: text, // Return raw text so user doesn't lose data
      mindMap: { 
        name: "خطأ في التحليل", 
        type: "root", 
        details: "لم نتمكن من تحليل هذا الجزء. يرجى المحاولة مرة أخرى.",
        children: [] 
      }
    };
  }
};

/**
 * Generates an educational illustration using Gemini 2.5 Flash Image.
 * Supports the "Nano banana" requirement for image generation.
 */
export const generateConceptImage = async (concept: string, context: string): Promise<string> => {
  // Using gemini-2.5-flash-image (often aliased, using specific model name)
  const modelId = "gemini-2.5-flash-image"; 
  
  const prompt = `Create a clear, educational illustration explaining the concept: "${concept}". 
  Context: ${context}. 
  Style: Clean, flat vector art, suitable for an Arabic textbook.`;

  try {
     const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
     });

    // Check for image in response parts
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    
    // If no image found (or model refused), return a placeholder or handle error
    return "https://picsum.photos/400/300";

  } catch (error) {
    console.error("Image generation failed", error);
    // Fallback
    return "https://picsum.photos/400/300?error=true";
  }
};

/**
 * Edits an existing image using Gemini 2.5 Flash Image.
 * Fulfills the "Nano banana powered app" requirement.
 */
export const editConceptImage = async (base64Image: string, editPrompt: string): Promise<string> => {
  const modelId = "gemini-2.5-flash-image";

  // Strip prefix if present
  const base64Data = base64Image.split(',')[1] || base64Image;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/png", // Assuming PNG or standard image
            data: base64Data
          }
        },
        { text: editPrompt }
      ]
    }
  });

   if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("No image returned from edit operation.");
};
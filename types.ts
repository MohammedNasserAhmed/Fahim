export interface MindMapNode {
  name: string;
  type: 'root' | 'main' | 'sub' | 'detail';
  children?: MindMapNode[];
  details?: string;
}

export interface AnalyzedSection {
  id: string;
  title: string;
  originalText: string;
  mindMap: MindMapNode;
}

export interface ProcessingStatus {
  page: number;
  total: number;
  status: 'idle' | 'extracting' | 'analyzing' | 'complete' | 'error';
  message: string;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  relatedConcept: string;
}

// For PDF.js
declare global {
  const pdfjsLib: any;
}

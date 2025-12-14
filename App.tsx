import React, { useState, useCallback } from 'react';
import { Upload, BookOpen, Share2, Download, AlertCircle, FileText, BrainCircuit, Image as ImageIcon } from 'lucide-react';
import { extractTextFromPDF } from './services/pdfService';
import { analyzeArabicText, generateConceptImage } from './services/geminiService';
import MindMapVisualizer from './components/MindMapVisualizer';
import ImageEditor from './components/ImageEditor';
import { AnalyzedSection, ProcessingStatus, MindMapNode } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>({ page: 0, total: 0, status: 'idle', message: '' });
  const [sections, setSections] = useState<AnalyzedSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  
  // Image Generation/Editing State
  const [selectedNodeForImage, setSelectedNodeForImage] = useState<{name: string, context: string} | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('الرجاء تحميل ملف PDF فقط');
      return;
    }

    // Reset state
    setSections([]);
    setSelectedSectionId(null);

    try {
      setStatus({ page: 0, total: 0, status: 'extracting', message: 'جاري استخراج النصوص...' });
      const pages = await extractTextFromPDF(file);
      
      setStatus({ page: 0, total: pages.length, status: 'analyzing', message: 'جاري تحليل المحتوى وبناء الخرائط...' });
      
      const newSections: AnalyzedSection[] = [];
      
      // Process pages sequentially to maintain order and avoid rate limits
      for (let i = 0; i < pages.length; i++) {
        setStatus(prev => ({ ...prev, page: i + 1, message: `جاري معالجة الصفحة ${i + 1} من ${pages.length}...` }));
        
        // Skip empty pages
        if (pages[i].trim().length < 50) continue;

        try {
          const result = await analyzeArabicText(pages[i]);
          newSections.push(result);
          // Update partial results
          setSections([...newSections]);
          
          // Select first section automatically if not selected
          if (!selectedSectionId && newSections.length === 1) {
            setSelectedSectionId(result.id);
          }
        } catch (err) {
          console.error(`Error processing page ${i + 1}`, err);
          // Continue to next page even if one fails
        }
      }

      setStatus({ page: pages.length, total: pages.length, status: 'complete', message: 'تمت المعالجة بنجاح!' });

    } catch (error) {
      console.error(error);
      setStatus({ page: 0, total: 0, status: 'error', message: 'حدث خطأ أثناء معالجة الملف.' });
    }
  };

  const handleGenerateImage = async (node: MindMapNode) => {
    // Open image generator for this node
    setSelectedNodeForImage({ name: node.name, context: node.details || node.name });
    setGeneratedImageUrl(null);
    setIsGeneratingImage(true);
    
    // Auto-generate first time
    try {
        const url = await generateConceptImage(node.name, node.details || "");
        setGeneratedImageUrl(url);
    } catch (e) {
        console.error("Auto gen failed", e);
    } finally {
        setIsGeneratingImage(false);
    }
  };

  const currentSection = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-slate-800 tracking-tight">فهيم | Fahim</h1>
              <p className="text-xs text-slate-500">محول الخرائط الذهنية الذكي</p>
            </div>
          </div>
          
          <div className="flex gap-2">
             <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                مشاركة
             </button>
             <button className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 shadow-sm transition-colors">
                <Download className="w-4 h-4" />
                تصدير PDF
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 gap-6 grid grid-cols-1 lg:grid-cols-12">
        
        {/* Sidebar / Navigation */}
        <div className="lg:col-span-3 space-y-4">
          {/* Upload Box */}
          <div className="bg-white p-6 rounded-xl border border-dashed border-blue-200 shadow-sm text-center transition-all hover:border-blue-400">
             <input 
                type="file" 
                id="pdf-upload" 
                className="hidden" 
                accept="application/pdf"
                onChange={handleFileUpload}
                disabled={status.status === 'extracting' || status.status === 'analyzing'}
             />
             <label htmlFor="pdf-upload" className="cursor-pointer block">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-700 mb-1">رفع ملف PDF</h3>
                <p className="text-sm text-slate-500 mb-2">يدعم اللغة العربية بالكامل</p>
                {status.status === 'idle' && (
                    <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-600">اضغط للاختيار</span>
                )}
             </label>
          </div>

          {/* Status Indicator */}
          {status.status !== 'idle' && (
            <div className={`p-4 rounded-lg border text-sm ${
                status.status === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
               <div className="flex items-center gap-2 mb-2">
                  {status.status === 'error' ? <AlertCircle className="w-4 h-4"/> : <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>}
                  <span className="font-bold">{status.message}</span>
               </div>
               {status.total > 0 && (
                 <div className="w-full bg-white/50 rounded-full h-1.5 mt-2">
                    <div 
                        className="bg-current h-1.5 rounded-full transition-all duration-500" 
                        style={{ width: `${(status.page / status.total) * 100}%` }}
                    />
                 </div>
               )}
            </div>
          )}

          {/* Section List */}
          {sections.length > 0 && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    فهرس المحتوى
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                    {sections.map((section, idx) => (
                        <button
                            key={section.id}
                            onClick={() => setSelectedSectionId(section.id)}
                            className={`w-full text-right p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors text-sm flex items-start gap-3 ${
                                selectedSectionId === section.id ? 'bg-blue-50 text-blue-700 border-r-4 border-r-blue-600' : 'text-slate-600'
                            }`}
                        >
                            <span className="bg-slate-200 text-slate-600 text-xs w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 mt-0.5">
                                {idx + 1}
                            </span>
                            <span className="line-clamp-2">{section.title}</span>
                        </button>
                    ))}
                </div>
             </div>
          )}
        </div>

        {/* Main Workspace */}
        <div className="lg:col-span-9 space-y-6">
          {currentSection ? (
            <>
                <div className="flex items-center justify-between">
                     <h2 className="text-2xl font-bold text-slate-800 font-amiri leading-relaxed">
                        {currentSection.title}
                     </h2>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Text Column */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                         <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                             <FileText className="w-5 h-5 text-blue-600" />
                             <h3 className="font-bold text-slate-700">النص الأصلي (المنظم)</h3>
                         </div>
                         <div className="prose prose-lg max-w-none font-amiri text-slate-700 leading-loose text-justify whitespace-pre-line">
                             {currentSection.originalText}
                         </div>
                    </div>

                    {/* Mind Map Column */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                             <div className="p-4 flex items-center justify-between border-b border-slate-100 mb-2">
                                <div className="flex items-center gap-2">
                                    <BrainCircuit className="w-5 h-5 text-purple-600" />
                                    <h3 className="font-bold text-slate-700">الخريطة الذهنية</h3>
                                </div>
                                <span className="text-xs text-slate-400">انقر على زر الصورة بجانب العقدة لتوليد رسم توضيحي</span>
                             </div>
                             <MindMapVisualizer 
                                data={currentSection.mindMap} 
                                onGenerateImage={handleGenerateImage}
                             />
                        </div>
                    </div>
                </div>
            </>
          ) : (
            // Empty State
            <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
               <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                   <BookOpen className="w-8 h-8 text-slate-300" />
               </div>
               <p className="text-lg font-medium">ابدأ برفع ملف PDF لعرض المحتوى</p>
            </div>
          )}
        </div>
      </main>

      {/* Image Generator / Editor Modal */}
      {selectedNodeForImage && (
          <ImageEditor 
            conceptName={selectedNodeForImage.name}
            imageUrl={generatedImageUrl || "https://picsum.photos/400/300?blur"}
            onClose={() => setSelectedNodeForImage(null)}
            onUpdateImage={(url) => setGeneratedImageUrl(url)}
          />
      )}
    </div>
  );
};

export default App;

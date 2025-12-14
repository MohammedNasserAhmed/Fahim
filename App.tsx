import React, { useState, useEffect } from 'react';
import { Upload, BookOpen, Share2, Download, AlertCircle, FileText, BrainCircuit, Loader2, XCircle, CheckCircle } from 'lucide-react';
import { extractTextFromPDF } from './services/pdfService';
import { analyzeArabicText } from './services/geminiService';
import { generatePDF, PDFExportAction } from './services/pdfExportService';
import MindMapVisualizer from './components/MindMapVisualizer';
import PdfExportTemplate from './components/PdfExportTemplate';
import ShareModal from './components/ShareModal';
import { AnalyzedSection, ProcessingStatus, ExportState } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>({ page: 0, total: 0, status: 'idle', message: '' });
  const [sections, setSections] = useState<AnalyzedSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  
  // Export/Processing State
  const [exportState, setExportState] = useState<ExportState>({
    isActive: false,
    status: 'initializing',
    progress: 0,
    detail: ''
  });

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('الرجاء تحميل ملف PDF فقط');
      return;
    }

    setSections([]);
    setSelectedSectionId(null);

    try {
      setStatus({ page: 0, total: 0, status: 'extracting', message: 'جاري استخراج النصوص...' });
      const pages = await extractTextFromPDF(file);
      
      setStatus({ page: 0, total: pages.length, status: 'analyzing', message: 'جاري تحليل المحتوى وبناء الخرائط...' });
      
      const newSections: AnalyzedSection[] = [];
      
      for (let i = 0; i < pages.length; i++) {
        setStatus(prev => ({ ...prev, page: i + 1, message: `جاري معالجة الصفحة ${i + 1} من ${pages.length}...` }));
        
        if (pages[i].trim().length < 50) continue;

        try {
          const result = await analyzeArabicText(pages[i]);
          newSections.push(result);
          setSections([...newSections]);
          
          if (!selectedSectionId && newSections.length === 1) {
            setSelectedSectionId(result.id);
          }
        } catch (err) {
          console.error(`Error processing page ${i + 1}`, err);
        }
      }

      setStatus({ page: pages.length, total: pages.length, status: 'complete', message: 'تمت المعالجة بنجاح!' });

    } catch (error) {
      console.error(error);
      setStatus({ page: 0, total: 0, status: 'error', message: 'حدث خطأ أثناء معالجة الملف.' });
    }
  };

  /**
   * Unified handler for PDF generation (Download or Share)
   */
  const executePdfAction = async (action: PDFExportAction) => {
    if (sections.length === 0) return;
    
    // Close share modal if open to show progress
    if (action === 'blob') {
      setIsShareModalOpen(false);
    }

    // 1. Initial State
    setExportState({
      isActive: true,
      status: 'initializing',
      progress: 0,
      detail: 'تحضير القوالب...'
    });

    // 2. Wait for React to mount the hidden template
    await new Promise(r => setTimeout(r, 1500));

    try {
      // 3. Start Generation Service
      setExportState(prev => ({ ...prev, status: 'rendering', detail: 'بدء عملية المعالجة...' }));
      
      const result = await generatePDF(
        'pdf-export-container',
        'fahim-summary.pdf',
        (detail, progress) => {
           setExportState(prev => ({
             ...prev,
             progress,
             detail
           }));
        },
        action
      );

      // 4. Handle Result based on Action
      if (action === 'blob' && result instanceof Blob) {
         setExportState(prev => ({ ...prev, status: 'finalizing', detail: 'جاري فتح نافذة المشاركة...', progress: 100 }));
         
         if (navigator.share) {
             const file = new File([result], 'fahim-summary.pdf', { type: 'application/pdf' });
             try {
                await navigator.share({
                    files: [file],
                    title: 'ملخص فهيم',
                    text: 'إليك ملخص PDF من منصة فهيم.'
                });
             } catch (shareError) {
                 if ((shareError as Error).name !== 'AbortError') {
                     alert('عذراً، المتصفح لا يدعم مشاركة الملفات مباشرة. سيتم تنزيل الملف بدلاً من ذلك.');
                     const url = URL.createObjectURL(result);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = 'fahim-summary.pdf';
                     a.click();
                 }
             }
         } else {
             alert('المتصفح لا يدعم مشاركة الملفات. سيتم تنزيل الملف.');
             const url = URL.createObjectURL(result);
             const a = document.createElement('a');
             a.href = url;
             a.download = 'fahim-summary.pdf';
             a.click();
         }
      }

      // 5. Success cleanup
      setExportState(prev => ({ ...prev, status: 'complete', detail: 'تمت العملية!', progress: 100 }));
      
      setTimeout(() => {
        setExportState(prev => ({ ...prev, isActive: false }));
      }, 1500);

    } catch (error: any) {
      console.error("Export failed", error);
      setExportState(prev => ({ 
        ...prev, 
        status: 'error', 
        detail: `فشل العملية: ${error.message || 'خطأ غير معروف'}` 
      }));
    }
  };

  const closeExportModal = () => {
    setExportState(prev => ({ ...prev, isActive: false }));
  };

  const currentSection = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111111] font-sans" dir="rtl">
      
      <ShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)}
        onSharePDF={() => executePdfAction('blob')}
        sections={sections}
      />

      {/* --- Export Overlay / Modal --- */}
      {exportState.isActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full border border-[#E65100]">
              <div className="text-center mb-6">
                 {exportState.status === 'error' ? (
                   <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                 ) : exportState.status === 'complete' ? (
                   <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3 animate-in zoom-in" />
                 ) : (
                   <Loader2 className="w-12 h-12 text-[#E65100] mx-auto mb-3 animate-spin" />
                 )}
                 <h3 className="text-xl font-bold mb-1">
                   {exportState.status === 'error' ? 'حدث خطأ' : 
                    exportState.status === 'complete' ? 'اكتملت العملية' :
                    'جاري المعالجة'}
                 </h3>
                 <p className="text-sm text-gray-500">{exportState.detail}</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-3 mb-4 overflow-hidden">
                 <div 
                   className={`h-full transition-all duration-300 ${
                     exportState.status === 'error' ? 'bg-red-500' : 
                     exportState.status === 'complete' ? 'bg-green-600' :
                     'bg-[#E65100]'
                   }`}
                   style={{ width: `${exportState.progress}%` }}
                 />
              </div>

              {exportState.status === 'error' && (
                <button 
                  onClick={closeExportModal}
                  className="w-full py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-gray-700"
                >
                  إغلاق
                </button>
              )}
           </div>
        </div>
      )}

      {/* Hidden Export Template - Always rendered when active to capture DOM */}
      {exportState.isActive && (
        <PdfExportTemplate sections={sections} />
      )}

      {/* Header */}
      <header className="bg-white border-b-2 border-[#111111] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#E65100] p-2 text-white">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-[#111111] tracking-tight">فهيم | Fahim</h1>
              <p className="text-xs text-[#111111] opacity-70">محول الخرائط الذهنية الذكي</p>
            </div>
          </div>
          
          <div className="flex gap-2">
             <button 
               onClick={() => setIsShareModalOpen(true)}
               disabled={sections.length === 0 || exportState.isActive}
               className="px-4 py-2 text-sm font-bold text-[#111111] hover:bg-slate-100 border border-[#111111] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <Share2 className="w-4 h-4" />
                مشاركة
             </button>
             <button 
                onClick={() => executePdfAction('download')}
                disabled={sections.length === 0 || exportState.isActive}
                className="px-4 py-2 text-sm font-bold bg-[#E65100] hover:opacity-90 text-white flex items-center gap-2 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
             >
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
          <div className="bg-white p-6 border-2 border-dashed border-[#111111] text-center hover:bg-slate-50 transition-colors">
             <input 
                type="file" 
                id="pdf-upload" 
                className="hidden" 
                accept="application/pdf"
                onChange={handleFileUpload}
                disabled={status.status === 'extracting' || status.status === 'analyzing'}
             />
             <label htmlFor="pdf-upload" className="cursor-pointer block">
                <div className="w-12 h-12 bg-[#111111] text-white rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-[#111111] mb-1">رفع ملف PDF</h3>
                <p className="text-sm text-[#111111] opacity-70 mb-2">يدعم اللغة العربية بالكامل</p>
                {status.status === 'idle' && (
                    <span className="text-xs px-2 py-1 bg-[#111111] text-white rounded">اضغط للاختيار</span>
                )}
             </label>
          </div>

          {/* Status Indicator */}
          {status.status !== 'idle' && (
            <div className={`p-4 border-2 text-sm transition-colors duration-300 ${
                status.status === 'error' ? 'bg-red-50 border-red-600 text-red-700' : 
                status.status === 'complete' ? 'bg-green-50 border-green-600 text-green-800' :
                'bg-white border-[#E65100] text-[#111111]'
            }`}>
               <div className="flex items-center gap-2 mb-2">
                  {status.status === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0"/>}
                  {status.status === 'complete' && <CheckCircle className="w-5 h-5 flex-shrink-0"/>}
                  {(status.status === 'extracting' || status.status === 'analyzing') && (
                    <div className="w-5 h-5 border-2 border-[#E65100] border-t-transparent rounded-full animate-spin flex-shrink-0"/>
                  )}
                  
                  <span className="font-bold">{status.message}</span>
               </div>
               {status.total > 0 && (
                 <div className="w-full bg-slate-100 h-2 mt-2 rounded-full overflow-hidden">
                    <div 
                        className={`h-2 transition-all duration-500 ${
                          status.status === 'complete' ? 'bg-green-600' : 
                          status.status === 'error' ? 'bg-red-600' :
                          'bg-[#E65100]'
                        }`} 
                        style={{ width: `${(status.page / status.total) * 100}%` }}
                    />
                 </div>
               )}
            </div>
          )}

          {/* Section List */}
          {sections.length > 0 && (
             <div className="bg-white border-2 border-[#111111]">
                <div className="p-3 bg-white border-b-2 border-[#111111] font-bold text-[#111111] flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    فهرس المحتوى
                </div>
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {sections.map((section, idx) => (
                        <button
                            key={section.id}
                            onClick={() => setSelectedSectionId(section.id)}
                            className={`w-full text-right p-3 border-b border-[#111111] border-opacity-10 hover:bg-slate-50 transition-colors text-sm flex items-start gap-3 ${
                                selectedSectionId === section.id ? 'bg-[#FFF3E0] text-[#E65100] font-bold border-r-4 border-r-[#E65100]' : 'text-[#111111]'
                            }`}
                        >
                            <span className={`text-xs w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 mt-0.5 ${
                                selectedSectionId === section.id ? 'bg-[#E65100] text-white' : 'bg-[#111111] text-white'
                            }`}>
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
                     <h2 className="text-2xl font-bold text-[#111111] font-amiri leading-relaxed">
                        {currentSection.title}
                     </h2>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Text Column */}
                    <div className="bg-white border-2 border-[#111111] p-6">
                         <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#111111] border-opacity-10">
                             <FileText className="w-5 h-5 text-[#E65100]" />
                             <h3 className="font-bold text-[#111111]">النص الأصلي</h3>
                         </div>
                         <div className="prose prose-lg max-w-none font-amiri text-[#111111] leading-loose text-justify whitespace-pre-line">
                             {currentSection.originalText}
                         </div>
                    </div>

                    {/* Mind Map Column */}
                    <div className="space-y-4">
                        <div className="bg-white border-2 border-[#111111] p-1">
                             <div className="p-4 flex items-center justify-between border-b-2 border-[#111111] border-opacity-10 mb-2">
                                <div className="flex items-center gap-2">
                                    <BrainCircuit className="w-5 h-5 text-[#E65100]" />
                                    <h3 className="font-bold text-[#111111]">الخريطة الذهنية</h3>
                                </div>
                             </div>
                             <MindMapVisualizer 
                                data={currentSection.mindMap} 
                             />
                        </div>
                    </div>
                </div>
            </>
          ) : (
            // Empty State
            <div className="h-[60vh] flex flex-col items-center justify-center text-[#111111] opacity-50 border-2 border-dashed border-[#111111] bg-white">
               <div className="w-16 h-16 bg-[#111111] text-white rounded-full flex items-center justify-center mb-4">
                   <BookOpen className="w-8 h-8" />
               </div>
               <p className="text-lg font-bold">ابدأ برفع ملف PDF لعرض المحتوى</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;

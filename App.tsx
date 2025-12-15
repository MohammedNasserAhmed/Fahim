import React, { useState } from 'react';
import { Upload, Share2, Download, AlertCircle, FileText, BrainCircuit, Loader2, XCircle, CheckCircle, ShieldCheck } from 'lucide-react';
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
          // analyzeArabicText now retries internally and throws if it ultimately fails
          const result = await analyzeArabicText(pages[i]);
          newSections.push(result);
          setSections([...newSections]);
          
          if (!selectedSectionId && newSections.length === 1) {
            setSelectedSectionId(result.id);
          }
        } catch (err: any) {
          console.error(`Error processing page ${i + 1}`, err);
          // CRITICAL: Stop processing on error to allow user to retry or fix the issue
          setStatus({ 
            page: i + 1, 
            total: pages.length, 
            status: 'error', 
            message: `فشل معالجة الصفحة ${i + 1}: ${err.message || 'خطأ غير معروف'}` 
          });
          return; // Stop the loop immediately
        }
      }

      setStatus({ page: pages.length, total: pages.length, status: 'complete', message: 'تمت المعالجة بنجاح!' });

    } catch (error: any) {
      console.error(error);
      setStatus({ page: 0, total: 0, status: 'error', message: 'حدث خطأ أثناء قراءة الملف.' });
    }
  };

  const handleExportPDF = async (action: PDFExportAction = 'download') => {
    if (sections.length === 0) return;
    
    setExportState({ isActive: true, status: 'initializing', progress: 0, detail: 'بدء التصدير...' });

    try {
      const filename = `fahim-summary-${Date.now()}.pdf`;
      
      const blob = await generatePDF(
        'pdf-export-container', 
        filename,
        (status, progress) => {
          setExportState(prev => ({ ...prev, status: 'rendering', progress, detail: status }));
        },
        action
      );

      setExportState(prev => ({ ...prev, status: 'complete', progress: 100, detail: 'تم التصدير بنجاح!' }));
      
      setTimeout(() => {
        setExportState(prev => ({ ...prev, isActive: false }));
      }, 2000);

      return blob;
    } catch (e: any) {
      console.error(e);
      setExportState(prev => ({ ...prev, status: 'error', detail: 'حدث خطأ أثناء التصدير.' }));
      setTimeout(() => setExportState(prev => ({ ...prev, isActive: false })), 3000);
    }
  };

  const handleSharePDF = async () => {
      if (!navigator.share) {
          alert("المشاركة غير مدعومة في هذا المتصفح. سيتم تحميل الملف بدلاً من ذلك.");
          handleExportPDF('download');
          return;
      }
      
      try {
          const blob = await handleExportPDF('blob');
          if (blob && blob instanceof Blob) {
              const file = new File([blob], "summary.pdf", { type: "application/pdf" });
              await navigator.share({
                  files: [file],
                  title: 'ملخص فهيم',
                  text: 'شاهد هذا الملخص الرائع من فهيم'
              });
          }
      } catch (err) {
          console.error("Share failed", err);
      }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1a1a1a] font-ibm" dir="rtl">
       <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 transition-all">
         <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="bg-orange-50 p-2 rounded-lg">
                 <BrainCircuit className="w-6 h-6 text-[#E65100]" />
               </div>
               <h1 className="text-2xl font-cairo font-bold tracking-tight text-[#1a1a1a]">
                 فهيم <span className="text-[#E65100] text-sm font-semibold mr-1">للتعليم الذكي</span>
               </h1>
            </div>
            
            <div className="flex items-center gap-3">
               {sections.length > 0 && (
                   <>
                     <button 
                       onClick={() => setIsShareModalOpen(true)}
                       className="p-3 hover:bg-gray-50 rounded-xl transition-all text-gray-600 hover:text-[#1a1a1a]"
                       title="مشاركة"
                     >
                        <Share2 className="w-5 h-5" />
                     </button>
                     <button 
                       onClick={() => handleExportPDF('download')}
                       className="p-3 hover:bg-gray-50 rounded-xl transition-all text-gray-600 hover:text-[#1a1a1a]"
                       title="تصدير PDF"
                     >
                        <Download className="w-5 h-5" />
                     </button>
                   </>
               )}
            </div>
         </div>
       </header>

       <main className="max-w-4xl mx-auto px-6 py-12">
          {sections.length === 0 && status.status === 'idle' && (
              <div className="flex flex-col items-center justify-center min-h-[65vh] text-center animate-in fade-in zoom-in-95 duration-700 ease-out">
                  
                  {/* Animated Icon */}
                  <div className="relative mb-10 group cursor-default">
                      <div className="absolute inset-0 bg-orange-100/50 rounded-full animate-ping opacity-20 duration-[3s]"></div>
                      <div className="relative w-28 h-28 bg-gradient-to-br from-white to-orange-50/50 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white group-hover:scale-105 transition-transform duration-500 ease-out">
                          <Upload className="w-10 h-10 text-[#E65100] stroke-[1.5]" />
                      </div>
                  </div>

                  {/* Main Title */}
                  <h2 className="font-cairo font-bold text-4xl md:text-[44px] leading-[1.4] text-[#1a1a1a] mb-5 tracking-tight">
                    حوّل كتبك الدراسية إلى <br/>
                    <span className="text-[#E65100]">خرائط ذهنية ذكية</span>
                  </h2>

                  {/* Subtitle */}
                  <p className="font-ibm text-lg md:text-[18px] text-[#4a4a4a] leading-[1.8] max-w-xl mb-12 opacity-90">
                    ارفع كتابك بصيغة PDF، وسنحوّله فورًا إلى خرائط ذهنية واضحة وسهلة المراجعة.
                  </p>
                  
                  {/* Upload Button */}
                  <label className="group relative cursor-pointer inline-flex flex-col items-center">
                      <input type="file" onChange={handleFileUpload} accept="application/pdf" className="hidden" />
                      
                      <div className="
                        h-[56px] px-10 rounded-2xl 
                        bg-[#1a1a1a] hover:bg-[#000000] 
                        text-white font-cairo font-semibold text-lg
                        shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] 
                        hover:-translate-y-0.5 active:translate-y-0
                        transition-all duration-300 ease-out
                        flex items-center gap-4
                      ">
                          <Upload className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                          <span>ابدأ برفع ملف PDF</span>
                      </div>

                      {/* Trust Line */}
                      <div className="mt-8 flex items-center gap-2 text-sm text-[#666] font-ibm font-medium opacity-80 bg-white/50 px-4 py-1.5 rounded-full border border-gray-100">
                         <ShieldCheck className="w-4 h-4 text-[#E65100]" />
                         <span>يدعم اللغة العربية بالكامل • آمن • بدون تسجيل</span>
                      </div>
                  </label>
              </div>
          )}

          {status.status !== 'idle' && status.status !== 'complete' && status.status !== 'error' && (
              <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center space-y-6 shadow-sm max-w-lg mx-auto mt-10">
                 <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-[#E65100] rounded-full border-t-transparent animate-spin"></div>
                    <Loader2 className="absolute inset-0 m-auto w-6 h-6 text-[#E65100] animate-pulse" />
                 </div>
                 
                 <div className="space-y-2">
                    <h3 className="text-xl font-cairo font-bold text-[#1a1a1a]">جاري المعالجة...</h3>
                    <p className="text-gray-500 font-ibm text-base">{status.message}</p>
                 </div>

                 {status.total > 0 && (
                     <div className="space-y-2">
                         <div className="flex justify-between text-xs font-bold text-gray-400 px-1">
                            <span>البداية</span>
                            <span>{Math.round((status.page / status.total) * 100)}%</span>
                         </div>
                         <div className="w-full bg-gray-50 rounded-full h-3 overflow-hidden border border-gray-100">
                            <div 
                              className="bg-[#E65100] h-full transition-all duration-500 ease-out rounded-full shadow-[0_0_10px_rgba(230,81,0,0.2)]" 
                              style={{ width: `${(status.page / status.total) * 100}%` }}
                            />
                         </div>
                     </div>
                 )}
              </div>
          )}

          {status.status === 'error' && (
             <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-center gap-5 text-red-900 max-w-2xl mx-auto mt-10 shadow-sm">
                <div className="bg-red-100 p-3 rounded-full">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                   <h3 className="font-cairo font-bold text-lg mb-1">حدث خطأ غير متوقع</h3>
                   <p className="text-red-800/80 font-ibm text-sm leading-relaxed">{status.message}</p>
                </div>
                <button 
                  onClick={() => setStatus({ page: 0, total: 0, status: 'idle', message: '' })}
                  className="px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-bold text-red-700 hover:bg-red-50 transition-colors shadow-sm"
                >
                  حاول مرة أخرى
                </button>
             </div>
          )}

          {/* EXPORT MODAL */}
          {exportState.isActive && (
              <div className="fixed inset-0 z-50 bg-[#1a1a1a]/40 backdrop-blur-md flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20">
                     
                     {/* Status Icon */}
                     <div className="flex justify-center">
                        {exportState.status === 'complete' ? (
                            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                                <CheckCircle className="w-10 h-10 text-green-500" />
                            </div>
                        ) : exportState.status === 'error' ? (
                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
                                <XCircle className="w-10 h-10 text-red-500" />
                            </div>
                        ) : (
                            <div className="relative w-24 h-24 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="48" cy="48" r="40" stroke="#f3f4f6" strokeWidth="8" fill="none" />
                                    <circle 
                                        cx="48" cy="48" r="40" 
                                        stroke="#E65100" strokeWidth="8" fill="none" 
                                        strokeDasharray="251.2" 
                                        strokeDashoffset={251.2 - (251.2 * exportState.progress) / 100}
                                        className="transition-all duration-500 ease-out"
                                    />
                                </svg>
                                <span className="absolute text-xl font-cairo font-bold text-[#1a1a1a]">{Math.round(exportState.progress)}%</span>
                            </div>
                        )}
                     </div>
                     
                     <div className="space-y-2">
                        <h3 className="text-2xl font-cairo font-bold text-[#1a1a1a]">
                           {exportState.status === 'complete' ? 'تم التصدير بنجاح!' : 
                            exportState.status === 'error' ? 'فشل التصدير' : 
                            'جاري تحضير ملف PDF'}
                        </h3>
                        <p className="text-gray-500 font-ibm font-medium">{exportState.detail}</p>
                     </div>
                     
                     {exportState.status === 'error' && (
                        <button 
                            onClick={() => setExportState(prev => ({ ...prev, isActive: false }))}
                            className="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold font-cairo transition-colors"
                        >
                            إغلاق
                        </button>
                     )}
                  </div>
              </div>
          )}

          {sections.length > 0 && (
             <div className="space-y-12 pb-20 animate-in slide-in-from-bottom-8 duration-700">
                {sections.map((section, idx) => (
                   <div key={section.id} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 group">
                      <div className="bg-[#FAFAFA] p-6 border-b border-gray-100 flex items-start gap-5">
                         <div className="w-12 h-12 bg-[#1a1a1a] text-white rounded-2xl flex items-center justify-center font-cairo font-bold text-xl shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform duration-300">
                            {idx + 1}
                         </div>
                         <div className="pt-1">
                            <h2 className="text-2xl font-cairo font-bold text-[#1a1a1a] leading-tight mb-3">{section.title}</h2>
                            <div className="flex gap-2">
                               <span className="text-xs bg-orange-50 text-[#E65100] px-3 py-1 rounded-full font-bold border border-orange-100">تحليل ذكي</span>
                               <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-bold border border-gray-200">خريطة ذهنية</span>
                            </div>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-1 xl:grid-cols-2">
                          <div className="p-8 xl:border-l border-gray-100 bg-white">
                             <div className="flex items-center gap-2 mb-6 text-[#E65100] bg-orange-50 w-fit px-4 py-2 rounded-xl">
                                <FileText className="w-5 h-5" />
                                <h3 className="font-cairo font-bold">المحتوى النصي</h3>
                             </div>
                             <div className="prose prose-lg prose-p:text-[#333] prose-headings:font-cairo prose-p:font-amiri prose-p:leading-[2.2] max-w-none text-justify">
                                {section.originalText}
                             </div>
                          </div>
                          
                          <div className="p-8 bg-[#FDFBF7]">
                             <div className="flex items-center gap-2 mb-6 text-[#E65100] bg-orange-50 w-fit px-4 py-2 rounded-xl">
                                <BrainCircuit className="w-5 h-5" />
                                <h3 className="font-cairo font-bold">الخريطة الذهنية</h3>
                             </div>
                             <MindMapVisualizer data={section.mindMap} />
                          </div>
                      </div>
                   </div>
                ))}
             </div>
          )}
       </main>

       <PdfExportTemplate sections={sections} />

       <ShareModal 
         isOpen={isShareModalOpen} 
         onClose={() => setIsShareModalOpen(false)} 
         onSharePDF={handleSharePDF}
         sections={sections}
       />
    </div>
  );
};

export default App;
import React from 'react';
import { AnalyzedSection } from '../types';
import MindMapVisualizer from './MindMapVisualizer';

interface Props {
  sections: AnalyzedSection[];
}

const PdfExportTemplate: React.FC<Props> = ({ sections }) => {
  return (
    // Changed positioning strategy:
    // Instead of left: -10000px which can cause browser optimization to unload fonts/textures,
    // we use fixed at 0,0 but with negative z-index.
    // This ensures the browser treats it as "visible" for rendering pipelines.
    <div 
      id="pdf-export-container" 
      className="fixed top-0 left-0 w-[800px] bg-white text-[#111111] font-sans -z-50 pointer-events-none opacity-0" 
      dir="rtl"
      aria-hidden="true"
    >
      <div className="p-8 space-y-8">
        
        {sections.map((section, index) => (
          <div key={section.id} className="pdf-export-section mb-12 border-b border-white">
            {/* Part 1: Text Content */}
            <div className="pdf-text-part bg-white p-4">
              <div className="flex items-center gap-4 mb-6 border-b-2 border-[#111111] pb-4">
                <div className="w-12 h-12 bg-[#E65100] text-white rounded-full flex items-center justify-center font-bold text-xl">
                  {index + 1}
                </div>
                <h2 className="text-3xl font-bold font-amiri text-[#111111] leading-tight">
                  {section.title}
                </h2>
              </div>
              
              <div className="prose prose-xl max-w-none font-amiri text-justify leading-loose text-[#111111]">
                 {section.originalText}
              </div>
            </div>

            {/* Part 2: Mind Map */}
            <div className="pdf-map-part mt-6 bg-white p-2 border-2 border-[#111111]">
               <div className="mb-4 pr-2 border-r-4 border-[#E65100]">
                  <h3 className="text-xl font-bold text-[#E65100] mr-2">الخريطة الذهنية: {section.title}</h3>
               </div>
               {/* Explicit background required for PDF to not show transparently black */}
               <div className="bg-white">
                 <MindMapVisualizer 
                   data={section.mindMap} 
                 />
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PdfExportTemplate;
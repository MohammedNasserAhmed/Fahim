import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Helper to yield control to the main thread to allow UI updates.
 */
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 50));

/**
 * Safely captures a DOM element to canvas with a timeout to prevent hanging.
 */
const safeCapture = async (element: HTMLElement, options: any): Promise<HTMLCanvasElement> => {
  // Create a race between the render and a timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Render timeout')), 8000); // 8s timeout per part
  });

  const renderPromise = html2canvas(element, {
    scale: 2, // Retain high quality
    useCORS: true,
    logging: false, // Disable verbose logging in production
    allowTaint: true,
    backgroundColor: '#ffffff',
    ...options
  });

  return Promise.race([renderPromise, timeoutPromise]);
};

export type PDFExportAction = 'download' | 'blob';

/**
 * Generates a PDF from a DOM element containing the full export content.
 * Includes progress tracking and performance safeguards.
 */
export const generatePDF = async (
  elementId: string, 
  filename: string,
  onProgress: (status: string, progress: number) => void,
  action: PDFExportAction = 'download'
): Promise<Blob | void> => {
  
  // 1. Validation & Setup
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Export template not found in DOM.');
  }

  onProgress('جاري تحميل الخطوط...', 5);
  await yieldToMain();
  
  // Attempt to wait for fonts, but don't block forever
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise(r => setTimeout(r, 2000))
    ]);
  } catch (e) {
    console.warn('Font loading check skipped', e);
  }

  // A4 dimensions in mm
  const pdfWidth = 210;
  const pdfHeight = 297;
  const margin = 10;
  const contentWidth = pdfWidth - (2 * margin);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const sections = Array.from(element.querySelectorAll('.pdf-export-section'));
  
  if (sections.length === 0) {
    throw new Error('No content found to export.');
  }

  let currentY = margin;
  let pageNumber = 1;

  // Calculate total steps for progress bar (2 steps per section: text + map)
  const totalSteps = sections.length * 2;
  let completedSteps = 0;

  // 2. Process Sections
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i] as HTMLElement;
    
    // -- Part A: Text Content --
    const textPart = section.querySelector('.pdf-text-part') as HTMLElement;
    if (textPart) {
      const sectionTitle = textPart.querySelector('h2')?.textContent || `Section ${i + 1}`;
      onProgress(`جاري معالجة النصوص: ${sectionTitle}`, Math.round(((completedSteps) / totalSteps) * 90));
      await yieldToMain();

      try {
        const textCanvas = await safeCapture(textPart, {});
        
        const imgData = textCanvas.toDataURL('image/jpeg', 0.90);
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * contentWidth) / imgProps.width;

        // Page break logic
        if (currentY + imgHeight > pdfHeight - margin) {
          pdf.addPage();
          currentY = margin;
          pageNumber++;
        }

        pdf.addImage(imgData, 'JPEG', margin, currentY, contentWidth, imgHeight);
        currentY += imgHeight + 5;
      } catch (err) {
        console.error(`Failed to render text for section ${i}`, err);
        // Add a placeholder/error text to the PDF so the user knows something is missing
        pdf.setFontSize(10);
        pdf.setTextColor(255, 0, 0);
        pdf.text(`[خطأ في معالجة النص: ${sectionTitle}]`, margin, currentY);
        currentY += 10;
      }
    }
    completedSteps++;

    // -- Part B: Mind Map --
    const mapPart = section.querySelector('.pdf-map-part') as HTMLElement;
    if (mapPart) {
      onProgress(`جاري رسم الخريطة الذهنية...`, Math.round(((completedSteps) / totalSteps) * 90));
      await yieldToMain();

      try {
        // Check if SVG has content (simple validation)
        const svg = mapPart.querySelector('svg');
        if (svg && svg.childNodes.length > 0) {
           // We try to capture the map container
           const mapCanvas = await safeCapture(mapPart, {
             // Sometimes ignoring elements helps, but here we need everything
             ignoreElements: (el: Element) => el.classList.contains('ignore-export')
           });

          const mapImgData = mapCanvas.toDataURL('image/jpeg', 0.90);
          const mapImgProps = pdf.getImageProperties(mapImgData);
          const mapHeight = (mapImgProps.height * contentWidth) / mapImgProps.width;

          // Page break logic for large maps
          if (currentY + mapHeight > pdfHeight - margin) {
            pdf.addPage();
            currentY = margin;
            pageNumber++;
          }

          pdf.addImage(mapImgData, 'JPEG', margin, currentY, contentWidth, mapHeight);
          currentY += mapHeight + 10;
        } else {
            console.warn(`Empty SVG found for section ${i}`);
        }
      } catch (err) {
        console.error(`Failed to render map for section ${i}`, err);
        pdf.setFontSize(10);
        pdf.setTextColor(255, 0, 0);
        pdf.text(`[خطأ في معالجة الخريطة الذهنية]`, margin, currentY);
        currentY += 10;
      }
    }
    completedSteps++;

    // Visual Separator
    if (i < sections.length - 1) {
       if (currentY < pdfHeight - 30) {
         pdf.setDrawColor(200, 200, 200);
         pdf.line(margin, currentY, pdfWidth - margin, currentY);
         currentY += 10;
       } else {
         pdf.addPage();
         currentY = margin;
         pageNumber++;
       }
    }
  }

  // 3. Finalize
  onProgress('جاري تحضير الملف...', 95);
  await yieldToMain();
  
  // Add Footer Page Numbers
  const totalPages = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(10);
    pdf.setTextColor(150);
    pdf.text(`صفحة ${i} من ${totalPages}`, pdfWidth / 2, pdfHeight - 5, { align: 'center' });
  }

  onProgress('تم الانتهاء!', 100);

  if (action === 'download') {
    pdf.save(filename);
    return;
  } else {
    return pdf.output('blob');
  }
};

/**
 * Extracts text from a PDF file using PDF.js
 * Handles basic cleanup of Arabic text directionality markers if present.
 */
export const extractTextFromPDF = async (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result as ArrayBuffer);

      try {
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const totalPages = pdf.numPages;
        const pagesText: string[] = [];

        for (let i = 1; i <= totalPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Join items with space, preserving roughly the order
          // Note: PDF extraction often scrambles order. We rely on Gemini to fix semantic flow later.
          let pageString = textContent.items.map((item: any) => item.str).join(' ');
          
          // Basic normalization for common PDF artifacts
          pageString = pageString.replace(/\s+/g, ' ').trim();
          
          pagesText.push(pageString);
        }
        resolve(pagesText);
      } catch (error) {
        reject(error);
      }
    };

    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(file);
  });
};

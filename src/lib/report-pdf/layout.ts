export const letterWidth = 612;
export const letterHeight = 792;
export const pageMargin = 36;
export const headerBand = 28;
export const headerGap = 8;
export const footerBand = 16;
export const footerGap = 8;

export const contentWidth = letterWidth - pageMargin * 2;
export const pagePaddingTop = pageMargin + headerBand + headerGap;
export const pagePaddingBottom = pageMargin + footerBand + footerGap;
export const pageContentHeight = letterHeight - pagePaddingTop - pagePaddingBottom;

export const captureCssWidth = 720;
export const captureCssHeight = 256;

/** Move a block to the next page when it cannot fit in the remaining space. */
export function shouldStartNewPage(remaining: number, needed: number, pageHeight = pageContentHeight) {
  if (needed <= remaining) return false;
  if (needed > pageHeight) return remaining < pageHeight;
  return true;
}

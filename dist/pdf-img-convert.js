/*

Copyright (c) 2020 Ollie Thwaites

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
const isURL = require('is-url');
import { getDocument } from 'pdfjs-dist';
import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { assert } from 'pdfjs-dist/types/src/shared/util.js';
// import fetch from 'node-fetch';
const readFile = util.promisify(fs.readFile);
class NodeCanvasFactory {
  // NodeCanvasFactory.prototype = {
  create(width, height) {
    assert(width > 0 && height > 0, 'Invalid canvas size');
    let canvas = createCanvas(width, height);
    let context = canvas.getContext('2d');
    return {
      canvas: canvas,
      context: context,
    };
  }
  reset(canvasAndContext, width, height) {
    assert(canvasAndContext.canvas, 'Canvas is not specified');
    assert(width > 0 && height > 0, 'Invalid canvas size');
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    assert(canvasAndContext.canvas, 'Canvas is not specified');
    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}
export async function convert(pdf, conversion_config) {
  // Get the PDF in Uint8Array form
  let pdfData = pdf;
  if (typeof pdf === 'string') {
    // Support for URL input
    if (isURL(pdf) || pdf.startsWith('moz-extension://') || pdf.startsWith('chrome-extension://') || pdf.startsWith('file://')) {
      const resp = await fetch(pdf);
      pdfData = new Uint8Array(await resp.arrayBuffer());
    }
    // Support for base64 encoded pdf input
    else if (/pdfData:pdf\/([a-zA-Z]*);base64,([^"]*)/.test(pdf)) {
      pdfData = new Uint8Array(Buffer.from(pdf.split(',')[1], 'base64'));
    }
    // Support for filepath input
    else {
      pdfData = new Uint8Array(await readFile(pdf));
    }
  }
  // Support for buffer input
  else if (Buffer.isBuffer(pdf)) {
    pdfData = new Uint8Array(pdf);
  }
  // Support for Uint8Array input
  else if (!pdf instanceof Uint8Array) {
    return pdf;
  }
  // At this point, we want to convert the pdf data into a 2D array representing
  // the images (indexed like array[page][pixel])
  let packagePath = path.dirname(require.resolve('pdfjs-dist/package.json'));
  let outputPages = [];
  let loadingTask = getDocument({
    data: pdfData,
    disableFontFace: true,
    verbosity: 0,
    standardFontDataUrl: packagePath + '/standard_fonts/',
    isEvalSupported: conversion_config?.isEvalSupported || false,
  });
  let pdfDocument = await loadingTask.promise;
  let canvasFactory = new NodeCanvasFactory();
  if (
    conversion_config &&
    ((conversion_config.height && conversion_config.height <= 0) || (conversion_config.width && conversion_config.width <= 0))
  )
    console.error('Negative viewport dimension given. Defaulting to 100% scale.');
  // If there are page numbers supplied in the conversion config
  if (conversion_config && conversion_config.page_numbers)
    for (let i = 0; i < conversion_config.page_numbers.length; i++) {
      // This just pushes a render of the page to the array
      let currentPage = await doc_render(pdfDocument, conversion_config.page_numbers[i], canvasFactory, conversion_config);
      if (currentPage != null) {
        // This allows for base64 conversion of output images
        if (conversion_config.base64) outputPages.push(currentPage.toString('base64'));
        else outputPages.push(new Uint8Array(currentPage));
      }
    }
  // Otherwise just loop the whole doc
  else
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      let currentPage = await doc_render(pdfDocument, i, canvasFactory, conversion_config);
      if (currentPage != null) {
        // This allows for base64 conversion of output images
        if (conversion_config?.base64) outputPages.push(currentPage.toString('base64'));
        else outputPages.push(new Uint8Array(currentPage));
      }
    }
  return outputPages;
} // convert method
async function doc_render(pdfDocument, pageNo, canvasFactory, conversion_config) {
  // Page number sanity check
  if (pageNo < 1 || pageNo > pdfDocument.numPages) {
    console.error('Invalid page number ' + pageNo);
    return;
  }
  if (conversion_config && conversion_config.scale && conversion_config.scale <= 0) {
    console.error('Invalid scale ' + conversion_config.scale);
    return;
  }
  // Get the page
  let page = await pdfDocument.getPage(pageNo);
  // Create a viewport at 100% scale
  let outputScale = conversion_config?.scale || 1.0;
  let viewport = page.getViewport({ scale: outputScale });
  // Scale it up / down dependent on the sizes given in the config (if there
  // are any)
  if (conversion_config?.width) outputScale = conversion_config.width / viewport.width;
  else if (conversion_config?.height) outputScale = conversion_config.height / viewport.height;
  if (outputScale != 1 && outputScale > 0) viewport = page.getViewport({ scale: outputScale });
  let canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
  let renderContext = {
    canvasContext: canvasAndContext.context,
    viewport: viewport,
    canvasFactory: canvasFactory,
  };
  await page.render(renderContext).promise;
  // Convert the canvas to an image buffer.
  let image = canvasAndContext.canvas.toBuffer();
  return image;
} // doc_render

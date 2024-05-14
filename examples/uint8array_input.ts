import * as pdf2img from '../pdf-img-convert.ts';

import * as fs from 'fs';

(async function () {
  // Getting a uint8array
  var resp = await fetch(
    'https://assets.publishing.service.gov.uk/media/61d702c4d3bf7f0550c0c3be/COVID-19-self-test-throat-and-nose-instructions.pdf'
  );
  let pdfData = new Uint8Array(await resp.arrayBuffer());
  // Converting it and saving
  let pdfArray = (await pdf2img.convert(pdfData)) as string[];
  console.log('Saving');
  for (let i = 0; i < pdfArray.length; i++) {
    fs.writeFile('./outputImages/output' + i + '.png', pdfArray[i], function (error: any) {
      if (error) {
        console.error('Error: ' + error);
      }
    }); //writeFile
  } // for
})();

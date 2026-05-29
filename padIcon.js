const Jimp = require('jimp');

async function pad() {
  console.log("Reading logo.png...");
  const image = await Jimp.read('assets/logo.png');
  const size = 1024;
  
  // Get the top-left pixel color to use as the seamless background padding
  const bgColorInt = image.getPixelColor(0, 0);
  
  const background = new Jimp(size, size, bgColorInt);
  
  // The user wants it smaller. Let's make it 600px.
  const targetSize = 600;
  
  image.scaleToFit(targetSize, targetSize);
  
  const x = Math.floor((size - image.bitmap.width) / 2);
  const y = Math.floor((size - image.bitmap.height) / 2);
  
  background.composite(image, x, y);
  
  await background.writeAsync('assets/icon_padded_new.png');
  console.log("Successfully created assets/icon_padded_new.png with seamless background.");
}

pad().catch(console.error);

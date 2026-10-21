const fs = require('fs');
const JO = require('javascript-obfuscator');
const { minify } = require('html-minifier-terser');
(async () => {
  let html = fs.readFileSync(process.argv[2], 'utf8');
  // Làm rối mọi <script> nội tuyến (không đụng script có src)
  html = html.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => {
    const out = JO.obfuscate(code, {
      compact: true,
      renameGlobals: false,            // giữ tên hàm dùng trong onclick
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.4,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.2,
      identifierNamesGenerator: 'hexadecimal',
      transformObjectKeys: true,
      unicodeEscapeSequence: false
    }).getObfuscatedCode();
    return '<script>' + out + '</script>';
  });
  html = await minify(html, {
    collapseWhitespace: true, removeComments: true, minifyCSS: true, minifyJS: false,
    conservativeCollapse: false
  });
  fs.writeFileSync(process.argv[3], html);
  console.log('size', html.length);
})();

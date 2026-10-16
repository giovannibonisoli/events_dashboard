// The @recogito/text-annotator UMD bundle references process.env.NODE_ENV.
// Provide it before the library is loaded so initialization does not throw.
window.process = window.process || { env: { NODE_ENV: 'production' } };

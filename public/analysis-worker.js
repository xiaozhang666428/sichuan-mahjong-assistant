import {analyze} from './engine.js';
self.onmessage = ({data: {id, hand, missing, seen}}) => {
  try { self.postMessage({id, result: analyze(hand, missing, seen)}); }
  catch (error) { self.postMessage({id, error: error.message}); }
};

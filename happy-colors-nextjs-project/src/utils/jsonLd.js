export function stringifyJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

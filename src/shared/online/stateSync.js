const VUE_INTERNAL_KEY_RE = /^__v_/;
const VUE_INTERNAL_KEYS = new Set(['_rawValue', '_value']);

function shouldSkipKey(key) {
  return VUE_INTERNAL_KEY_RE.test(key) || VUE_INTERNAL_KEYS.has(key);
}

/**
 * 递归剥离 Vue 响应式内部属性，返回干净的对象。
 * @param {*} obj - 输入值
 * @param {Function} transformDate - Date 对象的转换函数
 */
function stripVueInternals(obj, transformDate) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return transformDate(obj);
  if (Array.isArray(obj)) return obj.map(item => stripVueInternals(item, transformDate));

  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (shouldSkipKey(key)) continue;
      result[key] = stripVueInternals(obj[key], transformDate);
    }
  }
  return result;
}

export function deepClone(obj) {
  return stripVueInternals(obj, d => new Date(d.getTime()));
}

export function toPlainObject(obj) {
  return stripVueInternals(obj, d => d.toISOString());
}


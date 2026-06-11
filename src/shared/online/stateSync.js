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

/**
 * 浅比较两个值是否相等。
 * 对 object 类型递归比较（一层），避免 JSON.stringify 的性能和 key 顺序问题。
 */
function shallowEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => shallowEqual(item, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => shallowEqual(a[key], b[key]));
}

export function computeRoomDiff(oldRoom, newRoom) {
  const diff = {};
  let changedCount = 0;
  const keys = Object.keys(newRoom || {});

  for (const key of keys) {
    if (shouldSkipKey(key)) continue;

    const oldVal = oldRoom ? oldRoom[key] : undefined;
    const newVal = newRoom[key];

    if (!shallowEqual(oldVal, newVal)) {
      diff[key] = newVal;
      changedCount++;
    }
  }

  return { diff, changedCount, totalFields: keys.length };
}


// 薄封装 — 核心实现在 src/shared/online/logger.js
// 游戏专用 logger.js 保留以维持现有导入路径不变
export { createLogger, setLogLevel, getLogLevel, logger, LogLevel } from '../../../../src/shared/online/logger';

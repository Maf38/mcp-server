import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Définition des niveaux de log personnalisés
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Définition des couleurs pour chaque niveau
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Ajout des couleurs à Winston
winston.addColors(colors);

// Format de base pour tous les transports
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.errors({ stack: true })
);

// Format pour la console (avec couleurs)
const consoleFormat = winston.format.combine(
  baseFormat,
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const metadata = info.metadata as Record<string, unknown>;
    return `${info.timestamp} [${info.level}] ${info.message}${
      Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : ''
    }`;
  })
);

// Format pour les fichiers (sans couleurs)
const fileFormat = winston.format.combine(
  baseFormat,
  winston.format.printf((info) => {
    const metadata = info.metadata as Record<string, unknown>;
    return `${info.timestamp} [${info.level}] ${info.message}${
      Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : ''
    }`;
  })
);

// Configuration des transports
const transports: winston.transport[] = [
  // Console (stdout/stderr)
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat,
    // Assure que les logs sont bien envoyés vers stdout/stderr
    stderrLevels: ['error'],
    consoleWarnLevels: ['warn']
  })
];

// Ajout des transports de fichiers seulement si nous ne sommes pas en environnement Docker
if (process.env.NODE_ENV !== 'docker') {
  transports.push(
    // Fichier rotatif pour tous les logs
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'mcp-server-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat
    }),
    
    // Fichier séparé pour les erreurs
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'mcp-server-error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
      format: fileFormat
    })
  );
}

// Création du logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  transports,
  exitOnError: false
});

// Helper pour les contextes
export function createContextLogger(context: string) {
  return {
    error: (message: string, meta = {}) => logger.error(`[${context}] ${message}`, meta),
    warn: (message: string, meta = {}) => logger.warn(`[${context}] ${message}`, meta),
    info: (message: string, meta = {}) => logger.info(`[${context}] ${message}`, meta),
    http: (message: string, meta = {}) => logger.http(`[${context}] ${message}`, meta),
    debug: (message: string, meta = {}) => logger.debug(`[${context}] ${message}`, meta),
  };
}

export default logger;

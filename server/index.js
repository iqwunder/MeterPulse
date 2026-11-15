require('dotenv').config();

const cors = require('cors');
const express = require('express');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const multer = require('multer');
const mysql = require('mysql2/promise');

const app = express();
const port = Number(process.env.API_PORT || 3000);
const host = process.env.API_HOST || '127.0.0.1';
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200').split(',').map((origin) => origin.trim());
const pool = mysql.createPool(process.env.DATABASE_URL || {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'meterpulse',
    user: process.env.DB_USER || 'meterpulse',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const utilities = new Set(['electricity', 'gas', 'water']);
const unitFor = (utility) => utility === 'electricity' ? 'kWh' : 'm³';
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateReading(input) {
    const utility = typeof input?.utility === 'string' ? input.utility.trim().toLowerCase() : '';
    const value = Number(input?.value);
    const recordedAt = input?.recordedAt ?? input?.date;

    if (!utilities.has(utility)) return { error: 'utility muss electricity, gas oder water sein.' };
    if (!Number.isFinite(value) || value < 0 || value > 999999999) return { error: 'value muss eine Zahl ab null sein.' };
    if (!validDate(recordedAt)) return { error: 'Das Datum muss ein gültiges Datum im Format YYYY-MM-DD sein.' };

    return { value: { utility, value, unit: unitFor(utility), recordedAt } };
}

app.get('/api/health', asyncRoute(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
}));

app.get('/api/readings', asyncRoute(async (req, res) => {
    const utility = req.query.utility;
    if (utility && !utilities.has(utility)) return res.status(400).json({ error: 'Unbekannter Energieträger.' });

    const sql = `SELECT id, utility, value, unit, DATE_FORMAT(recorded_at, '%Y-%m-%d') AS recordedAt
    FROM readings ${utility ? 'WHERE utility = ?' : ''} ORDER BY recorded_at DESC, id DESC`;
    const [rows] = await pool.query(sql, utility ? [utility] : []);
    res.json(rows);
}));

app.post('/api/readings', asyncRoute(async (req, res) => {
    const result = validateReading(req.body);
    if (result.error) return res.status(400).json({ error: result.error });

    const reading = result.value;
    const [insert] = await pool.execute(
        'INSERT INTO readings (utility, value, unit, recorded_at) VALUES (?, ?, ?, ?)',
        [reading.utility, reading.value, reading.unit, reading.recordedAt],
    );
    res.status(201).json({ id: insert.insertId, ...reading });
}));

app.post('/api/readings/import', upload.single('file'), asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Bitte eine CSV-Datei auswählen.' });

    let records;
    try {
        records = parse(req.file.buffer, {
            bom: true,
            columns: (headers) => headers.map((header) => header.trim().toLowerCase()),
            delimiter: [',', ';'],
            skip_empty_lines: true,
            trim: true,
        });
    } catch {
        return res.status(400).json({ error: 'Die CSV-Datei konnte nicht gelesen werden.' });
    }

    if (records.length === 0) return res.status(400).json({ error: 'Die CSV-Datei enthält keine Messwerte.' });
    if (records.length > 5000) return res.status(400).json({ error: 'Pro Import sind höchstens 5.000 Messwerte erlaubt.' });
    const requiredHeaders = ['utility', 'value', 'date'];
    const headers = Object.keys(records[0]);
    const missing = requiredHeaders.filter((header) => !headers.includes(header));
    if (missing.length) return res.status(400).json({ error: `Fehlende CSV-Spalten: ${missing.join(', ')}.` });

    const valid = [];
    const errors = [];
    records.forEach((record, index) => {
        const result = validateReading(record);
        if (result.error) errors.push(`Zeile ${index + 2}: ${result.error}`);
        else valid.push(result.value);
    });
    if (errors.length) {
        const shown = errors.slice(0, 8).join(' ');
        const remainder = errors.length > 8 ? ` Weitere ${errors.length - 8} Fehler.` : '';
        return res.status(400).json({ error: `${shown}${remainder} Es wurde nichts importiert.` });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const reading of valid) {
            await connection.execute(
                'INSERT INTO readings (utility, value, unit, recorded_at) VALUES (?, ?, ?, ?)',
                [reading.utility, reading.value, reading.unit, reading.recordedAt],
            );
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    res.status(201).json({ imported: valid.length });
}));

if (process.argv.includes('--serve-web') || process.env.NODE_ENV === 'production') {
    const webRoot = path.join(__dirname, '..', 'dist', 'meter-pulse', 'browser');
    app.use(express.static(webRoot));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api/')) {
            return res.sendFile(path.join(webRoot, 'index.html'));
        }
        next();
    });
}

app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Die CSV-Datei darf höchstens 5 MB groß sein.' });
    }
    console.error(error.message);
    res.status(500).json({ error: 'Interner Fehler. Bitte API- und Datenbankverbindung prüfen.' });
});

app.listen(port, host, () => console.log(`MeterPulse API läuft auf http://${host}:${port}`));
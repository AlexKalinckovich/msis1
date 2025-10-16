import cors from 'cors';
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from 'url';
import { existsSync } from "node:fs";
import { calculateGilbMetrics, analyzeCodeStructure } from './gilb-metrics.js';
import {calculateBoundaryValueMetrics} from "./boundMetrics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(path.join(__dirname, '../js')));

app.post('/api/analyze', (req, res) => {
    try {
        const { code } = req.body;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({
                error: 'Не предоставлен код для анализа'
            });
        }

        if (code.trim().length === 0) {
            return res.status(400).json({
                error: 'Код не может быть пустым'
            });
        }

        console.log('Анализ кода... Длина:', code.length, 'символов');

        const gilbMetrics = calculateGilbMetrics(code);
        const boundaryMetrics = calculateBoundaryValueMetrics(code);
        const structure = analyzeCodeStructure(code);

        console.log('Результаты анализа:', {
            gilb: gilbMetrics,
            boundary: boundaryMetrics
        });

        res.json({
            success: true,
            metrics: {
                cl: gilbMetrics.cl,
                clRelative: gilbMetrics.clRelative,
                cli: gilbMetrics.cli,
                totalStatements: gilbMetrics.totalStatements,

                sa: boundaryMetrics.sa,
                so: boundaryMetrics.so,
                totalVertices: boundaryMetrics.totalVertices,
                choiceVertices: boundaryMetrics.choiceVertices,
                acceptingVertices: boundaryMetrics.acceptingVertices
            },
            debug: {
                structure: {
                    ifExpressions: structure.ifExpressions,
                    matchExpressions: structure.matchExpressions,
                    forExpressions: structure.forExpressions,
                    whileExpressions: structure.whileExpressions,
                    functionDefinitions: structure.functionDefinitions,
                    totalNodes: structure.totalNodes
                }
            }
        });

    } catch (error) {
        console.error('Ошибка при анализе кода:', error);

        res.status(500).json({
            error: 'Внутренняя ошибка сервера при анализе кода',
            details: error.message
        });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Сервер анализа метрик Джилба работает',
        timestamp: new Date().toISOString()
    });
});

app.get('/test', (req, res) => {
    const testCode = `
object TestProgram {
    def main(args: Array[String]): Unit = {
        val x = 10
        
        if (x > 5) {
            println("x > 5")
        } else if (x > 3) {
            println("x > 3")
        } else {
            println("x <= 3")
        }
        
        x match {
            case 1 => println("one")
            case 2 => println("two") 
            case 10 => println("ten")
            case _ => println("other")
        }
        
        for (i <- 1 to 3) {
            if (i % 2 == 0) {
                println("even")
            }
        }
    }
    
    def factorial(n: Int): Int = {
        if (n <= 1) 1
        else n * factorial(n - 1)
    }
}`;

    try {
        const metrics = calculateGilbMetrics(testCode);
        const structure = analyzeCodeStructure(testCode);

        res.json({
            test: true,
            metrics,
            structure: {
                ifExpressions: structure.ifExpressions,
                matchExpressions: structure.matchExpressions,
                forExpressions: structure.forExpressions,
                caseClauses: structure.caseClauses,
                totalNodes: structure.totalNodes
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    const filePath = path.join(__dirname, '../lab2.html');
    res.sendFile(filePath);
});

app.get('/css/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../css', filename);

    if (existsSync(filePath)) {
        res.setHeader('Content-Type', 'text/css');
        res.sendFile(filePath);
    } else {
        res.status(404).send('CSS file not found');
    }
});

app.get('/js/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../js', filename);

    if (existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(filePath);
    } else {
        res.status(404).send('JS file not found');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 API доступно по адресу: http://localhost:${PORT}`);
});
class ScalaCodeAnalyzer {
    constructor() {
        this.apiBaseUrl = window.location.origin;
        this.isAnalyzing = false;
        this.init();
    }

    init() {
        console.log('ScalaCodeAnalyzer инициализирован');
        this.bindEvents();
        this.createUIElements();
    }

    bindEvents() {
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.handleAnalysis());
        }

        const codeTextarea = document.getElementById('scala-code');
        if (codeTextarea) {
            codeTextarea.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.handleAnalysis();
                }
            });
        }
    }

    createUIElements() {
        if (!document.getElementById('analysis-status')) {
            const statusDiv = document.createElement('div');
            statusDiv.id = 'analysis-status';
            statusDiv.className = 'analysis-status';
            statusDiv.style.display = 'none';
            document.querySelector('.container')?.appendChild(statusDiv);
        }
    }

    async handleAnalysis() {
        if (this.isAnalyzing) return;

        const codeTextarea = document.getElementById('scala-code');
        if (!codeTextarea) {
            this.showError('Не найден элемент для ввода кода');
            return;
        }

        const code = codeTextarea.value.trim();
        if (!code) {
            this.showError('Пожалуйста, введите код Scala для анализа');
            return;
        }

        this.setAnalyzingState(true);
        this.showStatus('Анализ кода...');

        try {
            const result = await this.sendAnalysisRequest(code);
            this.displayResults(result);
            this.showStatus('Анализ завершен успешно', 'success');
        } catch (error) {
            console.error('Ошибка анализа:', error);
            this.showError(`Ошибка при анализе кода: ${error.message}`);
            this.displayFallbackResults();
        } finally {
            this.setAnalyzingState(false);
        }
    }

    async sendAnalysisRequest(scalaCode) {
        const response = await fetch(`${this.apiBaseUrl}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: scalaCode })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }

        return result;
    }

    displayResults(result) {
        if (!result.metrics) {
            throw new Error('Некорректный ответ от сервера: отсутствуют метрики');
        }

        this.updateMetric('cl-result', result.metrics.cl);
        this.updateMetric('cl-relative-result', result.metrics.clRelative);
        this.updateMetric('cli-result', result.metrics.cli - 1);
        this.updateMetric('total-statements', result.metrics.totalStatements);

        this.updateMetric('sa-result', result.metrics.sa || '-');
        this.updateMetric('so-result', result.metrics.so !== undefined ? this.formatNumber(result.metrics.so) : '-');
        this.updateMetric('total-vertices-result', result.metrics.totalVertices || '-');
        this.updateMetric('choice-vertices-result', result.metrics.choiceVertices || '-');
        this.updateMetric('accepting-vertices-result', result.metrics.acceptingVertices || '-');

        if (result.debug && result.debug.structure) {
            this.showAdditionalInfo(result.debug.structure);
        }

        this.hideError();
        this.animateResults();
    }

    displayFallbackResults() {
        const fallbackMetrics = this.getFallbackMetrics();
        this.updateMetric('cl-result', fallbackMetrics.cl);
        this.updateMetric('cl-relative-result', fallbackMetrics.clRelative);
        this.updateMetric('cli-result', fallbackMetrics.cli);
        this.updateMetric('total-statements', 'N/A');

        this.updateMetric('sa-result', 'N/A');
        this.updateMetric('so-result', 'N/A');
        this.updateMetric('total-vertices-result', 'N/A');
        this.updateMetric('choice-vertices-result', 'N/A');
        this.updateMetric('accepting-vertices-result', 'N/A');
    }

    updateMetric(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    formatNumber(value, decimals = 3) {
        if (value === undefined || value === null) return '-';
        return Number(value).toFixed(decimals);
    }

    showAdditionalInfo(structure) {
        if (!structure) {
            console.warn('Structure is undefined');
            return;
        }

        const infoHtml = `
            <div class="additional-info">
                <h4>Детали анализа:</h4>
                <p>If выражений: ${structure.ifExpressions || 0}</p>
                <p>Match выражений: ${structure.matchExpressions || 0}</p>
                <p>Циклов for: ${structure.forExpressions || 0}</p>
                <p>Циклов while: ${structure.whileExpressions || 0}</p>
                <p>Функций: ${structure.functionDefinitions || 0}</p>
                <p>Case clauses: ${structure.caseClauses || 0}</p>
                <p>Всего узлов: ${structure.totalNodes || 0}</p>
            </div>
        `;

        let infoContainer = document.getElementById('additional-info');
        if (!infoContainer) {
            infoContainer = document.createElement('div');
            infoContainer.id = 'additional-info';
            document.querySelector('.results-section')?.appendChild(infoContainer);
        }
        infoContainer.innerHTML = infoHtml;
    }

    animateResults() {
        const metrics = document.querySelectorAll('.metric-item');
        metrics.forEach((metric, index) => {
            metric.style.opacity = '0';
            metric.style.transform = 'translateY(20px)';

            setTimeout(() => {
                metric.style.transition = 'all 0.5s ease-out';
                metric.style.opacity = '1';
                metric.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('analysis-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `analysis-status ${type}`;
            statusElement.style.display = 'block';

            if (type === 'success') {
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 3000);
            }
        }
    }

    showError(message) {
        this.showStatus(message, 'error');

        let errorElement = document.getElementById('error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'error-message';
            errorElement.className = 'error-message';
            document.querySelector('.container')?.appendChild(errorElement);
        }

        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    hideError() {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    setAnalyzingState(analyzing) {
        this.isAnalyzing = analyzing;
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.disabled = analyzing;
            analyzeBtn.textContent = analyzing ? 'Анализ...' : 'Анализатор кода';
        }
    }

    getFallbackMetrics() {
        return {
            cl: 4,
            clRelative: 0.36,
            cli: 3
        };
    }

    async testAnalysis() {
        const testCode = `
object TestProgram {
    def main(args: Array[String]): Unit = {
        val x = 10
        
        if (x > 5) {
            println("x > 5")
        } else {
            println("x <= 5")
        }
        
        x match {
            case 1 => println("one")
            case 10 => println("ten")
            case _ => println("other")
        }
    }
}`;

        document.getElementById('scala-code').value = testCode;
        await this.handleAnalysis();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.scalaAnalyzer = new ScalaCodeAnalyzer();

    if (process.env.NODE_ENV === 'development') {
        const testBtn = document.createElement('button');
        testBtn.textContent = 'Тестовый анализ';
        testBtn.addEventListener('click', () => window.scalaAnalyzer.testAnalysis());
        document.querySelector('.container')?.appendChild(testBtn);
    }
});
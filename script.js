document.addEventListener('DOMContentLoaded', () => {
    const auditBtn = document.getElementById('audit-btn');
    const urlInput = document.getElementById('url-input');
    const resultBox = document.getElementById('result-box');
    let currentAuditData = null;

    auditBtn.addEventListener('click', async () => {
        const targetUrl = urlInput.value.trim();

        if (!targetUrl) {
            alert('Please enter a URL');
            return;
        }

        auditBtn.disabled = true;
        auditBtn.innerText = 'Analyzing...';
        resultBox.innerHTML = '<p class="status">Extracting DOM, checking speed, and running AI heuristics...</p>';

        try {
            const response = await fetch('/api/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: targetUrl })
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Server error (${response.status}). Ensure server is restarted.`);
            }

            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Audit failed');

            currentAuditData = data;

            // Safe extraction using Optional Chaining (?.)
            const score = data.metrics?.seoScore ?? 0;
            const loadTime = data.metrics?.loadTimeMs ?? 'N/A';
            const isHttps = data.metrics?.isHttps ? '✅ Enabled' : '❌ Insecure';
            const title = data.seo?.title ?? 'N/A';
            const metaDesc = data.seo?.metaDescription ?? 'N/A';
            const h1Count = data.seo?.h1Count ?? 0;
            const totalImgs = data.seo?.totalImages ?? 0;
            const missingAlt = data.seo?.imagesMissingAlt ?? 0;
            const aiText = data.aiAnalysis || 'No AI insights generated.';

            // Render UI safely
            resultBox.innerHTML = `
                <div class="dashboard-grid">
                    <div class="card score-card">
                        <h3>Overall Score</h3>
                        <div class="score-badge ${score >= 70 ? 'good' : 'warning'}">
                            ${score}/100
                        </div>
                    </div>

                    <div class="card">
                        <h3>Performance & Security</h3>
                        <p><strong>Response Time:</strong> ${loadTime} ms</p>
                        <p><strong>SSL/HTTPS:</strong> ${isHttps}</p>
                        <p><strong>Status Code:</strong> ${data.statusCode || 200}</p>
                    </div>

                    <div class="card">
                        <h3>SEO Metrics</h3>
                        <p><strong>Title:</strong> ${title}</p>
                        <p><strong>Meta Description:</strong> ${metaDesc}</p>
                        <p><strong>H1 Count:</strong> ${h1Count}</p>
                        <p><strong>Missing Alt Tags:</strong> ${missingAlt} / ${totalImgs}</p>
                    </div>

                    <div class="card full-width">
                        <h3>AI Recommendations</h3>
                        <div class="ai-box">${aiText.replace(/\n/g, '<br>')}</div>
                    </div>
                </div>

                <div class="actions">
                    <button id="download-btn" class="secondary-btn">Export Report (JSON)</button>
                </div>
            `;

            document.getElementById('download-btn').addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(currentAuditData, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `audit-report-${Date.now()}.json`;
                a.click();
            });

        } catch (err) {
            resultBox.innerHTML = `<p class="error">Error: ${err.message}</p>`;
        } finally {
            auditBtn.disabled = false;
            auditBtn.innerText = 'Initialize Audit';
        }
    });
});
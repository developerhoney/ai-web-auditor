document.addEventListener('DOMContentLoaded', () => {
    const auditBtn = document.getElementById('audit-btn');
    const urlInput = document.getElementById('url-input');
    const resultBox = document.getElementById('result-box');
    let currentAuditData = null;

    auditBtn.addEventListener('click', async () => {
        const targetUrl = urlInput.value.trim();

        if (!targetUrl) {
            alert('Please enter a valid URL');
            return;
        }

        auditBtn.disabled = true;
        auditBtn.innerText = 'Analyzing...';
        resultBox.innerHTML = '<p class="status">Parsing DOM structure, benchmarking response speed, and querying AI insights...</p>';

        try {
            const response = await fetch('/api/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: targetUrl })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || `Server returned error (${response.status})`);
            }

            currentAuditData = data;

            const metrics = data.metrics || {};
            const seo = data.seo || {};

            const score = metrics.seoScore ?? 0;
            const loadTime = metrics.loadTimeMs ?? 'N/A';
            const isHttps = metrics.isHttps ? '✅ Enabled' : '❌ Insecure';
            const title = seo.title || 'N/A';
            const metaDesc = seo.metaDescription || 'N/A';
            const h1Count = seo.h1Count || 0;
            const totalImgs = seo.totalImages || 0;
            const missingAlt = seo.imagesMissingAlt || 0;
            const aiText = data.aiAnalysis || 'No AI insights generated.';

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
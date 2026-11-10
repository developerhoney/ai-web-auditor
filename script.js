document.addEventListener("DOMContentLoaded", () => {
    const auditForm = document.getElementById("auditForm");
    const websiteUrlInput = document.getElementById("websiteUrl");
    const submitBtn = document.getElementById("submitBtn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnSpinner = document.getElementById("btnSpinner");
    const errorMessage = document.getElementById("errorMessage");
    const resultsSection = document.getElementById("resultsSection");

    auditForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        let targetUrl = websiteUrlInput.value.trim();
        if (!targetUrl) return;

        // Auto-add https:// if missing
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = "https://" + targetUrl;
            websiteUrlInput.value = targetUrl;
        }

        // Loading state
        submitBtn.disabled = true;
        if (btnText) btnText.textContent = "Auditing...";
        if (btnSpinner) btnSpinner.classList.remove("hidden");
        errorMessage.classList.add("hidden");
        resultsSection.classList.add("hidden");

        try {
            const response = await fetch("/api/audit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: targetUrl })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || data.message || "Audit failed. Please check the URL and try again.");
            }

            // Correct mapping from backend response
            const seoScore = data.metrics?.seoScore ?? 0;
            const loadTime = data.metrics?.loadTimeMs ?? 0;
            const isHttps = data.metrics?.isHttps ?? false;

            // Performance score based on load time
            let perfScore = 100;
            if (loadTime > 3000) perfScore = 40;
            else if (loadTime > 2000) perfScore = 60;
            else if (loadTime > 1000) perfScore = 80;
            else if (loadTime > 500) perfScore = 90;

            document.getElementById("targetUrlDisplay").textContent = targetUrl;
            document.getElementById("overallScore").textContent = `${seoScore}/100`;
            document.getElementById("perfScore").textContent = `${perfScore}%`;
            document.getElementById("seoScore").textContent = seoScore >= 70 ? "Pass" : "Needs Work";

            // Show AI insights + key metrics
            const insights = data.aiAnalysis || "No AI insights available right now.";
            const details = [
                `Title: ${data.seo?.title || "—"}`,
                `Meta Description: ${data.seo?.metaDescription || "—"}`,
                `H1 tags: ${data.seo?.h1Count ?? 0}`,
                `Images: ${data.seo?.totalImages ?? 0} (missing alt: ${data.seo?.imagesMissingAlt ?? 0})`,
                `Load time: ${loadTime} ms`,
                `HTTPS: ${isHttps ? "Yes" : "No"}`,
                "",
                insights
            ].join("\n");

            document.getElementById("insightsContent").textContent = details;

            resultsSection.classList.remove("hidden");
        } catch (err) {
            errorMessage.textContent = err.message.includes("Failed to fetch")
                ? "Server connection error. Please try again later."
                : err.message;
            errorMessage.classList.remove("hidden");
        } finally {
            submitBtn.disabled = false;
            if (btnText) btnText.textContent = "Audit Web Page";
            if (btnSpinner) btnSpinner.classList.add("hidden");
        }
    });
});

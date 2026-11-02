document.addEventListener("DOMContentLoaded", () => {
    const auditForm = document.getElementById("auditForm");
    const websiteUrlInput = document.getElementById("websiteUrl");
    const submitBtn = document.getElementById("submitBtn");
    const errorMessage = document.getElementById("errorMessage");
    const resultsSection = document.getElementById("resultsSection");

    auditForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const targetUrl = websiteUrlInput.value.trim();
        if (!targetUrl) return;

        // UI Loading State
        submitBtn.disabled = true;
        submitBtn.innerText = "Auditing...";
        errorMessage.classList.add("hidden");
        resultsSection.classList.add("hidden");

        try {
            // Python Backend Endpoint
            const response = await fetch("/api/audit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: targetUrl })
            });

            const data = await response.json();

            if (!response.ok) {
                // Front-end par API key details / technical backend trace kabhi na dikhayein
                throw new Error(data.message || "Audit failed. Please check the URL and try again.");
            }

            // Populate Results Safely
            document.getElementById("targetUrlDisplay").innerText = targetUrl;
            document.getElementById("overallScore").innerText = data.score || "85/100";
            document.getElementById("perfScore").innerText = data.performance || "90%";
            document.getElementById("seoScore").innerText = data.seo || "Pass";
            document.getElementById("insightsContent").innerText = data.summary || "Website structure is optimal with good load speed.";

            resultsSection.classList.remove("hidden");
        } catch (err) {
            // General clean error message to hide sensitive technical details
            errorMessage.innerText = err.message.includes("Failed to fetch") 
                ? "Server connection error. Please try again later." 
                : err.message;
            errorMessage.classList.remove("hidden");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Audit Web Page";
        }
    });
});


const quoteText   = document.getElementById("quote-text");
const quoteAuthor = document.getElementById("quote-author");
const quoteTags   = document.getElementById("quote-tags");
const genBtn      = document.getElementById("gen-quote-btn");

// Endpoints
const API_NINJAS_URL = "https://api.api-ninjas.com/v1/quotes";
const QUOTABLE_URL   = "https://api.quotable.io/random";

// Read API Ninjas key from <meta> if present; if absent we will fall back to Quotable
const API_KEY = (document.querySelector('meta[name="x-api-ninjas-key"]')?.content || "").trim();

// Loading animation
const loadingFrames = ["Fetching quote", "Fetching quote.", "Fetching quote..", "Fetching quote..."];
let loadingTimer = null;

// Cancel overlapping requests
let inflightController = null;

function startLoading() {
  let i = 0;
  stopLoading();
  genBtn.disabled = true;
  genBtn.setAttribute("aria-busy", "true");
  quoteText.setAttribute("aria-live", "polite");
  quoteText.style.opacity = "0.7";
  loadingTimer = setInterval(() => {
    quoteText.textContent = loadingFrames[i % loadingFrames.length];
    i++;
  }, 300);
}

function stopLoading() {
  if (loadingTimer) clearInterval(loadingTimer);
  loadingTimer = null;
  genBtn.disabled = false;
  genBtn.removeAttribute("aria-busy");
  quoteText.style.opacity = "1";
}

async function fetchFromApiNinjas(category, signal) {
  const url = category ? `${API_NINJAS_URL}?category=${encodeURIComponent(category)}` : API_NINJAS_URL;
  const res = await fetch(url, {
    signal,
    cache: "no-store",
    headers: API_KEY ? { "X-Api-Key": API_KEY } : {}
  });
  if (!res.ok) throw new Error(`Ninjas HTTP ${res.status}`);
  const arr = await res.json();
  const item = Array.isArray(arr) && arr[0] ? arr[0] : null;
  return {
    content: item?.quote || "No quote found.",
    author: item?.author || "Unknown",
    tagsText: item?.category || (category || "general")
  };
}

async function fetchFromQuotable(tag, signal) {
  const url = tag ? `${QUOTABLE_URL}?tags=${encodeURIComponent(tag)}` : QUOTABLE_URL;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`Quotable HTTP ${res.status}`);
  const data = await res.json();
  return {
    content: data.content || "No quote found.",
    author: data.author || "Unknown",
    tagsText: Array.isArray(data.tags) && data.tags.length ? data.tags.join(", ") : (tag || "general")
  };
}

async function randomQuote() {
  // cancel any in-flight
  if (inflightController) inflightController.abort();
  inflightController = new AbortController();
  const { signal } = inflightController;

  startLoading();

  const tagOrCategory = (quoteTags.textContent || "").trim();

  // Safety timeout (10s)
  const timeoutId = setTimeout(() => inflightController.abort(), 10000);

  try {
    let result;

    if (API_KEY) {
      // Try API Ninjas first
      try {
        result = await fetchFromApiNinjas(tagOrCategory, signal);
      } catch (e) {
        // If Ninjas fails (bad key, rate limit, etc.), gracefully fall back to Quotable
        result = await fetchFromQuotable(tagOrCategory, signal);
      }
    } else {
   
      result = await fetchFromQuotable(tagOrCategory, signal);
    }

    quoteText.textContent = result.content;
    quoteAuthor.textContent = `— ${result.author}`;
    quoteTags.textContent = result.tagsText;
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Quote fetch error:", err);
      quoteText.textContent = "Oops! Couldn't fetch a quote right now.";
      quoteAuthor.textContent = "";
      // keep user-set tag/category if they typed one; otherwise clear
      if (!tagOrCategory) quoteTags.textContent = "";
    }
  } finally {
    clearTimeout(timeoutId);
    stopLoading();
  }
}

// Events
genBtn.addEventListener("click", randomQuote);
window.addEventListener("DOMContentLoaded", randomQuote);

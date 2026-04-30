import { HouseStats } from "../types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateSportsCommentary = async (stats: HouseStats[], retryCount = 0): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not found. Please configure the environment.";
  }

  // Format stats for the prompt
  const statsString = stats
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((s, i) => `${i + 1}. ${s.house}: ${s.totalPoints} mata (Emas: ${s.gold}, Perak: ${s.silver})`)
    .join('\n');

  const prompt = `
    Anda adalah pengulas sukan yang sangat bertenaga, kelakar, dan menghiburkan untuk Kejohanan Sukan Olahraga Seputra!
    Berdasarkan kedudukan terkini rumah sukan:
    ${statsString}
    
    Berikan SATU ayat ulasan ringkas (maksimum 15-20 patah perkataan) yang sangat "best", penuh emosi, dan menghiburkan.
    Gunakan gaya bahasa santai, bersemangat, dan masukkan emoji yang sesuai.
    Contoh: "Fuhhh! Rumah Merah memecut laju tinggalkan pesaing lain! 🚀 Rumah Biru kena bangun cepat ni! 🏃‍♂️💨"
    Atau: "Persaingan makin panas gais! 🔥 Rumah Hijau dan Kuning berentap sengit nak rebut tempat ketiga! 😱"
    Jangan bagi senarai. Hanya satu ayat ulasan "Breaking News" yang padu!
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    if (!response.ok) {
        const errorBody = await response.json();
        throw errorBody;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return text || "Tiada ulasan tersedia buat masa ini.";
  } catch (error: any) {
    // Robust Error Parsing
    const errorBody = error.error || error; // Handle { error: { code: ... } } structure
    const errorCode = errorBody.code || errorBody.status || error.status;
    const errorMessage = errorBody.message || error.message || JSON.stringify(error);
    const errorStatus = errorBody.status || ''; // e.g. "RESOURCE_EXHAUSTED"

    const isRateLimit = 
        errorCode === 429 || 
        errorCode === 503 || 
        errorStatus === 'RESOURCE_EXHAUSTED' ||
        errorMessage.includes('429') || 
        errorMessage.includes('quota') || 
        errorMessage.includes('exhausted');

    if (isRateLimit) {
        console.warn(`Gemini API Rate Limit hit (Attempt ${retryCount + 1}/4). Waiting to retry...`);
        
        if (retryCount < 3) {
            // Exponential backoff: 2s, 4s, 8s + random jitter
            const delay = Math.pow(2, retryCount + 1) * 1000 + Math.random() * 1000;
            await wait(delay);
            return generateSportsCommentary(stats, retryCount + 1);
        }
        
        return "Pengulas sukan sedang berehat (Had Kuota Dicapai). Sila cuba sebentar lagi.";
    }

    // Log actual errors that are not rate limits
    console.error("Gemini API Error:", error);
    return "Maaf, pengulas sukan sedang berehat sebentar (Ralat Sambungan).";
  }
};
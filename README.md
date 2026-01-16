# Eri Chat (Eriお出かけチャット) / Outdoor AI

This is my submission for the generative AI technical assignment. The goal was to build a weather-aware chatbot that supports Japanese voice input and provides intelligent travel/outdoor recommendations.

---

## Demo
<p align="center">
  <a href="https://drive.google.com/file/d/1JH_egyjdM99gY9LIVaE_tVZER6pZ66by/view?usp=sharing" target="_blank">
    <img src="public/preview.gif" width="100%" alt="Eri Chat Preview - Click to watch demo">
  </a>
  <br>
  <strong>▶️ [Watch the full Demo Video on Google Drive](https://drive.google.com/file/d/1JH_egyjdM99gY9LIVaE_tVZER6pZ66by/view?usp=sharing)</strong>
</p>

---

## Features

- **Japanese Voice Input**: Built with Groq's Whisper-v3 for fast, accurate Japanese transcription. I added a live audio waveform so users have visual feedback while speaking.
- **Weather Integration**: It doesn't just check the current temp; it can pull 5-day forecasts from OpenWeatherMap to give better advice for longer trips.
- **Resilient AI Stack**: To handle high traffic or rate limits, I built a 3-tier fallback system. It defaults to Llama 3.3 70B for the best reasoning, but can automatically switch to Llama 4 Scout or Llama 8B if needed.
- **Atmosphere**: I added a custom CSS-driven Sakura falling effect. It's designed to be lightweight so it doesn't slow down the site, with petals distributed to keep the chat area readable.
- **Bilingual Design**: Fully supports both Japanese and English. It uses strict system prompts to ensure it never "hallucinates" or gives advice based on the wrong city.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS / Glassmorphism
- **AI Engine**: Groq SDK (Llama 3.3 70B, Llama 4 Scout, Whisper-large-v3)
- **Weather Data**: OpenWeatherMap API
- **Icons**: Lucide React

---

## Setup

1. **Install**:
   ```bash
   git clone https://github.com/hxrshxz/outdoor-ai.git
   cd outdoor-ai
   npm install
   ```
2. **Env Vars**: Create a `.env.local` file with your `GROQ_API_KEY` and `OPENWEATHER_API_KEY`.
3. **Run**: `npm run dev`

---

Built with care by Harsh Kumar.

# Rev Voice (Gemini Live) — Revolt Motors Voice Chat  

A real-time voice interface replicating Revolt Motors’ **“Rev” chatbot** using the Gemini Live API.  
It enables **low-latency streaming conversations**, **natural interruptions (barge-in)**, and **multilingual replies** in a clean browser-based UI.  

---

## 🚀 Features  
- ⚡ Real-time voice dialog with ~1–2s first-audio latency  
- 🎤 Natural **barge-in**: interrupt model speech instantly  
- 🔒 Server-to-server architecture (API key safe on backend)  
- 🌍 Multilingual replies (auto-detect or force per-session language)  
- 🎛️ UI includes mic button, waveform, latency pill, optional captions  

---

## 📹 Demo Submission  
1. Record a **30–60s screen capture** showing: 
   - Natural conversation (ask a question + follow-up)  
   - Mid-response interruption (double-click mic to stop TTS, then speak again)  
   - Latency pill when first audio chunk arrives  
2. Upload video to **Google Drive** with link sharing set to:  
   > “Anyone with the link: Viewer”  

3. Check out the working demo here:  
🎥 [Rev Voice Demo Video](https://drive.google.com/file/d/1zxp2BR7v0Fl0FrTTHsAragYtYjXtQTm5/view?usp=sharing)

---

## 🏗️ Architecture  

**Frontend**  
- Captures mic audio (PCM16 mono, 16 kHz) → WebSocket → backend  
- Plays streamed PCM16 mono, 24 kHz model audio  
- Supports barge-in cut(), waveform visualization, captions  

**Backend**  
- Node/Express server hosts Gemini Live session (server-to-server)  
- Forwards audio/text to Gemini Live, streams audio back  
- Manages session lifecycle, interruptions, WAV fallback  

---

## 🛠️ Tech Stack  
- **Backend:** Node.js (Express), WebSocket, dotenv, CORS, UUID  
- **Gemini SDK:** Google GenAI SDK (Live API)  
- **Frontend:** Web Audio API, HTML/CSS/JS  

---

## 📦 Prerequisites  
- Node.js 18+  
- Google AI Studio API key  
- Chromium-based browser with mic access  

---

## ⚙️ Getting Started  

```bash
# Clone & install
git clone <your-repo-url>
cd <repo>
npm install

# Configure environment
cp .env.example .env
# Add your API key and config:
# GEMINI_API_KEY=YOUR_API_KEY
# PORT=3000
# GEMINI_MODEL=gemini-2.5-flash-preview-native-audio-dialog

# Run
npm run dev
# Revolt-Motors-Gemini-API

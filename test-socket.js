const { io } = require("socket.io-client");

// Kopyaladığın o uzun anahtarı buraya koy:
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjMWE2MGM4ZS02OTQwLTQxNmMtOWMzZC00YjM1YmZmYWY2MzUiLCJyb2xlIjoiU0FMRVMiLCJpYXQiOjE3ODI5MDUyMDIsImV4cCI6MTc4Mjk5MTYwMn0.N-D827gCbWagYOz0Aib6avQauCaB61l23KPS2fnS_bg"; 

console.log("Sunucuya bağlanılıyor...");

// DİKKAT 1: URL'in sonuna direkt /events ekledik (Namespace mantığı)
// DİKKAT 2: Ajanın yazdığı "mobil cihaz" doğrulama mantığını (auth.token) kullanıyoruz.
const socket = io("http://localhost:3001/events", { 
  auth: {
    token: TOKEN
  }
});

socket.on("connect", () => {
  console.log("✅ BAĞLANTI BAŞARILI! Kimlik doğrulandı. Socket ID:", socket.id);
});

socket.on("connect_error", (err) => {
  console.log("❌ BAĞLANTI REDDEDİLDİ:", err.message);
});

socket.on("applicationClaimed", (data) => {
  console.log("🚀 CANLI SİNYAL YAKALANDI [applicationClaimed]:", data);
});

socket.on("stageChanged", (data) => {
  console.log("🚀 CANLI SİNYAL YAKALANDI [stageChanged]:", data);
});
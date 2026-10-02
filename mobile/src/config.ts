// Sunucu adresi sabittir; uygulama kullanıcıya sormaz. Bilerek env ile
// geçersiz kılınamaz: Metro'nun çalıştığı makinedeki bir .env'de kalan LAN
// adresi (örn. EXPO_PUBLIC_API_URL=http://192.168.1.100:4000) bundle'a
// gömülüp tüm cihazlarda kullanılıyordu.
export const API_BASE_URL = 'https://api.oids.com.tr';

// Backend Node/Express API adresi. Fiziksel cihazda "localhost" çalışmaz;
// bilgisayarın LAN IP adresi kullanılmalıdır (örn. http://192.168.1.100:4000).
// .env dosyasında EXPO_PUBLIC_API_URL ile geçersiz kılınabilir.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:4000';

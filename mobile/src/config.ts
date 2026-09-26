// Sunucu adresi ekranındaki kutuya varsayılan olarak doldurulur; kullanıcı
// değiştirebilir ve cihazda saklanır. Bilerek env ile geçersiz kılınamaz:
// Metro'nun çalıştığı makinedeki bir .env'de kalan LAN adresi (örn.
// EXPO_PUBLIC_API_URL=http://192.168.1.100:4000) bundle'a gömülüp tüm
// cihazlarda varsayılan olarak görünüyordu.
export const DEFAULT_API_URL = 'https://api.oids.com.tr';

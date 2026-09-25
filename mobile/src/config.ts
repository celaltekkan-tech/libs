// Sunucu adresi ekranındaki kutuya varsayılan olarak doldurulur; kullanıcı
// değiştirebilir. Geliştirme sırasında .env dosyasında EXPO_PUBLIC_API_URL ile
// geçersiz kılınabilir.
export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.oids.com.tr';

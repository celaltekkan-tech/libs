// Sunucu adresi ekranında öneri (placeholder) olarak gösterilir; uygulama bu
// değeri otomatik kullanmaz. Geliştirme sırasında hızlı doldurmak isterseniz
// .env dosyasında EXPO_PUBLIC_API_URL ile geçersiz kılabilirsiniz.
export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:4000';

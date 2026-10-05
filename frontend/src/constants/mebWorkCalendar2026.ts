export interface MebCalendarItem {
  title: string
  start: string
  end: string
}

/** MEB 2026-2027 çalışma takvimi. Okul gününü ilgilendiren başlıklar. */
export const MEB_WORK_CALENDAR_2026: MebCalendarItem[] = [
  { title: 'Öğretmenlerin göreve başlaması', start: '2026-09-01', end: '2026-09-01' },
  { title: 'Uyum eğitimleri', start: '2026-09-07', end: '2026-09-11' },
  { title: 'Eğitim öğretim yılının başlaması', start: '2026-09-14', end: '2026-09-14' },
  { title: 'Sorumluluk ve hazırlık yeterlilik sınavları', start: '2026-09-14', end: '2026-09-25' },
  { title: '15 Temmuz Demokrasi ve Millî Birlik Günü anma', start: '2026-09-21', end: '2026-09-25' },
  { title: 'Atatürk Haftası', start: '2026-11-10', end: '2026-11-15' },
  { title: '1. dönem ara tatili', start: '2026-11-16', end: '2026-11-20' },
  { title: 'Öğretmenler Günü', start: '2026-11-24', end: '2026-11-24' },
  { title: 'Yılbaşı tatili', start: '2027-01-01', end: '2027-01-01' },
  { title: '1. dönemin sona ermesi', start: '2027-01-22', end: '2027-01-22' },
  { title: 'Yarıyıl tatili', start: '2027-01-25', end: '2027-02-05' },
  { title: '2. dönemin başlaması', start: '2027-02-08', end: '2027-02-08' },
  { title: 'Sorumluluk sınavları (2. dönem)', start: '2027-02-08', end: '2027-02-19' },
  { title: '2. dönem ara tatili', start: '2027-03-08', end: '2027-03-12' },
  { title: 'Ramazan Bayramı', start: '2027-03-08', end: '2027-03-11' },
  { title: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı', start: '2027-04-23', end: '2027-04-23' },
  { title: 'Emek ve Dayanışma Günü', start: '2027-05-01', end: '2027-05-01' },
  { title: 'Kurban Bayramı', start: '2027-05-15', end: '2027-05-19' },
  { title: '19 Mayıs Atatürk’ü Anma, Gençlik ve Spor Bayramı', start: '2027-05-19', end: '2027-05-19' },
  { title: 'Sorumluluk sınavları (yıl sonu)', start: '2027-06-14', end: '2027-06-25' },
  { title: 'Ders yılının sona ermesi', start: '2027-06-25', end: '2027-06-25' },
]

export function mebItemsOnDay(day: string): MebCalendarItem[] {
  return MEB_WORK_CALENDAR_2026.filter((item) => day >= item.start && day <= item.end)
}

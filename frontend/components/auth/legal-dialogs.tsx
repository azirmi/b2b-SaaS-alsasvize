"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Fixed legal identity of the data controller / service provider. */
const COMPANY = "ALSAS Vize Danışmanlık (Merve Akın - Şahıs Şirketi)";

function TriggerLink({ children }: { children: ReactNode }) {
  return (
    <DialogTrigger asChild>
      <button
        type="button"
        className="font-medium text-foreground underline underline-offset-4 transition-opacity hover:opacity-70"
      >
        {children}
      </button>
    </DialogTrigger>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
  );
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function ScrollBody({ children }: { children: ReactNode }) {
  return (
    <div className="-mr-2 max-h-[60vh] space-y-5 overflow-y-auto pr-4">
      {children}
    </div>
  );
}

/* ==========================================================================
 *  KVKK Aydınlatma Metni
 * ======================================================================== */

export function KvkkDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <TriggerLink>{children}</TriggerLink>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>KVKK Aydınlatma Metni ve Açık Rıza Beyanı</DialogTitle>
          <DialogDescription>
            6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında
            bilgilendirme.
          </DialogDescription>
        </DialogHeader>

        <ScrollBody>
          <P>
            İşbu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması
            Kanunu (“KVKK”) kapsamında, {COMPANY} (“Şirket”) tarafından kişisel
            verilerinizin işlenmesine ilişkin usul ve esasları açıklamak
            amacıyla hazırlanmıştır.
          </P>

          <Section title="1. Veri Sorumlusu">
            <P>
              KVKK uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla{" "}
              {COMPANY} tarafından işlenmektedir.
            </P>
          </Section>

          <Section title="2. İşlenen Kişisel Veri Kategorileri">
            <List
              items={[
                "Kimlik bilgileri (ad, soyad, T.C. kimlik numarası, doğum tarihi, uyruk bilgisi)",
                "İletişim bilgileri (telefon, e-posta, adres)",
                "Pasaport ve seyahat bilgileri",
                "Finansal bilgiler (gelir durumu, banka dökümleri)",
                "Mesleki bilgiler",
                "Konaklama ve uçuş rezervasyon bilgileri",
                "Başvuru yapılan ülkeye ilişkin bilgiler",
                "Gerekli olması hâlinde özel nitelikli kişisel veriler",
              ]}
            />
            <P>
              Şirket, yalnızca hizmetin ifası için gerekli olan ölçüde veri
              işlemektedir.
            </P>
          </Section>

          <Section title="3. Kişisel Verilerin İşlenme Amaçları">
            <List
              items={[
                "Vize başvuru dosyasının hazırlanması",
                "Randevu işlemlerinin yürütülmesi",
                "Konsolosluk ve aracı kurum süreçlerinin takibi",
                "Hizmet sözleşmesinin kurulması ve ifası",
                "Hukuki yükümlülüklerin yerine getirilmesi",
                "Olası uyuşmazlıklarda delil teşkil etmesi",
              ]}
            />
          </Section>

          <Section title="4. Kişisel Verilerin Aktarılması">
            <P>
              Kişisel verileriniz; ilgili konsolosluklara, yetkili aracı
              kurumlara, başvuru yapılan ülkenin resmî makamlarına ve hukuken
              yetkili kamu kurumlarına aktarılabilmektedir.
            </P>
            <P>
              Başvuru yapılan ülke gereği verileriniz yurt dışına
              aktarılabilir. Bu aktarım, hizmetin ifası için zorunlu olup,
              ilgili yabancı ülke mevzuatına tabi olabilir. Şirket, hukuken
              zorunlu aktarım yapılan üçüncü tarafların veri işleme
              süreçlerinden sorumlu değildir.
            </P>
          </Section>

          <Section title="5. Hukuki Sebepler">
            <P>
              Kişisel verileriniz; KVKK m.5/2-c (sözleşmenin ifası), m.5/2-ç
              (hukuki yükümlülük), m.5/2-e (bir hakkın tesisi, kullanılması veya
              korunması) ve gerekli hâllerde açık rızanız kapsamında
              işlenmektedir.
            </P>
          </Section>

          <Section title="6. Veri Saklama Süresi">
            <P>
              Kişisel verileriniz; hizmet süresi boyunca, yasal zamanaşımı
              süreleri ve olası hukuki uyuşmazlık süresi boyunca saklanır.
              Sürenin sonunda mevzuata uygun şekilde silinir, yok edilir veya
              anonimleştirilir.
            </P>
          </Section>

          <Section title="7. KVKK Kapsamındaki Haklarınız">
            <P>
              KVKK’nın 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini
              öğrenme, düzeltilmesini isteme, silinmesini talep etme ve zarara
              uğramanız hâlinde tazminat talep etme haklarına sahipsiniz.
            </P>
          </Section>

          <Section title="Açık Rıza Beyanı">
            <P>
              KVKK kapsamında tarafıma sunulan Aydınlatma Metni’ni okuduğumu ve
              anladığımı beyan ederim. Vize danışmanlık hizmetinin
              yürütülebilmesi amacıyla kimlik, pasaport, finansal, seyahat ve
              gerekli olması hâlinde özel nitelikli kişisel verilerimin
              işlenmesine ve başvuru yapılan ülke gereği yurt dışındaki
              konsolosluk ve yetkili makamlara aktarılmasına açık rıza veriyorum.
            </P>
            <P>
              Elektronik ortamda verdiğim onayın geçerli, bağlayıcı ve delil
              niteliğinde olduğunu kabul ederim.
            </P>
          </Section>
        </ScrollBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Kapat
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==========================================================================
 *  Mesafeli Hizmet Satış Sözleşmesi ve Ön Bilgilendirme Metni
 * ======================================================================== */

export function TermsDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <TriggerLink>{children}</TriggerLink>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Mesafeli Hizmet Satış Sözleşmesi ve Ön Bilgilendirme Metni
          </DialogTitle>
          <DialogDescription>
            Vize danışmanlık hizmetine ilişkin tarafların hak ve
            yükümlülükleri.
          </DialogDescription>
        </DialogHeader>

        <ScrollBody>
          <Section title="Madde 1 — Taraflar">
            <P>
              <span className="font-medium text-foreground">
                Hizmet Sağlayıcı:
              </span>{" "}
              {COMPANY}. Bundan sonra sözleşmede “Şirket”, “Hizmet Sağlayıcı”
              veya “Alsas Vize” olarak anılacaktır.
            </P>
            <P>
              <span className="font-medium text-foreground">
                Hizmet Alan / Danışan / Müşteri:
              </span>{" "}
              İşbu kaydı oluşturan ve hesabında beyan ettiği kimlik ve iletişim
              bilgileri esas alınan kullanıcıdır. Bundan sonra sözleşmede
              “Müşteri”, “Danışan” veya “Hizmet Alan” olarak anılacaktır.
            </P>
            <P>Hizmet Türü: Vize Danışmanlık Hizmeti.</P>
          </Section>

          <Section title="Madde 2 — Sözleşmenin Konusu">
            <P>
              2.1. İşbu sözleşmenin konusu; Müşteri’nin talebi doğrultusunda
              Alsas Vize tarafından sağlanacak vize danışmanlık, evrak kontrol,
              başvuru formu yönlendirme, randevu süreci bilgilendirme, başvuru
              dosyası hazırlık desteği, ret sonrası değerlendirme, seyahat
              amacına uygun evrak listesi oluşturma ve süreç takibi hizmetlerine
              ilişkin tarafların hak ve yükümlülüklerinin belirlenmesidir.
            </P>
            <P>
              2.2. İşbu sözleşme, vize başvurusunun sonucunu garanti eden bir
              sözleşme değildir. Alsas Vize; konsolosluk, büyükelçilik, vize
              başvuru merkezi, aracı kurum, resmi kurum veya yabancı ülke makamı
              değildir.
            </P>
            <P>
              2.3. Vize başvurusu hakkında nihai karar; ilgili ülkenin
              konsolosluğu, büyükelçiliği, göç idaresi, sınır güvenliği birimi
              veya yetkili resmi makamları tarafından verilir. Alsas Vize’nin bu
              karar üzerinde doğrudan veya dolaylı belirleyici yetkisi
              bulunmamaktadır.
            </P>
          </Section>

          <Section title="Madde 3 — Hizmetin Kapsamı">
            <P>
              3.1. Alsas Vize, Müşteri’nin satın aldığı hizmet paketine göre
              aşağıdaki hizmetlerden birini veya birkaçını sunabilir:
            </P>
            <List
              items={[
                "Başvuru yapılacak ülke ve vize türüne göre evrak listesi hazırlanması,",
                "Müşteri tarafından iletilen evrakların danışmanlık kapsamında kontrol edilmesi,",
                "Eksik veya riskli görülen belgeler hakkında bilgilendirme yapılması,",
                "Başvuru formunun doldurulmasına ilişkin yönlendirme sağlanması,",
                "Randevu sürecine ilişkin bilgilendirme yapılması,",
                "Uygun olması halinde başvuru merkezi / konsolosluk sistemi üzerinden randevu takibine destek verilmesi,",
                "Seyahat amacına uygun niyet dilekçesi / başvuru açıklama metni taslağı hazırlanması,",
                "Ret sonrası dosya ön değerlendirmesi yapılması,",
                "Müşteri’nin talep ettiği başvuru türüne göre süreç takibi yapılması.",
              ]}
            />
            <P>
              3.2. Alsas Vize’nin hizmeti, danışmanlık ve süreç yönlendirme
              hizmeti ile sınırlıdır. Konsolosluk harcı, başvuru merkezi hizmet
              bedeli, biyometri işlemi, seyahat sağlık sigortası, uçak
              rezervasyonu, otel rezervasyonu, noter, tercüme, kargo, kurye,
              fotoğraf, banka masrafı, apostil, resmi kurum harcı ve benzeri
              üçüncü kişi / kurum ödemeleri hizmet bedeline dahil değildir;
              ayrıca belirtilmediği sürece Müşteri’ye aittir.
            </P>
            <P>
              3.3. Müşteri’nin satın aldığı hizmet paketi dışında ek hizmet
              talep etmesi halinde, bu hizmet ayrıca ücretlendirilir.
            </P>
          </Section>

          <Section title="Madde 4 — Vize Sonucuna İlişkin Garanti Verilmediği">
            <P>4.1. Alsas Vize hiçbir şekilde;</P>
            <List
              items={[
                "Vizenin kesin olarak çıkacağını,",
                "Başvurunun onaylanacağını,",
                "Randevunun belirli bir tarihte alınacağını,",
                "Konsolosluğun belirli sürede sonuç vereceğini,",
                "Daha önce ret alan başvurunun mutlaka olumlu sonuçlanacağını,",
                "Uzun süreli veya çok girişli vize alınacağını taahhüt etmez.",
              ]}
            />
            <P>
              4.2. Müşteri, vize başvurularının ilgili ülke makamlarının
              takdirinde olduğunu; Alsas Vize’nin yalnızca profesyonel
              danışmanlık, evrak kontrol ve süreç yönlendirme hizmeti sunduğunu
              kabul eder.
            </P>
            <P>
              4.3. Reklam, sosyal medya paylaşımı, müşteri yorumu, örnek başvuru
              sonucu, daha önce alınmış vizeler veya danışan deneyimleri, Müşteri
              açısından aynı sonucun gerçekleşeceği anlamına gelmez.
            </P>
          </Section>

          <Section title="Madde 5 — Müşterinin Beyan ve Yükümlülükleri">
            <P>
              5.1. Müşteri, Alsas Vize’ye ilettiği tüm bilgi, belge, beyan ve
              evrakların doğru, güncel, eksiksiz ve gerçeğe uygun olduğunu kabul
              eder.
            </P>
            <P>
              5.2. Eksik, hatalı, gerçeğe aykırı, yanıltıcı veya sahte belge
              sunulması nedeniyle doğabilecek ret, randevu iptali, başvuru reddi,
              işlem gecikmesi, idari yaptırım, seyahat kaybı, maddi zarar veya
              üçüncü kişi taleplerinden Alsas Vize sorumlu tutulamaz.
            </P>
            <P>
              5.3. Müşteri; pasaport geçerliliği, önceki vize retleri, giriş-çıkış
              kayıtları, finansal durum, çalışma durumu, öğrenci durumu, seyahat
              amacı, sponsor bilgileri ve aile bağları dahil olmak üzere başvuru
              sonucunu etkileyebilecek tüm hususları eksiksiz bildirmekle
              yükümlüdür.
            </P>
            <P>
              5.4. Müşteri’nin belgeleri geç iletmesi, randevuya katılmaması,
              biyometri vermemesi, başvuru merkezine zamanında gitmemesi,
              konsolosluğun ek belge taleplerini süresinde karşılamaması veya
              iletişim kanallarından ulaşılamaması nedeniyle doğacak sonuçlardan
              Müşteri sorumludur.
            </P>
            <P>
              5.5. Müşteri, vize başvurusuna konu tüm belgelerin kendisi
              tarafından temin edildiğini; Alsas Vize’nin resmi belge
              üretmediğini, sahte belge temin etmediğini, resmi makamlar adına
              karar vermediğini kabul eder.
            </P>
          </Section>

          <Section title="Madde 6 — Alsas Vize’nin Yükümlülükleri">
            <P>
              6.1. Alsas Vize, Müşteri tarafından bildirilen bilgiler ve iletilen
              belgeler doğrultusunda makul mesleki özen çerçevesinde danışmanlık
              hizmeti sunar.
            </P>
            <P>
              6.2. Alsas Vize, başvuru yapılacak ülke ve vize türüne göre
              Müşteri’ye genel evrak listesi ve süreç bilgilendirmesi
              sağlayabilir. Ancak ilgili ülke makamlarının başvuru şartlarını,
              belge taleplerini, randevu sistemini, değerlendirme kriterlerini ve
              işlem sürelerini değiştirmesi halinde Alsas Vize bu değişikliklerden
              sorumlu değildir.
            </P>
            <P>
              6.3. Alsas Vize, Müşteri’nin sunduğu belgelerin resmi doğruluğunu,
              belge içeriğinin gerçekliğini, banka kayıtlarının fiili
              geçerliliğini veya üçüncü kurumlar nezdindeki hukuki durumunu
              garanti etmez.
            </P>
            <P>
              6.4. Alsas Vize, hizmeti kendi operasyonel planı dahilinde telefon,
              WhatsApp, e-posta, online panel, görüntülü görüşme veya yüz yüze
              görüşme ile sunabilir.
            </P>
          </Section>

          <Section title="Madde 7 — Randevu, Başvuru Tarihi ve Süreç Değişiklikleri">
            <P>
              7.1. Vize randevularının açılması, randevu takvimi, sistem
              yoğunluğu, başvuru merkezi kapasitesi, konsolosluk çalışma düzeni ve
              resmi tatiller Alsas Vize’nin kontrolü dışındadır.
            </P>
            <P>
              7.2. Müşteri, belirli bir tarihe randevu alınacağının veya
              başvurunun belirli tarihte sonuçlanacağının garanti edilmediğini
              kabul eder.
            </P>
            <P>
              7.3. Randevu alınamaması, sistemsel hata, başvuru merkezinin işlem
              kabul etmemesi, ülke politikalarının değişmesi, konsolosluk ek belge
              talebi, pasaport iadesinin gecikmesi veya sonuç süresinin uzaması
              nedeniyle uçak bileti, otel, tur, organizasyon, iş, okul veya
              benzeri kayıplardan Alsas Vize sorumlu tutulamaz.
            </P>
            <P>
              7.4. Alsas Vize, Müşteri’nin talebi üzerine randevu takibi
              yapabilir; ancak randevu alınması başvuru merkezi / konsolosluk
              sistemindeki uygunluk durumuna bağlıdır.
            </P>
          </Section>

          <Section title="Madde 8 — Hizmet Bedeli ve Ödeme">
            <P>
              8.1. Müşteri, satın aldığı danışmanlık hizmetine ilişkin bedeli
              sözleşmede belirtilen ödeme yöntemiyle ödemeyi kabul eder.
            </P>
            <P>
              8.2. Hizmet bedeli, aksi yazılı olarak belirtilmedikçe yalnızca
              Alsas Vize danışmanlık hizmetini kapsar. Konsolosluk harcı, başvuru
              merkezi bedeli, sigorta, tercüme, noter, kargo, fotoğraf, rezervasyon
              ve benzeri giderler ayrıca tahsil edilir veya Müşteri tarafından
              doğrudan ilgili kuruma ödenir.
            </P>
            <P>
              8.3. Ödeme tamamlanmadan Alsas Vize’nin hizmete başlama yükümlülüğü
              doğmaz.
            </P>
            <P>
              8.4. Müşteri’nin hizmet bedelini eksik veya geç ödemesi nedeniyle
              hizmetin geç başlamasından, randevu veya başvuru fırsatlarının
              kaçırılmasından Alsas Vize sorumlu değildir.
            </P>
            <P>
              8.5. Kredi kartı, sanal POS, banka, ödeme kuruluşu veya aracı ödeme
              sistemi kaynaklı komisyon, iade süresi, bloke, provizyon veya teknik
              aksaklıklar ilgili kurumların prosedürlerine tabidir.
            </P>
            <P>
              8.6. Fatura, hizmete ilişkin danışmanlık ve başvuru sürecinin
              tamamlanmasının ardından, yürürlükteki mevzuata uygun şekilde
              düzenlenir ve Müşteri’ye iletilir.
            </P>
          </Section>

          <Section title="Madde 9 — Cayma Hakkı, İptal ve İade Koşulları">
            <P>
              9.1. Müşteri, tüketici sıfatıyla hareket ediyorsa, mesafeli
              sözleşmeler mevzuatı kapsamında kural olarak 14 gün içinde herhangi
              bir gerekçe göstermeksizin cayma hakkına sahiptir.
            </P>
            <P>
              9.2. Ancak Müşteri’nin açık talebi, onayı ve bilgilendirilmesi
              üzerine cayma hakkı süresi dolmadan hizmetin ifasına başlanması
              halinde; sunulan danışmanlık, evrak kontrolü, dosya hazırlığı,
              randevu takibi, form hazırlığı, belge incelemesi, kişiye özel
              yönlendirme ve operasyonel işlem kapsamında, mevzuatın izin verdiği
              ölçüde cayma / iade hakkı sınırlanabilir.
            </P>
            <P>
              9.3. Müşteri aşağıdaki onayı verdiği takdirde, hizmetin derhal
              başlatılmasını talep etmiş sayılır: “Mesafeli hizmet sözleşmesi
              kapsamında satın aldığım vize danışmanlık hizmetinin, 14 günlük
              cayma süresi dolmadan Alsas Vize tarafından başlatılmasını açıkça
              talep ediyorum. Hizmetin ifasına başlanması halinde, mevzuatın
              öngördüğü ölçüde cayma hakkımı kaybedebileceğim konusunda
              bilgilendirildim ve bunu kabul ediyorum.”
            </P>
            <P>
              9.4. Hizmet hiç başlamamışsa ve Müşteri süresi içinde cayma hakkını
              kullanırsa, tahsil edilen hizmet bedeli yasal süre ve ödeme kuruluşu
              prosedürleri dikkate alınarak iade edilir.
            </P>
            <P>
              9.5. Hizmetin kısmen veya tamamen sunulmuş olması, Müşteri’ye özel
              dosya çalışması yapılması, evrak kontrolü gerçekleştirilmesi, başvuru
              formu / dilekçe / belge yönlendirmesi hazırlanması, randevu takibi
              başlatılması, danışmanlık görüşmesi yapılması veya operasyonel kaynak
              ayrılması halinde, iade talebi sunulan hizmet ve yapılan işlem
              oranında değerlendirilir.
            </P>
            <P>
              9.6. Müşteri’nin başvurudan vazgeçmesi, seyahat planını
              değiştirmesi, evrak temin edememesi, randevuya gitmemesi, vize
              başvurusunu kendi isteğiyle durdurması, başka danışmanla çalışmaya
              karar vermesi veya başvuru ülkesini değiştirmesi halinde, Alsas Vize
              tarafından başlanmış veya sunulmuş hizmetlere ilişkin ücret iadesi
              talep edilemez.
            </P>
            <P>
              9.7. Vize reddi, başvurunun geç sonuçlanması, konsolosluğun ek belge
              istemesi, randevu sisteminde uygun tarih bulunmaması veya resmi makam
              kaynaklı olumsuzluklar, Alsas Vize’nin hizmet bedelini otomatik olarak
              iade etmesini gerektirmez.
            </P>
            <P>
              9.8. Vize başvurusunun ilgili makamlar tarafından reddedilmesi
              halinde, Müşteri’nin talebi üzerine ikinci başvuruya ilişkin
              danışmanlık hizmeti Alsas Vize tarafından ek danışmanlık hizmet
              bedeli alınmadan ücretsiz olarak sağlanır. Bu ücretsiz hizmet yalnızca
              danışmanlık hizmet bedelini kapsar; konsolosluk harcı, başvuru merkezi
              hizmet bedeli, sigorta, tercüme, noter, kargo, fotoğraf, rezervasyon
              ve benzeri üçüncü kişi / kurum ödemeleri Müşteri’ye aittir.
            </P>
            <P>
              9.9. Alsas Vize’nin kusurundan kaynaklanan ve hizmetin hiç
              sunulmadığının açıkça tespit edildiği hallerde, Müşteri’nin yasal
              hakları saklıdır.
            </P>
          </Section>

          <Section title="Madde 10 — Hizmetin Değişmesi, Ertelenmesi ve Sonlandırılması">
            <P>
              10.1. Başvuru yapılacak ülkenin vize politikası, randevu sistemi,
              belge listesi, işlem süresi veya başvuru usulünde değişiklik olması
              halinde Alsas Vize, hizmet yöntemini güncel koşullara göre
              değiştirebilir.
            </P>
            <P>
              10.2. Müşteri’nin eksik / hatalı belge sunması, ödeme yapmaması,
              iletişime cevap vermemesi, yanıltıcı bilgi vermesi, sahte belge
              sunması, şirket çalışanlarına hakaret / tehdit / baskı içeren
              davranışlarda bulunması veya işbu sözleşmeye aykırı hareket etmesi
              halinde Alsas Vize hizmeti askıya alabilir veya sözleşmeyi
              feshedebilir.
            </P>
            <P>
              10.3. Bu durumda, Alsas Vize’nin o ana kadar sunduğu hizmetlere
              ilişkin ücret talep hakkı saklıdır.
            </P>
            <P>
              10.4. Alsas Vize, hukuka aykırı belge, sahte evrak, yanıltıcı beyan
              veya resmi makamları yanıltmaya yönelik herhangi bir işlem talebini
              reddetme hakkına sahiptir.
            </P>
          </Section>

          <Section title="Madde 11 — Sorumluluğun Sınırlandırılması">
            <P>
              11.1. Alsas Vize’nin sorumluluğu, yalnızca sunduğu danışmanlık
              hizmetinin sözleşmeye uygun şekilde ifa edilip edilmediği ile
              sınırlıdır.
            </P>
            <P>
              11.2. Alsas Vize; konsolosluk kararı, başvuru merkezi uygulaması,
              randevu sistemi, resmi kurum gecikmesi, ülke politikası değişikliği,
              ek belge talebi, pasaport teslim süresi, sınır kapısı kararı, seyahat
              iptali, uçak / otel / tur kaybı veya üçüncü kişi hizmetlerinden
              sorumlu değildir.
            </P>
            <P>
              11.3. Mevzuatın izin verdiği ölçüde, Alsas Vize’nin herhangi bir
              uyuşmazlıkta mali sorumluluğu, Müşteri tarafından ödenen danışmanlık
              hizmet bedeli ile sınırlıdır. Ağır kusur, kasıt ve emredici kanun
              hükümlerinden doğan sorumluluklar saklıdır.
            </P>
            <P>
              11.4. Müşteri, vize başvurusu sonuçlanmadan kesin ve iadesiz seyahat
              harcaması yapmaması gerektiği konusunda bilgilendirildiğini kabul
              eder.
            </P>
          </Section>

          <Section title="Madde 12 — İletişim, Kayıtlar ve Delil Sözleşmesi">
            <P>
              12.1. Taraflar arasındaki iletişim; telefon, WhatsApp, SMS, e-posta,
              online panel, görüntülü görüşme veya yüz yüze görüşme yoluyla
              yapılabilir.
            </P>
            <P>
              12.2. Müşteri, Alsas Vize’ye bildirdiği telefon numarası, e-posta
              adresi ve WhatsApp hattının güncel ve kendisine ait olduğunu kabul
              eder. Bu bilgilerin hatalı veya güncel olmaması nedeniyle doğacak
              sonuçlardan Müşteri sorumludur.
            </P>
            <P>
              12.3. Alsas Vize, kalite kontrol, hizmet takibi, işlem güvenliği ve
              uyuşmazlık halinde ispat amacıyla, ilgili mevzuata ve KVKK aydınlatma
              yükümlülüğüne uygun olmak kaydıyla çağrı merkezi kayıtlarını,
              yazışmaları, ödeme kayıtlarını, panel onaylarını, e-posta
              bildirimlerini ve işlem loglarını saklayabilir.
            </P>
            <P>
              12.4. Taraflar, elektronik ortamda yapılan onayların, WhatsApp / SMS
              / e-posta yazışmalarının, online panel kayıtlarının, ödeme
              dekontlarının ve sistem loglarının uyuşmazlık halinde delil olarak
              kullanılabileceğini kabul eder.
            </P>
          </Section>

          <Section title="Madde 13 — Kişisel Verilerin Korunması ve Gizlilik">
            <P>
              13.1. Alsas Vize, Müşteri’ye ait kimlik, iletişim, pasaport, seyahat,
              finansal durum, çalışma durumu, aile bilgileri, eğitim bilgileri,
              vize geçmişi ve başvuru sürecine ilişkin kişisel verileri yalnızca
              hizmetin sunulması, sözleşmenin ifası, yasal yükümlülüklerin yerine
              getirilmesi, işlem güvenliğinin sağlanması ve başvuru sürecinin
              yürütülmesi amaçlarıyla işler.
            </P>
            <P>
              13.2. Vize başvuru süreci gereği pasaport, kimlik, banka dökümleri,
              iş belgeleri, öğrenci belgeleri, tapu, ruhsat, davetiye, aile
              bilgileri veya özel nitelikli veri içerebilecek belgeler talep
              edilebilir. Bu veriler, Müşteri’nin açık paylaşımı ve başvuru
              sürecinin gerektirdiği ölçüde işlenir.
            </P>
            <P>
              13.3. Alsas Vize, kişisel verileri Müşteri’nin açık rızası veya
              ilgili mevzuatta öngörülen hukuki sebepler kapsamında; konsolosluklar,
              vize başvuru merkezleri, sigorta şirketleri, tercüme / noter / kargo
              hizmet sağlayıcıları, ödeme kuruluşları, yazılım altyapı sağlayıcıları
              ve yasal mercilerle paylaşabilir.
            </P>
            <P>
              13.4. Müşteri, KVKK aydınlatma metnini okuduğunu, kişisel verilerinin
              hizmetin sunulması amacıyla işlenebileceğini ve gerekli hallerde
              ilgili üçüncü taraflarla paylaşılabileceğini kabul eder.
            </P>
            <P>
              13.5. Alsas Vize, Müşteri’ye ait bilgi ve belgeleri, yasal
              zorunluluklar ve hizmetin gereği dışında üçüncü kişilerle
              paylaşmamayı taahhüt eder.
            </P>
          </Section>

          <Section title="Madde 14 — Ticari Elektronik İleti Onayı">
            <P>
              14.1. Alsas Vize, Müşteri’ye kampanya, bilgilendirme, hatırlatma,
              hizmet duyurusu, başvuru takibi, randevu hatırlatması veya pazarlama
              içerikli ticari elektronik ileti göndermek için Müşteri’den ayrıca
              onay alır.
            </P>
            <P>
              14.2. Müşteri, ticari elektronik ileti onayını dilediği zaman geri
              çekebilir.
            </P>
            <P>
              14.3. Hizmetin yürütülmesi için zorunlu olan işlem bildirimleri,
              ödeme hatırlatmaları, randevu bilgilendirmeleri ve başvuru süreci
              mesajları ticari reklam niteliği taşımadığı ölçüde hizmet iletişimi
              kapsamında değerlendirilebilir.
            </P>
          </Section>

          <Section title="Madde 15 — Mücbir Sebepler">
            <P>
              15.1. Doğal afet, salgın, savaş, grev, resmi kurumların kapanması,
              konsolosluk faaliyetlerinin durması, başvuru merkezi sistem arızası,
              internet kesintisi, siber saldırı, teknik altyapı problemi, resmi
              tatil, siyasi karar, ülke giriş yasağı, sınır kapatma, havayolu
              iptali ve tarafların kontrolü dışında gelişen benzer haller mücbir
              sebep kabul edilir.
            </P>
            <P>
              15.2. Mücbir sebep nedeniyle hizmetin geç, eksik veya farklı yöntemle
              sunulması halinde Alsas Vize sorumlu tutulamaz. Taraflar, mümkün olan
              en kısa sürede yeni süreç planlaması yapmak için iş birliği yapar.
            </P>
          </Section>

          <Section title="Madde 16 — Kamuya Açık Paylaşımlar, Şirket İtibarı ve Hukuki Sorumluluk">
            <P>
              16.1. Müşteri; hizmet süreci, ücret, randevu, ret kararı, evrak,
              ödeme, iletişim veya işbu sözleşmeden kaynaklanan herhangi bir iddia
              veya uyuşmazlık hakkında Şikayetvar, Google / Yandex / harita
              yorumları, sosyal medya, forumlar, bloglar, haber / yorum alanları,
              arama motoru yorumları ve benzeri internet ortamları ile kamuya açık
              mecralarda Alsas Vize, marka adı, ticari unvanı, yetkilileri,
              çalışanları, iş ortakları ve hizmet süreçleri hakkında gerçeğe aykırı,
              eksik bilgiye dayalı, yanıltıcı, ispatlanamayan, haksız, ölçüsüz,
              hakaret, iftira, tehdit, suç isnadı, kişisel veri veya ticari sır
              ifşası, haksız rekabet ya da ticari itibarı zedeleme niteliğinde
              paylaşım yayımlamayacağını kabul, beyan ve taahhüt eder.
            </P>
            <P>
              16.2. Müşteri, şirket aleyhine kamuya açık bir paylaşım yapmadan önce
              iddiasını ve dayandığı bilgi / belgeleri Alsas Vize’ye yazılı olarak
              iletmeyi; şirkete iddiaya cevap verme, kayıtları inceleme, düzeltme
              yapma ve çözüm sunma imkanı tanımayı kabul eder.
            </P>
            <P>
              16.3. Müşteri, kamuya açık mecralarda yaptığı veya yaptırdığı
              paylaşımın doğruluğunu, güncelliğini, bağlam bütünlüğünü ve hukuka
              uygunluğunu ispat yükünün kendisine ait olduğunu kabul eder.
            </P>
            <P>
              16.4. Şirket itibarını zedeleyici nitelikte paylaşım, yorum, şikayet
              veya içerik tespit edilmesi halinde Alsas Vize; ekran görüntüsü, URL,
              tarih / saat, kullanıcı bilgisi, yazışma, ödeme kaydı, başvuru kaydı,
              sistem kaydı ve noter / mahkeme tespiti dahil tüm hukuka uygun delil
              yollarına başvurabilir.
            </P>
            <P>
              16.5. Müşteri, paylaşımın hukuka aykırı olduğunun veya işbu sözleşmeye
              aykırılık teşkil ettiğinin yetkili merci tarafından ortaya konulması
              halinde; Alsas Vize’nin marka değeri, ticari itibarı, müşteri kaybı,
              itibar yönetimi giderleri, noter, avukatlık, yargılama, bilirkişi,
              arabuluculuk ve takip masrafları dahil tüm maddi ve manevi zararlarını
              talep etme hakkı bulunduğunu kabul eder.
            </P>
            <P>
              16.6. Alsas Vize, bu kapsamda Türk Borçlar Kanunu, Türk Ticaret
              Kanunu, Türk Ceza Kanunu, 5651 sayılı Kanun ve ilgili sair mevzuat
              uyarınca maddi ve manevi tazminat, haksız rekabetin tespiti / men’i /
              ref’i, içeriğin çıkarılması, erişimin engellenmesi, cevap ve
              düzeltme, ihtiyati tedbir, suç duyurusu ve diğer tüm yasal başvuru
              haklarını kullanabilir.
            </P>
            <P>
              16.7. Bu madde, Müşteri’nin kanuni başvuru yollarını ortadan
              kaldırmaz; ancak Müşteri’nin yetkili merciler dışındaki kamuya açık
              alanlarda gerçeğe aykırı, ispatlanamayan, kötü niyetli, ölçüsüz veya
              ticari itibarı zedeleyici beyan ve paylaşımlarından doğan
              sorumluluğunu kaldırmaz.
            </P>
          </Section>

          <Section title="Madde 17 — Uyuşmazlıkların Çözümü">
            <P>
              17.1. İşbu sözleşmeden doğabilecek uyuşmazlıklarda öncelikle taraflar
              iyi niyetli şekilde çözüm aramayı kabul eder.
            </P>
            <P>
              17.2. Müşteri’nin tüketici sıfatıyla hareket ettiği uyuşmazlıklarda,
              2026 yılı için 186.000 TL’nin altında bulunan tüketici
              uyuşmazlıklarında İl veya İlçe Tüketici Hakem Heyeti’ne; bu sınırı
              aşan uyuşmazlıklarda ise dava şartı arabuluculuk süreci ve Tüketici
              Mahkemesi dahil ilgili adli yollarına, başvuru tarihindeki yürürlükteki
              mevzuat dikkate alınarak başvurulabilir.
            </P>
            <P>
              17.3. Yetkili merci belirlenirken tüketici mevzuatı, genel usul
              kuralları ve emredici hükümler uygulanır.
            </P>
            <P>
              17.4. Müşteri’nin tacir / şirket / ticari işletme adına hizmet alması
              halinde, tüketici mevzuatı değil genel hükümler uygulanır ve
              uyuşmazlıklarda Alsas Vize’nin merkez adresinin bulunduğu yer
              mahkemeleri ve icra daireleri yetkili olabilir.
            </P>
          </Section>

          <Section title="Madde 18 — Sözleşmenin Yürürlüğü ve Elektronik Onay">
            <P>
              18.1. İşbu sözleşme; Müşteri’nin sözleşmeyi elektronik ortamda, online
              panel üzerinden, SMS / WhatsApp / e-posta yoluyla veya fiziki imza ile
              onaylaması ve hizmet bedelinin ödenmesiyle yürürlüğe girer.
            </P>
            <P>
              18.2. Müşteri, sözleşmeyi onaylamadan önce hizmetin temel nitelikleri,
              toplam bedeli, ödeme şekli, cayma hakkı, cayma hakkının hangi
              koşullarda kaybedilebileceği, hizmetin kapsamı, şirket iletişim
              bilgileri ve uyuşmazlık başvuru yolları hakkında bilgilendirildiğini
              kabul eder.
            </P>
            <P>
              18.3. Müşteri, işbu sözleşmenin bir örneğinin kendisine kalıcı veri
              saklayıcısı ile gönderilebileceğini kabul eder.
            </P>
            <P>
              18.4. İşbu sözleşme 18 maddeden ibaret olup, taraflarca okunarak kabul
              edilmiştir.
            </P>
          </Section>
        </ScrollBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Kapat
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

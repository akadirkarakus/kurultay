import { pathToFileURL } from "node:url";
import { isBattleAttributeKey } from "@/lib/attributes";
import { KEY_ATTRIBUTES_PER_ROUND } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/create-admin-client";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

interface ScenarioSeed {
  text: string;
  suggestedAttributes: [string, string, string, string, string];
}

export const SCENARIOS: ScenarioSeed[] = [
  { text: "Uzaylılar Dünya'yı istila etti; dünyayı kurtaracak tek bir insana ihtiyaç var.", suggestedAttributes: ["intelligence", "physical_endurance", "mental_strength", "courage", "leadership"] },
  { text: "Zombi salgını şehri sardı; hayatta kalmayı başaracak lider kim?", suggestedAttributes: ["leadership", "physical_strength", "courage", "composure", "physical_endurance"] },
  { text: "Ülke ağır bir ekonomik krizle boğuşuyor, kim yönetimi devralmalı?", suggestedAttributes: ["intelligence", "vision", "diligence", "leadership", "respectability"] },
  { text: "Işıksız, susuz bir adada hayatta kalmaya çalışıyorsunuz.", suggestedAttributes: ["physical_endurance", "patience", "creativity", "mental_strength", "courage"] },
  { text: "Bir yetenek yarışmasında jüri üyesi olarak kim en iyi kararı verir?", suggestedAttributes: ["charisma", "humor", "respectability", "intelligence", "likability"] },
  { text: "Uzaya gönderilecek astronotu seçme zamanı.", suggestedAttributes: ["intelligence", "physical_endurance", "composure", "diligence", "technical_knowledge"] },
  { text: "Bir rehine krizinde müzakereci olarak kim görev almalı?", suggestedAttributes: ["composure", "public_speaking", "patience", "intelligence", "respectability"] },
  { text: "Dünya barışı zirvesinde ülkeleri kim temsil etmeli?", suggestedAttributes: ["charisma", "public_speaking", "respectability", "vision", "intelligence"] },
  { text: "Doğal afet sonrası kurtarma çalışmalarını kim koordine etmeli?", suggestedAttributes: ["leadership", "command", "physical_endurance", "composure", "diligence"] },
  { text: "Define avında gizemli haritayı kim çözer?", suggestedAttributes: ["intelligence", "creativity", "patience", "mystery", "courage"] },
  { text: "Bir stand-up gösterisinde sahneye kim çıkmalı?", suggestedAttributes: ["humor", "charisma", "courage", "creativity", "likability"] },
  { text: "Savaş meydanında orduyu kim yönetmeli?", suggestedAttributes: ["command", "courage", "leadership", "physical_strength", "mental_strength"] },
  { text: "Batmak üzere olan şirketi kim kurtarır?", suggestedAttributes: ["intelligence", "vision", "diligence", "leadership", "productivity"] },
  { text: "Ünlüler arasında halkın en çok seveceği kişi kim?", suggestedAttributes: ["likability", "charisma", "fame", "humor", "attractiveness"] },
  { text: "Bir suikast girişimini önceden kim sezer?", suggestedAttributes: ["mystery", "intelligence", "composure", "patience", "courage"] },
  { text: "Kim en büyük iş imparatorluğunu kurar?", suggestedAttributes: ["wealth", "vision", "productivity", "intelligence", "diligence"] },
  { text: "Panik anında halkı kim sakinleştirir?", suggestedAttributes: ["composure", "public_speaking", "respectability", "charisma", "likability"] },
  { text: "Kim sahnede en etkileyici performansı sergiler?", suggestedAttributes: ["attractiveness", "charisma", "creativity", "fame", "humor"] },
  { text: "Zorlu bir maratonu kim tamamlar?", suggestedAttributes: ["physical_endurance", "speed", "patience", "mental_strength", "diligence"] },
  { text: "Kim rakiplerini korkutup pes ettirir?", suggestedAttributes: ["intimidation", "temper", "physical_strength", "courage", "command"] },
  { text: "Teknoloji şirketinde en iyi mühendis kim olur?", suggestedAttributes: ["technical_knowledge", "intelligence", "diligence", "creativity", "patience"] },
  { text: "Alçakgönüllülüğüyle örnek olacak kişi kim?", suggestedAttributes: ["humility", "respectability", "likability", "patience", "composure"] },
  { text: "Terk edilmiş bir arazide sıfırdan modern ve tam otomatik bir akıllı çiftlik kurmanız gerekiyor. Bu sistemi kim tasarlayıp yönetir?", suggestedAttributes: ["technical_knowledge", "productivity", "intelligence", "diligence", "vision"] },
  { text: "Sıradan bir kafede, son derece absürt ve karmaşık bir yanlış anlaşılmanın ortasında kaldınız. Durumu kim tatlıya bağlar?", suggestedAttributes: ["humor", "likability", "public_speaking", "charisma", "patience"] },
  { text: "Gecenin köründe teleskopla gökyüzünü izlerken hızla yaklaşan tanımlanamayan bir cisim fark ettiniz. İlk teması kim kurmalı?", suggestedAttributes: ["composure", "mystery", "intelligence", "courage", "mental_strength"] },
  { text: "Enkaz altında kalan bir grubu kurtarmak için sadece bacak ve sırt kuvvetine güvenerek ağır beton blokları uzun süre kaldırmak gerekiyor.", suggestedAttributes: ["physical_strength", "physical_endurance", "mental_strength", "courage", "patience"] },
  { text: "Kısıtlı sürede ve malzemeyle, arkadaş grubunu bütün gece eğlendirecek yepyeni bir masa/kutu oyunu tasarlayıp üretmeniz lazım.", suggestedAttributes: ["creativity", "productivity", "humor", "intelligence", "diligence"] },
  { text: "Yabancı bir ülkede, dilini hiç bilmediğiniz bir şehirde kayboldunuz ve pasaportunuz yok. Sizi kim krizden çıkarıp güvenle eve döndürür?", suggestedAttributes: ["composure", "likability", "charisma", "intelligence", "patience"] },
  { text: "Dünyanın en prestijli ödülünü kazanmasına rağmen egosuna yenik düşmeden, herkese ilham verecek o efsanevi teşekkür konuşmasını kim yapar?", suggestedAttributes: ["humility", "public_speaking", "respectability", "charisma", "fame"] },
  { text: "Peşinize düşen tehlikeli bir çeteden hızla kaçarken, aynı zamanda öfkesini bir silaha dönüştürüp onları korkutarak püskürtecek biri lazım.", suggestedAttributes: ["speed", "temper", "intimidation", "physical_strength", "courage"] },
  { text: "Şehrin en popüler, en lüks ve en elit partisini organize edip bütün dünyanın dikkatini çekecek kişi kimdir?", suggestedAttributes: ["wealth", "fame", "attractiveness", "vision", "charisma"] },
  { text: "Tarihin gördüğü en büyük siber saldırı başladı, tüm sistemler çöküyor. Ekipleri kim komuta edip kaosu durdurur?", suggestedAttributes: ["leadership", "command", "technical_knowledge", "composure", "mental_strength"] },
  { text: "Gece yarısı teleskopla derin uzayı gözlemlerken çok nadir ve karmaşık bir gök olayını tespit edip saatlerce odağınızı kaybetmeden kaydetmeniz gerekiyor.", suggestedAttributes: ["patience", "mental_strength", "intelligence", "technical_knowledge", "diligence"] },
  { text: "Şehirdeki en zorlu güç yarışmasında, devasa ağırlıkları saatlerce bacak ve sırt kuvvetiyle taşıyarak parkuru tamamlamanız lazım.", suggestedAttributes: ["physical_strength", "physical_endurance", "mental_strength", "courage", "patience"] },
  { text: "Mahalledeki sıradan bir kafede çok ufak bir mesele yüzünden başlayan tartışma bir anda absürt bir kaosa dönüştü. Ortamı kim yatıştırıp herkesi kahkahaya boğar?", suggestedAttributes: ["humor", "public_speaking", "likability", "composure", "charisma"] },
  { text: "Çiftlikteki akıllı hayvan tartım sistemi ve otomasyon ağı tamamen çöktü. Kaos başlamadan sistemi kim yeniden kodlayıp çalışır hale getirir?", suggestedAttributes: ["technical_knowledge", "intelligence", "productivity", "diligence", "composure"] },
  { text: "Efsanevi bir müzik grubunun anma konserinde, on binlerce kişinin önünde sahneye çıkıp kusursuz bir enstrüman solosu atmanız gerekiyor.", suggestedAttributes: ["creativity", "charisma", "likability", "fame", "attractiveness"] },
  { text: "Arkadaş grubunuzla kendi tasarladığınız kutu oyununu oynarken kurallar hakkında çıkan büyük anlaşmazlıkta ipleri eline alıp oyunu kim yönetir?", suggestedAttributes: ["leadership", "public_speaking", "charisma", "intelligence", "humor"] },
  { text: "Çok büyük bir online otel rezervasyon sistemine lansman günü aşırı yüklenme oldu. Sabaha kadar kod yazıp veritabanını kim ayakta tutar?", suggestedAttributes: ["technical_knowledge", "diligence", "productivity", "mental_strength", "intelligence"] },
  { text: "Eski çağlarda dev bir imparatorluğun ordularına komuta ederek düşman hatlarını stratejik ve acımasız bir şekilde yarmak zorundasınız.", suggestedAttributes: ["command", "leadership", "courage", "intimidation", "vision"] },
  { text: "Çok zengin ve gösterişli bir ailenin miras kavgasına hiç dahil olmadan, sessizce ve alçakgönüllülükle masadaki herkesin saygısını kazanmanız gerekiyor.", suggestedAttributes: ["humility", "respectability", "patience", "mystery", "composure"] },
  { text: "Büyük bir haksızlığa uğradığınızda, haklı öfkenizi tam bir silaha dönüştürerek karşınızdakileri tamamen sindirmeniz ve geri adım attırmanız gerekiyor.", suggestedAttributes: ["temper", "public_speaking", "intimidation", "charisma", "courage"] },
  { text: "Issız bir ormanda peşinize düşen vahşi bir yırtıcıdan kurtulmak için hem çok hızlı koşmalı hem de izinizi zekice kaybettirmelisiniz.", suggestedAttributes: ["speed", "physical_endurance", "intelligence", "mystery", "composure"] },
  { text: "Sektördeki tüm rakipleri devirip, sınırsız bir bütçeyle dünyanın en kârlı şirketini sıfırdan kim kurar?", suggestedAttributes: ["vision", "wealth", "productivity", "leadership", "intelligence"] },
  { text: "Kasabada işlenen esrarengiz bir olayı, kimseye belli etmeden gölgelerin içinden araştırıp karanlık sırları kim çözer?", suggestedAttributes: ["mystery", "intelligence", "patience", "composure", "mental_strength"] },
  { text: "Kameralar önünde kışkırtıcı sorular soran acımasız bir sunucuyu, sadece görünüşünüz ve tatlı dilinizle manipüle edip kendi tarafınıza çekmelisiniz.", suggestedAttributes: ["attractiveness", "likability", "charisma", "public_speaking", "humor"] },
  { text: "Şehri ele geçirmeye çalışan karanlık bir çete liderinin mekanına tek başına girip, sadece varlığınız ve gücünüzle onu dehşete düşürmeniz gerekiyor.", suggestedAttributes: ["intimidation", "fame", "physical_strength", "courage", "temper"] },
  { text: "Bir Akdeniz ülkesinde yabancı bir öğrenci olarak bulunduğunuz ilk gün, kalacağınız evi bulamadınız. Yerel halkla kaynaşıp onlardan yardım alarak bu krizi çözmeniz gerekiyor.", suggestedAttributes: ["likability", "courage", "charisma", "composure", "humility"] },
  { text: "Elektriğin olmadığı kıyamet sonrası bir dünyada, sadece hurdalıktan topladığınız parçaları kullanarak güvenli bölge için bir aydınlatma devresi kurmalısınız.", suggestedAttributes: ["creativity", "technical_knowledge", "intelligence", "diligence", "productivity"] },
  { text: "Devasa bir bankanın köhnemiş ve çökmek üzere olan veritabanı mimarisini, modern bir kodlama yaklaşımıyla tek gecede sıfırdan inşa etmeniz gerekiyor.", suggestedAttributes: ["technical_knowledge", "intelligence", "mental_strength", "diligence", "mystery"] },
  { text: "Vahşi doğada aniden karşınıza çıkan devasa ve sinirli bir vahşi hayvanı, sadece yanınızdaki üflemeli çalgıyı çalarak sakinleştirmelisiniz.", suggestedAttributes: ["creativity", "composure", "courage", "mental_strength", "likability"] },
  { text: "Sıradan bir dolandırıcı size inanılmaz mantıksız ama bir o kadar da ikna edici bir iş teklifi sunuyor. Onu kendi kelime oyunlarıyla alt edip vazgeçirmelisiniz.", suggestedAttributes: ["humor", "intelligence", "public_speaking", "patience", "mental_strength"] },
  { text: "Dünyanın en efsanevi rock müzik grubunun dağılma noktasına geldiği an stüdyoya girip, darmadağın olmuş üyeleri tek bir albüm için yeniden bir araya getirmelisiniz.", suggestedAttributes: ["leadership", "vision", "respectability", "charisma", "productivity"] },
  { text: "Şehre yerleştirilmiş bir mekanizmayı etkisiz hale getirmek için tüm şehri yürüyerek veya koşarak uçtan uca geçip doğru şifreyi girmelisiniz.", suggestedAttributes: ["speed", "physical_endurance", "composure", "technical_knowledge", "courage"] },
  { text: "Dünyanın en zengin insanlarının katıldığı gizli bir müzayedede, kimsenin ne olduğunu bilmediği gizli bir eseri en yüksek fiyatı vererek alıp masadaki prestiji toplamalısınız.", suggestedAttributes: ["wealth", "fame", "vision", "charisma", "mystery"] },
  { text: "Uluslararası bir film festivalinin kırmızı halısında yürürken, tek bir kelime dahi etmeden tüm medyanın ve insanların nefesini kesmelisiniz.", suggestedAttributes: ["attractiveness", "charisma", "fame", "mystery", "respectability"] },
  { text: "İşgal edilmiş bir kaleyi geri almak için derme çatma silahlara sahip, eğitimsiz ve korkmuş bir köylü grubunu ölümcül bir orduya dönüştürmelisiniz.", suggestedAttributes: ["command", "leadership", "public_speaking", "courage", "mental_strength"] },
  { text: "Size yapılan çok ağır ve haksız bir suçlama karşısında mahkeme salonunda öyle bir kükremelisiniz ki, tüm jüri ve hakim donup kalsın.", suggestedAttributes: ["temper", "intimidation", "public_speaking", "physical_strength", "courage"] },
  { text: "Yıllarca sürecek çok gizli bir bilimsel araştırmada, adınızın makalede hiç geçmeyeceğini bile bile insanlık için gece gündüz laboratuvarda çalışmalısınız.", suggestedAttributes: ["patience", "humility", "diligence", "intelligence", "productivity"] },
  { text: "Devasa bir kaya parçasını, tek başınıza ve sadece kas gücünüzle saatlerce iterek uçurumun kenarından uzaklaştırmanız gerekiyor.", suggestedAttributes: ["physical_strength", "physical_endurance", "mental_strength", "patience", "diligence"] },
  { text: "Yıkılmış ve umudunu kaybetmiş bir şehrin ortasına, sadece molozlardan ve geri dönüştürülmüş malzemelerden insanlara ilham verecek devasa bir anıt inşa etmelisiniz.", suggestedAttributes: ["creativity", "vision", "productivity", "diligence", "humility"] },
  { text: "Çok gergin geçen bir diplomatik görüşmede, yanlışlıkla karşı tarafın liderinin üzerine kahve döktünüz. Büyük bir kriz çıkmadan durumu toparlamalısınız.", suggestedAttributes: ["humor", "likability", "charisma", "composure", "intelligence"] },
  { text: "Yüksek güvenlikli bir müzeye gece yarısı sızıp, hiçbir alarmı tetiklemeden ve güvenliklere görünmeden paha biçilemez bir tabloyu gerçeğiyle değiştirmelisiniz.", suggestedAttributes: ["mystery", "speed", "composure", "technical_knowledge", "intelligence"] },
  { text: "İflas etmiş bir televizyon kanalını satın alıp, sadece kendi popülerliğinizi ve servetinizi kullanarak kanalı bir ayda en çok izlenen ağ haline getirmelisiniz.", suggestedAttributes: ["wealth", "fame", "vision", "productivity", "charisma"] },
  { text: "Çıkan büyük bir hapishane isyanında, silahsız bir şekilde avluya inip sadece duruşunuz ve bakışlarınızla yüzlerce isyancıyı hücrelerine geri döndürmelisiniz.", suggestedAttributes: ["intimidation", "respectability", "composure", "temper", "courage"] },
  { text: "Kontrolden çıkan dev bir yapay zeka ağını durduracak olan son güvenlik duvarı kodunu, aralıksız 48 saat ekrana bakarak yazıp sisteme yüklemelisiniz.", suggestedAttributes: ["technical_knowledge", "intelligence", "mental_strength", "patience", "diligence"] },
  { text: "Geminiz ıssız bir adaya çarptı. Mürettebat aç, korkmuş ve isyan etmek üzere. Onları organize edip, zorlu hava şartlarında hayatta kalmalarını sağlamalısınız.", suggestedAttributes: ["leadership", "physical_endurance", "command", "vision", "mental_strength"] },
];

export function validateScenarios(): void {
  for (const scenario of SCENARIOS) {
    if (scenario.suggestedAttributes.length !== KEY_ATTRIBUTES_PER_ROUND) {
      throw new Error(`Scenario must have exactly ${KEY_ATTRIBUTES_PER_ROUND} suggested attributes: "${scenario.text}"`);
    }
    for (const attr of scenario.suggestedAttributes) {
      if (!isBattleAttributeKey(attr)) {
        throw new Error(`Unknown attribute key "${attr}" in scenario: "${scenario.text}"`);
      }
    }
  }
  if (SCENARIOS.length < 20) {
    throw new Error(`Expected at least 20 scenarios, found ${SCENARIOS.length}.`);
  }
}

async function main() {
  validateScenarios();
  const admin = createAdminClient();
  const rows = SCENARIOS.map((s) => ({ text: s.text, suggested_attributes: s.suggestedAttributes }));
  const { error } = await admin.from("scenarios").insert(rows);
  if (error) throw new Error(`Seeding scenarios failed: ${error.message}`);
  console.log(`Seeded ${rows.length} scenarios.`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

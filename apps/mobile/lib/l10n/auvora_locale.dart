import 'package:intl/intl.dart';

import '../preferences/models.dart';

/// Localization / formatting helpers.
class AuvoraLocale {
  AuvoraLocale(this.prefs);

  final LocalePrefs prefs;

  String get languageTag => '${prefs.languageCode}_${prefs.regionCode}';

  bool get isRtl => const {'ar', 'he', 'fa', 'ur'}.contains(prefs.languageCode);

  String formatCurrency(num amount, {int fractionDigits = 2}) {
    final code = currencyCode(prefs.currency);
    try {
      return NumberFormat.currency(
        locale: _localeTag,
        symbol: _symbolFor(code),
        decimalDigits: fractionDigits,
      ).format(amount);
    } catch (_) {
      return '$code ${amount.toStringAsFixed(fractionDigits)}';
    }
  }

  String formatNumber(num value, {int? fractionDigits}) {
    try {
      final fmt = NumberFormat.decimalPattern(_localeTag);
      if (fractionDigits != null) {
        fmt.minimumFractionDigits = fractionDigits;
        fmt.maximumFractionDigits = fractionDigits;
      }
      return fmt.format(value);
    } catch (_) {
      return value.toString();
    }
  }

  String formatDate(DateTime value) {
    final local = value.toLocal();
    final pattern = switch (prefs.dateFormat) {
      DateFormatPreference.mdy => 'MMM d, y',
      DateFormatPreference.dmy => 'd MMM y',
      DateFormatPreference.ymd => 'y-MM-dd',
    };
    try {
      return DateFormat(pattern, _localeTag).format(local);
    } catch (_) {
      return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
    }
  }

  String formatTime(DateTime value) {
    final local = value.toLocal();
    final pattern = prefs.timeFormat == TimeFormatPreference.h24 ? 'HH:mm' : 'h:mm a';
    try {
      return DateFormat(pattern, _localeTag).format(local);
    } catch (_) {
      return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
    }
  }

  String formatDateTime(DateTime value) => '${formatDate(value)} · ${formatTime(value)}';

  String get _localeTag => '${prefs.languageCode}_${prefs.regionCode}';

  static String _symbolFor(String code) => switch (code) {
        'USD' => '\$',
        'EUR' => '€',
        'GBP' => '£',
        'JPY' => '¥',
        _ => '$code ',
      };

  /// Device language if we have a pack; otherwise English.
  static String resolveDeviceLanguage(
    String languageCode, {
    String? scriptCode,
    String? countryCode,
  }) {
    final raw = languageCode.toLowerCase();
    if (raw.startsWith('zh') &&
        (scriptCode == 'Hant' ||
            raw.contains('hant') ||
            raw.contains('tw') ||
            const {'TW', 'HK', 'MO'}.contains(countryCode))) {
      return 'zh-Hant';
    }
    final code = raw.split(RegExp(r'[_-]')).first;
    return isLanguagePackReady(code) ? code : 'en';
  }
}

/// Static string catalog. Missing keys fall back to English.
/// Recovery-phrase words are NEVER stored here — BIP-39 stays English.
abstract final class AuvoraStrings {
  static const supportedLanguageCodes = kSupportedUiLanguageCodes;

  static const Map<String, String> en = {
    'settings.title': 'Settings',
    'settings.search_hint': 'Search settings',
    'settings.language': 'Language',
    'appearance.theme': 'Theme',
    'appearance.accent': 'Accent color',
    'appearance.accent_hint': 'Lagoon is the brand accent. Custom accents are prepared for a later release.',
    'notifications.title': 'Notification Center',
    'notifications.subtitle': 'In-app alerts for this device. Not push notifications.',
    'notifications.search': 'Search inbox',
    'notifications.empty': 'No notifications match this filter.',
    'notifications.mark_all_read': 'Mark all read',
    'notifications.permission': 'Device notification permission',
    'notifications.permission_body':
        'Auvora uses an in-app inbox today. Granting OS permission prepares this device for future push delivery.',
    'help.title': 'Support',
    'help.search_hint': 'Search help',
    'search.hint': 'Assets, wallets, activity, settings, help…',
    'recovery.wrong_word': 'That isn’t the word for this position. Try again.',
    'recovery.select_word': 'Select word #{n}. Only the word you wrote in that position is accepted.',
    'recovery.bip39_english':
        'Recovery words are BIP-39 English. Changing the app language does not translate or replace them.',
    'recovery.never_share': 'Anyone with these words can move your funds. Never share them.',
    'receive.wrong_network': 'Match the network exactly. A wrong network can permanently lose funds.',
    'send.broadcast_off': 'Live broadcast is off. This device can prepare and sign locally only.',
    'send.review_pending':
        'This transfer is at or above the Auvora review threshold. An admin must approve before this device can broadcast. Keys stay on this device. This is not a blockchain freeze.',
    'swap.unavailable': 'Swap is unavailable until a production quote provider is wired.',
    'buy.unavailable': 'Buy is unavailable until an on-ramp partner is configured for this build.',
    'account.vs_wallet':
        'Your Auvora account is an identity. Your recovery phrase is the wallet. Signing in never downloads private keys.',
    'intelligence.onboarding_recovery': 'Your recovery phrase is the master key to your wallet.',
    'intelligence.receive_network': 'Always verify you’re sharing the correct network.',
    'intelligence.send_irreversible': 'This transaction cannot be reversed after confirmation.',
    'intelligence.stake_lock': 'Some staking providers require a lock period.',
    'intelligence.web3_disconnect': 'You can disconnect this application at any time.',
    'intelligence.security_updated': 'Your wallet protection has been updated.',
  };

  static String lookup(String key, {String languageCode = 'en', Map<String, String> params = const {}}) {
    final code = languageCode.toLowerCase();
    final pack = _packs[code] ?? _packs[code.split('-').first];
    var value = pack?[key] ?? en[key] ?? key;
    for (final e in params.entries) {
      value = value.replaceAll('{${e.key}}', e.value);
    }
    return value;
  }
}

bool isLanguagePackReady(String code) {
  final normalized = code.toLowerCase();
  return AuvoraStrings.supportedLanguageCodes.contains(normalized) ||
      AuvoraStrings.supportedLanguageCodes.contains(normalized.split('-').first) ||
      (normalized == 'zh-tw' || normalized == 'zh-hant');
}

const kLanguagePackCatalog = <({String code, String label, bool ready})>[
  (code: 'en', label: 'English', ready: true),
  (code: 'fr', label: 'Français', ready: true),
  (code: 'es', label: 'Español', ready: true),
  (code: 'de', label: 'Deutsch', ready: true),
  (code: 'pt', label: 'Português', ready: true),
  (code: 'it', label: 'Italiano', ready: true),
  (code: 'nl', label: 'Nederlands', ready: true),
  (code: 'sv', label: 'Svenska', ready: true),
  (code: 'pl', label: 'Polski', ready: true),
  (code: 'ro', label: 'Română', ready: true),
  (code: 'tr', label: 'Türkçe', ready: true),
  (code: 'ru', label: 'Русский', ready: true),
  (code: 'uk', label: 'Українська', ready: true),
  (code: 'ar', label: 'العربية', ready: true),
  (code: 'hi', label: 'हिन्दी', ready: true),
  (code: 'id', label: 'Bahasa Indonesia', ready: true),
  (code: 'vi', label: 'Tiếng Việt', ready: true),
  (code: 'th', label: 'ไทย', ready: true),
  (code: 'zh', label: '简体中文', ready: true),
  (code: 'zh-Hant', label: '繁體中文', ready: true),
  (code: 'ja', label: '日本語', ready: true),
  (code: 'ko', label: '한국어', ready: true),
];

const _packs = <String, Map<String, String>>{
  'fr': {
    'recovery.wrong_word': 'Ce n’est pas le mot de cette position. Réessayez.',
    'recovery.bip39_english':
        'Les mots de récupération sont en anglais BIP-39. Changer la langue de l’application ne les traduit pas.',
    'receive.wrong_network': 'Vérifiez exactement le réseau. Un mauvais réseau peut faire perdre les fonds définitivement.',
    'send.broadcast_off': 'La diffusion en direct est désactivée. Cet appareil peut seulement préparer et signer localement.',
    'account.vs_wallet':
        'Le compte Auvora est une identité. La phrase de récupération est le portefeuille. La connexion ne télécharge jamais les clés privées.',
    'notifications.title': 'Centre de notifications',
    'notifications.mark_all_read': 'Tout marquer comme lu',
    'notifications.empty': 'Aucune notification ne correspond à ce filtre.',
    'swap.unavailable': 'Le swap n’est pas disponible tant qu’un fournisseur de cotation n’est pas connecté.',
    'buy.unavailable': 'L’achat n’est pas disponible tant qu’un partenaire on-ramp n’est pas configuré.',
  },
  'es': {
    'recovery.wrong_word': 'Esa no es la palabra de esta posición. Inténtalo de nuevo.',
    'recovery.bip39_english':
        'Las palabras de recuperación son BIP-39 en inglés. Cambiar el idioma de la app no las traduce.',
    'receive.wrong_network': 'Coincide exactamente con la red. Una red incorrecta puede perder los fondos para siempre.',
    'send.broadcast_off': 'La difusión en vivo está desactivada. Este dispositivo solo puede preparar y firmar en local.',
    'account.vs_wallet':
        'La cuenta Auvora es una identidad. La frase de recuperación es la cartera. Iniciar sesión nunca descarga claves privadas.',
    'notifications.title': 'Centro de notificaciones',
    'notifications.mark_all_read': 'Marcar todo como leído',
    'notifications.empty': 'Ninguna notificación coincide con este filtro.',
    'swap.unavailable': 'El intercambio no está disponible hasta que exista un proveedor de cotización de producción.',
    'buy.unavailable': 'Comprar no está disponible hasta que un on-ramp esté configurado.',
  },
  'de': {
    'recovery.wrong_word': 'Das ist nicht das Wort für diese Position. Bitte erneut versuchen.',
    'recovery.bip39_english':
        'Wiederherstellungswörter sind BIP-39-Englisch. Die App-Sprache übersetzt sie nicht.',
    'receive.wrong_network': 'Prüfen Sie das Netzwerk genau. Das falsche Netzwerk kann Guthaben dauerhaft verlieren.',
    'send.broadcast_off': 'Live-Broadcast ist aus. Dieses Gerät kann nur lokal vorbereiten und signieren.',
    'account.vs_wallet':
        'Das Auvora-Konto ist eine Identität. Die Recovery-Phrase ist die Wallet. Login lädt niemals private Schlüssel herunter.',
    'notifications.title': 'Benachrichtigungszentrale',
    'notifications.mark_all_read': 'Alle als gelesen markieren',
    'notifications.empty': 'Keine Benachrichtigungen für diesen Filter.',
    'swap.unavailable': 'Swap ist nicht verfügbar, bis ein Produktions-Quote-Anbieter angebunden ist.',
    'buy.unavailable': 'Kaufen ist nicht verfügbar, bis ein On-Ramp-Partner konfiguriert ist.',
  },
  'pt': {
    'recovery.wrong_word': 'Essa não é a palavra desta posição. Tente novamente.',
    'recovery.bip39_english':
        'As palavras de recuperação são BIP-39 em inglês. Mudar o idioma do app não as traduz.',
    'receive.wrong_network': 'Confirme exatamente a rede. A rede errada pode perder os fundos para sempre.',
    'send.broadcast_off': 'A transmissão ao vivo está desligada. Este dispositivo só pode preparar e assinar localmente.',
    'account.vs_wallet':
        'A conta Auvora é uma identidade. A frase de recuperação é a carteira. O login nunca transfere chaves privadas.',
    'notifications.title': 'Central de notificações',
    'notifications.mark_all_read': 'Marcar tudo como lido',
    'notifications.empty': 'Nenhuma notificação corresponde a este filtro.',
    'swap.unavailable': 'A troca fica indisponível até existir um provedor de cotação de produção.',
    'buy.unavailable': 'Comprar fica indisponível até um on-ramp estar configurado.',
  },
  'it': {
    'recovery.wrong_word': 'Questa non è la parola di questa posizione. Riprova.',
    'recovery.bip39_english':
        'Le parole di recupero sono BIP-39 in inglese. Cambiare la lingua dell’app non le traduce.',
    'receive.wrong_network': 'Verifica esattamente la rete. La rete sbagliata può far perdere i fondi in modo permanente.',
    'send.broadcast_off': 'La trasmissione live è disattivata. Questo dispositivo può solo preparare e firmare in locale.',
    'account.vs_wallet':
        'L’account Auvora è un’identità. La frase di recupero è il wallet. L’accesso non scarica mai le chiavi private.',
    'notifications.title': 'Centro notifiche',
    'notifications.mark_all_read': 'Segna tutto come letto',
    'notifications.empty': 'Nessuna notifica corrisponde a questo filtro.',
    'swap.unavailable': 'Lo swap non è disponibile finché non c’è un provider di quotazione di produzione.',
    'buy.unavailable': 'Acquista non è disponibile finché un on-ramp non è configurato.',
  },
  'nl': {
    'recovery.wrong_word': 'Dat is niet het woord voor deze positie. Probeer opnieuw.',
    'recovery.bip39_english':
        'Herstelwoorden zijn BIP-39-Engels. De app-taal vertaalt ze niet.',
    'receive.wrong_network': 'Controleer het netwerk exact. Een verkeerd netwerk kan tegoeden permanent verloren laten gaan.',
    'send.broadcast_off': 'Live broadcast staat uit. Dit apparaat kan alleen lokaal voorbereiden en ondertekenen.',
    'account.vs_wallet':
        'Het Auvora-account is een identiteit. De herstelzin is de wallet. Inloggen downloadt nooit privésleutels.',
    'notifications.title': 'Notificatiecentrum',
    'notifications.mark_all_read': 'Alles als gelezen markeren',
    'notifications.empty': 'Geen meldingen voor dit filter.',
    'swap.unavailable': 'Swap is niet beschikbaar tot er een productie-quoteprovider is.',
    'buy.unavailable': 'Kopen is niet beschikbaar tot een on-ramp is geconfigureerd.',
  },
  'sv': {
    'recovery.wrong_word': 'Det är inte ordet för den här positionen. Försök igen.',
    'recovery.bip39_english':
        'Återställningsorden är BIP-39-engelska. Appens språk översätter dem inte.',
    'receive.wrong_network': 'Matcha nätverket exakt. Fel nätverk kan förlora tillgångar för alltid.',
    'send.broadcast_off': 'Live-sändning är av. Enheten kan bara förbereda och signera lokalt.',
    'account.vs_wallet':
        'Auvora-kontot är en identitet. Återställningsfrasen är plånboken. Inloggning laddar aldrig ner privata nycklar.',
    'notifications.title': 'Aviseringscenter',
    'notifications.mark_all_read': 'Markera alla som lästa',
    'notifications.empty': 'Inga aviseringar matchar det här filtret.',
    'swap.unavailable': 'Swap är inte tillgängligt förrän en produktionsleverantör finns.',
    'buy.unavailable': 'Köp är inte tillgängligt förrän en on-ramp är konfigurerad.',
  },
  'pl': {
    'recovery.wrong_word': 'To nie jest słowo dla tej pozycji. Spróbuj ponownie.',
    'recovery.bip39_english':
        'Słowa odzyskiwania to angielski BIP-39. Zmiana języka aplikacji ich nie tłumaczy.',
    'receive.wrong_network': 'Dopasuj dokładnie sieć. Zła sieć może trwale utracić środki.',
    'send.broadcast_off': 'Transmisja na żywo jest wyłączona. To urządzenie może tylko przygotować i podpisać lokalnie.',
    'account.vs_wallet':
        'Konto Auvora to tożsamość. Fraza odzyskiwania to portfel. Logowanie nigdy nie pobiera kluczy prywatnych.',
    'notifications.title': 'Centrum powiadomień',
    'notifications.mark_all_read': 'Oznacz wszystkie jako przeczytane',
    'notifications.empty': 'Brak powiadomień dla tego filtra.',
    'swap.unavailable': 'Swap jest niedostępny, dopóki nie będzie dostawcy notowań produkcyjnych.',
    'buy.unavailable': 'Kupno jest niedostępne, dopóki on-ramp nie zostanie skonfigurowany.',
  },
  'ro': {
    'recovery.wrong_word': 'Acesta nu este cuvântul pentru această poziție. Încearcă din nou.',
    'recovery.bip39_english':
        'Cuvintele de recuperare sunt BIP-39 în engleză. Limba aplicației nu le traduce.',
    'receive.wrong_network': 'Potrivește exact rețeaua. O rețea greșită poate pierde fondurile definitiv.',
    'send.broadcast_off': 'Difuzarea live este oprită. Acest dispozitiv poate doar pregăti și semna local.',
    'account.vs_wallet':
        'Contul Auvora este o identitate. Fraza de recuperare este portofelul. Autentificarea nu descarcă niciodată chei private.',
    'notifications.title': 'Centru de notificări',
    'notifications.mark_all_read': 'Marchează tot ca citit',
    'notifications.empty': 'Nicio notificare nu corespunde acestui filtru.',
    'swap.unavailable': 'Swap-ul este indisponibil până există un furnizor de cotații de producție.',
    'buy.unavailable': 'Cumpărarea este indisponibilă până un on-ramp este configurat.',
  },
  'tr': {
    'recovery.wrong_word': 'Bu konumdaki kelime bu değil. Yeniden deneyin.',
    'recovery.bip39_english':
        'Kurtarma kelimeleri BIP-39 İngilizcesidir. Uygulama dilini değiştirmek bunları çevirmez.',
    'receive.wrong_network': 'Ağı tam olarak eşleştirin. Yanlış ağ varlıkları kalıcı olarak kaybettirebilir.',
    'send.broadcast_off': 'Canlı yayın kapalı. Bu cihaz yalnızca yerel olarak hazırlayıp imzalayabilir.',
    'account.vs_wallet':
        'Auvora hesabı bir kimliktir. Kurtarma cümlesi cüzdandır. Giriş özel anahtar indirmez.',
    'notifications.title': 'Bildirim merkezi',
    'notifications.mark_all_read': 'Tümünü okundu işaretle',
    'notifications.empty': 'Bu filtreyle eşleşen bildirim yok.',
    'swap.unavailable': 'Üretim kotasyon sağlayıcısı bağlanana kadar takas kullanılamaz.',
    'buy.unavailable': 'On-ramp yapılandırılana kadar satın alma kullanılamaz.',
  },
  'ru': {
    'recovery.wrong_word': 'Это не слово для этой позиции. Попробуйте ещё раз.',
    'recovery.bip39_english':
        'Слова восстановления — английский BIP-39. Смена языка приложения их не переводит.',
    'receive.wrong_network': 'Точно совпадайте сеть. Неверная сеть может безвозвратно потерять средства.',
    'send.broadcast_off': 'Онлайн-трансляция выключена. Это устройство может только подготовить и подписать локально.',
    'account.vs_wallet':
        'Аккаунт Auvora — это личность. Фраза восстановления — кошелёк. Вход никогда не загружает закрытые ключи.',
    'notifications.title': 'Центр уведомлений',
    'notifications.mark_all_read': 'Отметить всё прочитанным',
    'notifications.empty': 'Нет уведомлений по этому фильтру.',
    'swap.unavailable': 'Обмен недоступен, пока нет производственного поставщика котировок.',
    'buy.unavailable': 'Покупка недоступна, пока не настроен on-ramp.',
  },
  'uk': {
    'recovery.wrong_word': 'Це не слово для цієї позиції. Спробуйте ще раз.',
    'recovery.bip39_english':
        'Слова відновлення — англійська BIP-39. Зміна мови застосунку їх не перекладає.',
    'receive.wrong_network': 'Точно звірте мережу. Неправильна мережа може назавжди втратити кошти.',
    'send.broadcast_off': 'Живу трансляцію вимкнено. Цей пристрій може лише підготувати й підписати локально.',
    'account.vs_wallet':
        'Обліковий запис Auvora — це особа. Фраза відновлення — гаманець. Вхід ніколи не завантажує приватні ключі.',
    'notifications.title': 'Центр сповіщень',
    'notifications.mark_all_read': 'Позначити все прочитаним',
    'notifications.empty': 'Немає сповіщень за цим фільтром.',
    'swap.unavailable': 'Обмін недоступний, доки немає виробничого постачальника котирувань.',
    'buy.unavailable': 'Купівля недоступна, доки не налаштовано on-ramp.',
  },
  'ar': {
    'recovery.wrong_word': 'هذه ليست الكلمة لهذا الموضع. حاول مرة أخرى.',
    'recovery.bip39_english':
        'كلمات الاسترداد هي BIP-39 بالإنجليزية. تغيير لغة التطبيق لا يترجمها.',
    'receive.wrong_network': 'طابق الشبكة بدقة. الشبكة الخاطئة قد تفقد الأصول نهائياً.',
    'send.broadcast_off': 'البث المباشر متوقف. يمكن لهذا الجهاز التحضير والتوقيع محلياً فقط.',
    'account.vs_wallet':
        'حساب أفورا هو هوية. عبارة الاسترداد هي المحفظة. تسجيل الدخول لا ينزّل المفاتيح الخاصة أبداً.',
    'notifications.title': 'مركز الإشعارات',
    'notifications.mark_all_read': 'تعليم الكل كمقروء',
    'notifications.empty': 'لا توجد إشعارات تطابق هذا التصفية.',
    'swap.unavailable': 'المبادلة غير متاحة حتى يتوفر مزود تسعير للإنتاج.',
    'buy.unavailable': 'الشراء غير متاح حتى يتم إعداد شريك الإيداع بالعملة الورقية.',
  },
  'hi': {
    'recovery.wrong_word': 'यह इस स्थान का शब्द नहीं है। फिर कोशिश करें।',
    'recovery.bip39_english':
        'रिकवरी शब्द BIP-39 अंग्रेज़ी हैं। ऐप की भाषा बदलने से वे अनुवादित नहीं होते।',
    'receive.wrong_network': 'नेटवर्क ठीक-ठीक मिलाएँ। गलत नेटवर्क धन स्थायी रूप से खो सकता है।',
    'send.broadcast_off': 'लाइव प्रसारण बंद है। यह डिवाइस केवल स्थानीय रूप से तैयार और साइन कर सकता है।',
    'account.vs_wallet':
        'Auvora खाता एक पहचान है। रिकवरी वाक्यांश वॉलेट है। लॉगिन निजी कुंजियाँ कभी डाउनलोड नहीं करता।',
    'notifications.title': 'सूचना केंद्र',
    'notifications.mark_all_read': 'सभी को पढ़ा चिह्नित करें',
    'notifications.empty': 'इस फ़िल्टर से कोई सूचना मेल नहीं खाती।',
    'swap.unavailable': 'उत्पादन कोट प्रदाता जुड़ने तक स्वैप उपलब्ध नहीं है।',
    'buy.unavailable': 'ऑन-रैंप कॉन्फ़िगर होने तक खरीद उपलब्ध नहीं है।',
  },
  'id': {
    'recovery.wrong_word': 'Itu bukan kata untuk posisi ini. Coba lagi.',
    'recovery.bip39_english':
        'Kata pemulihan adalah bahasa Inggris BIP-39. Mengubah bahasa aplikasi tidak menerjemahkannya.',
    'receive.wrong_network': 'Cocokkan jaringan dengan tepat. Jaringan yang salah dapat kehilangan dana secara permanen.',
    'send.broadcast_off': 'Siaran langsung nonaktif. Perangkat ini hanya dapat menyiapkan dan menandatangani secara lokal.',
    'account.vs_wallet':
        'Akun Auvora adalah identitas. Frasa pemulihan adalah dompet. Masuk tidak pernah mengunduh kunci privat.',
    'notifications.title': 'Pusat notifikasi',
    'notifications.mark_all_read': 'Tandai semua sudah dibaca',
    'notifications.empty': 'Tidak ada notifikasi yang cocok dengan filter ini.',
    'swap.unavailable': 'Swap tidak tersedia sampai penyedia kuotasi produksi terhubung.',
    'buy.unavailable': 'Beli tidak tersedia sampai on-ramp dikonfigurasi.',
  },
  'vi': {
    'recovery.wrong_word': 'Đó không phải là từ cho vị trí này. Hãy thử lại.',
    'recovery.bip39_english':
        'Các từ khôi phục là tiếng Anh BIP-39. Đổi ngôn ngữ ứng dụng không dịch chúng.',
    'receive.wrong_network': 'Khớp chính xác mạng. Sai mạng có thể mất tài sản vĩnh viễn.',
    'send.broadcast_off': 'Phát trực tiếp đang tắt. Thiết bị này chỉ có thể chuẩn bị và ký cục bộ.',
    'account.vs_wallet':
        'Tài khoản Auvora là danh tính. Cụm từ khôi phục là ví. Đăng nhập không bao giờ tải khóa riêng.',
    'notifications.title': 'Trung tâm thông báo',
    'notifications.mark_all_read': 'Đánh dấu tất cả đã đọc',
    'notifications.empty': 'Không có thông báo nào khớp bộ lọc này.',
    'swap.unavailable': 'Hoán đổi chưa khả dụng cho đến khi có nhà cung cấp báo giá sản xuất.',
    'buy.unavailable': 'Mua chưa khả dụng cho đến khi on-ramp được cấu hình.',
  },
  'th': {
    'recovery.wrong_word': 'คำนี้ไม่ใช่คำในตำแหน่งนี้ ลองอีกครั้ง',
    'recovery.bip39_english':
        'คำกู้คืนเป็นภาษาอังกฤษ BIP-39 การเปลี่ยนภาษาแอปจะไม่แปลคำเหล่านี้',
    'receive.wrong_network': 'จับคู่เครือข่ายให้ตรง เครือข่ายผิดอาจทำให้สินทรัพย์หายถาวร',
    'send.broadcast_off': 'การออกอากาศจริงปิดอยู่ อุปกรณ์นี้เตรียมและลงนามในเครื่องเท่านั้น',
    'account.vs_wallet':
        'บัญชี Auvora คือตัวตน วลีกู้คืนคือวอลเล็ต การเข้าสู่ระบบไม่ดาวน์โหลดคีย์ส่วนตัว',
    'notifications.title': 'ศูนย์การแจ้งเตือน',
    'notifications.mark_all_read': 'ทำเครื่องหมายว่าอ่านแล้วทั้งหมด',
    'notifications.empty': 'ไม่มีการแจ้งเตือนที่ตรงกับตัวกรองนี้',
    'swap.unavailable': 'การสลับยังไม่พร้อมจนกว่าจะมีผู้ให้บริการราคาสำหรับโปรดักชัน',
    'buy.unavailable': 'การซื้อยังไม่พร้อมจนกว่าจะตั้งค่า on-ramp',
  },
  'zh': {
    'recovery.wrong_word': '这不是该位置的单词。请重试。',
    'recovery.bip39_english': '助记词为 BIP-39 英语。更改应用语言不会翻译这些单词。',
    'receive.wrong_network': '请精确核对网络。发错网络可能导致资产永久丢失。',
    'send.broadcast_off': '尚未开启链上广播。本设备仅可在本地准备并签名。',
    'account.vs_wallet': 'Auvora 账户是身份。助记词才是钱包。登录绝不会下载私钥。',
    'notifications.title': '通知中心',
    'notifications.mark_all_read': '全部标为已读',
    'notifications.empty': '没有符合此筛选的通知。',
    'swap.unavailable': '在接入生产级报价服务前，兑换不可用。',
    'buy.unavailable': '在配置法币入金合作方之前，购买不可用。',
  },
  'zh-hant': {
    'recovery.wrong_word': '這不是此位置的單字。請再試一次。',
    'recovery.bip39_english': '助記詞為 BIP-39 英語。變更應用程式語言不會翻譯這些單字。',
    'receive.wrong_network': '請精確核對網路。發錯網路可能導致資產永久遺失。',
    'send.broadcast_off': '尚未開啟鏈上廣播。本裝置僅可在本機準備並簽名。',
    'account.vs_wallet': 'Auvora 帳戶是身分。助記詞才是錢包。登入絕不會下載私鑰。',
    'notifications.title': '通知中心',
    'notifications.mark_all_read': '全部標為已讀',
    'notifications.empty': '沒有符合此篩選的通知。',
    'swap.unavailable': '在接入正式報價服務前，兌換無法使用。',
    'buy.unavailable': '在設定法幣入金合作夥伴之前，購買無法使用。',
  },
  'ja': {
    'recovery.wrong_word': 'この位置の単語ではありません。もう一度お試しください。',
    'recovery.bip39_english': 'リカバリーフレーズは BIP-39 の英語です。アプリ言語を変えても翻訳されません。',
    'receive.wrong_network': 'ネットワークを正確に合わせてください。違うネットワークでは資産が失われることがあります。',
    'send.broadcast_off': 'ライブブロードキャストはオフです。この端末はローカルで準備・署名のみ行えます。',
    'account.vs_wallet': 'Auvora アカウントは身分です。リカバリーフレーズがウォレットです。ログインで秘密鍵はダウンロードされません。',
    'notifications.title': '通知センター',
    'notifications.mark_all_read': 'すべて既読にする',
    'notifications.empty': 'このフィルターに一致する通知はありません。',
    'swap.unavailable': '本番の見積もりプロバイダー接続までスワップは利用できません。',
    'buy.unavailable': 'オンランプが設定されるまで購入は利用できません。',
  },
  'ko': {
    'recovery.wrong_word': '이 위치의 단어가 아닙니다. 다시 시도하세요.',
    'recovery.bip39_english': '복구 단어는 BIP-39 영어입니다. 앱 언어를 바꿔도 번역되지 않습니다.',
    'receive.wrong_network': '네트워크를 정확히 맞추세요. 잘못된 네트워크는 자산을 영구히 잃을 수 있습니다.',
    'send.broadcast_off': '실시간 브로드캐스트가 꺼져 있습니다. 이 기기는 로컬에서만 준비하고 서명할 수 있습니다.',
    'account.vs_wallet': 'Auvora 계정은 신원입니다. 복구 구문이 지갑입니다. 로그인은 개인키를 내려받지 않습니다.',
    'notifications.title': '알림 센터',
    'notifications.mark_all_read': '모두 읽음으로 표시',
    'notifications.empty': '이 필터와 일치하는 알림이 없습니다.',
    'swap.unavailable': '프로덕션 시세 제공자가 연결되기 전까지 스왑을 사용할 수 없습니다.',
    'buy.unavailable': '온램프가 구성되기 전까지 구매를 사용할 수 없습니다.',
  },
};

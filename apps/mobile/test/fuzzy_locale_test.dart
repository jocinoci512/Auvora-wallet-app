import 'package:auvora_wallet/l10n/auvora_locale.dart';
import 'package:auvora_wallet/preferences/models.dart';
import 'package:auvora_wallet/search/fuzzy.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('fuzzy search', () {
    test('exact and prefix score highly', () {
      expect(fuzzyScore('eth', 'ETH'), greaterThanOrEqualTo(90));
      expect(fuzzyScore('settin', 'Settings'), greaterThanOrEqualTo(40));
    });

    test('tolerates small typos', () {
      expect(fuzzyMatches('securty', 'Security Center'), isTrue);
      expect(fuzzyMatches('notifcations', 'Notifications'), isTrue);
    });

    test('ranks assist-like hits', () {
      final items = ['Settings', 'Security Center', 'Help & support'];
      final ranked = fuzzyRank('securty', items, (s) => [s]);
      expect(ranked.first, 'Security Center');
    });
  });

  group('locale framework', () {
    test('formats currency and dates for en_US', () {
      final locale = AuvoraLocale(const LocalePrefs());
      expect(locale.formatCurrency(12.5), contains('12'));
      expect(locale.formatDate(DateTime(2026, 7, 31)), isNotEmpty);
      expect(locale.isRtl, isFalse);
    });

    test('string catalog lookup returns English', () {
      expect(AuvoraStrings.lookup('settings.title'), 'Settings');
      expect(AuvoraStrings.lookup('intelligence.send_irreversible'), contains('reversed'));
    });
  });

  group('accent preference', () {
    test('maps accent enums to colors', () {
      expect(accentColorFor(AccentColorPreference.lagoon).a, greaterThan(0));
      expect(accentColorFor(AccentColorPreference.forest).a, greaterThan(0));
    });
  });
}

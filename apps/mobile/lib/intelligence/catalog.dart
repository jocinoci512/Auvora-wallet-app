import '../portfolio/models.dart';
import 'models.dart';

/// On-device Auvora Intelligence catalog — instant, educational, never advice.
class IntelligenceCatalog {
  IntelligenceCatalog._();

  static const disclaimer =
      'Educational guidance only. Auvora never recommends buying, selling, or trading.';

  static const learnLessons = <LearnLesson>[
    LearnLesson(
      id: 'wallet-basics',
      category: 'Wallet basics',
      title: 'What a wallet actually holds',
      summary: 'Keys, addresses, and why we never ask for your phrase in chat.',
      minutes: 4,
      body: [
        'A wallet app shows balances and helps you approve transfers. The important part is the keys that prove control of addresses on a network.',
        'Your recovery phrase can recreate those keys. Auvora will never ask for it in chat, email, or a random popup.',
        'An address is safe to share for receiving. Your phrase is never safe to share.',
      ],
    ),
    LearnLesson(
      id: 'private-keys',
      category: 'Wallet basics',
      title: 'Private keys in plain language',
      summary: 'Why keys matter and how the app keeps them on this device.',
      minutes: 3,
      body: [
        'A private key is the secret that signs transactions for an address. Whoever has it can move funds.',
        'Auvora stores key material in this device’s secure storage. Preview builds still treat keys as sensitive.',
        'Never type a private key into a website form, message, or “support” chat.',
      ],
    ),
    LearnLesson(
      id: 'recovery',
      category: 'Security',
      title: 'Recovery phrases',
      summary: 'Practice recovery before you need it.',
      minutes: 5,
      body: [
        'Write your phrase offline. Never photograph it or paste it into cloud notes or chat.',
        'Practice recovery in a guided rehearsal so you know it works — before an emergency.',
        'If you lose both device and phrase, support generally cannot restore self-custody funds.',
      ],
    ),
    LearnLesson(
      id: 'gas-fees',
      category: 'Networks',
      title: 'Network fees (sometimes called gas)',
      summary: 'Why fees change and what “faster” really means.',
      minutes: 4,
      body: [
        'Fees pay the network to include your transaction. Busy moments usually cost more.',
        'Choosing a higher fee often means a better chance of quicker confirmation — an estimate, not a guarantee.',
        'If a fee looks high and the transfer is not urgent, waiting is often fine. That choice is yours.',
      ],
    ),
    LearnLesson(
      id: 'confirmations',
      category: 'Networks',
      title: 'Blockchain confirmations',
      summary: 'Why pending is normal — and what failed means.',
      minutes: 3,
      body: [
        'After you send, the network still needs to include and confirm the transaction. Pending means “not finished yet.”',
        'Confirmation time depends on the network and how busy it is. A few minutes is common on many networks.',
        'Failed usually means the transfer did not settle. Any network fee already paid may still be gone — funds beyond that typically stay in your wallet.',
      ],
    ),
    LearnLesson(
      id: 'stablecoins',
      category: 'Assets',
      title: 'Stablecoins',
      summary: 'What they aim to do — without yield hype.',
      minutes: 3,
      body: [
        'Stablecoins try to track a stable value (often a fiat currency). They are still crypto assets with their own risks.',
        'They are common for transfers and for holding value between moves — not a recommendation to buy them.',
        'Always match the network when receiving stablecoins. The wrong network can lose funds permanently.',
      ],
    ),
    LearnLesson(
      id: 'staking',
      category: 'Assets',
      title: 'Staking (educational)',
      summary: 'Lockups, cool-downs, and why rewards are not guaranteed.',
      minutes: 4,
      body: [
        'Staking can mean locking assets to help secure a network. Rewards and risks vary — nothing is guaranteed.',
        'Unstaking often has a cool-down. Read lockup and risks before you change anything.',
        'This lesson educates. Auvora does not recommend validators or claim APYs.',
      ],
    ),
    LearnLesson(
      id: 'bridges',
      category: 'Transfers',
      title: 'Bridge transfers',
      summary: 'Moving value between networks — patiently.',
      minutes: 4,
      body: [
        'A bridge moves value from one network to another. Delays are common while steps complete.',
        'Compare fees and estimated arrival time, then confirm both sides carefully.',
        'Keep the transaction ID if something looks stuck — progress is often lock → relay → mint.',
      ],
    ),
    LearnLesson(
      id: 'swaps',
      category: 'Transfers',
      title: 'Swaps and slippage',
      summary: 'Price movement between quote and fill.',
      minutes: 3,
      body: [
        'A swap trades one asset for another through a route. The quote is an estimate.',
        'Slippage is how much the price may move before the swap finishes. Higher tolerance fills more often but can get a worse rate.',
        'Review the estimate before you confirm. Auvora does not recommend which assets to swap.',
      ],
    ),
    LearnLesson(
      id: 'scams',
      category: 'Security',
      title: 'Spotting phishing and fake support',
      summary: 'Red flags and what Auvora will never ask.',
      minutes: 4,
      body: [
        'Scammers rush you: “verify now,” “refund,” or “support needs your phrase.” Real support never needs your phrase.',
        'Check URLs carefully. Prefer bookmarks for sites you use often.',
        'On Send, pause on address warnings. Decline odd connection or signature requests.',
      ],
    ),
    LearnLesson(
      id: 'biometrics',
      category: 'Security',
      title: 'Biometric protection',
      summary: 'What Face ID / fingerprint protects — and what it does not.',
      minutes: 2,
      body: [
        'Biometrics help lock this device so a borrowed phone is harder to use.',
        'They do not replace your recovery phrase. Phrase + device lock work together.',
        'You can turn biometrics off anytime in Security settings.',
      ],
    ),
  ];

  static LearnLesson? lessonById(String id) {
    for (final lesson in learnLessons) {
      if (lesson.id == id) return lesson;
    }
    return null;
  }

  static List<LearnLesson> searchLessons(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return learnLessons;
    return learnLessons
        .where(
          (l) =>
              l.title.toLowerCase().contains(q) ||
              l.summary.toLowerCase().contains(q) ||
              l.category.toLowerCase().contains(q) ||
              l.body.any((p) => p.toLowerCase().contains(q)),
        )
        .toList();
  }

  static IntelligenceExplanation explainTransaction(PortfolioTx tx) {
    switch (tx.status) {
      case TxStatus.pending:
        return IntelligenceExplanation(
          id: 'tx-pending',
          kind: IntelligenceKind.transaction,
          title: 'Still confirming',
          whatHappened:
              'Your ${tx.type.label.toLowerCase()} was submitted on ${tx.network.label} and is waiting for the network to confirm it.',
          whyItMatters:
              'Pending is normal. Busy networks take longer. Your funds are not “lost” while the network finishes.',
          whatYouCanDo:
              'Wait a few minutes, then pull to refresh. Open the explorer link if you want a second view. Avoid sending the same transfer again unless you are sure the first failed.',
          learnTopicId: 'confirmations',
        );
      case TxStatus.failed:
        return IntelligenceExplanation(
          id: 'tx-failed',
          kind: IntelligenceKind.transaction,
          title: 'This transfer did not complete',
          whatHappened: tx.note ??
              'The network did not finish this ${tx.type.label.toLowerCase()} successfully.',
          whyItMatters:
              'Failed means the action did not settle. A network fee already paid may still be gone; amounts beyond that usually stay in your wallet.',
          whatYouCanDo:
              'Check the fee line on this receipt. If you still need to send, start a new transfer after confirming balances. Ask Support only with the transaction ID — never your recovery phrase.',
          learnTopicId: 'confirmations',
        );
      case TxStatus.cancelled:
        return IntelligenceExplanation(
          id: 'tx-cancelled',
          kind: IntelligenceKind.transaction,
          title: 'Cancelled before it settled',
          whatHappened: 'You cancelled this request before the network finished it.',
          whyItMatters: 'Nothing on-chain completed for this request.',
          whatYouCanDo: 'If you still want to move funds, start a fresh transfer when you are ready.',
        );
      case TxStatus.completed:
        if (tx.type == TxType.bridge) {
          return IntelligenceExplanation(
            id: 'tx-bridge-done',
            kind: IntelligenceKind.transaction,
            title: 'Bridge step finished',
            whatHappened: 'This bridge-related step completed on ${tx.network.label}.',
            whyItMatters:
                'Bridges can have multiple steps. Arrival on the destination network may still take time.',
            whatYouCanDo:
                'Check the destination network balance when ready. Keep this receipt if anything looks delayed.',
            learnTopicId: 'bridges',
          );
        }
        if (tx.type == TxType.swap) {
          return IntelligenceExplanation(
            id: 'tx-swap-done',
            kind: IntelligenceKind.transaction,
            title: 'Swap finished',
            whatHappened: 'This swap completed on ${tx.network.label}.',
            whyItMatters:
                'The fill can differ slightly from the quote when prices move (slippage). That is a network/market effect, not advice.',
            whatYouCanDo: 'Review Activity for the new balances. Learn about slippage anytime in Learning Center.',
            learnTopicId: 'swaps',
          );
        }
        return IntelligenceExplanation(
          id: 'tx-done',
          kind: IntelligenceKind.transaction,
          title: 'Transfer finished',
          whatHappened: 'This ${tx.type.label.toLowerCase()} finished successfully on ${tx.network.label}.',
          whyItMatters: 'Confirmed activity shows here so you can track history without opening every explorer.',
          whatYouCanDo: 'Save or share the receipt if you need a record. Explorer links stay available on this screen.',
          learnTopicId: 'confirmations',
        );
    }
  }

  static IntelligenceExplanation explainFeeEstimate({
    required String networkLabel,
    required bool elevated,
  }) {
    return IntelligenceExplanation(
      id: elevated ? 'fee-spike' : 'fee-normal',
      kind: IntelligenceKind.transaction,
      title: elevated ? 'Fees look higher than usual' : 'About network fees',
      whatHappened: elevated
          ? 'Estimated fees on $networkLabel are elevated versus a quiet period (preview estimate).'
          : 'This estimate is what the network may charge to include your transfer on $networkLabel.',
      whyItMatters:
          'Fees pay the network. Higher fees often improve the chance of faster confirmation — timing is never guaranteed.',
      whatYouCanDo: elevated
          ? 'If this transfer is not urgent, you can wait and check again later. Or continue if timing matters more to you — your choice.'
          : 'Review the estimate before you confirm. You can cancel anytime before submitting.',
      learnTopicId: 'gas-fees',
    );
  }

  static IntelligenceExplanation explainConnection({
    required String origin,
    required bool lookalike,
    required bool unknown,
  }) {
    if (lookalike) {
      return IntelligenceExplanation(
        id: 'sec-lookalike',
        kind: IntelligenceKind.security,
        title: 'This site name looks similar to a known brand',
        whatHappened: 'A connection request from “$origin” may be mimicking a familiar name.',
        whyItMatters:
            'Lookalike sites are a common scam pattern. Approving can expose signatures or spending permissions.',
          whatYouCanDo:
              'Pause. Compare the exact spelling and URL. Prefer bookmarks for sites you trust. Decline if anything feels off — you can always connect later.',
          learnTopicId: 'scams',
        );
    }
    if (unknown) {
      return IntelligenceExplanation(
        id: 'sec-unknown',
        kind: IntelligenceKind.security,
        title: 'Unknown website asking to connect',
        whatHappened: '“$origin” wants to connect to this wallet. It is not on your trusted list yet.',
        whyItMatters:
            'Connections let sites request signatures or permissions. Unknown sites deserve a careful read.',
        whatYouCanDo:
            'Read every permission. Prefer limited approvals. Decline if you did not expect this prompt.',
        learnTopicId: 'scams',
      );
    }
    return IntelligenceExplanation(
      id: 'sec-connect',
      kind: IntelligenceKind.security,
      title: 'Connection request',
      whatHappened: '“$origin” is asking to connect so it can request actions you still approve one by one.',
      whyItMatters: 'Connecting is not the same as sending funds — but later prompts can move assets if you approve them.',
      whatYouCanDo: 'Review permissions, approve only what you understand, and revoke unused connections in Permission Center.',
    );
  }

  static IntelligenceExplanation explainSignature() {
    return const IntelligenceExplanation(
      id: 'sec-sign',
      kind: IntelligenceKind.security,
      title: 'Signature request',
      whatHappened: 'A site is asking you to sign a message or transaction with this wallet.',
      whyItMatters:
          'Signatures prove you control an address. Some signatures can authorize spending — read the details carefully.',
      whatYouCanDo:
          'If you did not expect this, reject it. Never sign to “verify” a recovery phrase. Real support will not ask you to sign mystery payloads.',
    );
  }

  static IntelligenceExplanation explainNetwork({
    required bool offline,
    required bool syncDelayed,
    required bool degraded,
  }) {
    if (offline) {
      return const IntelligenceExplanation(
        id: 'net-offline',
        kind: IntelligenceKind.network,
        title: 'You appear offline',
        whatHappened: 'This device cannot reach the network right now.',
        whyItMatters:
            'Balances shown may be the last values saved on this device. They can be outdated until you reconnect.',
        whatYouCanDo: 'Reconnect when you can, then pull to refresh. Sending still needs a live network.',
      );
    }
    if (degraded || syncDelayed) {
      return const IntelligenceExplanation(
        id: 'net-degraded',
        kind: IntelligenceKind.network,
        title: 'Network sync is slower than usual',
        whatHappened: 'One or more preview network endpoints look busy or degraded.',
        whyItMatters: 'Figures may update late. Congestion can also raise fees on some networks.',
        whatYouCanDo:
            'Wait and refresh. Check Diagnostics if you are supporting this build. Non-urgent transfers can wait for quieter fees.',
        learnTopicId: 'gas-fees',
      );
    }
    return const IntelligenceExplanation(
      id: 'net-ok',
      kind: IntelligenceKind.network,
      title: 'Networks look reachable',
      whatHappened: 'Preview health checks did not flag an outage.',
      whyItMatters: 'You can refresh balances and continue normal use.',
      whatYouCanDo: 'If something still looks wrong, pull to refresh or open Diagnostics for support details.',
    );
  }

  static const contextualTips = <ContextualTip>[
    ContextualTip(
      id: 'tip-after-import',
      trigger: 'afterImport',
      title: 'Verify your recovery phrase when you can',
      body: 'A short practice later confirms you can restore this wallet if the device is lost.',
      learnTopicId: 'recovery',
    ),
    ContextualTip(
      id: 'tip-after-biometrics',
      trigger: 'afterBiometrics',
      title: 'Biometrics lock this device',
      body: 'They make a borrowed phone harder to open — your recovery phrase is still the backup for device loss.',
      learnTopicId: 'biometrics',
    ),
    ContextualTip(
      id: 'tip-after-first-tx',
      trigger: 'afterFirstTx',
      title: 'Activity keeps your history',
      body: 'Transfers appear under Activity with status and a receipt. Pending usually means the network is still confirming.',
      learnTopicId: 'confirmations',
    ),
  ];

  static const searchAssistIndex = <SearchAssistHit>[
    SearchAssistHit(
      id: 'sa-settings',
      title: 'Settings',
      subtitle: 'Account, appearance, notifications, privacy',
      route: 'settings',
      keywords: ['settings', 'preferences', 'account', 'theme'],
    ),
    SearchAssistHit(
      id: 'sa-security',
      title: 'Security Center',
      subtitle: 'PIN, biometrics, recovery, protection score',
      route: 'security',
      keywords: ['security', 'pin', 'biometric', 'recovery', 'phrase'],
    ),
    SearchAssistHit(
      id: 'sa-permissions',
      title: 'Permission Center',
      subtitle: 'Connected apps and approvals',
      route: 'permissions',
      keywords: ['permissions', 'dapp', 'web3', 'connection', 'revoke'],
    ),
    SearchAssistHit(
      id: 'sa-learn',
      title: 'Learning Center',
      subtitle: 'Short lessons on fees, keys, and networks',
      route: 'learn',
      keywords: ['learn', 'lesson', 'gas', 'fee', 'bridge', 'stake', 'help'],
    ),
    SearchAssistHit(
      id: 'sa-guidance',
      title: 'Guidance settings',
      subtitle: 'How much Auvora Intelligence to show',
      route: 'guidance',
      keywords: ['guidance', 'intelligence', 'tips', 'hints', 'ai'],
    ),
    SearchAssistHit(
      id: 'sa-support',
      title: 'Help & support',
      subtitle: 'FAQ and contact paths',
      route: 'support',
      keywords: ['help', 'support', 'faq', 'contact'],
    ),
    SearchAssistHit(
      id: 'sa-activity',
      title: 'Activity',
      subtitle: 'Transaction history on this device',
      route: 'activity',
      keywords: ['activity', 'history', 'transactions', 'pending'],
    ),
    SearchAssistHit(
      id: 'sa-assets',
      title: 'Assets',
      subtitle: 'Balances and holdings',
      route: 'assets',
      keywords: ['assets', 'balances', 'tokens', 'portfolio'],
    ),
    SearchAssistHit(
      id: 'sa-notifications',
      title: 'Notification center',
      subtitle: 'In-app alerts for this device',
      route: 'notifications',
      keywords: ['notifications', 'alerts', 'inbox'],
    ),
  ];

  static List<SearchAssistHit> searchAssist(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    return searchAssistIndex.where((hit) {
      if (hit.title.toLowerCase().contains(q) || hit.subtitle.toLowerCase().contains(q)) {
        return true;
      }
      return hit.keywords.any((k) => k.contains(q) || q.contains(k));
    }).toList();
  }
}

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../portfolio/models.dart';

@immutable
class SavedContact {
  const SavedContact({
    required this.id,
    required this.name,
    required this.address,
    required this.network,
    this.favorite = false,
    this.lastUsed,
    this.walletLabel,
    this.notes,
  });

  final String id;
  final String name;
  final String address;
  final AssetNetwork network;
  final bool favorite;
  final DateTime? lastUsed;
  final String? walletLabel;
  final String? notes;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  String get preview {
    if (address.length < 12) return address;
    return '${address.substring(0, 6)}…${address.substring(address.length - 4)}';
  }

  SavedContact copyWith({
    String? name,
    String? address,
    AssetNetwork? network,
    bool? favorite,
    DateTime? lastUsed,
    String? walletLabel,
    String? notes,
  }) {
    return SavedContact(
      id: id,
      name: name ?? this.name,
      address: address ?? this.address,
      network: network ?? this.network,
      favorite: favorite ?? this.favorite,
      lastUsed: lastUsed ?? this.lastUsed,
      walletLabel: walletLabel ?? this.walletLabel,
      notes: notes ?? this.notes,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'address': address,
        'network': network.name,
        'favorite': favorite,
        'lastUsed': lastUsed?.toIso8601String(),
        'walletLabel': walletLabel,
        'notes': notes,
      };

  static SavedContact fromJson(Map<String, dynamic> j) {
    return SavedContact(
      id: j['id'] as String,
      name: j['name'] as String,
      address: j['address'] as String,
      network: AssetNetwork.values.firstWhere(
        (n) => n.name == j['network'],
        orElse: () => AssetNetwork.ethereum,
      ),
      favorite: j['favorite'] as bool? ?? false,
      lastUsed: j['lastUsed'] != null ? DateTime.tryParse(j['lastUsed'] as String) : null,
      walletLabel: j['walletLabel'] as String?,
      notes: j['notes'] as String?,
    );
  }
}

class AddressBookStore extends ChangeNotifier {
  static const _kContacts = 'auvora_contacts_v1';
  static const _kRecent = 'auvora_recent_recipients_v1';

  List<SavedContact> contacts = [];
  List<SavedContact> recent = [];

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    contacts = _decode(prefs.getString(_kContacts));
    recent = _decode(prefs.getString(_kRecent));
    if (contacts.isEmpty) {
      contacts = [
        const SavedContact(
          id: 'seed-1',
          name: 'Exchange deposit',
          address: '0x8f3a21b9c4d5e6f708192a3b4c5d6e7f8191c2d3',
          network: AssetNetwork.ethereum,
          favorite: true,
        ),
        const SavedContact(
          id: 'seed-2',
          name: 'Savings cold',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          network: AssetNetwork.bitcoin,
        ),
      ];
      await _persistContacts();
    }
    notifyListeners();
  }

  List<SavedContact> forNetwork(AssetNetwork network) {
    return contacts.where((c) => c.network == network).toList()
      ..sort((a, b) {
        if (a.favorite != b.favorite) return a.favorite ? -1 : 1;
        return a.name.compareTo(b.name);
      });
  }

  List<SavedContact> recentFor(AssetNetwork network) {
    return recent.where((c) => c.network == network).toList();
  }

  List<SavedContact> search(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) {
      return [...contacts]..sort((a, b) {
          if (a.favorite != b.favorite) return a.favorite ? -1 : 1;
          return a.name.compareTo(b.name);
        });
    }
    return contacts.where((c) {
      return c.name.toLowerCase().contains(q) ||
          c.address.toLowerCase().contains(q) ||
          c.network.label.toLowerCase().contains(q) ||
          (c.walletLabel?.toLowerCase().contains(q) ?? false) ||
          (c.notes?.toLowerCase().contains(q) ?? false);
    }).toList();
  }

  /// Returns an existing contact when the same address+network is already saved.
  SavedContact? findDuplicate({
    required String address,
    required AssetNetwork network,
    String? excludingId,
  }) {
    final needle = address.trim().toLowerCase();
    for (final c in contacts) {
      if (excludingId != null && c.id == excludingId) continue;
      if (c.network == network && c.address.toLowerCase() == needle) return c;
    }
    return null;
  }

  Future<void> upsert(SavedContact contact) async {
    final i = contacts.indexWhere((c) => c.id == contact.id);
    if (i >= 0) {
      contacts[i] = contact;
    } else {
      contacts = [...contacts, contact];
    }
    await _persistContacts();
    notifyListeners();
  }

  Future<SavedContact> add({
    required String name,
    required String address,
    required AssetNetwork network,
    String? walletLabel,
    String? notes,
  }) async {
    final c = SavedContact(
      id: const Uuid().v4(),
      name: name.trim(),
      address: address.trim(),
      network: network,
      walletLabel: walletLabel?.trim().isEmpty == true ? null : walletLabel?.trim(),
      notes: notes?.trim().isEmpty == true ? null : notes?.trim(),
    );
    await upsert(c);
    return c;
  }

  Future<void> remove(String id) async {
    contacts = contacts.where((c) => c.id != id).toList();
    await _persistContacts();
    notifyListeners();
  }

  Future<void> toggleFavorite(String id) async {
    final i = contacts.indexWhere((c) => c.id == id);
    if (i < 0) return;
    contacts[i] = contacts[i].copyWith(favorite: !contacts[i].favorite);
    await _persistContacts();
    notifyListeners();
  }

  Future<void> rememberRecipient({
    required String address,
    required AssetNetwork network,
    String? name,
  }) async {
    final now = DateTime.now();
    SavedContact? existingContact;
    for (final c in contacts) {
      if (c.address.toLowerCase() == address.toLowerCase() && c.network == network) {
        existingContact = c;
        break;
      }
    }
    final entry = SavedContact(
      id: existingContact?.id ?? 'recent-${address.hashCode}',
      name: existingContact?.name ?? name ?? 'Recent',
      address: address,
      network: network,
      favorite: existingContact?.favorite ?? false,
      lastUsed: now,
    );
    recent = [entry, ...recent.where((r) => r.address.toLowerCase() != address.toLowerCase())].take(8).toList();
    if (existingContact != null) {
      await upsert(existingContact.copyWith(lastUsed: now));
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kRecent, jsonEncode(recent.map((e) => e.toJson()).toList()));
    notifyListeners();
  }

  Future<void> _persistContacts() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kContacts, jsonEncode(contacts.map((e) => e.toJson()).toList()));
  }

  List<SavedContact> _decode(String? raw) {
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list.map((e) => SavedContact.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }
}

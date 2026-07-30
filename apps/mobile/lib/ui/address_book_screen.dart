import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../portfolio/models.dart';
import '../theme/aether_theme.dart';
import '../transfer/address_book.dart';
import '../transfer/address_validation.dart';

class AddressBookScreen extends StatefulWidget {
  const AddressBookScreen({super.key});

  @override
  State<AddressBookScreen> createState() => _AddressBookScreenState();
}

class _AddressBookScreenState extends State<AddressBookScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AddressBookStore>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final book = context.watch<AddressBookStore>();
    final contacts = [...book.contacts]
      ..sort((a, b) {
        if (a.favorite != b.favorite) return a.favorite ? -1 : 1;
        return a.name.compareTo(b.name);
      });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Address book'),
        actions: [
          IconButton(
            tooltip: 'Add contact',
            onPressed: () => _edit(context),
            icon: const Icon(Icons.person_add_alt_1_rounded),
          ),
        ],
      ),
      body: contacts.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Save trusted recipients for faster, safer sends.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AetherColors.muted, height: 1.45),
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              itemCount: contacts.length,
              separatorBuilder: (_, __) => const SizedBox(height: 6),
              itemBuilder: (context, i) {
                final c = contacts[i];
                return Material(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(14),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AetherColors.lagoon.withValues(alpha: 0.12),
                      child: Text(
                        c.initials,
                        style: const TextStyle(color: AetherColors.lagoon, fontWeight: FontWeight.w700),
                      ),
                    ),
                    title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${c.preview} · ${c.network.label}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: c.favorite ? 'Unfavorite' : 'Favorite',
                          onPressed: () => book.toggleFavorite(c.id),
                          icon: Icon(
                            c.favorite ? Icons.star_rounded : Icons.star_outline_rounded,
                            color: AetherColors.lagoon,
                          ),
                        ),
                        PopupMenuButton<String>(
                          onSelected: (v) async {
                            if (v == 'edit') await _edit(context, existing: c);
                            if (v == 'delete' && context.mounted) await _delete(context, c);
                          },
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: 'edit', child: Text('Edit')),
                            PopupMenuItem(value: 'delete', child: Text('Delete')),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add'),
      ),
    );
  }

  Future<void> _delete(BuildContext context, SavedContact c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove this contact?'),
        content: Text('“${c.name}” will be removed from your address book on this device.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      await context.read<AddressBookStore>().remove(c.id);
    }
  }

  Future<void> _edit(BuildContext context, {SavedContact? existing}) async {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final addrCtrl = TextEditingController(text: existing?.address ?? '');
    var network = existing?.network ?? AssetNetwork.ethereum;
    String? error;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return Padding(
              padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + MediaQuery.viewInsetsOf(ctx).bottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(existing == null ? 'Add contact' : 'Edit contact', style: Theme.of(ctx).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name')),
                  const SizedBox(height: 10),
                  TextField(
                    controller: addrCtrl,
                    decoration: const InputDecoration(labelText: 'Address'),
                    autocorrect: false,
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<AssetNetwork>(
                    initialValue: network,
                    items: [
                      for (final n in AssetNetwork.values)
                        DropdownMenuItem(value: n, child: Text(n.label)),
                    ],
                    onChanged: (n) {
                      if (n != null) setLocal(() => network = n);
                    },
                    decoration: const InputDecoration(labelText: 'Network'),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 10),
                    Text(error!, style: const TextStyle(color: AetherColors.danger)),
                  ],
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: () async {
                      final name = nameCtrl.text.trim();
                      final address = addrCtrl.text.trim();
                      if (name.isEmpty) {
                        setLocal(() => error = 'Add a name you will recognize.');
                        return;
                      }
                      final v = AddressValidation.validate(address, expected: network);
                      if (!v.ok) {
                        setLocal(() => error = v.message);
                        return;
                      }
                      final book = context.read<AddressBookStore>();
                      if (existing == null) {
                        await book.add(name: name, address: v.normalized ?? address, network: network);
                      } else {
                        await book.upsert(
                          existing.copyWith(name: name, address: v.normalized ?? address, network: network),
                        );
                      }
                      if (ctx.mounted) Navigator.pop(ctx);
                    },
                    child: Text(existing == null ? 'Save contact' : 'Save changes'),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

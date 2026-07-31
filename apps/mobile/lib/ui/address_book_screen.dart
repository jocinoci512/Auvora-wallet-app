import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../portfolio/models.dart';
import '../theme/aether_theme.dart';
import '../transfer/address_book.dart';
import '../transfer/address_validation.dart';
import 'send_flow_screen.dart';

class AddressBookScreen extends StatefulWidget {
  const AddressBookScreen({super.key});

  @override
  State<AddressBookScreen> createState() => _AddressBookScreenState();
}

class _AddressBookScreenState extends State<AddressBookScreen> {
  String _query = '';

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
    final contacts = book.search(_query);
    final recent = book.recent;

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
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: const InputDecoration(
                hintText: 'Search name, address, network…',
                prefixIcon: Icon(Icons.search_rounded),
              ),
            ),
          ),
          Expanded(
            child: contacts.isEmpty && recent.isEmpty
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
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 88),
                    children: [
                      if (_query.trim().isEmpty && recent.isNotEmpty) ...[
                        Text('Recent', style: Theme.of(context).textTheme.titleSmall),
                        const SizedBox(height: 8),
                        for (final c in recent.take(5))
                          _ContactCard(
                            contact: c,
                            onSend: () => _sendTo(c),
                            onEdit: () => _edit(context, existing: c),
                            onDelete: () => _delete(context, c),
                            onFavorite: () => book.toggleFavorite(c.id),
                          ),
                        const SizedBox(height: 16),
                        Text('Saved', style: Theme.of(context).textTheme.titleSmall),
                        const SizedBox(height: 8),
                      ],
                      if (contacts.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Text(
                            'No contacts match that search.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AetherColors.muted),
                          ),
                        )
                      else
                        for (final c in contacts)
                          _ContactCard(
                            contact: c,
                            onSend: () => _sendTo(c),
                            onEdit: () => _edit(context, existing: c),
                            onDelete: () => _delete(context, c),
                            onFavorite: () => book.toggleFavorite(c.id),
                          ),
                    ],
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add'),
      ),
    );
  }

  void _sendTo(SavedContact c) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SendFlowScreen(initialTo: c.address),
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
    final labelCtrl = TextEditingController(text: existing?.walletLabel ?? '');
    var network = existing?.network ?? AssetNetwork.ethereum;
    String? error;
    String? duplicateHint;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return Padding(
              padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + MediaQuery.viewInsetsOf(ctx).bottom),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      existing == null ? 'Add contact' : 'Edit contact',
                      style: Theme.of(ctx).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 12),
                    TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Nickname')),
                    const SizedBox(height: 10),
                    TextField(
                      controller: addrCtrl,
                      decoration: const InputDecoration(labelText: 'Address'),
                      autocorrect: false,
                      onChanged: (v) {
                        final dup = context.read<AddressBookStore>().findDuplicate(
                              address: v,
                              network: network,
                              excludingId: existing?.id,
                            );
                        setLocal(() {
                          duplicateHint = dup == null
                              ? null
                              : 'Already saved as “${dup.name}” on ${network.label}.';
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: labelCtrl,
                      decoration: const InputDecoration(labelText: 'Wallet label (optional)'),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<AssetNetwork>(
                      initialValue: network,
                      items: [
                        for (final n in AssetNetwork.values)
                          DropdownMenuItem(value: n, child: Text(n.label)),
                      ],
                      onChanged: (n) {
                        if (n == null) return;
                        setLocal(() {
                          network = n;
                          final dup = context.read<AddressBookStore>().findDuplicate(
                                address: addrCtrl.text,
                                network: network,
                                excludingId: existing?.id,
                              );
                          duplicateHint = dup == null
                              ? null
                              : 'Already saved as “${dup.name}” on ${network.label}.';
                        });
                      },
                      decoration: const InputDecoration(labelText: 'Network'),
                    ),
                    if (duplicateHint != null) ...[
                      const SizedBox(height: 10),
                      Text(duplicateHint!, style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
                    ],
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
                        final normalized = v.normalized ?? address;
                        final dup = book.findDuplicate(
                          address: normalized,
                          network: network,
                          excludingId: existing?.id,
                        );
                        if (dup != null && existing == null) {
                          final proceed = await showDialog<bool>(
                            context: ctx,
                            builder: (dCtx) => AlertDialog(
                              title: const Text('Duplicate address'),
                              content: Text(
                                '“${dup.name}” already uses this ${network.label} address. Save another contact anyway?',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(dCtx, false),
                                  child: const Text('Cancel'),
                                ),
                                FilledButton(
                                  onPressed: () => Navigator.pop(dCtx, true),
                                  child: const Text('Save anyway'),
                                ),
                              ],
                            ),
                          );
                          if (proceed != true) return;
                        }
                        if (existing == null) {
                          await book.add(
                            name: name,
                            address: normalized,
                            network: network,
                            walletLabel: labelCtrl.text,
                          );
                        } else {
                          await book.upsert(
                            existing.copyWith(
                              name: name,
                              address: normalized,
                              network: network,
                              walletLabel: labelCtrl.text.trim().isEmpty ? null : labelCtrl.text.trim(),
                            ),
                          );
                        }
                        if (ctx.mounted) Navigator.pop(ctx);
                      },
                      child: Text(existing == null ? 'Save contact' : 'Save changes'),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _ContactCard extends StatelessWidget {
  const _ContactCard({
    required this.contact,
    required this.onSend,
    required this.onEdit,
    required this.onDelete,
    required this.onFavorite,
  });

  final SavedContact contact;
  final VoidCallback onSend;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onFavorite;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        child: ListTile(
          onTap: onSend,
          leading: CircleAvatar(
            backgroundColor: AetherColors.lagoon.withValues(alpha: 0.12),
            child: Text(
              contact.initials,
              style: const TextStyle(color: AetherColors.lagoon, fontWeight: FontWeight.w700),
            ),
          ),
          title: Text(contact.name, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text(
            [
              contact.preview,
              contact.network.label,
              if (contact.walletLabel != null && contact.walletLabel!.isNotEmpty) contact.walletLabel!,
            ].join(' · '),
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                tooltip: 'Send',
                onPressed: onSend,
                icon: const Icon(Icons.send_rounded, color: AetherColors.lagoon),
              ),
              IconButton(
                tooltip: contact.favorite ? 'Unfavorite' : 'Favorite',
                onPressed: onFavorite,
                icon: Icon(
                  contact.favorite ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: AetherColors.lagoon,
                ),
              ),
              PopupMenuButton<String>(
                onSelected: (v) {
                  if (v == 'edit') onEdit();
                  if (v == 'delete') onDelete();
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Edit')),
                  PopupMenuItem(value: 'delete', child: Text('Delete')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

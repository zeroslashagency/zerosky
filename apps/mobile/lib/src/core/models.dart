import 'package:decimal/decimal.dart';

/// Prisma Decimal arrives as a string over the wire. Parse it safely.
Decimal parseDecimal(dynamic value) {
  if (value == null) return Decimal.zero;
  if (value is String) return Decimal.parse(value);
  if (value is num) return Decimal.parse(value.toString());
  throw ArgumentError('Cannot parse Decimal from $value');
}

/// Branch model.
class Branch {
  const Branch({
    required this.id,
    required this.name,
    required this.code,
    this.address,
  });

  final String id;
  final String name;
  final String code;
  final String? address;

  factory Branch.fromJson(Map<String, dynamic> json) {
    return Branch(
      id: json['id'] as String,
      name: json['name'] as String,
      code: json['code'] as String,
      address: json['address'] as String?,
    );
  }
}

/// Table model.
class Table {
  const Table({
    required this.id,
    required this.branchId,
    required this.name,
    required this.seats,
    required this.state,
    this.section,
  });

  final String id;
  final String branchId;
  final String name;
  final int seats;
  final String state; // AVAILABLE, OCCUPIED, RESERVED, BILLED, CLEANING
  final String? section;

  factory Table.fromJson(Map<String, dynamic> json) {
    return Table(
      id: json['id'] as String,
      branchId: json['branchId'] as String,
      name: json['name'] as String,
      seats: json['seats'] as int,
      state: json['state'] as String,
      section: json['section'] as String?,
    );
  }
}

/// Menu category model.
class Category {
  const Category({
    required this.id,
    required this.name,
    required this.items,
  });

  final String id;
  final String name;
  final List<MenuItem> items;

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as String,
      name: json['name'] as String,
      items: (json['items'] as List<dynamic>)
          .map((e) => MenuItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// Menu item model.
class MenuItem {
  const MenuItem({
    required this.id,
    required this.name,
    required this.price,
    required this.taxRate,
    required this.isVeg,
    required this.isAvailable,
    this.description,
    this.imageUrl,
  });

  final String id;
  final String name;
  final Decimal price;
  final Decimal taxRate;
  final bool isVeg;
  final bool isAvailable;
  final String? description;
  final String? imageUrl;

  factory MenuItem.fromJson(Map<String, dynamic> json) {
    return MenuItem(
      id: json['id'] as String,
      name: json['name'] as String,
      price: parseDecimal(json['price']),
      taxRate: parseDecimal(json['taxRate']),
      isVeg: json['isVeg'] as bool,
      isAvailable: json['isAvailable'] as bool,
      description: json['description'] as String?,
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

/// Order model.
class Order {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.type,
    required this.status,
    required this.guestCount,
    required this.subtotal,
    required this.taxTotal,
    required this.grandTotal,
    required this.items,
    required this.createdAt,
    this.tableId,
    this.notes,
  });

  final String id;
  final String orderNumber;
  final String type; // DINE_IN, TAKEAWAY, DELIVERY, AGGREGATOR
  final String status; // OPEN, SENT_TO_KITCHEN, READY, SERVED, BILLED, PAID, CANCELLED
  final int guestCount;
  final Decimal subtotal;
  final Decimal taxTotal;
  final Decimal grandTotal;
  final List<OrderItem> items;
  final DateTime createdAt;
  final String? tableId;
  final String? notes;

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      type: json['type'] as String,
      status: json['status'] as String,
      guestCount: json['guestCount'] as int,
      subtotal: parseDecimal(json['subtotal']),
      taxTotal: parseDecimal(json['taxTotal']),
      grandTotal: parseDecimal(json['grandTotal']),
      items: (json['items'] as List<dynamic>)
          .map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      tableId: json['tableId'] as String?,
      notes: json['notes'] as String?,
    );
  }
}

/// Order item model.
class OrderItem {
  const OrderItem({
    required this.id,
    required this.itemId,
    required this.name,
    required this.quantity,
    required this.unitPrice,
    required this.taxRate,
    required this.lineTotal,
    required this.status,
    this.seat,
    this.notes,
  });

  final String id;
  final String itemId;
  final String name;
  final int quantity;
  final Decimal unitPrice;
  final Decimal taxRate;
  final Decimal lineTotal;
  final String status; // PENDING, PREPARING, READY, SERVED, CANCELLED
  final int? seat;
  final String? notes;

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      id: json['id'] as String,
      itemId: json['itemId'] as String,
      name: json['name'] as String,
      quantity: json['quantity'] as int,
      unitPrice: parseDecimal(json['unitPrice']),
      taxRate: parseDecimal(json['taxRate']),
      lineTotal: parseDecimal(json['lineTotal']),
      status: json['status'] as String,
      seat: json['seat'] as int?,
      notes: json['notes'] as String?,
    );
  }
}

/// KOT model.
class Kot {
  const Kot({
    required this.id,
    required this.kotNumber,
    required this.status,
    required this.items,
    required this.createdAt,
    this.station,
    this.printedAt,
  });

  final String id;
  final String kotNumber;
  final String status; // NEW, MODIFIED, PARTIAL, READY, SERVED, CANCELLED
  final List<OrderItem> items;
  final DateTime createdAt;
  final String? station;
  final DateTime? printedAt;

  factory Kot.fromJson(Map<String, dynamic> json) {
    return Kot(
      id: json['id'] as String,
      kotNumber: json['kotNumber'] as String,
      status: json['status'] as String,
      items: (json['items'] as List<dynamic>)
          .map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      station: json['station'] as String?,
      printedAt: json['printedAt'] != null
          ? DateTime.parse(json['printedAt'] as String)
          : null,
    );
  }
}
